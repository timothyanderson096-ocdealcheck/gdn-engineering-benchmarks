# Round 2 Case 1 — camelcase numeric identifier boundaries

## Locked case

- Repository: https://github.com/sindresorhus/camelcase
- Public fix PR: https://github.com/sindresorhus/camelcase/pull/112
- Pinned commit: `c9fa59df2e32611c5c71d0f219f661fa8e1dfdf8`
- Original output: `b2BRegistrationRequest`; expected `b2bRegistrationRequest`.
- Acceptance hash: `7C66C4D2DB025BD5B56C8EF004B3EA6FEDB5A566DC3C662395A314668317AA4E`.
- Task hash: `1CC2EA9C892C6DEF1F8B32D2E432E43C761AF717C84AC8DAE95EDCB3A9D56D34`.

## Score

| Measure | Baseline | GDN |
|---|---|---|
| Original failure reproduced | Pass | Pass |
| Locked acceptance | Pass | Pass |
| `npm test` | Pass: XO, AVA 7, TSD | Same |
| Full verified outcome | **Fail** | **Fail** |
| Scope | Only `index.js` | Only `index.js` |
| Final patch size | 3+/3- | 7+/2- |
| Confirmed problem | Severe superlinear regex backtracking | Intervening-punctuation semantic regression |
| Risk detection | Absent | Strong, but bounded loop exhausted |
| Comparative result | **Fail/fail tie** | **Fail/fail tie** |

Both initial engineers reordered numeric processing and added a lookahead. The frozen harness and normal suite passed. The GDN verifier's correctness matrix passed, but its performance probe isolated severe backtracking: at a 2,000-digit/2,000-letter shape the candidate took about 2.6 seconds; at a 4,000-scale case it exceeded 30 seconds. The baseline retained the same regex. Coordinator confirmation on the frozen baseline measured 545.35 ms at only 2,000 digits plus a short suffix, versus the task's pre-existing sub-millisecond behavior.

The one permitted GDN repair loop replaced the regex with a linear reverse scan; timings then remained below 1 ms through much larger inputs. Re-verification found a new semantic counterexample:

```text
input:    b2b@registration_request
expected: b2B@registrationRequest
GDN:      b2b@registrationRequest
```

`@` is not a configured separator, so the earlier numeric transition should still capitalize. The one-loop protocol stop condition had been reached; no second repair was allowed. GDN therefore detected important risks but did not deliver a verified final repair.

Baseline final diff:

```diff
-const NUMBERS_AND_IDENTIFIER = new RegExp('\\d+' + IDENTIFIER.source, 'gu');
+const NUMBERS_AND_IDENTIFIER = new RegExp('\\d+' + IDENTIFIER.source + '(?![\\p{Alpha}\\p{N}]*' + SEPARATORS.source + ')', 'gu');
@@
-return input.replace(SEPARATORS_AND_IDENTIFIER, (_, identifier) => toUpperCase(identifier))
-  .replace(NUMBERS_AND_IDENTIFIER, m => toUpperCase(m));
+return input.replace(NUMBERS_AND_IDENTIFIER, m => toUpperCase(m))
+  .replace(SEPARATORS_AND_IDENTIFIER, (_, identifier) => toUpperCase(identifier));
```

GDN final diff:

```diff
@@ postProcess
-return input.replace(SEPARATORS_AND_IDENTIFIER, (_, identifier) => toUpperCase(identifier))
-  .replace(NUMBERS_AND_IDENTIFIER, m => toUpperCase(m));
+let lastSeparatorIndex = input.length - 1;
+while (lastSeparatorIndex >= 0 && !SEPARATORS.test(input[lastSeparatorIndex])) {
+  lastSeparatorIndex--;
+}
+return (input.slice(0, lastSeparatorIndex + 1) + input.slice(lastSeparatorIndex + 1).replace(NUMBERS_AND_IDENTIFIER, m => toUpperCase(m)))
+  .replace(SEPARATORS_AND_IDENTIFIER, (_, identifier) => toUpperCase(identifier));
```

Commands actually executed included the locked acceptance, `npm test`, `git diff --check`, status/diff inspection, a 38-case then 25-case correctness matrix, Unicode/combining probes, and timed scaling/control commands. Coordinator hidden probe exited 1 for both final arms: baseline on runtime, GDN on punctuation semantics.

Blinded review preferred the baseline patch for apparent precision and warned the GDN prefix approach was broad. It did not identify the baseline's executed performance regression.
