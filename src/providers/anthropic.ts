import { BaseExternalProviderAdapter, parseJsonObject, ProviderResponseError, trustedTokenCount } from "./base-adapter.js";
import type { ExternalAdapterConfig, ParsedProviderResponse } from "./base-adapter.js";

export interface AnthropicAdapterConfig extends ExternalAdapterConfig {}

export class AnthropicCandidateProviderAdapter extends BaseExternalProviderAdapter {
  readonly providerId = "anthropic";
  readonly providerRequestFormat = "ANTHROPIC_MESSAGES_V1_SINGLE_USER_TEXT";

  constructor(config: AnthropicAdapterConfig) {
    super(config);
  }

  protected endpoint(): string {
    return "https://api.anthropic.com/v1/messages";
  }

  protected requestHeaders(apiKey: string): Readonly<Record<string, string>> {
    return { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  }

  protected requestPayload(canonicalRequestText: string): unknown {
    return { max_tokens: this.maxOutputTokens, messages: [{ content: canonicalRequestText, role: "user" }], model: this.modelId, stream: false };
  }

  protected parseProviderResponse(rawResponseText: string): ParsedProviderResponse {
    const root = parseJsonObject(rawResponseText);
    if (root.type !== "message" || root.role !== "assistant") throw new ProviderResponseError("UNEXPECTED_PROVIDER_METADATA", "Anthropic response type or role is unexpected.");
    if (root.model !== this.modelId) throw new ProviderResponseError("UNEXPECTED_PROVIDER_METADATA", "Anthropic response model does not match trusted adapter configuration.");
    if (!Array.isArray(root.content)) throw new ProviderResponseError("MALFORMED_PROVIDER_RESPONSE", "Anthropic response content must be an array.");
    if (root.stop_reason === "refusal" || root.content.some((block) => typeof block === "object" && block !== null && (block as Record<string, unknown>).type === "refusal")) {
      throw new ProviderResponseError("PROVIDER_REFUSAL", "Anthropic refused the generation request.");
    }
    if (root.content.length !== 1) throw new ProviderResponseError("MALFORMED_PROVIDER_RESPONSE", "Anthropic response must contain exactly one text block.");
    const block = root.content[0];
    if (typeof block !== "object" || block === null || (block as Record<string, unknown>).type !== "text" || typeof (block as Record<string, unknown>).text !== "string") {
      throw new ProviderResponseError("MALFORMED_PROVIDER_RESPONSE", "Anthropic response does not contain one text candidate.");
    }
    const usage = typeof root.usage === "object" && root.usage !== null ? root.usage as Record<string, unknown> : {};
    const inputTokens = trustedTokenCount(usage.input_tokens);
    const outputTokens = trustedTokenCount(usage.output_tokens);
    return {
      candidateText: (block as Record<string, unknown>).text as string,
      usage: inputTokens === null && outputTokens === null ? null : { inputTokens, outputTokens, totalTokens: inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null },
    };
  }
}

export function anthropicAdapterFromEnvironment(environment: NodeJS.ProcessEnv = process.env): AnthropicCandidateProviderAdapter {
  return new AnthropicCandidateProviderAdapter({
    apiKey: environment.ANTHROPIC_API_KEY,
    modelId: environment.ANTHROPIC_MODEL_ID ?? "",
    maxOutputTokens: Number(environment.GDN_PROVIDER_MAX_OUTPUT_TOKENS ?? 8192),
  });
}
