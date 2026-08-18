export const PRESENTATION_SCHEMA_VERSION = "decision-dome.presentation.v1" as const;

export type PresentationSchemaVersion = typeof PRESENTATION_SCHEMA_VERSION;
export type ContractMode = "CONDENSED" | "BALANCED" | "AUDIT";
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject { [key: string]: JsonValue }

export interface ContractConclusion extends JsonObject {
  action: string;
  statement: string;
}

export interface ContractExpansion extends JsonObject {
  id: string;
  label: string;
  targetMode: ContractMode;
}

export interface CondensedContract extends JsonObject {
  schemaVersion: PresentationSchemaVersion;
  mode: "CONDENSED";
  conclusion: ContractConclusion;
  confidence: number;
  mainReason: string;
  mainRiskOrUncertainty: string;
  nextActionOrTrigger: string;
  availableExpansions: ContractExpansion[];
}

export interface BalancedEvidenceDriver extends JsonObject {
  id: string;
  statement: string;
  sourceId: string;
  provenance: string;
}

export interface BalancedUnknown extends JsonObject {
  id: string;
  question: string;
  status: string;
  informationValueScore: number;
}

export interface BalancedHypothesis extends JsonObject {
  id: string;
  statement: string;
  kind: string;
  weight: number;
  leading: boolean;
}

export interface BalancedContradiction extends JsonObject {
  evidenceId: string;
  statement: string;
  sourceId: string;
}

export interface BalancedContract extends JsonObject {
  schemaVersion: PresentationSchemaVersion;
  mode: "BALANCED";
  conclusion: ContractConclusion;
  confidence: number;
  strongestEvidenceDrivers: BalancedEvidenceDriver[];
  highValueUnknowns: BalancedUnknown[];
  hypotheses: BalancedHypothesis[];
  contradictions: BalancedContradiction[];
  reassessment: JsonObject & {
    majorUncertainty: string;
    nextActionOrTrigger: string;
    triggers: JsonValue[];
  };
  availableExpansions: ContractExpansion[];
}

export interface AuditContract extends JsonObject {
  schemaVersion: PresentationSchemaVersion;
  mode: "AUDIT";
  availableExpansions: ContractExpansion[];
  question: string;
  desiredResult: string;
  timeframe: JsonObject;
  stakes: string;
  reversibility: string;
  conclusion: JsonObject;
  evidence: JsonValue[];
  sources: JsonValue[];
  sourceObservations: JsonValue[];
  hypotheses: JsonValue[];
  hypothesisWeights: JsonObject;
  wildcardHypotheses: JsonValue[];
  contradictions: JsonValue[];
  hunches: JsonValue[];
  unknowns: JsonValue[];
  predictionLedger: JsonValue[];
  analysisSnapshots: JsonValue[];
  confidenceHistory: JsonValue[];
  conclusionHistory: JsonValue[];
  outcomes: JsonValue[];
  learningNotes: JsonValue[];
  availabilityNotes: JsonValue[];
}

export type PresentationContract = CondensedContract | BalancedContract | AuditContract;

export interface ValidationResult {
  valid: boolean;
  errors: readonly string[];
}
