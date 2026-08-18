import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { anthropicAdapterFromEnvironment } from "../src/providers/anthropic.js";
import { generationAttemptArtifacts } from "../src/providers/artifacts.js";
import { freezeMre } from "../src/providers/canonical-request.js";
import { geminiAdapterFromEnvironment } from "../src/providers/gemini.js";
import { RepositoryGroundedTrustedCandidateVerifier } from "../src/providers/trusted-verifier.js";
import { runAutomatedProviderTournament } from "../src/providers/tournament.js";

const difficultBenchmarks = {
  "BENCH-SEEDED-REGRESSION-07": { frozenMreHash: "c74d834b0875c4804f4dc2ed49ce8f7e04e337404cbdc587e8024f86b778d0c5", permittedTarget: "src/presentation/present.ts" },
  "BENCH-SEEDED-COMPETING-REPAIRS-08": { frozenMreHash: "419adf0bfacd8c6d4b784fd1fddb6aaf69c908557c0666760c72ea9837b4fb26", permittedTarget: "src/orchestration/session.ts" },
  "BENCH-SEEDED-ADVERSARIAL-09": { frozenMreHash: "b9d1fa502486eff5813a8be14e1944b4cac15baf197cd8f4c768fd056213f3ac", permittedTarget: "src/context/measurement.ts" },
  "BENCH-SEEDED-MULTISTEP-10": { frozenMreHash: "01c5a971533dc05b5400773d8d93653f90919a7d51185c87bd9ceada8c9e5c83", permittedTarget: "src/expansion/reassess.ts" },
} as const;

type DifficultBenchmarkId = keyof typeof difficultBenchmarks;

function valuesAfter(flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) if (process.argv[index] === flag && process.argv[index + 1]) values.push(process.argv[index + 1]!);
  return values;
}

function oneValue(flag: string): string | undefined {
  const values = valuesAfter(flag);
  if (values.length > 1) throw new TypeError(`${flag} may be supplied only once.`);
  return values[0];
}

function safeName(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9._-]/g, "_");
}

async function persistAttempt(directory: string, attempt: Awaited<ReturnType<typeof runAutomatedProviderTournament>>["attempts"][number], forbiddenSecrets: readonly string[]): Promise<void> {
  await mkdir(directory, { recursive: true });
  for (const artifact of generationAttemptArtifacts(attempt, forbiddenSecrets)) await writeFile(join(directory, artifact.relativePath), artifact.bytes);
}

function requireExplicitRealMode(): void {
  if (!process.argv.includes("--execute-real") || process.env.GDN_REAL_PROVIDER_CALLS !== "1") {
    throw new TypeError("Real provider calls require both --execute-real and GDN_REAL_PROVIDER_CALLS=1.");
  }
  for (const name of ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_MODEL_ID", "GEMINI_MODEL_ID"] as const) {
    if (!process.env[name]?.trim()) throw new TypeError(`Missing required environment variable ${name}.`);
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log([
      "Usage:",
      "  npx tsx scripts/provider-tournament.ts --execute-real --benchmark BENCHMARK_ID --benchmark-root PATH",
      "  npx tsx scripts/provider-tournament.ts --execute-real --all-difficult --benchmark-root PATH",
      "",
      "Required environment:",
      "  GDN_REAL_PROVIDER_CALLS=1",
      "  ANTHROPIC_API_KEY, ANTHROPIC_MODEL_ID",
      "  GEMINI_API_KEY, GEMINI_MODEL_ID",
      "",
      "This command performs generation and the repository-grounded trusted verification chain.",
    ].join("\n"));
    return;
  }

  requireExplicitRealMode();
  const benchmarkRootValue = oneValue("--benchmark-root") ?? process.env.GDN_BENCHMARK_ROOT;
  if (!benchmarkRootValue) throw new TypeError("Provide --benchmark-root or GDN_BENCHMARK_ROOT.");
  const requested = process.argv.includes("--all-difficult") ? Object.keys(difficultBenchmarks) : valuesAfter("--benchmark");
  if (requested.length === 0) throw new TypeError("Select --benchmark BENCHMARK_ID or --all-difficult.");
  const invalid = requested.filter((value) => !(value in difficultBenchmarks));
  if (invalid.length > 0) throw new TypeError(`Unsupported benchmark selection: ${invalid.join(", ")}.`);

  const benchmarkRoot = resolve(benchmarkRootValue);
  const dependencyRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const adapters = [anthropicAdapterFromEnvironment(), geminiAdapterFromEnvironment()];
  const forbiddenSecrets = [process.env.ANTHROPIC_API_KEY!, process.env.GEMINI_API_KEY!];
  for (const benchmarkId of requested as DifficultBenchmarkId[]) {
    const definition = difficultBenchmarks[benchmarkId];
    const benchmarkDirectory = join(benchmarkRoot, benchmarkId);
    const mreBytes = new Uint8Array(await readFile(join(benchmarkDirectory, "candidate", "FROZEN_BLINDED_CANDIDATE_MRE.md")));
    const frozenMre = freezeMre(benchmarkId, mreBytes, definition.frozenMreHash);
    const runId = `automated-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;
    const request = { runId, benchmarkId, frozenMre, expectedFrozenMreHash: definition.frozenMreHash, permittedTarget: definition.permittedTarget };
    const runDirectory = join(benchmarkDirectory, "tournament", runId);
    const verifier = new RepositoryGroundedTrustedCandidateVerifier({ benchmarkRoot, evidenceRoot: join(runDirectory, "verification"), dependencyRoot });
    const tournament = await runAutomatedProviderTournament(request, adapters, verifier);
    for (const attempt of tournament.attempts) {
      await persistAttempt(join(runDirectory, "generation", safeName(attempt.envelope.generationAttemptId)), attempt, forbiddenSecrets);
    }
    const bothProvidersProducedEligibleCandidates = tournament.attempts.length === 2 && tournament.attempts.every((attempt) => attempt.eligibleForVerification);
    const summary = {
      benchmarkId,
      runId,
      sourceClass: "REAL_EXTERNAL_MODEL_API",
      frozenMreHash: definition.frozenMreHash,
      generationAttempts: tournament.attempts.map((attempt) => attempt.envelope),
      uniqueVerificationCandidates: tournament.verificationCandidates.length,
      verificationExecutionCount: tournament.verificationExecutionCount,
      verifications: tournament.verifications,
      winnerResult: tournament.winnerResult,
      bothProvidersProducedEligibleCandidates,
      milestoneClassification: tournament.winnerResult === "VERIFIED_CANDIDATE" && bothProvidersProducedEligibleCandidates ? "REAL_MULTI_PROVIDER_ADAPTER_TOURNAMENT_PROVEN" : "NOT_ESTABLISHED",
    };
    await mkdir(runDirectory, { recursive: true });
    await writeFile(join(runDirectory, "generation-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    console.log(`${benchmarkId}: ${tournament.attempts.length} attempts, ${tournament.verificationCandidates.length} unique eligible patches, ${tournament.winnerResult}.`);
  }
}

await main();
