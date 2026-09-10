"""Prove the finite-result regression and check the proposed source helper fix."""

import itertools
import json
import os

import numpy as np

from verify_conv import ROOT, load_helper, oracle


def run():
    original, _ = load_helper("upstream_conv.py")
    patched, _ = load_helper("patched_conv.py")
    baseline, _ = load_helper("baseline_conv.py")
    rows = []
    for rank, batch, group, output_channels in itertools.product((1, 2, 3), (1, 2), (1, 2), (1, 2, 4)):
        if output_channels % group:
            continue
        x = np.full((batch, 2 * group, *((1,) * rank)), 100, dtype=np.float16)
        w = np.full((output_channels, 2, *((1,) * rank)), 400, dtype=np.float16)
        bias = np.full(output_channels, -30000, dtype=np.float16)
        args = (x, w, bias, "NOTSET", [1] * rank, group, [1] * rank, [0] * (2 * rank), [1] * rank)
        expected = oracle(*args)
        with np.errstate(over="ignore"):
            bad = original(*args).astype(np.float16)
            old = baseline(*args).astype(np.float16)
        fixed = patched(*args)
        item = {"rank": rank, "batch": batch, "group": group, "output_channels": output_channels,
                "original_nonfinite": bool(np.any(~np.isfinite(bad))),
                "baseline_matches": bool(np.array_equal(old, expected)),
                "patch_matches": bool(np.array_equal(fixed, expected)),
                "dtype_preserved": fixed.dtype == x.dtype, "expected_value": float(expected.flat[0])}
        rows.append(item)
    # Reuse the independent broad matrix against the proposed implementation.
    rng = np.random.default_rng(20260910)
    broad = []
    for rank, dtype, mode, group, batch in itertools.product(
        (1, 2, 3), (np.float16, np.float32, np.float64),
        ("NOTSET", "SAME_UPPER", "SAME_LOWER", "VALID"), (1, 2), (1, 2)
    ):
        x = rng.normal(0, 0.5, (batch, 4, *((5,) * rank))).astype(dtype)
        w = rng.normal(0, 0.5, (6, 4 // group, *((2,) * rank))).astype(dtype)
        bias = rng.normal(0, 0.2, 6).astype(dtype) if batch == 2 else None
        dilation = [2 if i % 2 == 0 else 1 for i in range(rank)]
        stride = [2 if i % 2 == 0 else 1 for i in range(rank)]
        args = (x, w, bias, mode, dilation, group, None, [1] * rank + [0] * rank, stride)
        expected, actual = oracle(*args), patched(*args)
        rtol, atol = {np.float16: (0.01, 0.003), np.float32: (1e-5, 1e-6), np.float64: (1e-12, 1e-12)}[dtype]
        passed = actual.dtype == x.dtype and actual.shape == expected.shape and np.allclose(actual, expected, rtol=rtol, atol=atol)
        broad.append({"rank": rank, "dtype": np.dtype(dtype).name, "mode": mode, "group": group, "batch": batch, "passed": bool(passed)})
    result = {"regressions": rows, "broad_cases": broad,
              "original_failures": sum(x["original_nonfinite"] for x in rows),
              "baseline_passes": sum(x["baseline_matches"] for x in rows),
              "fixed_passes": sum(x["patch_matches"] and x["dtype_preserved"] for x in rows),
              "broad_passes": sum(x["passed"] for x in broad)}
    with open(os.path.join(ROOT, "regression-results.json"), "w", encoding="utf-8") as stream:
        json.dump(result, stream, indent=2)
    print(json.dumps({k: v for k, v in result.items() if not isinstance(v, list)}, indent=2))
    assert result["original_failures"] == result["baseline_passes"] == result["fixed_passes"] == len(rows)
    assert result["broad_passes"] == len(broad)


if __name__ == "__main__":
    run()
