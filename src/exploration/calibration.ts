import type { RangeCardResult } from "./types.js";

export interface ResolvedRangeCardObservation {
  caseId: string;
  importantArcIds: readonly string[];
  originalFramingMissedArcIds: readonly string[];
  usefulArcIds: readonly string[];
  irrelevantNoiseArcIds: readonly string[];
  outperformingAlternativeArcId?: string;
  notes: readonly string[];
}

export interface RangeCardCalibrationObservation {
  caseId: string;
  importantFactorsSurfaced: number;
  originalFramingMissesSurfaced: number;
  usefulLateralArcs: number;
  irrelevantNoiseArcs: number;
  alternativePathOutperformedMain: boolean;
  unresolvedWeaknesses: readonly string[];
}

export function observeResolvedRangeCard(resultInput: RangeCardResult, resolvedInput: ResolvedRangeCardObservation): RangeCardCalibrationObservation {
  const result = structuredClone(resultInput);
  const resolved = structuredClone(resolvedInput);
  const known = new Set(result.acceptedArcIds);
  const referenced = [...resolved.importantArcIds, ...resolved.originalFramingMissedArcIds, ...resolved.usefulArcIds, ...resolved.irrelevantNoiseArcIds, ...(resolved.outperformingAlternativeArcId ? [resolved.outperformingAlternativeArcId] : [])];
  const unknown = referenced.filter((id) => !known.has(id));
  if (unknown.length) throw new TypeError(`Calibration observation references unknown arcs: ${[...new Set(unknown)].join(", ")}`);
  const outperforming = resolved.outperformingAlternativeArcId
    ? [result.rangeCard.leftArc, result.rangeCard.rightArc, ...result.rangeCard.interlockingArcs].find((arc) => arc.id === resolved.outperformingAlternativeArcId)
    : undefined;
  if (outperforming && outperforming.purpose !== "ALTERNATIVE_PATH_EXPLORATION") throw new TypeError("Only an alternative-path arc can outperform the main path.");
  return {
    caseId: resolved.caseId,
    importantFactorsSurfaced: new Set(resolved.importantArcIds).size,
    originalFramingMissesSurfaced: new Set(resolved.originalFramingMissedArcIds).size,
    usefulLateralArcs: new Set(resolved.usefulArcIds).size,
    irrelevantNoiseArcs: new Set(resolved.irrelevantNoiseArcIds).size,
    alternativePathOutperformedMain: Boolean(resolved.outperformingAlternativeArcId),
    unresolvedWeaknesses: ["Range-card observations are descriptive and do not tune engine weights or calibration formulas.", ...resolved.notes],
  };
}
