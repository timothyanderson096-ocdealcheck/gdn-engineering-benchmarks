"""Compare unchanged numerical types against the inspected upstream helper."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import ml_dtypes
import numpy as np

from verify_conv import load_helper

old, _ = load_helper("upstream_conv.py")
new, _ = load_helper("patched_conv.py")
rows = []
for dtype in (np.float32, np.float64, np.int32, ml_dtypes.bfloat16):
    for group in (1, 2):
        for bias in (False, True):
            x = np.arange(2 * 4 * 3 * 3).reshape(2, 4, 3, 3).astype(dtype)
            w = (np.arange(4 * (4 // group)).reshape(4, 4 // group, 1, 1) % 3 - 1).astype(dtype)
            b = np.arange(4).astype(dtype) if bias else None
            args = (x, w, b, "NOTSET", [1, 1], group, [1, 1], [0, 0, 0, 0], [1, 1])
            before, after = old(*args), new(*args)
            same = before.dtype == after.dtype and np.array_equal(before, after)
            rows.append({"dtype": np.dtype(dtype).name, "group": group, "bias": bias, "matches_upstream": bool(same)})
            if not same:
                raise AssertionError(str(rows[-1]))
Path(sys.argv[1]).write_text(json.dumps(rows, indent=2), encoding="utf-8")
print("Non-float16 compatibility:", len(rows), "cases passed")
