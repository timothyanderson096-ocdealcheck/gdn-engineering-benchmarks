export const REAL_EXTERNAL_MODEL_API = "REAL_EXTERNAL_MODEL_API" as const;

export type PatchExtractionStatus =
  | "EXTRACTED"
  | "NO_PATCH"
  | "MULTIPLE_PATCHES"
  | "MALFORMED_PATCH"
  | "WRONG_TARGET"
  | "RESPONSE_FORMAT_FAILURE"
  | "EXTRACTION_AMBIGUOUS";

export type ProviderFailureCode =
  | "MISSING_API_KEY"
  | "CONFIGURATION_ERROR"
  | "PROVIDER_TIMEOUT"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR"
  | "MALFORMED_PROVIDER_RESPONSE"
  | "EMPTY_RESPONSE"
  | "PROVIDER_REFUSAL"
  | "MRE_HASH_MISMATCH"
  | "REQUEST_MUTATION"
  | "UNEXPECTED_PROVIDER_METADATA"
  | "INTERNAL_ERROR";

export interface FrozenMre {
  benchmarkId: string;
  sha256: string;
  byteLength: number;
  bytes: readonly number[];
}

export interface CandidateGenerationInput {
  generationAttemptId: string;
  benchmarkId: string;
  frozenMre: FrozenMre;
  expectedFrozenMreHash: string;
  permittedTarget: string;
}

export interface ProviderTokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface PatchExtraction {
  status: PatchExtractionStatus;
  exactPatch: string | null;
  patchHash: string | null;
  normalizedPatch: string | null;
  normalizedPatchHash: string | null;
  targets: readonly string[];
  reason: string;
}

export interface GenerationProvenanceEnvelope {
  generationAttemptId: string;
  providerId: string;
  modelId: string;
  sourceClass: typeof REAL_EXTERNAL_MODEL_API;
  benchmarkId: string;
  frozenMreHash: string;
  requestHash: string;
  providerPayloadHash: string;
  providerRequestFormat: string;
  rawResponseHash: string | null;
  patchHash: string | null;
  normalizedPatchHash: string | null;
  requestStartedAt: string;
  responseReceivedAt: string;
  generationLatencyMs: number;
  usage: ProviderTokenUsage | null;
  providerReportedCost: "UNKNOWN";
  extractionStatus: PatchExtractionStatus;
  failureCode: ProviderFailureCode | null;
}

export interface ProviderGenerationAttempt {
  envelope: GenerationProvenanceEnvelope;
  rawProviderResponseBytes: readonly number[];
  rawProviderResponseText: string | null;
  candidateText: string | null;
  extraction: PatchExtraction;
  eligibleForVerification: boolean;
  failureMessage: string | null;
}

export interface CandidateProviderAdapter {
  readonly providerId: string;
  readonly modelId: string;
  readonly providerClass: typeof REAL_EXTERNAL_MODEL_API;
  generate(input: CandidateGenerationInput): Promise<ProviderGenerationAttempt>;
}

export interface ProviderHttpRequest {
  url: string;
  method: "POST";
  headers: Readonly<Record<string, string>>;
  body: Uint8Array;
  timeoutMs: number;
}

export interface ProviderHttpResponse {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: Uint8Array;
}

export interface ProviderTransport {
  request(request: ProviderHttpRequest): Promise<ProviderHttpResponse>;
}

export interface GenerationClock {
  now(): Date;
  monotonicNowMs(): number;
}

export interface VerificationCandidate {
  verificationCandidateId: string;
  benchmarkId: string;
  frozenMreHash: string;
  permittedTarget: string;
  exactPatch: string;
  normalizedPatchHash: string;
  sourceAttemptIds: readonly string[];
  sourceEnvelopes: readonly GenerationProvenanceEnvelope[];
  workspaceIsolationKey: string;
  duplicateAgreementWeight: 0;
}

export type TrustedVerificationClassification =
  | "VERIFIED_REPAIR"
  | "TARGET_FAIL"
  | "PARTIAL_REPAIR"
  | "TARGET_FIXED_REGRESSION_INTRODUCED"
  | "TARGET_FIXED_BUT_SEMANTICALLY_WRONG"
  | "VERIFICATION_WEAKENING"
  | "FAILURE_SUPPRESSION_ATTEMPT"
  | "EVIDENCE_BYPASS_ATTEMPT"
  | "OBJECTIVE_SUBSTITUTION"
  | "PROTECTED_ASSET_TAMPERING"
  | "PATCH_APPLICATION_FAILURE"
  | "VERIFIER_ERROR";

export interface TrustedCandidateVerification {
  verificationCandidateId: string;
  status: "VERIFIED" | "REJECTED" | "ERROR";
  classification: TrustedVerificationClassification;
  evidenceReferences: readonly string[];
  evidenceDeltaReference: string | null;
  reason: string;
}

export interface TrustedCandidateVerifier {
  verify(candidate: VerificationCandidate): Promise<TrustedCandidateVerification>;
}

export interface AutomatedTournamentResult {
  attempts: readonly ProviderGenerationAttempt[];
  verificationCandidates: readonly VerificationCandidate[];
  verifications: readonly TrustedCandidateVerification[];
  verificationExecutionCount: number;
  winnerResult: "VERIFIED_CANDIDATE" | "NO_WINNER";
  verifiedCandidateIds: readonly string[];
}
