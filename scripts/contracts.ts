import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertPresentationContract } from "../src/contracts/validate.js";
import { serializeDecisionPresentation } from "../src/contracts/serialize.js";
import { analyze } from "../src/engine.js";
import { createVolvoCase } from "../src/fixtures/volvo.js";

const outputDirectory = join(process.cwd(), "examples", "contracts");
const write = process.argv.includes("--write");
const decisionCase = analyze(createVolvoCase(), { now: new Date("2026-08-13T10:00:00.000Z") }).decisionCase;
const modes = ["CONDENSED", "BALANCED", "AUDIT"] as const;

await mkdir(outputDirectory, { recursive: true });

for (const mode of modes) {
  const payload = serializeDecisionPresentation(decisionCase, mode);
  assertPresentationContract(payload);
  const expected = `${JSON.stringify(payload, null, 2)}\n`;
  const path = join(outputDirectory, `volvo.${mode.toLowerCase()}.json`);
  if (write) {
    await writeFile(path, expected, "utf8");
    console.log(`wrote ${path}`);
    continue;
  }
  let actual: string;
  try {
    actual = await readFile(path, "utf8");
  } catch {
    throw new Error(`Missing contract fixture: ${path}. Run the generator with --write.`);
  }
  if (actual !== expected) throw new Error(`Contract fixture is stale: ${path}. Run the generator with --write and review the diff.`);
  console.log(`verified ${path}`);
}
