import type { Evidence, Hypothesis, SourceProfile, Unknown } from "../domain.js";
import type { ResolvedCase, ResolvedCaseStage } from "./types.js";

const sources: SourceProfile[] = [
  { id: "lab", name: "Independent test lab", domain: "operational validation", expertise: 0.9, historicalTrackRecord: 0.85, independence: 0.95, incentiveConflictRisk: 0.05, position: "mainstream" },
  { id: "claimant", name: "Interested claimant", domain: "self-reported claims", expertise: 0.6, historicalTrackRecord: 0.5, independence: 0.15, incentiveConflictRisk: 0.85, position: "unknown" },
  { id: "registry", name: "Official registry", domain: "official records", expertise: 0.9, historicalTrackRecord: 0.95, independence: 0.9, incentiveConflictRisk: 0.05, position: "mainstream" },
];

function hypotheses(priors: [number, number, number] = [0.55, 0.3, 0.15]): Hypothesis[] {
  return [
    { id: "accept", statement: "the proposed path will achieve the desired result.", kind: "mainstream", priorWeight: priors[0], currentWeight: priors[0], assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "ACT" },
    { id: "reject", statement: "the proposed path will not achieve the desired result.", kind: "alternative", priorWeight: priors[1], currentWeight: priors[1], assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "ABORT" },
    { id: "wildcard", statement: "an overlooked mechanism requires a different path.", kind: "wildcard", priorWeight: priors[2], currentWeight: priors[2], assumptions: [], falsifiers: [], predictions: [], status: "active", actionOnLead: "CHANGE_PATH" },
  ];
}

function evidence(id: string, sourceId: string, supports: string[], contradicts: string[] = [], strength = 1): Evidence {
  return {
    id,
    statement: `${id} observed.`,
    sourceId,
    provenance: sourceId === "lab" ? "Independent controlled test" : sourceId === "registry" ? "Official record" : "Interested-party statement",
    timestamp: "2026-01-01T00:00:00.000Z",
    type: sourceId === "lab" ? "measurement" : sourceId === "registry" ? "record" : "testimony",
    relevance: strength,
    reliability: strength,
    directness: strength,
    freshness: 1,
    independence: sourceId === "claimant" ? 0.2 : strength,
    supports,
    contradicts,
  };
}

function unknown(id: string, value: number, cost = 0.1, time = 0.1): Unknown {
  return { id, question: `Resolve ${id}`, expectedDecisionValue: value, estimatedAcquisitionCost: cost, estimatedTimeCost: time, status: "open" };
}

function stage(id: string, day: number, items: Evidence[], resolvedUnknownIds: string[] = []): ResolvedCaseStage {
  return { id, timestamp: `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`, evidence: items, ...(resolvedUnknownIds.length ? { resolvedUnknownIds } : {}) };
}

function resolvedCase(args: {
  id: string;
  stages: ResolvedCaseStage[];
  correct: string;
  actions: ResolvedCase["outcome"]["successfulActions"];
  earliest: number;
  unknowns?: Unknown[];
  mattered?: string[];
  useful?: string[];
  misleading?: string[];
  usefulSources?: string[];
  misleadingSources?: string[];
  priors?: [number, number, number];
  achieved?: boolean;
}): ResolvedCase {
  return {
    id: args.id,
    question: `What should be concluded in ${args.id}?`,
    desiredResult: "Reach a defensible conclusion with proportionate investigation.",
    timeframe: { label: "Historical replay", urgency: "near_term" },
    stakes: "low",
    reversibility: "easy",
    sources,
    hypotheses: hypotheses(args.priors),
    unknowns: args.unknowns ?? [],
    stages: args.stages,
    outcome: {
      description: `${args.correct} was the resolved explanation.`,
      resolvedAt: "2026-02-01T00:00:00.000Z",
      correctHypothesisId: args.correct,
      successfulActions: args.actions,
      desiredResultAchieved: args.achieved ?? true,
      earliestSufficientStage: args.earliest,
      missingInformationThatMattered: args.mattered ?? [],
      usefulEvidenceIds: args.useful ?? [],
      misleadingEvidenceIds: args.misleading ?? [],
      usefulSourceIds: args.usefulSources ?? [],
      misleadingSourceIds: args.misleadingSources ?? [],
    },
  };
}

const earlySignals = [
  evidence("early-lab-1", "lab", ["accept"]),
  evidence("early-lab-2", "lab", ["accept"]),
  evidence("early-registry", "registry", ["accept"]),
];

export const syntheticResolvedCases: readonly ResolvedCase[] = [
  resolvedCase({
    id: "early-evidence-correct",
    stages: [stage("early", 1, earlySignals)],
    correct: "accept", actions: ["ACT"], earliest: 1,
    useful: earlySignals.map((item) => item.id), usefulSources: ["lab", "registry"],
  }),
  resolvedCase({
    id: "contradiction-changes-conclusion",
    stages: [
      stage("support", 1, [evidence("cc-claim-1", "claimant", ["accept"]), evidence("cc-claim-2", "claimant", ["accept"]), evidence("cc-claim-3", "claimant", ["accept"])]),
      stage("contradiction", 2, [evidence("cc-lab-1", "lab", ["reject"], ["accept"]), evidence("cc-lab-2", "lab", ["reject"], ["accept"]), evidence("cc-record", "registry", ["reject"], ["accept"])]),
    ],
    correct: "reject", actions: ["ABORT"], earliest: 2,
    useful: ["cc-lab-1", "cc-lab-2", "cc-record"], misleading: ["cc-claim-1", "cc-claim-2", "cc-claim-3"], usefulSources: ["lab", "registry"], misleadingSources: ["claimant"],
  }),
  resolvedCase({
    id: "wildcard-best-explanation",
    stages: [
      stage("ambiguous", 1, [evidence("wc-claim", "claimant", ["accept"], [], 0.5)]),
      stage("wildcard", 2, [evidence("wc-lab-1", "lab", ["wildcard"], ["accept", "reject"]), evidence("wc-lab-2", "lab", ["wildcard"], ["accept", "reject"]), evidence("wc-record", "registry", ["wildcard"], ["accept"])]),
    ],
    correct: "wildcard", actions: ["CHANGE_PATH"], earliest: 2,
    useful: ["wc-lab-1", "wc-lab-2", "wc-record"], misleading: ["wc-claim"], usefulSources: ["lab", "registry"], misleadingSources: ["claimant"],
  }),
  resolvedCase({
    id: "high-value-unknown-resolves",
    stages: [
      stage("missing", 1, [evidence("hv-background", "claimant", ["accept"], [], 0.45)]),
      stage("resolved", 2, [evidence("hv-record", "registry", ["accept"], ["reject"]), evidence("hv-lab-1", "lab", ["accept"]), evidence("hv-lab-2", "lab", ["accept"])], ["decisive-record"]),
    ],
    correct: "accept", actions: ["ACT"], earliest: 2,
    unknowns: [unknown("decisive-record", 0.98), unknown("minor-detail", 0.35)], mattered: ["decisive-record"],
    useful: ["hv-record", "hv-lab-1", "hv-lab-2"], usefulSources: ["registry", "lab"],
  }),
  resolvedCase({
    id: "high-value-unknown-irrelevant",
    stages: [
      stage("ranked", 1, [evidence("hi-background", "claimant", ["accept"], [], 0.4)]),
      stage("both-resolved", 2, [evidence("hi-irrelevant", "registry", [], []), evidence("hi-actual-1", "lab", ["reject"], ["accept"]), evidence("hi-actual-2", "lab", ["reject"], ["accept"]), evidence("hi-actual-3", "lab", ["reject"], ["accept"])], ["supposedly-decisive", "lower-ranked-actual"]),
    ],
    correct: "reject", actions: ["ABORT"], earliest: 2,
    unknowns: [unknown("supposedly-decisive", 0.99), unknown("lower-ranked-actual", 0.72)], mattered: ["lower-ranked-actual"],
    useful: ["hi-actual-1", "hi-actual-2", "hi-actual-3"], misleading: ["hi-background"], usefulSources: ["lab"], misleadingSources: ["claimant"],
  }),
  resolvedCase({
    id: "confidence-overestimated",
    stages: [stage("misleading", 1, [evidence("over-1", "claimant", ["accept"]), evidence("over-2", "claimant", ["accept"]), evidence("over-3", "claimant", ["accept"]), evidence("over-4", "claimant", ["accept"])])],
    correct: "reject", actions: ["ABORT"], earliest: 1,
    misleading: ["over-1", "over-2", "over-3", "over-4"], misleadingSources: ["claimant"], achieved: false,
  }),
  resolvedCase({
    id: "confidence-underestimated",
    stages: [stage("weak-correct", 1, [evidence("under-1", "lab", ["accept"], [], 0.35)])],
    correct: "accept", actions: ["ACT"], earliest: 1,
    useful: ["under-1"], usefulSources: ["lab"],
  }),
  resolvedCase({
    id: "engine-stops-too-early",
    stages: [
      stage("premature", 1, [evidence("stop-claim-1", "claimant", ["accept"]), evidence("stop-claim-2", "claimant", ["accept"]), evidence("stop-claim-3", "claimant", ["accept"])]),
      stage("correction", 2, [evidence("stop-lab-1", "lab", ["reject"], ["accept"]), evidence("stop-lab-2", "lab", ["reject"], ["accept"]), evidence("stop-lab-3", "lab", ["reject"], ["accept"]), evidence("stop-record", "registry", ["reject"], ["accept"])])],
    correct: "reject", actions: ["ABORT"], earliest: 2,
    useful: ["stop-lab-1", "stop-lab-2", "stop-lab-3", "stop-record"], misleading: ["stop-claim-1", "stop-claim-2", "stop-claim-3"], usefulSources: ["lab", "registry"], misleadingSources: ["claimant"],
  }),
  resolvedCase({
    id: "waits-appropriately",
    stages: [
      stage("weak", 1, [evidence("wait-weak", "claimant", ["accept"], [], 0.3)]),
      stage("sufficient", 2, [evidence("wait-lab-1", "lab", ["accept"]), evidence("wait-lab-2", "lab", ["accept"]), evidence("wait-record", "registry", ["accept"])])],
    correct: "accept", actions: ["ACT"], earliest: 2,
    useful: ["wait-lab-1", "wait-lab-2", "wait-record"], usefulSources: ["lab", "registry"],
  }),
];
