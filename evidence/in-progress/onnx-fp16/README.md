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

Local helper checks reproduced the regression in 30 cases. The proposed helper
passed those 30 cases and a separate 144-case numerical matrix. Actual evaluator
and repository gates remain pending until the linked GitHub Actions job succeeds.

The workflow runs two bounded standard Ubuntu jobs without secrets:

1. ONNX 1.22.0: baseline, inspected Conv, and patched Conv through the real plain
   ReferenceEvaluator, plus numerical and non-float16 compatibility checks.
2. A build of the pinned current ONNX source: all 24 new regression cases must
   fail with the expected infinity result before the implementation patch and
   pass afterward; then the reference-evaluator test file and scoped lintrunner
   checks run.

A passing run does not establish a pass of the entire upstream cross-platform
CI matrix or ONNX Runtime execution providers. No upstream issue or PR has been
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
