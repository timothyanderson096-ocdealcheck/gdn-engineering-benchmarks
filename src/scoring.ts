import type { DecisionBudget, DecisionCase, Evidence, RankedUnknown, Score, Unknown } from "./domain.js";

export function clampScore(value: number): Score {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function evidenceStrength(evidence: Evidence): Score {
  return clampScore(
    evidence.relevance *
      (0.3 * evidence.reliability +
        0.25 * evidence.directness +
        0.2 * evidence.freshness +
        0.25 * evidence.independence),
  );
}

export function informationValue(unknown: Unknown): Score {
  const burden = 0.55 * clampScore(unknown.estimatedAcquisitionCost) + 0.45 * clampScore(unknown.estimatedTimeCost);
  return clampScore(unknown.expectedDecisionValue * (1 - 0.65 * burden));
}

export function rankUnknowns(unknowns: readonly Unknown[]): RankedUnknown[] {
  return unknowns
    .filter((unknown) => unknown.status === "open" || unknown.status === "acquiring")
    .map((unknown) => ({ ...unknown, informationValueScore: informationValue(unknown) }))
    .sort((a, b) => b.informationValueScore - a.informationValueScore || a.id.localeCompare(b.id));
}

export function calculateDecisionBudget(decisionCase: DecisionCase, uncertainty: Score): DecisionBudget {
  const stakes = { low: 0.15, medium: 0.35, high: 0.55 }[decisionCase.stakes];
  const reversibility = { easy: 0.05, moderate: 0.2, hard: 0.35 }[decisionCase.reversibility];
  const urgency = { immediate: -0.12, near_term: 0, flexible: 0.12 }[decisionCase.timeframe.urgency];
  const allowance = clampScore(0.15 + stakes + reversibility + 0.35 * uncertainty + urgency);
  const level = allowance >= 0.7 ? "extended" : allowance >= 0.4 ? "focused" : "minimal";
  return {
    level,
    investigationAllowance: allowance,
    rationale: [
      `${decisionCase.stakes} stakes`,
      `${decisionCase.reversibility} reversibility`,
      `${decisionCase.timeframe.urgency} timeframe`,
      `${Math.round(uncertainty * 100)}% current uncertainty`,
    ],
  };
}
