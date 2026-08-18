import type { RangeCardResult } from "../exploration/types.js";
import type { EvidenceGap, ExpansionPlan, ExpansionProbe, PlanRole, PlannedProbe } from "./types.js";

export interface ExpansionPlanningOptions { optionalDeferBelow?: number; stoppingRule?: string; }

function validateScore(label: string, value: number): void { if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${label} must be between 0 and 1.`); }

export function createExpansionPlan(probesInput: readonly ExpansionProbe[], gapsInput: readonly EvidenceGap[], rangeCard?: RangeCardResult, options: ExpansionPlanningOptions = {}): ExpansionPlan {
  const probes = structuredClone(probesInput);
  const gaps = structuredClone(gapsInput);
  const gapById = new Map(gaps.map((gap) => [gap.id, gap]));
  gaps.forEach((gap) => validateScore(`Gap ${gap.id} expectedInformationValue`, gap.expectedInformationValue));
  const knownArcIds = rangeCard ? new Set(rangeCard.acceptedArcIds) : undefined;
  const rejected: ExpansionProbe[] = [];
  const deferred: ExpansionProbe[] = [];
  const eligible: ExpansionProbe[] = [];
  for (const probe of probes) {
    validateScore(`Probe ${probe.id} expectedInformationValue`, probe.expectedInformationValue);
    if (probe.targetGapIds.some((id) => !gapById.has(id))) throw new TypeError(`Probe ${probe.id} references an unknown evidence gap.`);
    if (knownArcIds && probe.rangeCardArcIds.some((id) => !knownArcIds.has(id))) throw new TypeError(`Probe ${probe.id} references an unknown Range Card arc.`);
    if (!probe.couldMateriallyChangeOutcome || probe.outcomeDimensions.length === 0 || !probe.objectiveLink.trim()) {
      rejected.push({ ...probe, status: "REJECTED" });
    } else if (probe.expectedInformationValue < (options.optionalDeferBelow ?? 0) && probe.targetGapIds.every((id) => gapById.get(id)?.status === "OPTIONAL")) {
      deferred.push({ ...probe, status: "DEFERRED" });
    } else {
      eligible.push(probe);
    }
  }
  const linkedGapValue = (probe: ExpansionProbe): number => Math.max(0, ...probe.targetGapIds.map((id) => gapById.get(id)?.expectedInformationValue ?? 0));
  eligible.sort((a, b) => linkedGapValue(b) - linkedGapValue(a) || b.expectedInformationValue - a.expectedInformationValue || a.id.localeCompare(b.id));
  const selected: { probe: ExpansionProbe; role: PlanRole }[] = [];
  const take = (role: PlanRole, predicate: (probe: ExpansionProbe) => boolean): void => {
    const probe = eligible.find((candidate) => !selected.some((item) => item.probe.id === candidate.id) && predicate(candidate));
    if (probe) selected.push({ probe, role });
  };
  take("HIGHEST_VALUE", () => true);
  take("NEXT_USEFUL", () => true);
  take("LATERAL", (probe) => probe.rangeCardArcIds.length > 0);
  take("OPTIONAL", () => true);
  const prioritized: PlannedProbe[] = selected.map(({ probe, role }, index) => ({
    rank: index + 1,
    role,
    probe: { ...probe, status: "PRIORITIZED" },
    linkedGapIds: [...probe.targetGapIds],
    priorityBasis: probe.targetGapIds.length ? `Linked gap value up to ${linkedGapValue(probe).toFixed(3)}; authored probe value ${probe.expectedInformationValue.toFixed(3)}.` : `Authored probe value ${probe.expectedInformationValue.toFixed(3)}.`,
  }));
  deferred.push(...eligible.filter((probe) => !selected.some((item) => item.probe.id === probe.id)).map((probe) => ({ ...probe, status: "DEFERRED" as const })));
  return { prioritized, rejected, deferred, stoppingRule: options.stoppingRule ?? "Stop when no remaining probe could materially change probability, value, timing, conditions, or availability." };
}
