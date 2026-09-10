# ONNX float16 Conv verification — work in progress

Spotted Ridge Engineering / OC Labs is independently investigating a numerical
regression in the ONNX reference Conv implementation. This is public open-source
verification work, not client work or an endorsement by Microsoft or ONNX.

## Reproducer and proposed correction

Two float16 channel products of 100 × 400 sum to 80,000. Adding a bias of −30,000
should produce 50,000 (49,984 after float16 rounding). The inspected vectorized
reference implementation overflows to infinity before adding the bias. The
proposed patch keeps float16 accumulation in float32 through bias addition and
then restores the output dtype. Other dtypes keep the original dispatch.

- Starting investigation: https://github.com/microsoft/onnxscript/issues/3003
- Existing upstream vectorization: https://github.com/onnx/onnx/pull/8366
- Exact source under test: `27d7d6890cb8bfa7ed5cda2f2656f82b6af0736a`
- Released comparison: ONNX 1.22.0

The original vectorization and its performance improvement belong to the
upstream contributors. This packet concerns the separate float16 regression.

## Verification boundaries

Verified on 10 September 2026:

- Released ONNX 1.22.0 baseline: 24 targeted evaluator cases passed.
- Inspected Conv in that runtime: 24 expected overflow failures.
- Patched Conv in that runtime: 24 targeted cases passed, plus 16 checks of
  non-float16 compatibility, 30 helper regressions and 144 numerical cases.
- Build of pinned current ONNX source: 24 expected baseline failures followed
  by 24 patched passes. The reference-evaluator file passed 480 tests, with
  8 skipped and zero failures or errors.

The source run's overall result was red because Ruff requested line wrapping
of one return statement. The reviewed branch applies that formatting change.
A separate lint job verifies identical Python syntax trees against the exact
file hashes tested above, then reruns ONNX's required changed-file lintrunner.
It does not repeat or claim a new native build for a formatting-only change.

Source/runtime test receipt:
https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/34435471817

Expanded saved reports and lint diagnostic:
https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/34436126781

Check the reviewed branch's **ONNX reviewed patch lint** run for the final lint
result. The previous red run remains part of the evidence history.

The workflow runs two bounded standard Ubuntu jobs without secrets:

1. ONNX 1.22.0: baseline, inspected Conv, and patched Conv through the real plain
   ReferenceEvaluator, plus numerical and non-float16 compatibility checks.
2. A build of the pinned current ONNX source: all 24 new regression cases must
   fail with the expected infinity result before the implementation patch and
   pass afterward; then the reference-evaluator test file and scoped lintrunner
   checks run.

A passing lint result does not establish a pass of the entire upstream cross-platform
CI matrix, the entire Python suite or ONNX Runtime execution providers. No upstream issue or PR has been
submitted as part of this packet. Workflow logs and JUnit records are the source
of truth; pending or failed runs must not be described as successful validation.

This isolated branch is preparation for a reviewable contribution. Existing
benchmark headlines and the live Spotted Ridge website are not updated here.

## Files and licensing

`onnx-fp16-conv-bias.patch` is the proposed upstream change, including the 24
parameterized tests. `cloud_validate.py` manages current-source verification;
`run_checks.py` manages the separate released-runtime comparison.

ONNX source snapshots retain their copyright headers. Their Apache-2.0 license
and notice are included in `LICENSE-ONNX` and `NOTICE-ONNX`. Local modifications
are marked. The independent verification scripts are also provided under
Apache-2.0, using the included license text.
