import type { OrchestrationSession } from "./types.js";

export type OrchestrationPresentationMode = "CONDENSED" | "BALANCED" | "AUDIT";
export function presentOrchestration(input: OrchestrationSession, mode: OrchestrationPresentationMode) {
  const session = structuredClone(input);
  if (mode === "AUDIT") return { mode, session } as const;
  const unresolved = session.disagreements.filter((item) => item.status === "OPEN" || item.status === "PARTIALLY_RESOLVED" || item.status === "ACCEPTED_UNCERTAINTY");
  if (mode === "CONDENSED") return { mode, engineeringResult: session.outcome.resultSummary, verificationStatus: session.outcome.status, evidenceStrength: `${session.outcome.verifiedRequirementIds.length}/${session.verificationRequirements.length} requirements verified`, unresolvedIssueCount: session.outcome.unresolvedRequirementIds.length + unresolved.length, nextAction: session.outcome.status === "VERIFIED" ? "Record outcome evidence and reusable lessons." : "Repair failed requirements and re-run verification." } as const;
  return { mode, roleAssignments: session.assignments, majorDisagreements: session.disagreements, verificationSummary: session.verificationResults, repairIterations: session.repairIterations, routingRationale: session.routingHistory.map((item) => ({ routingDecisionId: item.routingDecisionId, selectedModelId: item.selectedModelId, rationale: item.rationale, uncertainty: item.uncertainty })) } as const;
}
