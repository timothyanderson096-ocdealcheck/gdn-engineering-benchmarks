import type { ConditionalDecisionCase, DecisionCase, DecisionCondition } from "../domain.js";
import { presentDecision } from "./present.js";
import type { ConclusionSummary, PresentationContext, PresentationPreference, PresentationResult } from "./types.js";

export interface ConditionalConclusionSummary extends ConclusionSummary { conditions?: readonly DecisionCondition[]; }
export type ConditionalPresentationResult = PresentationResult & { view: PresentationResult["view"] & { conclusion: ConditionalConclusionSummary } };

/** Preserves the existing mode-selection logic and only enriches its view. */
export function presentConditionalDecision(decisionCase: ConditionalDecisionCase, preference: PresentationPreference = "AUTO", context: PresentationContext = {}): ConditionalPresentationResult {
  const result = structuredClone(presentDecision(decisionCase as DecisionCase, preference, context));
  const conditions = decisionCase.latestConclusion?.action === "ACT_WITH_CONDITIONS" ? decisionCase.latestConclusion.conditions : undefined;
  if (conditions?.length && result.view.mode !== "AUDIT") (result.view.conclusion as ConditionalConclusionSummary).conditions = structuredClone(conditions);
  return result as ConditionalPresentationResult;
}
