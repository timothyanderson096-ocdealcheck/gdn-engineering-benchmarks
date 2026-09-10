"""Validate the Conv patch in an already-built, disposable ONNX checkout.

The caller installs ONNX editably and its release-test dependencies first.
This driver modifies only the two paths in the supplied patch. It does not
commit, publish, send messages, or change the checkout's branch references.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import traceback
import xml.etree.ElementTree as ET


PACKET = Path(__file__).resolve().parent
TEST_PATH = "tests/python/reference_evaluator_test.py"
OP_PATH = "onnx/reference/ops/op_conv.py"
TEST_NAME = "test_conv_float16_bias_cancels_large_accumulation"
INF_PATTERN = re.compile(r"(?<![A-Za-z0-9_])[+-]?inf(?![A-Za-z0-9_])", re.I)


def now():
    return datetime.now(timezone.utc).isoformat()


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def junit_counts(path):
    """Count individual cases rather than summing nested suite aggregates."""
    root = ET.parse(path).getroot()
    cases = list(root.iter("testcase"))
    failures = [failure for case in cases for failure in case.findall("failure")]
    errors = [error for case in cases for error in case.findall("error")]
    skipped = [skip for case in cases for skip in case.findall("skipped")]
    return {
        "tests": len(cases),
        "failures": len(failures),
        "errors": len(errors),
        "skipped": len(skipped),
        "passed": sum(
            not any(case.findall(tag) for tag in ("failure", "error", "skipped"))
            for case in cases
        ),
        "failure_messages_containing_inf": sum(
            bool(INF_PATTERN.search(" ".join(f.itertext()) + " " + f.get("message", "")))
            for f in failures
        ),
        "all_cases_match_regression_name": bool(cases)
        and all(TEST_NAME in case.get("name", "") for case in cases),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upstream", type=Path, default=PACKET.parent / "upstream")
    parser.add_argument("--artifacts", type=Path, default=PACKET / "artifacts")
    args = parser.parse_args()
    upstream = args.upstream.resolve()
    artifacts = args.artifacts.resolve()
    artifacts.mkdir(parents=True, exist_ok=True)
    report_path = artifacts / "report.json"
    log_path = artifacts / "combined.log"
    patch = PACKET / "onnx-fp16-conv-bias.patch"
    report = {
        "scope": "Exact ONNX source checkout: baseline regression, proposed fix, full reference evaluator test file, and changed-file lintrunner",
        "started_at": now(),
        "result": "RUNNING",
        "python": sys.version,
        "python_executable": sys.executable,
        "upstream_directory": str(upstream),
        "commands": [],
        "stages": {},
        "entire_python_suite": "NOT RUN",
        "cross_platform_upstream_ci": "NOT RUN",
        "packages": {},
    }

    def save():
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    save()
    with log_path.open("w", encoding="utf-8") as log:
        def run(stage, command, *, timeout=720, require_success=True, capture=False):
            command = [str(part) for part in command]
            record = {
                "stage": stage,
                "command": command,
                "cwd": str(upstream),
                "started_at": now(),
                "timeout_seconds": timeout,
                "returncode": None,
            }
            report["commands"].append(record)
            save()
            print("Running: " + stage, flush=True)
            log.write("\nSTAGE: " + stage + "\nCOMMAND: " + json.dumps(command) + "\n")
            log.flush()
            started = time.monotonic()
            output = ""
            try:
                result = subprocess.run(
                    command,
                    cwd=upstream,
                    stdout=subprocess.PIPE if capture else log,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=timeout,
                    check=False,
                )
                record["returncode"] = result.returncode
                if capture:
                    output = result.stdout
                    log.write(output)
            except subprocess.TimeoutExpired as error:
                record["timed_out"] = True
                if capture and error.output:
                    output = error.output
                    if isinstance(output, bytes):
                        output = output.decode("utf-8", errors="replace")
                    log.write(output)
                raise RuntimeError("Timed out during " + stage) from error
            except OSError as error:
                record["launch_error"] = str(error)
                raise
            finally:
                record["finished_at"] = now()
                record["elapsed_seconds"] = round(time.monotonic() - started, 3)
                log.write("\nRETURN CODE: " + str(record["returncode"]) + "\n")
                log.flush()
                save()
            if require_success and record["returncode"] != 0:
                raise RuntimeError(stage + " failed; inspect combined.log")
            return record["returncode"], output

        def pytest_stage(stage, *, regression_only, expected_failure=False):
            xml = artifacts / (stage + ".xml")
            if xml.exists():
                raise RuntimeError("Refusing to reuse existing test output: " + str(xml))
            command = [sys.executable, "-B", "-m", "pytest", TEST_PATH, "-q", "--junitxml=" + str(xml)]
            if regression_only:
                command.extend(["-k", TEST_NAME])
            code, _ = run(stage, command, timeout=720, require_success=False)
            counts = junit_counts(xml)
            counts["returncode"] = code
            report["stages"][stage] = counts
            if regression_only:
                correct = (
                    counts["tests"] == 24
                    and counts["errors"] == 0
                    and counts["skipped"] == 0
                    and counts["all_cases_match_regression_name"]
                )
                if expected_failure:
                    correct = correct and code == 1 and counts["failures"] == 24 and counts["failure_messages_containing_inf"] == 24
                else:
                    correct = correct and code == 0 and counts["passed"] == 24 and counts["failures"] == 0
            else:
                correct = code == 0 and counts["tests"] > 24 and counts["failures"] == 0 and counts["errors"] == 0
            counts["expected_outcome_confirmed"] = bool(correct)
            save()
            if not correct:
                raise RuntimeError("Unexpected test outcome during " + stage)

        try:
            if not upstream.is_dir() or not patch.is_file():
                raise RuntimeError("Missing upstream checkout or supplied patch")
            if artifacts.is_relative_to(upstream):
                raise RuntimeError("Artifacts must be outside the upstream checkout")
            report["patch_sha256"] = sha256(patch)
            report["driver_sha256"] = sha256(Path(__file__).resolve())
            for package in ("onnx", "numpy", "protobuf", "ml_dtypes", "pytest", "Pillow", "lintrunner", "lintrunner-adapters", "ruff", "mypy", "editorconfig-checker"):
                try:
                    report["packages"][package] = importlib.metadata.version(package)
                except importlib.metadata.PackageNotFoundError:
                    report["packages"][package] = None
            _, source_sha = run("record_source_commit", ["git", "rev-parse", "HEAD"], capture=True)
            report["upstream_commit"] = source_sha.strip()
            _, status = run("check_clean_target_files", ["git", "status", "--porcelain", "--", TEST_PATH, OP_PATH], capture=True)
            if status.strip():
                raise RuntimeError("Target files are already modified; use a fresh disposable checkout")
            run("check_main_reference", ["git", "rev-parse", "--verify", "refs/heads/main"], capture=True)
            _, imported_op = run(
                "verify_editable_source",
                [sys.executable, "-c", "import onnx.reference.ops.op_conv as op; print(op.__file__)"],
                capture=True,
            )
            report["imported_op_path"] = imported_op.strip()
            if Path(imported_op.strip()).resolve() != (upstream / OP_PATH).resolve():
                raise RuntimeError("Python is not importing Conv from the requested source checkout")
            report["unpatched_op_sha256"] = sha256(upstream / OP_PATH)
            run("check_test_patch", ["git", "apply", "--check", "--include=" + TEST_PATH, patch])
            run("apply_test_patch", ["git", "apply", "--include=" + TEST_PATH, patch])
            pytest_stage("unpatched_regression", regression_only=True, expected_failure=True)
            run("check_operator_patch", ["git", "apply", "--check", "--include=" + OP_PATH, patch])
            run("apply_operator_patch", ["git", "apply", "--include=" + OP_PATH, patch])
            report["patched_op_sha256"] = sha256(upstream / OP_PATH)
            report["patched_test_sha256"] = sha256(upstream / TEST_PATH)
            pytest_stage("patched_regression", regression_only=True)
            pytest_stage("reference_evaluator_file", regression_only=False)
            run("lintrunner_init", ["lintrunner", "init"], timeout=720)
            report["lint_packages_after_init"] = {
                package: importlib.metadata.version(package)
                for package in ("lintrunner", "lintrunner-adapters", "ruff")
            }
            run("lintrunner_changed_files", ["lintrunner"], timeout=720)
            report["stages"]["lintrunner"] = {"result": "PASSED", "scope": "Changed files, no automatic fixes"}
            run("whitespace_check", ["git", "diff", "--check"])
            report["result"] = "PASSED: expected baseline failures, repaired regression, full reference evaluator file, and changed-file lintrunner"
        except Exception as error:
            report["result"] = "FAILED"
            report["error"] = str(error)
            traceback.print_exc(file=log)
        finally:
            report["finished_at"] = now()
            save()
            print(report["result"], flush=True)
            if "error" in report:
                print(report["error"], flush=True)
            print("Report: " + str(report_path), flush=True)
            print("Log: " + str(log_path), flush=True)
    return 0 if report["result"].startswith("PASSED:") else 1


if __name__ == "__main__":
    raise SystemExit(main())
