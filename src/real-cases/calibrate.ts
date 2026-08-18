import { buildCalibrationReport } from "../calibration/report.js";
import type { RealCaseCalibrationReport, RealResolvedCase } from "./types.js";
import { toCalibrationResolvedCase } from "./adapter.js";

export function calibrateRealCases(cases: readonly RealResolvedCase[], generatedAt = new Date()): RealCaseCalibrationReport {
  const input = structuredClone(cases);
  const resolved = input.filter((realCase) => realCase.resolutionStatus === "RESOLVED");
  const calibrationCases = resolved.map(toCalibrationResolvedCase);
  const base = buildCalibrationReport(calibrationCases, generatedAt);
  return {
    datasetKind: "genuine-real-cases",
    totalLoadedCases: input.length,
    resolvedCaseCount: resolved.length,
    unresolvedCasesExcluded: input.length - resolved.length,
    calibration: {
      ...base,
      unresolvedWeaknesses: [
        "Real-case metrics remain unreliable until enough independently reviewed cases exist.",
        "Historical timestamps marked approximate reduce chronology precision but are preferable to invented precision.",
        "The harness measures current weights but intentionally does not update them.",
      ],
    },
  };
}
