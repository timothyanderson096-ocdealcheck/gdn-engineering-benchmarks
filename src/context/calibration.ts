export interface ResolvedContextObservation {
  caseId: string;
  contextMateriallyImprovedDecision: boolean;
  incorrectOrMisleadingContextFactorIds: readonly string[];
  overestimatedAdvantageFactorIds: readonly string[];
  measurementFirstReducedInterpretiveError: boolean;
  loadedLabelWouldHaveMisled: boolean;
  notes: readonly string[];
}

export interface ContextCalibrationObservation {
  caseId: string;
  contextImprovedDecision: boolean;
  misleadingContextCount: number;
  overestimatedAdvantageCount: number;
  measurementFirstHelped: boolean;
  loadedLabelRiskObserved: boolean;
  unresolvedWeaknesses: readonly string[];
}

export function observeResolvedContext(input: ResolvedContextObservation): ContextCalibrationObservation {
  const observation = structuredClone(input);
  return {
    caseId: observation.caseId,
    contextImprovedDecision: observation.contextMateriallyImprovedDecision,
    misleadingContextCount: new Set(observation.incorrectOrMisleadingContextFactorIds).size,
    overestimatedAdvantageCount: new Set(observation.overestimatedAdvantageFactorIds).size,
    measurementFirstHelped: observation.measurementFirstReducedInterpretiveError,
    loadedLabelRiskObserved: observation.loadedLabelWouldHaveMisled,
    unresolvedWeaknesses: ["Context observations are descriptive and do not change calibration mathematics.", ...observation.notes],
  };
}
