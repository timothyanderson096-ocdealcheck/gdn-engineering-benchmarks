export type VerificationJudgement = "SUPPORTED" | "PARTIALLY_SUPPORTED" | "CONTRADICTED" | "INSUFFICIENT_EVIDENCE";
export type VerificationStakes = "low" | "medium" | "high";
export type VerificationAction = "CONTINUE" | "STOP" | "CONTINUE_OPTIONALLY";

export interface VerificationProbe {
  id: string;
  description: string;
  targetUncertainty: string;
  /** Heuristic estimate, not a calibrated probability. */
  verdictChangePotential: number;
  expectedImpactIfConfirmed: number;
  expectedImpactIfContradicted: number;
  uncertaintyReductionPotential: number;
  operationalRelevance: number;
  stakesRelevance: number;
  novelty: number;
  secondaryDiscoveryValue: number;
  estimatedCost: number;
  overlapTags: readonly string[];
  relatedDefectPatternIds: readonly string[];
}

export interface ProbeObservation {
  probeId: string;
  outcome: string;
  judgementAfter: VerificationJudgement;
  verdictChanged: boolean;
  confidenceMateriallyChanged: boolean;
  newDefectPatternIds: readonly string[];
  coveredTags: readonly string[];
  observedCost?: number;
}

export interface VerificationUncertainty {
  id: string;
  description: string;
  materiality: number;
  /** Heuristic estimate, not a calibrated probability. */
  verdictChangePotential: number;
  status: "OPEN" | "RESOLVED";
  probeIds: readonly string[];
}

export interface VerificationState {
  currentJudgement: VerificationJudgement;
  currentConfidence?: number;
  stakes: VerificationStakes;
  probeBudget: number;
  completedProbes: readonly ProbeObservation[];
  remainingProbes: readonly VerificationProbe[];
  unresolvedMaterialUncertainties: readonly VerificationUncertainty[];
}

export interface RankedVerificationProbe {
  rank: number;
  probe: VerificationProbe;
  value: number;
  primaryDecisionValue: number;
  secondaryDiscoveryValue: number;
  effectiveNovelty: number;
  redundancyFactor: number;
  relatedPatternBoost: number;
  explanation: string;
}

export interface VerificationMeasurement {
  probeBudget: number;
  probesUsed: number;
  verdictStabilityPoint: number | null;
  probesAfterStability: number;
  highestRemainingProbeValue: number;
  theoreticallySkippableProbes: number;
}

export interface VerificationAssessment {
  decisionReady: boolean;
  recommendedAction: VerificationAction;
  optionalFurtherInvestigation: boolean;
  reason: string;
  rankedRemainingProbes: readonly RankedVerificationProbe[];
  measurement: VerificationMeasurement;
}

const STAKES_WEIGHT: Readonly<Record<VerificationStakes, number>> = { low: 0, medium: 0.5, high: 1 };
const PRIMARY_CONTINUE_THRESHOLD: Readonly<Record<VerificationStakes, number>> = { low: 0.5, medium: 0.4, high: 0.3 };
const OPTIONAL_DISCOVERY_THRESHOLD: Readonly<Record<VerificationStakes, number>> = { low: 0.45, medium: 0.35, high: 0.25 };
const MATERIALITY_THRESHOLD: Readonly<Record<VerificationStakes, number>> = { low: 0.65, medium: 0.5, high: 0.35 };

function normalized(label: string, value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${label} must be between 0 and 1.`);
  return value;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function validateProbe(probe: VerificationProbe): void {
  if (!probe.id.trim()) throw new TypeError("Probe id must not be empty.");
  if (!probe.description.trim()) throw new TypeError(`Probe ${probe.id} description must not be empty.`);
  if (!probe.targetUncertainty.trim()) throw new TypeError(`Probe ${probe.id} targetUncertainty must not be empty.`);
  normalized(`Probe ${probe.id} verdictChangePotential`, probe.verdictChangePotential);
  normalized(`Probe ${probe.id} expectedImpactIfConfirmed`, probe.expectedImpactIfConfirmed);
  normalized(`Probe ${probe.id} expectedImpactIfContradicted`, probe.expectedImpactIfContradicted);
  normalized(`Probe ${probe.id} uncertaintyReductionPotential`, probe.uncertaintyReductionPotential);
  normalized(`Probe ${probe.id} operationalRelevance`, probe.operationalRelevance);
  normalized(`Probe ${probe.id} stakesRelevance`, probe.stakesRelevance);
  normalized(`Probe ${probe.id} novelty`, probe.novelty);
  normalized(`Probe ${probe.id} secondaryDiscoveryValue`, probe.secondaryDiscoveryValue);
  normalized(`Probe ${probe.id} estimatedCost`, probe.estimatedCost);
}

function validateState(state: VerificationState): void {
  if (!Number.isInteger(state.probeBudget) || state.probeBudget < 0) throw new RangeError("probeBudget must be a non-negative integer.");
  if (state.completedProbes.length > state.probeBudget) throw new RangeError("Completed probes cannot exceed probeBudget.");
  if (state.currentConfidence !== undefined) normalized("currentConfidence", state.currentConfidence);
  const completedIds = new Set<string>();
  for (const observation of state.completedProbes) {
    if (!observation.probeId.trim()) throw new TypeError("Observed probe id must not be empty.");
    if (completedIds.has(observation.probeId)) throw new TypeError(`Probe ${observation.probeId} was observed more than once.`);
    completedIds.add(observation.probeId);
    if (observation.observedCost !== undefined) normalized(`Probe ${observation.probeId} observedCost`, observation.observedCost);
  }
  const remainingIds = new Set<string>();
  for (const probe of state.remainingProbes) {
    validateProbe(probe);
    if (completedIds.has(probe.id)) throw new TypeError(`Completed probe ${probe.id} cannot remain a candidate.`);
    if (remainingIds.has(probe.id)) throw new TypeError(`Remaining probe ${probe.id} is duplicated.`);
    remainingIds.add(probe.id);
  }
  for (const uncertainty of state.unresolvedMaterialUncertainties) {
    normalized(`Uncertainty ${uncertainty.id} materiality`, uncertainty.materiality);
    normalized(`Uncertainty ${uncertainty.id} verdictChangePotential`, uncertainty.verdictChangePotential);
  }
}

function discoveredPatternIds(state: VerificationState): Set<string> {
  return new Set(state.completedProbes.flatMap((observation) => observation.newDefectPatternIds));
}

function completedOverlapCount(probe: VerificationProbe, state: VerificationState): number {
  if (probe.overlapTags.length === 0) return 0;
  const tags = new Set(probe.overlapTags);
  return state.completedProbes.filter((observation) => observation.coveredTags.some((tag) => tags.has(tag))).length;
}

export function rankVerificationProbes(state: VerificationState): readonly RankedVerificationProbe[] {
  validateState(state);
  const patterns = discoveredPatternIds(state);
  const stakesWeight = STAKES_WEIGHT[state.stakes];
  const ranked = state.remainingProbes.map((probe) => {
    const maxImpact = Math.max(probe.expectedImpactIfConfirmed, probe.expectedImpactIfContradicted);
    const repeatedCoverage = completedOverlapCount(probe, state);
    const redundancyFactor = 1 / (1 + (0.6 * repeatedCoverage));
    const effectiveNovelty = probe.novelty * redundancyFactor;
    const relatedPatternBoost = probe.relatedDefectPatternIds.some((id) => patterns.has(id)) ? 1.2 : 1;
    const relevanceFactor = 0.35 + (0.65 * probe.operationalRelevance);
    const stakesBoost = 1 + (0.25 * stakesWeight * probe.stakesRelevance);
    const costPenalty = 0.35 + (0.65 * probe.estimatedCost);

    const primaryBenefit =
      (0.4 * probe.verdictChangePotential)
      + (0.25 * Math.max(probe.expectedImpactIfConfirmed, probe.expectedImpactIfContradicted))
      + (0.15 * probe.uncertaintyReductionPotential)
      + (0.1 * probe.operationalRelevance)
      + (0.1 * probe.stakesRelevance);
    const primaryDecisionValue = clamp((primaryBenefit * relevanceFactor * stakesBoost * (0.55 + (0.45 * effectiveNovelty))) / costPenalty);
    const secondaryDiscoveryValue = clamp((probe.secondaryDiscoveryValue * relevanceFactor * relatedPatternBoost * (0.4 + (0.6 * effectiveNovelty))) / costPenalty);
    const value = Math.max(primaryDecisionValue, secondaryDiscoveryValue);
    return {
      rank: 0,
      probe,
      value: round(value),
      primaryDecisionValue: round(primaryDecisionValue),
      secondaryDiscoveryValue: round(secondaryDiscoveryValue),
      effectiveNovelty: round(effectiveNovelty),
      redundancyFactor: round(redundancyFactor),
      relatedPatternBoost,
      explanation: `Primary ${primaryDecisionValue.toFixed(3)}; secondary ${secondaryDiscoveryValue.toFixed(3)}; operational relevance ${probe.operationalRelevance.toFixed(2)}; effective novelty ${effectiveNovelty.toFixed(2)}; cost ${probe.estimatedCost.toFixed(2)}${repeatedCoverage ? `; ${repeatedCoverage} overlapping completed probe(s)` : ""}${relatedPatternBoost > 1 ? "; related new-defect follow-up boost applied" : ""}.`,
    };
  });
  ranked.sort((a, b) => b.value - a.value || b.primaryDecisionValue - a.primaryDecisionValue || a.probe.id.localeCompare(b.probe.id));
  return ranked.map((item, index) => ({ ...item, rank: index + 1 }));
}

function verdictStabilityPoint(state: VerificationState): number | null {
  if (state.completedProbes.length === 0 || state.currentJudgement === "INSUFFICIENT_EVIDENCE") return null;
  let point = state.completedProbes.length;
  for (let index = state.completedProbes.length - 1; index >= 0; index -= 1) {
    const observation = state.completedProbes[index]!;
    if (observation.judgementAfter !== state.currentJudgement) break;
    point = index + 1;
    if (observation.verdictChanged || observation.confidenceMateriallyChanged) break;
  }
  return point;
}

function hasOpenMaterialUncertainty(state: VerificationState): boolean {
  const remainingProbeIds = new Set(state.remainingProbes.map((probe) => probe.id));
  return openMaterialUncertainties(state).some((uncertainty) =>
    uncertainty.probeIds.some((probeId) => remainingProbeIds.has(probeId)),
  );
}

function openMaterialUncertainties(state: VerificationState): readonly VerificationUncertainty[] {
  const threshold = MATERIALITY_THRESHOLD[state.stakes];
  return state.unresolvedMaterialUncertainties.filter((uncertainty) =>
    uncertainty.status === "OPEN"
    && uncertainty.materiality >= threshold
    && uncertainty.verdictChangePotential >= 0.25);
}

function rankForEstablishedJudgement(
  state: VerificationState,
  ranked: readonly RankedVerificationProbe[],
  judgementEstablished: boolean,
): readonly RankedVerificationProbe[] {
  if (!judgementEstablished) return ranked;

  const primaryProbeIds = new Set(
    openMaterialUncertainties(state).flatMap((uncertainty) => uncertainty.probeIds),
  );
  const adjusted = ranked.map((item) => {
    const primaryIsGrounded = primaryProbeIds.has(item.probe.id);
    const primaryDecisionValue = primaryIsGrounded ? item.primaryDecisionValue : 0;
    return {
      ...item,
      value: round(Math.max(primaryDecisionValue, item.secondaryDiscoveryValue)),
      primaryDecisionValue,
      explanation: `${item.explanation} ${primaryIsGrounded
        ? "Primary decision value retained because this probe addresses an open stakes-adjusted material uncertainty."
        : "Primary decision value retired for mandatory verification because no open stakes-adjusted material uncertainty maps to this probe."}`,
    };
  });
  adjusted.sort((a, b) =>
    b.value - a.value
    || b.primaryDecisionValue - a.primaryDecisionValue
    || a.probe.id.localeCompare(b.probe.id));
  return adjusted.map((item, index) => ({ ...item, rank: index + 1 }));
}

export function assessVerification(state: VerificationState): VerificationAssessment {
  const initiallyRanked = rankVerificationProbes(state);
  const stableAt = verdictStabilityPoint(state);
  const judgementEstablished = state.currentJudgement !== "INSUFFICIENT_EVIDENCE" && stableAt !== null;
  const ranked = rankForEstablishedJudgement(state, initiallyRanked, judgementEstablished);
  const top = ranked[0];
  const materialUncertaintyRemains = hasOpenMaterialUncertainty(state);
  const highPrimaryValueRemains = (top?.primaryDecisionValue ?? 0) >= PRIMARY_CONTINUE_THRESHOLD[state.stakes];
  const decisionReady = judgementEstablished && !materialUncertaintyRemains && !highPrimaryValueRemains;
  const optionalFurtherInvestigation = decisionReady && (top?.secondaryDiscoveryValue ?? 0) >= OPTIONAL_DISCOVERY_THRESHOLD[state.stakes];

  let recommendedAction: VerificationAction;
  let reason: string;
  if (state.remainingProbes.length === 0) {
    recommendedAction = "STOP";
    reason = "No verification probes remain.";
  } else if (!decisionReady) {
    if (materialUncertaintyRemains || highPrimaryValueRemains) {
      recommendedAction = "CONTINUE";
      reason = materialUncertaintyRemains
        ? "An open stakes-adjusted material uncertainty can still change the primary decision."
        : "The highest remaining probe still has enough primary decision value to justify its cost.";
    } else {
      recommendedAction = "STOP";
      reason = "The evidence is insufficient, but no remaining probe has enough primary decision value to justify its cost.";
    }
  } else if (optionalFurtherInvestigation) {
    recommendedAction = "CONTINUE_OPTIONALLY";
    reason = "The primary decision is ready; one or more probes retain useful secondary defect-discovery value.";
  } else {
    recommendedAction = "STOP";
    reason = "The primary decision is ready and remaining probes are low-value or redundant after cost and relevance adjustments.";
  }

  const probesAfterStability = stableAt === null ? 0 : Math.max(0, state.completedProbes.length - stableAt);
  return {
    decisionReady,
    recommendedAction,
    optionalFurtherInvestigation,
    reason,
    rankedRemainingProbes: ranked,
    measurement: {
      probeBudget: state.probeBudget,
      probesUsed: state.completedProbes.length,
      verdictStabilityPoint: stableAt,
      probesAfterStability,
      highestRemainingProbeValue: top?.value ?? 0,
      theoreticallySkippableProbes: decisionReady && stableAt !== null ? Math.max(0, state.probeBudget - stableAt) : 0,
    },
  };
}
