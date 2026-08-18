import { Buffer } from "node:buffer";
import type { ProviderGenerationAttempt } from "./types.js";

export interface GenerationArtifact {
  relativePath: "generation-envelope.json" | "raw-provider-response.bin" | "candidate.patch";
  bytes: Uint8Array;
}

export function generationAttemptArtifacts(attempt: ProviderGenerationAttempt, forbiddenSecrets: readonly string[] = []): readonly GenerationArtifact[] {
  const artifacts: GenerationArtifact[] = [{
    relativePath: "generation-envelope.json",
    bytes: Buffer.from(`${JSON.stringify(attempt.envelope, null, 2)}\n`, "utf8"),
  }];
  if (attempt.rawProviderResponseBytes.length > 0) artifacts.push({ relativePath: "raw-provider-response.bin", bytes: Uint8Array.from(attempt.rawProviderResponseBytes) });
  if (attempt.extraction.exactPatch !== null) artifacts.push({ relativePath: "candidate.patch", bytes: Buffer.from(attempt.extraction.exactPatch, "utf8") });
  for (const secret of forbiddenSecrets.filter((value) => value.length > 0)) {
    const needle = Buffer.from(secret, "utf8");
    if (artifacts.some((artifact) => Buffer.from(artifact.bytes).includes(needle))) throw new TypeError("Refusing to persist a generation artifact containing a provider credential.");
  }
  return artifacts;
}

