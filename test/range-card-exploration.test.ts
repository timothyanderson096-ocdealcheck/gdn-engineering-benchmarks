import assert from "node:assert/strict";
import test from "node:test";
import { observeResolvedRangeCard } from "../src/exploration/calibration.js";
import { stockRangeCardExample, vehicleRangeCardExample } from "../src/exploration/examples.js";
import { createRangeCard, validateRangeCard } from "../src/exploration/range-card.js";
import { presentRangeCard } from "../src/exploration/presentation.js";
import type { ExplorationArc } from "../src/exploration/types.js";
import { analyze } from "../src/engine.js";
import { createVolvoCase } from "../src/fixtures/volvo.js";

test("Main Arc preserves the user's stated path", () => {
  const result = vehicleRangeCardExample();
  assert.equal(result.rangeCard.mainArc.arcPosition, "MAIN_ARC");
  assert.equal(result.rangeCard.mainArc.arcType, "STATED_PATH");
  assert.equal(result.rangeCard.mainArc.purpose, "STATED_PATH");
  assert.equal(result.rangeCard.mainArc.origin, "USER_SUPPLIED");
  assert.ok(result.rangeCard.mainArc.description.includes("nominated used car"));
});

test("left and right arcs remain traceably linked to the original objective", () => {
  const { rangeCard } = vehicleRangeCardExample();
  for (const arc of [rangeCard.leftArc, rangeCard.rightArc]) {
    assert.ok(arc.objectiveLink.length > 0);
    assert.ok(arc.affectedObjectiveParts.length > 0);
    assert.ok(arc.outcomeChangingFactor.dimensions.length > 0);
  }
  assert.equal(validateRangeCard(rangeCard).valid, true);
});

test("random unrelated alternatives fail the Outcome-Changing Factor filter", () => {
  const base = vehicleRangeCardExample().rangeCard;
  const unrelated: ExplorationArc = {
    ...structuredClone(base.rightArc),
    id: "random-hobby",
    title: "Unrelated hobby",
    objectiveLink: "",
    affectedObjectiveParts: [],
    outcomeChangingFactor: { couldMateriallyChangeOutcome: false, dimensions: [], rationale: "" },
  };
  const result = createRangeCard(base, [unrelated]);
  assert.equal(result.rejectedCandidates.length, 1);
  assert.ok(result.rejectedCandidates[0]!.reasons.some((reason) => reason.includes("Outcome-Changing Factor")));
  assert.ok(result.rejectedCandidates[0]!.reasons.some((reason) => reason.includes("original objective")));
});

test("alternative-path and hidden-factor arcs remain distinct", () => {
  const { rangeCard } = vehicleRangeCardExample();
  assert.equal(rangeCard.leftArc.purpose, "HIDDEN_FACTOR_EXPLORATION");
  assert.equal(rangeCard.rightArc.purpose, "ALTERNATIVE_PATH_EXPLORATION");
  assert.notEqual(rangeCard.leftArc.purpose, rangeCard.rightArc.purpose);
});

test("interlocking relationships preserve multi-arc traceability", () => {
  const { rangeCard } = stockRangeCardExample();
  assert.equal(rangeCard.interlockingArcs[0]!.arcPosition, "INTERLOCKING_ARC");
  assert.equal(rangeCard.relationships[0]!.relationshipType, "AMPLIFIES_RISK");
  assert.deepEqual(rangeCard.relationships[0]!.arcIds, ["management-incentives", "refinancing-milestone", "nominated-company"]);
});

test("user-supplied arcs remain distinguishable from system-proposed arcs", () => {
  const { rangeCard } = stockRangeCardExample();
  assert.equal(rangeCard.mainArc.origin, "USER_SUPPLIED");
  assert.equal(rangeCard.leftArc.origin, "SYSTEM_PROPOSED");
  assert.equal(rangeCard.rightArc.origin, "SYSTEM_PROPOSED");
});

test("a hidden factor cannot silently become verified evidence", () => {
  const base = vehicleRangeCardExample().rangeCard;
  const invalid = structuredClone(base);
  invalid.leftArc.status = "EVIDENCE_SUPPORTED";
  invalid.leftArc.evidenceReferences = [];
  const validation = validateRangeCard(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes("not evidence")));
  assert.throws(() => createRangeCard(invalid), /EVIDENCE_SUPPORTED/);
});

test("range-card exploration does not change engine scoring or confidence", () => {
  const decisionCase = createVolvoCase();
  const before = analyze(decisionCase, { now: new Date("2026-08-13T00:00:00.000Z") });
  vehicleRangeCardExample();
  stockRangeCardExample();
  const after = analyze(decisionCase, { now: new Date("2026-08-13T00:00:00.000Z") });
  assert.deepEqual(after.conclusion, before.conclusion);
  assert.deepEqual(after.snapshot.hypothesisWeights, before.snapshot.hypothesisWeights);
  assert.equal(after.conclusion.confidence, before.conclusion.confidence);
});

test("presentation exposes range-card detail without modifying snapshots", () => {
  const analyzed = analyze(createVolvoCase(), { now: new Date("2026-08-13T00:00:00.000Z") }).decisionCase;
  const history = structuredClone(analyzed.analysisHistory);
  const source = vehicleRangeCardExample();
  const original = structuredClone(source);
  const condensed = presentRangeCard(source, "CONDENSED");
  const balanced = presentRangeCard(source, "BALANCED");
  const audit = presentRangeCard(source, "AUDIT");
  assert.equal(condensed.mode, "CONDENSED");
  assert.equal(condensed.materialDisclosures.length, 1);
  assert.equal(balanced.mode, "BALANCED");
  assert.equal(audit.mode, "AUDIT");
  assert.deepEqual(source, original);
  assert.deepEqual(analyzed.analysisHistory, history);
});

test("resolved range-card observations record usefulness, noise, framing misses, and path performance", () => {
  const result = vehicleRangeCardExample();
  const observation = observeResolvedRangeCard(result, {
    caseId: "resolved-vehicle",
    importantArcIds: ["model-failure-risk"],
    originalFramingMissedArcIds: ["model-failure-risk"],
    usefulArcIds: ["model-failure-risk", "adjacent-vehicle-path"],
    irrelevantNoiseArcIds: [],
    outperformingAlternativeArcId: "adjacent-vehicle-path",
    notes: [],
  });
  assert.equal(observation.importantFactorsSurfaced, 1);
  assert.equal(observation.originalFramingMissesSurfaced, 1);
  assert.equal(observation.usefulLateralArcs, 2);
  assert.equal(observation.irrelevantNoiseArcs, 0);
  assert.equal(observation.alternativePathOutperformedMain, true);
});
