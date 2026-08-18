import type { Evidence } from "../domain.js";
import { replayResolvedCase } from "./replay.js";
import type { CalibrationBucket, CalibrationReport, CaseReplayResult, ResolvedCase, SignalObservation, SourcePerformanceObservation } from "./types.js";

const mean = (values: readonly number[]): number | null => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const bucketDefinitions = [
  ["below 50%", 0, 0.5],
  ["50–60%", 0.5, 0.6],
  ["60–70%", 0.6, 0.7],
  ["70–80%", 0.7, 0.8],
  ["80–90%", 0.8, 0.9],
  ["90%+", 0.9, 1.01],
] as const;

function calibrationBuckets(replays: readonly CaseReplayResult[]): CalibrationBucket[] {
  const stages = replays.flatMap((replay) => replay.stages);
  return bucketDefinitions.map(([label, lower, upper]) => {
    const entries = stages.filter((stage) => stage.conclusion.confidence >= lower && stage.conclusion.confidence < upper);
    return {
      label,
      count: entries.length,
      averageConfidence: mean(entries.map((stage) => stage.conclusion.confidence)),
      observedAccuracy: mean(entries.map((stage) => Number(stage.leadingHypothesisCorrect))),
      brierScore: mean(entries.map((stage) => (stage.conclusion.confidence - Number(stage.leadingHypothesisCorrect)) ** 2)),
    };
  });
}

function signalCounts(cases: readonly ResolvedCase[], kind: "useful" | "misleading"): SignalObservation[] {
  const counts = new Map<string, number>();
  for (const resolvedCase of cases) {
    const ids = new Set(kind === "useful" ? resolvedCase.outcome.usefulEvidenceIds : resolvedCase.outcome.misleadingEvidenceIds);
    for (const evidence of resolvedCase.stages.flatMap((stage) => stage.evidence).filter((item) => ids.has(item.id))) {
      const signal = `${evidence.type}: ${evidence.provenance}`;
      counts.set(signal, (counts.get(signal) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([signal, count]) => ({ signal, count })).sort((a, b) => b.count - a.count || a.signal.localeCompare(b.signal));
}

function sourcePerformance(cases: readonly ResolvedCase[]): SourcePerformanceObservation[] {
  const records = new Map<string, { sourceId: string; domain: string; useful: number; misleading: number; cases: Set<string> }>();
  for (const resolvedCase of cases) {
    const usefulEvidence = new Set(resolvedCase.outcome.usefulEvidenceIds);
    const misleadingEvidence = new Set(resolvedCase.outcome.misleadingEvidenceIds);
    const evidenceBySource = new Map<string, Evidence[]>();
    for (const evidence of resolvedCase.stages.flatMap((stage) => stage.evidence)) {
      evidenceBySource.set(evidence.sourceId, [...(evidenceBySource.get(evidence.sourceId) ?? []), evidence]);
    }
    for (const source of resolvedCase.sources) {
      const key = `${source.domain}\u0000${source.id}`;
      const record = records.get(key) ?? { sourceId: source.id, domain: source.domain, useful: 0, misleading: 0, cases: new Set<string>() };
      const sourceEvidence = evidenceBySource.get(source.id) ?? [];
      record.useful += sourceEvidence.filter((evidence) => usefulEvidence.has(evidence.id)).length;
      record.misleading += sourceEvidence.filter((evidence) => misleadingEvidence.has(evidence.id)).length;
      record.cases.add(resolvedCase.id);
      records.set(key, record);
    }
  }
  return [...records.values()].map((record) => ({
    sourceId: record.sourceId,
    domain: record.domain,
    usefulEvidenceCount: record.useful,
    misleadingEvidenceCount: record.misleading,
    casesObserved: record.cases.size,
    observation: record.useful === record.misleading
      ? "Mixed or insufficient evidence in this domain."
      : record.useful > record.misleading
        ? "More useful than misleading observations in this domain."
        : "More misleading than useful observations in this domain.",
  })).sort((a, b) => a.domain.localeCompare(b.domain) || a.sourceId.localeCompare(b.sourceId));
}

export function buildCalibrationReport(inputs: readonly ResolvedCase[], generatedAt = new Date()): CalibrationReport {
  const cases = structuredClone(inputs);
  const replays = cases.map(replayResolvedCase);
  const stages = replays.flatMap((replay) => replay.stages);
  const measurable = stages.filter((stage) => stage.conclusionUtilityMeasurable);
  const confidencePairs = stages.map((stage) => ({ predicted: stage.conclusion.confidence, observed: Number(stage.leadingHypothesisCorrect) }));
  const ranks = replays.flatMap((replay) => Object.values(replay.matteredUnknownRanks)).filter((rank): rank is number => rank !== null);
  const buckets = calibrationBuckets(replays);

  return {
    generatedAt: generatedAt.toISOString(),
    caseCount: replays.length,
    stageCount: stages.length,
    conclusionAccuracy: mean(stages.map((stage) => Number(stage.leadingHypothesisCorrect))),
    conclusionUtility: mean(measurable.map((stage) => Number(stage.conclusionUseful))),
    calibration: {
      brierScore: mean(confidencePairs.map(({ predicted, observed }) => (predicted - observed) ** 2)),
      meanAbsoluteCalibrationError: mean(buckets.filter((bucket) => bucket.count > 0).map((bucket) => Math.abs(bucket.averageConfidence! - bucket.observedAccuracy!))),
      buckets,
    },
    stopping: {
      averageScore: mean(replays.map((replay) => replay.stoppingScore)),
      tooEarly: replays.filter((replay) => replay.stoppingAssessment === "too_early").length,
      approximatelyCorrect: replays.filter((replay) => replay.stoppingAssessment === "approximately_correct").length,
      longerThanNecessary: replays.filter((replay) => replay.stoppingAssessment === "longer_than_necessary").length,
      materiallyChangedAfterStopping: replays.filter((replay) => replay.additionalEvidenceMateriallyChangedConclusion).length,
    },
    informationValue: {
      relevantUnknownsEvaluated: ranks.length,
      meanReciprocalRank: mean(ranks.map((rank) => 1 / rank)),
      topRankHitRate: mean(ranks.map((rank) => Number(rank === 1))),
      lowerRankedUnknownsThatMatteredMore: ranks.filter((rank) => rank > 1).length,
      wastedInformationRequests: replays.reduce((sum, replay) => sum + replay.wastedInformationRequests.length, 0),
    },
    usefulSignals: signalCounts(cases, "useful"),
    misleadingSignals: signalCounts(cases, "misleading"),
    sourcePerformance: sourcePerformance(cases),
    unresolvedWeaknesses: [
      "Synthetic fixtures are diagnostic examples, not enough data for production calibration.",
      "Outcome utility depends on fixture-authored successful actions and earliest sufficient stages.",
      "Source observations remain domain-specific and should not be interpreted as universal trust scores.",
      "The harness measures current weights but intentionally does not update them.",
    ],
    cases: replays,
  };
}
