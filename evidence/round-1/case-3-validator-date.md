# GDN Engineering A/B Case 3 — validator.js malformed date shape

## Locked case

- Repository: https://github.com/validatorjs/validator.js
- Public fix PR: https://github.com/validatorjs/validator.js/pull/2443
- Pinned commit: `96ff3b299084b05d52895688f0f7c98c9232047a`
- Invariant: malformed date segment counts return `false` without throwing; valid dates remain accepted.
- Original reproduction: `2024-05` threw `TypeError`; `2024-05-01-abc` returned `true`.

## Results

| Measure | Baseline single agent | GDN verified |
|---|---|---|
| Original failure reproduced | Pass | Pass |
| Verified invariant | Pass | Pass |
| Build/lint/regression | Pass: 263 tests | Pass: 263 tests |
| Coverage | 100% statements/functions/lines; 97.08% branches | Same |
| Scope | Pass: only `src/lib/isDate.js` | Same |
| Patch | 8 insertions, 4 deletions | Content-identical |
| Side effects | None found | None found |
| Unresolved-risk detection | Partial | Strong |
| Approx. wall clock | about 2 minutes | about 3 minutes including verifier |
| Active time / usage | unavailable | unavailable |

Both arms produced content-identical patches:

```diff
diff --git a/src/lib/isDate.js b/src/lib/isDate.js
@@ -33,10 +33,14 @@ export default function isDate(input, options) {
-    const dateAndFormat = zip(
-      input.split(dateDelimiter),
-      options.format.toLowerCase().split(formatDelimiter)
-    );
+    const dateParts = input.split(dateDelimiter);
+    const formatParts = options.format.toLowerCase().split(formatDelimiter);
+
+    if (dateParts.length !== formatParts.length) {
+      return false;
+    }
+
+    const dateAndFormat = zip(dateParts, formatParts);
```

Both ran the locked acceptance harness, source inspection, diff/status checks, and the full pipeline. Required command:

```powershell
$env:SPAWN_WRAP_SHIM_ROOT='<worktree>\.spawn-wrap'
New-Item -ItemType Directory -Force -Path $env:SPAWN_WRAP_SHIM_ROOT | Out-Null
npm test
```

The coordinator independently reran acceptance and the full pipeline in both worktrees. The GDN verifier additionally checked default and alternate formats, `/`, `-`, dot and space delimiters, strict/non-strict mode, missing/extra/empty/mixed segments, leap/calendar validity, and `Date` objects. All passed.

Blinded review was a tie and judged the shared patch correct, clear, minimal, and low risk. GDN added verification cost without changing the outcome.

## Classification

Baseline: verified success. GDN: verified success. Outcome tie; GDN supplied stronger evidence only.
