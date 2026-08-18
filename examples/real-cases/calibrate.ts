import { join } from "node:path";
import { calibrateRealCases } from "../../src/real-cases/calibrate.js";
import { loadRealCaseDirectory } from "../../src/real-cases/load.js";

const cases = await loadRealCaseDirectory(join(process.cwd(), "real-cases"));
const report = calibrateRealCases(cases);

console.log(JSON.stringify({
  datasetKind: report.datasetKind,
  totalLoadedCases: report.totalLoadedCases,
  resolvedCaseCount: report.resolvedCaseCount,
  unresolvedCasesExcluded: report.unresolvedCasesExcluded,
  metrics: {
    caseCount: report.calibration.caseCount,
    stageCount: report.calibration.stageCount,
    conclusionAccuracy: report.calibration.conclusionAccuracy,
    conclusionUtility: report.calibration.conclusionUtility,
    brierScore: report.calibration.calibration.brierScore,
    stopping: report.calibration.stopping,
    informationValue: report.calibration.informationValue,
  },
  unresolvedWeaknesses: report.calibration.unresolvedWeaknesses,
}, null, 2));
