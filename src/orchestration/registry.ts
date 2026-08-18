import type { AgentRole, CapabilityObservation, CapabilityProfile, CapabilityRegistry, RolePerformance } from "./types.js";

const clone = <T>(value: T): T => structuredClone(value);
const average = (values: readonly number[]): number | undefined => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;

export function summarizeCapabilityObservations(profile: CapabilityProfile, observationsInput: readonly CapabilityObservation[], updatedAt: string): CapabilityProfile {
  const observations = clone(observationsInput).filter((item) => item.modelId === profile.model.modelId);
  const groups = new Map<string, CapabilityObservation[]>();
  for (const observation of observations) {
    const key = JSON.stringify([observation.role, [...observation.taskTags].sort(), [...observation.domainTags].sort()]);
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  const taskCapabilities: RolePerformance[] = [...groups.values()].map((items) => {
    const first = items[0]!;
    const successes = items.filter((item) => item.successful).length;
    const verified = items.filter((item) => item.verifiedByEvidenceIds.length > 0);
    const pass = verified.filter((item) => item.successful).length;
    const disagreements = items.filter((item) => item.kind === "MATERIAL_DEFECT_FOUND" || item.kind === "FALSE_POSITIVE_NOISE");
    const useful = disagreements.filter((item) => item.kind === "MATERIAL_DEFECT_FOUND" && item.successful).length;
    const repairs = items.filter((item) => item.kind === "REPAIR_SUCCEEDED");
    return {
      role: first.role,
      taskTags: [...first.taskTags].sort(),
      domainTags: [...first.domainTags].sort(),
      sampleSize: items.length,
      successfulObservations: successes,
      reliability: successes / items.length,
      verificationPassRate: verified.length ? pass / verified.length : 0,
      disagreementUsefulness: disagreements.length ? useful / disagreements.length : 0,
      repairSuccessRate: repairs.length ? repairs.filter((item) => item.successful).length / repairs.length : 0,
      ...(average(items.flatMap((item) => item.latencyMs === undefined ? [] : [item.latencyMs])) !== undefined ? { averageLatencyMs: average(items.flatMap((item) => item.latencyMs === undefined ? [] : [item.latencyMs]))! } : {}),
      ...(average(items.flatMap((item) => item.costUnits === undefined ? [] : [item.costUnits])) !== undefined ? { averageCostUnits: average(items.flatMap((item) => item.costUnits === undefined ? [] : [item.costUnits]))! } : {}),
      confidenceInEstimate: Math.min(1, items.length / 10),
      failureModes: [...new Set(items.filter((item) => !item.successful).flatMap((item) => item.notes))],
      lastUpdated: updatedAt,
      notes: [items.length < 3 ? "Low sample size; preserve substantial uncertainty." : "Estimate is descriptive and role/task-specific."],
    };
  });
  return { ...clone(profile), taskCapabilities };
}

export function updateCapabilityRegistry(registryInput: CapabilityRegistry, observations: readonly CapabilityObservation[], updatedAt: string): CapabilityRegistry {
  const registry = clone(registryInput);
  const all = [...registry.observations, ...clone(observations)];
  return { observations: all, profiles: registry.profiles.map((profile) => summarizeCapabilityObservations(profile, all, updatedAt)) };
}

export function performanceFor(profile: CapabilityProfile, role: AgentRole, taskTags: readonly string[], domainTags: readonly string[]): RolePerformance | undefined {
  return profile.taskCapabilities.filter((item) => item.role === role).sort((a, b) => {
    const match = (item: RolePerformance) => item.taskTags.filter((tag) => taskTags.includes(tag)).length + item.domainTags.filter((tag) => domainTags.includes(tag)).length;
    return match(b) - match(a) || b.sampleSize - a.sampleSize;
  })[0];
}
