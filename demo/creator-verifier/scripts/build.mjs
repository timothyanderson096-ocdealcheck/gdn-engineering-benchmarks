import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src");
const output = path.join(root, "dist");

if (path.dirname(output) !== root || path.basename(output) !== "dist") {
  throw new Error(`refusing to clean unexpected output path: ${output}`);
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
console.log("PASS: built dependency-free Creator–Verifier demo to dist/");
