# GDN Engineering A/B Case 2 — p-map async mapper indices

## Locked case

- Repository: https://github.com/sindresorhus/p-map
- Public fix PR: https://github.com/sindresorhus/p-map/pull/88
- Pinned commit: `65aaa8f4d7e757a5254a146c4c39403efa9e2139`
- Invariant: `pMapIterable` mapper indices follow input iteration order, not promise settlement order.
- Original deterministic output: `[["a",2],["b",0],["c",1]]`; expected `[["a",0],["b",1],["c",2]]`.

## Results

| Measure | Baseline single agent | GDN verified |
|---|---|---|
| Original failure reproduced | Pass | Pass |
| Verified invariant | Pass | Pass |
| `npm test` | Pass: 50 tests, XO, TSD | Pass: 50 tests, XO, TSD |
| Scope | Pass: only `index.js` | Pass: only `index.js` |
| Patch | 3 insertions, 1 deletion | 3 insertions, 1 deletion |
| Side effects | None found | None found |
| Unresolved-risk detection | Partial | Strong |
| Approx. wall clock | about 2 minutes | about 4 minutes including verifier |
| Active time / usage | unavailable | unavailable |

Both arms independently produced content-identical patches:

```diff
diff --git a/index.js b/index.js
@@ -222,11 +222,13 @@ export function pMapIterable(
 					if (done) return {done: true};
+					const currentIndex = index++;
 					trySpawn();
 					try {
-						const returnValue = await mapper(await value, index++);
+						const returnValue = await mapper(await value, currentIndex);
```

Both ran the locked acceptance command, `npm test`, `git diff --check`, and status/diff inspection. The coordinator independently reran acceptance and `npm test` in both worktrees. The GDN verifier additionally exercised synchronous and mixed inputs, concurrency `1`, `2`, `4`, and `Infinity`, rejection propagation, mapper throws, `pMapSkip`, invocation count, and backpressure; all passed.

Blinded review was a tie because the content was identical. GDN added verification cost without changing the repair outcome.

## Classification

Baseline: verified success. GDN: verified success. Outcome tie; GDN supplied stronger evidence only.
