import assert from "node:assert/strict";
import test from "node:test";
import { assessVerification } from "../src/verification.js";

test("a material confidence change resets the measured verdict-stability point", () => {
  const result = assessVerification({
    currentJudgement: "SUPPORTED",
    currentConfidence: 0.8,
    stakes: "low",
    probeBudget: 3,
    completedProbes: [
      { probeId: "p1", outcome: "supported", judgementAfter: "SUPPORTED", verdictChanged: false, confidenceMateriallyChanged: false, newDefectPatternIds: [], coveredTags: [] },
      { probeId: "p2", outcome: "confidence increased", judgementAfter: "SUPPORTED", verdictChanged: false, confidenceMateriallyChanged: true, newDefectPatternIds: [], coveredTags: [] },
      { probeId: "p3", outcome: "supported again", judgementAfter: "SUPPORTED", verdictChanged: false, confidenceMateriallyChanged: false, newDefectPatternIds: [], coveredTags: [] },
    ],
    remainingProbes: [],
    unresolvedMaterialUncertainties: [],
  });
  assert.equal(result.measurement.verdictStabilityPoint, 2);
  assert.equal(result.measurement.probesAfterStability, 1);
});
