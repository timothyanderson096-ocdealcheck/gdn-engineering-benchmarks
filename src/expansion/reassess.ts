import type { AnalysisResult, Evidence } from "../domain.js";
import { analyze } from "../engine.js";
import type { AcquiredEvidence, EvidenceGap, ExpandedEvidenceField, ExpansionPlan, ExpansionReassessment, ExpansionResult, StartingEvidenceField } from "./types.js";

const clone = <T>(value: T): T => structuredClone(value);

export function initializeExpandedEvidenceField(startingEvidence: StartingEvidenceField, gaps: readonly EvidenceGap[], plan: ExpansionPlan): ExpandedEvidenceField {
  return {
    startingEvidence: clone(startingEvidence),
    newlyAcquiredEvidence: [],
    unresolvedGaps: clone(gaps),
    rejectedEvidence: [],
    contradictoryEvidenceIds: [],
    chronology: [
      { timestamp: startingEvidence.createdAt, eventType: "STARTING_EVIDENCE_RECORDED", referenceIds: startingEvidence.items.map((item) => item.id), notes: [] },
      { timestamp: startingEvidence.createdAt, eventType: "PROBE_PLANNED", referenceIds: plan.prioritized.map((item) => item.probe.id), notes: [plan.stoppingRule] },
    ],
    reassessmentHistory: [],
  };
}

export function reassessAfterExpansion(args: {
  previous: AnalysisResult;
  plan: ExpansionPlan;
  field: ExpandedEvidenceField;
  acquiredEvidence: readonly AcquiredEvidence[];
  resolvedGapIds?: readonly string[];
  now: Date;
}): { analysis: AnalysisResult; expansion: ExpansionResult } {
  const previous = clone(args.previous);
  const field = clone(args.field);
  const acquired = clone(args.acquiredEvidence);
  const plannedProbeIds = new Set([...args.plan.prioritized.map((item) => item.probe.id), ...args.plan.deferred.map((probe) => probe.id)]);
  const existingEvidenceIds = new Set(previous.decisionCase.evidence.map((item) => item.id));
  const acquiredIds = new Set<string>();
  for (const item of acquired) {
    if (!plannedProbeIds.has(item.producedByProbeId)) throw new TypeError(`Acquired evidence references unknown probe ${item.producedByProbeId}.`);
    if (existingEvidenceIds.has(item.evidence.id) || acquiredIds.has(item.evidence.id)) throw new TypeError(`Duplicate acquired evidence id ${item.evidence.id}.`);
    acquiredIds.add(item.evidence.id);
  }
  const analysis = analyze({ ...previous.decisionCase, evidence: [...previous.decisionCase.evidence, ...acquired.map((item) => clone(item.evidence))] }, { now: args.now });
  const changed: string[] = [];
  if (analysis.conclusion.action !== previous.conclusion.action) changed.push("conclusion action");
  if (analysis.conclusion.confidence !== previous.conclusion.confidence) changed.push("confidence");
  if (analysis.snapshot.leadingHypothesisId !== previous.snapshot.leadingHypothesisId) changed.push("leading hypothesis");
  const resolved = new Set(args.resolvedGapIds ?? []);
  const remainingGaps = field.unresolvedGaps.filter((gap) => !resolved.has(gap.id));
  const importantGaps = remainingGaps.filter((gap) => gap.status === "BLOCKING" || gap.status === "MATERIAL");
  const reassessment: ExpansionReassessment = {
    id: `expansion-reassessment-${field.reassessmentHistory.length + 1}`,
    timestamp: args.now.toISOString(),
    previousConclusion: clone(previous.conclusion),
    previousConfidence: previous.conclusion.confidence,
    newEvidenceIds: acquired.map((item) => item.evidence.id),
    newConclusion: clone(analysis.conclusion),
    newConfidence: analysis.conclusion.confidence,
    changed,
    unchanged: ["original question", "desired result", "previous evidence records", "previous analysis snapshots"],
    remainingImportantGaps: clone(importantGaps),
    previousSnapshotId: previous.snapshot.id,
    newSnapshotId: analysis.snapshot.id,
  };
  const expandedField: ExpandedEvidenceField = {
    ...field,
    newlyAcquiredEvidence: [...field.newlyAcquiredEvidence, ...acquired],
    unresolvedGaps: remainingGaps,
    contradictoryEvidenceIds: [...new Set([...field.contradictoryEvidenceIds, ...acquired.filter((item) => item.evidence.contradicts.length > 0).map((item) => item.evidence.id)])],
    chronology: [
      ...field.chronology,
      ...acquired.map((item) => ({ timestamp: item.acquiredAt, eventType: "EVIDENCE_ACQUIRED" as const, referenceIds: [item.evidence.id, item.producedByProbeId], notes: [] })),
      { timestamp: args.now.toISOString(), eventType: "REASSESSMENT_COMPLETED", referenceIds: [reassessment.id, analysis.snapshot.id], notes: changed },
    ],
    reassessmentHistory: [...field.reassessmentHistory, reassessment],
  };
  return { analysis, expansion: { plan: clone(args.plan), field: expandedField, currentConclusion: clone(analysis.conclusion) } };
}

export function acquiredEvidence(evidence: Evidence, producedByProbeId: string, acquiredAt: string): AcquiredEvidence {
  return { evidence: clone(evidence), producedByProbeId, acquiredAt };
}
