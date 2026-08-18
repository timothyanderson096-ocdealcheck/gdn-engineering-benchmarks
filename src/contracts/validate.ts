import { PRESENTATION_SCHEMA_VERSION, type PresentationContract, type ValidationResult } from "./types.js";

type UnknownRecord = Record<string, unknown>;

const condensedRequired = [
  "schemaVersion", "mode", "conclusion", "confidence", "mainReason", "mainRiskOrUncertainty", "nextActionOrTrigger", "availableExpansions",
] as const;
const balancedRequired = [
  "schemaVersion", "mode", "conclusion", "confidence", "strongestEvidenceDrivers", "highValueUnknowns", "hypotheses", "contradictions", "reassessment", "availableExpansions",
] as const;
const auditRequired = [
  "schemaVersion", "mode", "availableExpansions", "question", "desiredResult", "timeframe", "stakes", "reversibility", "conclusion",
  "evidence", "sources", "sourceObservations", "hypotheses", "hypothesisWeights", "wildcardHypotheses", "contradictions", "hunches", "unknowns",
  "predictionLedger", "analysisSnapshots", "confidenceHistory", "conclusionHistory", "outcomes", "learningNotes", "availabilityNotes",
] as const;
const auditOnly = new Set(["question", "desiredResult", "timeframe", "stakes", "reversibility", "evidence", "sources", "sourceObservations", "hypothesisWeights", "wildcardHypotheses", "hunches", "unknowns", "predictionLedger", "analysisSnapshots", "confidenceHistory", "conclusionHistory", "outcomes", "learningNotes", "availabilityNotes"]);
const balancedOnly = new Set(["strongestEvidenceDrivers", "highValueUnknowns", "hypotheses", "contradictions", "reassessment"]);

function record(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function checkJsonSafety(value: unknown, path: string, errors: string[]): void {
  if (value === undefined) { errors.push(`${path} must not be undefined.`); return; }
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") { if (!Number.isFinite(value)) errors.push(`${path} must be finite.`); return; }
  if (Array.isArray(value)) { value.forEach((item, index) => checkJsonSafety(item, `${path}[${index}]`, errors)); return; }
  if (!record(value)) { errors.push(`${path} must be a plain JSON object.`); return; }
  for (const [key, item] of Object.entries(value)) checkJsonSafety(item, `${path}.${key}`, errors);
}

function requireFields(value: UnknownRecord, fields: readonly string[], errors: string[]): void {
  for (const field of fields) if (!(field in value)) errors.push(`$.${field} is required.`);
}

function requireString(value: UnknownRecord, field: string, errors: string[]): void {
  if (typeof value[field] !== "string") errors.push(`$.${field} must be a string.`);
}

function requireArray(value: UnknownRecord, field: string, errors: string[]): void {
  if (!Array.isArray(value[field])) errors.push(`$.${field} must be an array.`);
}

function validateConclusion(value: unknown, errors: string[]): void {
  if (!record(value)) { errors.push("$.conclusion must be an object."); return; }
  if (typeof value.action !== "string") errors.push("$.conclusion.action must be a string.");
  if (typeof value.statement !== "string") errors.push("$.conclusion.statement must be a string.");
}

function validateExpansions(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) { errors.push("$.availableExpansions must be an array."); return; }
  value.forEach((item, index) => {
    if (!record(item)) { errors.push(`$.availableExpansions[${index}] must be an object.`); return; }
    if (typeof item.id !== "string" || typeof item.label !== "string") errors.push(`$.availableExpansions[${index}] requires string id and label.`);
    if (!(["CONDENSED", "BALANCED", "AUDIT"] as unknown[]).includes(item.targetMode)) errors.push(`$.availableExpansions[${index}].targetMode is invalid.`);
  });
}

function validateCondensed(value: UnknownRecord, errors: string[]): void {
  requireFields(value, condensedRequired, errors);
  requireString(value, "mainReason", errors);
  requireString(value, "mainRiskOrUncertainty", errors);
  requireString(value, "nextActionOrTrigger", errors);
  if (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1) errors.push("$.confidence must be between 0 and 1.");
  for (const field of [...auditOnly, ...balancedOnly]) if (field in value) errors.push(`$.${field} is not allowed in CONDENSED.`);
}

function validateBalanced(value: UnknownRecord, errors: string[]): void {
  requireFields(value, balancedRequired, errors);
  for (const field of ["strongestEvidenceDrivers", "highValueUnknowns", "hypotheses", "contradictions"]) requireArray(value, field, errors);
  if (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1) errors.push("$.confidence must be between 0 and 1.");
  if (!record(value.reassessment)) errors.push("$.reassessment must be an object.");
  for (const field of auditOnly) if (field in value) errors.push(`$.${field} is not allowed in BALANCED.`);
  if (Array.isArray(value.strongestEvidenceDrivers)) value.strongestEvidenceDrivers.forEach((item, index) => {
    if (!record(item) || typeof item.id !== "string" || typeof item.sourceId !== "string" || typeof item.provenance !== "string") {
      errors.push(`$.strongestEvidenceDrivers[${index}] lacks traceability fields.`);
    }
  });
  if (Array.isArray(value.hypotheses)) value.hypotheses.forEach((item, index) => {
    if (!record(item) || typeof item.id !== "string" || typeof item.weight !== "number") errors.push(`$.hypotheses[${index}] is invalid.`);
  });
}

function validateAudit(value: UnknownRecord, errors: string[]): void {
  requireFields(value, auditRequired, errors);
  for (const field of ["evidence", "sources", "sourceObservations", "hypotheses", "wildcardHypotheses", "contradictions", "hunches", "unknowns", "predictionLedger", "analysisSnapshots", "confidenceHistory", "conclusionHistory", "outcomes", "learningNotes", "availabilityNotes"]) requireArray(value, field, errors);
  for (const field of ["question", "desiredResult", "stakes", "reversibility"]) requireString(value, field, errors);
  if (!record(value.timeframe)) errors.push("$.timeframe must be an object.");
  if (!record(value.hypothesisWeights)) errors.push("$.hypothesisWeights must be an object.");
  if (Array.isArray(value.evidence)) value.evidence.forEach((item, index) => {
    if (!record(item) || typeof item.id !== "string" || typeof item.sourceId !== "string" || typeof item.provenance !== "string") {
      errors.push(`$.evidence[${index}] lacks id or provenance references.`);
    }
  });
}

export function validatePresentationContract(value: unknown): ValidationResult {
  const errors: string[] = [];
  checkJsonSafety(value, "$", errors);
  if (!record(value)) return { valid: false, errors: [...errors, "$ must be an object."] };
  if (value.schemaVersion !== PRESENTATION_SCHEMA_VERSION) errors.push(`$.schemaVersion must equal ${PRESENTATION_SCHEMA_VERSION}.`);
  if (!(["CONDENSED", "BALANCED", "AUDIT"] as unknown[]).includes(value.mode)) errors.push("$.mode is invalid.");
  validateConclusion(value.conclusion, errors);
  validateExpansions(value.availableExpansions, errors);
  if (value.mode === "CONDENSED") validateCondensed(value, errors);
  else if (value.mode === "BALANCED") validateBalanced(value, errors);
  else if (value.mode === "AUDIT") validateAudit(value, errors);
  return { valid: errors.length === 0, errors };
}

export function assertPresentationContract(value: unknown): asserts value is PresentationContract {
  const result = validatePresentationContract(value);
  if (!result.valid) throw new TypeError(`Invalid presentation contract:\n${result.errors.join("\n")}`);
}
