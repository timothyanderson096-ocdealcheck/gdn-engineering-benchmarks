import assert from "node:assert/strict";
import test from "node:test";
import { buildCalibrationReport } from "../src/calibration/report.js";
import { replayResolvedCase } from "../src/calibration/replay.js";
import { syntheticResolvedCases } from "../src/calibration/fixtures.js";

const fixture = (id: string) => syntheticResolvedCases.find((item) => item.id === id)!;

test("replay runs chronologically and preserves one generated snapshot per stage", () => {
  const replay = replayResolvedCase(fixture("contradiction-changes-conclusion"));
  assert.equal(replay.stages.length, 2);
  assert.deepEqual(replay.stages.map((stage) => stage.snapshot.id), ["analysis-1", "analysis-2"]);
  assert.ok(replay.stages[0]!.timestamp < replay.stages[1]!.timestamp);
  assert.equal(replay.finalDecisionCase.analysisHistory.length, 2);
});

test("replay never mutates fixture data or prior snapshots", () => {
  const source = fixture("high-value-unknown-resolves");
  const pristine = structuredClone(source);
  const replay = replayResolvedCase(source);
  const firstSnapshot = structuredClone(replay.finalDecisionCase.analysisHistory[0]);
  assert.deepEqual(source, pristine);
  assert.deepEqual(replay.finalDecisionCase.analysisHistory[0], firstSnapshot);
  assert.notStrictEqual(replay.finalDecisionCase.analysisHistory[0], replay.stages[0]!.snapshot);
});

test("contradictory evidence changes the leading conclusion toward the outcome", () => {
  const replay = replayResolvedCase(fixture("contradiction-changes-conclusion"));
  assert.equal(replay.stages[0]!.snapshot.leadingHypothesisId, "accept");
  assert.equal(replay.stages[1]!.snapshot.leadingHypothesisId, "reject");
  assert.equal(replay.additionalEvidenceMateriallyChangedConclusion, true);
});

test("wildcard can become the best resolved explanation", () => {
  const replay = replayResolvedCase(fixture("wildcard-best-explanation"));
  assert.equal(replay.stages.at(-1)!.snapshot.leadingHypothesisId, "wildcard");
  assert.equal(replay.stages.at(-1)!.conclusion.action, "CHANGE_PATH");
});

test("a high-ranked unknown that resolves the case is credited", () => {
  const replay = replayResolvedCase(fixture("high-value-unknown-resolves"));
  assert.equal(replay.matteredUnknownRanks["decisive-record"], 1);
  assert.equal(replay.topRankedUnknownWasRelevant, true);
});

test("irrelevant high-value requests and lower-ranked useful unknowns are exposed", () => {
  const replay = replayResolvedCase(fixture("high-value-unknown-irrelevant"));
  assert.equal(replay.matteredUnknownRanks["lower-ranked-actual"], 2);
  assert.deepEqual(replay.wastedInformationRequests, ["supposedly-decisive"]);
});

test("stopping assessment detects premature commitment", () => {
  const replay = replayResolvedCase(fixture("engine-stops-too-early"));
  assert.equal(replay.firstCommitmentStage, 1);
  assert.equal(replay.stoppingAssessment, "too_early");
  assert.equal(replay.additionalEvidenceMateriallyChangedConclusion, true);
});

test("the engine can wait at an insufficient stage and commit at the sufficient stage", () => {
  const replay = replayResolvedCase(fixture("waits-appropriately"));
  assert.equal(replay.stages[0]!.conclusion.action, "WAIT");
  assert.equal(replay.stages[1]!.conclusion.action, "ACT");
  assert.equal(replay.stoppingAssessment, "approximately_correct");
});

test("calibration report includes transparent Brier, buckets, stopping, information value, and utility", () => {
  const report = buildCalibrationReport(syntheticResolvedCases, new Date("2026-03-01T00:00:00.000Z"));
  assert.equal(report.caseCount, 9);
  assert.ok(report.stageCount >= 14);
  assert.ok(report.calibration.brierScore !== null && report.calibration.brierScore >= 0 && report.calibration.brierScore <= 1);
  assert.deepEqual(report.calibration.buckets.slice(1).map((bucket) => bucket.label), ["50–60%", "60–70%", "70–80%", "80–90%", "90%+"]);
  assert.ok(report.stopping.tooEarly >= 1);
  assert.ok(report.stopping.approximatelyCorrect >= 1);
  assert.ok(report.informationValue.wastedInformationRequests >= 1);
  assert.ok(report.informationValue.lowerRankedUnknownsThatMatteredMore >= 1);
  assert.ok(report.conclusionAccuracy !== null);
});

test("source observations remain keyed by source and domain", () => {
  const report = buildCalibrationReport(syntheticResolvedCases, new Date("2026-03-01T00:00:00.000Z"));
  assert.ok(report.sourcePerformance.every((observation) => observation.sourceId.length > 0 && observation.domain.length > 0));
  assert.ok(report.sourcePerformance.some((observation) => observation.domain === "self-reported claims" && observation.misleadingEvidenceCount > 0));
  assert.equal("trustScore" in report.sourcePerformance[0]!, false);
});

test("report generation is deterministic for fixed inputs and time", () => {
  const generatedAt = new Date("2026-03-01T00:00:00.000Z");
  assert.deepEqual(buildCalibrationReport(syntheticResolvedCases, generatedAt), buildCalibrationReport(syntheticResolvedCases, generatedAt));
});
