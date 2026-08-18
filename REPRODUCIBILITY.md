# Reproducing the three-round evidence

## Environment used

- Windows with PowerShell
- Node.js `v25.9.0`
- npm `11.12.1`
- Git `2.53.0.windows.2`

The exact serving model identifier, reasoning-effort field, active-agent time, token usage, and credit totals were not exposed. No estimates are substituted.

## Public sources and pinned commits

| Case | Upstream repository | Pinned faulty commit |
| --- | --- | --- |
| Round 1 / query-string | `https://github.com/sindresorhus/query-string.git` | `2e1f45aafb71ef247572b10d9d37dce67cd825ac` |
| Round 1 / p-map | `https://github.com/sindresorhus/p-map.git` | `65aaa8f4d7e757a5254a146c4c39403efa9e2139` |
| Round 1 / validator.js | `https://github.com/validatorjs/validator.js.git` | `96ff3b299084b05d52895688f0f7c98c9232047a` |
| Round 2 / camelcase | `https://github.com/sindresorhus/camelcase.git` | `c9fa59df2e32611c5c71d0f219f661fa8e1dfdf8` |
| Round 2 / cli-truncate | `https://github.com/sindresorhus/cli-truncate.git` | `2af3e232c8503d29bd81cb86c6a664721936fa0a` |
| Round 2 / Commander | `https://github.com/tj/commander.js.git` | `c3ffcfcdac9237cb446ae0acc5b228380e6ba52a` |
| Round 3 / ofetch | `https://github.com/unjs/ofetch.git` | `3617666273f439e1de2d2d1599c28fe86e075dbc` |

The external repositories are not included in this publication. Clone each repository from its public URL and check out the exact commit. The evidence repository contains only benchmark-owned controls and compact patches.

## Standard case reconstruction

From a clean temporary directory:

```sh
git clone <upstream-url> case-worktree
cd case-worktree
git checkout --detach <pinned-commit>
```

Install without lifecycle scripts. Round 1 used:

```sh
npm install --ignore-scripts --no-package-lock --no-audit --no-fund --legacy-peer-deps
```

Round 2 camelcase and cli-truncate used:

```sh
npm install --ignore-scripts --no-package-lock --no-audit --no-fund
```

Round 2 Commander used its owned lockfile:

```sh
npm ci --ignore-scripts --no-audit --no-fund
```

Round 3 uses its owned repository lockfile and an independently locked TypeScript 5.6.3 acceptance package. Install the acceptance compiler with:

```sh
cd evidence/round-3/acceptance
npm ci --ignore-scripts
```

Run the case’s acceptance script against the faulty worktree. It should fail before repair:

```sh
node <path-to-public-acceptance-script> <path-to-case-worktree>
```

For Round 3 on Windows/PowerShell, run:

```powershell
node evidence\round-3\acceptance\run.mjs <path-to-ofetch-worktree>
```

Apply the published GDN patch from the corresponding `cases/` directory:

```sh
git apply <path-to-gdn.patch>
node <path-to-public-acceptance-script> <path-to-case-worktree>
```

Round 3's selected patch is at `evidence/round-3/artifacts/patch-B.diff`:

```sh
git apply <path-to-round-3>/artifacts/patch-B.diff
```

Then run the repository checks named in the case report. A verified result additionally requires the full stated invariant, scope discipline, and any executed verifier counterexamples to pass.

## Published case controls

- [Round 1 controls](evidence/round-1/README.md#case-controls-and-patches)
- [Round 2 controls](evidence/round-2/README.md#case-controls-and-patches)
- [Round 3 controls](evidence/round-3/README.md#reproducibility-controls-and-selected-patch)

Each Round 1 and Round 2 case directory contains:

- `task.md` — the frozen matched-arm task;
- `acceptance.mjs` or `acceptance.cjs` — the frozen external acceptance script; and
- `gdn.patch` — the final GDN production diff against the pinned commit.

The SHA-256 values in each round’s `audit/control-hashes.md` were recorded before arm dispatch. The public task and acceptance copies must reproduce those values byte-for-byte. Reports were path-normalized separately and are not frozen controls.

Round 3 preserves its acceptance package under `evidence/round-3/acceptance/`, its verified patch under `evidence/round-3/artifacts/`, and its five required completed evidence artifacts byte-for-byte. The publication integrity check pins both the frozen controls and those five artifact copies.

## Repository checks used

The exact commands and host-specific exceptions are preserved in the round final reports:

- [Round 1 final report](evidence/round-1/final-report.md)
- [Round 2 final report](evidence/round-2/final-report.md)
- [Round 3 final report](evidence/round-3/final-report.md)

Notable exceptions:

- Round 2 cli-truncate used the locked split commands `npx xo index.js test.js`, `npx ava`, and `npx tsd` because the composite XO declaration-file project-service check was independently incompatible with this host.
- Round 2 Commander temporarily removed the host’s inherited `NO_COLOR` value while running `npm test`, then restored it.

## Acceptance and control-hash process

1. Reproduce the public defect at the pinned commit.
2. Freeze the task statement and external acceptance script.
3. Record SHA-256 hashes before either arm starts.
4. Run matched baseline and GDN candidate sessions from isolated worktrees.
5. Freeze the baseline after its permitted turn.
6. Permit a GDN repair loop only when independent executed evidence contradicts the candidate.
7. Re-run acceptance, repository regression checks, scope checks, and verifier probes.
8. Confirm frozen hashes are unchanged before classification.

## Known limits

- The evidence set contains seven small utility-library defects, and Round 3 contains only one case.
- Dependency resolution for five cases used the same no-lockfile install command in paired worktrees; Commander and ofetch supplied owned repository lockfiles.
- Matched arms used the same model tier within each case; this does not provide model-family independence.
- There was no external human adjudicator.
- Exact token and credit economics are unavailable.
- Public evidence supports reconstruction; it does not vendor dependencies or guarantee future upstream dependency availability.
