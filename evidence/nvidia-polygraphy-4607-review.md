> Update, 10 September 2026: a focused guard has now passed validation. See the [tested guard and current status](nvidia-polygraphy-4607-guard-review.md). The reproduction report below is retained as historical evidence.

# NVIDIA Polygraphy #4607: independent CPU reproduction

Verified on 10 September 2026 against NVIDIA/TensorRT commit `c93b7d4893184af4882f9f1862e13a5c64b8677d`.

## Finding

The remaining branch-freezing behavior reported in [issue #4607](https://github.com/NVIDIA/TensorRT/issues/4607) is reproducible on CPU. In both linear and bisect reduction, a passing four-node model becomes a smaller model whose second output is incorrect.

The original issue predates this investigation. This packet contributes an independent minimal reproduction and measured controls. The input-conversion aliasing fix already proposed in [PR #4779](https://github.com/NVIDIA/TensorRT/pull/4779) is excluded; this reproduction never invokes `data to-input`.

## Measured results

| Case | Original outputs | Reduced outputs | Result |
|---|---|---|---|
| One input, linear | 2 | 2 | Control passes |
| Two inputs, linear | 2, 4 | 2, 3 | Mismatch reproduced |
| Two inputs, bisect | 2, 4 | 2, 3 | Mismatch reproduced |
| Two inputs, input reduction disabled | 2, 4 | 2, 4 | Control passes |

Every original and reduced model passed ONNX structural validation. All reducer commands exited successfully. The harness passed because it verified the expected defect and the controls, not because the defect was fixed.

## Minimal model

Four named nodes, float32 tensors of shape [1], ONNX opset 18 and IR 10:

1. `left: Identity(x) -> a`
2. `right: Identity(x) -> b`
3. `left_tail: Identity(a) -> c`
4. `sum: Add(c, b) -> y`

Use x=1 and x=2. The correct model computes y=2*x. Original outputs and intermediate reference values are evaluated using ONNX Runtime's CPUExecutionProvider. The checker supplies correct per-sample layerwise values to candidate graph inputs.

At the `left_tail` cut, the surviving right branch still needs x. The reducer freezes it to the first sample's x=1. The two-node result computes y=a+1, producing 2 and 3. Logs explicitly record freezing tensor x.

The supplied model is a passing control. This demonstrates a reduction-induced numerical mismatch; it does not claim a TensorRT GPU backend fault. Upstream's existing `test_reduce_custom_data_multibranch_input` likewise uses passing-model controls.

## Reproduction and receipt

- [Successful workflow](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/34437648737)
- Tested packet commit: `26339c1eeb291e73009ee4d774dc9bbb78923e88`
- [Runner](in-progress/nvidia-polygraphy-4607/reproduce.py)
- [Machine-readable result](nvidia-polygraphy-4607-result-20260910.json)
- Python 3.12.14; NumPy 2.3.5; ONNX 1.22.0; ONNX Runtime 1.23.2; GraphSurgeon 0.6.2; Polygraphy 0.49.27.
- Polygraphy and GraphSurgeon loaded from the pinned NVIDIA source checkout.
- No GPU, external model, paid API, or NVIDIA account needed.

The first two runs failed in environment setup / the harness launcher. They did not reproduce the NVIDIA defect. Both causes were corrected before the successful run; the result JSON preserves those run IDs.

## Bounded fix proposal

When branch freezing would use a single sample's values with a multi-iteration data loader, reject that unsafe reduction with a clear diagnostic. Preserve working single-input cases and output-only reduction. A guard should check actual loader iterations without silently consuming a generator or skipping validation when fallback tensors are cached.

Using `--no-reduce-inputs` is the workaround verified by this packet. Full multi-sample support would require a broader design that preserves varying branch values.

No production patch is included yet. The next implementation should add the guard, a regression derived from this model, and user guidance; then rerun the two defect cases and controls.

## Contribution status

No NVIDIA issue comment or pull request has been submitted, and no maintainer acceptance is claimed. TensorRT's CONTRIBUTING.md requires issue review/approval before code review and DCO signoff for submitted commits. No legal signoff was made in this work.

This is independent open-source verification by Spotted Ridge Engineering / OC Labs, not commissioned NVIDIA work or an endorsement.
