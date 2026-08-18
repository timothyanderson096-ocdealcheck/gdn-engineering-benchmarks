import type { ConditionalDecisionCase, DecisionCase } from "../domain.js";
import { buildAuditData } from "../presentation/present.js";
import { presentConditionalDecision } from "../presentation/conditional.js";
import type { PresentationContext, PresentationPreference } from "../presentation/types.js";
import { serializePresentationResult } from "./serialize.js";
import type { PresentationContract } from "./types.js";

export function serializeConditionalDecisionPresentation(decisionCase: ConditionalDecisionCase, preference: PresentationPreference, context: PresentationContext = {}): PresentationContract {
  const result = presentConditionalDecision(decisionCase, preference, context);
  const audit = result.view.mode === "BALANCED" ? buildAuditData(decisionCase as DecisionCase, context) : undefined;
  return serializePresentationResult(result, audit);
}
