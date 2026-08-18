import type { DecisionCase } from "./domain.js";

export function createDecisionCase(input: Omit<DecisionCase, "analysisHistory" | "latestConclusion" | "outcomes" | "lessons">): DecisionCase {
  return {
    ...structuredClone(input),
    analysisHistory: [],
    outcomes: [],
    lessons: [],
  };
}
