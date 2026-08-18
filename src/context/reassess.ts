import type { AnalysisResult } from "../domain.js";
import type { ContextualConclusion, ContextualDifference, ContextualReassessment, UserContext, UserContextFactor } from "./types.js";

const clone = <T>(value: T): T => structuredClone(value);

function validateFactor(factor: UserContextFactor): void {
  if (!factor.id.trim() || !factor.description.trim() || !factor.objectiveLink.trim() || !factor.affectedConstraint.trim()) throw new TypeError("Context factors require id, description, objectiveLink, and affectedConstraint.");
  if (factor.sourceOrigin === "VERIFIED_EXTERNAL" && factor.verificationStatus !== "EXTERNALLY_VERIFIED") throw new TypeError("VERIFIED_EXTERNAL context must be EXTERNALLY_VERIFIED.");
  if (factor.verificationStatus === "EXTERNALLY_VERIFIED" && factor.sourceReferences.length === 0) throw new TypeError("Externally verified context requires a source reference.");
  if (factor.contextualImpact.materiallyChangesAssessment && (factor.contextualImpact.changes.length === 0 || !factor.contextualImpact.assessment.trim())) throw new TypeError("Material context requires explicit changes and an assessment.");
}

export function applyUserContext(baseInput: AnalysisResult, contextInput: UserContext): ContextualReassessment {
  const base = clone(baseInput);
  const userContext = clone(contextInput);
  if (userContext.decisionCaseId !== base.decisionCase.id) throw new TypeError("User context decisionCaseId does not match the analyzed case.");
  const factors = [...userContext.factors, ...userContext.localAdvantages];
  factors.forEach(validateFactor);
  if (new Set(factors.map((factor) => factor.id)).size !== factors.length) throw new TypeError("User-context factor ids must be unique.");
  const material = factors.filter((factor) => factor.contextualImpact.materiallyChangesAssessment);
  const actions = [...new Set(material.flatMap((factor) => factor.contextualImpact.contextualAction ? [factor.contextualImpact.contextualAction] : []))];
  if (actions.length > 1) throw new TypeError("Material context factors propose conflicting contextual actions.");
  const nextActions = material.flatMap((factor) => factor.contextualImpact.nextAction ? [factor.contextualImpact.nextAction] : []);
  const conditions = material.flatMap((factor) => factor.contextualImpact.condition ? [factor.contextualImpact.condition] : []);
  const differences: ContextualDifference[] = material.map((factor) => ({ factorId: factor.id, changes: [...factor.contextualImpact.changes], explanation: factor.contextualImpact.assessment }));
  const contextualAssessment: ContextualConclusion = {
    action: actions[0] ?? base.conclusion.action,
    statement: material.length
      ? `${base.conclusion.statement} Contextual application: ${material.map((factor) => factor.contextualImpact.assessment).join(" ")}`
      : base.conclusion.statement,
    confidence: base.conclusion.confidence,
    confidenceNote: "Confidence is copied from the base engine result and is not recalculated from user context.",
    mainRisk: base.conclusion.majorUncertainty,
    ...(nextActions[0] ? { nextAction: nextActions[0] } : {}),
    conditions,
    appliedContextFactorIds: material.map((factor) => factor.id),
  };
  return {
    userContext,
    baseAssessment: { conclusion: clone(base.conclusion), snapshot: clone(base.snapshot), evidence: clone(base.decisionCase.evidence) },
    contextualAssessment,
    differences,
    evidenceUnchanged: true,
    historicalSnapshotUnchanged: true,
  };
}
