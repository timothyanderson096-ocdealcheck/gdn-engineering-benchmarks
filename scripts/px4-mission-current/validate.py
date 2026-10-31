"""Strict proposed DR11 diagnostic plus native SIH compatibility evidence."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

BASE = "789389fd46fcfb8473544d2fb3eeabd85893294c"
MISSION_FILE = "src/modules/mavlink/mavlink_mission.cpp"
BASE_BLOB = "c30d137d2e4e86ee0072e326e3aac8a4166cc833"
CANDIDATE_BLOB = "a7d09a9c2b3b1e3ad349eb4e362f29a7838a1162"
CANDIDATE_TREE = "34ce9d0ae97c2a80eb6df5ec0a825874d9c9cc77"
SOURCE_HASHES = {
    "baseline": "d25e299a2f597648c826c64fd54f1dadd1322b7f91b376af34408aaa65b59eda",
    "candidate": "29410d0813d6c68a72089d93f6546a2016739566d0a9b38acb60697858da3c9a",
}
FROZEN = {
    "../px4-native-capability/validate.py": "db3a192ffedf40c3fe27b51a436624ca6ec2723a588931c3cd0631632530cefd",
    "../px4-native-capability/constraints.txt": "d801b8887d31c28f91bc0bcfd5ba1fd2a7095e4ac7663b6e123be5055f3e2e03",
    "../px4-event-range/validate.py": "02ab9a9af1b9801db25342717bbd6e2688b662d431f0562fd0da431ccf325ad8",
    "../px4-event-range/wire_probe.py": "3aac3fefd1bddc8c3be023d5da3a6f550257254c32583820108bb3cc6837f074",
    "candidate.patch": "b16f287d42ff55f0f2af8c66730970f5f2d8e7cb3c4185f1a1253cdf2f4113f4",
    "rejected-notification-only.patch": "50811182b0e16394a61f8c4361d0bc2e97b0a1cf1428412d1fb0a4c51cfb4c36",
    "wire_probe.py": "ae4a0cd1fd372856f7ebf68c49f05892fdea8f62d47d84e7a6eca946eb40ef7b",
    "diagnostic/run_probe.py": "f62b4ddaaba62bd6208c6e1ccfd96b27d145e7988b56193349864e0f702b3b4c",
    "diagnostic/probe.cpp.in": "bbfbc41dbd7aed0ed0c2c745e72f061c3874ec110164f24527f5456aa55cfea2",
    "diagnostic/EXPECTATIONS.json": "4711aed1bfe385cd9bf9882b82566dd3e9d88500d4ad6a44b8e48b9af67f3054",
    "diagnostic/validate_results.py": "22e268fe8f8d6327b150f054c9c90d71e0a1f2bba1a3ac3558f92cea44382528",
}
WIRE_CASES = (
    "new_sequence",
    "same_sequence",
    "wrong_system",
    "wrong_component",
    "invalid_count_boundary",
    "invalid_uint16_max",
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def dependencies():
    bundle = Path(__file__).resolve().parent
    for name, expected in FROZEN.items():
        assert (
            sha256(bundle / name) == expected
        ), f"Reviewed fixture/helper changed: {name}"
    capability = load_module(
        bundle / "../px4-native-capability/validate.py", "dr11_capability"
    )
    events = load_module(
        bundle / "../px4-event-range/validate.py", "dr11_event_helpers"
    )
    return bundle, capability, events


def run_expected(
    evidence,
    events,
    stage: str,
    command: list[str],
    *,
    source: Path,
    expected_exit: int,
    timeout: int,
    native_output: Path | None = None,
) -> bool:
    started = time.monotonic()
    timed_out = False
    cleanup = None
    log = evidence.directory / f"{stage}.log"
    with log.open("wb") as destination:
        process = subprocess.Popen(
            command,
            cwd=source,
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
            if native_output is not None:
                try:
                    cleanup = events.clean_native_after_timeout(native_output, source)
                except (AssertionError, OSError, ValueError) as error:
                    cleanup = {
                        "status": "CLEANUP_IDENTITY_OR_IO_FAILURE",
                        "error": str(error),
                    }
    passed = code == expected_exit and not timed_out
    evidence.record(
        stage,
        status="PASS" if passed else "FAIL",
        exit_code=code,
        expected_exit_code=expected_exit,
        timed_out=timed_out,
        timeout_native_cleanup=cleanup,
        command=command,
        log=log.name,
        duration_seconds=round(time.monotonic() - started, 2),
    )
    print(
        f"{stage}: {'PASS'if passed else'FAIL'} (actual exit {code}, expected {expected_exit})",
        flush=True,
    )
    if not passed:
        print(log.read_text(errors="replace")[-12000:], flush=True)
    return passed


def diagnostic(
    evidence,
    events,
    bundle: Path,
    source: Path,
    python: str,
    variant: str,
    mission_source: Path | None = None,
) -> bool:
    output = evidence.directory / "diagnostic"
    raw = run_expected(
        evidence,
        events,
        "diagnostic-run",
        [
            python,
            str(bundle / "diagnostic/run_probe.py"),
            "--source",
            str(mission_source or source / MISSION_FILE),
            "--bridge",
            str(source / "src/modules/mavlink/mavlink_bridge_header.h"),
            "--out",
            str(output),
        ],
        source=source,
        expected_exit=0 if variant == "candidate" else 1,
        timeout=120,
    )
    # Separate strict validator checks all 79 ordered, unique names/outcomes,
    # method/fixture/generated identities, exact summary and completion record.
    strict = evidence.run(
        "diagnostic-contract",
        [
            python,
            str(bundle / "diagnostic/validate_results.py"),
            "--snapshot",
            variant,
            "--directory",
            str(output),
        ],
        cwd=source,
        timeout=60,
    )
    return raw and strict


def rejected_diagnostic(
    evidence, events, bundle: Path, source: Path, python: str
) -> bool:
    destination = evidence.directory / "rejected-source"
    mission = destination / MISSION_FILE

    def prepare():
        mission.parent.mkdir(parents=True, exist_ok=False)
        shutil.copyfile(source / MISSION_FILE, mission)
        subprocess.run(
            [
                "git",
                "apply",
                "--check",
                str(bundle / "rejected-notification-only.patch"),
            ],
            cwd=destination,
            check=True,
        )
        subprocess.run(
            ["git", "apply", str(bundle / "rejected-notification-only.patch")],
            cwd=destination,
            check=True,
        )
        actual = subprocess.check_output(
            ["git", "hash-object", str(mission)], text=True
        ).strip()
        assert actual == "e73172e7ab4db374231d4fc04a02e7388c8ba263"
        assert (
            sha256(source / MISSION_FILE) == SOURCE_HASHES["baseline"]
        ), "Native source was modified by negative control"
        return {
            "source_blob": actual,
            "production_checkout_modified": False,
            "scope": "Rejected text is compiled only by boundary diagnostic, never native/SITL",
        }

    if not evidence.check("rejected-text", prepare):
        return False
    return diagnostic(evidence, events, bundle, source, python, "rejected", mission)


def wire(
    evidence,
    events,
    bundle: Path,
    source: Path,
    dialect: Path,
    python: str,
    variant: str,
) -> bool:
    output = evidence.directory / "wire"
    raw = run_expected(
        evidence,
        events,
        "wire-run",
        [
            python,
            str(bundle / "wire_probe.py"),
            "--source",
            str(source),
            "--dialect",
            str(dialect),
            "--expected-mission-sha256",
            SOURCE_HASHES[variant],
            "--expected-dialect-sha256",
            sha256(dialect),
            "--shared-probe",
            str((bundle / "../px4-event-range/wire_probe.py").resolve()),
            "--output",
            str(output),
        ],
        source=source,
        expected_exit=0,
        timeout=300,
        native_output=output,
    )

    def verify():
        result = json.loads((output / "result.json").read_text())
        assert result["status"] == "WIRE_COMPATIBILITY_CHECKS_PASSED"
        assert not result.get("harness_error") and not result.get("cleanup_errors")
        assert not result["forced_cleanup"] and result["native_exit"] == 0
        assert not result["failed_checks"] and not result["missing_cases"]
        assert tuple(case["name"] for case in result["cases"]) == WIRE_CASES
        assert result["checks"] and all(check["passed"] for check in result["checks"])
        assert (
            result["claim"]
            == "NATIVE_WIRE_COMPATIBILITY_STATUS_AND_MISSION_INTEGRITY_ONLY"
        )
        assert all(
            case["causal_packet_attribution"]
            == "NOT_ESTABLISHED_PERIODIC_AND_MISSION_RESULT_CONFOUNDS"
            for case in result["cases"]
        )
        assert result["harness_sha256"] == FROZEN["wire_probe.py"]
        return {
            "variant": variant,
            "case_count": len(result["cases"]),
            "check_count": len(result["checks"]),
            "claim": result["claim"],
            "binary_sha256": result["binary_sha256"],
            "raw_udp_sha256": sha256(output / "wire.udp"),
            "per_request_causality": "NOT_ESTABLISHED",
        }

    verdict = evidence.check("wire-contract", verify)
    return raw and verdict


def baseline(
    evidence, capability, events, bundle: Path, source: Path, python: str
) -> bool:
    def verify():
        proof = capability.source_proof(source)
        assert (
            subprocess.check_output(
                ["git", "hash-object", MISSION_FILE], cwd=source, text=True
            ).strip()
            == BASE_BLOB
        )
        assert sha256(source / MISSION_FILE) == SOURCE_HASHES["baseline"]
        return proof

    if not evidence.check("baseline-source", verify):
        return False
    diagnosed = diagnostic(evidence, events, bundle, source, python, "baseline")
    rejected = rejected_diagnostic(
        capability.Evidence(evidence.directory / "rejected"),
        events,
        bundle,
        source,
        python,
    )
    built = evidence.run(
        "sitl-build", ["make", "px4_sitl_default", "-j4"], cwd=source, timeout=2400
    )
    dialect = events.generated_dialect(evidence, source, python) if built else None
    compatible = (
        wire(evidence, events, bundle, source, dialect, python, "baseline")
        if dialect
        else False
    )
    return diagnosed and rejected and built and compatible


def candidate_proof(source: Path) -> dict:
    def git(*args):
        return subprocess.check_output(["git", *args], cwd=source, text=True).strip()

    assert git("rev-parse", "HEAD") == BASE
    assert git("diff", "--name-only") == MISSION_FILE, "Unrelated source change"
    assert git("hash-object", MISSION_FILE) == CANDIDATE_BLOB
    assert sha256(source / MISSION_FILE) == SOURCE_HASHES["candidate"]
    assert (
        git("hash-object", "src/modules/mavlink/mavlink_events.cpp")
        == "9cfb5cbb9188bdb7c42184b9e5d75259544d3dc4"
    ), "DR07 patch must not be applied"
    index = source.parent / "mission-probe-tree.index"
    assert not index.exists()
    env = os.environ.copy()
    env["GIT_INDEX_FILE"] = str(index)
    try:
        subprocess.run(["git", "read-tree", BASE], cwd=source, env=env, check=True)
        subprocess.run(
            ["git", "add", "--", MISSION_FILE], cwd=source, env=env, check=True
        )
        tree = subprocess.check_output(
            ["git", "write-tree"], cwd=source, env=env, text=True
        ).strip()
        assert tree == CANDIDATE_TREE
    finally:
        index.unlink(missing_ok=True)
    return {
        "base": BASE,
        "mission_blob": CANDIDATE_BLOB,
        "tree": tree,
        "mission_sha256": SOURCE_HASHES["candidate"],
        "source_commit_or_dco_created": False,
    }


def candidate(
    evidence, capability, events, bundle: Path, source: Path, python: str
) -> bool:
    def apply():
        capability.source_proof(source)
        subprocess.run(
            ["git", "apply", "--check", str(bundle / "candidate.patch")],
            cwd=source,
            check=True,
        )
        subprocess.run(
            ["git", "apply", str(bundle / "candidate.patch")], cwd=source, check=True
        )
        return candidate_proof(source)

    if not evidence.check("candidate-source", apply):
        return False
    if not evidence.run("format-changed", ["make", "format_changed"], cwd=source):
        return False
    if not evidence.check("post-format-source", lambda: candidate_proof(source)):
        return False
    formatted = evidence.run("check-format", ["make", "check_format"], cwd=source)
    diagnosed = diagnostic(evidence, events, bundle, source, python, "candidate")
    native = capability.native(evidence, source)
    built = evidence.run(
        "sitl-build", ["make", "px4_sitl_default", "-j4"], cwd=source, timeout=2400
    )
    compatible = (
        wire(
            evidence,
            events,
            bundle,
            source,
            source / "build/event-probe-dialect/development.py",
            python,
            "candidate",
        )
        if built
        else False
    )
    final = evidence.check("final-source", lambda: candidate_proof(source))
    return all((formatted, diagnosed, native, built, compatible, final))


def report(evidence) -> bool:
    expected = [
        "source",
        "python-version",
        "environment-setup",
        "python-dependencies",
        "python-packages",
        "tool-versions",
        "baseline/baseline-source",
        "baseline/diagnostic-run",
        "baseline/diagnostic-contract",
        "baseline/rejected/rejected-text",
        "baseline/rejected/diagnostic-run",
        "baseline/rejected/diagnostic-contract",
        "baseline/sitl-build",
        "baseline/dialect-generation",
        "baseline/dialect-proof",
        "baseline/wire-run",
        "baseline/wire-contract",
        "candidate/candidate-source",
        "candidate/format-changed",
        "candidate/post-format-source",
        "candidate/check-format",
        "candidate/diagnostic-run",
        "candidate/diagnostic-contract",
        "candidate/native-tests",
        "candidate/native-counts",
        "candidate/sitl-build",
        "candidate/wire-run",
        "candidate/wire-contract",
        "candidate/final-source",
    ]
    stages = {}
    for name in expected:
        path = evidence.directory / f"{name}.json"
        stages[name] = (
            json.loads(path.read_text())
            if path.exists()
            else {"status": "NOT_RUN", "exit_code": None}
        )
    passed = all(record["status"] == "PASS" for record in stages.values())
    result = {
        "status": (
            "DR11_DIAGNOSTIC_AND_NATIVE_COMPATIBILITY_PASSED"
            if passed
            else "DR11_VALIDATION_INCOMPLETE"
        ),
        "base": BASE,
        "candidate_blob": CANDIDATE_BLOB,
        "candidate_tree": CANDIDATE_TREE,
        "stages": stages,
        "diagnostic_scope": "One actual-method executable per variant, explicit decode/storage/uORB/status/transport boundary doubles; 79 named assertions, not 79 PX4 tests",
        "wire_scope": "Real native disarmed SIH/MAVLink compatibility, observed status and mission integrity; no packet-level per-request causality or latency bound",
        "limits": [
            "No physical flight/GCS/target-board test, full CI, clang-tidy, cross-topic atomic snapshot or general concurrency claim",
            "Personal review/DCO and upstream source submission remain pending; no PX4 source commit, sign-off or PR created",
            "Only the corrected two-hunk mission patch is applied; DR07 event handler remains exact baseline",
            "Unchanged baseline native suite uses separate exact-source capability evidence and is not rerun here",
        ],
    }
    (evidence.directory / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    summary = (
        "\n".join(
            [
                "## PX4 proposed mission-current candidate evidence",
                "",
                f"Result: **{result['status']}**",
                "",
                "Actual-method diagnostic: 79 named assertions with explicit boundary doubles. Wire: compatibility/integrity only; per-request causality is not established.",
                "",
                "| Stage | Status | Actual exit |",
                "| --- | --- | --- |",
                *(
                    f"| {name} | {record['status']} | {record['exit_code']} |"
                    for name, record in stages.items()
                ),
            ]
        )
        + "\n"
    )
    (evidence.directory / "summary.md").write_text(summary)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as destination:
            destination.write(summary)
    print(summary)
    return passed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "phase", choices=("prepare", "setup", "baseline", "candidate", "report")
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
        "baseline": lambda: baseline(
            capability.Evidence(evidence.directory / "baseline"),
            capability,
            events,
            bundle,
            source,
            args.python,
        ),
        "candidate": lambda: candidate(
            capability.Evidence(evidence.directory / "candidate"),
            capability,
            events,
            bundle,
            source,
            args.python,
        ),
        "report": lambda: report(evidence),
    }
    return 0 if phases[args.phase]() else 1


if __name__ == "__main__":
    raise SystemExit(main())
