import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PRESENTATION_SCHEMA_VERSION } from "../src/contracts/types.js";
import { serializeDecisionPresentation } from "../src/contracts/serialize.js";
import { validatePresentationContract } from "../src/contracts/validate.js";
import { analyze } from "../src/engine.js";
import { createVolvoCase } from "../src/fixtures/volvo.js";
import { buildAuditData } from "../src/presentation/present.js";

const now = new Date("2026-08-13T10:00:00.000Z");
const makeCase = () => analyze(createVolvoCase(), { now }).decisionCase;
const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

for (const mode of ["CONDENSED", "BALANCED", "AUDIT"] as const) {
  test(`${mode} serializes, validates, and survives a JSON round trip`, () => {
    const payload = serializeDecisionPresentation(makeCase(), mode);
    assert.equal(payload.schemaVersion, PRESENTATION_SCHEMA_VERSION);
    assert.equal(validatePresentationContract(payload).valid, true);
    assert.deepEqual(roundTrip(payload), payload);
  });
}

test("CONDENSED cannot include audit-only data", () => {
  const payload = serializeDecisionPresentation(makeCase(), "CONDENSED");
  assert.deepEqual(Object.keys(payload), ["schemaVersion", "mode", "conclusion", "confidence", "mainReason", "mainRiskOrUncertainty", "nextActionOrTrigger", "availableExpansions"]);
  const invalid = { ...payload, evidence: [] };
  assert.equal(validatePresentationContract(invalid).valid, false);
});

test("BALANCED exposes more than CONDENSED and less than AUDIT", () => {
  const decisionCase = makeCase();
  const condensed = serializeDecisionPresentation(decisionCase, "CONDENSED");
  const balanced = serializeDecisionPresentation(decisionCase, "BALANCED");
  const audit = serializeDecisionPresentation(decisionCase, "AUDIT");
  assert.ok(Object.keys(balanced).length > Object.keys(condensed).length);
  assert.ok(Object.keys(audit).length > Object.keys(balanced).length);
  assert.ok("strongestEvidenceDrivers" in balanced);
  assert.equal("evidence" in balanced, false);
  assert.ok("evidence" in audit);
});

test("AUDIT preserves the complete available audit representation", () => {
  const decisionCase = makeCase();
  const payload = serializeDecisionPresentation(decisionCase, "AUDIT");
  const expected = roundTrip(buildAuditData(decisionCase));
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(payload[key], value, `Mismatch at audit field ${key}`);
  assert.equal(payload.evidence.length, decisionCase.evidence.length);
  assert.equal(payload.analysisSnapshots.length, decisionCase.analysisHistory.length);
});

test("invalid payloads fail runtime validation", () => {
  assert.equal(validatePresentationContract({ mode: "CONDENSED" }).valid, false);
  const payload = serializeDecisionPresentation(makeCase(), "BALANCED");
  assert.equal(validatePresentationContract({ ...payload, confidence: 2 }).valid, false);
  assert.equal(validatePresentationContract({ ...payload, schemaVersion: "decision-dome.presentation.v2" }).valid, false);
  assert.equal(validatePresentationContract({ ...payload, strongestEvidenceDrivers: [{ id: "missing-traceability" }] }).valid, false);
});

test("changing presentation mode does not change conclusion or confidence", () => {
  const decisionCase = makeCase();
  const payloads = ["CONDENSED", "BALANCED", "AUDIT"].map((mode) => serializeDecisionPresentation(decisionCase, mode as "CONDENSED" | "BALANCED" | "AUDIT"));
  assert.ok(payloads.every((payload) => payload.conclusion.action === decisionCase.latestConclusion!.action));
  assert.ok(payloads.every((payload) => payload.conclusion.statement === decisionCase.latestConclusion!.statement));
  assert.equal(payloads[0]!.confidence, decisionCase.latestConclusion!.confidence);
  assert.equal(payloads[1]!.confidence, decisionCase.latestConclusion!.confidence);
  assert.equal(payloads[2]!.conclusion.confidence, decisionCase.latestConclusion!.confidence);
});

test("serialization does not mutate the backend Decision Case", () => {
  const decisionCase = makeCase();
  const original = structuredClone(decisionCase);
  serializeDecisionPresentation(decisionCase, "CONDENSED");
  serializeDecisionPresentation(decisionCase, "BALANCED");
  serializeDecisionPresentation(decisionCase, "AUDIT");
  assert.deepEqual(decisionCase, original);
});

test("fixture files match deterministic serialization", async () => {
  const decisionCase = makeCase();
  for (const mode of ["CONDENSED", "BALANCED", "AUDIT"] as const) {
    const fixture = JSON.parse(await readFile(join(process.cwd(), "examples", "contracts", `volvo.${mode.toLowerCase()}.json`), "utf8"));
    assert.deepEqual(fixture, serializeDecisionPresentation(decisionCase, mode));
  }
});
