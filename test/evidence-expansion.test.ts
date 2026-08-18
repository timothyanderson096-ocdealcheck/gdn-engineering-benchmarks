import assert from "node:assert/strict";
import test from "node:test";
import { observeResolvedExpansion } from "../src/expansion/calibration.js";
import { stockAppOutputExpansionExample, vehicleListingExpansionExample } from "../src/expansion/examples.js";
import { createExpansionPlan } from "../src/expansion/plan.js";
import { presentExpansion } from "../src/expansion/presentation.js";
import { acquiredEvidence, initializeExpandedEvidenceField, reassessAfterExpansion } from "../src/expansion/reassess.js";
import { createStartingEvidenceField } from "../src/expansion/starting-field.js";
import type { EvidenceGap, ExpansionProbe, StartingEvidenceItem } from "../src/expansion/types.js";
import type { Evidence } from "../src/domain.js";
import { analyze } from "../src/engine.js";
import { createVolvoCase } from "../src/fixtures/volvo.js";
import { vehicleContextExample } from "../src/context/examples.js";

const now = new Date("2026-08-14T00:00:00.000Z");

function newEvidence(): Evidence {
  return { id: "transmission-record", statement: "Build record identifies the exact transmission variant.", sourceId: "build-record", provenance: "Manufacturer build record", timestamp: now.toISOString(), type: "record", relevance: 0.95, reliability: 0.95, directness: 1, freshness: 0.8, independence: 0.95, supports: ["too-risky"], contradicts: ["worth-pursuing"] };
}

function setupExpansion() {
  const previous = analyze(createVolvoCase(), { now: new Date("2026-08-13T00:00:00.000Z") });
  const example = vehicleListingExpansionExample();
  const startingEvidence = { ...example.startingEvidence, decisionCaseId: previous.decisionCase.id };
  const field = initializeExpandedEvidenceField(startingEvidence, example.gaps, example.plan);
  return { previous, example, field };
}

test("starting evidence remains unchanged after planning and expansion", () => {
  const { previous, example, field } = setupExpansion();
  const starting = structuredClone(field.startingEvidence);
  reassessAfterExpansion({ previous, plan: example.plan, field, acquiredEvidence: [acquiredEvidence(newEvidence(), "identify-transmission", now.toISOString())], resolvedGapIds: ["transmission-variant"], now });
  assert.deepEqual(field.startingEvidence, starting);
  assert.deepEqual(example.startingEvidence.items, starting.items);
});

test("APP_OUTPUT remains distinguishable from verified external evidence", () => {
  const item = stockAppOutputExpansionExample().startingEvidence.items[0]!;
  assert.equal(item.originType, "APP_OUTPUT");
  assert.equal(item.evidenceCharacter, "MEASURED");
  const invalid: StartingEvidenceItem = { ...item, evidenceCharacter: "EXTERNALLY_VERIFIED" };
  assert.throws(() => createStartingEvidenceField({ id: "invalid", decisionCaseId: "case", items: [invalid], createdAt: now.toISOString(), notes: [] }), /APP_OUTPUT/);
});

test("seller listing claims remain claims", () => {
  const item = vehicleListingExpansionExample().startingEvidence.items[0]!;
  assert.equal(item.originType, "LISTING");
  assert.equal(item.evidenceCharacter, "CLAIMED");
  assert.ok(item.description.includes("drives perfectly"));
});

test("probes cannot silently become evidence", () => {
  const { example, field } = setupExpansion();
  assert.equal(field.newlyAcquiredEvidence.length, 0);
  assert.equal(field.startingEvidence.items.some((item) => example.plan.prioritized.some((planned) => planned.probe.question === item.description)), false);
  assert.ok(example.plan.prioritized.every((planned) => planned.probe.resultEvidenceIds.length === 0));
});

test("low-materiality probes are rejected or deferred", () => {
  const example = stockAppOutputExpansionExample();
  const rejected = example.plan.rejected.find((probe) => probe.id === "social-sentiment");
  assert.ok(rejected);
  assert.equal(rejected.status, "REJECTED");

  const optionalGap: EvidenceGap = { id: "optional", missingInformation: "Optional detail", whyItMatters: "Minor refinement only", affectedConclusionOrHypothesisIds: [], resolvingEvidence: "A record", status: "OPTIONAL", expectedInformationValue: 0.1, rangeCardArcIds: [], notes: [] };
  const lowProbe: ExpansionProbe = { id: "low", question: "Check optional detail?", purpose: "OTHER", objectiveLink: "Minor timing refinement", triggeredByEvidenceIds: [], triggeredByUnknownIds: [], targetGapIds: ["optional"], rangeCardArcIds: [], expectedDecisionImpact: "Could make a minor timing adjustment.", expectedInformationValue: 0.1, outcomeDimensions: ["TIMING"], couldMateriallyChangeOutcome: true, searchScope: "One record", status: "PROPOSED", resultEvidenceIds: [], notes: [] };
  assert.equal(createExpansionPlan([lowProbe], [optionalGap], undefined, { optionalDeferBelow: 0.2 }).deferred[0]!.status, "DEFERRED");
});

test("the highest-value linked gap determines first probe priority", () => {
  const example = vehicleListingExpansionExample();
  assert.equal(example.gaps[0]!.id, "transmission-variant");
  assert.equal(example.plan.prioritized[0]!.probe.id, "identify-transmission");
  assert.equal(example.plan.prioritized[0]!.role, "HIGHEST_VALUE");
});

test("expansion adds actual evidence without rewriting prior evidence or history", () => {
  const { previous, example, field } = setupExpansion();
  const priorEvidence = structuredClone(previous.decisionCase.evidence);
  const priorHistory = structuredClone(previous.decisionCase.analysisHistory);
  const result = reassessAfterExpansion({ previous, plan: example.plan, field, acquiredEvidence: [acquiredEvidence(newEvidence(), "identify-transmission", now.toISOString())], resolvedGapIds: ["transmission-variant"], now });
  assert.deepEqual(previous.decisionCase.evidence, priorEvidence);
  assert.deepEqual(previous.decisionCase.analysisHistory, priorHistory);
  assert.equal(result.analysis.decisionCase.evidence.length, priorEvidence.length + 1);
  assert.deepEqual(result.analysis.decisionCase.analysisHistory.slice(0, priorHistory.length), priorHistory);
});

test("reassessment creates a new immutable snapshot and preserves previous conclusion", () => {
  const { previous, example, field } = setupExpansion();
  const priorConclusion = structuredClone(previous.conclusion);
  const result = reassessAfterExpansion({ previous, plan: example.plan, field, acquiredEvidence: [acquiredEvidence(newEvidence(), "identify-transmission", now.toISOString())], now });
  const record = result.expansion.field.reassessmentHistory[0]!;
  assert.deepEqual(record.previousConclusion, priorConclusion);
  assert.notEqual(record.previousSnapshotId, record.newSnapshotId);
  assert.deepEqual(previous.conclusion, priorConclusion);
});

test("Range Card links remain preserved from gap through prioritized probe", () => {
  const example = vehicleListingExpansionExample();
  const probe = example.plan.prioritized.find((item) => item.probe.id === "identify-transmission")!.probe;
  const gap = example.gaps.find((item) => item.id === "transmission-variant")!;
  assert.deepEqual(probe.rangeCardArcIds, ["model-failure-risk"]);
  assert.deepEqual(gap.rangeCardArcIds, ["model-failure-risk"]);
});

test("user context remains separate from acquired external evidence", () => {
  const context = vehicleContextExample().reassessment.userContext;
  const { previous, example, field } = setupExpansion();
  const result = reassessAfterExpansion({ previous, plan: example.plan, field, acquiredEvidence: [acquiredEvidence(newEvidence(), "identify-transmission", now.toISOString())], now });
  assert.equal(result.analysis.decisionCase.evidence.some((item) => item.statement.includes("user's reported repair capability")), false);
  assert.equal(context.localAdvantages[0]!.sourceOrigin, "USER_STATED");
});

test("reassessment uses unchanged engine scoring and confidence behavior", () => {
  const { previous, example, field } = setupExpansion();
  const evidence = newEvidence();
  const expanded = reassessAfterExpansion({ previous, plan: example.plan, field, acquiredEvidence: [acquiredEvidence(evidence, "identify-transmission", now.toISOString())], now });
  const direct = analyze({ ...previous.decisionCase, evidence: [...previous.decisionCase.evidence, evidence] }, { now });
  assert.deepEqual(expanded.analysis.snapshot.hypothesisWeights, direct.snapshot.hypothesisWeights);
  assert.equal(expanded.analysis.conclusion.confidence, direct.conclusion.confidence);
  assert.deepEqual(expanded.analysis.conclusion, direct.conclusion);
});

test("presentation separates condensed findings, balanced plan, and full audit chronology", () => {
  const { previous, example, field } = setupExpansion();
  const { expansion } = reassessAfterExpansion({ previous, plan: example.plan, field, acquiredEvidence: [acquiredEvidence(newEvidence(), "identify-transmission", now.toISOString())], now });
  const condensed = presentExpansion(expansion, "CONDENSED");
  const balanced = presentExpansion(expansion, "BALANCED");
  const audit = presentExpansion(expansion, "AUDIT");
  assert.equal(condensed.mode, "CONDENSED");
  assert.ok(condensed.mainRemainingGap);
  assert.equal(balanced.mode, "BALANCED");
  assert.equal(balanced.startingEvidenceSummary[0]!.evidenceCharacter, "CLAIMED");
  assert.equal(audit.mode, "AUDIT");
  assert.ok(audit.result.field.chronology.some((event) => event.eventType === "REASSESSMENT_COMPLETED"));
});

test("descriptive expansion calibration records probe quality and stopping", () => {
  const observation = observeResolvedExpansion({ caseId: "resolved-expansion", decisiveProbeIds: ["decisive"], usefulNonDecisiveProbeIds: ["useful"], noisyProbeIds: ["noise"], duplicateProbeIds: ["duplicate"], missedMaterialFactorIds: ["missed"], stoppingAssessment: "APPROPRIATE", startingEvidenceMisleading: true, expansionOverturnedInitialView: true, expansionCorrectlyStrengthenedInitialView: false, notes: [] });
  assert.equal(observation.decisiveProbes, 1);
  assert.equal(observation.noisyProbes, 1);
  assert.equal(observation.stoppingAssessment, "APPROPRIATE");
  assert.equal(observation.expansionEffect, "OVERTURNED");
});
