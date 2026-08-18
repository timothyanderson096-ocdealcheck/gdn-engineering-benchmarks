import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = fileURLToPath(new URL("../test/", import.meta.url));

async function discoverTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await discoverTests(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

const testFiles = (await discoverTests(testRoot))
  .sort((left, right) => left.localeCompare(right));

if (testFiles.length === 0) {
  console.error("No .test.ts files were discovered.");
  process.exit(1);
}

console.log(`Discovered ${testFiles.length} test files.`);

const result = spawnSync(
  process.execPath,
  ["--import=tsx", "--test", ...testFiles],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
