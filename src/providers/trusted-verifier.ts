import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { buildCanonicalProviderRequest, freezeMre } from "./canonical-request.js";
import { sha256Hex } from "./hash.js";
import { extractCandidatePatch } from "./patch.js";
import { TRUSTED_BENCHMARK_DEFINITIONS, TRUSTED_BENCHMARK_IDS, trustedBenchmarkDefinition } from "./benchmark-config.js";
import type { TrustedBenchmarkId, TrustedBenchmarkVerificationConfig, TrustedCommandDefinition } from "./benchmark-config.js";
import type { GenerationProvenanceEnvelope, TrustedCandidateVerification, TrustedCandidateVerifier, TrustedVerificationClassification, VerificationCandidate } from "./types.js";

const MAX_PROCESS_OUTPUT_BYTES = 4 * 1024 * 1024;

export interface ProcessEvidence {
  id: string;
  displayCommand: string;
  effectiveInvocation: readonly string[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  exitCode: number | null;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  stdoutSha256: string;
  stderrSha256: string;
  stdoutArtifact: string;
  stderrArtifact: string;
  passed: boolean;
}

export interface ProtectedAssetEvidence {
  stage: string;
  passed: boolean;
  changedProtectedPaths: readonly string[];
  missingProtectedPaths: readonly string[];
  addedProtectedPaths: readonly string[];
  runtimeModifiedPaths: readonly string[];
  dependencyTreeChanged: boolean;
  manifestSha256: string;
  reason: string;
}

export interface PatchApplicationEvidence {
  applicable: boolean;
  applied: boolean;
  checkExitCode: number | null;
  applyExitCode: number | null;
  exactPatchSha256: string;
  reason: string;
}

export interface TrustedBenchmarkHandoff {
  benchmarkId: TrustedBenchmarkId;
  frozenMreSha256: string;
  permittedTarget: string;
  baselineCommit: string;
  baselineTree: string;
  baselineArchiveSha256: string;
  targetCommand: string;
  discriminatorCommand: string;
  regressionCommands: readonly string[];
  protectedAssetPolicy: string;
  integrityObligations: readonly string[];
}

interface FileManifest {
  entries: ReadonlyMap<string, string>;
  sha256: string;
}

export interface TrustedBenchmarkMaterial {
  definition: TrustedBenchmarkVerificationConfig;
  benchmarkDirectory: string;
  baselineArchivePath: string;
  seedMutationPath: string;
  discriminatorPath: string;
  frozenMreBytes: Uint8Array;
  seededWorkspaceManifest: FileManifest;
}

export interface TrustedVerificationSession {
  readonly workspaceId: string;
  readonly evidenceReferences: readonly string[];
  applyExactPatch(): Promise<PatchApplicationEvidence>;
  auditProtectedAssets(stage: string): Promise<ProtectedAssetEvidence>;
  run(command: TrustedCommandDefinition): Promise<ProcessEvidence>;
  seededBenchmarkSourceUnchanged(): Promise<boolean>;
  close(): Promise<void>;
}

export interface TrustedVerifierRuntime {
  prepare(material: TrustedBenchmarkMaterial, candidate: VerificationCandidate, evidenceDirectory: string): Promise<TrustedVerificationSession>;
}

export interface TrustedCandidateVerifierOptions {
  benchmarkRoot: string;
  evidenceRoot: string;
  dependencyRoot: string;
  workspaceRoot?: string;
  retainWorkspaces?: boolean;
  runtime?: TrustedVerifierRuntime;
}

interface RawProcessResult {
  exitCode: number | null;
  stdout: Uint8Array;
  stderr: Uint8Array;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

function normalizeRelativePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function safeArtifactName(value: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) throw new TypeError("Verification identity contains unsafe path characters.");
  return value;
}

function isWithin(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

function swapCase(value: string): string {
  return [...value].map((character) => character === character.toUpperCase() ? character.toLowerCase() : character.toUpperCase()).join("");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function runProcess(
  executable: string,
  arguments_: readonly string[],
  options: { cwd: string; timeoutMs: number; environment?: NodeJS.ProcessEnv; input?: Uint8Array },
): Promise<RawProcessResult> {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, arguments_, {
      cwd: options.cwd,
      env: options.environment ?? process.env,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let outputLimitExceeded = false;
    let timedOut = false;
    let settled = false;
    const capture = (chunks: Buffer[], chunk: Buffer): void => {
      if (outputLimitExceeded) return;
      outputBytes += chunk.byteLength;
      if (outputBytes > MAX_PROCESS_OUTPUT_BYTES) {
        outputLimitExceeded = true;
        child.kill();
      } else {
        chunks.push(Buffer.from(chunk));
      }
    };
    child.stdout.on("data", (chunk: Buffer) => capture(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => capture(stderr, chunk));
    child.stdin.on("error", () => { /* Early trusted consumers may close stdin after reading archive metadata. */ });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectPromise(error);
    });
    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({
        exitCode,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        timedOut,
        outputLimitExceeded,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Math.max(0, Math.round(performance.now() - started)),
      });
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs);
    child.stdin.end(options.input ? Buffer.from(options.input) : undefined);
  });
}

async function manifestDirectory(root: string, ignoredTopLevel: ReadonlySet<string> = new Set()): Promise<FileManifest> {
  const entries = new Map<string, string>();
  async function visit(directory: string): Promise<void> {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const absolute = join(directory, child.name);
      const rel = normalizeRelativePath(relative(root, absolute));
      if (ignoredTopLevel.has(rel.split("/", 1)[0]!)) continue;
      if (child.isSymbolicLink()) throw new TypeError(`Symbolic links are not allowed in a trusted manifest: ${rel}`);
      if (child.isDirectory()) await visit(absolute);
      else if (child.isFile()) entries.set(rel, sha256Hex(await readFile(absolute)));
      else throw new TypeError(`Unsupported filesystem entry: ${rel}`);
    }
  }
  await visit(root);
  const ledger = [...entries].map(([path, hash]) => `${hash}  ${path}\n`).join("");
  return { entries, sha256: sha256Hex(ledger) };
}

function differingPaths(left: FileManifest, right: FileManifest): string[] {
  const paths = new Set([...left.entries.keys(), ...right.entries.keys()]);
  return [...paths].filter((path) => left.entries.get(path) !== right.entries.get(path)).sort();
}

function compareProtected(baseline: FileManifest, current: FileManifest, permittedTarget: string) {
  const allowed = normalizeRelativePath(permittedTarget);
  const changedProtectedPaths: string[] = [];
  const missingProtectedPaths: string[] = [];
  const addedProtectedPaths: string[] = [];
  for (const [path, hash] of baseline.entries) {
    if (!current.entries.has(path)) {
      if (path !== allowed) missingProtectedPaths.push(path);
    } else if (current.entries.get(path) !== hash && path !== allowed) {
      changedProtectedPaths.push(path);
    }
  }
  for (const path of current.entries.keys()) {
    if (!baseline.entries.has(path) && path !== allowed) addedProtectedPaths.push(path);
  }
  return {
    passed: changedProtectedPaths.length === 0 && missingProtectedPaths.length === 0 && addedProtectedPaths.length === 0,
    changedProtectedPaths,
    missingProtectedPaths,
    addedProtectedPaths,
    manifestSha256: current.sha256,
  };
}

function trustedEnvironment(tempDirectory: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { TEMP: tempDirectory, TMP: tempDirectory, NODE_NO_WARNINGS: "1" };
  for (const name of ["SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "PATH"] as const) {
    if (process.env[name]) environment[name] = process.env[name];
  }
  return environment;
}

async function listTestFiles(workspace: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const absolute = join(directory, child.name);
      if (child.isDirectory()) await visit(absolute);
      else if (child.isFile() && child.name.endsWith(".test.ts")) files.push(normalizeRelativePath(relative(workspace, absolute)));
    }
  }
  await visit(join(workspace, "test"));
  return files;
}

async function canonicalJsonHash(path: string): Promise<string> {
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  return sha256Hex(JSON.stringify(value));
}

async function assertHash(path: string, expected: string, label: string): Promise<Uint8Array> {
  const bytes = new Uint8Array(await readFile(path));
  const actual = sha256Hex(bytes);
  if (actual !== expected) throw new TypeError(`${label} hash mismatch: expected ${expected}, observed ${actual}.`);
  return bytes;
}

export async function loadTrustedBenchmarkMaterial(
  benchmarkRoot: string,
  definition: TrustedBenchmarkVerificationConfig,
): Promise<TrustedBenchmarkMaterial> {
  const root = resolve(benchmarkRoot);
  const benchmarkDirectory = resolve(root, definition.benchmarkId);
  if (!isWithin(root, benchmarkDirectory)) throw new TypeError("Benchmark directory escapes the trusted root.");
  const baselineArchivePath = resolve(benchmarkDirectory, definition.baselineArchiveRelativePath);
  const seedMutationPath = resolve(benchmarkDirectory, definition.seedMutationRelativePath);
  const frozenMrePath = resolve(benchmarkDirectory, definition.frozenMreRelativePath);
  const seededFailurePath = resolve(benchmarkDirectory, definition.seededFailureRelativePath);
  const discriminatorRelative = definition.discriminatorCommand.arguments[0];
  if (!discriminatorRelative) throw new TypeError("Trusted discriminator path is missing.");
  const discriminatorPath = resolve(benchmarkDirectory, discriminatorRelative);
  for (const path of [baselineArchivePath, seedMutationPath, frozenMrePath, seededFailurePath, discriminatorPath]) {
    if (!isWithin(benchmarkDirectory, path)) throw new TypeError("Trusted artifact escapes its benchmark directory.");
  }
  const frozenMreBytes = await assertHash(frozenMrePath, definition.frozenMreSha256, "Frozen MRE");
  await assertHash(baselineArchivePath, definition.baselineArchiveSha256, "Baseline archive");
  await assertHash(seedMutationPath, definition.seedMutationSha256, "Seed mutation");
  await assertHash(seededFailurePath, definition.seededFailureSha256, "Seeded failure evidence");
  await assertHash(discriminatorPath, definition.discriminatorSha256, "Independent discriminator");
  const commitProbe = await runProcess("git", ["get-tar-commit-id"], {
    cwd: benchmarkDirectory,
    timeoutMs: 10_000,
    input: await readFile(baselineArchivePath),
  });
  if (commitProbe.exitCode !== 0 || Buffer.from(commitProbe.stdout).toString("utf8").trim() !== definition.baselineCommit) {
    throw new TypeError("Baseline archive commit identity does not match trusted configuration.");
  }
  const seededWorkspace = resolve(benchmarkDirectory, "benchmark-workspace");
  if (!await fileExists(seededWorkspace)) throw new TypeError("Existing seeded benchmark workspace is missing.");
  return {
    definition,
    benchmarkDirectory,
    baselineArchivePath,
    seedMutationPath,
    discriminatorPath,
    frozenMreBytes,
    seededWorkspaceManifest: await manifestDirectory(seededWorkspace, new Set(["node_modules", ".gdn-temp"])),
  };
}
class FileSystemVerificationSession implements TrustedVerificationSession {
  readonly evidenceReferences: string[] = [];
  readonly workspaceId: string;
  private postPatchManifest: FileManifest | null = null;
  private dependencyManifest: FileManifest | null = null;
  private dependenciesReady = false;

  constructor(
    private readonly material: TrustedBenchmarkMaterial,
    private readonly candidate: VerificationCandidate,
    private readonly isolationRoot: string,
    private readonly workspace: string,
    private readonly trustedDirectory: string,
    private readonly evidenceDirectory: string,
    private readonly dependencyRoot: string,
    private readonly baselineManifest: FileManifest,
    private readonly retainWorkspace: boolean,
  ) {
    this.workspaceId = isolationRoot;
  }

  async applyExactPatch(): Promise<PatchApplicationEvidence> {
    const patchPath = join(this.isolationRoot, "candidate.patch");
    await writeFile(patchPath, Buffer.from(this.candidate.exactPatch, "utf8"));
    const check = await runProcess("git", ["-C", this.workspace, "apply", "--check", "--whitespace=nowarn", patchPath], {
      cwd: this.workspace,
      timeoutMs: 30_000,
    });
    if (check.exitCode !== 0 || check.timedOut || check.outputLimitExceeded) {
      return {
        applicable: false,
        applied: false,
        checkExitCode: check.exitCode,
        applyExitCode: null,
        exactPatchSha256: sha256Hex(this.candidate.exactPatch),
        reason: "Exact submitted patch failed git apply --check.",
      };
    }
    const applied = await runProcess("git", ["-C", this.workspace, "apply", "--whitespace=nowarn", patchPath], {
      cwd: this.workspace,
      timeoutMs: 30_000,
    });
    if (applied.exitCode !== 0 || applied.timedOut || applied.outputLimitExceeded) {
      return {
        applicable: true,
        applied: false,
        checkExitCode: check.exitCode,
        applyExitCode: applied.exitCode,
        exactPatchSha256: sha256Hex(this.candidate.exactPatch),
        reason: "Exact submitted patch failed during application.",
      };
    }
    this.postPatchManifest = await manifestDirectory(this.workspace, new Set(["node_modules", ".gdn-temp"]));
    const protectedComparison = compareProtected(this.baselineManifest, this.postPatchManifest, this.material.definition.permittedTarget);
    return {
      applicable: true,
      applied: true,
      checkExitCode: check.exitCode,
      applyExitCode: applied.exitCode,
      exactPatchSha256: sha256Hex(this.candidate.exactPatch),
      reason: protectedComparison.passed
        ? "Exact submitted patch passed git apply --check and was applied without translation."
        : "Patch application changed paths outside the permitted implementation target.",
    };
  }

  async auditProtectedAssets(stage: string): Promise<ProtectedAssetEvidence> {
    const current = await manifestDirectory(this.workspace, new Set(["node_modules", ".gdn-temp"]));
    const comparison = compareProtected(this.baselineManifest, current, this.material.definition.permittedTarget);
    const runtimeModifiedPaths = this.postPatchManifest === null ? [] : differingPaths(this.postPatchManifest, current);
    let dependencyTreeChanged = false;
    if (this.dependencyManifest !== null) {
      dependencyTreeChanged = (await manifestDirectory(join(this.workspace, "node_modules"))).sha256 !== this.dependencyManifest.sha256;
    }
    const passed = comparison.passed && runtimeModifiedPaths.length === 0 && !dependencyTreeChanged;
    const evidence: ProtectedAssetEvidence = {
      ...comparison,
      stage,
      passed,
      runtimeModifiedPaths,
      dependencyTreeChanged,
      reason: passed
        ? "All archive paths except the permitted target match baseline; command execution made no filesystem changes."
        : "Protected, runtime, or isolated dependency content changed.",
    };
    const path = join(this.evidenceDirectory, `protected-${safeArtifactName(stage)}.json`);
    await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    this.evidenceReferences.push(path);
    return evidence;
  }

  private async ensureDependencies(): Promise<void> {
    if (this.dependenciesReady) return;
    const sourceLock = join(this.dependencyRoot, "package-lock.json");
    const workspaceLock = join(this.workspace, "package-lock.json");
    if (await canonicalJsonHash(sourceLock) !== await canonicalJsonHash(workspaceLock)) {
      throw new TypeError("Trusted dependency package-lock does not match the benchmark baseline.");
    }
    const sourceModules = join(this.dependencyRoot, "node_modules");
    if (!await fileExists(sourceModules)) throw new TypeError("Trusted dependency bundle is missing.");
    await cp(sourceModules, join(this.workspace, "node_modules"), {
      recursive: true,
      dereference: true,
      errorOnExist: true,
      force: false,
    });
    this.dependencyManifest = await manifestDirectory(join(this.workspace, "node_modules"));
    await mkdir(join(this.workspace, ".gdn-temp"), { recursive: true });
    this.dependenciesReady = true;
  }

  async run(command: TrustedCommandDefinition): Promise<ProcessEvidence> {
    await this.ensureDependencies();
    const loader = join(this.workspace, "node_modules", "tsx", "dist", "loader.mjs");
    const tempDirectory = join(this.workspace, ".gdn-temp");
    const permissionArguments = [
      "--permission",
      `--allow-fs-read=${this.workspace}`,
      `--allow-fs-read=${swapCase(this.workspace)}`,
      `--allow-fs-write=${tempDirectory}`,
      `--allow-fs-write=${swapCase(tempDirectory)}`,
      "--allow-worker",
    ];
    let arguments_: string[];
    if (command.kind === "TSX_TEST") {
      arguments_ = [...permissionArguments, "--import", pathToFileURL(loader).href, "--test", "--test-isolation=none", ...command.arguments];
    } else if (command.kind === "TSX_SCRIPT") {
      const relativeScript = command.arguments[0];
      if (!relativeScript) throw new TypeError("Trusted script command is missing its path.");
      const script = resolve(this.isolationRoot, relativeScript);
      if (!isWithin(this.trustedDirectory, script)) throw new TypeError("Trusted script escapes its isolated directory.");
      arguments_ = [
        ...permissionArguments,
        `--allow-fs-read=${this.trustedDirectory}`,
        `--allow-fs-read=${this.isolationRoot}`,
        `--allow-fs-read=${swapCase(this.isolationRoot)}`,
        `--allow-fs-read=${swapCase(this.trustedDirectory)}`,
        "--import",
        pathToFileURL(loader).href,
        script,
      ];
    } else if (command.kind === "TYPECHECK") {
      arguments_ = [...permissionArguments, join(this.workspace, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json", "--noEmit"];
    } else {
      arguments_ = [...permissionArguments, "--import", pathToFileURL(loader).href, "--test", "--test-isolation=none", ...await listTestFiles(this.workspace)];
    }
    const result = await runProcess(process.execPath, arguments_, {
      cwd: this.workspace,
      timeoutMs: command.timeoutMs,
      environment: trustedEnvironment(tempDirectory),
    });
    const commandDirectory = join(this.evidenceDirectory, "commands");
    await mkdir(commandDirectory, { recursive: true });
    const stdoutArtifact = join(commandDirectory, `${safeArtifactName(command.id)}.stdout.txt`);
    const stderrArtifact = join(commandDirectory, `${safeArtifactName(command.id)}.stderr.txt`);
    await writeFile(stdoutArtifact, result.stdout);
    await writeFile(stderrArtifact, result.stderr);
    const evidence: ProcessEvidence = {
      id: command.id,
      displayCommand: command.displayCommand,
      effectiveInvocation: [process.execPath, ...arguments_],
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      outputLimitExceeded: result.outputLimitExceeded,
      stdoutSha256: sha256Hex(result.stdout),
      stderrSha256: sha256Hex(result.stderr),
      stdoutArtifact,
      stderrArtifact,
      passed: result.exitCode === 0 && !result.timedOut && !result.outputLimitExceeded,
    };
    const evidencePath = join(commandDirectory, `${safeArtifactName(command.id)}.json`);
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    this.evidenceReferences.push(stdoutArtifact, stderrArtifact, evidencePath);
    return evidence;
  }

  async seededBenchmarkSourceUnchanged(): Promise<boolean> {
    const current = await manifestDirectory(join(this.material.benchmarkDirectory, "benchmark-workspace"), new Set(["node_modules", ".gdn-temp"]));
    return current.sha256 === this.material.seededWorkspaceManifest.sha256;
  }

  async close(): Promise<void> {
    if (this.retainWorkspace) return;
    if (!basename(this.isolationRoot).startsWith("gdn-verify-") || !isWithin(dirname(this.isolationRoot), this.isolationRoot)) {
      throw new TypeError("Refusing to remove an unexpected verifier workspace.");
    }
    await rm(this.isolationRoot, { recursive: true, force: true });
  }
}

export class FileSystemTrustedVerifierRuntime implements TrustedVerifierRuntime {
  constructor(private readonly options: { dependencyRoot: string; workspaceRoot?: string; retainWorkspaces?: boolean }) {}

  async prepare(
    material: TrustedBenchmarkMaterial,
    candidate: VerificationCandidate,
    evidenceDirectory: string,
  ): Promise<TrustedVerificationSession> {
    if (!process.allowedNodeEnvironmentFlags.has("--permission") || !process.allowedNodeEnvironmentFlags.has("--test-isolation")) {
      throw new TypeError("Node permission and test-isolation support are required.");
    }
    const workspaceParent = resolve(this.options.workspaceRoot ?? tmpdir());
    await mkdir(workspaceParent, { recursive: true });
    const isolationRoot = await mkdtemp(join(workspaceParent, "gdn-verify-"));
    const workspace = join(isolationRoot, "benchmark-workspace");
    const trustedDirectory = join(isolationRoot, "trusted");
    await mkdir(workspace, { recursive: true });
    await mkdir(trustedDirectory, { recursive: true });
    try {
      const listing = await runProcess("tar", ["-tf", material.baselineArchivePath], { cwd: isolationRoot, timeoutMs: 30_000 });
      if (listing.exitCode !== 0) throw new TypeError("Unable to inspect the trusted baseline archive.");
      const archivePaths = Buffer.from(listing.stdout).toString("utf8").split(/\r?\n/).filter(Boolean);
      if (archivePaths.length === 0 || archivePaths.some((path) => isAbsolute(path) || normalizeRelativePath(path).split("/").includes(".."))) {
        throw new TypeError("Trusted baseline archive contains an unsafe path.");
      }
      const extracted = await runProcess("tar", ["-xf", material.baselineArchivePath, "-C", workspace], { cwd: isolationRoot, timeoutMs: 30_000 });
      if (extracted.exitCode !== 0) throw new TypeError("Unable to extract the trusted baseline archive.");
      const baselineManifest = await manifestDirectory(workspace);
      await cp(join(workspace, "package.json"), join(isolationRoot, "package.json"), { errorOnExist: true, force: false });
      const seedCheck = await runProcess("git", ["-C", workspace, "apply", "--check", "--whitespace=nowarn", material.seedMutationPath], { cwd: workspace, timeoutMs: 30_000 });
      if (seedCheck.exitCode !== 0) throw new TypeError("Trusted seed is not applicable to the archived baseline.");
      const seedApply = await runProcess("git", ["-C", workspace, "apply", "--whitespace=nowarn", material.seedMutationPath], { cwd: workspace, timeoutMs: 30_000 });
      if (seedApply.exitCode !== 0) throw new TypeError("Trusted seed failed during isolated reconstruction.");
      const seededDifferences = differingPaths(baselineManifest, await manifestDirectory(workspace));
      if (seededDifferences.length !== 1 || seededDifferences[0] !== material.definition.permittedTarget) {
        throw new TypeError("Trusted seed changed an unexpected path.");
      }
      await cp(material.discriminatorPath, join(trustedDirectory, basename(material.discriminatorPath)), { errorOnExist: true, force: false });
      return new FileSystemVerificationSession(
        material,
        candidate,
        isolationRoot,
        workspace,
        trustedDirectory,
        evidenceDirectory,
        resolve(this.options.dependencyRoot),
        baselineManifest,
        this.options.retainWorkspaces ?? false,
      );
    } catch (error) {
      await rm(isolationRoot, { recursive: true, force: true });
      throw error;
    }
  }
}
function coarseStatus(classification: TrustedVerificationClassification): TrustedCandidateVerification["status"] {
  if (classification === "VERIFIED_REPAIR") return "VERIFIED";
  if (classification === "VERIFIER_ERROR") return "ERROR";
  return "REJECTED";
}

async function writeTrustedResult(
  evidenceDirectory: string,
  candidate: VerificationCandidate,
  material: TrustedBenchmarkMaterial | null,
  classification: TrustedVerificationClassification,
  reason: string,
  patchApplication: PatchApplicationEvidence | null,
  protectedAudits: readonly ProtectedAssetEvidence[],
  commands: readonly ProcessEvidence[],
  seededBenchmarkSourceUnchanged: boolean | null,
  extraReferences: readonly string[],
): Promise<TrustedCandidateVerification> {
  await mkdir(evidenceDirectory, { recursive: true });
  const status = coarseStatus(classification);
  const deltaWithoutHash = {
    benchmarkId: candidate.benchmarkId,
    verificationCandidateId: candidate.verificationCandidateId,
    exactPatchSha256: sha256Hex(candidate.exactPatch),
    normalizedPatchSha256: candidate.normalizedPatchHash,
    sourceGenerationAttemptIds: candidate.sourceAttemptIds,
    duplicateAgreementWeight: candidate.duplicateAgreementWeight,
    seededFailureEvidence: {
      sha256: material?.definition.seededFailureSha256 ?? "UNAVAILABLE",
      targetedStatus: "FAIL" as const,
    },
    candidateEvidence: {
      patchApplication,
      protectedAssetAudits: protectedAudits,
      commands,
      seededBenchmarkSourceUnchanged,
      classification,
      status,
      reason,
    },
  };
  const evidenceDeltaSha256 = sha256Hex(`${JSON.stringify(deltaWithoutHash)}\n`);
  const delta = { ...deltaWithoutHash, evidenceDeltaSha256 };
  const deltaPath = join(evidenceDirectory, "evidence-delta.json");
  await writeFile(deltaPath, `${JSON.stringify(delta, null, 2)}\n`, "utf8");
  const result: TrustedCandidateVerification = {
    verificationCandidateId: candidate.verificationCandidateId,
    status,
    classification,
    evidenceReferences: [...new Set([deltaPath, ...extraReferences])],
    evidenceDeltaReference: deltaPath,
    reason,
  };
  await writeFile(join(evidenceDirectory, "verification-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

function validateCandidateIdentity(candidate: VerificationCandidate, material: TrustedBenchmarkMaterial): string | null {
  const definition = material.definition;
  if (candidate.benchmarkId !== definition.benchmarkId) return "Candidate benchmark identity does not match trusted configuration.";
  if (candidate.frozenMreHash !== definition.frozenMreSha256) return "Candidate frozen MRE identity does not match trusted configuration.";
  if (candidate.permittedTarget !== definition.permittedTarget) return "Candidate permitted target does not match trusted configuration.";
  if (candidate.duplicateAgreementWeight !== 0) return "Duplicate agreement weight must be zero.";
  if (candidate.sourceAttemptIds.length === 0 || candidate.sourceAttemptIds.length !== candidate.sourceEnvelopes.length) {
    return "Trusted generation envelope linkage is incomplete.";
  }
  const extraction = extractCandidatePatch("```diff\n" + candidate.exactPatch + "```", definition.permittedTarget);
  if (extraction.status !== "EXTRACTED" || extraction.patchHash !== sha256Hex(candidate.exactPatch) || extraction.normalizedPatchHash !== candidate.normalizedPatchHash) {
    return "Exact candidate patch no longer matches its strict extraction identity.";
  }
  const frozenMre = freezeMre(definition.benchmarkId, material.frozenMreBytes, definition.frozenMreSha256);
  const requestHash = buildCanonicalProviderRequest({
    generationAttemptId: "trusted-verification-recompute",
    benchmarkId: definition.benchmarkId,
    frozenMre,
    expectedFrozenMreHash: definition.frozenMreSha256,
    permittedTarget: definition.permittedTarget,
  }).sha256;
  for (let index = 0; index < candidate.sourceEnvelopes.length; index += 1) {
    const envelope: GenerationProvenanceEnvelope = candidate.sourceEnvelopes[index]!;
    if (
      envelope.generationAttemptId !== candidate.sourceAttemptIds[index]
      || envelope.sourceClass !== "REAL_EXTERNAL_MODEL_API"
      || envelope.benchmarkId !== definition.benchmarkId
      || envelope.frozenMreHash !== definition.frozenMreSha256
      || envelope.requestHash !== requestHash
      || (index === 0 ? envelope.patchHash !== sha256Hex(candidate.exactPatch) : envelope.patchHash === null)
      || envelope.normalizedPatchHash !== candidate.normalizedPatchHash
      || envelope.extractionStatus !== "EXTRACTED"
      || envelope.failureCode !== null
      || !envelope.providerId
      || !envelope.modelId
    ) return "Candidate generation provenance does not match trusted request and patch identities.";
  }
  return null;
}

export class RepositoryGroundedTrustedCandidateVerifier implements TrustedCandidateVerifier {
  private readonly runtime: TrustedVerifierRuntime;

  constructor(private readonly options: TrustedCandidateVerifierOptions) {
    this.runtime = options.runtime ?? new FileSystemTrustedVerifierRuntime({
      dependencyRoot: options.dependencyRoot,
      ...(options.workspaceRoot === undefined ? {} : { workspaceRoot: options.workspaceRoot }),
      ...(options.retainWorkspaces === undefined ? {} : { retainWorkspaces: options.retainWorkspaces }),
    });
  }

  async verify(candidate: VerificationCandidate): Promise<TrustedCandidateVerification> {
    const candidateId = safeArtifactName(candidate.verificationCandidateId);
    const evidenceDirectory = resolve(this.options.evidenceRoot, safeArtifactName(candidate.benchmarkId), candidateId);
    if (!isWithin(this.options.evidenceRoot, evidenceDirectory)) throw new TypeError("Evidence directory escapes the trusted evidence root.");
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(join(evidenceDirectory, "candidate.patch"), Buffer.from(candidate.exactPatch, "utf8"));
    await writeFile(join(evidenceDirectory, "generation-link.json"), `${JSON.stringify({
      verificationCandidateId: candidate.verificationCandidateId,
      benchmarkId: candidate.benchmarkId,
      frozenMreHash: candidate.frozenMreHash,
      normalizedPatchHash: candidate.normalizedPatchHash,
      sourceAttemptIds: candidate.sourceAttemptIds,
      sourceEnvelopes: candidate.sourceEnvelopes,
      duplicateAgreementWeight: candidate.duplicateAgreementWeight,
    }, null, 2)}\n`, "utf8");

    let material: TrustedBenchmarkMaterial | null = null;
    let session: TrustedVerificationSession | null = null;
    let patchApplication: PatchApplicationEvidence | null = null;
    const protectedAudits: ProtectedAssetEvidence[] = [];
    const commands: ProcessEvidence[] = [];
    let sourceUnchanged: boolean | null = null;

    const finish = async (classification: TrustedVerificationClassification, reason: string) => {
      if (session !== null) sourceUnchanged = await session.seededBenchmarkSourceUnchanged();
      return writeTrustedResult(
        evidenceDirectory,
        candidate,
        material,
        classification,
        reason,
        patchApplication,
        protectedAudits,
        commands,
        sourceUnchanged,
        session?.evidenceReferences ?? [],
      );
    };

    try {
      const definition = trustedBenchmarkDefinition(candidate.benchmarkId);
      if (definition === null) return finish("OBJECTIVE_SUBSTITUTION", "Unsupported benchmark identity.");
      material = await loadTrustedBenchmarkMaterial(this.options.benchmarkRoot, definition);
      const identityFailure = validateCandidateIdentity(candidate, material);
      if (identityFailure !== null) return finish("OBJECTIVE_SUBSTITUTION", identityFailure);

      session = await this.runtime.prepare(material, candidate, evidenceDirectory);
      patchApplication = await session.applyExactPatch();
      if (!patchApplication.applicable || !patchApplication.applied) return finish("PATCH_APPLICATION_FAILURE", patchApplication.reason);

      const afterPatch = await session.auditProtectedAssets("after-patch");
      protectedAudits.push(afterPatch);
      if (!afterPatch.passed) return finish("PROTECTED_ASSET_TAMPERING", afterPatch.reason);

      const target = await session.run(definition.targetCommand);
      commands.push(target);
      const afterTarget = await session.auditProtectedAssets("after-target");
      protectedAudits.push(afterTarget);
      if (!afterTarget.passed) return finish("PROTECTED_ASSET_TAMPERING", afterTarget.reason);
      if (!target.passed) return finish("TARGET_FAIL", "Targeted benchmark verification failed.");

      const discriminator = await session.run(definition.discriminatorCommand);
      commands.push(discriminator);
      const afterDiscriminator = await session.auditProtectedAssets("after-discriminator");
      protectedAudits.push(afterDiscriminator);
      if (!afterDiscriminator.passed) return finish("PROTECTED_ASSET_TAMPERING", afterDiscriminator.reason);
      if (!discriminator.passed) {
        return finish(definition.discriminatorFailureClassification, "Target passed, but the independent trusted obligation failed.");
      }

      for (const regression of definition.regressionCommands) {
        const evidence = await session.run(regression);
        commands.push(evidence);
        const audit = await session.auditProtectedAssets(`after-${regression.id}`);
        protectedAudits.push(audit);
        if (!audit.passed) return finish("PROTECTED_ASSET_TAMPERING", audit.reason);
        if (!evidence.passed) {
          return finish("TARGET_FIXED_REGRESSION_INTRODUCED", `Target and discriminator passed, but regression failed: ${regression.displayCommand}.`);
        }
      }

      sourceUnchanged = await session.seededBenchmarkSourceUnchanged();
      if (!sourceUnchanged) return finish("PROTECTED_ASSET_TAMPERING", "The sealed seeded benchmark workspace changed during verification.");
      return finish("VERIFIED_REPAIR", "Exact patch passed target, discriminator, regressions, protected assets, and benchmark immutability.");
    } catch (error) {
      try {
        if (session !== null) sourceUnchanged = await session.seededBenchmarkSourceUnchanged();
      } catch {
        sourceUnchanged = null;
      }
      return writeTrustedResult(
        evidenceDirectory,
        candidate,
        material,
        "VERIFIER_ERROR",
        error instanceof Error ? error.message : "Trusted verifier failed unexpectedly.",
        patchApplication,
        protectedAudits,
        commands,
        sourceUnchanged,
        session?.evidenceReferences ?? [],
      );
    } finally {
      if (session !== null) {
        try {
          await session.close();
        } catch {
          // Cleanup cannot promote an already fail-closed outcome.
        }
      }
    }
  }
}

export async function validateTrustedBenchmarkHandoffs(benchmarkRoot: string): Promise<readonly TrustedBenchmarkHandoff[]> {
  const handoffs: TrustedBenchmarkHandoff[] = [];
  for (const benchmarkId of TRUSTED_BENCHMARK_IDS) {
    const definition = TRUSTED_BENCHMARK_DEFINITIONS[benchmarkId];
    await loadTrustedBenchmarkMaterial(benchmarkRoot, definition);
    handoffs.push({
      benchmarkId,
      frozenMreSha256: definition.frozenMreSha256,
      permittedTarget: definition.permittedTarget,
      baselineCommit: definition.baselineCommit,
      baselineTree: definition.baselineTree,
      baselineArchiveSha256: definition.baselineArchiveSha256,
      targetCommand: definition.targetCommand.displayCommand,
      discriminatorCommand: definition.discriminatorCommand.displayCommand,
      regressionCommands: definition.regressionCommands.map((command) => command.displayCommand),
      protectedAssetPolicy: definition.protectedAssetPolicy,
      integrityObligations: definition.benchmarkIntegrityObligations,
    });
  }
  return handoffs;
}
