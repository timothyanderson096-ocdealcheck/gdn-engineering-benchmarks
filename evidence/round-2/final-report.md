# GDN Engineering A/B Round 2 — Final Report

## Result

Round 2 produced **2/3 verified GDN repairs** and **1/3 verified baseline repairs**. GDN won one case, lost none, and tied two; one tie was a mutual failure.

| Case | Baseline | GDN | Comparison |
|---|---|---|---|
| camelcase numeric boundary | Fail: superlinear performance regression | Fail: punctuation regression after one bounded loop | Fail/fail tie |
| cli-truncate width budget | Fail: overwide markers still exceed budget | Pass after verifier-driven loop | GDN win |
| Commander uppercase exponent | Pass | Pass | Pass/pass tie |
| **Verified repairs** | **1/3** | **2/3** | **GDN +1** |

## Exact commits and commands

| Case | Pinned commit | Install | Regression |
|---|---|---|---|
| camelcase | `c9fa59df2e32611c5c71d0f219f661fa8e1dfdf8` | `npm install --ignore-scripts --no-package-lock --no-audit --no-fund` | `npm test` |
| cli-truncate | `2af3e232c8503d29bd81cb86c6a664721936fa0a` | same unlocked install | `npx xo index.js test.js`; `npx ava`; `npx tsd` |
| Commander | `c3ffcfcdac9237cb446ae0acc5b228380e6ba52a` | `npm ci --ignore-scripts --no-audit --no-fund` | temporarily remove inherited `NO_COLOR`; `npm test`; restore it |

Acceptance commands:

```powershell
node cases/1-camelcase/acceptance.mjs <worktree>
node cases/2-cli-truncate/acceptance.mjs <worktree>
node cases/3-commander/acceptance.cjs <worktree>
```

The coordinator independently reran all final acceptance/regression commands and hidden differentiating probes. Final task/harness hashes exactly matched the pre-dispatch values.

## What verification changed

Case 2 was the Round 2 improvement. Both engineers fixed marker-width reservation and passed the frozen harness. Verification tested the stronger explicit invariant—output width never exceeds the budget—and found that markers wider than the budget were returned intact. The bounded GDN loop fitted the marker safely; more than 54,000 independent output checks then passed. The frozen baseline retained confirmed failures.

Case 1 shows a harder outcome. Verification found a severe performance regression in the shared initial repair. The one permitted loop removed it, but re-verification found a punctuation regression. The protocol correctly stopped; GDN is scored as a failure despite detecting both defects. Independent verification prevented a false success, but the bounded process did not produce a shippable result.

Case 3 was a clean tie. Verification broadened evidence but did not change the one-token repair.

## Time and usage

Paired engineering intervals were 227.25 s, 163.95 s, and 211.97 s for Cases 1–3. GDN dispatch-to-final-classification checkpoints were 826.00 s, 591.55 s, and at most 447.47 s. These are wall-clock notification intervals, documented in `audit/session-timing-and-usage.md`. Active-agent time, exact serving identifier, reasoning effort, tokens, and credits were not visible.

## Blinded review

The anonymous reviewer preferred the baseline in Case 1, strongly preferred GDN in Case 2, and tied Case 3. Executed evidence overruled patch appearance where necessary: the preferred Case 1 baseline had the confirmed performance regression.

## Combined evidence from both rounds

| Measure | Baseline | GDN |
|---|---:|---:|
| Round 1 verified repairs | 2/3 | 3/3 |
| Round 2 verified repairs | 1/3 | 2/3 |
| **Combined** | **3/6** | **5/6** |

Across six cases, GDN recorded two wins, four ties (three pass/pass and one fail/fail), and no losses. Both wins came from executed verifier counterexamples after initial green checks. In one additional case, verification prevented acceptance but exhausted the bounded repair process without success.

## Limitations and conclusion

Six small public library defects remain an inadequate basis for broad superiority claims. All sessions shared one host and model family. Exact usage economics are unavailable. Two repositories lacked lockfiles, and Case 2 used split regression commands because the composite XO declaration-file project-service check was incompatible with this host.

The strongest evidence-bounded conclusion is:

> Across two controlled three-case rounds, GDN produced five verified repairs versus three for matched single-agent baselines. Its two wins came from independent executable counterexamples missed by initial repairs and standard checks. One GDN case still failed after the bounded repair loop, and three successful cases were outcome ties with added verification cost. The evidence supports independent verification as a promising quality-control mechanism, not a claim of broad or universal superiority.

Publication should retain the per-case failures, costs, environment qualifications, and absence of visible usage metrics.
