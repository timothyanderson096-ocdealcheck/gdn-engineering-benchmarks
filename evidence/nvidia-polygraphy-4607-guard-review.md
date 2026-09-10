# Polygraphy #4607: tested branch-freezing guard

Verified on 10 September 2026. Status: patch tested in the independent evidence repository; not submitted to or accepted by NVIDIA.

The patch prevents the covered multi-iteration input reductions from silently replacing a branch with values from only the first iteration. It rejects the operation with an actionable diagnostic. It does not implement general multi-sample branch freezing.

## Evidence

- Upstream: [NVIDIA/TensorRT #4607](https://github.com/NVIDIA/TensorRT/issues/4607), pinned at `c93b7d4893184af4882f9f1862e13a5c64b8677d`.
- Tested packet commit: `ab1ecaaa0644f48669336cace102b836ba5d1491`.
- [Successful fix-validation workflow](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/34438215413), job `102747625202`; completed `2026-09-10T04:43:18Z`.
- [Measured results](nvidia-polygraphy-4607-guard-result-20260910.json).
- [Exact tested patch](nvidia-polygraphy-4607-verified-guard.patch), SHA-256 `8c66ccc384c0d8b0314e22063584609db9afde0e88fb3dbec9b23ff4ca1484e3`.
- [Earlier independently measured reproduction](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/34437648737): expected outputs 2, 4 became 2, 3 under both linear and bisect input reduction; single-input and output-only controls preserved outputs.

## Test results

| Coverage | Original source | Patched source |
| --- | --- | --- |
| Two samples; linear/bisect; file/generator; normal/forced fallback | 8 expected regression failures | 8 pass |
| Single-sample generator; both modes; normal/forced fallback | Not rerun in this fix validation | 4 pass |
| Two samples with input reduction disabled; both modes | Earlier reproduction covered both samples | 2 pass |
| Two samples in an unbranched graph; both modes | Not run in this fix validation | 2 pass |

The eight baseline tests failed because the unpatched command returned success instead of rejecting unsafe branch freezing. There were no baseline test errors or skips. The patched run had 16 tests, zero failures, zero errors and zero skips.

The tests independently compute intermediate reference feeds with ONNX Runtime CPU. Checker infrastructure errors have a distinct exit code. The tests check the diagnostic, absence of a final reduced model after rejection, one-shot generator consumption, and structural/numerical correctness of the passing controls.

## Change

1. Allow fallback inference to receive an optional shared DataLoaderCache.
2. Reuse that cache during reduction, and check its iteration count at the actual branch-freezing point, including when fallback outputs were already cached.
3. Reject multiple iterations before converting orphaned tensors to constants.
4. Document the limitation and add the self-contained CPU regressions.

The cache is created lazily. Existing fallback callers retain their default behavior. A nonempty set of tensors to freeze guarantees fallback data has been loaded before the guard checks the cache length.

## Reproduce the validation

The [pinned workflow and packet](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/tree/ab1ecaaa0644f48669336cace102b836ba5d1491/evidence/in-progress/nvidia-polygraphy-4607/guard) record the complete dependency setup. With the evidence repository checked out as `packet`, that environment installed, and the pinned NVIDIA checkout at `upstream`, run:

```sh
python packet/evidence/in-progress/nvidia-polygraphy-4607/guard/validate_guard.py --upstream upstream --artifacts artifacts
```

The validator first runs eight regression cases on original source, applies the candidate patch, formats the new test with Black 25.1.0, then runs all 16 tests and records the resulting exact diff. The input candidate and final tested patch differ in test-file formatting; use the linked exact tested patch for review.

Environment: Python 3.12.14; NumPy 2.3.5; ONNX 1.22.0; ONNX Runtime 1.23.2; Polygraphy 0.49.27 and ONNX GraphSurgeon 0.6.2 installed from the pinned NVIDIA source; pytest 9.1.1.

## Scope and remaining review

Only the focused CPU file was run with `pytest --noconftest`; the existing tools conftest imports TensorRT. No TensorRT/GPU backend or full upstream suite result is claimed.

The guard is deliberately conservative and also rejects branches whose values happen to be invariant across samples. Input data supplied only to an external `--check` command is outside the reducer's loader and cannot be counted here. Neither general numerical equivalence nor all reducer behavior is established by these tests.

The separate data-to-input aliasing problem is excluded; [PR #4779](https://github.com/NVIDIA/TensorRT/pull/4779) already addresses it.

The upstream issue remains open with no comments at the final check. [NVIDIA contribution rules](https://github.com/NVIDIA/TensorRT/blob/c93b7d4893184af4882f9f1862e13a5c64b8677d/CONTRIBUTING.md) require engineer approval of the issue before code review and contributor DCO sign-off for a submitted patch. The [prepared issue note](nvidia-polygraphy-4607-issue-comment.md) asks whether this narrow approach is acceptable. No issue comment, pull request, legal sign-off, or claimed NVIDIA endorsement has been made.

## Wording suitable for a future evidence page

“Independently reproduced an incorrect branch-freezing case in NVIDIA's open-source Polygraphy reducer and prepared a tested guard against it. Eight regression cases failed on the pinned original source; all 16 focused CPU tests passed with the proposed patch. Upstream review pending submission.”

Update that final status only when a real upstream event occurs.
