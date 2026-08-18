export type ArcPosition = "MAIN_ARC" | "LEFT_ARC" | "RIGHT_ARC" | "INTERLOCKING_ARC";
export type ArcType = "STATED_PATH" | "ALTERNATIVE_PATH" | "HIDDEN_FACTOR" | "RISK_FACTOR" | "INCENTIVE_FACTOR" | "CONSTRAINT_FACTOR" | "TIMING_FACTOR" | "OPPORTUNITY_FACTOR" | "OTHER";
export type ExplorationPurpose = "STATED_PATH" | "ALTERNATIVE_PATH_EXPLORATION" | "HIDDEN_FACTOR_EXPLORATION";
export type ArcOrigin = "USER_SUPPLIED" | "SYSTEM_PROPOSED";
export type ArcStatus = "PROPOSED" | "INVESTIGATING" | "EVIDENCE_SUPPORTED" | "DISMISSED";
export type OutcomeDimension = "PROBABILITY" | "VALUE" | "TIMING" | "CONDITIONS" | "AVAILABILITY";
export type DecisionImpactDirection = "IMPROVE" | "WEAKEN" | "REDIRECT" | "MIXED";
export type CondensedChange = "CONCLUSION" | "MAIN_RISK" | "NEXT_ACTION" | "CONDITION";
export type ArcRelationshipType = "SUPPORTS" | "CONTRADICTS" | "DEPENDS_ON" | "SHARES_EVIDENCE" | "COMPETES_WITH" | "AMPLIFIES_RISK" | "REDUCES_RISK" | "OPENS_PATHWAY";

export interface OutcomeChangingFactor {
  couldMateriallyChangeOutcome: boolean;
  dimensions: readonly OutcomeDimension[];
  rationale: string;
}

export interface PotentialDecisionImpact {
  direction: DecisionImpactDirection;
  description: string;
}

export interface CondensedDisclosure {
  changes: readonly CondensedChange[];
  summary: string;
}

export interface ExplorationArc {
  id: string;
  arcPosition: ArcPosition;
  arcType: ArcType;
  purpose: ExplorationPurpose;
  origin: ArcOrigin;
  title: string;
  description: string;
  objectiveLink: string;
  affectedObjectiveParts: readonly string[];
  challengedAssumption: string;
  relevantConstraints: readonly string[];
  evidenceNeeded: readonly string[];
  potentialDecisionImpact: PotentialDecisionImpact;
  outcomeChangingFactor: OutcomeChangingFactor;
  sourceReferences: readonly string[];
  evidenceReferences: readonly string[];
  status: ArcStatus;
  notes: readonly string[];
  condensedDisclosure?: CondensedDisclosure;
}

export interface ArcRelationship {
  id: string;
  relationshipType: ArcRelationshipType;
  arcIds: readonly string[];
  rationale: string;
  evidenceReferences: readonly string[];
}

export interface RangeCard {
  id: string;
  decisionCaseId?: string;
  originalQuestion: string;
  desiredResult: string;
  mainArc: ExplorationArc;
  leftArc: ExplorationArc;
  rightArc: ExplorationArc;
  interlockingArcs: readonly ExplorationArc[];
  relationships: readonly ArcRelationship[];
  hunches: readonly string[];
  notes: readonly string[];
}

export interface RejectedArcCandidate {
  candidate: ExplorationArc;
  reasons: readonly string[];
}

export interface RangeCardResult {
  rangeCard: RangeCard;
  acceptedArcIds: readonly string[];
  rejectedCandidates: readonly RejectedArcCandidate[];
}

export interface ValidationResult {
  valid: boolean;
  errors: readonly string[];
}
