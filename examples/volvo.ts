import { analyze } from "../src/engine.js";
import { createVolvoCase } from "../src/fixtures/volvo.js";

const result = analyze(createVolvoCase(), { now: new Date("2026-08-13T10:00:00.000Z") });

console.log(JSON.stringify({
  question: result.decisionCase.question,
  desiredResult: result.decisionCase.desiredResult,
  timeframe: result.decisionCase.timeframe.label,
  latestLatticeAnalysis: {
    leadingHypothesis: result.snapshot.leadingHypothesisId,
    hypothesisWeights: result.snapshot.hypothesisWeights,
    uncertainty: result.snapshot.uncertainty,
    highestValueUnknowns: result.snapshot.highestValueUnknowns.slice(0, 3).map((unknown) => ({
      question: unknown.question,
      informationValueScore: unknown.informationValueScore,
    })),
  },
  conclusion: result.conclusion,
}, null, 2));
