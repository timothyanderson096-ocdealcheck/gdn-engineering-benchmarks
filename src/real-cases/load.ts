import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { REAL_CASE_SCHEMA_VERSION, type RealResolvedCase } from "./types.js";
import { parseRealResolvedCase } from "./validate.js";

type Header = { schemaVersion?: unknown; recordKind?: unknown };

export async function loadRealCaseDirectory(directory: string): Promise<RealResolvedCase[]> {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.name.localeCompare(b.name));
  const cases: RealResolvedCase[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    const raw = await readFile(path, "utf8");
    let parsed: unknown;
    try { parsed = JSON.parse(raw) as unknown; }
    catch (error) { throw new TypeError(`Invalid JSON in ${path}: ${String(error)}`); }
    const header = parsed && typeof parsed === "object" ? parsed as Header : {};
    if (header.recordKind === "TEMPLATE") {
      if (header.schemaVersion !== REAL_CASE_SCHEMA_VERSION) throw new TypeError(`Template ${path} has an invalid schemaVersion.`);
      continue;
    }
    try { cases.push(parseRealResolvedCase(parsed)); }
    catch (error) { throw new TypeError(`${path}: ${String(error)}`); }
  }
  return cases;
}
