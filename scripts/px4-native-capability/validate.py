"""Baseline-only PX4 native/SIH capability evidence; no patch or flight commands."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import signal
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

BASE = "789389fd46fcfb8473544d2fb3eeabd85893294c"
REPOSITORY = "https://github.com/PX4/PX4-Autopilot.git"
BASE_EVENT_BLOB = "9cfb5cbb9188bdb7c42184b9e5d75259544d3dc4"
EVENT_FILE = "src/modules/mavlink/mavlink_events.cpp"
EXPECTED = (
    "python-version",
    "source",
    "environment-setup",
    "python-dependencies",
    "python-packages",
    "tool-versions",
    "native-tests",
    "native-counts",
    "sitl-build",
    "sitl-startup",
    "final-source",
)
PREVIOUS_IPC_FAILURES = {
    "sitl-atomic_bitset",
    "sitl-bitset",
    "sitl-bson",
    "sitl-dataman",
    "sitl-file2",
    "sitl-float",
    "sitl-hrt",
    "sitl-int",
    "sitl-IntrusiveQueue",
    "sitl-IntrusiveSortedList",
    "sitl-List",
    "sitl-mathlib",
    "sitl-matrix",
    "sitl-param",
    "sitl-parameters",
    "sitl-perf",
    "sitl-search_min",
    "sitl-sleep",
    "sitl-versioning",
    "sitl-controllib_test",
    "sitl-lightware_laser_test",
    "sitl-rc_tests",
    "sitl-uorb_tests",
    "dyn",
    "posix_hrt_test",
    "posix_cdev_test",
    "posix_wqueue_test",
}


class Evidence:
    def __init__(self, directory: Path):
        self.directory = directory.resolve()
        self.directory.mkdir(parents=True, exist_ok=True)

    def record(self, stage: str, **details):
        (self.directory / f"{stage}.json").write_text(
            json.dumps({"stage": stage, **details}, indent=2) + "\n"
        )

    def check(self, stage: str, action) -> bool:
        try:
            details = action() or {}
        except (
            AssertionError,
            OSError,
            ValueError,
            subprocess.SubprocessError,
            ET.ParseError,
        ) as error:
            self.record(
                stage,
                status="FAIL",
                exit_code=getattr(error, "returncode", None),
                error=str(error),
            )
            print(f"{stage}: FAIL: {error}", flush=True)
            return False
        self.record(stage, status="PASS", exit_code=0, **details)
        print(f"{stage}: PASS", flush=True)
        return True

    def run(
        self,
        stage: str,
        command: list[str],
        *,
        cwd: Path | None = None,
        env: dict | None = None,
        timeout: int = 1800,
    ) -> bool:
        log = self.directory / f"{stage}.log"
        started = time.monotonic()
        code = None
        timed_out = False
        with log.open("wb") as destination:
            try:
                process = subprocess.Popen(
                    command,
                    cwd=cwd,
                    env=env,
                    stdout=destination,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )
                try:
                    code = process.wait(timeout=timeout)
                except subprocess.TimeoutExpired:
                    timed_out = True
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        code = process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        code = process.wait()
            except OSError as error:
                destination.write((str(error) + "\n").encode())
        passed = code == 0 and not timed_out
        self.record(
            stage,
            status="PASS" if passed else "FAIL",
            exit_code=code,
            timed_out=timed_out,
            command=command,
            log=log.name,
            duration_seconds=round(time.monotonic() - started, 2),
        )
        print(
            f"{stage}: {'PASS' if passed else 'FAIL'} (actual exit {code})", flush=True
        )
        print(log.read_text(errors="replace")[-7000:], flush=True)
        return passed


def output(command: list[str], cwd: Path) -> str:
    return subprocess.check_output(command, cwd=cwd, text=True).strip()


def source_proof(source: Path) -> dict:
    head = output(["git", "rev-parse", "HEAD"], source)
    dirty = output(["git", "status", "--porcelain", "--untracked-files=no"], source)
    blob = output(["git", "hash-object", EVENT_FILE], source)
    assert head == BASE, "Source commit differs"
    assert not dirty, "Baseline has tracked changes"
    assert blob == BASE_EVENT_BLOB, "Baseline event handler differs"
    binary = source / "build/px4_sitl_default/bin/px4"
    return {
        "repository": REPOSITORY,
        "commit": head,
        "dirty": dirty,
        "event_blob": blob,
        "submodules": output(["git", "submodule", "status", "--recursive"], source),
        "sitl_binary": str(binary) if binary.exists() else None,
        "sitl_binary_sha256": (
            hashlib.sha256(binary.read_bytes()).hexdigest() if binary.exists() else None
        ),
    }


def prepare(evidence: Evidence, source: Path) -> bool:
    def restore():
        assert not source.exists(), "Source directory must be new"
        subprocess.run(
            [
                "git",
                "clone",
                "--filter=blob:none",
                "--no-checkout",
                REPOSITORY,
                str(source),
            ],
            check=True,
        )
        subprocess.run(["git", "checkout", "--detach", BASE], cwd=source, check=True)
        assert not (source / "build").exists(), "Build artifacts unexpectedly present"
        return source_proof(source)

    return evidence.check("source", restore)


def setup(evidence: Evidence, source: Path, python: str) -> bool:
    if not evidence.run(
        "python-version",
        [
            python,
            "-c",
            "import sys; print(sys.version); assert sys.version_info[:3] == (3, 12, 14)",
        ],
    ):
        return False
    env = os.environ.copy()
    env["PATH"] = str(Path(python).parent) + os.pathsep + env["PATH"]
    env["PIP_CONSTRAINT"] = str(Path(__file__).with_name("constraints.txt").resolve())
    # Only ephemeral ordinary runner dependencies. No NuttX toolchain, simulator
    # packages, serial-group changes, container, capabilities or system service.
    if not evidence.run(
        "environment-setup",
        ["bash", "Tools/setup/ubuntu.sh", "--no-nuttx", "--no-sim-tools"],
        cwd=source,
        env=env,
        timeout=1800,
    ):
        return False
    results = [
        evidence.run("python-dependencies", [python, "-m", "pip", "check"]),
        evidence.run("python-packages", [python, "-m", "pip", "freeze"]),
        evidence.run(
            "tool-versions",
            [
                python,
                "-c",
                (
                    "import subprocess; from importlib.metadata import version; "
                    "expected={'empy':'3.3.4','kconfiglib':'14.1.0','pyros-genmsg':'0.5.8'}; "
                    "actual={p:version(p) for p in expected}; print(actual); assert actual == expected; "
                    "[subprocess.run(c,check=True) for c in [['g++','--version'],['cmake','--version'],['ninja','--version'],['astyle','--version']]]"
                ),
            ],
        ),
    ]
    return all(results)


def native(evidence: Evidence, source: Path) -> bool:
    # This is the actual project command. No TESTFILTER, IPC doubles or skips.
    passed = evidence.run(
        "native-tests", ["make", "tests", "-j4"], cwd=source, timeout=2400
    )

    def verify():
        paths = sorted(
            (source / "build/px4_sitl_test/Testing").glob("*/Test.xml"),
            key=lambda p: p.stat().st_mtime_ns,
        )
        assert paths, "Actual CTest XML missing"
        xml = paths[-1]
        records = ET.parse(xml).getroot().findall("./Testing/Test")
        (evidence.directory / "native-Test.xml").write_bytes(xml.read_bytes())
        assert records, "No native tests executed"
        statuses = {
            test.findtext("Name"): test.attrib.get("Status") for test in records
        }
        assert len(statuses) == len(records), "Duplicate CTest names"
        assert all(status == "passed" for status in statuses.values()), statuses
        assert PREVIOUS_IPC_FAILURES <= statuses.keys(), "Old IPC test coverage missing"
        return {
            "tests": len(statuses),
            "passed": len(statuses),
            "failed": 0,
            "not_run": 0,
            "all_test_statuses": statuses,
            "previous_ipc_startup_tests": sorted(PREVIOUS_IPC_FAILURES),
        }

    counts = evidence.check("native-counts", verify)
    return passed and counts


def sitl(evidence: Evidence, source: Path) -> bool:
    if not evidence.run(
        "sitl-build", ["make", "px4_sitl_default", "-j4"], cwd=source, timeout=2400
    ):
        return False
    return evidence.run(
        "sitl-startup",
        [
            sys.executable,
            str(Path(__file__).with_name("smoke.py")),
            "--source",
            str(source),
            "--evidence",
            str(evidence.directory),
        ],
        cwd=source,
        timeout=120,
    )


def report(evidence: Evidence) -> bool:
    stages = {}
    for stage in EXPECTED:
        path = evidence.directory / f"{stage}.json"
        stages[stage] = (
            json.loads(path.read_text())
            if path.exists()
            else {"stage": stage, "status": "NOT_RUN", "exit_code": None}
        )
    passed = all(stage["status"] == "PASS" for stage in stages.values())
    result = {
        "status": (
            "BASELINE_CAPABILITY_PASSED" if passed else "BASELINE_CAPABILITY_INCOMPLETE"
        ),
        "base": BASE,
        "production_patch": None,
        "stages": stages,
        "event_protocol_regression": "NOT_RUN",
        "candidate_validation": "NOT_RUN",
        "limits": [
            "Unmodified baseline only; no candidate or REQUEST_EVENT oracle yet",
            "Native/SIH and daemon status commands are real, disarmed and local; no physical vehicle or flight",
            "SITL startup/status is not a wire-protocol pass",
            "No board build, clang-tidy, variant/coverage/full upstream CI or human/DCO attestation",
            "No source commit/push, upstream PR, release, credentials or external service commands",
        ],
    }
    (evidence.directory / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    lines = [
        "## PX4 baseline native/SIH capability",
        "",
        f"Result: **{result['status']}**",
        "",
        f"Unmodified source: `{BASE}`",
        "",
        "REQUEST_EVENT and candidate validation: **NOT_RUN**",
        "",
        "| Stage | Status | Actual exit |",
        "| --- | --- | --- |",
    ]
    lines += [
        f"| {name} | {record['status']} | {record['exit_code']} |"
        for name, record in stages.items()
    ]
    summary = "\n".join(lines) + "\n"
    (evidence.directory / "summary.md").write_text(summary)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as destination:
            destination.write(summary)
    print(summary)
    return passed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "phase", choices=("prepare", "setup", "native", "sitl", "final", "report")
    )
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--python", default=sys.executable)
    args = parser.parse_args()
    evidence = Evidence(args.evidence)
    source = args.source.resolve()
    phases = {
        "prepare": lambda: prepare(evidence, source),
        "setup": lambda: setup(evidence, source, args.python),
        "native": lambda: native(evidence, source),
        "sitl": lambda: sitl(evidence, source),
        "final": lambda: evidence.check("final-source", lambda: source_proof(source)),
        "report": lambda: report(evidence),
    }
    return 0 if phases[args.phase]() else 1


if __name__ == "__main__":
    raise SystemExit(main())
