export interface ResolvedExpansionObservation {
  caseId: string;
  decisiveProbeIds: readonly string[];
  usefulNonDecisiveProbeIds: readonly string[];
  noisyProbeIds: readonly string[];
  duplicateProbeIds: readonly string[];
  missedMaterialFactorIds: readonly string[];
  stoppingAssessment: "APPROPRIATE" | "EXCESSIVE" | "TOO_EARLY";
  startingEvidenceMisleading: boolean;
  expansionOverturnedInitialView: boolean;
  expansionCorrectlyStrengthenedInitialView: boolean;
  notes: readonly string[];
}

export interface ExpansionCalibrationObservation {
  caseId: string;
  decisiveProbes: number;
  usefulNonDecisiveProbes: number;
  noisyProbes: number;
  duplicateProbes: number;
  missedMaterialFactors: number;
  stoppingAssessment: ResolvedExpansionObservation["stoppingAssessment"];
  startingEvidenceMisleading: boolean;
  expansionEffect: "OVERTURNED" | "STRENGTHENED" | "NO_RECORDED_CHANGE";
  unresolvedWeaknesses: readonly string[];
}

export function observeResolvedExpansion(input: ResolvedExpansionObservation): ExpansionCalibrationObservation {
  const observation = structuredClone(input);
  if (observation.expansionOverturnedInitialView && observation.expansionCorrectlyStrengthenedInitialView) throw new TypeError("Expansion cannot both overturn and strengthen the initial view in one observation.");
  return {
    caseId: observation.caseId,
    decisiveProbes: new Set(observation.decisiveProbeIds).size,
    usefulNonDecisiveProbes: new Set(observation.usefulNonDecisiveProbeIds).size,
    noisyProbes: new Set(observation.noisyProbeIds).size,
    duplicateProbes: new Set(observation.duplicateProbeIds).size,
    missedMaterialFactors: new Set(observation.missedMaterialFactorIds).size,
    stoppingAssessment: observation.stoppingAssessment,
    startingEvidenceMisleading: observation.startingEvidenceMisleading,
    expansionEffect: observation.expansionOverturnedInitialView ? "OVERTURNED" : observation.expansionCorrectlyStrengthenedInitialView ? "STRENGTHENED" : "NO_RECORDED_CHANGE",
    unresolvedWeaknesses: ["Expansion observations are descriptive and do not change calibration mathematics.", ...observation.notes],
  };
}
