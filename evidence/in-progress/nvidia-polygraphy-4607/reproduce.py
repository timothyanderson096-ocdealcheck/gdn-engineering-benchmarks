"""CPU reproduction of TensorRT #4607's branch-freezing limitation.

No TensorRT/GPU execution, external model, or data-to-input conversion is used.
The checker compares candidates against an independently evaluated correct model.
"""

import argparse
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys

import numpy as np
import onnx
from onnx import TensorProto, helper
import onnxruntime as ort
from polygraphy.json import save_json


def session(path):
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    return ort.InferenceSession(str(path), options, providers=["CPUExecutionProvider"])


def evaluate(path, references):
    runtime = session(path)
    names = [output.name for output in runtime.get_outputs()]
    observed = []
    matches = []
    for reference in references:
        feed = {
            item.name: np.asarray(reference[item.name], dtype=np.float32)
            for item in runtime.get_inputs()
        }
        outputs = dict(zip(names, runtime.run(None, feed)))
        observed.append({name: value.tolist() for name, value in outputs.items()})
        matches.append(all(np.array_equal(value, reference[name]) for name, value in outputs.items()))
    return {"matches": matches, "outputs": observed}


def make_model(path):
    def value(name):
        return helper.make_tensor_value_info(name, TensorProto.FLOAT, [1])

    nodes = [
        helper.make_node("Identity", ["x"], ["a"], name="left"),
        helper.make_node("Identity", ["x"], ["b"], name="right"),
        helper.make_node("Identity", ["a"], ["c"], name="left_tail"),
        helper.make_node("Add", ["c", "b"], ["y"], name="sum"),
    ]
    model = helper.make_model(
        helper.make_graph(nodes, "branch_freezing", [value("x")], [value("y")],
                          value_info=[value(name) for name in ("a", "b", "c")]),
        opset_imports=[helper.make_opsetid("", 18)],
        ir_version=10,
    )
    onnx.checker.check_model(model)
    onnx.save(model, path)
    all_outputs = onnx.ModelProto()
    all_outputs.CopyFrom(model)
    all_outputs.graph.output.extend(value(name) for name in ("a", "b", "c"))
    all_path = path.with_name("all_outputs.onnx")
    onnx.save(all_outputs, all_path)
    runtime = session(all_path)
    names = [output.name for output in runtime.get_outputs()]
    references = []
    for number in (1.0, 2.0):
        x = np.asarray([number], dtype=np.float32)
        reference = {"x": x.tolist()}
        reference.update({name: array.tolist() for name, array in zip(names, runtime.run(None, {"x": x}))})
        references.append(reference)
    assert [reference["y"] for reference in references] == [[2.0], [4.0]]
    return references


def run_case(root, name, count, mode="linear", no_reduce_inputs=False):
    folder = root / name
    folder.mkdir(parents=True, exist_ok=True)
    references = make_model(folder / "original.onnx")[:count]
    (folder / "reference.json").write_text(json.dumps(references, indent=2) + "\n")
    save_json([{ "x": np.asarray(item["x"], dtype=np.float32)} for item in references], folder / "inputs.json")
    original = evaluate(folder / "original.onnx", references)
    assert all(original["matches"])
    executable = shutil.which("polygraphy")
    if executable is None:
        raise RuntimeError("Polygraphy CLI entry point is not installed")
    cmd = [executable, "debug", "reduce", "original.onnx",
           "--mode", mode, "--output", "reduced.onnx", "--load-inputs", "inputs.json",
           "--show-output", "--fail-code", "1",
           "--no-reduce-inputs" if no_reduce_inputs else "--no-reduce-outputs",
           "--check", sys.executable, str(Path(__file__).resolve()), "--check-model",
           "polygraphy_debug.onnx", "--references", "reference.json"]
    result = subprocess.run(cmd, cwd=folder, text=True, capture_output=True, timeout=180)
    (folder / "reduce.log").write_text(result.stdout + result.stderr)
    report = {"case": name, "command": cmd, "exit_code": result.returncode, "original": original}
    reduced = folder / "reduced.onnx"
    if result.returncode == 0 and reduced.exists():
        onnx.checker.check_model(onnx.load(reduced))
        report["reduced"] = evaluate(reduced, references)
        report["nodes"] = [node.name for node in onnx.load(reduced).graph.node]
    else:
        report["log_tail"] = (result.stdout + result.stderr)[-4500:]
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-model")
    parser.add_argument("--references")
    parser.add_argument("--artifacts", default="artifacts")
    args = parser.parse_args()
    if args.check_model:
        try:
            result = evaluate(args.check_model, json.loads(Path(args.references).read_text()))
            print(json.dumps(result))
            return 0 if all(result["matches"]) else 1
        except Exception as error:
            print(f"CHECKER_INFRASTRUCTURE_ERROR: {error}", file=sys.stderr)
            return 2

    root = Path(args.artifacts).resolve()
    root.mkdir(parents=True, exist_ok=True)
    report = {
        "scope": "remaining branch-freezing limitation; to-input aliasing excluded",
        "upstream_sha": os.environ.get("UPSTREAM_SHA"),
        "python": platform.python_version(),
        "packages": {name: importlib.metadata.version(name) for name in
                     ["numpy", "onnx", "onnxruntime", "onnx-graphsurgeon", "polygraphy"]},
        "cases": [],
    }
    for name, count, mode, no_inputs in [
        ("single_input_control", 1, "linear", False),
        ("two_inputs_linear", 2, "linear", False),
        ("two_inputs_bisect", 2, "bisect", False),
        ("two_inputs_no_input_reduction", 2, "linear", True),
    ]:
        report["cases"].append(run_case(root, name, count, mode, no_inputs))
    cases = {case["case"]: case for case in report["cases"]}
    report["reproduced"] = (
        all(case["exit_code"] == 0 and "reduced" in case for case in report["cases"])
        and all(cases["single_input_control"]["reduced"]["matches"])
        and cases["two_inputs_linear"]["reduced"]["matches"] == [True, False]
        and cases["two_inputs_bisect"]["reduced"]["matches"] == [True, False]
        and all(cases["two_inputs_no_input_reduction"]["reduced"]["matches"])
    )
    (root / "result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 0 if report["reproduced"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
