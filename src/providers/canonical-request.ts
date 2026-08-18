import { Buffer } from "node:buffer";
import { bytesEqual, sha256Hex } from "./hash.js";
import type { CandidateGenerationInput, FrozenMre } from "./types.js";

export const CANONICAL_CANDIDATE_GENERATION_INSTRUCTION = [
  "You are an untrusted candidate repair generator.",
  "Use only the frozen candidate MRE bytes below.",
  "Return exactly one machine-applicable unified diff using the exact permitted target path stated in the MRE.",
  "Do not return alternate patches, edit tests or protected assets, change expected behavior, or claim trusted metadata.",
  "Do not assume repository access beyond the frozen MRE.",
].join("\n");

export class GenerationIntegrityError extends Error {
  constructor(readonly code: "MRE_HASH_MISMATCH" | "REQUEST_MUTATION" | "RESPONSE_FORMAT_FAILURE", message: string) {
    super(message);
    this.name = "GenerationIntegrityError";
  }
}

export function freezeMre(benchmarkId: string, bytesInput: Uint8Array, expectedSha256: string): FrozenMre {
  const bytes = Uint8Array.from(bytesInput);
  const actual = sha256Hex(bytes);
  if (actual !== expectedSha256) throw new GenerationIntegrityError("MRE_HASH_MISMATCH", `Frozen MRE hash mismatch for ${benchmarkId}.`);
  const immutableBytes = Object.freeze(Array.from(bytes));
  return Object.freeze({ benchmarkId, sha256: actual, byteLength: bytes.byteLength, bytes: immutableBytes });
}

export interface CanonicalProviderRequest {
  bytes: Uint8Array;
  text: string;
  sha256: string;
}

export function buildCanonicalProviderRequest(input: CandidateGenerationInput): CanonicalProviderRequest {
  if (input.benchmarkId !== input.frozenMre.benchmarkId) throw new GenerationIntegrityError("MRE_HASH_MISMATCH", "Benchmark identity does not match the frozen MRE.");
  const mreBytes = Uint8Array.from(input.frozenMre.bytes);
  const actualMreHash = sha256Hex(mreBytes);
  if (actualMreHash !== input.expectedFrozenMreHash || actualMreHash !== input.frozenMre.sha256) {
    throw new GenerationIntegrityError("MRE_HASH_MISMATCH", `Frozen MRE hash mismatch for ${input.benchmarkId}.`);
  }
  const mreText = Buffer.from(mreBytes).toString("utf8");
  if (!bytesEqual(Buffer.from(mreText, "utf8"), mreBytes)) throw new GenerationIntegrityError("RESPONSE_FORMAT_FAILURE", "Frozen MRE is not canonical UTF-8 text.");
  const prefix = Buffer.from([
    "GDN_CANDIDATE_GENERATION_REQUEST_V1",
    `benchmarkId=${input.benchmarkId}`,
    `frozenMreSha256=${actualMreHash}`,
    "",
    CANONICAL_CANDIDATE_GENERATION_INSTRUCTION,
    "",
    "-----BEGIN FROZEN MRE BYTES-----",
    "",
  ].join("\n"), "utf8");
  const suffix = Buffer.from("\n-----END FROZEN MRE BYTES-----\n", "utf8");
  const bytes = Buffer.concat([prefix, Buffer.from(mreBytes), suffix]);
  return { bytes: Uint8Array.from(bytes), text: bytes.toString("utf8"), sha256: sha256Hex(bytes) };
}
