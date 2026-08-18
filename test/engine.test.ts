import assert from "node:assert/strict";
import test from "node:test";
import { createDecisionCase } from "../src/case.js";
import { addEvidence, analyze, recordOutcome } from "../src/engine.js";
import { createVolvoCase } from "../src/fixtures/volvo.js";
import { rankUnknowns } from "../src/scoring.js";
import type { DecisionCase, Evidence, Hypothesis, Lesson } from "../src/domain.js";

const now = new Date("2026-08-13T10:00:00.000Z");

function basicCase(overrides: Partial<DecisionCase> = {}): DecisionCase {
  const hypotheses: Hypothesis[] = [
    { id: "go", statement: "the proposed path meets the desired result.", kind: "mainstream", priorWeight: 0.7, currentWeight: 0.7, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "ACT" },
    { id: "no-go", statement: "the proposed path does not meet the desired result.", kind: "alternative", priorWeight: 0.2, currentWeight: 0.2, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "ABORT" },
    { id: "wildcard", statement: "an unmodeled factor changes the result.", kind: "wildcard", priorWeight: 0.1, currentWeight: 0.1, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "WAIT" },
  ];
  const evidence: Evidence[] = [
    { id: "strong", statement: "A direct, independently verified test succeeded.", sourceId: "test", provenance: "Controlled test", timestamp: now.toISOString(), type: "measurement", relevance: 1, reliability: 1, directness: 1, freshness: 1, independence: 1, supports: ["go"], contradicts: [] },
    { id: "strong-2", statement: "A second independent test succeeded.", sourceId: "test-2", provenance: "Independent controlled test", timestamp: now.toISOString(), type: "measurement", relevance: 1, reliability: 1, directness: 1, freshness: 1, independence: 1, supports: ["go"], contradicts: [] },
    { id: "strong-3", statement: "A third independent test succeeded.", sourceId: "test-3", provenance: "Independent controlled test", timestamp: now.toISOString(), type: "measurement", relevance: 1, reliability: 1, directness: 1, freshness: 1, independence: 1, supports: ["go"], contradicts: [] },
  ];
  return {
    ...createDecisionCase({ id: "basic", question: "Proceed?", desiredResult: "A safe useful outcome", timeframe: { label: "Soon", urgency: "near_term" }, stakes: "low", reversibility: "easy", sources: [], evidence, hunches: [], hypotheses, connections: [], unknowns: [], predictions: [] }),
    ...overrides,
  };
}

test("high-value missing information produces ACQUIRE_INFORMATION", () => {
  assert.equal(analyze(createVolvoCase(), { now }).conclusion.action, "ACQUIRE_INFORMATION");
});

test("a low-stakes case with sufficiently strong evidence can produce ACT", () => {
  assert.equal(analyze(basicCase(), { now }).conclusion.action, "ACT");
});

test("a high-stakes case with equivalent uncertainty does not automatically produce ACT", () => {
  assert.notEqual(analyze(basicCase({ stakes: "high", reversibility: "hard" }), { now }).conclusion.action, "ACT");
});

test("strong contradictory evidence reduces hypothesis weighting", () => {
  const initial = analyze(basicCase(), { now });
  const contradiction: Evidence = { id: "contra", statement: "A direct independent test failed.", sourceId: "audit", provenance: "Independent audit", timestamp: now.toISOString(), type: "measurement", relevance: 1, reliability: 1, directness: 1, freshness: 1, independence: 1, supports: ["no-go"], contradicts: ["go"] };
  const updated = addEvidence(initial.decisionCase, contradiction, { now: new Date(now.getTime() + 1000) });
  assert.ok(updated.snapshot.hypothesisWeights.go! < initial.snapshot.hypothesisWeights.go!);
});

test("wildcard hypothesis remains present while uncertainty is material", () => {
  const result = analyze(createVolvoCase(), { now });
  assert.ok("wildcard-variant" in result.snapshot.hypothesisWeights);
  assert.ok(result.snapshot.hypothesisWeights["wildcard-variant"]! > 0);
});

test("hunches do not directly count as evidence", () => {
  const original = basicCase();
  const withHunch = basicCase({ hunches: [{ id: "h1", statement: "This feels promising", investigationPriority: 1, generatedHypothesis: "go" }] });
  assert.deepEqual(analyze(withHunch, { now }).snapshot.hypothesisWeights, analyze(original, { now }).snapshot.hypothesisWeights);
});

test("unknowns rank by decision value adjusted for acquisition cost and time", () => {
  const ranked = rankUnknowns([
    { id: "cheap-high", question: "Cheap and valuable?", expectedDecisionValue: 0.9, estimatedAcquisitionCost: 0.1, estimatedTimeCost: 0.1, status: "open" },
    { id: "costly-high", question: "Costly but valuable?", expectedDecisionValue: 0.9, estimatedAcquisitionCost: 0.9, estimatedTimeCost: 0.9, status: "open" },
    { id: "cheap-low", question: "Cheap but minor?", expectedDecisionValue: 0.3, estimatedAcquisitionCost: 0.1, estimatedTimeCost: 0.1, status: "open" },
  ]);
  assert.deepEqual(ranked.map((item) => item.id), ["cheap-high", "costly-high", "cheap-low"]);
});

test("historical snapshots remain unchanged after new evidence", () => {
  const first = analyze(createVolvoCase(), { now });
  const saved = structuredClone(first.decisionCase.analysisHistory[0]);
  const evidence: Evidence = { id: "new", statement: "PPSR is clean.", sourceId: "ppsr", provenance: "Official register", timestamp: now.toISOString(), type: "record", relevance: 1, reliability: 0.98, directness: 1, freshness: 1, independence: 1, supports: ["worth-pursuing"], contradicts: ["too-risky"] };
  const second = addEvidence(first.decisionCase, evidence, { now: new Date(now.getTime() + 1000) });
  assert.deepEqual(second.decisionCase.analysisHistory[0], saved);
  assert.equal(second.decisionCase.analysisHistory.length, 2);
});

test("historical snapshots remain unchanged after an outcome is recorded", () => {
  const analyzed = analyze(createVolvoCase(), { now }).decisionCase;
  const saved = structuredClone(analyzed.analysisHistory);
  const lessons: Lesson[] = [{ id: "lesson-1", recordedAt: now.toISOString(), category: "missing_information", statement: "The service records materially changed the assessment." }];
  const updated = recordOutcome(analyzed, { recordedAt: now.toISOString(), result: "Vehicle was not purchased." }, lessons);
  assert.deepEqual(updated.analysisHistory, saved);
  assert.equal(updated.lessons.length, 1);
});

test("the engine never outputs 100% confidence", () => {
  assert.ok(analyze(basicCase(), { now }).conclusion.confidence < 1);
});

test("WAIT is possible when evidence is insufficient", () => {
  const decisionCase = basicCase({ evidence: [], unknowns: [] });
  assert.equal(analyze(decisionCase, { now }).conclusion.action, "WAIT");
});

test("conclusion terminology never uses the prohibited phrase", () => {
  for (const decisionCase of [basicCase(), createVolvoCase(), basicCase({ stakes: "high", evidence: [] })]) {
    const serialized = JSON.stringify(analyze(decisionCase, { now }).conclusion).toLowerCase();
    assert.equal(serialized.includes("right decision"), false);
  }
});
