#
# SPDX-FileCopyrightText: Copyright (c) 2026 OC Labs
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
"""CPU regressions for unsafe branch freezing in debug reduce (GH-4607)."""

import json
import shutil
import subprocess
import sys
from textwrap import dedent

import numpy as np
import onnx
from onnx import TensorProto, helper
import onnxruntime as ort
import pytest
from polygraphy.json import save_json


DIAGNOSTIC = "Cannot freeze branches with multiple input iterations"


def make_session(path):
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    return ort.InferenceSession(str(path), options, providers=["CPUExecutionProvider"])


def prepare_case(folder, count, branch=True, generator=False):
    def value(name):
        return helper.make_tensor_value_info(name, TensorProto.FLOAT, [1])

    nodes = [helper.make_node("Identity", ["x"], ["a"], name="left")]
    intermediates = ["a"]
    if branch:
        nodes.extend([
            helper.make_node("Identity", ["x"], ["b"], name="right"),
            helper.make_node("Identity", ["a"], ["c"], name="left_tail"),
            helper.make_node("Add", ["c", "b"], ["y"], name="sum"),
        ])
        intermediates.extend(["b", "c"])
    else:
        nodes.append(helper.make_node("Identity", ["a"], ["y"], name="tail"))
    model = helper.make_model(
        helper.make_graph(nodes, "multi_input", [value("x")], [value("y")],
                          value_info=[value(name) for name in intermediates]),
        opset_imports=[helper.make_opsetid("", 18)], ir_version=10,
    )
    onnx.checker.check_model(model)
    onnx.save(model, folder / "model.onnx")
    model.graph.output.extend(value(name) for name in intermediates)
    onnx.save(model, folder / "all_outputs.onnx")
    runtime = make_session(folder / "all_outputs.onnx")
    names = [output.name for output in runtime.get_outputs()]
    references = []
    for number in range(1, count + 1):
        x = np.asarray([number], dtype=np.float32)
        reference = {"x": x.tolist()}
        reference.update({name: array.tolist() for name, array in zip(names, runtime.run(None, {"x": x}))})
        assert reference["y"] == [float(number * (2 if branch else 1))]
        references.append(reference)
    (folder / "references.json").write_text(json.dumps(references))
    save_json([{"x": np.asarray(item["x"], dtype=np.float32)} for item in references], str(folder / "inputs.json"))

    # All candidate inputs use the correct per-sample layerwise values, independently
    # computed above. A checker infrastructure error is distinct from a mismatch.
    (folder / "check.py").write_text(dedent("""
        import json
        import sys
        import numpy as np
        import onnxruntime as ort
        try:
            options = ort.SessionOptions()
            options.intra_op_num_threads = 1
            options.inter_op_num_threads = 1
            runtime = ort.InferenceSession(sys.argv[1], options, providers=["CPUExecutionProvider"])
            with open("references.json") as stream:
                references = json.load(stream)
            success = True
            for reference in references:
                feed = {item.name: np.asarray(reference[item.name], dtype=np.float32) for item in runtime.get_inputs()}
                outputs = runtime.run(None, feed)
                success = success and all(np.array_equal(value, reference[info.name]) for info, value in zip(runtime.get_outputs(), outputs))
        except Exception as error:
            print("CHECKER_INFRASTRUCTURE_ERROR:", error)
            sys.exit(2)
        sys.exit(0 if success else 1)
    """))
    if generator:
        (folder / "loader.py").write_text(dedent(f"""
            import numpy as np
            def samples():
                for number in range(1, {count + 1}):
                    with open("yields.txt", "a") as stream:
                        stream.write(str(number) + "\\n")
                    yield {{"x": np.asarray([number], dtype=np.float32)}}
            source = samples()
            def load_data():
                with open("factory_calls.txt", "a") as stream:
                    stream.write("call\\n")
                return source
        """))
    return references


def reduce_model(folder, mode, force=False, generator=False, no_reduce_inputs=False):
    executable = shutil.which("polygraphy")
    assert executable is not None
    command = [executable, "debug", "reduce", "model.onnx", "--mode", mode,
               "--output", "reduced.onnx", "--show-output", "--fail-code", "1"]
    command += ["--data-loader-script", "loader.py"] if generator else ["--load-inputs", "inputs.json"]
    command += ["--no-reduce-inputs" if no_reduce_inputs else "--no-reduce-outputs"]
    if force:
        command.append("--force-fallback-shape-inference")
    command += ["--check", sys.executable, "check.py", "polygraphy_debug.onnx"]
    result = subprocess.run(command, cwd=folder, text=True, capture_output=True, timeout=120)
    output = result.stdout + result.stderr
    (folder / "reduce.log").write_text(output)
    assert "CHECKER_INFRASTRUCTURE_ERROR" not in output, output
    return result.returncode, output


def assert_outputs_preserved(folder, references):
    reduced = folder / "reduced.onnx"
    onnx.checker.check_model(onnx.load(reduced))
    runtime = make_session(reduced)
    for reference in references:
        feed = {item.name: np.asarray(reference[item.name], dtype=np.float32) for item in runtime.get_inputs()}
        for info, actual in zip(runtime.get_outputs(), runtime.run(None, feed)):
            np.testing.assert_array_equal(actual, reference[info.name])


@pytest.mark.parametrize("mode", ["linear", "bisect"])
@pytest.mark.parametrize("force", [False, True])
@pytest.mark.parametrize("generator", [False, True])
def test_reject_multiple_inputs_when_freezing_branch(tmp_path, mode, force, generator):
    prepare_case(tmp_path, 2, generator=generator)
    code, output = reduce_model(tmp_path, mode, force=force, generator=generator)
    assert code != 0, output
    assert DIAGNOSTIC in output, output
    assert "--no-reduce-inputs" in output, output
    assert not (tmp_path / "reduced.onnx").exists()
    if generator:
        assert (tmp_path / "factory_calls.txt").read_text().splitlines() == ["call"]
        assert (tmp_path / "yields.txt").read_text().splitlines() == ["1", "2"]


@pytest.mark.parametrize("mode", ["linear", "bisect"])
@pytest.mark.parametrize("force", [False, True])
def test_single_input_generator_preserved(tmp_path, mode, force):
    references = prepare_case(tmp_path, 1, generator=True)
    code, output = reduce_model(tmp_path, mode, force=force, generator=True)
    assert code == 0, output
    assert DIAGNOSTIC not in output
    assert (tmp_path / "factory_calls.txt").read_text().splitlines() == ["call"]
    assert (tmp_path / "yields.txt").read_text().splitlines() == ["1"]
    assert_outputs_preserved(tmp_path, references)


@pytest.mark.parametrize("mode", ["linear", "bisect"])
def test_multiple_inputs_without_input_reduction(tmp_path, mode):
    references = prepare_case(tmp_path, 2)
    code, output = reduce_model(tmp_path, mode, no_reduce_inputs=True)
    assert code == 0, output
    assert DIAGNOSTIC not in output
    assert_outputs_preserved(tmp_path, references)


@pytest.mark.parametrize("mode", ["linear", "bisect"])
def test_multiple_inputs_without_branch_freezing(tmp_path, mode):
    references = prepare_case(tmp_path, 2, branch=False)
    code, output = reduce_model(tmp_path, mode)
    assert code == 0, output
    assert DIAGNOSTIC not in output
    assert_outputs_preserved(tmp_path, references)
