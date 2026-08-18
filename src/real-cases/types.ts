import type { ConclusionAction, Hypothesis, Stakes, Timeframe, Unknown } from "../domain.js";
import type { CalibrationReport } from "../calibration/types.js";

export const REAL_CASE_SCHEMA_VERSION = "decision-dome.real-case.v1" as const;

export type RealCaseSchemaVersion = typeof REAL_CASE_SCHEMA_VERSION;
export type RealCaseRecordKind = "REAL_CASE" | "TEMPLATE";
export type ResolutionStatus = "RESOLVED" | "UNRESOLVED";
export type RealSourceType = "marketplace_listing" | "classified_listing" | "conversation" | "public_prediction" | "personal_decision" | "official_record" | "inspection" | "other";
export type EvidenceProvenanceType = "direct_observation" | "primary_record" | "secondary_source" | "seller_claim" | "user_observation" | "inference" | "other";
export type RealOutcomeStatus = "purchased" | "rejected" | "seller_declined" | "negotiated_successfully" | "mechanical_failure_discovered" | "price_moved" | "prediction_true" | "prediction_false" | "prediction_partial" | "no_longer_available" | "unresolved_insufficient" | "other";

export interface HistoricalTime {
  value: string;
  approximate: boolean;
}

export interface RealCaseSource {
  sourceId: string;
  sourceType: RealSourceType;
  sourceName: string;
  reference?: string;
  accessedAt: HistoricalTime;
  domain: string;
  provenance: string;
  roleInDecision: string;
  notes?: string;
}

export interface RealEvidence {
  evidenceId: string;
  statement: string;
  sourceId: string;
  acquiredAt: HistoricalTime;
  provenanceType: EvidenceProvenanceType;
  provenance: string;
  evidenceType: "observation" | "document" | "testimony" | "measurement" | "record" | "other";
  relevance: number;
  reliability: number;
  directness: number;
  freshness: number;
  independence: number;
  supports: readonly string[];
  contradicts: readonly string[];
  notes?: string;
}

export interface RealCaseStage {
  stageId: string;
  timestamp: HistoricalTime;
  newlyAvailableEvidence: readonly RealEvidence[];
  sourceReferences: readonly string[];
  newlyResolvedUnknowns: readonly string[];
  historicalConclusion?: {
    action: ConclusionAction;
    confidence: number;
    leadingHypothesisId: string;
  };
  notes?: readonly string[];
}

export interface PostOutcomeInformation {
  informationId: string;
  statement: string;
  sourceId: string;
  acquiredAt: HistoricalTime;
  provenanceType: EvidenceProvenanceType;
  provenance: string;
  notes?: string;
}

export interface RealActualOutcome {
  status: RealOutcomeStatus;
  description: string;
  correctHypothesisId?: string;
  successfulActions?: readonly ConclusionAction[];
  earliestSufficientStage?: number;
}

export interface RealResolvedCase {
  schemaVersion: RealCaseSchemaVersion;
  recordKind: "REAL_CASE";
  resolutionStatus: ResolutionStatus;
  caseId: string;
  title: string;
  domain: string;
  category: string;
  originalQuestion: string;
  desiredResult: string;
  timeframe: Timeframe;
  stakes: Stakes;
  reversibility: "easy" | "moderate" | "hard";
  caseSource: RealCaseSource;
  verificationSources: readonly RealCaseSource[];
  decisionStartTime: HistoricalTime;
  resolutionTime?: HistoricalTime;
  initialState: {
    hypotheses: readonly Hypothesis[];
    unknowns: readonly Unknown[];
  };
  chronologicalStages: readonly RealCaseStage[];
  actualOutcome: RealActualOutcome;
  desiredResultAchieved: boolean | null;
  outcomeNotes: readonly string[];
  usefulSignals: readonly string[];
  misleadingSignals: readonly string[];
  relevantUnknowns: readonly string[];
  postOutcomeInformation: readonly PostOutcomeInformation[];
  provenance: {
    authorStatement: string;
    archiveReferences: readonly string[];
  };
  metadata: {
    authoredAt: string;
    author: string;
    reviewStatus: "DRAFT" | "REVIEWED";
    reviewedAt?: string;
    reviewer?: string;
  };
}

export interface RealCaseValidationResult {
  valid: boolean;
  errors: readonly string[];
}

export interface RealCaseCalibrationReport {
  datasetKind: "genuine-real-cases";
  totalLoadedCases: number;
  resolvedCaseCount: number;
  unresolvedCasesExcluded: number;
  calibration: CalibrationReport;
}
