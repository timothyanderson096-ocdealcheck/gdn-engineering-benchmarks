import type { Conclusion, Evidence, Score } from "../domain.js";
import type { OutcomeDimension } from "../exploration/types.js";

export type StartingEvidenceOrigin = "USER_INPUT" | "APP_OUTPUT" | "DOCUMENT" | "LISTING" | "SCREENSHOT" | "MARKET_DATA" | "CONTRACT" | "FILING" | "SENSOR" | "API" | "MANUAL_OBSERVATION" | "OTHER";
export type EvidenceCharacter = "MEASURED" | "CLAIMED" | "OBSERVED" | "INFERRED" | "EXTERNALLY_VERIFIED";

export interface StartingEvidenceItem {
  id: string;
  originType: StartingEvidenceOrigin;
  description: string;
  sourceReference: string;
  acquisitionTime: string;
  confidence?: Score;
  provenance: string;
  evidenceCharacter: EvidenceCharacter;
  notes: readonly string[];
}

export interface StartingEvidenceField {
  id: string;
  decisionCaseId: string;
  items: readonly StartingEvidenceItem[];
  createdAt: string;
  notes: readonly string[];
}

export type ExpansionPurpose = "VERIFY" | "CHALLENGE" | "EXPLAIN" | "FIND_HIDDEN_RISK" | "FIND_HIDDEN_OPPORTUNITY" | "RESOLVE_UNKNOWN" | "COMPARE_ALTERNATIVE" | "CHECK_TIMING" | "CHECK_INCENTIVES" | "CHECK_CONSTRAINT" | "CHECK_EXTERNAL_DEPENDENCY" | "OTHER";
export type ExpansionProbeStatus = "PROPOSED" | "PRIORITIZED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED" | "DEFERRED";

export interface ExpansionProbe {
  id: string;
  question: string;
  purpose: ExpansionPurpose;
  objectiveLink: string;
  triggeredByEvidenceIds: readonly string[];
  triggeredByUnknownIds: readonly string[];
  targetGapIds: readonly string[];
  rangeCardArcIds: readonly string[];
  expectedDecisionImpact: string;
  expectedInformationValue: Score;
  outcomeDimensions: readonly OutcomeDimension[];
  couldMateriallyChangeOutcome: boolean;
  searchScope: string;
  status: ExpansionProbeStatus;
  resultEvidenceIds: readonly string[];
  notes: readonly string[];
}

export type EvidenceGapStatus = "BLOCKING" | "MATERIAL" | "NON_BLOCKING" | "OPTIONAL";
export interface EvidenceGap {
  id: string;
  missingInformation: string;
  whyItMatters: string;
  affectedConclusionOrHypothesisIds: readonly string[];
  resolvingEvidence: string;
  status: EvidenceGapStatus;
  expectedInformationValue: Score;
  rangeCardArcIds: readonly string[];
  notes: readonly string[];
}

export type PlanRole = "HIGHEST_VALUE" | "NEXT_USEFUL" | "LATERAL" | "OPTIONAL";
export interface PlannedProbe {
  rank: number;
  role: PlanRole;
  probe: ExpansionProbe;
  linkedGapIds: readonly string[];
  priorityBasis: string;
}

export interface ExpansionPlan {
  prioritized: readonly PlannedProbe[];
  rejected: readonly ExpansionProbe[];
  deferred: readonly ExpansionProbe[];
  stoppingRule: string;
}

export interface AcquiredEvidence {
  evidence: Evidence;
  producedByProbeId: string;
  acquiredAt: string;
}

export interface RejectedEvidence {
  id: string;
  description: string;
  provenance: string;
  rejectionReason: string;
  originatingProbeId?: string;
}

export interface ExpansionChronologyEvent {
  timestamp: string;
  eventType: "STARTING_EVIDENCE_RECORDED" | "PROBE_PLANNED" | "EVIDENCE_ACQUIRED" | "EVIDENCE_REJECTED" | "REASSESSMENT_COMPLETED";
  referenceIds: readonly string[];
  notes: readonly string[];
}

export interface ExpansionReassessment {
  id: string;
  timestamp: string;
  previousConclusion: Conclusion;
  previousConfidence: Score;
  newEvidenceIds: readonly string[];
  newConclusion: Conclusion;
  newConfidence: Score;
  changed: readonly string[];
  unchanged: readonly string[];
  remainingImportantGaps: readonly EvidenceGap[];
  previousSnapshotId: string;
  newSnapshotId: string;
}

export interface ExpandedEvidenceField {
  startingEvidence: StartingEvidenceField;
  newlyAcquiredEvidence: readonly AcquiredEvidence[];
  unresolvedGaps: readonly EvidenceGap[];
  rejectedEvidence: readonly RejectedEvidence[];
  contradictoryEvidenceIds: readonly string[];
  chronology: readonly ExpansionChronologyEvent[];
  reassessmentHistory: readonly ExpansionReassessment[];
}

export interface ExpansionResult {
  plan: ExpansionPlan;
  field: ExpandedEvidenceField;
  currentConclusion: Conclusion;
}
