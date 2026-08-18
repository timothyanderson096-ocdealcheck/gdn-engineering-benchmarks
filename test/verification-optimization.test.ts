import assert from "node:assert/strict";
import test from "node:test";
import { assessVerification, rankVerificationProbes } from "../src/verification.js";
import type { ProbeObservation, VerificationProbe, VerificationState, VerificationUncertainty } from "../src/verification.js";

function probe(id: string, overrides: Partial<VerificationProbe> = {}): VerificationProbe {
  return {
    id,
    description: `Run ${id}`,
    targetUncertainty: `Uncertainty targeted by ${id}`,
    verdictChangePotential: 0.2,
    expectedImpactIfConfirmed: 0.2,
    expectedImpactIfContradicted: 0.3,
    uncertaintyReductionPotential: 0.3,
    operationalRelevance: 0.7,
    stakesRelevance: 0.3,
    novelty: 0.8,
    secondaryDiscoveryValue: 0.1,
    estimatedCost: 0.5,
    overlapTags: [],
    relatedDefectPatternIds: [],
    ...overrides,
  };
}

function observation(probeId: string, overrides: Partial<ProbeObservation> = {}): ProbeObservation {
  return {
    probeId,
    outcome: `${probeId} completed`,
    judgementAfter: "SUPPORTED",
    verdictChanged: false,
    confidenceMateriallyChanged: false,
    newDefectPatternIds: [],
    coveredTags: [],
    ...overrides,
  };
}

function state(overrides: Partial<VerificationState> = {}): VerificationState {
  return {
    currentJudgement: "SUPPORTED",
    stakes: "low",
    probeBudget: 8,
    completedProbes: [observation("completed-1")],
    remainingProbes: [],
    unresolvedMaterialUncertainties: [],
    ...overrides,
  };
}

function uncertainty(overrides: Partial<VerificationUncertainty> = {}): VerificationUncertainty {
  return {
    id: "material-rule-boundary",
    description: "A rule boundary may reverse the verdict.",
    materiality: 0.9,
    verdictChangePotential: 0.8,
    status: "OPEN",
    probeIds: ["boundary"],
    ...overrides,
  };
}

test("a high-value unresolved probe requires continued verification", () => {
  const result = assessVerification(state({
    currentJudgement: "INSUFFICIENT_EVIDENCE",
    completedProbes: [],
    remainingProbes: [probe("boundary", {
      verdictChangePotential: 0.9,
      expectedImpactIfContradicted: 1,
      uncertaintyReductionPotential: 0.9,
      operationalRelevance: 1,
      stakesRelevance: 0.9,
      novelty: 1,
      estimatedCost: 0.2,
    })],
    unresolvedMaterialUncertainties: [uncertainty()],
  }));
  assert.equal(result.decisionReady, false);
  assert.equal(result.recommendedAction, "CONTINUE");
  assert.ok(result.measurement.highestRemainingProbeValue > 0.5);
});

test("a stable verdict with only low-value redundant probes remaining stops", () => {
  const result = assessVerification(state({
    completedProbes: [observation("same-check-1", { coveredTags: ["same-path"] }), observation("same-check-2", { coveredTags: ["same-path"] })],
    remainingProbes: [probe("same-check-3", {
      verdictChangePotential: 0.05,
      expectedImpactIfConfirmed: 0.1,
      expectedImpactIfContradicted: 0.1,
      uncertaintyReductionPotential: 0.1,
      operationalRelevance: 0.5,
      stakesRelevance: 0.1,
      novelty: 0.4,
      secondaryDiscoveryValue: 0.1,
      estimatedCost: 0.8,
      overlapTags: ["same-path"],
    })],
  }));
  assert.equal(result.decisionReady, true);
  assert.equal(result.recommendedAction, "STOP");
  assert.ok(result.rankedRemainingProbes[0]!.redundancyFactor < 0.5);
});

test("a stable primary decision can retain optional secondary discovery value", () => {
  const result = assessVerification(state({
    remainingProbes: [probe("secondary", {
      verdictChangePotential: 0.05,
      expectedImpactIfConfirmed: 0.2,
      expectedImpactIfContradicted: 0.2,
      uncertaintyReductionPotential: 0.2,
      operationalRelevance: 0.7,
      stakesRelevance: 0.2,
      secondaryDiscoveryValue: 0.9,
      estimatedCost: 0.5,
    })],
  }));
  assert.equal(result.decisionReady, true);
  assert.equal(result.recommendedAction, "CONTINUE_OPTIONALLY");
  assert.equal(result.optionalFurtherInvestigation, true);
});

test("high stakes require deeper verification than an equivalent low-stakes case", () => {
  const candidate = probe("stakes-sensitive", {
    verdictChangePotential: 0.25,
    expectedImpactIfContradicted: 0.4,
    uncertaintyReductionPotential: 0.4,
    operationalRelevance: 0.7,
    stakesRelevance: 0.8,
    estimatedCost: 0.7,
  });
  const open = uncertainty({ materiality: 0.5, verdictChangePotential: 0.4, probeIds: [candidate.id] });
  const low = assessVerification(state({ stakes: "low", remainingProbes: [candidate], unresolvedMaterialUncertainties: [open] }));
  const high = assessVerification(state({ stakes: "high", remainingProbes: [candidate], unresolvedMaterialUncertainties: [open] }));
  assert.equal(low.recommendedAction, "STOP");
  assert.equal(high.recommendedAction, "CONTINUE");
});

test("an operationally irrelevant extreme ranks below a realistic high-impact probe", () => {
  const extreme = probe("double-max-finite", {
    verdictChangePotential: 0.8,
    expectedImpactIfContradicted: 0.9,
    uncertaintyReductionPotential: 0.8,
    operationalRelevance: 0.02,
    novelty: 1,
    estimatedCost: 0.2,
  });
  const realistic = probe("realistic-boundary", {
    verdictChangePotential: 0.65,
    expectedImpactIfContradicted: 0.8,
    uncertaintyReductionPotential: 0.7,
    operationalRelevance: 0.95,
    novelty: 0.8,
    estimatedCost: 0.3,
  });
  const ranked = rankVerificationProbes(state({ remainingProbes: [extreme, realistic] }));
  assert.deepEqual(ranked.map((item) => item.probe.id), ["realistic-boundary", "double-max-finite"]);
  assert.ok(ranked[0]!.value > ranked[1]!.value);
});

test("repeated probes lose value through overlap", () => {
  const candidate = probe("repeat", { overlapTags: ["same-boundary"] });
  const freshValue = rankVerificationProbes(state({ completedProbes: [observation("unrelated")], remainingProbes: [candidate] }))[0]!;
  const repeatedValue = rankVerificationProbes(state({ completedProbes: [observation("prior", { coveredTags: ["same-boundary"] })], remainingProbes: [candidate] }))[0]!;
  assert.ok(repeatedValue.value < freshValue.value);
  assert.ok(repeatedValue.effectiveNovelty < freshValue.effectiveNovelty);
  assert.match(repeatedValue.explanation, /overlapping completed probe/);
});

test("a new defect pattern increases the value of a related follow-up", () => {
  const followUp = probe("follow-up", {
    verdictChangePotential: 0.1,
    secondaryDiscoveryValue: 0.7,
    relatedDefectPatternIds: ["precedence"],
  });
  const before = rankVerificationProbes(state({ remainingProbes: [followUp] }))[0]!;
  const after = rankVerificationProbes(state({
    completedProbes: [observation("discovery", { newDefectPatternIds: ["precedence"] })],
    remainingProbes: [followUp],
  }))[0]!;
  assert.ok(after.value > before.value);
  assert.equal(after.relatedPatternBoost, 1.2);
  assert.match(after.explanation, /follow-up boost applied/);
});

test("no remaining material uncertainty and no remaining probe stops", () => {
  const result = assessVerification(state({
    remainingProbes: [],
    unresolvedMaterialUncertainties: [uncertainty({ status: "RESOLVED" })],
  }));
  assert.equal(result.decisionReady, true);
  assert.equal(result.recommendedAction, "STOP");
  assert.equal(result.measurement.highestRemainingProbeValue, 0);
});

test("Pilot 3 fixture stops primary verification after probe 3, optionally values probe 4, then stops", () => {
  const lowRedundant = (id: string): VerificationProbe => probe(id, {
    verdictChangePotential: 0.03,
    expectedImpactIfConfirmed: 0.1,
    expectedImpactIfContradicted: 0.1,
    uncertaintyReductionPotential: 0.1,
    operationalRelevance: 0.6,
    stakesRelevance: 0.2,
    novelty: 0.3,
    secondaryDiscoveryValue: 0.08,
    estimatedCost: 0.7,
    overlapTags: ["primary-precedence"],
  });
  const probe4 = probe("probe-4-secondary-anchor", {
    verdictChangePotential: 0.05,
    expectedImpactIfConfirmed: 0.15,
    expectedImpactIfContradicted: 0.2,
    uncertaintyReductionPotential: 0.15,
    operationalRelevance: 0.9,
    stakesRelevance: 0.4,
    novelty: 1,
    secondaryDiscoveryValue: 0.9,
    estimatedCost: 0.4,
    overlapTags: ["secondary-output"],
  });
  const firstThree: ProbeObservation[] = [
    observation("probe-1", { judgementAfter: "INSUFFICIENT_EVIDENCE", coveredTags: ["boundary-control"] }),
    observation("probe-2", { judgementAfter: "INSUFFICIENT_EVIDENCE", confidenceMateriallyChanged: true, coveredTags: ["primary-precedence"] }),
    observation("probe-3", { judgementAfter: "CONTRADICTED", verdictChanged: true, newDefectPatternIds: ["precedence"], coveredTags: ["primary-precedence"] }),
  ];
  const afterProbe3 = assessVerification(state({
    currentJudgement: "CONTRADICTED",
    stakes: "medium",
    completedProbes: firstThree,
    remainingProbes: [probe4, lowRedundant("probe-5"), lowRedundant("probe-6"), lowRedundant("probe-7"), lowRedundant("probe-8")],
  }));
  assert.equal(afterProbe3.decisionReady, true);
  assert.equal(afterProbe3.recommendedAction, "CONTINUE_OPTIONALLY");
  assert.equal(afterProbe3.rankedRemainingProbes[0]!.probe.id, probe4.id);
  assert.deepEqual(afterProbe3.measurement, {
    probeBudget: 8,
    probesUsed: 3,
    verdictStabilityPoint: 3,
    probesAfterStability: 0,
    highestRemainingProbeValue: afterProbe3.rankedRemainingProbes[0]!.value,
    theoreticallySkippableProbes: 5,
  });

  const afterProbe4 = assessVerification(state({
    currentJudgement: "CONTRADICTED",
    stakes: "medium",
    completedProbes: [...firstThree, observation(probe4.id, {
      judgementAfter: "CONTRADICTED",
      newDefectPatternIds: ["inconsistent-supporting-anchor"],
      coveredTags: ["secondary-output"],
    })],
    remainingProbes: [lowRedundant("probe-5"), lowRedundant("probe-6"), lowRedundant("probe-7"), lowRedundant("probe-8")],
  }));
  assert.equal(afterProbe4.decisionReady, true);
  assert.equal(afterProbe4.recommendedAction, "STOP");
  assert.equal(afterProbe4.measurement.verdictStabilityPoint, 3);
  assert.equal(afterProbe4.measurement.probesAfterStability, 1);
  assert.equal(afterProbe4.measurement.theoreticallySkippableProbes, 5);
  assert.ok(afterProbe4.measurement.highestRemainingProbeValue < afterProbe3.measurement.highestRemainingProbeValue);
});
