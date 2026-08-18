import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { syntheticResolvedCases } from "../src/calibration/fixtures.js";
import { replayResolvedCase } from "../src/calibration/replay.js";
import { calibrateRealCases } from "../src/real-cases/calibrate.js";
import { toCalibrationResolvedCase } from "../src/real-cases/adapter.js";
import { loadRealCaseDirectory } from "../src/real-cases/load.js";
import { validateRealResolvedCase } from "../src/real-cases/validate.js";
import { validateRealCaseWithValueComponents, type RealResolvedCaseWithValueComponents } from "../src/real-cases/value-components.js";

async function case001(): Promise<RealResolvedCaseWithValueComponents> {
  const cases = await loadRealCaseDirectory(join(process.cwd(), "real-cases"));
  const realCase = cases.find((item) => item.caseId === "real-001-gopro-hero8-hero10-bundle");
  assert.ok(realCase, "Case #001 must load from the genuine dataset");
  return realCase as RealResolvedCaseWithValueComponents;
}

test("Case #001 validates and is the only genuine resolved case", async () => {
  const realCase = await case001();
  assert.equal(validateRealResolvedCase(realCase).valid, true);
  assert.equal(validateRealCaseWithValueComponents(realCase).valid, true);
  const report = calibrateRealCases([realCase], new Date("2026-08-13T00:00:00.000Z"));
  assert.equal(report.totalLoadedCases, 1);
  assert.equal(report.resolvedCaseCount, 1);
  assert.equal(report.calibration.caseCount, 1);
});

test("Case #001 preserves exact known price arithmetic", async () => {
  const components = (await case001()).valueComponents;
  assert.equal(components.find((item) => item.id === "combined-list-price")?.monetaryValue?.amount, 498);
  assert.equal(components.find((item) => item.id === "completed-price")?.monetaryValue?.amount, 400);
  assert.equal(components.find((item) => item.id === "nominal-reduction")?.monetaryValue?.amount, 98);
  assert.equal(498 - 400, 98);
});

test("Case #001 preserves accessories without fabricated monetary values", async () => {
  const components = (await case001()).valueComponents;
  for (const id of ["tripod", "three-batteries", "charging-dock"]) {
    const component = components.find((item) => item.id === id);
    assert.ok(component);
    assert.equal(component.valueType, "UTILITY");
    assert.equal(component.monetaryValue, undefined);
    assert.equal(component.monetaryValueStatus, "UNKNOWN");
  }
});

test("risk-reduction and transaction value remain distinct from price reduction", async () => {
  const components = (await case001()).valueComponents;
  assert.equal(components.find((item) => item.id === "warranty")?.valueType, "RISK_REDUCTION");
  assert.equal(components.find((item) => item.id === "working-demo-condition")?.valueType, "RISK_REDUCTION");
  assert.equal(components.find((item) => item.id === "single-bundle-transaction")?.valueType, "TRANSACTION");
  assert.equal(components.find((item) => item.id === "nominal-reduction")?.valueType, "FINANCIAL");
});

test("final purchase truth does not contaminate earlier replay stages", async () => {
  const realCase = await case001();
  const adapted = toCalibrationResolvedCase(realCase);
  const first = JSON.stringify(adapted.stages[0]);
  const offer = JSON.stringify(adapted.stages[2]);
  const preResolutionEvidence = adapted.stages.slice(0, 4).flatMap((stage) => stage.evidence);
  assert.equal(first.includes("HERO10"), false);
  assert.equal(first.includes("$400"), false);
  assert.equal(offer.includes("accepted"), false);
  assert.equal(preResolutionEvidence.some((item) => item.statement.includes("actually paid")), false);
  assert.equal(preResolutionEvidence.some((item) => item.statement.includes("three batteries") || item.statement.includes("charging dock")), false);
  assert.equal(adapted.stages[4]!.evidence.length, 0);
});

test("final bundle contents remain available in resolution data", async () => {
  const realCase = await case001();
  assert.equal(realCase.actualOutcome.status, "purchased");
  assert.ok(realCase.actualOutcome.description.includes("GoPro HERO8"));
  assert.ok(realCase.actualOutcome.description.includes("GoPro HERO10"));
  assert.ok(realCase.actualOutcome.description.includes("tripod"));
  assert.ok(realCase.actualOutcome.description.includes("three HERO8-associated batteries"));
  assert.ok(realCase.actualOutcome.description.includes("charging dock"));
  assert.ok(realCase.actualOutcome.description.includes("3-month warranty"));
});

test("Case #001 replay is deterministic and leaves synthetic calibration unchanged", async () => {
  const syntheticBefore = structuredClone(syntheticResolvedCases);
  const adapted = toCalibrationResolvedCase(await case001());
  const first = replayResolvedCase(adapted);
  const second = replayResolvedCase(adapted);
  assert.deepEqual(first.finalDecisionCase.analysisHistory, second.finalDecisionCase.analysisHistory);
  assert.deepEqual(first.stages.map((stage) => stage.conclusion), second.stages.map((stage) => stage.conclusion));
  assert.deepEqual(syntheticResolvedCases, syntheticBefore);
});
