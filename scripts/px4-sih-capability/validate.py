"""Unchanged PX4 SIH readiness recovery; previous native tests are cited, not rerun."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import signal
import subprocess
import sys
from pathlib import Path

BASE = "789389fd46fcfb8473544d2fb3eeabd85893294c"
PINS = {
    "../px4-native-capability/validate.py": "db3a192ffedf40c3fe27b51a436624ca6ec2723a588931c3cd0631632530cefd",
    "../px4-native-capability/constraints.txt": "d801b8887d31c28f91bc0bcfd5ba1fd2a7095e4ac7663b6e123be5055f3e2e03",
    "../px4-event-range/validate.py": "a1651aaaf7a50362a475e8101f92f62ec507d51ff03a839d462877d643fb4cd9",
}
EXPECTED = (
    "source",
    "python-version",
    "environment-setup",
    "python-dependencies",
    "python-packages",
    "tool-versions",
    "sitl-build",
    "dialect-generation",
    "dialect-proof",
    "sih-startup",
    "sih-contract",
    "final-source",
)


def dependencies():
    bundle = Path(__file__).resolve().parent
    for name, digest in PINS.items():
        assert (
            hashlib.sha256((bundle / name).read_bytes()).hexdigest() == digest
        ), f"Reviewed dependency changed: {name}"

    def load(name, path):
        spec = importlib.util.spec_from_file_location(name, bundle / path)
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    return (
        bundle,
        load("sih_capability", "../px4-native-capability/validate.py"),
        load("sih_decoder_helpers", "../px4-event-range/validate.py"),
    )


def readiness(evidence, events, bundle: Path, source: Path, python: str) -> bool:
    if not evidence.run(
        "sitl-build", ["make", "px4_sitl_default", "-j4"], cwd=source, timeout=2400
    ):
        return False
    dialect = events.generated_dialect(evidence, source, python)
    if dialect is None:
        return False
    command = [
        python,
        str(bundle / "smoke.py"),
        "--source",
        str(source),
        "--dialect",
        str(dialect),
        "--evidence",
        str(evidence.directory),
    ]
    timed_out = False
    cleanup = None
    log = evidence.directory / "sih-startup.log"
    with log.open("wb") as destination:
        process = subprocess.Popen(
            command,
            cwd=source,
            stdout=destination,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        try:
            code = process.wait(timeout=120)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(process.pid, signal.SIGTERM)
            try:
                code = process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                code = process.wait()
            try:
                cleanup = events.clean_native_after_timeout(
                    evidence.directory / "startup", source
                )
            except (AssertionError, OSError, ValueError) as error:
                cleanup = {"error": repr(error)}
    passed = code == 0 and not timed_out
    evidence.record(
        "sih-startup",
        status="PASS" if passed else "FAIL",
        exit_code=code,
        timed_out=timed_out,
        timeout_native_cleanup=cleanup,
        command=command,
        log=log.name,
    )
    print(log.read_text(errors="replace")[-12000:], flush=True)

    def verify():
        assert passed, "Actual readiness process failed or timed out"
        result = json.loads((evidence.directory / "startup/result.json").read_text())
        assert result["status"] == "PASS" and result["native_exit"] == 0
        assert (
            not result["forced_cleanup"]
            and not result["cleanup_errors"]
            and not result.get("error")
        )
        assert result["checks"] == {
            "disarmed_status": True,
            "sih_status": True,
            "mavlink_status_exit": True,
        }
        assert len(result["heartbeats"]) >= 2
        assert result["native_udp_identity"]["sockets"]
        return {
            "claim": "SIH_STARTUP_AND_LOOPBACK_READINESS_ONLY",
            "disarmed_heartbeats": len(result["heartbeats"]),
            "native_udp_identity": result["native_udp_identity"],
            "binary_sha256": result["binary_sha256"],
            "native_exit": 0,
        }

    return evidence.check("sih-contract", verify)


def report(evidence) -> bool:
    stages = {}
    for stage in EXPECTED:
        path = evidence.directory / f"{stage}.json"
        stages[stage] = (
            json.loads(path.read_text())
            if path.exists()
            else {"status": "NOT_RUN", "exit_code": None}
        )
    passed = all(row["status"] == "PASS" for row in stages.values())
    result = {
        "status": "SIH_CAPABILITY_PASSED" if passed else "SIH_CAPABILITY_INCOMPLETE",
        "base": BASE,
        "stages": stages,
        "native_tests_this_job": "NOT_RUN",
        "prior_native_evidence": {
            "url": "https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/41186705281",
            "tests": 226,
            "passed": 226,
            "failed": 0,
            "not_run": 0,
            "old_daemon_ipc_names_passed": 27,
            "qualification": "Prior exact-source native stage passed; overall old capability result remains INCOMPLETE due the smoke stdout oracle failure",
        },
        "limits": [
            "Unchanged baseline SIH startup/module/loopback readiness only; no candidate or protocol regression claim",
            "No unchanged native test suite rerun, source edits, PX4 commit/DCO/submission, board test or physical flight",
            "MAVLink status uses daemon raw printf; client stdout may be empty even when status returns0 and instances exist",
            "Failed historic artifact is retained; this separate recovery does not relabel it green",
        ],
    }
    (evidence.directory / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    lines = [
        "## PX4 SIH readiness recovery",
        "",
        f"Result: **{result['status']}**",
        "",
        "Native suite: **NOT_RUN in this job**. Prior exact-source run 41186705281 passed 226/226, including all 27 previously blocked IPC names; its overall helper result remains incomplete.",
        "",
        "| Stage | Status | Actual exit |",
        "| --- | --- | --- |",
        *(
            f"| {name} | {row['status']} | {row['exit_code']} |"
            for name, row in stages.items()
        ),
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
        "phase", choices=("prepare", "setup", "readiness", "final", "report")
    )
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--python", default=sys.executable)
    args = parser.parse_args()
    bundle, capability, events = dependencies()
    source = args.source.resolve()
    evidence = capability.Evidence(args.evidence)
    phases = {
        "prepare": lambda: capability.prepare(evidence, source),
        "setup": lambda: capability.setup(evidence, source, args.python),
        "readiness": lambda: readiness(evidence, events, bundle, source, args.python),
        "final": lambda: evidence.check(
            "final-source", lambda: capability.source_proof(source)
        ),
        "report": lambda: report(evidence),
    }
    return 0 if phases[args.phase]() else 1


if __name__ == "__main__":
    raise SystemExit(main())
