import type { Evidence } from "../domain.js";
import type { ResolvedCase } from "../calibration/types.js";
import type { RealEvidence, RealResolvedCase } from "./types.js";

function toEvidence(evidence: RealEvidence): Evidence {
  return {
    id: evidence.evidenceId,
    statement: evidence.statement,
    sourceId: evidence.sourceId,
    provenance: `[${evidence.provenanceType}] ${evidence.provenance}`,
    timestamp: evidence.acquiredAt.value,
    type: evidence.evidenceType,
    relevance: evidence.relevance,
    reliability: evidence.reliability,
    directness: evidence.directness,
    freshness: evidence.freshness,
    independence: evidence.independence,
    supports: [...evidence.supports],
    contradicts: [...evidence.contradicts],
  };
}

export function toCalibrationResolvedCase(realCase: RealResolvedCase): ResolvedCase {
  if (realCase.resolutionStatus !== "RESOLVED") throw new Error(`Real case ${realCase.caseId} is unresolved and cannot enter calibration metrics.`);
  const evidenceById = new Map(realCase.chronologicalStages.flatMap((stage) => stage.newlyAvailableEvidence).map((evidence) => [evidence.evidenceId, evidence]));
  const usefulSourceIds = [...new Set(realCase.usefulSignals.map((id) => evidenceById.get(id)?.sourceId).filter((id): id is string => Boolean(id)))];
  const misleadingSourceIds = [...new Set(realCase.misleadingSignals.map((id) => evidenceById.get(id)?.sourceId).filter((id): id is string => Boolean(id)))];
  return {
    id: realCase.caseId,
    question: realCase.originalQuestion,
    desiredResult: realCase.desiredResult,
    timeframe: structuredClone(realCase.timeframe),
    stakes: realCase.stakes,
    reversibility: realCase.reversibility,
    // Source records remain in the real-case layer. The v0.1 SourceProfile requires
    // numeric trust aids, which this adapter will not invent.
    sources: [],
    hypotheses: structuredClone(realCase.initialState.hypotheses),
    unknowns: structuredClone(realCase.initialState.unknowns),
    stages: realCase.chronologicalStages.map((stage) => ({
      id: stage.stageId,
      timestamp: stage.timestamp.value,
      evidence: stage.newlyAvailableEvidence.map(toEvidence),
      ...(stage.newlyResolvedUnknowns.length ? { resolvedUnknownIds: [...stage.newlyResolvedUnknowns] } : {}),
      ...(stage.historicalConclusion ? { recordedConclusion: structuredClone(stage.historicalConclusion) } : {}),
    })),
    outcome: {
      description: realCase.actualOutcome.description,
      resolvedAt: realCase.resolutionTime!.value,
      correctHypothesisId: realCase.actualOutcome.correctHypothesisId!,
      successfulActions: [...realCase.actualOutcome.successfulActions!],
      desiredResultAchieved: realCase.desiredResultAchieved!,
      earliestSufficientStage: realCase.actualOutcome.earliestSufficientStage!,
      missingInformationThatMattered: [...realCase.relevantUnknowns],
      usefulEvidenceIds: [...realCase.usefulSignals],
      misleadingEvidenceIds: [...realCase.misleadingSignals],
      usefulSourceIds,
      misleadingSourceIds,
      notes: [...realCase.outcomeNotes],
    },
  };
}
