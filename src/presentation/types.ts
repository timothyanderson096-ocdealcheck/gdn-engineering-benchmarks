import type {
  AnalysisSnapshot,
  Conclusion,
  DecisionCase,
  Evidence,
  Hunch,
  Hypothesis,
  Lesson,
  Outcome,
  Prediction,
  RankedUnknown,
  SourceProfile,
  Stakes,
  Unknown,
} from "../domain.js";

export type PresentationMode = "CONDENSED" | "BALANCED" | "AUDIT";
export type PresentationPreference = "AUTO" | PresentationMode;

export interface PresentationThresholds {
  condensedMinimumConfidence: number;
  condensedMaximumUncertainty: number;
  auditBelowConfidence: number;
  auditAtUncertainty: number;
  highValueUnknownAt: number;
  majorContradictionCount: number;
  highStakesAuditBelowConfidence: number;
}

export interface HistoricalConclusion {
  timestamp: string;
  conclusion: Conclusion;
}

export interface HistoricalConfidence {
  timestamp: string;
  confidence: number;
}

export interface SourceObservation {
  sourceId: string;
  domain: string;
  observation: string;
}

export interface PresentationContext {
  thresholds?: Partial<PresentationThresholds>;
  conclusionHistory?: readonly HistoricalConclusion[];
  confidenceHistory?: readonly HistoricalConfidence[];
  sourceObservations?: readonly SourceObservation[];
}

export type ExpandableSectionId = "analysis" | "evidence" | "hypotheses" | "source_trail" | "history" | "full_audit";

export interface ExpandableSection {
  id: ExpandableSectionId;
  label: string;
  available: boolean;
  defaultExpanded: boolean;
  opensMode: PresentationMode;
}

export interface ConclusionSummary {
  action: Conclusion["action"];
  statement: string;
}

export interface CondensedView {
  mode: "CONDENSED";
  conclusion: ConclusionSummary;
  confidence: number;
  mainReason: string;
  mainRiskOrUncertainty: string;
  nextActionOrTrigger: string;
}

export interface EvidenceDriver {
  id: string;
  statement: string;
}

export interface HypothesisSummary {
  id: string;
  statement: string;
  kind: Hypothesis["kind"];
  weight: number;
  leading: boolean;
}

export interface BalancedView {
  mode: "BALANCED";
  conclusion: ConclusionSummary;
  confidence: number;
  strongestEvidenceAndDrivers: readonly EvidenceDriver[];
  majorUncertainty: string;
  highValueUnknowns: readonly RankedUnknown[];
  competingHypotheses: readonly HypothesisSummary[];
  nextActionOrTrigger: string;
}

export interface AuditData {
  question: string;
  desiredResult: string;
  timeframe: DecisionCase["timeframe"];
  stakes: Stakes;
  reversibility: DecisionCase["reversibility"];
  conclusion: Conclusion;
  evidence: readonly Evidence[];
  sources: readonly SourceProfile[];
  sourceObservations: readonly SourceObservation[];
  hypotheses: readonly Hypothesis[];
  hypothesisWeights: Readonly<Record<string, number>>;
  wildcardHypotheses: readonly Hypothesis[];
  contradictions: readonly Evidence[];
  hunches: readonly Hunch[];
  unknowns: readonly Unknown[];
  predictionLedger: readonly Prediction[];
  analysisSnapshots: readonly AnalysisSnapshot[];
  confidenceHistory: readonly HistoricalConfidence[];
  conclusionHistory: readonly HistoricalConclusion[];
  outcomes: readonly Outcome[];
  learningNotes: readonly Lesson[];
  availabilityNotes: readonly string[];
}

export interface AuditView extends AuditData {
  mode: "AUDIT";
}

export type PresentationView = CondensedView | BalancedView | AuditView;

export interface PresentationResult {
  requestedPreference: PresentationPreference;
  selectedMode: PresentationMode;
  autoSelectionReasons: readonly string[];
  expandableSections: readonly ExpandableSection[];
  view: PresentationView;
}
