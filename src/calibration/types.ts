import type {
  AnalysisSnapshot,
  Conclusion,
  ConclusionAction,
  DecisionCase,
  Evidence,
  Hypothesis,
  Score,
  Unknown,
} from "../domain.js";

export interface RecordedStageConclusion {
  action: ConclusionAction;
  confidence: Score;
  leadingHypothesisId: string;
}

export interface ResolvedCaseStage {
  id: string;
  timestamp: string;
  evidence: readonly Evidence[];
  resolvedUnknownIds?: readonly string[];
  recordedConclusion?: RecordedStageConclusion;
}

export interface ResolvedOutcome {
  description: string;
  resolvedAt: string;
  correctHypothesisId: string;
  successfulActions: readonly ConclusionAction[];
  desiredResultAchieved: boolean;
  earliestSufficientStage: number;
  missingInformationThatMattered: readonly string[];
  usefulEvidenceIds: readonly string[];
  misleadingEvidenceIds: readonly string[];
  usefulSourceIds: readonly string[];
  misleadingSourceIds: readonly string[];
  notes?: readonly string[];
}

export interface ResolvedCase {
  id: string;
  question: string;
  desiredResult: string;
  timeframe: DecisionCase["timeframe"];
  stakes: DecisionCase["stakes"];
  reversibility: DecisionCase["reversibility"];
  sources: DecisionCase["sources"];
  hypotheses: readonly Hypothesis[];
  unknowns: readonly Unknown[];
  stages: readonly ResolvedCaseStage[];
  outcome: ResolvedOutcome;
}

export interface StageReplayResult {
  stageId: string;
  stageNumber: number;
  timestamp: string;
  addedEvidenceIds: readonly string[];
  snapshot: AnalysisSnapshot;
  conclusion: Conclusion;
  leadingHypothesisCorrect: boolean;
  conclusionUtilityMeasurable: boolean;
  conclusionUseful: boolean;
}

export type StoppingAssessment = "too_early" | "approximately_correct" | "longer_than_necessary";

export interface CaseReplayResult {
  caseId: string;
  question: string;
  stages: readonly StageReplayResult[];
  finalDecisionCase: DecisionCase;
  stoppingAssessment: StoppingAssessment;
  stoppingScore: Score;
  firstCommitmentStage?: number;
  additionalEvidenceMateriallyChangedConclusion: boolean;
  topRankedUnknownWasRelevant?: boolean;
  matteredUnknownRanks: Readonly<Record<string, number | null>>;
  wastedInformationRequests: readonly string[];
}

export interface CalibrationBucket {
  label: string;
  count: number;
  averageConfidence: number | null;
  observedAccuracy: number | null;
  brierScore: number | null;
}

export interface SourcePerformanceObservation {
  sourceId: string;
  domain: string;
  usefulEvidenceCount: number;
  misleadingEvidenceCount: number;
  casesObserved: number;
  observation: string;
}

export interface SignalObservation {
  signal: string;
  count: number;
}

export interface CalibrationReport {
  generatedAt: string;
  caseCount: number;
  stageCount: number;
  conclusionAccuracy: number | null;
  conclusionUtility: number | null;
  calibration: {
    brierScore: number | null;
    meanAbsoluteCalibrationError: number | null;
    buckets: readonly CalibrationBucket[];
  };
  stopping: {
    averageScore: number | null;
    tooEarly: number;
    approximatelyCorrect: number;
    longerThanNecessary: number;
    materiallyChangedAfterStopping: number;
  };
  informationValue: {
    relevantUnknownsEvaluated: number;
    meanReciprocalRank: number | null;
    topRankHitRate: number | null;
    lowerRankedUnknownsThatMatteredMore: number;
    wastedInformationRequests: number;
  };
  usefulSignals: readonly SignalObservation[];
  misleadingSignals: readonly SignalObservation[];
  sourcePerformance: readonly SourcePerformanceObservation[];
  unresolvedWeaknesses: readonly string[];
  cases: readonly CaseReplayResult[];
}
