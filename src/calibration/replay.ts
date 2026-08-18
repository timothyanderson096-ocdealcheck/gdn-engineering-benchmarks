import { createDecisionCase } from "../case.js";
import { analyze } from "../engine.js";
import type { ConclusionAction, DecisionCase, Evidence, Unknown } from "../domain.js";
import type { CaseReplayResult, ResolvedCase, StageReplayResult, StoppingAssessment } from "./types.js";

const clone = <T>(value: T): T => structuredClone(value);
const committingActions = new Set<ConclusionAction>(["ACT", "ABORT", "CHANGE_PATH"]);

function applyResolvedUnknowns(unknowns: readonly Unknown[], resolvedIds: readonly string[]): Unknown[] {
  const resolved = new Set(resolvedIds);
  return unknowns.map((unknown) => resolved.has(unknown.id) ? { ...unknown, status: "resolved" } : clone(unknown));
}

function stoppingAssessment(firstCommitmentStage: number | undefined, sufficientStage: number): {
  assessment: StoppingAssessment;
  score: number;
} {
  if (firstCommitmentStage === undefined || firstCommitmentStage > sufficientStage) return { assessment: "longer_than_necessary", score: 0.5 };
  if (firstCommitmentStage < sufficientStage) return { assessment: "too_early", score: 0 };
  return { assessment: "approximately_correct", score: 1 };
}

function materiallyChangedAfter(stages: readonly StageReplayResult[], stoppingStage: number | undefined): boolean {
  if (stoppingStage === undefined) return false;
  const stopped = stages[stoppingStage - 1];
  if (!stopped) return false;
  return stages.slice(stoppingStage).some((stage) =>
    stage.snapshot.leadingHypothesisId !== stopped.snapshot.leadingHypothesisId || stage.conclusion.action !== stopped.conclusion.action,
  );
}

function ranksBeforeResolution(resolvedCase: ResolvedCase, stages: readonly StageReplayResult[]): Readonly<Record<string, number | null>> {
  return Object.fromEntries(resolvedCase.outcome.missingInformationThatMattered.map((unknownId) => {
    const resolutionIndex = resolvedCase.stages.findIndex((stage) => stage.resolvedUnknownIds?.includes(unknownId));
    const rankingStageIndex = resolutionIndex <= 0 ? 0 : resolutionIndex - 1;
    const ranking = stages[rankingStageIndex]?.snapshot.highestValueUnknowns ?? [];
    const rank = ranking.findIndex((unknown) => unknown.id === unknownId);
    return [unknownId, rank < 0 ? null : rank + 1];
  }));
}

export function replayResolvedCase(input: ResolvedCase): CaseReplayResult {
  const resolvedCase = clone(input);
  let decisionCase: DecisionCase = createDecisionCase({
    id: resolvedCase.id,
    question: resolvedCase.question,
    desiredResult: resolvedCase.desiredResult,
    timeframe: resolvedCase.timeframe,
    stakes: resolvedCase.stakes,
    reversibility: resolvedCase.reversibility,
    sources: resolvedCase.sources,
    evidence: [],
    hunches: [],
    hypotheses: resolvedCase.hypotheses,
    connections: [],
    unknowns: resolvedCase.unknowns,
    predictions: [],
  });
  const stages: StageReplayResult[] = [];
  const requestedUnknowns: string[] = [];

  for (const [index, stage] of resolvedCase.stages.entries()) {
    const existingIds = new Set(decisionCase.evidence.map((evidence) => evidence.id));
    const addedEvidence: Evidence[] = stage.evidence.filter((evidence) => !existingIds.has(evidence.id));
    const resolvedUnknownIds = stage.resolvedUnknownIds ?? [];
    requestedUnknowns.push(...resolvedUnknownIds);
    const result = analyze({
      ...decisionCase,
      evidence: [...decisionCase.evidence, ...clone(addedEvidence)],
      unknowns: applyResolvedUnknowns(decisionCase.unknowns, resolvedUnknownIds),
    }, { now: new Date(stage.timestamp) });
    decisionCase = result.decisionCase;
    const conclusionUtilityMeasurable = committingActions.has(result.conclusion.action);
    stages.push({
      stageId: stage.id,
      stageNumber: index + 1,
      timestamp: stage.timestamp,
      addedEvidenceIds: addedEvidence.map((evidence) => evidence.id),
      snapshot: clone(result.snapshot),
      conclusion: clone(result.conclusion),
      leadingHypothesisCorrect: result.snapshot.leadingHypothesisId === resolvedCase.outcome.correctHypothesisId,
      conclusionUtilityMeasurable,
      conclusionUseful: conclusionUtilityMeasurable && resolvedCase.outcome.successfulActions.includes(result.conclusion.action),
    });
  }

  const firstCommitment = stages.find((stage) => committingActions.has(stage.conclusion.action));
  const stop = stoppingAssessment(firstCommitment?.stageNumber, resolvedCase.outcome.earliestSufficientStage);
  const matteredUnknownRanks = ranksBeforeResolution(resolvedCase, stages);
  const matteredIds = new Set(resolvedCase.outcome.missingInformationThatMattered);
  const wastedInformationRequests = [...new Set(requestedUnknowns.filter((id) => !matteredIds.has(id)))];
  const ranks = Object.values(matteredUnknownRanks).filter((rank): rank is number => rank !== null);

  return {
    caseId: resolvedCase.id,
    question: resolvedCase.question,
    stages,
    finalDecisionCase: clone(decisionCase),
    stoppingAssessment: stop.assessment,
    stoppingScore: stop.score,
    ...(firstCommitment ? { firstCommitmentStage: firstCommitment.stageNumber } : {}),
    additionalEvidenceMateriallyChangedConclusion: materiallyChangedAfter(stages, firstCommitment?.stageNumber),
    ...(ranks.length > 0 ? { topRankedUnknownWasRelevant: ranks.some((rank) => rank === 1) } : {}),
    matteredUnknownRanks,
    wastedInformationRequests,
  };
}
