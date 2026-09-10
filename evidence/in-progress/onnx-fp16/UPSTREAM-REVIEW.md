# Proposed upstream contribution: preserve finite float16 Conv results through bias addition

Status: draft for review. No upstream issue or pull request has been submitted.

The reference Conv implementation introduced by ONNX #8366 can overflow its
float16 intermediate matrix multiplication before adding a bias that would
bring the final result back into the representable range.

For example, two input channels containing 100 and two kernel values of 400
produce a sum of 80,000. With a bias of −30,000, the expected float16 output is
49,984. The inspected reference implementation produces infinity.

The proposed change performs float16 accumulation in float32, adds the bias,
and casts the result back to the input dtype. It preserves the existing NumPy
dispatch for other dtypes. The patch adds 24 regression cases covering one,
two and three spatial dimensions, batch sizes one and two, grouped convolution,
and one or two output channels per group.

## Minimal reproducer for the inspected current ONNX source

```python
import numpy as np
from onnx import TensorProto
from onnx.helper import (
    make_graph, make_model_gen_version, make_node, make_opsetid,
    make_tensor_value_info,
)
from onnx.reference import ReferenceEvaluator

x = np.full((1, 2, 1), 100, dtype=np.float16)
w = np.full((1, 2, 1), 400, dtype=np.float16)
b = np.array([-30000], dtype=np.float16)
graph = make_graph(
    [make_node("Conv", ["X", "W", "B"], ["Y"])],
    "float16_bias_cancellation",
    [make_tensor_value_info(name, TensorProto.FLOAT16, value.shape)
     for name, value in [("X", x), ("W", w), ("B", b)]],
    [make_tensor_value_info("Y", TensorProto.FLOAT16, [1, 1, 1])],
)
model = make_model_gen_version(graph, opset_imports=[make_opsetid("", 22)])
actual = ReferenceEvaluator(model).run(None, {"X": x, "W": w, "B": b})[0]
expected = np.full((1, 1, 1), 50000, dtype=np.float16)
print("Actual:", actual, "Expected:", expected)
np.testing.assert_array_equal(actual, expected)
```

Exact inspected ONNX revision: `27d7d6890cb8bfa7ed5cda2f2656f82b6af0736a`.
The older ONNX 1.22.0 comparison uses `optimized=False`; that parameter was
removed in the current implementation.

Verification receipts are in the isolated GitHub Actions run:
https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/34435471817

The released-runtime comparison passed. On the exact source build, all 24 new
regression cases failed as expected before the patch and passed afterward.
The reference-evaluator test file passed 480 cases with 8 skipped. That run's
overall status was red solely because Ruff requested line wrapping. The reviewed
branch corrects the formatting, verifies identical Python syntax trees against
the actually tested file hashes, and runs the scoped lint gate separately.
Check that final lint receipt before submission. No ONNX Runtime execution
provider, GPU, hardware, entire Python suite or full cross-platform CI claim is made.

This is independent Spotted Ridge Engineering / OC Labs open-source work.
The original vectorization belongs to ONNX's upstream contributors.
