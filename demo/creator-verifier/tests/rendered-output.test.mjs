import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const output = new URL("../dist/", import.meta.url);

test("build contains the benchmark evidence experience", async () => {
  const [html, css, app] = await Promise.all([readFile(new URL("index.html", output), "utf8"), readFile(new URL("styles.css", output), "utf8"), readFile(new URL("app.js", output), "utf8")]);
  assert.match(html, /<title>Creator–Verifier \| GDN Evidence<\/title>/i);
  assert.match(html, /A passing repair is not a verified repair/);
  assert.match(html, /More agents.*is not the point/s);
  assert.match(html, /Baseline fail · GDN pass/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(app, /renderStage\(2\)/);
  assert.doesNotMatch(`${html}\n${app}`, /analytics|googletag|segment|posthog|mixpanel|https?:\/\//i);
  await access(new URL("evidence.mjs", output));
});
