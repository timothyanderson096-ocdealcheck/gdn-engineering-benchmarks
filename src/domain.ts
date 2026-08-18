export type Score = number;
export type Stakes = "low" | "medium" | "high";
export type Reversibility = "easy" | "moderate" | "hard";
export type HypothesisKind = "mainstream" | "alternative" | "wildcard";
export type HypothesisStatus = "active" | "favored" | "weakened" | "falsified";
export type UnknownStatus = "open" | "acquiring" | "resolved" | "unavailable";
export type ConclusionAction = "ACT" | "WAIT" | "ABORT" | "CHANGE_PATH" | "ACQUIRE_INFORMATION";
export type DecisionConclusionAction = ConclusionAction | "ACT_WITH_CONDITIONS";

export interface Timeframe { label: string; deadline?: string; urgency: "immediate" | "near_term" | "flexible"; }
export interface SourceProfile { id: string; name: string; domain: string; expertise: Score; historicalTrackRecord: Score; independence: Score; incentiveConflictRisk: Score; position: "mainstream" | "dissenting" | "unknown"; notes?: string; }
export interface Evidence { id: string; statement: string; sourceId: string; provenance: string; timestamp: string; type: "observation" | "document" | "testimony" | "measurement" | "record" | "other"; relevance: Score; reliability: Score; directness: Score; freshness: Score; independence: Score; supports: readonly string[]; contradicts: readonly string[]; }
export interface Hunch { id: string; statement: string; investigationPriority: Score; generatedHypothesis?: string; questionToInvestigate?: string; }
export interface Hypothesis { id: string; statement: string; kind: HypothesisKind; priorWeight: Score; currentWeight: Score; assumptions: readonly string[]; falsifiers: readonly string[]; predictions: readonly string[]; status: HypothesisStatus; actionOnLead: Exclude<ConclusionAction, "ACQUIRE_INFORMATION">; }
export interface Connection { id: string; fromId: string; toId: string; relationshipType: string; strength: Score; verified: boolean; rationale: string; }
export interface Unknown { id: string; question: string; expectedDecisionValue: Score; estimatedAcquisitionCost: Score; estimatedTimeCost: Score; status: UnknownStatus; }
export interface RankedUnknown extends Unknown { informationValueScore: Score; }
export interface Prediction { id: string; whoOrSource: string; exactPrediction: string; dateMade: string; timeframe: string; probability: Score; domain: string; resolutionCriteria: string; eventualOutcome?: string; }
export interface DecisionBudget { level: "minimal" | "focused" | "extended"; investigationAllowance: Score; rationale: readonly string[]; }
export interface AnalysisSnapshot { id: string; timestamp: string; hypothesisWeights: Readonly<Record<string, number>>; leadingHypothesisId: string; strongestEvidenceIds: readonly string[]; contradictions: readonly string[]; highestValueUnknowns: readonly RankedUnknown[]; uncertainty: Score; notes: readonly string[]; }

export interface DecisionCondition { id: string; statement: string; timing: "BEFORE_COMMITMENT" | "DURING_COMMITMENT"; status: "REQUIRED" | "SATISFIED" | "FAILED"; protectsAgainst: string; addressesUnknownIds: readonly string[]; sourceEvidenceIds: readonly string[]; }
export interface Conclusion { action: ConclusionAction; statement: string; confidence: Score; strongestBasis: readonly string[]; majorUncertainty: string; specificNextInformation?: string; reassessmentTriggers: readonly string[]; reviewAt?: string; }
export interface ConditionalConclusion extends Omit<Conclusion, "action"> { action: "ACT_WITH_CONDITIONS"; conditions: readonly DecisionCondition[]; }
export type DecisionConclusion = Conclusion | ConditionalConclusion;
export interface Outcome { recordedAt: string; result: string; conclusionId?: string; }
export type LessonCategory = "source_performance" | "useful_signal" | "misleading_signal" | "hypothesis_dismissed_early" | "unnecessary_research" | "missing_information" | "confidence_calibration" | "stopping_time";
export interface Lesson { id: string; recordedAt: string; category: LessonCategory; statement: string; }
export interface DecisionCase { id: string; question: string; desiredResult: string; timeframe: Timeframe; stakes: Stakes; reversibility: Reversibility; sources: readonly SourceProfile[]; evidence: readonly Evidence[]; hunches: readonly Hunch[]; hypotheses: readonly Hypothesis[]; connections: readonly Connection[]; unknowns: readonly Unknown[]; conditions?: readonly DecisionCondition[]; predictions: readonly Prediction[]; analysisHistory: readonly AnalysisSnapshot[]; latestConclusion?: Conclusion; outcomes: readonly Outcome[]; lessons: readonly Lesson[]; }
export interface ConditionalDecisionCase extends Omit<DecisionCase, "latestConclusion"> { latestConclusion?: DecisionConclusion; }
export interface AnalysisResult { decisionCase: DecisionCase; snapshot: AnalysisSnapshot; conclusion: Conclusion; budget: DecisionBudget; }
export interface ConditionalAnalysisResult extends Omit<AnalysisResult, "decisionCase" | "conclusion"> { decisionCase: ConditionalDecisionCase; conclusion: ConditionalConclusion; }
export interface AnalysisOptions { now?: Date; priorInvestigationYield?: Score; waitingCost?: Score; }
