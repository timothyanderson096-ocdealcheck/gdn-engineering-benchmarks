"""Independent helper-level ONNX Conv verification; requires only NumPy.

Upstream files are unmodified snapshots. AST extraction loads their top-level
functions, without installing ONNX or pretending to exercise its graph runtime.
"""

import ast
import hashlib
import itertools
import json
import os
import platform
import statistics
import time

import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))


def load_helper(filename):
    with open(os.path.join(ROOT, filename), encoding="utf-8") as stream:
        source = stream.read()
    parsed = ast.parse(source, filename=filename)
    functions = [node for node in parsed.body if isinstance(node, ast.FunctionDef)]
    module = ast.Module(body=functions, type_ignores=[])
    namespace = {"np": np}
    exec(compile(module, filename, "exec"), namespace)
    return namespace["_conv_implementation"], hashlib.sha256(source.encode()).hexdigest()


def oracle(x, w, bias, auto_pad, dilations, group, kernel_shape, pads, strides):
    """Direct N-D cross-correlation with float64 accumulation, no im2col."""
    rank = x.ndim - 2
    kernels = w.shape[2:] if kernel_shape is None else kernel_shape
    dilations = [1] * rank if dilations is None else dilations
    strides = [1] * rank if strides is None else strides
    pads = [0] * (2 * rank) if pads is None else list(pads)
    if auto_pad == "VALID":
        pads = [0] * (2 * rank)
    elif auto_pad in ("SAME_UPPER", "SAME_LOWER"):
        heads, tails = [], []
        for size, kernel, stride, dilation in zip(x.shape[2:], kernels, strides, dilations):
            out_size = (size + stride - 1) // stride
            required = max(0, (out_size - 1) * stride + (kernel - 1) * dilation + 1 - size)
            head = (required + int(auto_pad == "SAME_LOWER")) // 2
            heads.append(head)
            tails.append(required - head)
        pads = heads + tails
    output_shape = tuple(
        (x.shape[i + 2] + pads[i] + pads[i + rank] - (kernels[i] - 1) * dilations[i] - 1)
        // strides[i] + 1
        for i in range(rank)
    )
    out = np.zeros((x.shape[0], w.shape[0], *output_shape), dtype=np.float64)
    channels_per_group = x.shape[1] // group
    outputs_per_group = w.shape[0] // group
    for batch, channel in itertools.product(range(x.shape[0]), range(w.shape[0])):
        channel_start = (channel // outputs_per_group) * channels_per_group
        for location in np.ndindex(output_shape):
            value = 0.0 if bias is None else float(bias[channel])
            for inner_channel in range(channels_per_group):
                for kernel_location in np.ndindex(tuple(kernels)):
                    source_location = tuple(
                        location[i] * strides[i] - pads[i] + kernel_location[i] * dilations[i]
                        for i in range(rank)
                    )
                    if all(0 <= source_location[i] < x.shape[i + 2] for i in range(rank)):
                        value += float(x[(batch, channel_start + inner_channel, *source_location)]) * float(
                            w[(channel, inner_channel, *kernel_location)]
                        )
            out[(batch, channel, *location)] = value
    return out.astype(x.dtype)


def run():
    current, current_hash = load_helper("upstream_conv.py")
    baseline, baseline_hash = load_helper("baseline_conv.py")
    rng = np.random.default_rng(20260910)
    rows = []
    # Orthogonal combinations exercise rank, dtype, batch/group layout and padding.
    for rank, dtype, mode, group, batch in itertools.product(
        (1, 2, 3), (np.float16, np.float32, np.float64),
        ("NOTSET", "SAME_UPPER", "SAME_LOWER", "VALID"), (1, 2), (1, 2)
    ):
        shape = (5,) * rank
        kernel = (2,) * rank
        x = rng.normal(0, 0.5, (batch, 4, *shape)).astype(dtype)
        w = rng.normal(0, 0.5, (6, 4 // group, *kernel)).astype(dtype)
        bias = rng.normal(0, 0.2, 6).astype(dtype) if batch == 2 else None
        dilation = [2 if i % 2 == 0 else 1 for i in range(rank)]
        stride = [2 if i % 2 == 0 else 1 for i in range(rank)]
        pads = [1] * rank + [0] * rank
        args = (x, w, bias, mode, dilation, group, None, pads, stride)
        expected = oracle(*args)
        actual = current(*args).astype(dtype)
        tolerance = {np.float16: (0.01, 0.003), np.float32: (1e-5, 1e-6), np.float64: (1e-12, 1e-12)}[dtype]
        passed = actual.shape == expected.shape and np.allclose(actual, expected, rtol=tolerance[0], atol=tolerance[1])
        rows.append({"rank": rank, "dtype": np.dtype(dtype).name, "auto_pad": mode,
                     "group": group, "batch": batch, "bias": bias is not None,
                     "passed": bool(passed), "max_absolute_error": float(np.max(np.abs(actual.astype(np.float64) - expected))),
                     "rtol": tolerance[0], "atol": tolerance[1]})
    # Exact reporter workload, same inputs for old and new source helpers.
    x = np.ones((1, 2, 192, 192), dtype=np.float32)
    w = np.ones((32, 2, 1, 1), dtype=np.float32)
    args = (x, w, None, "NOTSET", [1, 1], 1, [1, 1], [0, 0, 0, 0], [1, 1])
    times = {}
    outputs = {}
    for name, function in (("baseline", baseline), ("current", current)):
        samples = []
        for _ in range(3):
            start = time.perf_counter()
            result = function(*args)
            samples.append(time.perf_counter() - start)
        times[name] = samples
        outputs[name] = result
    benchmark = {"seconds": times,
                 "median_speedup": statistics.median(times["baseline"]) / statistics.median(times["current"]),
                 "exact_values_equal_after_public_dtype_cast": bool(np.array_equal(outputs["baseline"].astype(x.dtype), outputs["current"].astype(x.dtype))),
                 "helper_dtypes": {name: str(output.dtype) for name, output in outputs.items()},
                 "note": "Helper-only timings, three measured runs each; not end-to-end ONNX Script or inference."}
    report = {"python": platform.python_version(), "platform": platform.platform(), "numpy": np.__version__,
              "source_sha256": {"upstream_conv.py": current_hash, "baseline_conv.py": baseline_hash},
              "cases": rows, "passed": sum(row["passed"] for row in rows), "total": len(rows), "benchmark": benchmark}
    with open(os.path.join(ROOT, "results.json"), "w", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
    print(json.dumps({"passed": report["passed"], "total": report["total"], "benchmark": benchmark}, indent=2))
    if report["passed"] != report["total"] or not benchmark["exact_values_equal_after_public_dtype_cast"]:
        raise SystemExit(1)


if __name__ == "__main__":
    run()
