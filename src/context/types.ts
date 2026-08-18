import type { AnalysisSnapshot, Conclusion, DecisionConclusionAction, Evidence, Score } from "../domain.js";

export type InterpretationStatus = "NONE" | "USER_DEFINED" | "SYSTEM_DEFINED_WITH_RULE" | "SOURCE_DEFINED";
export type MeasurementValue = string | number | boolean;

export interface MeasurementRange {
  minimum: number;
  maximum: number;
}

export interface MeasurementStatement {
  id: string;
  metricName: string;
  value: MeasurementValue;
  unit: string;
  range?: MeasurementRange;
  confidence?: Score;
  sourceReferences: readonly string[];
  timestamp?: string;
  interpretation?: string;
  interpretationStatus: InterpretationStatus;
  interpretationDefinition?: string;
  interpretationRuleId?: string;
  uncertaintyStatement?: string;
  domain?: string;
  notes: readonly string[];
}

export type UserContextType = "SKILL" | "ACCESS" | "COST_ADVANTAGE" | "NETWORK" | "KNOWLEDGE" | "PREFERENCE" | "RISK_TOLERANCE" | "LIQUIDITY_REQUIREMENT" | "TIME_ADVANTAGE" | "OWNED_RESOURCE" | "PERSONAL_UTILITY" | "OTHER";
export type UserContextSourceOrigin = "USER_STATED" | "USER_DOCUMENTED" | "VERIFIED_EXTERNAL" | "INFERRED";
export type UserContextVerificationStatus = "UNVERIFIED" | "USER_CONFIRMED" | "DOCUMENTED" | "EXTERNALLY_VERIFIED";
export type ContextualChange = "CONCLUSION" | "MAIN_RISK" | "NEXT_ACTION" | "CONDITION" | "PRACTICAL_INTERPRETATION";

export interface ContextualImpact {
  materiallyChangesAssessment: boolean;
  changes: readonly ContextualChange[];
  assessment: string;
  contextualAction?: DecisionConclusionAction;
  nextAction?: string;
  condition?: string;
}

export interface UserContextFactor {
  id: string;
  description: string;
  contextType: UserContextType;
  objectiveLink: string;
  affectedConstraint: string;
  sourceOrigin: UserContextSourceOrigin;
  verificationStatus: UserContextVerificationStatus;
  potentialDecisionImpact: string;
  contextualImpact: ContextualImpact;
  sourceReferences: readonly string[];
  notes: readonly string[];
}

export interface LocalAdvantage extends UserContextFactor {
  advantageMechanism: string;
}

export interface UserContext {
  id: string;
  decisionCaseId: string;
  factors: readonly UserContextFactor[];
  localAdvantages: readonly LocalAdvantage[];
  notes: readonly string[];
}

export interface BaseAssessment {
  conclusion: Conclusion;
  snapshot: AnalysisSnapshot;
  evidence: readonly Evidence[];
}

export interface ContextualConclusion {
  action: DecisionConclusionAction;
  statement: string;
  confidence: Score;
  confidenceNote: string;
  mainRisk: string;
  nextAction?: string;
  conditions: readonly string[];
  appliedContextFactorIds: readonly string[];
}

export interface ContextualDifference {
  factorId: string;
  changes: readonly ContextualChange[];
  explanation: string;
}

export interface ContextualReassessment {
  userContext: UserContext;
  baseAssessment: BaseAssessment;
  contextualAssessment: ContextualConclusion;
  differences: readonly ContextualDifference[];
  evidenceUnchanged: true;
  historicalSnapshotUnchanged: true;
}

export interface ContextualOutput {
  measurements: readonly MeasurementStatement[];
  reassessment: ContextualReassessment;
}
