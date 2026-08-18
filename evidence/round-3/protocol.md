# GDN Engineering A/B Round 3 — `unjs/ofetch` protocol

## Scope and prohibitions

This was a local, single-case benchmark run on 2026-08-18 (Australia/Sydney). The source issue was used only to establish the symptom and historical window. No credentials or provider APIs were used, and no commit, push, publication, issue, pull request, or maintainer contact was performed.

## Acceptance gate

The public issue reported that a response-kind-specific `FetchOptions<"json">` could not be passed to `$Fetch.create()` because the method accepted the widened `FetchOptions<ResponseType>`. Local history established:

- `3482a56451332ff57460a8426629385f35ab5a3f` introduced the exported `$Fetch` declaration.
- `9a5640ce150a29ce948fb28bf5968b31e1600706` added callback-form `retryDelay`, making the generic variance failure directly observable.
- `7030ad93f597593ec5318cfcfc0bdade631ade8b` last changed the `create` signature before the report, adding `globalOptions` but retaining unparameterized `FetchOptions` and `$Fetch`.
- The benchmark pin is `3617666273f439e1de2d2d1599c28fe86e075dbc`, the final code commit before the v1.4.1 release commit and before the issue opened. The subsequent release commit changed only `CHANGELOG.md` and the package version, so the pinned source is code-identical to v1.4.1.

At the pin, the standalone TypeScript 5.6.3 harness deterministically produced the reported `FetchOptions<"text">` versus `FetchOptions<ResponseType>` callback-variance error. It also proved that the returned callable and `raw()` degraded rather than retaining `string`, and repeated the check with `blob`.

The gate was accepted before either engineering arm began. The task statement, harness, runner, package manifest, and lockfile were then frozen under `acceptance/`; their SHA-256 values are in `audit/control-hashes.md`.

## Frozen invariant and contract checks

> A generic response type supplied through `$Fetch.create()` must propagate to the returned `$Fetch` callable and its relevant methods without degrading to an incorrect or overly broad type.

The frozen harness checks:

1. a callback-bearing `FetchOptions<"text">` is accepted by `create()`;
2. the created callable returns `Promise<string>` by default;
3. `raw()` returns `Promise<FetchResponse<string>>` by default;
4. explicit per-call `blob` and `arrayBuffer` overrides remain exact;
5. `create`, `raw`, and `native` remain exposed; and
6. an independent `blob` default propagates, guarding against a text-only special case.

## Matched arms

All worktrees were detached at the same pin and installed from the same lockfile:

- `baseline-single-agent`
- `gdn-verified`
- `evaluation`

The baseline engineer and GDN candidate both received GPT-5.6 Codex Sol, high reasoning, local repository/shell tools, the same frozen task statement, and a 15-minute total engineering active-time envelope. Neither received the issue, upstream patch/PR/commit information, acceptance controls, other-arm state, or benchmark reports during the initial attempt.

- Baseline: one independent attempt, then frozen.
- GDN: one candidate attempt, an independent evidence-executing verifier, and one five-minute repair bounded within the original engineering envelope because the verifier demonstrated a contract failure.
- Final comparison: anonymized Patch A and Patch B diffs plus blinded execution results were reviewed without arm identities.

No existing source test, fixture, frozen control, hash, or benchmark artifact was changed to obtain a pass.

## Validation commands

Commands were run from each applicable worktree:

```powershell
node ..\acceptance\run.mjs .
.\node_modules\.bin\tsc.CMD --noEmit
.\node_modules\.bin\eslint.CMD src\types.ts src\fetch.ts
.\node_modules\.bin\prettier.CMD -c src\types.ts src\fetch.ts
git diff --check
.\node_modules\.bin\vitest.CMD run -t "deep merges defaultOptions"
.\node_modules\.bin\vitest.CMD run
```

The repository-level `pnpm test` was also attempted at the clean pin. On this Windows checkout it stopped at the pre-existing full-tree Prettier check because checkout line endings made unchanged files appear unformatted. Therefore the changed-file formatter check, repository TypeScript check, focused runtime test, and direct full Vitest command were recorded separately.

## Pinned toolchain

- Repository commit: `3617666273f439e1de2d2d1599c28fe86e075dbc`
- Acceptance TypeScript: 5.6.3, exactly pinned by `acceptance/package-lock.json`
- Repository lock resolution: TypeScript 5.6.2, Vitest 2.1.2, ESLint 9.12.0, Prettier 3.3.3
- Node.js: v25.9.0
- pnpm used for installation: 11.19.0; repository metadata declares pnpm 9.9.0

Raw command outputs are retained under `audit/logs/`.
