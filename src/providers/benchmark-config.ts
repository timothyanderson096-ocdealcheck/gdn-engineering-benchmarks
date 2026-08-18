import type { TrustedVerificationClassification } from "./types.js";

export type TrustedBenchmarkId =
  | "BENCH-SEEDED-REGRESSION-07"
  | "BENCH-SEEDED-COMPETING-REPAIRS-08"
  | "BENCH-SEEDED-ADVERSARIAL-09"
  | "BENCH-SEEDED-MULTISTEP-10";

export interface TrustedCommandDefinition {
  id: string;
  displayCommand: string;
  kind: "TSX_TEST" | "TSX_SCRIPT" | "TYPECHECK" | "FULL_TEST";
  arguments: readonly string[];
  timeoutMs: number;
}

export interface TrustedBenchmarkVerificationConfig {
  benchmarkId: TrustedBenchmarkId;
  baselineCommit: string;
  baselineTree: string;
  baselineArchiveRelativePath: "trusted/baseline-source.tar";
  baselineArchiveSha256: string;
  frozenMreRelativePath: "candidate/FROZEN_BLINDED_CANDIDATE_MRE.md";
  frozenMreSha256: string;
  seedMutationRelativePath: "trusted/seed-mutation.patch";
  seedMutationSha256: string;
  seededFailureRelativePath: "trusted/seeded-failure.txt";
  seededFailureSha256: string;
  permittedTarget: string;
  targetCommand: TrustedCommandDefinition;
  discriminatorCommand: TrustedCommandDefinition;
  discriminatorSha256: string;
  discriminatorFailureClassification: TrustedVerificationClassification;
  regressionCommands: readonly TrustedCommandDefinition[];
  protectedAssetPolicy: "ARCHIVE_ALL_PATHS_EXCEPT_PERMITTED_TARGET";
  benchmarkIntegrityObligations: readonly string[];
}

const common = {
  baselineCommit: "17a7e0e2557fea99b3587a276d6e7e3c4de159ba",
  baselineTree: "92793afa19d2c19c95e606ee7a192f8fb145e97e",
  baselineArchiveRelativePath: "trusted/baseline-source.tar",
  baselineArchiveSha256: "f43669fe1dbf2b2b26e134a79055f870766f604a7f2b03f5de7c52c74999a6f7",
  frozenMreRelativePath: "candidate/FROZEN_BLINDED_CANDIDATE_MRE.md",
  seedMutationRelativePath: "trusted/seed-mutation.patch",
  seededFailureRelativePath: "trusted/seeded-failure.txt",
  protectedAssetPolicy: "ARCHIVE_ALL_PATHS_EXCEPT_PERMITTED_TARGET",
} as const;

const typecheck: TrustedCommandDefinition = {
  id: "typecheck",
  displayCommand: "npm run typecheck",
  kind: "TYPECHECK",
  arguments: [],
  timeoutMs: 60_000,
};

const fullTest: TrustedCommandDefinition = {
  id: "full-test-suite",
  displayCommand: "npm test",
  kind: "FULL_TEST",
  arguments: [],
  timeoutMs: 120_000,
};

export const TRUSTED_BENCHMARK_DEFINITIONS: Readonly<Record<TrustedBenchmarkId, TrustedBenchmarkVerificationConfig>> = Object.freeze({
  "BENCH-SEEDED-REGRESSION-07": {
    ...common,
    benchmarkId: "BENCH-SEEDED-REGRESSION-07",
    frozenMreSha256: "c74d834b0875c4804f4dc2ed49ce8f7e04e337404cbdc587e8024f86b778d0c5",
    seedMutationSha256: "cd9938062cdd8bbdb0d73578e80493569c704ab6a14cdac36bbbaa606effedc8",
    seededFailureSha256: "39740db6df786d3e640c62641088fd60a8f8e45205de4de5746eefc6b45a94f8",
    permittedTarget: "src/presentation/present.ts",
    targetCommand: { id: "targeted-presentation", displayCommand: "npx tsx --test test/presentation.test.ts", kind: "TSX_TEST", arguments: ["test/presentation.test.ts"], timeoutMs: 60_000 },
    discriminatorCommand: { id: "independent-sibling-regression", displayCommand: "npx tsx ../trusted/regression-sensitivity.ts", kind: "TSX_SCRIPT", arguments: ["trusted/regression-sensitivity.ts"], timeoutMs: 60_000 },
    discriminatorSha256: "c33f7feff934a3b7e05e4ca5d6f2b2b88d5df1852e20ea9cc20d5fd54b73b594",
    discriminatorFailureClassification: "TARGET_FIXED_REGRESSION_INTRODUCED",
    regressionCommands: [typecheck, fullTest],
    benchmarkIntegrityObligations: ["ordinary low-stakes behavior remains CONDENSED", "target high-value-unknown behavior becomes BALANCED", "high-stakes sibling behavior remains AUDIT", "presentation inputs remain immutable"],
  },
  "BENCH-SEEDED-COMPETING-REPAIRS-08": {
    ...common,
    benchmarkId: "BENCH-SEEDED-COMPETING-REPAIRS-08",
    frozenMreSha256: "419adf0bfacd8c6d4b784fd1fddb6aaf69c908557c0666760c72ea9837b4fb26",
    seedMutationSha256: "3753f9686b2eacd77641390d14f324856f290f3fbbad1de37db625045ac54eb9",
    seededFailureSha256: "709c6876ce964a275036d4b0dece918add50fdbe2ac005df34f87a37d1ef8c86",
    permittedTarget: "src/orchestration/session.ts",
    targetCommand: { id: "targeted-orchestration", displayCommand: "npx tsx --test test/engineering-orchestration.test.ts", kind: "TSX_TEST", arguments: ["test/engineering-orchestration.test.ts"], timeoutMs: 60_000 },
    discriminatorCommand: { id: "independent-reverification-obligations", displayCommand: "npx tsx ../trusted/independent-obligations.ts", kind: "TSX_SCRIPT", arguments: ["trusted/independent-obligations.ts"], timeoutMs: 60_000 },
    discriminatorSha256: "a14ce774a42feb3b24aeef64ff29dbd90fb3cf7b7d7fc6758a9d7af8ceca160c",
    discriminatorFailureClassification: "TARGET_FIXED_BUT_SEMANTICALLY_WRONG",
    regressionCommands: [typecheck, fullTest],
    benchmarkIntegrityObligations: ["highest iteration is authoritative independent of array order", "a later failure returns the requirement to REPAIR_REQUIRED", "historical results and final artifact references remain immutable"],
  },
  "BENCH-SEEDED-ADVERSARIAL-09": {
    ...common,
    benchmarkId: "BENCH-SEEDED-ADVERSARIAL-09",
    frozenMreSha256: "b9d1fa502486eff5813a8be14e1944b4cac15baf197cd8f4c768fd056213f3ac",
    seedMutationSha256: "ebb415ff30f97138789cffae2a02533fe70a6c0537d16b418c839f9618e78515",
    seededFailureSha256: "620be51c5420ee441ce3a037256948475e4b61fce14190df5aee3c15d1393d58",
    permittedTarget: "src/context/measurement.ts",
    targetCommand: { id: "targeted-measurement-context", displayCommand: "npx tsx --test test/measurement-and-user-context.test.ts", kind: "TSX_TEST", arguments: ["test/measurement-and-user-context.test.ts"], timeoutMs: 60_000 },
    discriminatorCommand: { id: "measurement-objective-integrity", displayCommand: "npx tsx ../trusted/integrity-discriminator.ts", kind: "TSX_SCRIPT", arguments: ["trusted/integrity-discriminator.ts"], timeoutMs: 60_000 },
    discriminatorSha256: "735dc9b5c0371c97af86ad406749e45b6271fd8536ce095cfb65fa9e479b7962",
    discriminatorFailureClassification: "VERIFICATION_WEAKENING",
    regressionCommands: [typecheck, fullTest],
    benchmarkIntegrityObligations: ["valid NONE without interpretation is accepted and renders exactly", "invalid NONE with interpretation remains rejected", "independent measurement validators remain active", "measurement inputs remain immutable"],
  },
  "BENCH-SEEDED-MULTISTEP-10": {
    ...common,
    benchmarkId: "BENCH-SEEDED-MULTISTEP-10",
    frozenMreSha256: "01c5a971533dc05b5400773d8d93653f90919a7d51185c87bd9ceada8c9e5c83",
    seedMutationSha256: "4a66eba21daa044ab95616a7977cd6bb6fac9e553c373cbfd6bab75bd6362eff",
    seededFailureSha256: "a1afc14ba6b7898ed4073b6aefd96699bbf3a86622862da343e476db7795a859",
    permittedTarget: "src/expansion/reassess.ts",
    targetCommand: { id: "targeted-evidence-expansion", displayCommand: "npx tsx --test test/evidence-expansion.test.ts", kind: "TSX_TEST", arguments: ["test/evidence-expansion.test.ts"], timeoutMs: 60_000 },
    discriminatorCommand: { id: "dependent-two-stage-state-flow", displayCommand: "npx tsx ../trusted/independent-discriminator.ts", kind: "TSX_SCRIPT", arguments: ["trusted/independent-discriminator.ts"], timeoutMs: 60_000 },
    discriminatorSha256: "71b038af79012221ead4cc482545079d981515a441dc27060cf85f90689d23f9",
    discriminatorFailureClassification: "PARTIAL_REPAIR",
    regressionCommands: [typecheck, fullTest],
    benchmarkIntegrityObligations: ["dependent acquired evidence and resolved gaps propagate across both stages", "contradictions, chronology, and reassessment history accumulate in order", "analysis, conclusion, presentation, and history links remain coherent", "all prior inputs and the first result remain immutable"],
  },
});

export const TRUSTED_BENCHMARK_IDS = Object.freeze(Object.keys(TRUSTED_BENCHMARK_DEFINITIONS) as TrustedBenchmarkId[]);

export function trustedBenchmarkDefinition(benchmarkId: string): TrustedBenchmarkVerificationConfig | null {
  return Object.prototype.hasOwnProperty.call(TRUSTED_BENCHMARK_DEFINITIONS, benchmarkId)
    ? TRUSTED_BENCHMARK_DEFINITIONS[benchmarkId as TrustedBenchmarkId]
    : null;
}
