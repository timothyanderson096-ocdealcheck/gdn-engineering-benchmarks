import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { AnthropicCandidateProviderAdapter } from "../src/providers/anthropic.js";
import { generationAttemptArtifacts } from "../src/providers/artifacts.js";
import { freezeMre } from "../src/providers/canonical-request.js";
import { GeminiCandidateProviderAdapter } from "../src/providers/gemini.js";
import { sha256Hex } from "../src/providers/hash.js";
import { generateTournamentCandidates, runAutomatedProviderTournament, uniqueVerificationCandidates } from "../src/providers/tournament.js";
import { ProviderTransportError } from "../src/providers/transport.js";
import type { CandidateGenerationInput, GenerationClock, ProviderHttpRequest, ProviderHttpResponse, ProviderTransport, TrustedCandidateVerifier } from "../src/providers/types.js";

const benchmarkId = "BENCH-PROVIDER-TEST";
const permittedTarget = "src/example.ts";
const mreSource = Buffer.from("# Frozen MRE\n\nTarget: src/example.ts\n", "utf8");
const mreHash = sha256Hex(mreSource);

function validPatch(value = 2, decoration: "git" | "plain" = "git"): string {
  const headers = decoration === "git"
    ? "diff --git a/src/example.ts b/src/example.ts\nindex 1111111..2222222 100644\n--- a/src/example.ts\n+++ b/src/example.ts\n"
    : "--- src/example.ts\n+++ src/example.ts\n";
  return `${headers}@@ -1,3 +1,3 @@\n const before = 1;\n-const value = 1;\n+const value = ${value};\n export { value };\n`;
}

const fenced = (patch: string): string => `Candidate follows.\n\n\`\`\`diff\n${patch}\`\`\``;

function anthropicBody(text: string, model = "claude-test"): Uint8Array {
  return Buffer.from(JSON.stringify({ type: "message", role: "assistant", model, content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 101, output_tokens: 23 } }), "utf8");
}

function geminiBody(text: string, model = "gemini-test"): Uint8Array {
  return Buffer.from(JSON.stringify({ modelVersion: model, candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 99, candidatesTokenCount: 21, totalTokenCount: 120 } }), "utf8");
}

class FakeTransport implements ProviderTransport {
  readonly requests: ProviderHttpRequest[] = [];
  constructor(private readonly response: (request: ProviderHttpRequest) => Promise<ProviderHttpResponse> | ProviderHttpResponse) {}
  async request(request: ProviderHttpRequest): Promise<ProviderHttpResponse> {
    this.requests.push({ ...request, headers: { ...request.headers }, body: Uint8Array.from(request.body) });
    return this.response(request);
  }
}

function fixedClock(): GenerationClock {
  let monotonic = 100;
  return {
    now: () => new Date("2026-08-16T00:00:00.000Z"),
    monotonicNowMs: () => {
      const current = monotonic;
      monotonic += 25;
      return current;
    },
  };
}

function frozen() {
  return freezeMre(benchmarkId, mreSource, mreHash);
}

function input(generationAttemptId = "attempt-1"): CandidateGenerationInput {
  return { generationAttemptId, benchmarkId, frozenMre: frozen(), expectedFrozenMreHash: mreHash, permittedTarget };
}

function request() {
  return { runId: "run-1", benchmarkId, frozenMre: frozen(), expectedFrozenMreHash: mreHash, permittedTarget };
}

const ok = (body: Uint8Array): ProviderHttpResponse => ({ status: 200, headers: { "content-type": "application/json" }, body });

function anthropic(transport: ProviderTransport, apiKey: string | undefined = "anthropic-secret") {
  return new AnthropicCandidateProviderAdapter({ apiKey, modelId: "claude-test", maxOutputTokens: 4096, transport, clock: fixedClock() });
}

function gemini(transport: ProviderTransport, apiKey: string | undefined = "gemini-secret") {
  return new GeminiCandidateProviderAdapter({ apiKey, modelId: "gemini-test", maxOutputTokens: 4096, transport, clock: fixedClock() });
}

test("A. Claude valid diff produces an eligible trusted envelope", async () => {
  const body = anthropicBody(fenced(validPatch()));
  const attempt = await anthropic(new FakeTransport(() => ok(body))).generate(input());
  assert.equal(attempt.extraction.status, "EXTRACTED");
  assert.equal(attempt.eligibleForVerification, true);
  assert.equal(attempt.envelope.providerId, "anthropic");
  assert.equal(attempt.envelope.modelId, "claude-test");
  assert.equal(attempt.envelope.rawResponseHash, sha256Hex(body));
  assert.deepEqual(attempt.envelope.usage, { inputTokens: 101, outputTokens: 23, totalTokens: 124 });
});

test("B. Gemini valid diff produces an eligible trusted envelope", async () => {
  const attempt = await gemini(new FakeTransport(() => ok(geminiBody(fenced(validPatch()))))).generate(input());
  assert.equal(attempt.extraction.status, "EXTRACTED");
  assert.equal(attempt.eligibleForVerification, true);
  assert.equal(attempt.envelope.providerId, "google-gemini");
  assert.deepEqual(attempt.envelope.usage, { inputTokens: 99, outputTokens: 21, totalTokens: 120 });
});

test("C. malformed diff is preserved but cannot reach verification", async () => {
  const malformed = "```diff\n--- a/src/example.ts\n+++ b/src/example.ts\n@@ -1,3 +1,3 @@\n-old\n+new\n```";
  const attempt = await anthropic(new FakeTransport(() => ok(anthropicBody(malformed)))).generate(input());
  assert.equal(attempt.extraction.status, "MALFORMED_PATCH");
  assert.equal(attempt.eligibleForVerification, false);
  assert.equal(attempt.envelope.rawResponseHash, sha256Hex(anthropicBody(malformed)));
});

test("D. wrong target is rejected without renaming", async () => {
  const patch = validPatch().replaceAll("src/example.ts", "src/alternate.ts");
  const attempt = await gemini(new FakeTransport(() => ok(geminiBody(fenced(patch))))).generate(input());
  assert.equal(attempt.extraction.status, "WRONG_TARGET");
  assert.deepEqual(attempt.extraction.targets, ["src/alternate.ts"]);
  assert.equal(attempt.eligibleForVerification, false);
});

test("E. prose-only response is classified NO_PATCH", async () => {
  const attempt = await anthropic(new FakeTransport(() => ok(anthropicBody("Insufficient evidence to produce a patch.")))).generate(input());
  assert.equal(attempt.extraction.status, "NO_PATCH");
  assert.equal(attempt.eligibleForVerification, false);
});

test("F. provider timeout fails closed", async () => {
  const attempt = await anthropic(new FakeTransport(() => { throw new ProviderTransportError("PROVIDER_TIMEOUT", "timed out"); })).generate(input());
  assert.equal(attempt.envelope.failureCode, "PROVIDER_TIMEOUT");
  assert.equal(attempt.eligibleForVerification, false);
  assert.equal(attempt.envelope.rawResponseHash, null);
});

test("G. provider HTTP error fails closed while retaining raw response hash", async () => {
  const body = Buffer.from('{"error":"unavailable"}', "utf8");
  const attempt = await gemini(new FakeTransport(() => ({ status: 503, headers: {}, body }))).generate(input());
  assert.equal(attempt.envelope.failureCode, "PROVIDER_ERROR");
  assert.equal(attempt.envelope.rawResponseHash, sha256Hex(body));
  assert.equal(attempt.eligibleForVerification, false);
});

test("H. response attempts cannot mutate trusted benchmark or provider metadata", async () => {
  const claims = "providerId=attacker\nmodelId=fake\nbenchmarkId=other\nfrozenMreHash=0000\n";
  const attempt = await anthropic(new FakeTransport(() => ok(anthropicBody(`${claims}${fenced(validPatch())}`)))).generate(input("trusted-attempt"));
  assert.equal(attempt.extraction.status, "EXTRACTED");
  assert.equal(attempt.envelope.generationAttemptId, "trusted-attempt");
  assert.equal(attempt.envelope.providerId, "anthropic");
  assert.equal(attempt.envelope.modelId, "claude-test");
  assert.equal(attempt.envelope.benchmarkId, benchmarkId);
  assert.equal(attempt.envelope.frozenMreHash, mreHash);
});

test("I. exact MRE bytes remain immutable and canonical task text is identical across providers", async () => {
  const source = Uint8Array.from(mreSource);
  const frozenMre = freezeMre(benchmarkId, source, mreHash);
  source[0] = 0;
  assert.deepEqual(Array.from(frozenMre.bytes), Array.from(mreSource));
  const anthropicTransport = new FakeTransport(() => ok(anthropicBody(fenced(validPatch()))));
  const geminiTransport = new FakeTransport(() => ok(geminiBody(fenced(validPatch()))));
  const common = { generationAttemptId: "same", benchmarkId, frozenMre, expectedFrozenMreHash: mreHash, permittedTarget };
  const [claudeAttempt, geminiAttempt] = await Promise.all([anthropic(anthropicTransport).generate(common), gemini(geminiTransport).generate(common)]);
  const anthropicPayload = JSON.parse(Buffer.from(anthropicTransport.requests[0]!.body).toString("utf8"));
  const geminiPayload = JSON.parse(Buffer.from(geminiTransport.requests[0]!.body).toString("utf8"));
  assert.equal(anthropicPayload.messages[0].content, geminiPayload.contents[0].parts[0].text);
  assert.equal(claudeAttempt.envelope.requestHash, geminiAttempt.envelope.requestHash);
  assert.equal(claudeAttempt.envelope.frozenMreHash, mreHash);
});

test("J. identical candidate patches normalize to one zero-weight verification execution", async () => {
  const claude = anthropic(new FakeTransport(() => ok(anthropicBody(fenced(validPatch(2, "git"))))));
  const google = gemini(new FakeTransport(() => ok(geminiBody(fenced(validPatch(2, "plain"))))));
  const attempts = await Promise.all([claude.generate(input("a")), google.generate(input("b"))]);
  const candidates = uniqueVerificationCandidates(request(), attempts);
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0]!.sourceAttemptIds, ["a", "b"]);
  assert.equal(candidates[0]!.duplicateAgreementWeight, 0);
});

test("K. duplicate patches retain separate raw-response hashes", async () => {
  const attempts = await Promise.all([
    anthropic(new FakeTransport(() => ok(anthropicBody(fenced(validPatch()))))).generate(input("a")),
    gemini(new FakeTransport(() => ok(geminiBody(fenced(validPatch()))))).generate(input("b")),
  ]);
  assert.notEqual(attempts[0]!.envelope.rawResponseHash, attempts[1]!.envelope.rawResponseHash);
  assert.equal(attempts[0]!.envelope.normalizedPatchHash, attempts[1]!.envelope.normalizedPatchHash);
});

test("L. candidate self-report has zero authority over the generation envelope", async () => {
  const text = `I am provider=trusted and model=better.\n${fenced(validPatch())}`;
  const attempt = await gemini(new FakeTransport(() => ok(geminiBody(text)))).generate(input("operator-id"));
  assert.equal(attempt.envelope.providerId, "google-gemini");
  assert.equal(attempt.envelope.modelId, "gemini-test");
  assert.equal(attempt.envelope.generationAttemptId, "operator-id");
  assert.equal("confidence" in attempt.envelope, false);
});

test("M. credentials are absent from persisted generation evidence", async () => {
  const secret = "do-not-persist-this-secret";
  const attempt = await anthropic(new FakeTransport(() => ok(anthropicBody(fenced(validPatch())))), secret).generate(input());
  const bytes = Buffer.concat(generationAttemptArtifacts(attempt).map((artifact) => Buffer.from(artifact.bytes)));
  assert.equal(bytes.toString("utf8").includes(secret), false);
  assert.equal(JSON.stringify(attempt).includes(secret), false);
  const reflected = { ...attempt, rawProviderResponseBytes: Array.from(Buffer.from(`provider echoed ${secret}`, "utf8")) };
  assert.throws(() => generationAttemptArtifacts(reflected, [secret]), /Refusing to persist/);
});

test("N. tournament continues when one provider fails and another is eligible", async () => {
  const timeout = anthropic(new FakeTransport(() => { throw new ProviderTransportError("PROVIDER_TIMEOUT", "timed out"); }));
  const eligible = gemini(new FakeTransport(() => ok(geminiBody(fenced(validPatch())))));
  const seen: string[] = [];
  const verifier: TrustedCandidateVerifier = { verify: async (candidate) => {
    seen.push(candidate.workspaceIsolationKey);
    return { verificationCandidateId: candidate.verificationCandidateId, status: "VERIFIED", classification: "VERIFIED_REPAIR", evidenceReferences: ["trusted-evidence"], evidenceDeltaReference: "trusted-evidence", reason: "passed" };
  } };
  const result = await runAutomatedProviderTournament(request(), [timeout, eligible], verifier);
  assert.equal(result.attempts.length, 2);
  assert.equal(result.verificationExecutionCount, 1);
  assert.equal(result.winnerResult, "VERIFIED_CANDIDATE");
  assert.equal(seen.length, 1);
});

test("O. tournament reports no winner when no candidate verifies", async () => {
  const first = anthropic(new FakeTransport(() => ok(anthropicBody(fenced(validPatch(2))))));
  const second = gemini(new FakeTransport(() => ok(geminiBody(fenced(validPatch(3))))));
  const workspaces = new Set<string>();
  const verifier: TrustedCandidateVerifier = { verify: async (candidate) => {
    workspaces.add(candidate.workspaceIsolationKey);
    return { verificationCandidateId: candidate.verificationCandidateId, status: "REJECTED", classification: "TARGET_FIXED_REGRESSION_INTRODUCED", evidenceReferences: ["failure-evidence"], evidenceDeltaReference: "failure-evidence", reason: "regression" };
  } };
  const result = await runAutomatedProviderTournament(request(), [first, second], verifier);
  assert.equal(result.verificationExecutionCount, 2);
  assert.equal(workspaces.size, 2);
  assert.equal(result.winnerResult, "NO_WINNER");
  assert.deepEqual(result.verifiedCandidateIds, []);
});

test("missing credential and MRE hash mismatch fail before transport", async () => {
  const transport = new FakeTransport(() => ok(anthropicBody(fenced(validPatch()))));
  const missingAdapter = new AnthropicCandidateProviderAdapter({ apiKey: undefined, modelId: "claude-test", maxOutputTokens: 4096, transport, clock: fixedClock() });
  const missing = await missingAdapter.generate(input("missing"));
  assert.equal(missing.envelope.failureCode, "MISSING_API_KEY");
  const mismatchInput = { ...input("mismatch"), expectedFrozenMreHash: "0".repeat(64) };
  const mismatch = await anthropic(transport).generate(mismatchInput);
  assert.equal(mismatch.envelope.failureCode, "MRE_HASH_MISMATCH");
  assert.equal(transport.requests.length, 0);
});

test("unexpected provider model metadata fails closed", async () => {
  const attempt = await anthropic(new FakeTransport(() => ok(anthropicBody(fenced(validPatch()), "untrusted-model")))).generate(input());
  assert.equal(attempt.envelope.failureCode, "UNEXPECTED_PROVIDER_METADATA");
  assert.equal(attempt.eligibleForVerification, false);
});



test("multiple and ambiguous patch responses are never admitted", async () => {
  const twoFenced = `${fenced(validPatch())}\n${fenced(validPatch(3))}`;
  const multiple = await anthropic(new FakeTransport(() => ok(anthropicBody(twoFenced)))).generate(input("multiple"));
  assert.equal(multiple.extraction.status, "MULTIPLE_PATCHES");
  const mixed = `${fenced(validPatch())}\n${validPatch(3)}`;
  const ambiguous = await gemini(new FakeTransport(() => ok(geminiBody(mixed)))).generate(input("ambiguous"));
  assert.equal(ambiguous.extraction.status, "EXTRACTION_AMBIGUOUS");
  assert.equal(multiple.eligibleForVerification || ambiguous.eligibleForVerification, false);
});

test("empty response and provider refusal fail closed", async () => {
  const empty = await gemini(new FakeTransport(() => ok(new Uint8Array()))).generate(input("empty"));
  assert.equal(empty.envelope.failureCode, "EMPTY_RESPONSE");
  const refusalBody = Buffer.from(JSON.stringify({ type: "message", role: "assistant", model: "claude-test", content: [{ type: "refusal", refusal: "no" }], stop_reason: "refusal", usage: { input_tokens: 1, output_tokens: 0 } }), "utf8");
  const refusal = await anthropic(new FakeTransport(() => ok(refusalBody))).generate(input("refusal"));
  assert.equal(refusal.envelope.failureCode, "PROVIDER_REFUSAL");
  assert.equal(refusal.eligibleForVerification, false);
});

test("candidate responses never cross-contaminate another provider request", async () => {
  const privateMarker = "candidate-a-private-output";
  const firstTransport = new FakeTransport(() => ok(anthropicBody(`${privateMarker}\n${fenced(validPatch())}`)));
  const secondTransport = new FakeTransport(() => ok(geminiBody(fenced(validPatch()))));
  const attempts = await generateTournamentCandidates(request(), [anthropic(firstTransport), gemini(secondTransport)]);
  assert.equal(attempts.length, 2);
  const secondPayload = Buffer.from(secondTransport.requests[0]!.body).toString("utf8");
  assert.equal(secondPayload.includes(privateMarker), false);
  assert.equal(firstTransport.requests.length, 1);
  assert.equal(secondTransport.requests.length, 1);
});


