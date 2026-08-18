import type { AgentDisagreement, EvidenceJudgment, EngineeringOutcome, OrchestrationSession, VerificationResult } from "./types.js";

export function resolveDisagreementByVerification(disagreementInput: AgentDisagreement, result: VerificationResult, resolution: string): AgentDisagreement {
  const disagreement = structuredClone(disagreementInput);
  if (result.requirementId !== disagreement.affectedRequirementId) throw new TypeError("Verification result does not address the disagreement requirement.");
  return { ...disagreement, status: result.status === "INCONCLUSIVE" ? "PARTIALLY_RESOLVED" : "RESOLVED_BY_TEST", resolution };
}

export function judgeClaim(args: { judgmentId: string; iteration: number; claimId: string; verificationResults: readonly VerificationResult[]; judgeRunId: string; unresolvedDisagreementIds?: readonly string[] }): EvidenceJudgment {
  const results = structuredClone(args.verificationResults);
  const evidenceIds = results.flatMap((result) => result.evidence.map((item) => item.evidenceId));
  const status = results.length === 0 ? "INSUFFICIENT_EVIDENCE" : results.some((result) => result.status === "FAILED") ? "CONTRADICTED" : results.every((result) => result.status === "PASSED") ? "SUPPORTED" : "PARTIALLY_SUPPORTED";
  return { judgmentId: args.judgmentId, iteration: args.iteration, claimId: args.claimId, status, verificationEvidenceIds: evidenceIds, rationale: status === "SUPPORTED" ? "All cited machine-verifiable requirements passed." : status === "CONTRADICTED" ? "At least one cited machine-verifiable requirement failed." : "Available verification does not fully establish the claim.", unresolvedDisagreementIds: [...(args.unresolvedDisagreementIds ?? [])], judgeRunId: args.judgeRunId };
}

export function deriveEngineeringOutcome(session: Omit<OrchestrationSession, "outcome">, completedAt: string): EngineeringOutcome {
  const latestByRequirement = new Map<string, VerificationResult>();
  for (const result of session.verificationResults) {
    const current = latestByRequirement.get(result.requirementId);
    if (!current || result.iteration >= current.iteration) latestByRequirement.set(result.requirementId, result);
  }
  const passed = session.verificationRequirements.filter((requirement) => latestByRequirement.get(requirement.requirementId)?.status === "PASSED").map((item) => item.requirementId);
  const unresolved = session.verificationRequirements.filter((requirement) => !passed.includes(requirement.requirementId)).map((item) => item.requirementId);
  const supportedFinalJudgment = session.evidenceJudgments.some((item) => item.status === "SUPPORTED" && item.iteration === Math.max(...session.evidenceJudgments.map((judgment) => judgment.iteration), 0));
  const verified = unresolved.length === 0 && supportedFinalJudgment;
  return { status: verified ? "VERIFIED" : session.verificationResults.some((item) => item.status === "FAILED") ? "REPAIR_REQUIRED" : "UNRESOLVED", resultSummary: verified ? "All requirements are supported by explicit verification evidence." : "The result is not fully verified.", verifiedRequirementIds: passed, unresolvedRequirementIds: unresolved, finalArtifactReferences: session.runs.at(-1)?.artifactReferences ?? [], completedAt };
}
