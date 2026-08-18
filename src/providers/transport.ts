import { Buffer } from "node:buffer";
import type { ProviderHttpRequest, ProviderHttpResponse, ProviderTransport } from "./types.js";

export class ProviderTransportError extends Error {
  constructor(readonly code: "PROVIDER_TIMEOUT" | "NETWORK_ERROR", message: string) {
    super(message);
    this.name = "ProviderTransportError";
  }
}

export class FetchProviderTransport implements ProviderTransport {
  async request(request: ProviderHttpRequest): Promise<ProviderHttpResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: { ...request.headers },
        body: Buffer.from(request.body),
        signal: controller.signal,
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => { headers[key] = value; });
      return { status: response.status, headers, body: new Uint8Array(await response.arrayBuffer()) };
    } catch (error) {
      if (controller.signal.aborted) throw new ProviderTransportError("PROVIDER_TIMEOUT", "Provider request timed out.");
      throw new ProviderTransportError("NETWORK_ERROR", error instanceof Error ? error.message : "Provider network request failed.");
    } finally {
      clearTimeout(timer);
    }
  }
}

export const SYSTEM_GENERATION_CLOCK = {
  now: (): Date => new Date(),
  monotonicNowMs: (): number => performance.now(),
};
