import assert from "node:assert/strict";
import test from "node:test";
import { createDecisionCase } from "../src/case.js";
import type { DecisionCase, Evidence, Hypothesis, Unknown } from "../src/domain.js";
import { analyze } from "../src/engine.js";
import { createVolvoCase } from "../src/fixtures/volvo.js";
import { buildAuditData, presentDecision } from "../src/presentation/present.js";
import type { PresentationMode } from "../src/presentation/types.js";

const now = new Date("2026-08-13T10:00:00.000Z");
const depth: Record<PresentationMode, number> = { CONDENSED: 1, BALANCED: 2, AUDIT: 3 };
const hypotheses: Hypothesis[] = [
  { id: "go", statement: "the path will work.", kind: "mainstream", priorWeight: 0.7, currentWeight: 0.7, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "ACT" },
  { id: "stop", statement: "the path will fail.", kind: "alternative", priorWeight: 0.2, currentWeight: 0.2, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "ABORT" },
  { id: "wild", statement: "an overlooked factor changes the path.", kind: "wildcard", priorWeight: 0.1, currentWeight: 0.1, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "CHANGE_PATH" },
];

function strongEvidence(id: string): Evidence {
  return { id, statement: `Independent result ${id} supports proceeding.`, sourceId: "lab", provenance: "Independent test", timestamp: now.toISOString(), type: "measurement", relevance: 1, reliability: 1, directness: 1, freshness: 1, independence: 1, supports: ["go"], contradicts: [] };
}

function analyzedCase(args: { stakes?: DecisionCase["stakes"]; evidence?: Evidence[]; unknowns?: Unknown[] } = {}): DecisionCase {
  return analyze(createDecisionCase({
    id: "presentation-case",
    question: "Proceed?",
    desiredResult: "Proceed only with adequate support.",
    timeframe: { label: "Soon", urgency: "near_term" },
    stakes: args.stakes ?? "low",
    reversibility: "easy",
    sources: [{ id: "lab", name: "Lab", domain: "validation", expertise: 0.9, historicalTrackRecord: 0.9, independence: 0.95, incentiveConflictRisk: 0.05, position: "mainstream" }],
    evidence: args.evidence ?? [strongEvidence("e1"), strongEvidence("e2"), strongEvidence("e3"), strongEvidence("e4")],
    hunches: [{ id: "h1", statement: "There may be an edge case.", investigationPriority: 0.4 }],
    hypotheses,
    connections: [],
    unknowns: args.unknowns ?? [],
    predictions: [{ id: "p1", whoOrSource: "lab", exactPrediction: "The next run will pass.", dateMade: now.toISOString(), timeframe: "one week", probability: 0.75, domain: "validation", resolutionCriteria: "Pass recorded" }],
  }), { now }).decisionCase;
}

test("CONDENSED hides detail without removing backend data", () => {
  const decisionCase = analyzedCase();
  const original = structuredClone(decisionCase);
  const result = presentDecision(decisionCase, "CONDENSED");
  assert.equal(result.view.mode, "CONDENSED");
  assert.equal("evidence" in result.view, false);
  assert.equal("hypotheses" in result.view, false);
  assert.deepEqual(decisionCase, original);
  assert.equal(decisionCase.evidence.length, 4);
});

test("AUDIT exposes the full available analysis", () => {
  const decisionCase = analyze(createVolvoCase(), { now }).decisionCase;
  const result = presentDecision(decisionCase, "AUDIT");
  assert.equal(result.view.mode, "AUDIT");
  if (result.view.mode !== "AUDIT") return;
  assert.deepEqual(result.view.evidence, decisionCase.evidence);
  assert.deepEqual(result.view.sources, decisionCase.sources);
  assert.deepEqual(result.view.hypotheses, decisionCase.hypotheses);
  assert.deepEqual(result.view.analysisSnapshots, decisionCase.analysisHistory);
  assert.equal(result.view.wildcardHypotheses.length, 1);
  assert.ok(result.expandableSections.every((section) => section.defaultExpanded));
});

test("AUTO selects more detail for lower confidence", () => {
  const high = presentDecision(analyzedCase(), "AUTO");
  const low = presentDecision(analyzedCase({ evidence: [] }), "AUTO");
  assert.equal(high.selectedMode, "CONDENSED");
  assert.equal(low.selectedMode, "BALANCED");
  assert.ok(depth[low.selectedMode] > depth[high.selectedMode]);
});

test("AUTO selects more detail for higher stakes", () => {
  const lowStakes = presentDecision(analyzedCase({ stakes: "low" }), "AUTO");
  const highStakes = presentDecision(analyzedCase({ stakes: "high" }), "AUTO");
  assert.ok(depth[highStakes.selectedMode] > depth[lowStakes.selectedMode]);
});

test("explicit user preference overrides AUTO", () => {
  assert.equal(presentDecision(analyzedCase({ evidence: [] }), "CONDENSED").selectedMode, "CONDENSED");
  assert.equal(presentDecision(analyzedCase(), "AUDIT").selectedMode, "AUDIT");
});

test("an unresolved high-value unknown increases disclosure", () => {
  const base = presentDecision(analyzedCase(), "AUTO");
  const unknown: Unknown = { id: "critical", question: "Resolve the critical record", expectedDecisionValue: 0.98, estimatedAcquisitionCost: 0.05, estimatedTimeCost: 0.05, status: "open" };
  const withUnknown = presentDecision(analyzedCase({ unknowns: [unknown] }), "AUTO");
  assert.ok(depth[withUnknown.selectedMode] > depth[base.selectedMode]);
  assert.ok(withUnknown.autoSelectionReasons.some((reason) => reason.includes("high-value unknown")));
});

test("presentation changes do not alter conclusion or confidence", () => {
  const decisionCase = analyzedCase();
  for (const preference of ["CONDENSED", "BALANCED", "AUDIT"] as const) {
    const view = presentDecision(decisionCase, preference).view;
    assert.equal(view.conclusion.action, decisionCase.latestConclusion!.action);
    assert.equal(view.conclusion.statement, decisionCase.latestConclusion!.statement);
    assert.equal(view.mode === "AUDIT" ? view.conclusion.confidence : view.confidence, decisionCase.latestConclusion!.confidence);
  }
});

test("full audit data remains identical regardless of presentation mode", () => {
  const decisionCase = analyze(createVolvoCase(), { now }).decisionCase;
  const before = buildAuditData(decisionCase);
  presentDecision(decisionCase, "CONDENSED");
  presentDecision(decisionCase, "BALANCED");
  presentDecision(decisionCase, "AUDIT");
  assert.deepEqual(buildAuditData(decisionCase), before);
  assert.deepEqual(decisionCase.analysisHistory, before.analysisSnapshots);
});

test("AUTO thresholds are configurable and transparent", () => {
  const result = presentDecision(analyzedCase(), "AUTO", { thresholds: { condensedMinimumConfidence: 0.99 } });
  assert.equal(result.selectedMode, "BALANCED");
});
