"""Prove the formatted Conv patch has the exact ASTs tested in the prior run."""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
from pathlib import Path
import subprocess
import sys


SOURCE_COMMIT = "27d7d6890cb8bfa7ed5cda2f2656f82b6af0736a"
PREVIOUS_RUN = 34435471817
EXPECTED_PREVIOUS = {
    "onnx/reference/ops/op_conv.py": "e74bcba53d3c74884a0fdcc4890ef28c60cb2d5ccc6d2ed1725a51214f64f866",
    "tests/python/reference_evaluator_test.py": "083f12766d5bbae2138ce7adc21b25de5803eb910f027da5712b2b1514c682ef",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upstream", required=True, type=Path)
    parser.add_argument("--previous-patch", required=True, type=Path)
    args = parser.parse_args()
    upstream = args.upstream.resolve()
    previous_patch = args.previous_patch.resolve()
    current_patch = Path(__file__).resolve().parent / "onnx-fp16-conv-bias.patch"
    paths = list(EXPECTED_PREVIOUS)
    report = {
        "prior_validation_run": PREVIOUS_RUN,
        "required_source_commit": SOURCE_COMMIT,
        "ast_comparison": "ast.dump(ast.parse(source), include_attributes=False)",
        "ast_equivalent": False,
        "result": "FAILED",
        "commands": [],
        "files": {},
    }

    def run(*command):
        command = [str(part) for part in command]
        result = subprocess.run(
            command,
            cwd=upstream,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
            check=False,
        )
        report["commands"].append({
            "command": command,
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
        })
        if result.returncode:
            raise RuntimeError("Command failed: " + repr(command))
        return result.stdout

    def snapshot():
        result = {}
        for name in paths:
            raw = (upstream / name).read_bytes()
            tree = ast.parse(raw.decode("utf-8"), filename=name)
            dump = ast.dump(tree, include_attributes=False)
            result[name] = {"sha256": digest(raw), "ast_dump": dump}
        return result

    try:
        if not upstream.is_dir() or not previous_patch.is_file() or not current_patch.is_file():
            raise RuntimeError("Missing checkout or patch file")
        report["previous_patch_sha256"] = digest(previous_patch.read_bytes())
        report["current_patch_sha256"] = digest(current_patch.read_bytes())
        commit = run("git", "rev-parse", "HEAD").strip()
        report["actual_source_commit"] = commit
        if commit != SOURCE_COMMIT:
            raise RuntimeError("Checkout does not match the exact source used by the previous run")
        if run("git", "status", "--porcelain", "--", *paths).strip():
            raise RuntimeError("The target files must be clean in a disposable checkout")
        include_args = ["--include=" + name for name in paths]
        run("git", "apply", "--check", *include_args, previous_patch)
        run("git", "apply", *include_args, previous_patch)
        previous = snapshot()
        for name, expected in EXPECTED_PREVIOUS.items():
            actual = previous[name]["sha256"]
            report["files"][name] = {
                "expected_previously_tested_sha256": expected,
                "previously_patched_sha256": actual,
            }
            if actual != expected:
                raise RuntimeError("Previous patched source does not match verified run: " + name)
        # These are the only paths this script has modified, and cleanliness was
        # checked before applying the patch. Do not reset the whole checkout.
        run("git", "restore", "--source=HEAD", "--worktree", "--", *paths)
        run("git", "apply", "--check", *include_args, current_patch)
        run("git", "apply", *include_args, current_patch)
        current = snapshot()
        for name in paths:
            same = previous[name]["ast_dump"] == current[name]["ast_dump"]
            report["files"][name].update({
                "formatted_sha256": current[name]["sha256"],
                "previous_ast_sha256": digest(previous[name]["ast_dump"].encode("utf-8")),
                "formatted_ast_sha256": digest(current[name]["ast_dump"].encode("utf-8")),
                "ast_equivalent": same,
            })
            if not same:
                raise RuntimeError("AST changed; functional validation must be repeated: " + name)
        run("git", "diff", "--check")
        report["ast_equivalent"] = True
        report["result"] = "PASSED: exact previously tested source hashes and identical formatted ASTs"
    except Exception as error:
        report["error"] = str(error)
    print(json.dumps(report, indent=2))
    return 0 if report["ast_equivalent"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
