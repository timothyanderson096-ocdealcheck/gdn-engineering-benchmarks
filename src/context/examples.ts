import { createDecisionCase } from "../case.js";
import type { AnalysisResult, DecisionCase, Evidence, Hypothesis } from "../domain.js";
import { analyze } from "../engine.js";
import { createMeasurementStatement } from "./measurement.js";
import { applyUserContext } from "./reassess.js";
import type { ContextualOutput, LocalAdvantage, MeasurementStatement, UserContext, UserContextFactor } from "./types.js";

const now = new Date("2026-08-13T00:00:00.000Z");

function exampleAnalysis(id: string): AnalysisResult {
  const hypotheses: Hypothesis[] = [
    { id: "proceed", statement: "the option is practically worthwhile", kind: "mainstream", priorWeight: 0.55, currentWeight: 0.55, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "ACT" },
    { id: "avoid", statement: "the downside makes the option unattractive", kind: "alternative", priorWeight: 0.35, currentWeight: 0.35, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "ABORT" },
    { id: "wildcard", statement: "an unobserved factor changes the result", kind: "wildcard", priorWeight: 0.1, currentWeight: 0.1, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "WAIT" },
  ];
  const evidence: Evidence[] = [{ id: "measured-exposure", statement: "A measured cost exposure remains unresolved.", sourceId: "record", provenance: "Example record", timestamp: now.toISOString(), type: "record", relevance: 0.9, reliability: 0.9, directness: 0.9, freshness: 0.9, independence: 0.9, supports: ["avoid"], contradicts: [] }];
  const decisionCase: DecisionCase = createDecisionCase({ id, question: "Is this option practical?", desiredResult: "Choose an option with acceptable personal downside.", timeframe: { label: "Soon", urgency: "near_term" }, stakes: "medium", reversibility: "moderate", sources: [], evidence, hunches: [], hypotheses, connections: [], unknowns: [], predictions: [] });
  return analyze(decisionCase, { now });
}

export function vehicleContextExample(): ContextualOutput {
  const base = exampleAnalysis("vehicle-context-example");
  const measurements: MeasurementStatement[] = [createMeasurementStatement({ id: "repair-range", metricName: "Documented repair exposure", value: 3500, unit: "AUD", range: { minimum: 2500, maximum: 5000 }, confidence: 0.7, sourceReferences: ["specialist-estimate"], interpretationStatus: "NONE", notes: ["Range remains uncertain until inspection."] })];
  const advantage: LocalAdvantage = { id: "self-repair", description: "User reports being able to perform the gearbox rebuild personally.", contextType: "SKILL", objectiveLink: "Personal repair cost and downside", affectedConstraint: "Labour cost", sourceOrigin: "USER_STATED", verificationStatus: "USER_CONFIRMED", potentialDecisionImpact: "May reduce personal cost without changing the external repair exposure.", contextualImpact: { materiallyChangesAssessment: true, changes: ["MAIN_RISK", "CONDITION", "PRACTICAL_INTERPRETATION"], assessment: "The user's reported repair capability may reduce personal downside if the capability and required parts access are confirmed.", condition: "Verify required tools, parts access, and repair scope before commitment." }, sourceReferences: [], notes: ["No magnitude of cost reduction is inferred."], advantageMechanism: "Substitution of user labour for paid specialist labour." };
  const context: UserContext = { id: "vehicle-user-context", decisionCaseId: base.decisionCase.id, factors: [], localAdvantages: [advantage], notes: [] };
  return { measurements, reassessment: applyUserContext(base, context) };
}

export function businessContextExample(): ContextualOutput {
  const base = exampleAnalysis("business-context-example");
  const measurements = [createMeasurementStatement({ id: "supplier-lead-time", metricName: "Quoted supplier lead time", value: 42, unit: "days", sourceReferences: ["supplier-quote"], timestamp: now.toISOString(), interpretationStatus: "NONE", notes: [] })];
  const factor: UserContextFactor = { id: "existing-supplier", description: "User reports an existing relationship with the supplier.", contextType: "NETWORK", objectiveLink: "Availability and execution timing", affectedConstraint: "Supplier onboarding and communication", sourceOrigin: "USER_STATED", verificationStatus: "USER_CONFIRMED", potentialDecisionImpact: "May reduce coordination friction but does not change the quoted lead time without evidence.", contextualImpact: { materiallyChangesAssessment: true, changes: ["NEXT_ACTION", "PRACTICAL_INTERPRETATION"], assessment: "The existing supplier relationship may improve coordination, while the recorded 42-day lead time remains unchanged.", nextAction: "Confirm whether the existing relationship changes allocation or delivery timing." }, sourceReferences: [], notes: [] };
  const context: UserContext = { id: "business-user-context", decisionCaseId: base.decisionCase.id, factors: [factor], localAdvantages: [], notes: [] };
  return { measurements, reassessment: applyUserContext(base, context) };
}
