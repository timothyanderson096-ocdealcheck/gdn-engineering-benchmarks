import { sha256Hex } from "./hash.js";
import type { PatchExtraction } from "./types.js";

interface ParsedHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: readonly string[];
}

interface ParsedFilePatch {
  oldPath: string;
  newPath: string;
  hunks: readonly ParsedHunk[];
}

interface ParsedPatch {
  files: readonly ParsedFilePatch[];
  normalized: string;
}

class PatchSyntaxError extends Error {}

const patchMarker = /(?:^|\n)(?:diff --git [^\n]+\n)?--- [^\n]+\n\+\+\+ [^\n]+/;

function headerPath(line: string, prefix: "--- " | "+++ "): string {
  if (!line.startsWith(prefix)) throw new PatchSyntaxError(`Expected ${prefix.trim()} file header.`);
  const raw = line.slice(prefix.length).split(/\t| /, 1)[0];
  if (!raw || raw === "/dev/null") throw new PatchSyntaxError("New/deleted-file patches are not admissible.");
  return raw.startsWith("a/") || raw.startsWith("b/") ? raw.slice(2) : raw;
}

function parseUnifiedDiff(exactPatch: string): ParsedPatch {
  if (exactPatch.includes("\0")) throw new PatchSyntaxError("Patch contains a NUL byte.");
  const normalizedNewlines = exactPatch.replaceAll("\r\n", "\n");
  if (normalizedNewlines.includes("\r")) throw new PatchSyntaxError("Patch contains unsupported line endings.");
  const lines = normalizedNewlines.split("\n");
  while (lines[0] === "") lines.shift();
  while (lines.at(-1) === "") lines.pop();
  const files: ParsedFilePatch[] = [];
  let index = 0;
  let changedLines = 0;

  while (index < lines.length) {
    let diffOldPath: string | null = null;
    let diffNewPath: string | null = null;
    if (lines[index]!.startsWith("diff --git ")) {
      const match = lines[index]!.match(/^diff --git (\S+) (\S+)$/);
      if (!match) throw new PatchSyntaxError("Malformed diff --git header.");
      diffOldPath = match[1]!.startsWith("a/") ? match[1]!.slice(2) : match[1]!;
      diffNewPath = match[2]!.startsWith("b/") ? match[2]!.slice(2) : match[2]!;
      index += 1;
      while (lines[index]?.startsWith("index ")) index += 1;
      if (lines[index]?.startsWith("new file mode") || lines[index]?.startsWith("deleted file mode") || lines[index]?.startsWith("rename ")) {
        throw new PatchSyntaxError("File creation, deletion, and rename metadata are not admissible.");
      }
    }

    const oldLine = lines[index];
    const newLine = lines[index + 1];
    if (oldLine === undefined || newLine === undefined) throw new PatchSyntaxError("Incomplete file headers.");
    const oldPath = headerPath(oldLine, "--- ");
    const newPath = headerPath(newLine, "+++ ");
    if ((diffOldPath !== null && diffOldPath !== oldPath) || (diffNewPath !== null && diffNewPath !== newPath)) {
      throw new PatchSyntaxError("diff --git paths disagree with unified-diff paths.");
    }
    index += 2;

    const hunks: ParsedHunk[] = [];
    while (index < lines.length && lines[index]!.startsWith("@@ ")) {
      const header = lines[index]!;
      const match = header.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/);
      if (!match) throw new PatchSyntaxError("Malformed hunk header.");
      const oldStart = Number(match[1]);
      const oldCount = match[2] === undefined ? 1 : Number(match[2]);
      const newStart = Number(match[3]);
      const newCount = match[4] === undefined ? 1 : Number(match[4]);
      index += 1;
      const body: string[] = [];
      let observedOld = 0;
      let observedNew = 0;
      while (index < lines.length && (observedOld < oldCount || observedNew < newCount)) {
        const line = lines[index]!;
        const prefix = line[0];
        if (prefix === " ") {
          observedOld += 1;
          observedNew += 1;
        } else if (prefix === "-") {
          observedOld += 1;
          changedLines += 1;
        } else if (prefix === "+") {
          observedNew += 1;
          changedLines += 1;
        } else {
          throw new PatchSyntaxError("Hunk contains a line without a unified-diff prefix.");
        }
        if (observedOld > oldCount || observedNew > newCount) throw new PatchSyntaxError("Hunk line counts exceed its header.");
        body.push(line);
        index += 1;
      }
      if (observedOld !== oldCount || observedNew !== newCount) throw new PatchSyntaxError("Hunk line counts do not match its header.");
      if (lines[index] === "\\ No newline at end of file") {
        body.push(lines[index]!);
        index += 1;
      }
      hunks.push({ oldStart, oldCount, newStart, newCount, lines: body });
    }
    if (hunks.length === 0) throw new PatchSyntaxError("Patch has no hunks.");
    files.push({ oldPath, newPath, hunks });
    if (index < lines.length && !lines[index]!.startsWith("diff --git ") && !lines[index]!.startsWith("--- ")) {
      throw new PatchSyntaxError("Unexpected content after a patch hunk.");
    }
  }

  if (files.length === 0 || changedLines === 0) throw new PatchSyntaxError("Patch has no changed lines.");
  const normalizedLines: string[] = [];
  for (const file of files) {
    normalizedLines.push(`--- ${file.oldPath}`, `+++ ${file.newPath}`);
    for (const hunk of file.hunks) {
      normalizedLines.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`, ...hunk.lines);
    }
  }
  return { files, normalized: `${normalizedLines.join("\n")}\n` };
}

function failure(status: PatchExtraction["status"], reason: string, targets: readonly string[] = []): PatchExtraction {
  return { status, exactPatch: null, patchHash: null, normalizedPatch: null, normalizedPatchHash: null, targets, reason };
}

export function extractCandidatePatch(responseText: string, permittedTarget: string): PatchExtraction {
  if (responseText.trim().length === 0) return failure("RESPONSE_FORMAT_FAILURE", "Provider returned an empty candidate response.");

  const fence = /```(?:diff|patch)?[ \t]*\r?\n([\s\S]*?\r?\n)```/g;
  const matches = [...responseText.matchAll(fence)];
  const patchBlocks = matches.filter((match) => patchMarker.test(match[1]!.replaceAll("\r\n", "\n")));
  if (patchBlocks.length > 1) return failure("MULTIPLE_PATCHES", "Response contains multiple fenced patch artifacts.");

  let exactPatch: string;
  if (patchBlocks.length === 1) {
    const masked = [...responseText];
    for (const match of matches) {
      const start = match.index!;
      for (let offset = start; offset < start + match[0].length; offset += 1) masked[offset] = " ";
    }
    if (patchMarker.test(masked.join("").replaceAll("\r\n", "\n"))) {
      return failure("EXTRACTION_AMBIGUOUS", "Response contains patch material both inside and outside a fenced artifact.");
    }
    exactPatch = patchBlocks[0]![1]!;
  } else {
    const normalized = responseText.replaceAll("\r\n", "\n");
    const marker = /(?:^|\n)(diff --git |--- )/.exec(normalized);
    if (!marker) {
      if (normalized.includes("@@ ") || normalized.includes("+++ ") || normalized.includes("```diff") || normalized.includes("```patch")) {
        return failure("MALFORMED_PATCH", "Response contains patch-like material without complete unified-diff headers.");
      }
      return failure("NO_PATCH", "Response contains no unified diff.");
    }
    const start = marker.index + (normalized[marker.index] === "\n" ? 1 : 0);
    exactPatch = normalized.slice(start);
  }

  let parsed: ParsedPatch;
  try {
    parsed = parseUnifiedDiff(exactPatch);
  } catch (error) {
    return failure("MALFORMED_PATCH", error instanceof Error ? error.message : "Unified diff is malformed.");
  }

  const targets = [...new Set(parsed.files.flatMap((file) => [file.oldPath, file.newPath]))];
  if (parsed.files.length !== 1 || targets.length !== 1 || targets[0] !== permittedTarget || parsed.files[0]!.oldPath !== parsed.files[0]!.newPath) {
    return failure("WRONG_TARGET", `Patch target must be exactly ${permittedTarget}.`, targets);
  }
  return {
    status: "EXTRACTED",
    exactPatch,
    patchHash: sha256Hex(exactPatch),
    normalizedPatch: parsed.normalized,
    normalizedPatchHash: sha256Hex(parsed.normalized),
    targets,
    reason: "One strict unified diff targets the permitted implementation file.",
  };
}

