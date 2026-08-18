import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { createDecisionCase } from "../src/case.js";
import { observeConditionalCommitmentCandidates } from "../src/calibration/conditional.js";
import { replayResolvedCase } from "../src/calibration/replay.js";
import { analyzeWithConditions } from "../src/conditional-commitment.js";
import { serializeConditionalDecisionPresentation } from "../src/contracts/conditional.js";
import { validatePresentationContract } from "../src/contracts/validate.js";
import type { ConditionalAnalysisResult, DecisionCase, DecisionCondition, Evidence, Hypothesis } from "../src/domain.js";
import { analyze } from "../src/engine.js";
import { presentConditionalDecision } from "../src/presentation/conditional.js";
import { toCalibrationResolvedCase } from "../src/real-cases/adapter.js";
import { loadConditionalCommitmentPlan } from "../src/real-cases/conditional-commitment.js";
import { loadRealCaseDirectory } from "../src/real-cases/load.js";

const now = new Date("2026-08-13T10:00:00.000Z");
const condition: DecisionCondition = {
  id: "inspection-required",
  statement: "Pass an independent inspection before payment.",
  timing: "BEFORE_COMMITMENT",
  status: "REQUIRED",
  protectsAgainst: "An undisclosed defect.",
  addressesUnknownIds: ["condition-risk"],
  sourceEvidenceIds: ["support-1"],
};
const hypotheses: Hypothesis[] = [
  { id: "go", statement: "the option is worthwhile", kind: "mainstream", priorWeight: 0.75, currentWeight: 0.75, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "ACT" },
  { id: "stop", statement: "the option is not worthwhile", kind: "alternative", priorWeight: 0.2, currentWeight: 0.2, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "ABORT" },
  { id: "wild", statement: "an overlooked factor dominates", kind: "wildcard", priorWeight: 0.05, currentWeight: 0.05, assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "WAIT" },
];
const evidence: Evidence[] = [1, 2, 3, 4].map((number) => ({
  id: `support-${number}`, statement: `Independent support ${number}.`, sourceId: "inspection", provenance: "Test fixture", timestamp: now.toISOString(), type: "measurement", relevance: 1, reliability: 1, directness: 1, freshness: 1, independence: 1, supports: ["go"], contradicts: [],
}));

function conditionalCase(): DecisionCase {
  return createDecisionCase({
    id: "conditional-case", question: "Proceed?", desiredResult: "Proceed with bounded downside.", timeframe: { label: "Soon", urgency: "near_term" }, stakes: "low", reversibility: "easy", sources: [], evidence, hunches: [], hypotheses, connections: [],
    unknowns: [{ id: "condition-risk", question: "Is there an undisclosed defect?", expectedDecisionValue: 0.5, estimatedAcquisitionCost: 0.5, estimatedTimeCost: 0.5, status: "open" }],
    conditions: [condition], predictions: [],
  });
}

function conditionalResult(): ConditionalAnalysisResult {
  const result = analyzeWithConditions(conditionalCase(), { now });
  assert.equal(result.conclusion.action, "ACT_WITH_CONDITIONS");
  return result as ConditionalAnalysisResult;
}

test("ACT_WITH_CONDITIONS preserves uncertainty and unchanged confidence", () => {
  const source = conditionalCase();
  const ordinary = analyze(source, { now });
  const conditional = conditionalResult();
  assert.equal(ordinary.conclusion.action, "ACT");
  assert.equal(conditional.conclusion.confidence, ordinary.conclusion.confidence);
  assert.ok(conditional.conclusion.confidence < 1);
  assert.equal(conditional.conclusion.majorUncertainty, ordinary.conclusion.majorUncertainty);
  assert.deepEqual(conditional.conclusion.conditions, [condition]);
});

test("the required condition remains structured and visible in every presentation mode", () => {
  const decisionCase = conditionalResult().decisionCase;
  for (const mode of ["CONDENSED", "BALANCED", "AUDIT"] as const) {
    const result = presentConditionalDecision(decisionCase, mode);
    assert.equal(result.view.conclusion.action, "ACT_WITH_CONDITIONS");
    assert.deepEqual(result.view.conclusion.conditions, [condition]);
    assert.ok(result.view.conclusion.statement.includes(condition.statement));
    const payload = serializeConditionalDecisionPresentation(decisionCase, mode);
    assert.equal(validatePresentationContract(payload).valid, true);
    assert.deepEqual(payload.conclusion.conditions, [condition]);
  }
});

test("conditional presentation and decoration preserve historical snapshots and inputs", () => {
  const source = conditionalCase();
  const original = structuredClone(source);
  const result = conditionalResult();
  const history = structuredClone(result.decisionCase.analysisHistory);
  presentConditionalDecision(result.decisionCase, "CONDENSED");
  presentConditionalDecision(result.decisionCase, "BALANCED");
  presentConditionalDecision(result.decisionCase, "AUDIT");
  assert.deepEqual(source, original);
  assert.deepEqual(result.decisionCase.analysisHistory, history);
});

test("Case #001 is reported as a conditional-commitment candidate without changing replay math", async () => {
  const cases = await loadRealCaseDirectory(join(process.cwd(), "real-cases"));
  const realCase = cases.find((item) => item.caseId === "real-001-gopro-hero8-hero10-bundle");
  assert.ok(realCase);
  const replay = replayResolvedCase(toCalibrationResolvedCase(realCase));
  const replayBefore = structuredClone(replay);
  const plan = await loadConditionalCommitmentPlan(join(process.cwd(), "real-cases", "conditions", `${realCase.caseId}.json`));
  const observation = observeConditionalCommitmentCandidates(replay, plan.conditionsByStage);
  assert.ok(observation.candidateStages.some((stage) => stage.stageId === "stage-4-seller-acceptance"));
  assert.deepEqual(replay, replayBefore);
});
