import type { ArcRelationship, ExplorationArc, RangeCard, RangeCardResult, RejectedArcCandidate, ValidationResult } from "./types.js";

const clone = <T>(value: T): T => structuredClone(value);
const nonBlank = (value: string): boolean => value.trim().length > 0;

export function outcomeChangingFactorErrors(arc: ExplorationArc): string[] {
  const errors: string[] = [];
  if (!arc.outcomeChangingFactor.couldMateriallyChangeOutcome) errors.push("The candidate fails the Outcome-Changing Factor test.");
  if (arc.outcomeChangingFactor.dimensions.length === 0) errors.push("At least one affected outcome dimension is required.");
  if (!nonBlank(arc.outcomeChangingFactor.rationale)) errors.push("An outcome-changing rationale is required.");
  if (!nonBlank(arc.objectiveLink) || arc.affectedObjectiveParts.length === 0) errors.push("The arc must retain a traceable link to the original objective.");
  if (!nonBlank(arc.potentialDecisionImpact.description)) errors.push("Potential decision impact must be described.");
  return errors;
}

function arcErrors(arc: ExplorationArc, expectedPosition?: ExplorationArc["arcPosition"]): string[] {
  const errors = outcomeChangingFactorErrors(arc);
  if (!nonBlank(arc.id) || !nonBlank(arc.title) || !nonBlank(arc.description)) errors.push("Arc id, title, and description are required.");
  if (expectedPosition && arc.arcPosition !== expectedPosition) errors.push(`Expected ${expectedPosition}, received ${arc.arcPosition}.`);
  if (arc.arcPosition === "MAIN_ARC" && (arc.arcType !== "STATED_PATH" || arc.purpose !== "STATED_PATH")) errors.push("MAIN_ARC must preserve the stated path.");
  if (arc.arcPosition !== "MAIN_ARC" && arc.purpose === "STATED_PATH") errors.push("Lateral and interlocking arcs must identify alternative-path or hidden-factor exploration.");
  if (arc.status === "EVIDENCE_SUPPORTED" && arc.evidenceReferences.length === 0) errors.push("EVIDENCE_SUPPORTED requires an evidence reference; a proposed arc is not evidence.");
  return errors;
}

function relationshipErrors(relationship: ArcRelationship, arcIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  if (relationship.arcIds.length < 2 || new Set(relationship.arcIds).size < 2) errors.push("An interlocking relationship requires at least two distinct arcs.");
  if (relationship.arcIds.some((id) => !arcIds.has(id))) errors.push("Relationship references an unknown arc.");
  if (!nonBlank(relationship.rationale)) errors.push("Relationship rationale is required.");
  return errors;
}

export function validateRangeCard(rangeCard: RangeCard): ValidationResult {
  const errors: string[] = [];
  if (!nonBlank(rangeCard.originalQuestion) || !nonBlank(rangeCard.desiredResult)) errors.push("Original question and desired result are required.");
  const arcs = [rangeCard.mainArc, rangeCard.leftArc, rangeCard.rightArc, ...rangeCard.interlockingArcs];
  const expected: ExplorationArc["arcPosition"][] = ["MAIN_ARC", "LEFT_ARC", "RIGHT_ARC"];
  [rangeCard.mainArc, rangeCard.leftArc, rangeCard.rightArc].forEach((arc, index) => errors.push(...arcErrors(arc, expected[index])));
  rangeCard.interlockingArcs.forEach((arc) => errors.push(...arcErrors(arc, "INTERLOCKING_ARC")));
  const ids = arcs.map((arc) => arc.id);
  if (new Set(ids).size !== ids.length) errors.push("Arc ids must be unique.");
  const idSet = new Set(ids);
  rangeCard.relationships.forEach((relationship) => errors.push(...relationshipErrors(relationship, idSet)));
  return { valid: errors.length === 0, errors };
}

export function createRangeCard(rangeCardInput: RangeCard, candidates: readonly ExplorationArc[] = []): RangeCardResult {
  const rangeCard = clone(rangeCardInput);
  const validation = validateRangeCard(rangeCard);
  if (!validation.valid) throw new TypeError(`Invalid range card:\n${validation.errors.join("\n")}`);
  const rejectedCandidates: RejectedArcCandidate[] = [];
  const acceptedArcIds: string[] = [rangeCard.mainArc.id, rangeCard.leftArc.id, rangeCard.rightArc.id, ...rangeCard.interlockingArcs.map((arc) => arc.id)];
  for (const candidate of clone(candidates)) {
    const reasons = arcErrors(candidate);
    if (reasons.length) rejectedCandidates.push({ candidate, reasons });
    else acceptedArcIds.push(candidate.id);
  }
  return { rangeCard, acceptedArcIds, rejectedCandidates };
}
