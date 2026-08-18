import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "README.md",
  "PUBLIC-RELEASE.md",
  "REPRODUCIBILITY.md",
  "THIRD-PARTY-NOTICES.md",
  "evidence/round-1/README.md",
  "evidence/round-1/protocol.md",
  "evidence/round-1/case-selection.md",
  "evidence/round-1/final-report.md",
  "evidence/round-2/README.md",
  "evidence/round-2/protocol.md",
  "evidence/round-2/case-selection.md",
  "evidence/round-2/final-report.md",
  "evidence/case-study/verified-repair.md",
  "demo/creator-verifier/package.json",
  "demo/creator-verifier/src/index.html",
];

for (const file of required) await access(path.join(root, file));

const controlHashes = new Map([
  ["evidence/round-1/cases/1-query-string/acceptance.mjs", "AD98755AFCB7D713440D978319B6915697DFC35DAE16A71BD3C3AA1527AAB057"],
  ["evidence/round-1/cases/2-p-map/acceptance.mjs", "D9355080E1A0DBD7A7B609DCA28B4FE36613264D1A28C766570DF424868832FD"],
  ["evidence/round-1/cases/3-validator-date/acceptance.cjs", "9239EC4E8807193888F45B38C40B061F414FC9DD0F1D300B74CC1AB226C799B8"],
  ["evidence/round-1/cases/1-query-string/task.md", "CEBCDE4628B5041B973D58DCD714E0D3CA2A4FC031811839AC0540822A074460"],
  ["evidence/round-1/cases/2-p-map/task.md", "99B99CB6AF98E88B5C811C1799868E8A2C0869AF508DEE9C45040054E6795492"],
  ["evidence/round-1/cases/3-validator-date/task.md", "26B9DE8713AE0B60AC1CC73FCDF8ED48D04F610FBCE98B4F82601D4CE562BFDB"],
  ["evidence/round-2/cases/1-camelcase/acceptance.mjs", "7C66C4D2DB025BD5B56C8EF004B3EA6FEDB5A566DC3C662395A314668317AA4E"],
  ["evidence/round-2/cases/2-cli-truncate/acceptance.mjs", "F9D35AB03BCBBAF74DA0B1C53A605557E954AB325549474B121EA9DBD8F5BF4B"],
  ["evidence/round-2/cases/3-commander/acceptance.cjs", "CDEBBA71AF98ADE159088EF2F66BDC9B412D7149C307F09753F37F695843D743"],
  ["evidence/round-2/cases/1-camelcase/task.md", "1CC2EA9C892C6DEF1F8B32D2E432E43C761AF717C84AC8DAE95EDCB3A9D56D34"],
  ["evidence/round-2/cases/2-cli-truncate/task.md", "270BC2F432A887F764F30E24CCEF16F99F899FB20D53AD3454B2AD12D5B54A77"],
  ["evidence/round-2/cases/3-commander/task.md", "80233C44F7616006D1FC1CCE2CD5C7125D58C4AD91A1BD9D2FD10806C8010B90"],
]);

for (const [file, expected] of controlHashes) {
  const actual = createHash("sha256").update(await readFile(path.join(root, file))).digest("hex").toUpperCase();
  assert.equal(actual, expected, `frozen control changed: ${file}`);
}

const markdownFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "*.md", "evidence/**/*.md", "demo/creator-verifier/**/*.md"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const localLinkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
let linkCount = 0;
for (const file of markdownFiles) {
  const text = await readFile(path.join(root, file), "utf8");
  for (const match of text.matchAll(localLinkPattern)) {
    let target = match[1].trim().replace(/^<|>$/g, "").split(/\s+\"/)[0];
    if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
    target = decodeURIComponent(target.split("#")[0]);
    if (!target) continue;
    const resolved = path.resolve(path.dirname(path.join(root, file)), target);
    assert.ok(resolved === root || resolved.startsWith(`${root}${path.sep}`), `link escapes repository: ${file} -> ${target}`);
    const info = await stat(resolved).catch(() => null);
    assert.ok(info, `broken local link: ${file} -> ${target}`);
    linkCount++;
  }
}

const candidateOutput = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: root, encoding: "utf8" });
const candidateFiles = candidateOutput.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).replaceAll("\\", "/"));
const excluded = /(^|\/)(?:node_modules|dist|coverage|\.git|\.openai|\.wrangler|\.vinext|\.npm-cache|outputs|work)(?:\/|$)|(^|\/)\.env(?:\.|$)/i;
for (const file of candidateFiles) assert.doesNotMatch(file, excluded, `excluded path is a release candidate: ${file}`);

// This audit source necessarily contains the patterns it searches for.
const releaseTextFiles = candidateFiles.filter((file) => file !== "scripts/check-public-release.mjs" && /\.(?:md|mjs|cjs|js|json|html|css|patch|txt)$/i.test(file));
const privatePattern = /C:\\Users\\timot|\.codex|AppData\\Roaming|GH_CONFIG_DIR|github_pat_|ghp_[A-Za-z0-9]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;
for (const file of releaseTextFiles) {
  const text = await readFile(path.join(root, file), "utf8");
  assert.doesNotMatch(text, privatePattern, `private or credential-like content in ${file}`);
}

for (const patch of [...controlHashes.keys()].filter((file) => file.endsWith("task.md")).map((file) => file.replace("task.md", "gdn.patch"))) {
  const info = await stat(path.join(root, patch));
  assert.ok(info.size > 100, `patch is unexpectedly empty: ${patch}`);
}

console.log(`PASS: 12 frozen control hashes match`);
console.log(`PASS: ${linkCount} repository-relative Markdown links resolve`);
console.log(`PASS: ${candidateFiles.length} changed/untracked release files exclude forbidden paths`);
console.log(`PASS: ${releaseTextFiles.length} release text files contain no private path or credential pattern`);
console.log("PASS: six GDN patches are present and non-empty");
