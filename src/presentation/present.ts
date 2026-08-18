import type { DecisionCase, Evidence } from "../domain.js";
import type {
  AuditData,
  AuditView,
  BalancedView,
  CondensedView,
  ExpandableSection,
  HistoricalConclusion,
  HistoricalConfidence,
  PresentationContext,
  PresentationMode,
  PresentationPreference,
  PresentationResult,
  PresentationThresholds,
} from "./types.js";

const clone = <T>(value: T): T => structuredClone(value);

export const defaultPresentationThresholds: Readonly<PresentationThresholds> = Object.freeze({
  condensedMinimumConfidence: 0.8,
  condensedMaximumUncertainty: 0.25,
  auditBelowConfidence: 0.5,
  auditAtUncertainty: 0.55,
  highValueUnknownAt: 0.65,
  majorContradictionCount: 2,
  highStakesAuditBelowConfidence: 0.8,
});

function latestAnalysis(decisionCase: DecisionCase) {
  const conclusion = decisionCase.latestConclusion;
  const snapshot = decisionCase.analysisHistory.at(-1);
  if (!conclusion || !snapshot) throw new Error("Presentation requires an analyzed decision case with a conclusion and snapshot.");
  return { conclusion, snapshot };
}

function selectAutoMode(decisionCase: DecisionCase, thresholds: PresentationThresholds): { mode: PresentationMode; reasons: string[] } {
  const { conclusion, snapshot } = latestAnalysis(decisionCase);
  const reasons: string[] = [];
  const topUnknown = snapshot.highestValueUnknowns[0];
  const hasHighValueUnknown = Boolean(topUnknown && topUnknown.informationValueScore >= thresholds.highValueUnknownAt);
  const hasMajorContradictions = snapshot.contradictions.length >= thresholds.majorContradictionCount;

  let mode: PresentationMode = conclusion.confidence >= thresholds.condensedMinimumConfidence &&
    snapshot.uncertainty <= thresholds.condensedMaximumUncertainty && decisionCase.stakes !== "high"
    ? "CONDENSED"
    : "BALANCED";

  if (mode === "CONDENSED") reasons.push("Confidence and uncertainty support a compact presentation for these stakes.");
  else reasons.push("Confidence, uncertainty, or stakes warrant supporting context.");

  if (decisionCase.stakes === "high") {
    mode = "BALANCED";
    reasons.push("High stakes require at least a balanced presentation.");
  }
  if (conclusion.confidence < thresholds.auditBelowConfidence || snapshot.uncertainty >= thresholds.auditAtUncertainty) {
    mode = "AUDIT";
    reasons.push("Low confidence or material uncertainty calls for audit detail.");
  }
  if (hasMajorContradictions) {
    mode = "AUDIT";
    reasons.push("Multiple contradictions call for source-level inspection.");
  }
  if (hasHighValueUnknown) {
    mode = decisionCase.stakes === "high" || conclusion.confidence < thresholds.auditBelowConfidence ? "AUDIT" : "BALANCED";
    reasons.push("An unresolved high-value unknown increases disclosure.");
  }
  if (decisionCase.stakes === "high" && conclusion.confidence < thresholds.highStakesAuditBelowConfidence) {
    mode = "AUDIT";
    reasons.push("Confidence is below the configured high-stakes audit threshold.");
  }
  return { mode, reasons };
}

function evidenceForIds(decisionCase: DecisionCase, ids: readonly string[]): Evidence[] {
  const byId = new Map(decisionCase.evidence.map((evidence) => [evidence.id, evidence]));
  return ids.flatMap((id) => {
    const evidence = byId.get(id);
    return evidence ? [clone(evidence)] : [];
  });
}

function nextAction(decisionCase: DecisionCase): string {
  const { conclusion } = latestAnalysis(decisionCase);
  return conclusion.specificNextInformation ?? conclusion.reassessmentTriggers[0] ?? conclusion.statement;
}

function condensed(decisionCase: DecisionCase): CondensedView {
  const { conclusion, snapshot } = latestAnalysis(decisionCase);
  const mainEvidence = evidenceForIds(decisionCase, snapshot.strongestEvidenceIds)[0];
  return {
    mode: "CONDENSED",
    conclusion: { action: conclusion.action, statement: conclusion.statement },
    confidence: conclusion.confidence,
    mainReason: mainEvidence?.statement ?? conclusion.strongestBasis[0] ?? "No single dominant evidence item is available.",
    mainRiskOrUncertainty: conclusion.majorUncertainty,
    nextActionOrTrigger: nextAction(decisionCase),
  };
}

function balanced(decisionCase: DecisionCase): BalancedView {
  const { conclusion, snapshot } = latestAnalysis(decisionCase);
  return {
    mode: "BALANCED",
    conclusion: { action: conclusion.action, statement: conclusion.statement },
    confidence: conclusion.confidence,
    strongestEvidenceAndDrivers: evidenceForIds(decisionCase, snapshot.strongestEvidenceIds).map(({ id, statement }) => ({ id, statement })),
    majorUncertainty: conclusion.majorUncertainty,
    highValueUnknowns: clone(snapshot.highestValueUnknowns),
    competingHypotheses: decisionCase.hypotheses.map((hypothesis) => ({
      id: hypothesis.id,
      statement: hypothesis.statement,
      kind: hypothesis.kind,
      weight: snapshot.hypothesisWeights[hypothesis.id] ?? hypothesis.currentWeight,
      leading: hypothesis.id === snapshot.leadingHypothesisId,
    })),
    nextActionOrTrigger: nextAction(decisionCase),
  };
}

function availableHistory(decisionCase: DecisionCase, context: PresentationContext): {
  conclusions: readonly HistoricalConclusion[];
  confidence: readonly HistoricalConfidence[];
  notes: readonly string[];
} {
  const { conclusion, snapshot } = latestAnalysis(decisionCase);
  const suppliedConclusions = context.conclusionHistory;
  const suppliedConfidence = context.confidenceHistory;
  return {
    conclusions: clone(suppliedConclusions ?? [{ timestamp: snapshot.timestamp, conclusion }]),
    confidence: clone(suppliedConfidence ?? [{ timestamp: snapshot.timestamp, confidence: conclusion.confidence }]),
    notes: [
      ...(!suppliedConclusions && decisionCase.analysisHistory.length > 1
        ? ["Earlier conclusion values are not stored in DecisionCase v0.1; only the latest conclusion is available unless history is supplied."]
        : []),
      ...(!suppliedConfidence && decisionCase.analysisHistory.length > 1
        ? ["Earlier confidence values are not stored in DecisionCase v0.1; only the latest confidence is available unless history is supplied."]
        : []),
    ],
  };
}

export function buildAuditData(decisionCaseInput: DecisionCase, context: PresentationContext = {}): AuditData {
  const decisionCase = clone(decisionCaseInput);
  const { conclusion, snapshot } = latestAnalysis(decisionCase);
  const history = availableHistory(decisionCase, context);
  const contradictionIds = new Set(decisionCase.analysisHistory.flatMap((item) => item.contradictions));
  return {
    question: decisionCase.question,
    desiredResult: decisionCase.desiredResult,
    timeframe: clone(decisionCase.timeframe),
    stakes: decisionCase.stakes,
    reversibility: decisionCase.reversibility,
    conclusion: clone(conclusion),
    evidence: clone(decisionCase.evidence),
    sources: clone(decisionCase.sources),
    sourceObservations: clone(context.sourceObservations ?? []),
    hypotheses: clone(decisionCase.hypotheses),
    hypothesisWeights: clone(snapshot.hypothesisWeights),
    wildcardHypotheses: clone(decisionCase.hypotheses.filter((hypothesis) => hypothesis.kind === "wildcard")),
    contradictions: clone(decisionCase.evidence.filter((evidence) => contradictionIds.has(evidence.id))),
    hunches: clone(decisionCase.hunches),
    unknowns: clone(decisionCase.unknowns),
    predictionLedger: clone(decisionCase.predictions),
    analysisSnapshots: clone(decisionCase.analysisHistory),
    confidenceHistory: history.confidence,
    conclusionHistory: history.conclusions,
    outcomes: clone(decisionCase.outcomes),
    learningNotes: clone(decisionCase.lessons),
    availabilityNotes: history.notes,
  };
}

function audit(decisionCase: DecisionCase, context: PresentationContext): AuditView {
  return { mode: "AUDIT", ...buildAuditData(decisionCase, context) };
}

function expandableSections(mode: PresentationMode, decisionCase: DecisionCase): ExpandableSection[] {
  const hasHistory = decisionCase.analysisHistory.length > 0 || decisionCase.outcomes.length > 0 || decisionCase.lessons.length > 0;
  return [
    { id: "analysis", label: "Show analysis", available: true, defaultExpanded: mode !== "CONDENSED", opensMode: "BALANCED" },
    { id: "evidence", label: "Show evidence", available: decisionCase.evidence.length > 0, defaultExpanded: mode === "AUDIT", opensMode: "AUDIT" },
    { id: "hypotheses", label: "Show hypotheses", available: decisionCase.hypotheses.length > 0, defaultExpanded: mode !== "CONDENSED", opensMode: "BALANCED" },
    { id: "source_trail", label: "Show source trail", available: decisionCase.sources.length > 0, defaultExpanded: mode === "AUDIT", opensMode: "AUDIT" },
    { id: "history", label: "Show history", available: hasHistory, defaultExpanded: mode === "AUDIT", opensMode: "AUDIT" },
    { id: "full_audit", label: "Show full audit", available: true, defaultExpanded: mode === "AUDIT", opensMode: "AUDIT" },
  ];
}

export function presentDecision(
  decisionCaseInput: DecisionCase,
  preference: PresentationPreference = "AUTO",
  context: PresentationContext = {},
): PresentationResult {
  const decisionCase = clone(decisionCaseInput);
  latestAnalysis(decisionCase);
  const thresholds = { ...defaultPresentationThresholds, ...context.thresholds };
  const auto = selectAutoMode(decisionCase, thresholds);
  const selectedMode = preference === "AUTO" ? auto.mode : preference;
  const view = selectedMode === "CONDENSED"
    ? condensed(decisionCase)
    : selectedMode === "BALANCED"
      ? balanced(decisionCase)
      : audit(decisionCase, context);
  return {
    requestedPreference: preference,
    selectedMode,
    autoSelectionReasons: preference === "AUTO" ? auto.reasons : [`Explicit ${preference} preference overrides AUTO.`],
    expandableSections: expandableSections(selectedMode, decisionCase),
    view,
  };
}
