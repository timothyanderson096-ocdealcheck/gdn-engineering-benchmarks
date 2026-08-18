import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generationAttemptArtifacts } from "../src/providers/artifacts.js";
import { TRUSTED_BENCHMARK_DEFINITIONS } from "../src/providers/benchmark-config.js";
import { buildCanonicalProviderRequest, freezeMre } from "../src/providers/canonical-request.js";
import { sha256Hex } from "../src/providers/hash.js";
import { extractCandidatePatch } from "../src/providers/patch.js";
import {
  FileSystemTrustedVerifierRuntime,
  RepositoryGroundedTrustedCandidateVerifier,
  validateTrustedBenchmarkHandoffs,
} from "../src/providers/trusted-verifier.js";
import { uniqueVerificationCandidates } from "../src/providers/tournament.js";
import type {
  PatchApplicationEvidence,
  ProcessEvidence,
  ProtectedAssetEvidence,
  TrustedBenchmarkMaterial,
  TrustedVerificationSession,
  TrustedVerifierRuntime,
} from "../src/providers/trusted-verifier.js";
import type {
  GenerationProvenanceEnvelope,
  ProviderGenerationAttempt,
  VerificationCandidate,
} from "../src/providers/types.js";

const benchmarkRoot = resolve(process.cwd(), "..", "gdn-benchmarks");
const dependencyRoot = process.cwd();
const definition = TRUSTED_BENCHMARK_DEFINITIONS["BENCH-SEEDED-REGRESSION-07"];

function patch(value = "trusted-test-value", decoration: "git" | "plain" = "git"): string {
  const header = decoration === "git"
    ? "diff --git a/src/presentation/present.ts b/src/presentation/present.ts\n--- a/src/presentation/present.ts\n+++ b/src/presentation/present.ts\n"
    : "--- src/presentation/present.ts\n+++ src/presentation/present.ts\n";
  return `${header}@@ -1,1 +1,1 @@\n-NOT_APPLICABLE_${value}\n+REPLACEMENT_${value}\n`;
}

async function makeCandidate(
  exactPatch = patch(),
  options: { target?: string; benchmarkId?: string; frozenMreHash?: string; attemptIds?: readonly string[]; forgeRequestHash?: boolean } = {},
): Promise<VerificationCandidate> {
  const benchmarkId = options.benchmarkId ?? definition.benchmarkId;
  const target = options.target ?? definition.permittedTarget;
  const frozenMreHash = options.frozenMreHash ?? definition.frozenMreSha256;
  const extracted = extractCandidatePatch("```diff\n" + exactPatch + "```", definition.permittedTarget);
  assert.equal(extracted.status, "EXTRACTED");
  const mreBytes = new Uint8Array(await readFile(resolve(benchmarkRoot, definition.benchmarkId, definition.frozenMreRelativePath)));
  const frozenMre = freezeMre(definition.benchmarkId, mreBytes, definition.frozenMreSha256);
  const requestHash = buildCanonicalProviderRequest({
    generationAttemptId: "test",
    benchmarkId: definition.benchmarkId,
    frozenMre,
    expectedFrozenMreHash: definition.frozenMreSha256,
    permittedTarget: definition.permittedTarget,
  }).sha256;
  const attemptIds = options.attemptIds ?? ["attempt-1"];
  const envelopes: GenerationProvenanceEnvelope[] = attemptIds.map((generationAttemptId, index) => ({
    generationAttemptId,
    providerId: index === 0 ? "anthropic" : "google-gemini",
    modelId: index === 0 ? "claude-test" : "gemini-test",
    sourceClass: "REAL_EXTERNAL_MODEL_API",
    benchmarkId: definition.benchmarkId,
    frozenMreHash: definition.frozenMreSha256,
    requestHash: options.forgeRequestHash ? "0".repeat(64) : requestHash,
    providerPayloadHash: "1".repeat(64),
    providerRequestFormat: "MOCK",
    rawResponseHash: "2".repeat(64),
    patchHash: extracted.patchHash,
    normalizedPatchHash: extracted.normalizedPatchHash,
    requestStartedAt: "2026-08-16T00:00:00.000Z",
    responseReceivedAt: "2026-08-16T00:00:00.100Z",
    generationLatencyMs: 100,
    usage: null,
    providerReportedCost: "UNKNOWN",
    extractionStatus: "EXTRACTED",
    failureCode: null,
  }));
  return {
    verificationCandidateId: `candidate-${extracted.normalizedPatchHash!.slice(0, 16)}`,
    benchmarkId,
    frozenMreHash,
    permittedTarget: target,
    exactPatch,
    normalizedPatchHash: extracted.normalizedPatchHash!,
    sourceAttemptIds: attemptIds,
    sourceEnvelopes: envelopes,
    workspaceIsolationKey: `${benchmarkId}:${extracted.normalizedPatchHash}`,
    duplicateAgreementWeight: 0,
  };
}

function processEvidence(commandId: string, passed: boolean): ProcessEvidence {
  return {
    id: commandId,
    displayCommand: commandId,
    effectiveInvocation: ["mock"],
    startedAt: "2026-08-16T00:00:00.000Z",
    completedAt: "2026-08-16T00:00:00.001Z",
    durationMs: 1,
    exitCode: passed ? 0 : 1,
    timedOut: false,
    outputLimitExceeded: false,
    stdoutSha256: sha256Hex(""),
    stderrSha256: sha256Hex(""),
    stdoutArtifact: `${commandId}.stdout`,
    stderrArtifact: `${commandId}.stderr`,
    passed,
  };
}

function protectedEvidence(stage: string, passed: boolean): ProtectedAssetEvidence {
  return {
    stage,
    passed,
    changedProtectedPaths: passed ? [] : ["test/protected.test.ts"],
    missingProtectedPaths: [],
    addedProtectedPaths: [],
    runtimeModifiedPaths: [],
    dependencyTreeChanged: false,
    manifestSha256: "3".repeat(64),
    reason: passed ? "protected" : "tampered",
  };
}

interface Scenario {
  prepareThrows?: boolean;
  applyPasses?: boolean;
  protectedFailureStage?: string;
  commandFailures?: ReadonlySet<string>;
  sourceUnchanged?: boolean;
}

class MockRuntime implements TrustedVerifierRuntime {
  prepareCalls = 0;
  readonly workspaceIds: string[] = [];
  readonly commandIds: string[] = [];

  constructor(private readonly scenario: Scenario = {}) {}

  async prepare(
    _material: TrustedBenchmarkMaterial,
    candidate: VerificationCandidate,
    _evidenceDirectory: string,
  ): Promise<TrustedVerificationSession> {
    this.prepareCalls += 1;
    if (this.scenario.prepareThrows) throw new Error("mock verifier exception");
    const workspaceId = `mock-workspace-${this.prepareCalls}-${candidate.verificationCandidateId}`;
    this.workspaceIds.push(workspaceId);
    const runtime = this;
    return {
      workspaceId,
      evidenceReferences: [],
      applyExactPatch: async (): Promise<PatchApplicationEvidence> => ({
        applicable: runtime.scenario.applyPasses ?? true,
        applied: runtime.scenario.applyPasses ?? true,
        checkExitCode: runtime.scenario.applyPasses === false ? 1 : 0,
        applyExitCode: runtime.scenario.applyPasses === false ? null : 0,
        exactPatchSha256: sha256Hex(candidate.exactPatch),
        reason: runtime.scenario.applyPasses === false ? "not applicable" : "applied",
      }),
      auditProtectedAssets: async (stage) => protectedEvidence(stage, runtime.scenario.protectedFailureStage !== stage),
      run: async (command) => {
        runtime.commandIds.push(command.id);
        return processEvidence(command.id, !runtime.scenario.commandFailures?.has(command.id));
      },
      seededBenchmarkSourceUnchanged: async () => runtime.scenario.sourceUnchanged ?? true,
      close: async () => {},
    };
  }
}

async function withVerifier(
  scenario: Scenario,
  action: (verifier: RepositoryGroundedTrustedCandidateVerifier, runtime: MockRuntime, temp: string) => Promise<void>,
): Promise<void> {
  const temp = await mkdtemp(join(tmpdir(), "gdn-verifier-test-"));
  const runtime = new MockRuntime(scenario);
  const verifier = new RepositoryGroundedTrustedCandidateVerifier({
    benchmarkRoot,
    evidenceRoot: join(temp, "evidence"),
    dependencyRoot,
    runtime,
  });
  try {
    await action(verifier, runtime, temp);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
function attemptFromCandidate(candidate: VerificationCandidate, index = 0): ProviderGenerationAttempt {
  const extraction = extractCandidatePatch("```diff\n" + candidate.exactPatch + "```", definition.permittedTarget);
  assert.equal(extraction.status, "EXTRACTED");
  return {
    envelope: candidate.sourceEnvelopes[index]!,
    rawProviderResponseBytes: [index + 1],
    rawProviderResponseText: candidate.exactPatch,
    candidateText: candidate.exactPatch,
    extraction,
    eligibleForVerification: true,
    failureMessage: null,
  };
}

async function generationRequest() {
  const mreBytes = new Uint8Array(await readFile(resolve(benchmarkRoot, definition.benchmarkId, definition.frozenMreRelativePath)));
  return {
    runId: "trusted-verifier-test",
    benchmarkId: definition.benchmarkId,
    frozenMre: freezeMre(definition.benchmarkId, mreBytes, definition.frozenMreSha256),
    expectedFrozenMreHash: definition.frozenMreSha256,
    permittedTarget: definition.permittedTarget,
  };
}

function reverseTrustedSeedPatch(seed: string): string {
  return seed.replaceAll("\r\n", "\n").split("\n").map((line) => {
    const hunk = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
    if (hunk) {
      const oldCount = hunk[2] === undefined ? "" : `,${hunk[2]}`;
      const newCount = hunk[4] === undefined ? "" : `,${hunk[4]}`;
      return `@@ -${hunk[3]}${newCount} +${hunk[1]}${oldCount} @@${hunk[5]}`;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) return `-${line.slice(1)}`;
    if (line.startsWith("-") && !line.startsWith("---")) return `+${line.slice(1)}`;
    return line;
  }).join("\n");
}
test("1. valid eligible candidate reaches the trusted verifier", async () => {
  await withVerifier({}, async (verifier, runtime) => {
    const result = await verifier.verify(await makeCandidate());
    assert.equal(runtime.prepareCalls, 1);
    assert.equal(result.classification, "VERIFIED_REPAIR");
    assert.equal(result.status, "VERIFIED");
  });
});

test("2. wrong target is rejected before workspace execution", async () => {
  await withVerifier({}, async (verifier, runtime) => {
    const candidate = await makeCandidate();
    const result = await verifier.verify({ ...candidate, permittedTarget: "src/wrong.ts" });
    assert.equal(runtime.prepareCalls, 0);
    assert.equal(result.classification, "OBJECTIVE_SUBSTITUTION");
  });
});

test("3. malformed patch is rejected before workspace execution", async () => {
  await withVerifier({}, async (verifier, runtime) => {
    const candidate = await makeCandidate();
    const result = await verifier.verify({ ...candidate, exactPatch: "--- broken\n+++ broken\n" });
    assert.equal(runtime.prepareCalls, 0);
    assert.equal(result.status, "REJECTED");
  });
});

test("4. protected-asset mutation is rejected", async () => {
  await withVerifier({ protectedFailureStage: "after-patch" }, async (verifier, runtime) => {
    const result = await verifier.verify(await makeCandidate());
    assert.equal(runtime.commandIds.length, 0);
    assert.equal(result.classification, "PROTECTED_ASSET_TAMPERING");
  });
});

test("5. target and discriminator pass but regression failure is rejected", async () => {
  await withVerifier({ commandFailures: new Set(["full-test-suite"]) }, async (verifier, runtime) => {
    const result = await verifier.verify(await makeCandidate());
    assert.deepEqual(runtime.commandIds, ["targeted-presentation", "independent-sibling-regression", "typecheck", "full-test-suite"]);
    assert.equal(result.classification, "TARGET_FIXED_REGRESSION_INTRODUCED");
    assert.equal(result.status, "REJECTED");
  });
});

test("6. target pass plus independent discriminator failure is rejected", async () => {
  await withVerifier({ commandFailures: new Set(["independent-sibling-regression"]) }, async (verifier) => {
    const result = await verifier.verify(await makeCandidate());
    assert.equal(result.classification, "TARGET_FIXED_REGRESSION_INTRODUCED");
    assert.equal(result.status, "REJECTED");
  });
  assert.equal(TRUSTED_BENCHMARK_DEFINITIONS["BENCH-SEEDED-COMPETING-REPAIRS-08"].discriminatorFailureClassification, "TARGET_FIXED_BUT_SEMANTICALLY_WRONG");
  assert.equal(TRUSTED_BENCHMARK_DEFINITIONS["BENCH-SEEDED-ADVERSARIAL-09"].discriminatorFailureClassification, "VERIFICATION_WEAKENING");
  assert.equal(TRUSTED_BENCHMARK_DEFINITIONS["BENCH-SEEDED-MULTISTEP-10"].discriminatorFailureClassification, "PARTIAL_REPAIR");
});

test("7. complete trusted chain returns VERIFIED_REPAIR with EvidenceDelta", async () => {
  await withVerifier({}, async (verifier) => {
    const result = await verifier.verify(await makeCandidate());
    assert.equal(result.classification, "VERIFIED_REPAIR");
    assert.ok(result.evidenceDeltaReference);
    const delta = JSON.parse(await readFile(result.evidenceDeltaReference!, "utf8"));
    assert.equal(delta.seededFailureEvidence.sha256, definition.seededFailureSha256);
    assert.equal(delta.candidateEvidence.commands.length, 4);
    assert.equal(delta.duplicateAgreementWeight, 0);
  });
});

test("8. verifier exception fails closed", async () => {
  await withVerifier({ prepareThrows: true }, async (verifier) => {
    const result = await verifier.verify(await makeCandidate());
    assert.equal(result.classification, "VERIFIER_ERROR");
    assert.equal(result.status, "ERROR");
    assert.match(result.reason, /mock verifier exception/);
  });
});

test("9. candidate cannot forge trusted generation or verification metadata", async () => {
  await withVerifier({}, async (verifier, runtime) => {
    const candidate = await makeCandidate(patch(), { forgeRequestHash: true });
    const forged = { ...candidate, verificationStatus: "VERIFIED", confidence: 1 } as VerificationCandidate;
    const result = await verifier.verify(forged);
    assert.equal(runtime.prepareCalls, 0);
    assert.equal(result.classification, "OBJECTIVE_SUBSTITUTION");
    assert.equal(result.status, "REJECTED");
  });
});

test("10. normalized duplicate candidates share exactly one verification execution", async () => {
  const first = await makeCandidate(patch("duplicate", "git"), { attemptIds: ["claude-attempt"] });
  const second = await makeCandidate(patch("duplicate", "plain"), { attemptIds: ["gemini-attempt"] });
  const candidates = uniqueVerificationCandidates(await generationRequest(), [attemptFromCandidate(first), attemptFromCandidate(second)]);
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0]!.sourceAttemptIds, ["claude-attempt", "gemini-attempt"]);
  assert.equal(candidates[0]!.duplicateAgreementWeight, 0);
  await withVerifier({}, async (verifier, runtime) => {
    const results = await Promise.all(candidates.map((candidate) => verifier.verify(candidate)));
    assert.equal(runtime.prepareCalls, 1);
    assert.equal(results[0]!.classification, "VERIFIED_REPAIR");
  });
});

test("11. distinct candidates receive distinct isolated workspace sessions", async () => {
  await withVerifier({}, async (verifier, runtime) => {
    await verifier.verify(await makeCandidate(patch("one")));
    await verifier.verify(await makeCandidate(patch("two")));
    assert.equal(runtime.prepareCalls, 2);
    assert.equal(new Set(runtime.workspaceIds).size, 2);
  });
});

test("12. concrete patch-check isolation leaves the seeded benchmark source unchanged", async () => {
  const temp = await mkdtemp(join(tmpdir(), "gdn-real-runtime-test-"));
  const seededTarget = resolve(benchmarkRoot, definition.benchmarkId, "benchmark-workspace", definition.permittedTarget);
  const before = sha256Hex(await readFile(seededTarget));
  const verifier = new RepositoryGroundedTrustedCandidateVerifier({
    benchmarkRoot,
    evidenceRoot: join(temp, "evidence"),
    dependencyRoot,
    workspaceRoot: join(temp, "workspaces"),
    runtime: new FileSystemTrustedVerifierRuntime({ dependencyRoot, workspaceRoot: join(temp, "workspaces") }),
  });
  try {
    const result = await verifier.verify(await makeCandidate(patch("non-applicable")));
    assert.equal(result.classification, "PATCH_APPLICATION_FAILURE");
    assert.equal(sha256Hex(await readFile(seededTarget)), before);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("13. trusted control and answer-key data never enters provider artifacts", async () => {
  const candidate = await makeCandidate();
  const attempt = attemptFromCandidate(candidate);
  const artifacts = generationAttemptArtifacts(attempt);
  const combined = Buffer.concat(artifacts.map((artifact) => Buffer.from(artifact.bytes))).toString("utf8");
  assert.equal(combined.includes("TRUSTED_CONTROL_AUDIT"), false);
  assert.equal(combined.includes("MUT-REGRESSION-07-AUTO-DISCLOSURE-FALLBACK"), false);
  assert.equal(combined.includes("regression-sensitivity.ts"), false);
});

test("14. verification has no capability-registry update path before proof", async () => {
  const source = await readFile(resolve(process.cwd(), "src/providers/trusted-verifier.ts"), "utf8");
  assert.equal(source.includes("updateCapabilityRegistry"), false);
  await withVerifier({ commandFailures: new Set(["targeted-presentation"]) }, async (verifier) => {
    const result = await verifier.verify(await makeCandidate());
    assert.equal(result.classification, "TARGET_FAIL");
    assert.equal("capabilityRegistryUpdate" in result, false);
  });
});

test("15. all four hard benchmarks produce hash-validated verification handoffs without provider calls", async () => {
  const handoffs = await validateTrustedBenchmarkHandoffs(benchmarkRoot);
  assert.deepEqual(handoffs.map((handoff) => handoff.benchmarkId), [
    "BENCH-SEEDED-REGRESSION-07",
    "BENCH-SEEDED-COMPETING-REPAIRS-08",
    "BENCH-SEEDED-ADVERSARIAL-09",
    "BENCH-SEEDED-MULTISTEP-10",
  ]);
  for (const handoff of handoffs) {
    assert.match(handoff.frozenMreSha256, /^[a-f0-9]{64}$/);
    assert.equal(handoff.regressionCommands.includes("npm run typecheck"), true);
    assert.equal(handoff.regressionCommands.includes("npm test"), true);
  }
});

test("16. concrete repository-grounded verifier accepts the private trusted control repair", async () => {
  const temp = await mkdtemp(join(tmpdir(), "gdn-full-chain-test-"));
  const seed = await readFile(resolve(benchmarkRoot, definition.benchmarkId, definition.seedMutationRelativePath), "utf8");
  const reversePatch = reverseTrustedSeedPatch(seed);
  const verifier = new RepositoryGroundedTrustedCandidateVerifier({
    benchmarkRoot,
    evidenceRoot: join(temp, "evidence"),
    dependencyRoot,
    workspaceRoot: join(temp, "workspaces"),
  });
  try {
    const result = await verifier.verify(await makeCandidate(reversePatch));
    assert.equal(result.classification, "VERIFIED_REPAIR", result.reason);
    assert.equal(result.status, "VERIFIED");
    assert.ok(result.evidenceDeltaReference);
    const delta = JSON.parse(await readFile(result.evidenceDeltaReference!, "utf8"));
    assert.deepEqual(delta.candidateEvidence.commands.map((command: ProcessEvidence) => command.id), [
      "targeted-presentation",
      "independent-sibling-regression",
      "typecheck",
      "full-test-suite",
    ]);
    for (const command of delta.candidateEvidence.commands as ProcessEvidence[]) {
      assert.ok(command.effectiveInvocation.includes("--permission"));
      assert.equal(command.effectiveInvocation.some((argument) => argument.startsWith("--allow-net")), false);
      assert.equal(command.effectiveInvocation.some((argument) => argument.startsWith("--allow-child-process")), false);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});