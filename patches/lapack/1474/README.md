# LAPACK #1474 — inaccurate eigenvectors from inverse iteration

On both matrices in [Reference-LAPACK/lapack#1474](https://github.com/Reference-LAPACK/lapack/issues/1474), DSTEIN returns success even though the computed vectors fail the equation `TZ = Z diag(W)`. The [source patch](stein-scaled-inverse-iteration.patch) corrects both cases at upstream commit `12612ecb8c4e1efa32c7830d0fc93c638e9e3403`.

| Matrix | Largest absolute equation error, stock → patched | Largest absolute orthogonality error, stock → patched |
| --- | --- | --- |
| 13 × 13 | 0.353548 → 5.55 × 10⁻¹⁷ | 0.272336 → 5.55 × 10⁻¹⁶ |
| 45 × 45 | 0.267261 → 5.55 × 10⁻¹⁷ | 0.285714 → 6.66 × 10⁻¹⁶ |

The existing solve can enlarge a nonzero pivot to avoid overflow, changing the direction of the resulting vector. The patch rescales the working vector during substitution and accounts for that scaling when testing growth. SSTEIN and CSTEIN share a single-precision helper. DSTEIN and ZSTEIN share a double-precision helper. The change preserves the public interfaces and workspace requirements.

## Verification

With GNU Fortran 14.2 and reference BLAS on Linux x86-64, the full suite passed 129/129 CTests under each of the LP64 and suffixed 64-bit integer interfaces. Four new native regression tests failed on stock code in each build. Of 1,138 targeted numerical checks per interface, 263 produced incorrect or nonfinite output with a success status on stock. All 1,138 passed with the patch. These cases deliberately stress difficult matrices. The 48 coarse-tolerance controls were constructed independently because the original 12 control inputs mentioned in the issue were unavailable.

On four ordinary synthetic workloads, isolated DSTEIN took **12.8% to 20.2% more median paired CPU time** using a single pinned CPU, reference BLAS, and 25 paired batches per workload. The timing measures the inverse-iteration step alone. [Numerical results](verification.json) · [Individual timing samples](timing.csv) · [Audit scripts, instructions and raw results](numerical-audit.tar.gz)

## Apply and test

From a clean checkout at the upstream revision above, using a local copy of the patch, run

```sh
git apply --check /path/to/stein-scaled-inverse-iteration.patch
git apply /path/to/stein-scaled-inverse-iteration.patch
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=ON -DBUILD_TESTING=ON -DUSE_OPTIMIZED_BLAS=OFF
cmake --build build --parallel 4
ctest --test-dir build -R stein_cluster --output-on-failure
ctest --test-dir build --output-on-failure
```

For the suffixed 64-bit integer interface, configure a second build with `-DBUILD_DEFAULT_API=OFF -DBUILD_INDEX64_EXT_API=ON`. To repeat the independent checks, extract the audit archive and follow `audit/README.md`.

Patch SHA-256 is `585b80c93a41fb03a27090b217c078e96b2772f3644d1d631402baa6adc974ca`. The audit archive SHA-256 is `2f3fbd5f57c16194338ecfb37022adc0f01f790344d3ad5a197d149184d2026e`.

Submitted by Timothy Anderson, Spotted Ridge Engineering / OC Labs. OpenAI Codex assisted with implementation and verification.
