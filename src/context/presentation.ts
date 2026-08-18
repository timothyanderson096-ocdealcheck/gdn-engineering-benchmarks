import { renderMeasurement } from "./measurement.js";
import type { ContextualOutput, MeasurementStatement, UserContextFactor } from "./types.js";

export type ContextPresentationMode = "CONDENSED" | "BALANCED" | "AUDIT";
export interface CondensedContextView { mode: "CONDENSED"; keyMeasurements: readonly string[]; materialContext?: { factorIds: readonly string[]; summary: string }; }
export interface BalancedContextView { mode: "BALANCED"; keyMeasurements: readonly MeasurementStatement[]; importantUserContext: readonly UserContextFactor[]; practicalInterpretation: string; differences: ContextualOutput["reassessment"]["differences"]; }
export interface AuditContextView { mode: "AUDIT"; rawMeasurements: readonly MeasurementStatement[]; allContextFactors: readonly UserContextFactor[]; baseAssessment: ContextualOutput["reassessment"]["baseAssessment"]; contextualAssessment: ContextualOutput["reassessment"]["contextualAssessment"]; differences: ContextualOutput["reassessment"]["differences"]; }
export type ContextPresentation = CondensedContextView | BalancedContextView | AuditContextView;

export function presentContextualOutput(input: ContextualOutput, mode: ContextPresentationMode): ContextPresentation {
  const output = structuredClone(input);
  const reassessment = output.reassessment;
  const factors = [...reassessment.userContext.factors, ...reassessment.userContext.localAdvantages];
  const material = factors.filter((factor) => factor.contextualImpact.materiallyChangesAssessment);
  if (mode === "AUDIT") return { mode, rawMeasurements: output.measurements, allContextFactors: factors, baseAssessment: reassessment.baseAssessment, contextualAssessment: reassessment.contextualAssessment, differences: reassessment.differences };
  if (mode === "BALANCED") return { mode, keyMeasurements: output.measurements, importantUserContext: material, practicalInterpretation: reassessment.contextualAssessment.statement, differences: reassessment.differences };
  return {
    mode,
    keyMeasurements: output.measurements.map(renderMeasurement),
    ...(material.length ? { materialContext: { factorIds: material.map((factor) => factor.id), summary: material.map((factor) => factor.contextualImpact.assessment).join(" ") } } : {}),
  };
}
