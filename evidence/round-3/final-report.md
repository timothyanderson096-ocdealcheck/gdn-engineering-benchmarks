# GDN Engineering A/B Round 3 — `ofetch` report

## Result

| Arm | Frozen acceptance | Repository typecheck | Runtime tests | Source scope | Result |
|---|---|---|---|---|---|
| Baseline single agent | FAIL, 5 diagnostics | PASS | 27/28 full suite; shared port-only failure | `src/types.ts`, 7 insertions/4 deletions | Loss |
| GDN verified | PASS | PASS | focused create/defaults test PASS; 27/28 full suite with same port-only failure | `src/types.ts`, `src/fetch.ts`, 8 insertions/5 deletions | Win |

Classification: **GDN win**. This is neither a tie nor a mutual failure.

## Original failure

At the clean pin, TypeScript 5.6.3 rejected `$fetch.create(textDefaults)` where `textDefaults` was `FetchOptions<"text">` with a typed `retryDelay` callback:

```text
Argument of type 'FetchOptions<"text", any>' is not assignable to parameter of type 'FetchOptions<ResponseType, any>'.
... Type 'ResponseType' is not assignable to type '"text"'.
```

The frozen gate reported five diagnostics: the original `text` and `blob` assignment failures plus incorrect callable, `raw()`, and blob-default result types.

## Baseline

The baseline changed only `src/types.ts`. It introduced `$Fetch<DefaultT>` and propagated `DefaultT` as the parsed JSON payload type through the callable, `raw()`, and `create<T>()`.

Evidence:

- `node ..\acceptance\run.mjs .` — FAIL with the same five diagnostics as the clean pin.
- `.\node_modules\.bin\tsc.CMD --noEmit` — PASS.
- changed-file ESLint, Prettier, and `git diff --check` — PASS.
- `.\node_modules\.bin\vitest.CMD run` — 27 passed, 1 failed. The failure expected port 3000 while the test listener selected 3001; it is present at the clean pin and in both arms.

The baseline is frozen in `baseline-single-agent`; no repair was attempted.

## GDN

The initial GDN candidate was byte-identical to the baseline patch and failed independent verification. The verifier's executed evidence activated the single bounded repair. The final patch:

- changes `$Fetch` to `$Fetch<DefaultR extends ResponseType = "json">`;
- defaults callable and `raw()` `R` to `DefaultR`;
- changes `create<R>(defaults: FetchOptions<R>)` to return `$Fetch<R>`; and
- adds one localized `as FetchOptions` at the internal merged-defaults storage boundary.

Evidence:

- final independent verifier verdict — PASS;
- `node ..\acceptance\run.mjs .` — `ACCEPTANCE: PASS`;
- `.\node_modules\.bin\tsc.CMD --noEmit` — PASS;
- changed-file ESLint, Prettier, and `git diff --check` — PASS;
- `.\node_modules\.bin\vitest.CMD run -t "deep merges defaultOptions"` — 1 passed, 27 skipped;
- full Vitest — 27 passed, 1 shared hard-coded-port failure;
- blinded reviewer — selected Patch B.

The final Patch B applied in `evaluation` produces the same SHA-256 diff as `artifacts/patch-B.diff`.

## Controls and limitations

All frozen hashes matched again after final validation. No test, fixture, acceptance file, control hash, or benchmark artifact was modified by either engineering arm.

Limitations:

- The full repository `pnpm test` cannot be reported green on this host: unchanged files fail the full-tree Prettier check because of Windows checkout line endings, and the full Vitest suite has a pre-existing port-3000 assertion while the listener uses 3001.
- Patch B's internal assertion and the secondary `customGlobalOptions.defaults.responseType` conflict path remain residual type-modeling risks.
- This is one repository, one issue, and one matched run; it does not estimate general performance.

## Strongest supported conclusion

In this case, both initial engineers made the same incorrect abstraction, but the GDN verifier caught it by executing the frozen type contract and the single bounded repair produced the only patch that satisfies the required callable and `raw()` response-format propagation. Therefore the evidence supports a **GDN win for this case**, not a broader claim beyond it.
