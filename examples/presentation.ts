import { analyze } from "../src/engine.js";
import { createVolvoCase } from "../src/fixtures/volvo.js";
import { presentDecision } from "../src/presentation/present.js";

const decisionCase = analyze(createVolvoCase(), { now: new Date("2026-08-13T10:00:00.000Z") }).decisionCase;

for (const preference of ["CONDENSED", "BALANCED", "AUDIT"] as const) {
  const result = presentDecision(decisionCase, preference);
  console.log(`\n${preference}`);
  console.log(JSON.stringify({
    selectedMode: result.selectedMode,
    expandableSections: result.expandableSections,
    view: result.view,
  }, null, 2));
}
