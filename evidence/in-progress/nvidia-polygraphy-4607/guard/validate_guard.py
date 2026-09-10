"""Apply the candidate, verify before/after regressions, and emit exact evidence."""

import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET


def run(command, cwd, log):
    result = subprocess.run(command, cwd=cwd, text=True, capture_output=True, timeout=300)
    log.write_text(result.stdout + result.stderr)
    return result


def junit(path):
    root = ET.parse(path).getroot()
    cases = root.findall(".//testcase")
    failures = [case for case in cases if case.find("failure") is not None]
    errors = root.findall(".//error")
    skipped = [case for case in cases if case.find("skipped") is not None]
    return {"tests": len(cases), "failures": len(failures), "errors": len(errors),
            "skipped": len(skipped), "failure_names": [case.attrib["name"] for case in failures],
            "failure_messages": [case.find("failure").attrib.get("message", "") for case in failures]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--upstream", required=True)
    parser.add_argument("--artifacts", required=True)
    args = parser.parse_args()
    upstream = Path(args.upstream).resolve()
    artifacts = Path(args.artifacts).resolve()
    artifacts.mkdir(parents=True, exist_ok=True)
    packet = Path(__file__).resolve().parent
    patch = packet / "polygraphy-4607-guard.patch"
    report = {"python": platform.python_version(), "patch_validated": False,
              "upstream_sha": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=upstream, text=True).strip(),
              "packages": {name: importlib.metadata.version(name) for name in
                           ["numpy", "onnx", "onnxruntime", "onnx-graphsurgeon", "polygraphy", "pytest", "black"]}}
    try:
        assert report["upstream_sha"] == "c93b7d4893184af4882f9f1862e13a5c64b8677d"
        baseline_dir = artifacts / "baseline_tests"
        baseline_dir.mkdir()
        baseline_test = baseline_dir / "test_reduce_multi_input.py"
        shutil.copyfile(packet / "test_reduce_multi_input.py", baseline_test)
        baseline = run([sys.executable, "-m", "pytest", "-q", "--noconftest", str(baseline_test),
                        "-k", "reject_multiple_inputs_when_freezing_branch", "--tb=short",
                        "--junitxml=" + str(artifacts / "baseline.xml")], upstream, artifacts / "baseline.log")
        report["baseline"] = junit(artifacts / "baseline.xml")
        assert baseline.returncode == 1, baseline.stdout[-5000:] + baseline.stderr[-5000:]
        assert report["baseline"]["tests"] == report["baseline"]["failures"] == 8, report["baseline"]
        assert report["baseline"]["errors"] == report["baseline"]["skipped"] == 0, report["baseline"]
        assert all("assert 0 != 0" in message for message in report["baseline"]["failure_messages"]), report["baseline"]

        subprocess.run(["git", "apply", "--check", str(patch)], cwd=upstream, check=True)
        subprocess.run(["git", "apply", str(patch)], cwd=upstream, check=True)
        test_path = upstream / "tools/Polygraphy/tests/tools/test_reduce_multi_input.py"
        subprocess.run([sys.executable, "-m", "black", str(test_path)], check=True)
        patched = run([sys.executable, "-m", "pytest", "-q", "--noconftest", str(test_path), "--tb=short",
                       "--junitxml=" + str(artifacts / "patched.xml")], upstream, artifacts / "patched.log")
        report["patched"] = junit(artifacts / "patched.xml")
        assert patched.returncode == 0, patched.stdout[-10000:] + patched.stderr[-5000:]
        assert report["patched"]["tests"] == 16, report["patched"]
        assert report["patched"]["failures"] == report["patched"]["errors"] == report["patched"]["skipped"] == 0
        subprocess.run(["git", "add", "--intent-to-add", str(test_path)], cwd=upstream, check=True)
        subprocess.run(["git", "diff", "--check"], cwd=upstream, check=True)
        final_patch = subprocess.check_output(["git", "diff", "--no-ext-diff", "--binary"], cwd=upstream, text=True)
        (artifacts / "verified.patch").write_text(final_patch)
        report["patch_sha256"] = hashlib.sha256(final_patch.encode()).hexdigest()
        report["changed_files"] = subprocess.check_output(["git", "diff", "--name-only"], cwd=upstream, text=True).splitlines()
        report["patch_validated"] = True
    finally:
        (artifacts / "guard-result.json").write_text(json.dumps(report, indent=2) + "\n")
        print("GUARD_REPORT_BEGIN")
        print(json.dumps(report, indent=2))
        print("GUARD_REPORT_END")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
