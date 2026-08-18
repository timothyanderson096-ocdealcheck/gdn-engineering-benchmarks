import type { AnalysisOptions, AnalysisResult, ConditionalAnalysisResult, ConditionalConclusion, ConclusionAction, DecisionCase, DecisionCondition, RankedUnknown } from "./domain.js";
import { analyze } from "./engine.js";

const clone = <T>(value: T): T => structuredClone(value);
export interface ConditionalCommitmentPolicy { minimumConfidence: number; eligibleBaseActions: readonly ConclusionAction[]; }
export const defaultConditionalCommitmentPolicy: Readonly<ConditionalCommitmentPolicy> = Object.freeze({ minimumConfidence: 0.9, eligibleBaseActions: ["ACT", "ACQUIRE_INFORMATION"] as const });

function conditionForUnknown(condition: DecisionCondition, unknown: RankedUnknown | undefined): boolean { return condition.status === "REQUIRED" && unknown !== undefined && condition.addressesUnknownIds.includes(unknown.id); }
export function applicableCommitmentConditions(decisionCase: DecisionCase, highestValueUnknown: RankedUnknown | undefined): readonly DecisionCondition[] { return clone((decisionCase.conditions ?? []).filter((condition) => conditionForUnknown(condition, highestValueUnknown))); }

export function applyConditionalCommitment(resultInput: AnalysisResult, policy: ConditionalCommitmentPolicy = defaultConditionalCommitmentPolicy): AnalysisResult | ConditionalAnalysisResult {
  const result = clone(resultInput);
  const eligible = result.conclusion.action === "ACT" || (policy.eligibleBaseActions.includes(result.conclusion.action) && result.conclusion.confidence >= policy.minimumConfidence);
  if (!eligible) return result;
  const conditions = applicableCommitmentConditions(result.decisionCase, result.snapshot.highestValueUnknowns[0]);
  if (conditions.length === 0) return result;
  const conclusion: ConditionalConclusion = { ...result.conclusion, action: "ACT_WITH_CONDITIONS", statement: `${result.conclusion.statement} Proceed only if: ${conditions.map((condition) => condition.statement).join("; ")}`, conditions };
  return { ...result, conclusion: clone(conclusion), decisionCase: { ...result.decisionCase, latestConclusion: clone(conclusion) } };
}

/** Runs unchanged v0.1 analysis first, then decorates an eligible result. */
export function analyzeWithConditions(decisionCase: DecisionCase, options: AnalysisOptions = {}, policy: ConditionalCommitmentPolicy = defaultConditionalCommitmentPolicy): AnalysisResult | ConditionalAnalysisResult { return applyConditionalCommitment(analyze(decisionCase, options), policy); }
