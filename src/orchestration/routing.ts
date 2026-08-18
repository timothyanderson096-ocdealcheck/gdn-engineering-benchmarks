import { performanceFor } from "./registry.js";
import type { CapabilityRegistry, RoutingCandidateEvaluation, RoutingConstraints, RoutingDecision } from "./types.js";

export function routeModel(registryInput: CapabilityRegistry, constraintsInput: RoutingConstraints, routingDecisionId: string): RoutingDecision {
  const registry = structuredClone(registryInput);
  const constraints = structuredClone(constraintsInput);
  const alternatives: RoutingCandidateEvaluation[] = registry.profiles.map((profile) => {
    const performance = performanceFor(profile, constraints.role, constraints.taskTags, constraints.domainTags);
    const exclusions: string[] = [];
    if (!profile.supportedRoles.includes(constraints.role)) exclusions.push("role not supported");
    if (profile.contextLimit < constraints.requiredContext) exclusions.push("context limit insufficient");
    if ((performance?.sampleSize ?? 0) < constraints.minimumSampleSize) exclusions.push("minimum evidence sample not met");
    if (constraints.maximumLatencyMs !== undefined && performance?.averageLatencyMs !== undefined && performance.averageLatencyMs > constraints.maximumLatencyMs) exclusions.push("latency exceeds limit");
    if (constraints.maximumCostUnits !== undefined && performance?.averageCostUnits !== undefined && performance.averageCostUnits > constraints.maximumCostUnits) exclusions.push("cost exceeds limit");
    return {
      modelId: profile.model.modelId,
      eligible: exclusions.length === 0,
      matchedTaskTags: performance?.taskTags.filter((tag) => constraints.taskTags.includes(tag)) ?? [],
      matchedDomainTags: performance?.domainTags.filter((tag) => constraints.domainTags.includes(tag)) ?? [],
      rolePerformanceSampleSize: performance?.sampleSize ?? 0,
      reliability: performance?.reliability ?? null,
      uncertainty: !performance || performance.sampleSize < 3 ? "High uncertainty from limited role/task evidence." : `Capability estimate confidence ${(performance.confidenceInEstimate * 100).toFixed(0)}%.`,
      exclusions,
    };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || (b.reliability ?? -1) - (a.reliability ?? -1) || b.rolePerformanceSampleSize - a.rolePerformanceSampleSize || a.modelId.localeCompare(b.modelId));
  const selected = alternatives.find((item) => item.eligible);
  return {
    routingDecisionId,
    constraints,
    ...(selected ? { selectedModelId: selected.modelId } : {}),
    rationale: selected ? [`Selected ${selected.modelId} for ${constraints.role}.`, `Role/task reliability ${selected.reliability?.toFixed(3) ?? "unmeasured"} from ${selected.rolePerformanceSampleSize} observations.`] : ["No candidate satisfied the authored routing constraints."],
    evidenceReferences: selected ? registry.observations.filter((item) => item.modelId === selected.modelId && item.role === constraints.role).map((item) => item.observationId) : [],
    uncertainty: selected ? [selected.uncertainty] : alternatives.flatMap((item) => item.exclusions.map((reason) => `${item.modelId}: ${reason}`)),
    alternatives,
  };
}
