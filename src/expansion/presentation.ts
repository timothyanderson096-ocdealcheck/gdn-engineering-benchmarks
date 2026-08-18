import type { Conclusion } from "../domain.js";
import type { EvidenceGap, ExpansionProbe, ExpansionResult, StartingEvidenceItem } from "./types.js";

export type ExpansionPresentationMode = "CONDENSED" | "BALANCED" | "AUDIT";
export interface CondensedExpansionView { mode: "CONDENSED"; conclusion: Conclusion; confidence: number; mainNewFinding?: string; mainRemainingGap?: string; nextProbeOrAction?: string; }
export interface BalancedExpansionView { mode: "BALANCED"; conclusion: Conclusion; startingEvidenceSummary: readonly StartingEvidenceItem[]; strongestNewEvidence: readonly { id: string; statement: string; producedByProbeId: string }[]; topEvidenceGaps: readonly EvidenceGap[]; prioritizedProbes: readonly ExpansionProbe[]; latestChanges: readonly string[]; }
export interface AuditExpansionView { mode: "AUDIT"; result: ExpansionResult; }
export type ExpansionPresentation = CondensedExpansionView | BalancedExpansionView | AuditExpansionView;

export function presentExpansion(input: ExpansionResult, mode: ExpansionPresentationMode): ExpansionPresentation {
  const result = structuredClone(input);
  if (mode === "AUDIT") return { mode, result };
  const latest = result.field.reassessmentHistory.at(-1);
  const gaps = [...result.field.unresolvedGaps].sort((a, b) => b.expectedInformationValue - a.expectedInformationValue || a.id.localeCompare(b.id));
  const nextProbe = result.plan.prioritized.find((item) => item.probe.status === "PRIORITIZED")?.probe;
  if (mode === "CONDENSED") {
    const materialChange = Boolean(latest?.changed.length);
    const latestEvidence = result.field.newlyAcquiredEvidence.at(-1)?.evidence;
    return {
      mode,
      conclusion: result.currentConclusion,
      confidence: result.currentConclusion.confidence,
      ...(materialChange && latestEvidence ? { mainNewFinding: latestEvidence.statement } : {}),
      ...(gaps[0] ? { mainRemainingGap: gaps[0].missingInformation } : {}),
      ...(nextProbe ? { nextProbeOrAction: nextProbe.question } : {}),
    };
  }
  return {
    mode,
    conclusion: result.currentConclusion,
    startingEvidenceSummary: result.field.startingEvidence.items,
    strongestNewEvidence: result.field.newlyAcquiredEvidence.slice(-5).reverse().map((item) => ({ id: item.evidence.id, statement: item.evidence.statement, producedByProbeId: item.producedByProbeId })),
    topEvidenceGaps: gaps.slice(0, 5),
    prioritizedProbes: result.plan.prioritized.map((item) => item.probe),
    latestChanges: latest?.changed ?? [],
  };
}
