import { Buffer } from "node:buffer";
import { buildCanonicalProviderRequest, GenerationIntegrityError } from "./canonical-request.js";
import { sha256Hex, stableJson } from "./hash.js";
import { extractCandidatePatch } from "./patch.js";
import { FetchProviderTransport, ProviderTransportError, SYSTEM_GENERATION_CLOCK } from "./transport.js";
import { REAL_EXTERNAL_MODEL_API } from "./types.js";
import type {
  CandidateGenerationInput,
  CandidateProviderAdapter,
  GenerationClock,
  PatchExtraction,
  ProviderFailureCode,
  ProviderGenerationAttempt,
  ProviderHttpResponse,
  ProviderTokenUsage,
  ProviderTransport,
} from "./types.js";

export class ProviderResponseError extends Error {
  constructor(readonly code: "MALFORMED_PROVIDER_RESPONSE" | "EMPTY_RESPONSE" | "PROVIDER_REFUSAL" | "UNEXPECTED_PROVIDER_METADATA", message: string) {
    super(message);
    this.name = "ProviderResponseError";
  }
}

export interface ParsedProviderResponse {
  candidateText: string;
  usage: ProviderTokenUsage | null;
}

export interface ExternalAdapterConfig {
  apiKey: string | undefined;
  modelId: string;
  maxOutputTokens: number;
  timeoutMs?: number;
  transport?: ProviderTransport;
  clock?: GenerationClock;
}

const noPatch = (reason: string): PatchExtraction => ({
  status: "RESPONSE_FORMAT_FAILURE",
  exactPatch: null,
  patchHash: null,
  normalizedPatch: null,
  normalizedPatchHash: null,
  targets: [],
  reason,
});

export abstract class BaseExternalProviderAdapter implements CandidateProviderAdapter {
  abstract readonly providerId: string;
  abstract readonly providerRequestFormat: string;
  readonly providerClass = REAL_EXTERNAL_MODEL_API;
  readonly modelId: string;
  protected readonly apiKey: string | undefined;
  protected readonly maxOutputTokens: number;
  protected readonly timeoutMs: number;
  protected readonly transport: ProviderTransport;
  protected readonly clock: GenerationClock;

  protected constructor(config: ExternalAdapterConfig) {
    this.apiKey = config.apiKey;
    this.modelId = config.modelId;
    this.maxOutputTokens = config.maxOutputTokens;
    this.timeoutMs = config.timeoutMs ?? 120_000;
    this.transport = config.transport ?? new FetchProviderTransport();
    this.clock = config.clock ?? SYSTEM_GENERATION_CLOCK;
  }

  protected abstract endpoint(): string;
  protected abstract requestHeaders(apiKey: string): Readonly<Record<string, string>>;
  protected abstract requestPayload(canonicalRequestText: string): unknown;
  protected abstract parseProviderResponse(rawResponseText: string): ParsedProviderResponse;

  private failedAttempt(args: {
    input: CandidateGenerationInput;
    requestHash: string;
    payloadHash: string;
    startedAt: string;
    receivedAt: string;
    latencyMs: number;
    failureCode: ProviderFailureCode;
    message: string;
    rawBytes?: Uint8Array;
    rawText?: string;
  }): ProviderGenerationAttempt {
    const extraction = noPatch(args.message);
    const bytes = args.rawBytes ?? new Uint8Array();
    return {
      envelope: {
        generationAttemptId: args.input.generationAttemptId,
        providerId: this.providerId,
        modelId: this.modelId,
        sourceClass: REAL_EXTERNAL_MODEL_API,
        benchmarkId: args.input.benchmarkId,
        frozenMreHash: args.input.expectedFrozenMreHash,
        requestHash: args.requestHash,
        providerPayloadHash: args.payloadHash,
        providerRequestFormat: this.providerRequestFormat,
        rawResponseHash: bytes.byteLength > 0 ? sha256Hex(bytes) : null,
        patchHash: null,
        normalizedPatchHash: null,
        requestStartedAt: args.startedAt,
        responseReceivedAt: args.receivedAt,
        generationLatencyMs: args.latencyMs,
        usage: null,
        providerReportedCost: "UNKNOWN",
        extractionStatus: extraction.status,
        failureCode: args.failureCode,
      },
      rawProviderResponseBytes: Object.freeze(Array.from(bytes)),
      rawProviderResponseText: args.rawText ?? null,
      candidateText: null,
      extraction,
      eligibleForVerification: false,
      failureMessage: args.message,
    };
  }

  async generate(input: CandidateGenerationInput): Promise<ProviderGenerationAttempt> {
    let canonical;
    try {
      canonical = buildCanonicalProviderRequest(input);
    } catch (error) {
      const started = this.clock.now().toISOString();
      const code = error instanceof GenerationIntegrityError && error.code === "MRE_HASH_MISMATCH" ? "MRE_HASH_MISMATCH" : "INTERNAL_ERROR";
      const rejectionHash = sha256Hex(stableJson({ benchmarkId: input.benchmarkId, expectedFrozenMreHash: input.expectedFrozenMreHash, observedFrozenMreHash: sha256Hex(Uint8Array.from(input.frozenMre.bytes)), disposition: "REJECTED_BEFORE_REQUEST" }));
      return this.failedAttempt({ input, requestHash: rejectionHash, payloadHash: rejectionHash, startedAt: started, receivedAt: started, latencyMs: 0, failureCode: code, message: error instanceof Error ? error.message : "Canonical request construction failed." });
    }

    const startedAt = this.clock.now().toISOString();
    const startedMono = this.clock.monotonicNowMs();
    const finish = () => ({ receivedAt: this.clock.now().toISOString(), latencyMs: Math.max(0, this.clock.monotonicNowMs() - startedMono) });
    if (!Number.isSafeInteger(this.maxOutputTokens) || this.maxOutputTokens <= 0 || !Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      const timing = finish();
      const invalidConfigurationHash = sha256Hex("INVALID_PROVIDER_CONFIGURATION");
      return this.failedAttempt({ input, requestHash: canonical.sha256, payloadHash: invalidConfigurationHash, startedAt, ...timing, failureCode: "CONFIGURATION_ERROR", message: "Provider limits must be finite positive integers." });
    }
    const payloadText = stableJson(this.requestPayload(canonical.text));
    const payloadBytes = Buffer.from(payloadText, "utf8");

    if (this.modelId.trim().length === 0) {
      const timing = finish();
      return this.failedAttempt({ input, requestHash: canonical.sha256, payloadHash: sha256Hex(payloadBytes), startedAt, ...timing, failureCode: "CONFIGURATION_ERROR", message: "A trusted model ID must be configured for the provider adapter." });
    }
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      const timing = finish();
      return this.failedAttempt({ input, requestHash: canonical.sha256, payloadHash: sha256Hex(payloadBytes), startedAt, ...timing, failureCode: "MISSING_API_KEY", message: `Missing API credential for ${this.providerId}.` });
    }

    let response: ProviderHttpResponse;
    try {
      response = await this.transport.request({ url: this.endpoint(), method: "POST", headers: this.requestHeaders(this.apiKey), body: Uint8Array.from(payloadBytes), timeoutMs: this.timeoutMs });
    } catch (error) {
      const timing = finish();
      const code = error instanceof ProviderTransportError ? error.code : "NETWORK_ERROR";
      return this.failedAttempt({ input, requestHash: canonical.sha256, payloadHash: sha256Hex(payloadBytes), startedAt, ...timing, failureCode: code, message: error instanceof Error ? error.message : "Provider request failed." });
    }

    const timing = finish();
    const rawBytes = Uint8Array.from(response.body);
    const rawResponseHash = rawBytes.byteLength > 0 ? sha256Hex(rawBytes) : null;
    const rawText = Buffer.from(rawBytes).toString("utf8");
    if (response.status < 200 || response.status >= 300) {
      return this.failedAttempt({ input, requestHash: canonical.sha256, payloadHash: sha256Hex(payloadBytes), startedAt, ...timing, failureCode: "PROVIDER_ERROR", message: `Provider returned HTTP ${response.status}.`, rawBytes, rawText });
    }
    if (rawBytes.byteLength === 0) {
      return this.failedAttempt({ input, requestHash: canonical.sha256, payloadHash: sha256Hex(payloadBytes), startedAt, ...timing, failureCode: "EMPTY_RESPONSE", message: "Provider returned an empty response body." });
    }

    try {
      const after = buildCanonicalProviderRequest(input);
      if (after.sha256 !== canonical.sha256) throw new GenerationIntegrityError("REQUEST_MUTATION", "Canonical provider request changed during generation.");
    } catch (error) {
      return this.failedAttempt({ input, requestHash: canonical.sha256, payloadHash: sha256Hex(payloadBytes), startedAt, ...timing, failureCode: "REQUEST_MUTATION", message: error instanceof Error ? error.message : "Canonical provider request changed during generation.", rawBytes, rawText });
    }

    let parsed: ParsedProviderResponse;
    try {
      parsed = this.parseProviderResponse(rawText);
    } catch (error) {
      const code = error instanceof ProviderResponseError ? error.code : "MALFORMED_PROVIDER_RESPONSE";
      return this.failedAttempt({ input, requestHash: canonical.sha256, payloadHash: sha256Hex(payloadBytes), startedAt, ...timing, failureCode: code, message: error instanceof Error ? error.message : "Provider response could not be parsed.", rawBytes, rawText });
    }
    if (parsed.candidateText.trim().length === 0) {
      return this.failedAttempt({ input, requestHash: canonical.sha256, payloadHash: sha256Hex(payloadBytes), startedAt, ...timing, failureCode: "EMPTY_RESPONSE", message: "Provider returned no candidate text.", rawBytes, rawText });
    }

    const extraction = extractCandidatePatch(parsed.candidateText, input.permittedTarget);
    return {
      envelope: {
        generationAttemptId: input.generationAttemptId,
        providerId: this.providerId,
        modelId: this.modelId,
        sourceClass: REAL_EXTERNAL_MODEL_API,
        benchmarkId: input.benchmarkId,
        frozenMreHash: input.expectedFrozenMreHash,
        requestHash: canonical.sha256,
        providerPayloadHash: sha256Hex(payloadBytes),
        providerRequestFormat: this.providerRequestFormat,
        rawResponseHash,
        patchHash: extraction.patchHash,
        normalizedPatchHash: extraction.normalizedPatchHash,
        requestStartedAt: startedAt,
        responseReceivedAt: timing.receivedAt,
        generationLatencyMs: timing.latencyMs,
        usage: parsed.usage,
        providerReportedCost: "UNKNOWN",
        extractionStatus: extraction.status,
        failureCode: null,
      },
      rawProviderResponseBytes: Object.freeze(Array.from(rawBytes)),
      rawProviderResponseText: rawText,
      candidateText: parsed.candidateText,
      extraction,
      eligibleForVerification: extraction.status === "EXTRACTED",
      failureMessage: extraction.status === "EXTRACTED" ? null : extraction.reason,
    };
  }
}

export function trustedTokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function parseJsonObject(raw: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ProviderResponseError("MALFORMED_PROVIDER_RESPONSE", "Provider response is not valid JSON.");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new ProviderResponseError("MALFORMED_PROVIDER_RESPONSE", "Provider response root must be an object.");
  return value as Record<string, unknown>;
}

