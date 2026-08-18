import type {
  AnalysisOptions,
  AnalysisResult,
  AnalysisSnapshot,
  Conclusion,
  ConclusionAction,
  DecisionCase,
  Evidence,
  Hypothesis,
  Lesson,
  Outcome,
  Score,
} from "./domain.js";
import { calculateDecisionBudget, clampScore, evidenceStrength, rankUnknowns } from "./scoring.js";

const clone = <T>(value: T): T => structuredClone(value);

function validateScore(label: string, score: number): void {
  if (!Number.isFinite(score) || score < 0 || score > 1) throw new RangeError(`${label} must be between 0 and 1.`);
}

function validateCase(decisionCase: DecisionCase): void {
  if (decisionCase.hypotheses.length < 2) throw new Error("At least two competing hypotheses are required.");
  for (const hypothesis of decisionCase.hypotheses) validateScore(`Hypothesis ${hypothesis.id} priorWeight`, hypothesis.priorWeight);
  for (const evidence of decisionCase.evidence) {
    for (const key of ["relevance", "reliability", "directness", "freshness", "independence"] as const) {
      validateScore(`Evidence ${evidence.id} ${key}`, evidence[key]);
    }
  }
}

function scoreHypotheses(hypotheses: readonly Hypothesis[], evidence: readonly Evidence[]): Hypothesis[] {
  const raw = hypotheses.map((hypothesis) => {
    let score = Math.max(0.01, hypothesis.priorWeight);
    for (const item of evidence) {
      const strength = evidenceStrength(item);
      if (item.supports.includes(hypothesis.id)) score += 0.8 * strength;
      if (item.contradicts.includes(hypothesis.id)) score -= 0.95 * strength;
    }
    return Math.max(0.01, score);
  });
  const total = raw.reduce((sum, value) => sum + value, 0);
  const initial = hypotheses.map((hypothesis, index) => ({ ...hypothesis, currentWeight: (raw[index] ?? 0.01) / total }));
  const lead = Math.max(...initial.map((hypothesis) => hypothesis.currentWeight));
  const uncertainty = clampScore(1 - lead);

  // A wildcard floor preserves exploration while uncertainty remains material.
  if (uncertainty >= 0.35) {
    const floored = initial.map((hypothesis) =>
      hypothesis.kind === "wildcard" ? { ...hypothesis, currentWeight: Math.max(0.05, hypothesis.currentWeight) } : hypothesis,
    );
    const adjustedTotal = floored.reduce((sum, hypothesis) => sum + hypothesis.currentWeight, 0);
    return floored.map((hypothesis) => ({ ...hypothesis, currentWeight: hypothesis.currentWeight / adjustedTotal }));
  }
  return initial;
}

function conclusionStatement(action: ConclusionAction, leading: Hypothesis, nextInformation?: string): string {
  switch (action) {
    case "ACT": return `Proceed on the basis that ${leading.statement}`;
    case "ABORT": return `Stop this path on the basis that ${leading.statement}`;
    case "CHANGE_PATH": return `Change course on the basis that ${leading.statement}`;
    case "ACQUIRE_INFORMATION": return `Acquire ${nextInformation ?? "the highest-value missing information"} before committing.`;
    case "WAIT": return "Wait for stronger evidence or a material change before committing.";
  }
}

function makeConclusion(args: {
  decisionCase: DecisionCase;
  hypotheses: readonly Hypothesis[];
  snapshot: AnalysisSnapshot;
  priorInvestigationYield: Score;
  waitingCost: Score;
}): Conclusion {
  const { decisionCase, hypotheses, snapshot, priorInvestigationYield, waitingCost } = args;
  const leading = hypotheses.find((hypothesis) => hypothesis.id === snapshot.leadingHypothesisId)!;
  const topUnknown = snapshot.highestValueUnknowns[0];
  const budget = calculateDecisionBudget(decisionCase, snapshot.uncertainty);
  const evidenceCount = decisionCase.evidence.length;
  const stakesThreshold = { low: 0.55, medium: 0.68, high: 0.82 }[decisionCase.stakes];
  const confidence = Math.min(0.99, clampScore(leading.currentWeight * (0.75 + Math.min(0.2, evidenceCount * 0.04))));
  const deadlineReached = decisionCase.timeframe.deadline
    ? Date.parse(snapshot.timestamp) >= Date.parse(decisionCase.timeframe.deadline)
    : false;
  const acquireThreshold = decisionCase.stakes === "low" ? 0.62 : 0.48;

  let action: ConclusionAction;
  if (topUnknown && topUnknown.informationValueScore >= acquireThreshold && budget.investigationAllowance >= 0.35) {
    action = "ACQUIRE_INFORMATION";
  } else if (confidence >= stakesThreshold && evidenceCount > 0) {
    action = leading.actionOnLead;
  } else if (deadlineReached && waitingCost >= 0.65) {
    action = leading.actionOnLead;
  } else if (priorInvestigationYield <= 0.2 && waitingCost >= 0.65 && confidence >= stakesThreshold - 0.08) {
    action = leading.actionOnLead;
  } else {
    action = "WAIT";
  }

  const majorUncertainty = topUnknown?.question ?? `Residual uncertainty between ${hypotheses.length} competing hypotheses.`;
  const specificNextInformation = action === "ACQUIRE_INFORMATION" ? topUnknown?.question : undefined;
  return {
    action,
    statement: conclusionStatement(action, leading, specificNextInformation),
    confidence,
    strongestBasis: snapshot.strongestEvidenceIds,
    majorUncertainty,
    ...(specificNextInformation ? { specificNextInformation } : {}),
    reassessmentTriggers: [
      ...snapshot.highestValueUnknowns.slice(0, 3).map((unknown) => `Resolution of: ${unknown.question}`),
      "Material evidence that contradicts the leading hypothesis",
    ],
    ...(action === "WAIT" && decisionCase.timeframe.deadline ? { reviewAt: decisionCase.timeframe.deadline } : {}),
  };
}

export function analyze(decisionCaseInput: DecisionCase, options: AnalysisOptions = {}): AnalysisResult {
  const decisionCase = clone(decisionCaseInput);
  validateCase(decisionCase);
  const now = options.now ?? new Date();
  const hypotheses = scoreHypotheses(decisionCase.hypotheses, decisionCase.evidence);
  const leading = [...hypotheses].sort((a, b) => b.currentWeight - a.currentWeight)[0]!;
  const uncertainty = clampScore(1 - leading.currentWeight);
  const rankedUnknowns = rankUnknowns(decisionCase.unknowns);
  const strongestEvidenceIds = [...decisionCase.evidence]
    .sort((a, b) => evidenceStrength(b) - evidenceStrength(a))
    .slice(0, 5)
    .map((evidence) => evidence.id);
  const contradictions = decisionCase.evidence
    .filter((evidence) => evidence.contradicts.length > 0)
    .map((evidence) => evidence.id);
  const snapshot: AnalysisSnapshot = {
    id: `analysis-${decisionCase.analysisHistory.length + 1}`,
    timestamp: now.toISOString(),
    hypothesisWeights: Object.fromEntries(hypotheses.map((hypothesis) => [hypothesis.id, hypothesis.currentWeight])),
    leadingHypothesisId: leading.id,
    strongestEvidenceIds,
    contradictions,
    highestValueUnknowns: rankedUnknowns.slice(0, 5),
    uncertainty,
    notes: ["Weights are transparent comparative aids, not calibrated scientific probabilities."],
  };
  const conclusion = makeConclusion({
    decisionCase,
    hypotheses,
    snapshot,
    priorInvestigationYield: clampScore(options.priorInvestigationYield ?? 0.5),
    waitingCost: clampScore(options.waitingCost ?? 0.3),
  });
  const nextCase: DecisionCase = {
    ...decisionCase,
    hypotheses,
    analysisHistory: [...decisionCase.analysisHistory, clone(snapshot)],
    latestConclusion: clone(conclusion),
  };
  return { decisionCase: nextCase, snapshot, conclusion, budget: calculateDecisionBudget(nextCase, uncertainty) };
}

export function addEvidence(decisionCase: DecisionCase, evidence: Evidence, options: AnalysisOptions = {}): AnalysisResult {
  if (decisionCase.evidence.some((item) => item.id === evidence.id)) throw new Error(`Evidence ID already exists: ${evidence.id}`);
  return analyze({ ...clone(decisionCase), evidence: [...clone(decisionCase.evidence), clone(evidence)] }, options);
}

export function recordOutcome(decisionCase: DecisionCase, outcome: Outcome, lessons: readonly Lesson[]): DecisionCase {
  const next = clone(decisionCase);
  return {
    ...next,
    outcomes: [...next.outcomes, clone(outcome)],
    lessons: [...next.lessons, ...clone(lessons)],
  };
}
