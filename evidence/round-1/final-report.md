# GDN Engineering A/B Benchmark — Final Report

## Benchmark question

> Does GDN produce a better verified software-engineering outcome than a single capable coding agent working from the same task, source commit, model tier, and tool access?

Within this three-case benchmark, yes: GDN achieved 3/3 verified repairs and the baseline achieved 2/3. The improvement came entirely from independent verification in Case 1. This supports the claim for this small sample; it does not establish general GDN superiority.

## Scoreboard

| Case | Pinned commit | Baseline | GDN | Comparative result |
|---|---|---|---|---|
| query-string encoded separator | `2e1f45aafb71ef247572b10d9d37dce67cd825ac` | **Fail** full invariant; locked harness/suite pass | **Pass** after verifier-driven loop | GDN win |
| p-map async mapper index | `65aaa8f4d7e757a5254a146c4c39403efa9e2139` | Pass | Pass | Tie; GDN added evidence/cost |
| validator.js malformed date | `96ff3b299084b05d52895688f0f7c98c9232047a` | Pass | Pass | Tie; GDN added evidence/cost |
| **Total verified successes** |  | **2/3** | **3/3** | **GDN +1 case** |

All six final worktrees passed their repository regression/build/type commands and scope checks. The baseline loss is not based on a test-suite failure: it is based on direct counterexamples to the stated invariant.

## Exact setup and evaluation commands

All cases used Node.js `v25.9.0`, npm `11.12.1`, git `2.53.0.windows.2`, Windows/PowerShell, and:

```powershell
npm install --ignore-scripts --no-package-lock --no-audit --no-fund --legacy-peer-deps
```

Acceptance:

```powershell
node cases/1-query-string/acceptance.mjs <worktree>
node cases/2-p-map/acceptance.mjs <worktree>
node cases/3-validator-date/acceptance.cjs <worktree>
```

Repository checks:

```powershell
npm test  # query-string and p-map
$env:SPAWN_WRAP_SHIM_ROOT='<validator-worktree>\.spawn-wrap'; npm test
git status --short
git diff --check
git diff --stat
```

The coordinator independently reran every final acceptance and repository suite. Final SHA-256 hashes exactly matched the pre-dispatch task/harness hashes in `audit/control-hashes.md`.

## What GDN improved

In Case 1, both engineers made the same plausible one-line patch. It passed the precommitted harness and all 155 repository tests. The independent verifier challenged the actual wording “literal separator in the raw query value” with separators `%`, `7`, and space. The patch split inside `%25`, `%37`, `%7C`, and after `+` normalization. A bounded repair loop then produced a raw-aware scanner, and re-verification covered malformed escapes, `decode:false`, empty/null values, non-ASCII separators, plus, space, and comma compatibility.

That is a genuine engineering improvement: the verifier found executable counterevidence, the repair changed only in response to it, and the final GDN patch satisfied cases the baseline did not.

## Where GDN added cost without improving outcome

Cases 2 and 3 were clean ties. The baseline and GDN candidates produced content-identical patches, passed identical suites, and received tied blinded patch-quality reviews. GDN's extra verifier sessions increased confidence and exercised more boundaries, but did not improve the delivered source outcome. Approximate dispatch-to-classification time was roughly double for GDN in these cases. Product-reported active-time, token, and credit metrics were unavailable, so no invented usage comparison is provided.

## Blinded review result

- Case 1: anonymous Arm A (later revealed as baseline) was preferred for minimality; Arm B (GDN) looked more complex. Executed counterexamples nevertheless proved Arm A incomplete and Arm B correct. This shows that human-readable patch review without adversarial execution can favor the wrong repair.
- Cases 2 and 3: ties because final patch content was identical.

## Limitations

- Three small utility-library defects are not representative of all software engineering.
- The same inherited Codex GPT-5-class configuration was used across sessions; exact serving identifier and reasoning-effort fields were not exposed. This tests session/role separation, not model-family independence.
- The root coordinator prepared controls and made the final evidence decision; there was no external human adjudicator. Blinded patch-review agents were separate but from the same model family.
- Wall-clock values are approximate dispatch-to-notification intervals; the product exposed neither active-agent time nor token/credit totals.
- Dependency versions were resolved without repository lockfiles, using the same install command in paired worktrees.
- The Case 1 locked harness did not cover all valid separator characters. Independent verifier probes, not a post hoc edited control, supplied the decisive evidence. The locked harness was never modified after dispatch.
- Discovery initially encountered automated safety-classifier blocks despite the explicitly non-security scope; this did not affect arm execution or scoring.

## Conclusion and publication recommendation

The completed evidence **supports the central claim in this benchmark**: GDN produced one more verified repair than the single-agent baseline (3/3 versus 2/3). It also shows the cost tradeoff clearly: in two of three cases, verification added work without changing the result.

Recommended publication language:

> In a controlled three-case Node.js benchmark, an independently verified workflow produced three verified repairs versus two for a matched single-agent baseline. The sole improvement came from a verifier finding raw-encoding boundary counterexamples missed by both engineers, the locked acceptance test, the repository suite, and blinded patch review. Two cases were outcome ties with additional verification cost. These pilot results support further evaluation of independent verification but do not establish broad superiority.

Do not publish a stronger claim from this sample.
