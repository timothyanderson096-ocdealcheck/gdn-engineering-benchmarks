import { REAL_CASE_SCHEMA_VERSION, type RealCaseValidationResult, type RealResolvedCase } from "./types.js";

type RecordValue = Record<string, unknown>;

const outcomeStatuses = new Set(["purchased", "rejected", "seller_declined", "negotiated_successfully", "mechanical_failure_discovered", "price_moved", "prediction_true", "prediction_false", "prediction_partial", "no_longer_available", "unresolved_insufficient", "other"]);
const provenanceTypes = new Set(["direct_observation", "primary_record", "secondary_source", "seller_claim", "user_observation", "inference", "other"]);
const evidenceTypes = new Set(["observation", "document", "testimony", "measurement", "record", "other"]);
const actions = new Set(["ACT", "WAIT", "ABORT", "CHANGE_PATH", "ACQUIRE_INFORMATION"]);

const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const timestamp = (value: unknown): number | null => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

function checkTime(value: unknown, path: string, errors: string[]): number | null {
  if (!isRecord(value)) { errors.push(`${path} must be an object.`); return null; }
  const parsed = timestamp(value.value);
  if (parsed === null) errors.push(`${path}.value must be an ISO-compatible timestamp.`);
  if (typeof value.approximate !== "boolean") errors.push(`${path}.approximate must explicitly be boolean.`);
  return parsed;
}

function duplicateIds(ids: readonly string[], label: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`Duplicate ${label} ID: ${id}.`);
    seen.add(id);
  }
}

function checkSource(value: unknown, path: string, errors: string[]): string | null {
  if (!isRecord(value)) { errors.push(`${path} must be an object.`); return null; }
  for (const field of ["sourceId", "sourceType", "sourceName", "domain", "provenance", "roleInDecision"]) {
    if (!isString(value[field])) errors.push(`${path}.${field} is required.`);
  }
  checkTime(value.accessedAt, `${path}.accessedAt`, errors);
  return isString(value.sourceId) ? value.sourceId : null;
}

function checkScore(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) errors.push(`${path} must be between 0 and 1.`);
}

export function validateRealResolvedCase(value: unknown): RealCaseValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["$ must be an object."] };
  if (value.schemaVersion !== REAL_CASE_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${REAL_CASE_SCHEMA_VERSION}.`);
  if (value.recordKind !== "REAL_CASE") errors.push("recordKind must be REAL_CASE.");
  if (value.resolutionStatus !== "RESOLVED" && value.resolutionStatus !== "UNRESOLVED") errors.push("resolutionStatus must be RESOLVED or UNRESOLVED.");
  for (const field of ["caseId", "title", "domain", "category", "originalQuestion", "desiredResult"]) {
    if (!isString(value[field])) errors.push(`${field} is required.`);
  }
  if (!isRecord(value.timeframe) || !isString(value.timeframe.label) || !["immediate", "near_term", "flexible"].includes(String(value.timeframe.urgency))) errors.push("timeframe is invalid.");
  if (!["low", "medium", "high"].includes(String(value.stakes))) errors.push("stakes is invalid.");
  if (!["easy", "moderate", "hard"].includes(String(value.reversibility))) errors.push("reversibility is invalid.");

  const start = checkTime(value.decisionStartTime, "decisionStartTime", errors);
  const resolution = value.resolutionTime === undefined ? null : checkTime(value.resolutionTime, "resolutionTime", errors);
  const primarySourceId = checkSource(value.caseSource, "caseSource", errors);
  if (!Array.isArray(value.verificationSources)) errors.push("verificationSources must be an array.");
  const verificationSourceIds = asArray(value.verificationSources).map((source, index) => checkSource(source, `verificationSources[${index}]`, errors)).filter((id): id is string => id !== null);
  const sourceIds = [...(primarySourceId ? [primarySourceId] : []), ...verificationSourceIds];
  duplicateIds(sourceIds, "source", errors);
  const knownSources = new Set(sourceIds);

  if (!isRecord(value.initialState)) errors.push("initialState must be an object.");
  const initialState = isRecord(value.initialState) ? value.initialState : {};
  if (!Array.isArray(initialState.hypotheses) || initialState.hypotheses.length < 2) errors.push("initialState.hypotheses must contain at least two hypotheses.");
  if (!Array.isArray(initialState.unknowns)) errors.push("initialState.unknowns must be an array.");
  const hypothesisIds = asArray(initialState.hypotheses).map((item) => isRecord(item) && isString(item.id) ? item.id : "");
  const unknownIds = asArray(initialState.unknowns).map((item) => isRecord(item) && isString(item.id) ? item.id : "");
  duplicateIds(hypothesisIds.filter(Boolean), "hypothesis", errors);
  duplicateIds(unknownIds.filter(Boolean), "unknown", errors);
  const knownHypotheses = new Set(hypothesisIds);
  const knownUnknowns = new Set(unknownIds);

  if (!Array.isArray(value.chronologicalStages) || value.chronologicalStages.length === 0) errors.push("chronologicalStages must contain at least one stage.");
  const stageIds: string[] = [];
  const evidenceIds: string[] = [];
  let priorStageTime = start;
  for (const [stageIndex, rawStage] of asArray(value.chronologicalStages).entries()) {
    const path = `chronologicalStages[${stageIndex}]`;
    if (!isRecord(rawStage)) { errors.push(`${path} must be an object.`); continue; }
    if (!isString(rawStage.stageId)) errors.push(`${path}.stageId is required.`); else stageIds.push(rawStage.stageId);
    const stageTime = checkTime(rawStage.timestamp, `${path}.timestamp`, errors);
    if (stageTime !== null && start !== null && stageTime < start) errors.push(`${path} occurs before decisionStartTime.`);
    if (stageTime !== null && priorStageTime !== null && stageTime < priorStageTime) errors.push(`${path} is not chronological.`);
    if (stageTime !== null && resolution !== null && stageTime > resolution) errors.push(`${path} occurs after resolutionTime and cannot enter replay.`);
    if (stageTime !== null) priorStageTime = stageTime;
    if (!Array.isArray(rawStage.sourceReferences)) errors.push(`${path}.sourceReferences must be an array.`);
    for (const sourceId of asArray(rawStage.sourceReferences)) if (!isString(sourceId) || !knownSources.has(sourceId)) errors.push(`${path} references unknown source ${String(sourceId)}.`);
    if (!Array.isArray(rawStage.newlyResolvedUnknowns)) errors.push(`${path}.newlyResolvedUnknowns must be an array.`);
    for (const unknownId of asArray(rawStage.newlyResolvedUnknowns)) if (!isString(unknownId) || !knownUnknowns.has(unknownId)) errors.push(`${path} resolves unknown unknown ID ${String(unknownId)}.`);
    if (!Array.isArray(rawStage.newlyAvailableEvidence)) errors.push(`${path}.newlyAvailableEvidence must be an array.`);
    for (const [evidenceIndex, rawEvidence] of asArray(rawStage.newlyAvailableEvidence).entries()) {
      const evidencePath = `${path}.newlyAvailableEvidence[${evidenceIndex}]`;
      if (!isRecord(rawEvidence)) { errors.push(`${evidencePath} must be an object.`); continue; }
      if (!isString(rawEvidence.evidenceId)) errors.push(`${evidencePath}.evidenceId is required.`); else evidenceIds.push(rawEvidence.evidenceId);
      if (!isString(rawEvidence.statement)) errors.push(`${evidencePath}.statement is required.`);
      if (!isString(rawEvidence.sourceId) || !knownSources.has(rawEvidence.sourceId)) errors.push(`${evidencePath} references an unknown source.`);
      const acquired = checkTime(rawEvidence.acquiredAt, `${evidencePath}.acquiredAt`, errors);
      if (acquired !== null && stageTime !== null && acquired > stageTime) errors.push(`${evidencePath} was acquired after its stage timestamp.`);
      if (acquired !== null && resolution !== null && acquired > resolution) errors.push(`${evidencePath} originated after resolution and cannot enter replay.`);
      if (!provenanceTypes.has(String(rawEvidence.provenanceType))) errors.push(`${evidencePath}.provenanceType is invalid.`);
      if (!isString(rawEvidence.provenance)) errors.push(`${evidencePath}.provenance is required.`);
      if (!evidenceTypes.has(String(rawEvidence.evidenceType))) errors.push(`${evidencePath}.evidenceType is invalid.`);
      for (const score of ["relevance", "reliability", "directness", "freshness", "independence"]) checkScore(rawEvidence[score], `${evidencePath}.${score}`, errors);
      for (const hypothesisId of [...asArray(rawEvidence.supports), ...asArray(rawEvidence.contradicts)]) if (!isString(hypothesisId) || !knownHypotheses.has(hypothesisId)) errors.push(`${evidencePath} references unknown hypothesis ${String(hypothesisId)}.`);
      if ("postOutcome" in rawEvidence || "outcomeTruth" in rawEvidence) errors.push(`${evidencePath} contains post-outcome fields.`);
    }
    if (rawStage.historicalConclusion !== undefined) {
      if (!isRecord(rawStage.historicalConclusion)) errors.push(`${path}.historicalConclusion must be an object.`);
      else {
        if (!actions.has(String(rawStage.historicalConclusion.action))) errors.push(`${path}.historicalConclusion.action is invalid.`);
        checkScore(rawStage.historicalConclusion.confidence, `${path}.historicalConclusion.confidence`, errors);
        if (!knownHypotheses.has(String(rawStage.historicalConclusion.leadingHypothesisId))) errors.push(`${path}.historicalConclusion references an unknown hypothesis.`);
      }
    }
  }
  duplicateIds(stageIds, "stage", errors);
  duplicateIds(evidenceIds, "evidence", errors);

  if (!isRecord(value.actualOutcome)) errors.push("actualOutcome must be an object.");
  const outcome = isRecord(value.actualOutcome) ? value.actualOutcome : {};
  if (!outcomeStatuses.has(String(outcome.status))) errors.push("actualOutcome.status is invalid.");
  if (!isString(outcome.description)) errors.push("actualOutcome.description is required.");
  if (!Array.isArray(value.outcomeNotes) || !Array.isArray(value.usefulSignals) || !Array.isArray(value.misleadingSignals) || !Array.isArray(value.relevantUnknowns)) errors.push("Outcome annotation fields must be arrays.");
  for (const evidenceId of [...asArray(value.usefulSignals), ...asArray(value.misleadingSignals)]) if (!isString(evidenceId) || !evidenceIds.includes(evidenceId)) errors.push(`Outcome annotation references unknown evidence ${String(evidenceId)}.`);
  for (const unknownId of asArray(value.relevantUnknowns)) if (!isString(unknownId) || !knownUnknowns.has(unknownId)) errors.push(`relevantUnknowns references unknown ID ${String(unknownId)}.`);

  if (value.resolutionStatus === "RESOLVED") {
    if (resolution === null) errors.push("Resolved cases require resolutionTime.");
    if (outcome.status === "unresolved_insufficient") errors.push("Resolved cases cannot use unresolved_insufficient outcome status.");
    if (typeof value.desiredResultAchieved !== "boolean") errors.push("Resolved cases require boolean desiredResultAchieved.");
    if (!knownHypotheses.has(String(outcome.correctHypothesisId))) errors.push("Resolved cases require actualOutcome.correctHypothesisId matching an initial hypothesis.");
    if (!Array.isArray(outcome.successfulActions) || outcome.successfulActions.length === 0 || outcome.successfulActions.some((action) => !actions.has(String(action)))) errors.push("Resolved cases require valid actualOutcome.successfulActions.");
    if (!Number.isInteger(outcome.earliestSufficientStage) || Number(outcome.earliestSufficientStage) < 1 || Number(outcome.earliestSufficientStage) > asArray(value.chronologicalStages).length) errors.push("Resolved cases require a valid earliestSufficientStage.");
  } else {
    if (value.desiredResultAchieved !== null) errors.push("Unresolved cases must use null desiredResultAchieved.");
    if (outcome.status !== "unresolved_insufficient") errors.push("Unresolved cases must use unresolved_insufficient outcome status.");
  }

  if (!Array.isArray(value.postOutcomeInformation)) errors.push("postOutcomeInformation must be an array.");
  const postOutcomeIds: string[] = [];
  for (const [index, rawInformation] of asArray(value.postOutcomeInformation).entries()) {
    const path = `postOutcomeInformation[${index}]`;
    if (!isRecord(rawInformation)) { errors.push(`${path} must be an object.`); continue; }
    if (!isString(rawInformation.informationId)) errors.push(`${path}.informationId is required.`); else postOutcomeIds.push(rawInformation.informationId);
    if (!isString(rawInformation.statement) || !isString(rawInformation.provenance)) errors.push(`${path} requires statement and provenance.`);
    if (!isString(rawInformation.sourceId) || !knownSources.has(rawInformation.sourceId)) errors.push(`${path} references an unknown source.`);
    const acquired = checkTime(rawInformation.acquiredAt, `${path}.acquiredAt`, errors);
    if (acquired !== null && resolution !== null && acquired < resolution) errors.push(`${path} predates resolution and belongs in a chronological stage instead.`);
    if (!provenanceTypes.has(String(rawInformation.provenanceType))) errors.push(`${path}.provenanceType is invalid.`);
  }
  duplicateIds(postOutcomeIds, "post-outcome information", errors);
  for (const id of postOutcomeIds) if (evidenceIds.includes(id)) errors.push(`Post-outcome information ID ${id} duplicates replay evidence.`);

  if (!isRecord(value.provenance) || !isString(value.provenance.authorStatement) || !Array.isArray(value.provenance.archiveReferences)) errors.push("provenance author statement and archive references are required.");
  if (!isRecord(value.metadata) || !isString(value.metadata.author) || timestamp(value.metadata.authoredAt) === null || !["DRAFT", "REVIEWED"].includes(String(value.metadata.reviewStatus))) errors.push("metadata is invalid.");
  if (isRecord(value.metadata) && value.metadata.reviewStatus === "REVIEWED" && (!isString(value.metadata.reviewer) || timestamp(value.metadata.reviewedAt) === null)) errors.push("Reviewed cases require reviewer and reviewedAt.");

  return { valid: errors.length === 0, errors };
}

export function parseRealResolvedCase(value: unknown): RealResolvedCase {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  const validation = validateRealResolvedCase(parsed);
  if (!validation.valid) throw new TypeError(`Invalid real case:\n${validation.errors.join("\n")}`);
  return structuredClone(parsed) as RealResolvedCase;
}
