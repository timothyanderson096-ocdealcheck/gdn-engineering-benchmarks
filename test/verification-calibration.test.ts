import assert from "node:assert/strict";
import test from "node:test";
import { assessVerification } from "../src/verification.js";
import type {
  ProbeObservation,
  VerificationProbe,
  VerificationState,
  VerificationUncertainty,
} from "../src/verification.js";

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

function uncertainty(
  id: string,
  probeIds: readonly string[],
  overrides: Partial<VerificationUncertainty> = {},
): VerificationUncertainty {
  return {
    id,
    description: `${id} may change the primary judgement.`,
    materiality: 0.9,
    verdictChangePotential: 0.8,
    status: "OPEN",
    probeIds,
    ...overrides,
  };
}

function state(overrides: Partial<VerificationState> = {}): VerificationState {
  return {
    currentJudgement: "SUPPORTED",
    stakes: "medium",
    probeBudget: 8,
    completedProbes: [observation("completed-1")],
    remainingProbes: [],
    unresolvedMaterialUncertainties: [],
    ...overrides,
  };
}

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

test("A. Pilot 3 stops mandatory verification at probe 3, allows one optional discovery, then stops", () => {
  const optional = probe("pilot-3-probe-4", {
    verdictChangePotential: 0.05,
    expectedImpactIfConfirmed: 0.15,
    expectedImpactIfContradicted: 0.2,
    uncertaintyReductionPotential: 0.15,
    operationalRelevance: 0.9,
    stakesRelevance: 0.4,
    novelty: 1,
    secondaryDiscoveryValue: 0.9,
    estimatedCost: 0.4,
  });
  const firstThree = [
    observation("pilot-3-probe-1", { judgementAfter: "INSUFFICIENT_EVIDENCE" }),
    observation("pilot-3-probe-2", { judgementAfter: "INSUFFICIENT_EVIDENCE", confidenceMateriallyChanged: true }),
    observation("pilot-3-probe-3", { judgementAfter: "CONTRADICTED", verdictChanged: true }),
  ];
  const afterThree = assessVerification(state({
    currentJudgement: "CONTRADICTED",
    completedProbes: firstThree,
    remainingProbes: [optional, lowRedundant("pilot-3-probe-5")],
  }));
  assert.equal(afterThree.decisionReady, true);
  assert.equal(afterThree.recommendedAction, "CONTINUE_OPTIONALLY");
  assert.equal(afterThree.rankedRemainingProbes[0]!.probe.id, optional.id);

  const afterOptional = assessVerification(state({
    currentJudgement: "CONTRADICTED",
    completedProbes: [...firstThree, observation(optional.id, { judgementAfter: "CONTRADICTED" })],
    remainingProbes: [lowRedundant("pilot-3-probe-5")],
  }));
  assert.equal(afterOptional.decisionReady, true);
  assert.equal(afterOptional.recommendedAction, "STOP");
});

const pilot4Probes: readonly VerificationProbe[] = [
  probe("P1-core-contradiction-matrix", { verdictChangePotential: 0.95, expectedImpactIfConfirmed: 0.82, expectedImpactIfContradicted: 1, uncertaintyReductionPotential: 0.95, operationalRelevance: 1, stakesRelevance: 1, novelty: 0.9, secondaryDiscoveryValue: 0.35, estimatedCost: 0.18, overlapTags: ["canonical-decision", "core-contract"], relatedDefectPatternIds: ["contract-normalization"] }),
  probe("P2-ui-gate-trace", { verdictChangePotential: 0.9, expectedImpactIfConfirmed: 0.78, expectedImpactIfContradicted: 1, uncertaintyReductionPotential: 0.9, operationalRelevance: 1, stakesRelevance: 1, novelty: 0.95, secondaryDiscoveryValue: 0.5, estimatedCost: 0.28, overlapTags: ["ui-integration", "navigation-gate"], relatedDefectPatternIds: ["integration-bypass"] }),
  probe("P3-malformed-shape-fuzz", { verdictChangePotential: 0.72, expectedImpactIfConfirmed: 0.68, expectedImpactIfContradicted: 0.92, uncertaintyReductionPotential: 0.78, operationalRelevance: 0.82, stakesRelevance: 0.9, novelty: 1, secondaryDiscoveryValue: 0.72, estimatedCost: 0.26, overlapTags: ["canonical-decision", "malformed-contract"], relatedDefectPatternIds: ["contract-normalization"] }),
  probe("P4-deployed-endpoint-smoke", { verdictChangePotential: 0.56, expectedImpactIfConfirmed: 0.45, expectedImpactIfContradicted: 0.9, uncertaintyReductionPotential: 0.62, operationalRelevance: 1, stakesRelevance: 0.8, novelty: 1, secondaryDiscoveryValue: 0.85, estimatedCost: 0.35, overlapTags: ["deployed-contract"], relatedDefectPatternIds: ["deployment-drift"] }),
  probe("P5-scoped-static-analysis", { verdictChangePotential: 0.7, expectedImpactIfConfirmed: 0.62, expectedImpactIfContradicted: 0.95, uncertaintyReductionPotential: 0.7, operationalRelevance: 0.9, stakesRelevance: 0.72, novelty: 0.62, secondaryDiscoveryValue: 0.28, estimatedCost: 0.2, overlapTags: ["compile", "ui-integration"], relatedDefectPatternIds: ["integration-bypass"] }),
  probe("P6-local-backend-contract-audit", { verdictChangePotential: 0.52, expectedImpactIfConfirmed: 0.5, expectedImpactIfContradicted: 0.86, uncertaintyReductionPotential: 0.62, operationalRelevance: 0.92, stakesRelevance: 0.82, novelty: 0.88, secondaryDiscoveryValue: 0.9, estimatedCost: 0.42, overlapTags: ["backend-contract", "core-contract"], relatedDefectPatternIds: ["backend-unsound-output", "deployment-drift"] }),
  probe("P7-full-suite-regression", { verdictChangePotential: 0.38, expectedImpactIfConfirmed: 0.42, expectedImpactIfContradicted: 0.82, uncertaintyReductionPotential: 0.48, operationalRelevance: 0.82, stakesRelevance: 0.58, novelty: 0.38, secondaryDiscoveryValue: 0.4, estimatedCost: 0.58, overlapTags: ["regression", "compile"] }),
  probe("P8-status-boundaries", { verdictChangePotential: 0.32, expectedImpactIfConfirmed: 0.35, expectedImpactIfContradicted: 0.65, uncertaintyReductionPotential: 0.44, operationalRelevance: 0.65, stakesRelevance: 0.58, novelty: 0.58, secondaryDiscoveryValue: 0.32, estimatedCost: 0.18, overlapTags: ["canonical-decision", "status-boundary"], relatedDefectPatternIds: ["contract-normalization"] }),
];

const pilot4Uncertainties: readonly VerificationUncertainty[] = [
  uncertainty("U1-core-decision", ["P1-core-contradiction-matrix"], { materiality: 1, verdictChangePotential: 0.95 }),
  uncertainty("U2-integration-bypass", ["P2-ui-gate-trace", "P5-scoped-static-analysis"], { materiality: 1, verdictChangePotential: 0.9 }),
  uncertainty("U3-malformed-fail-closed", ["P3-malformed-shape-fuzz", "P8-status-boundaries"], { materiality: 0.82, verdictChangePotential: 0.72 }),
  uncertainty("U4-backend-alignment", ["P4-deployed-endpoint-smoke", "P6-local-backend-contract-audit"], { materiality: 0.72, verdictChangePotential: 0.56 }),
];

const pilot4FirstFour: readonly ProbeObservation[] = [
  observation("P1-core-contradiction-matrix", { judgementAfter: "PARTIALLY_SUPPORTED", verdictChanged: true, confidenceMateriallyChanged: true, coveredTags: ["canonical-decision", "core-contract"] }),
  observation("P2-ui-gate-trace", { judgementAfter: "PARTIALLY_SUPPORTED", confidenceMateriallyChanged: true, coveredTags: ["ui-integration", "navigation-gate"] }),
  observation("P3-malformed-shape-fuzz", { judgementAfter: "PARTIALLY_SUPPORTED", confidenceMateriallyChanged: true, newDefectPatternIds: ["contract-normalization"], coveredTags: ["canonical-decision", "malformed-contract"] }),
  observation("P4-deployed-endpoint-smoke", { judgementAfter: "PARTIALLY_SUPPORTED", coveredTags: ["deployed-contract"] }),
];

test("B. recorded Pilot 4 prioritizes the probe linked to U4 and stops mandatory work after it resolves U4", () => {
  const afterP4 = assessVerification(state({
    currentJudgement: "PARTIALLY_SUPPORTED",
    stakes: "high",
    completedProbes: pilot4FirstFour,
    remainingProbes: pilot4Probes.filter((candidate) => !pilot4FirstFour.some((item) => item.probeId === candidate.id)),
    unresolvedMaterialUncertainties: pilot4Uncertainties.map((item) => ({ ...item, status: item.id === "U4-backend-alignment" ? "OPEN" : "RESOLVED" })),
  }));
  assert.equal(afterP4.recommendedAction, "CONTINUE");
  assert.equal(afterP4.rankedRemainingProbes[0]!.probe.id, "P6-local-backend-contract-audit");
  assert.equal(afterP4.rankedRemainingProbes.find((item) => item.probe.id === "P5-scoped-static-analysis")!.primaryDecisionValue, 0);

  const afterP6 = assessVerification(state({
    currentJudgement: "PARTIALLY_SUPPORTED",
    stakes: "high",
    completedProbes: [...pilot4FirstFour, observation("P6-local-backend-contract-audit", { judgementAfter: "PARTIALLY_SUPPORTED", newDefectPatternIds: ["backend-unsound-output"], coveredTags: ["backend-contract", "core-contract"] })],
    remainingProbes: pilot4Probes.filter((candidate) => ![...pilot4FirstFour.map((item) => item.probeId), "P6-local-backend-contract-audit"].includes(candidate.id)),
    unresolvedMaterialUncertainties: pilot4Uncertainties.map((item) => ({ ...item, status: "RESOLVED" })),
  }));
  assert.equal(afterP6.decisionReady, true);
  assert.equal(afterP6.recommendedAction, "CONTINUE_OPTIONALLY");
  assert.ok(afterP6.rankedRemainingProbes.every((item) => item.primaryDecisionValue === 0));
  assert.ok(afterP6.measurement.probesUsed < afterP6.measurement.probeBudget);
});

test("C. stable-looking verdict continues when a realistic operational uncertainty remains directly addressable", () => {
  const direct = probe("production-boundary", { verdictChangePotential: 0.75, expectedImpactIfContradicted: 0.9, operationalRelevance: 1, stakesRelevance: 0.8, estimatedCost: 0.25 });
  const result = assessVerification(state({
    completedProbes: [observation("p1"), observation("p2")],
    remainingProbes: [direct],
    unresolvedMaterialUncertainties: [uncertainty("production-blind-spot", [direct.id])],
  }));
  assert.equal(result.decisionReady, false);
  assert.equal(result.recommendedAction, "CONTINUE");
});

test("D. higher stakes retain a verdict-changing uncertainty that a low-stakes case may retire", () => {
  const direct = probe("stakes-sensitive", { operationalRelevance: 0.8, stakesRelevance: 0.9 });
  const open = uncertainty("stakes-boundary", [direct.id], { materiality: 0.5, verdictChangePotential: 0.4 });
  const low = assessVerification(state({ stakes: "low", remainingProbes: [direct], unresolvedMaterialUncertainties: [open] }));
  const high = assessVerification(state({ stakes: "high", remainingProbes: [direct], unresolvedMaterialUncertainties: [open] }));
  assert.equal(low.recommendedAction, "STOP");
  assert.equal(high.recommendedAction, "CONTINUE");
});

test("E. overlapping low-value probes stop after completed evidence covers their path", () => {
  const result = assessVerification(state({
    completedProbes: [observation("p1", { coveredTags: ["primary-precedence"] }), observation("p2", { coveredTags: ["primary-precedence"] })],
    remainingProbes: [lowRedundant("redundant")],
  }));
  assert.equal(result.recommendedAction, "STOP");
  assert.ok(result.rankedRemainingProbes[0]!.redundancyFactor < 0.5);
});

test("F. settled primary judgement can continue only optionally for secondary discovery", () => {
  const secondary = probe("secondary", { verdictChangePotential: 0.03, secondaryDiscoveryValue: 0.95, operationalRelevance: 0.9, novelty: 1, estimatedCost: 0.35 });
  const result = assessVerification(state({ remainingProbes: [secondary] }));
  assert.equal(result.decisionReady, true);
  assert.equal(result.recommendedAction, "CONTINUE_OPTIONALLY");
});

test("G. a high static score cannot force continuation when it maps to no open material uncertainty", () => {
  const trap = probe("static-score-trap", { verdictChangePotential: 1, expectedImpactIfConfirmed: 1, expectedImpactIfContradicted: 1, uncertaintyReductionPotential: 1, operationalRelevance: 1, stakesRelevance: 1, novelty: 1, secondaryDiscoveryValue: 0, estimatedCost: 0.01 });
  const result = assessVerification(state({
    remainingProbes: [trap],
    unresolvedMaterialUncertainties: [uncertainty("unaddressable-open-question", ["different-probe"])],
  }));
  assert.equal(result.rankedRemainingProbes[0]!.primaryDecisionValue, 0);
  assert.equal(result.decisionReady, true);
  assert.equal(result.recommendedAction, "STOP");
});

test("H. a direct probe may force continuation despite an otherwise stable verdict", () => {
  const direct = probe("direct-uncertainty-probe", { verdictChangePotential: 0.8, expectedImpactIfContradicted: 0.9, uncertaintyReductionPotential: 0.9, operationalRelevance: 1, estimatedCost: 0.2 });
  const result = assessVerification(state({ remainingProbes: [direct], unresolvedMaterialUncertainties: [uncertainty("material-gap", [direct.id])] }));
  assert.equal(result.rankedRemainingProbes[0]!.primaryDecisionValue > 0, true);
  assert.equal(result.recommendedAction, "CONTINUE");
});

test("I. two agreeing probes do not cause an early stop while an independent material blind spot remains", () => {
  const independent = probe("independent-third-probe", { verdictChangePotential: 0.9, expectedImpactIfContradicted: 1, uncertaintyReductionPotential: 0.9, operationalRelevance: 1, novelty: 1, estimatedCost: 0.25, overlapTags: ["independent-path"] });
  const result = assessVerification(state({
    completedProbes: [observation("agree-1", { coveredTags: ["shared-path"] }), observation("agree-2", { coveredTags: ["shared-path"] })],
    remainingProbes: [independent],
    unresolvedMaterialUncertainties: [uncertainty("independent-blind-spot", [independent.id])],
  }));
  assert.equal(result.measurement.verdictStabilityPoint, 1);
  assert.equal(result.recommendedAction, "CONTINUE");
});
