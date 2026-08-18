import assert from "node:assert/strict";
import test from "node:test";
import { simulatedEngineeringSession } from "../src/orchestration/example.js";
import { presentOrchestration } from "../src/orchestration/presentation.js";
import { summarizeCapabilityObservations, updateCapabilityRegistry } from "../src/orchestration/registry.js";
import { routeModel } from "../src/orchestration/routing.js";
import { deriveEngineeringOutcome, judgeClaim } from "../src/orchestration/session.js";
import type { AgentRole, CapabilityProfile, CapabilityRegistry, OrchestrationSession } from "../src/orchestration/types.js";
import { analyze } from "../src/engine.js";
import { createVolvoCase } from "../src/fixtures/volvo.js";

const performance = (role: AgentRole, reliability: number, sampleSize: number) => ({ role, taskTags: ["typescript"], domainTags: ["engineering"], sampleSize, successfulObservations: Math.round(reliability * sampleSize), reliability, verificationPassRate: reliability, disagreementUsefulness: role === "ADVERSARIAL_REVIEWER" ? reliability : 0, repairSuccessRate: role === "REPAIRER" ? reliability : 0, averageLatencyMs: 1000, averageCostUnits: 2, confidenceInEstimate: Math.min(1, sampleSize / 10), failureModes: [], lastUpdated: "2026-08-13T00:00:00.000Z", notes: sampleSize < 3 ? ["Low sample size"] : [] });
function registry(): CapabilityRegistry {
  return { profiles: [
    { model: { modelId: "model-plan", providerAdapterId: "generic-a" }, supportedRoles: ["PLANNER"], taskCapabilities: [performance("PLANNER", 0.9, 8)], contextLimit: 32000, notes: [] },
    { model: { modelId: "model-adversarial_reviewer", providerAdapterId: "generic-b" }, supportedRoles: ["ADVERSARIAL_REVIEWER"], taskCapabilities: [performance("ADVERSARIAL_REVIEWER", 0.85, 6)], contextLimit: 32000, notes: [] },
    { model: { modelId: "model-low-sample", providerAdapterId: "generic-c" }, supportedRoles: ["PLANNER"], taskCapabilities: [performance("PLANNER", 1, 1)], contextLimit: 32000, notes: [] },
  ], observations: [] };
}

test("engineering roles remain distinct", () => {
  const roles = new Set(simulatedEngineeringSession().assignments.map((item) => item.role));
  for (const role of ["PLANNER", "BUILDER", "ADVERSARIAL_REVIEWER", "VERIFIER", "EVIDENCE_JUDGE"] as const) assert.ok(roles.has(role));
});

test("review disagreement is not evidence and remains after resolution", () => {
  const disagreement = simulatedEngineeringSession().disagreements[0]!;
  assert.equal(disagreement.claimB.supportingEvidenceIds.length, 0);
  assert.equal(disagreement.status, "RESOLVED_BY_TEST");
  assert.ok(disagreement.resolution);
});

test("consensus cannot verify while machine evidence can contradict it", () => {
  const session = simulatedEngineeringSession();
  const unverified = deriveEngineeringOutcome({ ...session, verificationResults: [], evidenceJudgments: [] }, "2026-08-13T01:00:00.000Z");
  assert.notEqual(unverified.status, "VERIFIED");
  assert.equal(session.evidenceJudgments[0]!.status, "CONTRADICTED");
  assert.ok(session.evidenceJudgments[0]!.verificationEvidenceIds.includes("evidence-transition-fail"));
});

test("failed verification triggers immutable repair history and passing re-verification", () => {
  const session = simulatedEngineeringSession();
  const original = structuredClone(session);
  assert.ok(session.verificationResults.some((item) => item.status === "FAILED"));
  assert.equal(session.repairIterations[0]!.outcome, "RESOLVED");
  assert.deepEqual(session.repairIterations[0]!.originalArtifactReferences, ["proposal-v1"]);
  assert.deepEqual(session.repairIterations[0]!.repairedArtifactReferences, ["proposal-v2"]);
  assert.equal(session.outcome.status, "VERIFIED");
  presentOrchestration(session, "AUDIT");
  assert.deepEqual(session, original);
});

test("capability registry is role/task-specific and has no universal score", () => {
  const data = registry();
  assert.equal(data.profiles[0]!.taskCapabilities[0]!.role, "PLANNER");
  assert.equal(data.profiles[1]!.taskCapabilities[0]!.role, "ADVERSARIAL_REVIEWER");
  assert.equal("universalScore" in data.profiles[0]!, false);
  assert.equal("bestModelScore" in data.profiles[0]!, false);
});

test("routing is deterministic, explained, and preserves low-sample uncertainty", () => {
  const constraints = { role: "PLANNER" as const, taskTags: ["typescript"], domainTags: ["engineering"], requiredContext: 8000, minimumSampleSize: 1 };
  const first = routeModel(registry(), constraints, "route-test");
  assert.deepEqual(first, routeModel(registry(), constraints, "route-test"));
  assert.equal(first.selectedModelId, "model-low-sample");
  assert.ok(first.uncertainty.some((item) => item.includes("limited")));
  const constrained = routeModel(registry(), { ...constraints, minimumSampleSize: 3 }, "route-minimum");
  assert.equal(constrained.selectedModelId, "model-plan");
  assert.ok(constrained.alternatives.find((item) => item.modelId === "model-low-sample")!.exclusions.includes("minimum evidence sample not met"));
});

test("observations update only their model and role statistics", () => {
  const observations = simulatedEngineeringSession().capabilityObservations.filter((item) => item.modelId === "model-adversarial_reviewer");
  const profile = registry().profiles[1]!;
  const updated = summarizeCapabilityObservations(profile, observations, "2026-08-14T00:00:00.000Z");
  assert.equal(updated.taskCapabilities[0]!.role, "ADVERSARIAL_REVIEWER");
  assert.equal(updated.taskCapabilities[0]!.sampleSize, 2);
  assert.equal(updated.taskCapabilities[0]!.disagreementUsefulness, 0.5);
  assert.equal(updateCapabilityRegistry(registry(), observations, "2026-08-14T00:00:00.000Z").observations.length, 2);
});

test("reusable lessons are model-neutral and evidence-backed", () => {
  const lesson = simulatedEngineeringSession().reusableLessons[0]!;
  assert.equal(lesson.modelNeutral, true);
  assert.equal(lesson.statement.includes("model-"), false);
  assert.equal("provider" in lesson, false);
  assert.ok(lesson.evidenceReferences.length > 0);
});

test("evidence judge returns insufficient evidence without verification", () => {
  assert.equal(judgeClaim({ judgmentId: "empty", iteration: 1, claimId: "claim", verificationResults: [], judgeRunId: "judge" }).status, "INSUFFICIENT_EVIDENCE");
});

test("presentation provides condensed, balanced, and audit detail", () => {
  const session = simulatedEngineeringSession();
  assert.equal(presentOrchestration(session, "CONDENSED").verificationStatus, "VERIFIED");
  assert.ok(presentOrchestration(session, "BALANCED").majorDisagreements.length > 0);
  assert.deepEqual(presentOrchestration(session, "AUDIT").session, session);
});

test("orchestration leaves Decision Dome scoring unchanged", () => {
  const before = analyze(createVolvoCase(), { now: new Date("2026-08-13T00:00:00.000Z") });
  simulatedEngineeringSession();
  updateCapabilityRegistry(registry(), [], "2026-08-14T00:00:00.000Z");
  const after = analyze(createVolvoCase(), { now: new Date("2026-08-13T00:00:00.000Z") });
  assert.deepEqual(after.snapshot.hypothesisWeights, before.snapshot.hypothesisWeights);
  assert.deepEqual(after.conclusion, before.conclusion);
});
