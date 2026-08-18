import { buildCanonicalProviderRequest } from "./canonical-request.js";
import { sha256Hex } from "./hash.js";
import { REAL_EXTERNAL_MODEL_API } from "./types.js";
import type {
  AutomatedTournamentResult,
  CandidateGenerationInput,
  CandidateProviderAdapter,
  FrozenMre,
  PatchExtraction,
  ProviderGenerationAttempt,
  TrustedCandidateVerification,
  TrustedCandidateVerifier,
  VerificationCandidate,
} from "./types.js";

export interface TournamentGenerationRequest {
  runId: string;
  benchmarkId: string;
  frozenMre: FrozenMre;
  expectedFrozenMreHash: string;
  permittedTarget: string;
}

const unavailableExtraction = (reason: string): PatchExtraction => ({ status: "RESPONSE_FORMAT_FAILURE", exactPatch: null, patchHash: null, normalizedPatch: null, normalizedPatchHash: null, targets: [], reason });

function closedAdapterFailure(adapter: CandidateProviderAdapter, input: CandidateGenerationInput, requestHash: string, failureCode: "INTERNAL_ERROR" | "UNEXPECTED_PROVIDER_METADATA", reason: string): ProviderGenerationAttempt {
  const timestamp = new Date().toISOString();
  const extraction = unavailableExtraction(reason);
  return {
    envelope: {
      generationAttemptId: input.generationAttemptId,
      providerId: adapter.providerId,
      modelId: adapter.modelId,
      sourceClass: REAL_EXTERNAL_MODEL_API,
      benchmarkId: input.benchmarkId,
      frozenMreHash: input.expectedFrozenMreHash,
      requestHash,
      providerPayloadHash: sha256Hex("UNAVAILABLE_PROVIDER_PAYLOAD"),
      providerRequestFormat: "ADAPTER_FAILURE_BEFORE_TRUSTED_RESPONSE",
      rawResponseHash: null,
      patchHash: null,
      normalizedPatchHash: null,
      requestStartedAt: timestamp,
      responseReceivedAt: timestamp,
      generationLatencyMs: 0,
      usage: null,
      providerReportedCost: "UNKNOWN",
      extractionStatus: extraction.status,
      failureCode,
    },
    rawProviderResponseBytes: [],
    rawProviderResponseText: null,
    candidateText: null,
    extraction,
    eligibleForVerification: false,
    failureMessage: reason,
  };
}

export async function generateTournamentCandidates(request: TournamentGenerationRequest, adapters: readonly CandidateProviderAdapter[]): Promise<readonly ProviderGenerationAttempt[]> {
  const canonicalHash = buildCanonicalProviderRequest({ generationAttemptId: "request-hash-only", benchmarkId: request.benchmarkId, frozenMre: request.frozenMre, expectedFrozenMreHash: request.expectedFrozenMreHash, permittedTarget: request.permittedTarget }).sha256;
  return Promise.all(adapters.map(async (adapter, index) => {
    const input: CandidateGenerationInput = {
      generationAttemptId: `${request.runId}:${index + 1}:${adapter.providerId}`,
      benchmarkId: request.benchmarkId,
      frozenMre: request.frozenMre,
      expectedFrozenMreHash: request.expectedFrozenMreHash,
      permittedTarget: request.permittedTarget,
    };
    let attempt: ProviderGenerationAttempt;
    try {
      attempt = await adapter.generate(input);
    } catch (error) {
      return closedAdapterFailure(adapter, input, canonicalHash, "INTERNAL_ERROR", error instanceof Error ? error.message : "Provider adapter failed unexpectedly.");
    }
    const trustedIdentityMatches = attempt.envelope.generationAttemptId === input.generationAttemptId
      && attempt.envelope.providerId === adapter.providerId
      && attempt.envelope.modelId === adapter.modelId
      && attempt.envelope.sourceClass === REAL_EXTERNAL_MODEL_API
      && attempt.envelope.benchmarkId === request.benchmarkId
      && attempt.envelope.frozenMreHash === request.expectedFrozenMreHash
      && attempt.envelope.requestHash === canonicalHash;
    if (!trustedIdentityMatches) return closedAdapterFailure(adapter, input, canonicalHash, "UNEXPECTED_PROVIDER_METADATA", "Provider adapter returned unexpected trusted metadata.");
    return attempt;
  }));
}

export function uniqueVerificationCandidates(request: TournamentGenerationRequest, attempts: readonly ProviderGenerationAttempt[]): readonly VerificationCandidate[] {
  const groups = new Map<string, ProviderGenerationAttempt[]>();
  for (const attempt of attempts) {
    if (!attempt.eligibleForVerification || attempt.extraction.status !== "EXTRACTED" || attempt.extraction.normalizedPatchHash === null || attempt.extraction.exactPatch === null) continue;
    groups.set(attempt.extraction.normalizedPatchHash, [...(groups.get(attempt.extraction.normalizedPatchHash) ?? []), attempt]);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([normalizedPatchHash, grouped]) => ({
    verificationCandidateId: `candidate-${normalizedPatchHash.slice(0, 16)}`,
    benchmarkId: request.benchmarkId,
    frozenMreHash: request.expectedFrozenMreHash,
    permittedTarget: request.permittedTarget,
    exactPatch: grouped[0]!.extraction.exactPatch!,
    normalizedPatchHash,
    sourceAttemptIds: grouped.map((attempt) => attempt.envelope.generationAttemptId),
    sourceEnvelopes: grouped.map((attempt) => ({
      ...attempt.envelope,
      usage: attempt.envelope.usage === null ? null : { ...attempt.envelope.usage },
    })),
    workspaceIsolationKey: `${request.benchmarkId}:${normalizedPatchHash}`,
    duplicateAgreementWeight: 0,
  }));
}

export async function runAutomatedProviderTournament(request: TournamentGenerationRequest, adapters: readonly CandidateProviderAdapter[], verifier: TrustedCandidateVerifier): Promise<AutomatedTournamentResult> {
  const attempts = await generateTournamentCandidates(request, adapters);
  const verificationCandidates = uniqueVerificationCandidates(request, attempts);
  const verifications: TrustedCandidateVerification[] = [];
  for (const candidate of verificationCandidates) {
    try {
      const result = await verifier.verify(candidate);
      verifications.push(result.verificationCandidateId === candidate.verificationCandidateId ? result : { verificationCandidateId: candidate.verificationCandidateId, status: "ERROR", classification: "VERIFIER_ERROR", evidenceReferences: [], evidenceDeltaReference: null, reason: "Trusted verifier returned a mismatched candidate identity." });
    } catch (error) {
      verifications.push({ verificationCandidateId: candidate.verificationCandidateId, status: "ERROR", classification: "VERIFIER_ERROR", evidenceReferences: [], evidenceDeltaReference: null, reason: error instanceof Error ? error.message : "Trusted verifier failed." });
    }
  }
  const verifiedCandidateIds = verifications.filter((result) => result.status === "VERIFIED").map((result) => result.verificationCandidateId);
  return {
    attempts,
    verificationCandidates,
    verifications,
    verificationExecutionCount: verifications.length,
    winnerResult: verifiedCandidateIds.length > 0 ? "VERIFIED_CANDIDATE" : "NO_WINNER",
    verifiedCandidateIds,
  };
}
