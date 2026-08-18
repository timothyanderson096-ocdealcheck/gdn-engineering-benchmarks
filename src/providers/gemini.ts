import { BaseExternalProviderAdapter, parseJsonObject, ProviderResponseError, trustedTokenCount } from "./base-adapter.js";
import type { ExternalAdapterConfig, ParsedProviderResponse } from "./base-adapter.js";

export interface GeminiAdapterConfig extends ExternalAdapterConfig {}

export class GeminiCandidateProviderAdapter extends BaseExternalProviderAdapter {
  readonly providerId = "google-gemini";
  readonly providerRequestFormat = "GEMINI_GENERATE_CONTENT_V1BETA_SINGLE_USER_TEXT";

  constructor(config: GeminiAdapterConfig) {
    super(config);
  }

  protected endpoint(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelId)}:generateContent`;
  }

  protected requestHeaders(apiKey: string): Readonly<Record<string, string>> {
    return { "content-type": "application/json", "x-goog-api-key": apiKey };
  }

  protected requestPayload(canonicalRequestText: string): unknown {
    return { contents: [{ parts: [{ text: canonicalRequestText }], role: "user" }], generationConfig: { maxOutputTokens: this.maxOutputTokens } };
  }

  protected parseProviderResponse(rawResponseText: string): ParsedProviderResponse {
    const root = parseJsonObject(rawResponseText);
    if (typeof root.modelVersion === "string" && root.modelVersion !== this.modelId) throw new ProviderResponseError("UNEXPECTED_PROVIDER_METADATA", "Gemini response model does not match trusted adapter configuration.");
    if (!Array.isArray(root.candidates) || root.candidates.length !== 1) throw new ProviderResponseError("MALFORMED_PROVIDER_RESPONSE", "Gemini response must contain exactly one candidate.");
    const candidate = root.candidates[0];
    if (typeof candidate !== "object" || candidate === null) throw new ProviderResponseError("MALFORMED_PROVIDER_RESPONSE", "Gemini candidate must be an object.");
    const candidateRecord = candidate as Record<string, unknown>;
    if (["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"].includes(String(candidateRecord.finishReason))) {
      throw new ProviderResponseError("PROVIDER_REFUSAL", "Gemini blocked or refused the generation request.");
    }
    const content = candidateRecord.content;
    if (typeof content !== "object" || content === null || !Array.isArray((content as Record<string, unknown>).parts)) {
      throw new ProviderResponseError("MALFORMED_PROVIDER_RESPONSE", "Gemini candidate content is malformed.");
    }
    const parts = (content as Record<string, unknown>).parts as unknown[];
    if (parts.length !== 1 || typeof parts[0] !== "object" || parts[0] === null || typeof (parts[0] as Record<string, unknown>).text !== "string") {
      throw new ProviderResponseError("MALFORMED_PROVIDER_RESPONSE", "Gemini response does not contain one text candidate.");
    }
    const usage = typeof root.usageMetadata === "object" && root.usageMetadata !== null ? root.usageMetadata as Record<string, unknown> : {};
    const inputTokens = trustedTokenCount(usage.promptTokenCount);
    const outputTokens = trustedTokenCount(usage.candidatesTokenCount);
    const reportedTotal = trustedTokenCount(usage.totalTokenCount);
    return {
      candidateText: (parts[0] as Record<string, unknown>).text as string,
      usage: inputTokens === null && outputTokens === null && reportedTotal === null ? null : { inputTokens, outputTokens, totalTokens: reportedTotal ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null) },
    };
  }
}

export function geminiAdapterFromEnvironment(environment: NodeJS.ProcessEnv = process.env): GeminiCandidateProviderAdapter {
  return new GeminiCandidateProviderAdapter({
    apiKey: environment.GEMINI_API_KEY,
    modelId: environment.GEMINI_MODEL_ID ?? "",
    maxOutputTokens: Number(environment.GDN_PROVIDER_MAX_OUTPUT_TOKENS ?? 8192),
  });
}
