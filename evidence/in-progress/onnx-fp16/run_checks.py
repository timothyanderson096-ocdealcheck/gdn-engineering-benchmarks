"""Run real ONNX evaluator checks in a disposable, local Python environment.

Requires Python 3.11 or newer and internet access to PyPI. Installs packages
only into a new virtual environment next to this script. No GitHub writes.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import venv
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent


def main():
    if sys.version_info < (3, 11):
        raise SystemExit("Python 3.11 or newer is needed. Send this message back to Tim's assistant.")
    work = Path(tempfile.mkdtemp(prefix="onnx-check-", dir=ROOT))
    environment = work / "environment"
    report = {"scope": "ONNX 1.22.0 real ReferenceEvaluator with inspected and proposed Conv source; not a full main build", "work": str(work), "stages": {}, "repository_lintrunner": "NOT RUN", "current_main_full_suite": "NOT RUN"}
    log = ROOT / "verification-log.txt"
    print("Preparing a separate environment. First run downloads ONNX and test dependencies.")
    print("Results will be saved beside this script. This can take several minutes.")
    with log.open("w", encoding="utf-8") as stream:
        def run(command, required=True):
            stream.write("\nCOMMAND: " + repr([str(x) for x in command]) + "\n")
            stream.flush()
            result = subprocess.run([str(x) for x in command], cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT)
            stream.flush()
            if required and result.returncode:
                raise RuntimeError("Command failed; details are in verification-log.txt")
            return result.returncode

        try:
            venv.EnvBuilder(with_pip=True).create(environment)
            python = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
            run([python, "-m", "pip", "install", "--disable-pip-version-check", "--index-url", "https://pypi.org/simple", "onnx==1.22.0", "numpy==2.3.5", "pytest==8.4.2"])
            location_file = work / "module-location.txt"
            locate = "import onnx.reference.ops.op_conv as c; from pathlib import Path; Path(" + repr(str(location_file)) + ").write_text(c.__file__, encoding='utf-8')"
            run([python, "-c", locate])
            target = Path(location_file.read_text(encoding="utf-8")).resolve()
            if not target.is_relative_to(environment.resolve()):
                raise RuntimeError("Refusing to modify a package outside the new environment")
            original = target.read_bytes()
            test = ROOT / "runtime_test.py"
            try:
                for phase, filename in [("packaged_baseline", None), ("inspected_upstream", "upstream_conv.py"), ("proposed_patch", "patched_conv.py")]:
                    if filename:
                        source = (ROOT / filename).read_bytes()
                        target.write_bytes(source)
                        report["stages"][phase] = {"source_sha256": hashlib.sha256(source).hexdigest()}
                    else:
                        target.write_bytes(original)
                        report["stages"][phase] = {}
                    print("Running:", phase, flush=True)
                    xml = work / (phase + ".xml")
                    code = run([python, "-B", "-m", "pytest", "-q", "-p", "no:cacheprovider", test, "--junitxml=" + str(xml)], required=False)
                    tree = ET.parse(xml)
                    cases = tree.findall(".//testcase")
                    failures = tree.findall(".//failure")
                    errors = tree.findall(".//error")
                    stage = report["stages"][phase]
                    stage.update({"exit_code": code, "tests": len(cases), "failures": len(failures), "errors": len(errors)})
                    if phase == "inspected_upstream":
                        correct = code == 1 and len(cases) == len(failures) == 24 and not errors and all("inf" in (f.text or "") for f in failures)
                    else:
                        correct = code == 0 and len(cases) == 24 and not failures and not errors
                    stage["expected_outcome_confirmed"] = correct
                    if not correct:
                        raise RuntimeError("Unexpected evaluator result in " + phase + "; please send both result files back")
            finally:
                target.write_bytes(original)
            print("Checking non-float16 compatibility and the numerical matrix.", flush=True)
            run([python, ROOT / "check_compatibility.py", work / "compatibility.json"])
            report["compatibility"] = json.loads((work / "compatibility.json").read_text(encoding="utf-8"))
            run([python, ROOT / "check_regression.py"])
            report["helper_regressions"] = json.loads((ROOT / "regression-results.json").read_text(encoding="utf-8"))
            report["result"] = "TARGETED EVALUATOR AND NUMERICAL CHECKS PASSED; REPOSITORY GATES STILL PENDING"
        except Exception as error:
            report["result"] = "STOPPED: " + str(error)
            print(report["result"], flush=True)
        finally:
            output = ROOT / "verification-results.json"
            output.write_text(json.dumps(report, indent=2), encoding="utf-8")
            print("\nFinished. Send back these two files:")
            print(output)
            print(log)
            print(report.get("result", "Interrupted; inspect logs."))
    return 0 if report.get("result", "").startswith("TARGETED") else 1


if __name__ == "__main__":
    raise SystemExit(main())
