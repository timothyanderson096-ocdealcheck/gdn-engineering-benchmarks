import type { ConclusionAction, DecisionCondition } from "../domain.js";
import { defaultConditionalCommitmentPolicy, type ConditionalCommitmentPolicy } from "../conditional-commitment.js";
import type { CaseReplayResult } from "./types.js";

export interface ConditionalCommitmentStageCandidate { stageId: string; confidence: number; baseAction: ConclusionAction; unresolvedUnknownId: string; conditions: readonly DecisionCondition[]; }
export interface ConditionalCommitmentCalibrationObservation { caseId: string; principle: "Do not confuse unresolved uncertainty with unacceptable uncertainty."; policy: ConditionalCommitmentPolicy; candidateStages: readonly ConditionalCommitmentStageCandidate[]; observation: string; }

export function observeConditionalCommitmentCandidates(replayInput: CaseReplayResult, conditionsByStage: Readonly<Record<string, readonly DecisionCondition[]>>, policy: ConditionalCommitmentPolicy = defaultConditionalCommitmentPolicy): ConditionalCommitmentCalibrationObservation {
  const replay = structuredClone(replayInput);
  const candidateStages = replay.stages.flatMap((stage) => {
    if (!policy.eligibleBaseActions.includes(stage.conclusion.action) || stage.conclusion.confidence < policy.minimumConfidence) return [];
    const unresolvedUnknown = stage.snapshot.highestValueUnknowns[0];
    if (!unresolvedUnknown) return [];
    const conditions = (conditionsByStage[stage.stageId] ?? []).filter((condition) => condition.status === "REQUIRED" && condition.addressesUnknownIds.includes(unresolvedUnknown.id));
    return conditions.length === 0 ? [] : [{ stageId: stage.stageId, confidence: stage.conclusion.confidence, baseAction: stage.conclusion.action, unresolvedUnknownId: unresolvedUnknown.id, conditions: structuredClone(conditions) }];
  });
  return { caseId: replay.caseId, principle: "Do not confuse unresolved uncertainty with unacceptable uncertainty.", policy: structuredClone(policy), candidateStages, observation: candidateStages.length ? "The unchanged replay met the configured confidence policy while explicit protections bounded the leading unresolved risk; this is a candidate conditional commitment." : "No stage met the configured candidate policy." };
}
