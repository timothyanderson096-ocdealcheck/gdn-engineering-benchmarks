# Copyright (c) ONNX Project Contributors
# SPDX-License-Identifier: Apache-2.0
from __future__ import annotations

import numpy as np
import pytest
from numpy.testing import assert_array_equal
from onnx import TensorProto
from onnx.helper import make_graph, make_model_gen_version, make_node, make_opsetid, make_tensor_value_info
from onnx.reference import ReferenceEvaluator


class TestConvFloat16:
    @pytest.mark.parametrize("rank", [1, 2, 3])
    @pytest.mark.parametrize("batch", [1, 2])
    @pytest.mark.parametrize("group", [1, 2])
    @pytest.mark.parametrize("outputs_per_group", [1, 2])
    def test_conv_float16_bias_cancels_large_accumulation(
        self, rank, batch, group, outputs_per_group
    ):
        spatial = (1,) * rank
        output_channels = group * outputs_per_group
        x = np.full((batch, 2 * group, *spatial), 100, dtype=np.float16)
        w = np.full((output_channels, 2, *spatial), 400, dtype=np.float16)
        bias = np.full(output_channels, -30000, dtype=np.float16)
        output_shape = (batch, output_channels, *spatial)
        graph = make_graph(
            [make_node("Conv", ["X", "W", "B"], ["Y"], group=group)],
            "float16_conv_bias",
            [
                make_tensor_value_info("X", TensorProto.FLOAT16, x.shape),
                make_tensor_value_info("W", TensorProto.FLOAT16, w.shape),
                make_tensor_value_info("B", TensorProto.FLOAT16, bias.shape),
            ],
            [make_tensor_value_info("Y", TensorProto.FLOAT16, output_shape)],
        )
        model = make_model_gen_version(graph, opset_imports=[make_opsetid("", 22)])
        actual = ReferenceEvaluator(model, optimized=False).run(
            None, {"X": x, "W": w, "B": bias}
        )[0]
        # 100 * 400 + 100 * 400 - 30000 is finite after rounding to float16.
        expected = np.full(output_shape, 50000, dtype=np.float16)
        assert actual.dtype == np.float16
        assert_array_equal(actual, expected)

