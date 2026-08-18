import { syntheticResolvedCases } from "../src/calibration/fixtures.js";
import { buildCalibrationReport } from "../src/calibration/report.js";

const report = buildCalibrationReport(syntheticResolvedCases, new Date("2026-03-01T00:00:00.000Z"));

console.log(JSON.stringify({
  generatedAt: report.generatedAt,
  caseCount: report.caseCount,
  stageCount: report.stageCount,
  conclusionAccuracy: report.conclusionAccuracy,
  conclusionUtility: report.conclusionUtility,
  calibration: report.calibration,
  stopping: report.stopping,
  informationValue: report.informationValue,
  usefulSignals: report.usefulSignals,
  misleadingSignals: report.misleadingSignals,
  sourcePerformance: report.sourcePerformance,
  unresolvedWeaknesses: report.unresolvedWeaknesses,
}, null, 2));
