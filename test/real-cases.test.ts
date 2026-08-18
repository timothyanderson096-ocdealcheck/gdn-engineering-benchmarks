import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { syntheticResolvedCases } from "../src/calibration/fixtures.js";
import { replayResolvedCase } from "../src/calibration/replay.js";
import { calibrateRealCases } from "../src/real-cases/calibrate.js";
import { toCalibrationResolvedCase } from "../src/real-cases/adapter.js";
import { loadRealCaseDirectory } from "../src/real-cases/load.js";
import type { RealResolvedCase } from "../src/real-cases/types.js";
import { validateRealResolvedCase } from "../src/real-cases/validate.js";

const clone = <T>(value: T): T => structuredClone(value);

function minimalCase(): RealResolvedCase {
  return {
    schemaVersion: "decision-dome.real-case.v1", recordKind: "REAL_CASE", resolutionStatus: "RESOLVED",
    caseId: "validation-fixture", title: "Validation fixture", domain: "general", category: "test",
    originalQuestion: "Proceed?", desiredResult: "Reach a defensible result.",
    timeframe: { label: "Historical", urgency: "near_term" }, stakes: "low", reversibility: "easy",
    caseSource: { sourceId: "source", sourceType: "other", sourceName: "Source", accessedAt: { value: "2025-01-01T00:00:00.000Z", approximate: false }, domain: "test", provenance: "Archived source", roleInDecision: "Created case" },
    verificationSources: [{ sourceId: "check", sourceType: "official_record", sourceName: "Check", accessedAt: { value: "2025-01-02T00:00:00.000Z", approximate: false }, domain: "test", provenance: "Archived check", roleInDecision: "Verified case" }],
    decisionStartTime: { value: "2025-01-01T00:00:00.000Z", approximate: false }, resolutionTime: { value: "2025-01-03T00:00:00.000Z", approximate: false },
    initialState: {
      hypotheses: [
        { id: "go", statement: "Proceed.", kind: "mainstream", priorWeight: 0.6, currentWeight: 0.6, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "ACT" },
        { id: "stop", statement: "Stop.", kind: "alternative", priorWeight: 0.25, currentWeight: 0.25, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "ABORT" },
        { id: "wild", statement: "Change path.", kind: "wildcard", priorWeight: 0.15, currentWeight: 0.15, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "CHANGE_PATH" },
      ],
      unknowns: [{ id: "check-result", question: "What does the check show?", expectedDecisionValue: 0.9, estimatedAcquisitionCost: 0.1, estimatedTimeCost: 0.1, status: "open" }],
    },
    chronologicalStages: [{ stageId: "stage-1", timestamp: { value: "2025-01-02T00:00:00.000Z", approximate: false }, newlyAvailableEvidence: [{ evidenceId: "result", statement: "Check supports proceeding.", sourceId: "check", acquiredAt: { value: "2025-01-02T00:00:00.000Z", approximate: false }, provenanceType: "primary_record", provenance: "Archived record", evidenceType: "record", relevance: 1, reliability: 1, directness: 1, freshness: 1, independence: 1, supports: ["go"], contradicts: ["stop"] }], sourceReferences: ["check"], newlyResolvedUnknowns: ["check-result"] }],
    actualOutcome: { status: "other", description: "Proceeding achieved the desired result.", correctHypothesisId: "go", successfulActions: ["ACT"], earliestSufficientStage: 1 }, desiredResultAchieved: true,
    outcomeNotes: [], usefulSignals: ["result"], misleadingSignals: [], relevantUnknowns: ["check-result"], postOutcomeInformation: [],
    provenance: { authorStatement: "Test fixture.", archiveReferences: [] }, metadata: { authoredAt: "2025-02-01T00:00:00.000Z", author: "test", reviewStatus: "DRAFT" },
  };
}

test("valid genuine cases validate", () => assert.equal(validateRealResolvedCase(minimalCase()).valid, true));

test("invalid chronology and post-resolution evidence are rejected", () => {
  const invalid = clone(minimalCase());
  invalid.chronologicalStages[0]!.newlyAvailableEvidence[0]!.acquiredAt.value = "2025-01-04T00:00:00.000Z";
  const errors = validateRealResolvedCase(invalid).errors;
  assert.ok(errors.some((error) => error.includes("after its stage timestamp")));
  assert.ok(errors.some((error) => error.includes("after resolution")));
});

test("missing and duplicate source/evidence references are rejected", () => {
  const missing = clone(minimalCase());
  missing.chronologicalStages[0]!.newlyAvailableEvidence[0]!.sourceId = "missing";
  assert.ok(validateRealResolvedCase(missing).errors.some((error) => error.includes("unknown source")));
  const duplicate = clone(minimalCase());
  duplicate.verificationSources[0]!.sourceId = "source";
  duplicate.chronologicalStages[0]!.newlyAvailableEvidence.push(clone(duplicate.chronologicalStages[0]!.newlyAvailableEvidence[0]!));
  const errors = validateRealResolvedCase(duplicate).errors;
  assert.ok(errors.some((error) => error.includes("Duplicate source ID")));
  assert.ok(errors.some((error) => error.includes("Duplicate evidence ID")));
});

test("unresolved and zero-case datasets remain supported", () => {
  const unresolved = clone(minimalCase());
  unresolved.resolutionStatus = "UNRESOLVED"; delete unresolved.resolutionTime;
  unresolved.actualOutcome = { status: "unresolved_insufficient", description: "Insufficient outcome." }; unresolved.desiredResultAchieved = null;
  assert.equal(validateRealResolvedCase(unresolved).valid, true);
  const mixed = calibrateRealCases([minimalCase(), unresolved], new Date("2026-08-13T00:00:00.000Z"));
  assert.equal(mixed.resolvedCaseCount, 1); assert.equal(mixed.unresolvedCasesExcluded, 1);
  assert.equal(calibrateRealCases([], new Date("2026-08-13T00:00:00.000Z")).calibration.caseCount, 0);
});

test("the genuine directory contains exactly Case #001", async () => {
  const cases = await loadRealCaseDirectory(join(process.cwd(), "real-cases"));
  assert.deepEqual(cases.map((item) => item.caseId), ["real-001-gopro-hero8-hero10-bundle"]);
});

test("real replay is deterministic, outcome-isolated, and leaves synthetic fixtures unchanged", () => {
  const before = clone(syntheticResolvedCases);
  const adapted = toCalibrationResolvedCase(minimalCase());
  const first = replayResolvedCase(adapted); const second = replayResolvedCase(adapted);
  assert.deepEqual(first.finalDecisionCase.analysisHistory, second.finalDecisionCase.analysisHistory);
  assert.deepEqual(first.finalDecisionCase.outcomes, []);
  assert.deepEqual(syntheticResolvedCases, before);
});
