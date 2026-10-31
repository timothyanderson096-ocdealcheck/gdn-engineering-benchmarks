"""Reviewed DR07 before/after native wire evidence, without source submission."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

BASE = "789389fd46fcfb8473544d2fb3eeabd85893294c"
BASE_EVENT_BLOB = "9cfb5cbb9188bdb7c42184b9e5d75259544d3dc4"
CANDIDATE_BLOB = "3e77e9a6cadb91e66d0f8e53050cb3b070f9f209"
CANDIDATE_TREE = "3d9e074ec1b86d67b894e62f91cc1385c9fabff4"
EVENT_FILE = "src/modules/mavlink/mavlink_events.cpp"
PATCH_SHA256 = "1cc1a8403d5a17a22a5d49693c84bbd81951aa8a6d26c0dd7edc8b60a8d8b997"
CAPABILITY_HELPER_SHA256 = (
    "db3a192ffedf40c3fe27b51a436624ca6ec2723a588931c3cd0631632530cefd"
)
CAPABILITY_CONSTRAINTS_SHA256 = (
    "d801b8887d31c28f91bc0bcfd5ba1fd2a7095e4ac7663b6e123be5055f3e2e03"
)
WIRE_PROBE_SHA256 = "3aac3fefd1bddc8c3be023d5da3a6f550257254c32583820108bb3cc6837f074"
CAPTURE_PINS = {
    "capture_native.cpp": "fe5ff6b8b2b7d0361cf27c68117d959ece8cf76e2cf6ff371b47ed5b407b02f4",
    "capture_native.py": "9cdd5616000effe72b13d44b4797ea9dc0caac6b2854b92ed4a5e5cae446864f",
    "test_capture.py": "86a7f5286cdeebec61413d7281a99e5f67a5179ba99cadbe0c9aac7fcdc5ed3d",
}
EXPECTED_BASELINE_FAILURES = {
    "full:complete_inclusive_wire_range",
    "full:cached_event_contents",
    "full:ordered_inclusive_wire_range",
    "rotated_full:complete_inclusive_wire_range",
    "rotated_full:cached_event_contents",
    "rotated_full:ordered_inclusive_wire_range",
}
EXPECTED_CASES = {
    "cached_single",
    "unavailable_single",
    "hint_followup",
    "ordinary",
    "wrap_short",
    "near_full",
    "full",
    "cached_after_full",
    "rotated_full",
    "cached_after_rotated_full",
}


def load_capability():
    path = Path(__file__).resolve().parent.parent / "px4-native-capability/validate.py"
    assert (
        hashlib.sha256(path.read_bytes()).hexdigest() == CAPABILITY_HELPER_SHA256
    ), "Baseline helper changed; review it explicitly"
    assert (
        hashlib.sha256(path.with_name("constraints.txt").read_bytes()).hexdigest()
        == CAPABILITY_CONSTRAINTS_SHA256
    ), "Baseline setup constraints changed; review them explicitly"
    spec = importlib.util.spec_from_file_location("px4_baseline_capability", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def generated_dialect(evidence, source: Path, python: str) -> Path | None:
    mavlink = source / "src/modules/mavlink/mavlink"
    generator = mavlink / "pymavlink/tools/mavgen.py"
    development = mavlink / "message_definitions/v1.0/development.xml"
    common = mavlink / "message_definitions/v1.0/common.xml"
    generated = source / "build/event-probe-dialect/development.py"
    generated.parent.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    # Explicitly import the recursively pinned generator source, rather than
    # silently selecting the unrelated registry dialect installed by setup.
    env["PYTHONPATH"] = str(mavlink)
    if not evidence.run(
        "dialect-generation",
        [
            python,
            str(generator),
            "--lang=Python3",
            "--wire-protocol=2.0",
            f"--output={generated}",
            str(development),
        ],
        cwd=source,
        env=env,
        timeout=120,
    ):
        return None

    def verify():
        assert generated.is_file(), "Actual generated client dialect missing"
        commits = {}
        for name, directory in (
            ("mavlink", mavlink),
            ("pymavlink", mavlink / "pymavlink"),
        ):
            commits[name] = subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=directory, text=True
            ).strip()
            assert not subprocess.check_output(
                ["git", "status", "--porcelain", "--untracked-files=no"],
                cwd=directory,
                text=True,
            ).strip(), f"Modified {name} source"
        assert commits == {
            "mavlink": "2e2b6af99084e4fde9bb304c84bb9253a1a98b6f",
            "pymavlink": "19880422d451de4daba3fd96781076afb1cb889c",
        }, "Pinned generator/submodule revision differs"
        return {
            "source_commits": commits,
            "files": {
                str(path.relative_to(source)): hashlib.sha256(
                    path.read_bytes()
                ).hexdigest()
                for path in (generator, development, common, generated)
            },
            "python": python,
            "source_pythonpath": str(mavlink),
        }

    return generated if evidence.check("dialect-proof", verify) else None


def compile_capture(evidence, source: Path, python: str) -> bool:
    directory = Path(__file__).resolve().parent / "capture"
    binary = source.parent / "px4-event-capture"

    def inputs():
        for name, expected in CAPTURE_PINS.items():
            assert (
                hashlib.sha256((directory / name).read_bytes()).hexdigest() == expected
            ), name
        assert not binary.exists(), "Recorder build output must be new"
        return {"sources": CAPTURE_PINS}

    if not evidence.check("capture-inputs", inputs):
        return False
    if not evidence.run(
        "capture-offline-tests",
        [python, str(directory / "test_capture.py"), "JournalTests", "-v"],
        cwd=directory,
        timeout=60,
    ):
        return False
    if not evidence.run(
        "capture-build",
        [
            "g++",
            "-std=c++17",
            "-O2",
            "-Wall",
            "-Wextra",
            "-Werror",
            str(directory / "capture_native.cpp"),
            "-o",
            str(binary),
        ],
        cwd=directory,
        timeout=120,
    ):
        return False

    def proof():
        for name, expected in CAPTURE_PINS.items():
            assert (
                hashlib.sha256((directory / name).read_bytes()).hexdigest() == expected
            ), name
        return {
            "binary": str(binary),
            "binary_sha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
            "source_hashes": CAPTURE_PINS,
            "compiler": subprocess.check_output(["g++", "--version"], text=True),
            "offline_scope": "Five journal/lifecycle/TX controls; no synthetic UDP or PX4 runtime",
        }

    return evidence.check("capture-proof", proof)


def run_wire(evidence, source: Path, dialect: Path, python: str, variant: str) -> bool:
    output = evidence.directory / "wire"
    log = evidence.directory / "wire-run.log"
    capture_proof = json.loads(
        (evidence.directory.parent / "baseline/capture-proof.json").read_text()
    )
    capture_binary = source.parent / "px4-event-capture"

    def recorder_identity():
        assert (
            hashlib.sha256(
                Path(__file__).with_name("wire_probe.py").read_bytes()
            ).hexdigest()
            == WIRE_PROBE_SHA256
        )
        assert capture_proof["status"] == "PASS"
        assert capture_proof["binary"] == str(capture_binary)
        assert (
            hashlib.sha256(capture_binary.read_bytes()).hexdigest()
            == capture_proof["binary_sha256"]
        )
        return {
            "binary": str(capture_binary),
            "binary_sha256": capture_proof["binary_sha256"],
            "wire_probe_sha256": WIRE_PROBE_SHA256,
        }

    if not evidence.check("capture-identity", recorder_identity):
        return False
    command = [
        python,
        str(Path(__file__).with_name("wire_probe.py")),
        "--source",
        str(source),
        "--dialect",
        str(dialect),
        "--output",
        str(output),
        "--capture-native",
        str(capture_binary),
        "--expected-capture-sha256",
        capture_proof["binary_sha256"],
    ]
    timed_out = False
    timeout_cleanup = None
    started = time.monotonic()
    with log.open("wb") as destination:
        process = subprocess.Popen(
            command,
            cwd=source,
            stdout=destination,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        try:
            code = process.wait(timeout=300)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(process.pid, signal.SIGTERM)
            try:
                code = process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                code = process.wait()
            try:
                timeout_cleanup = clean_native_after_timeout(output, source)
            except (AssertionError, OSError, ValueError) as error:
                timeout_cleanup = {
                    "status": "CLEANUP_IDENTITY_OR_IO_FAILURE",
                    "error": str(error),
                }
    expected_exit = 1 if variant == "baseline" else 0
    evidence.record(
        "wire-run",
        status="PASS" if code == expected_exit and not timed_out else "FAIL",
        exit_code=code,
        expected_exit_code=expected_exit,
        timed_out=timed_out,
        command=command,
        log=log.name,
        duration_seconds=round(time.monotonic() - started, 2),
        timeout_native_cleanup=timeout_cleanup,
    )
    print(log.read_text(errors="replace")[-12000:], flush=True)

    def verify():
        assert (
            code == expected_exit and not timed_out
        ), "Unexpected actual wire-probe exit"
        result = json.loads((output / "result.json").read_text())
        assert not result.get("harness_error"), result.get("harness_error")
        assert not result.get("cleanup_errors"), result.get("cleanup_errors")
        assert (
            not result["forced_cleanup"] and result["native_exit"] == 0
        ), "Unclean actual native process shutdown"
        assert not result["control_failures"], result["control_failures"]
        assert result["capture_binary_sha256"] == capture_proof["binary_sha256"]
        capture = result["capture_status"]
        assert capture["status"] == "STOPPED" and capture["stop_requested"]
        assert not capture.get("error") and capture["kernel_dropped"] == 0, capture
        assert capture["packets"] > 0, "No actual native datagrams captured"
        failures = set(result["regression_failures"])
        assert failures == (
            EXPECTED_BASELINE_FAILURES if variant == "baseline" else set()
        ), failures
        assert {case["name"] for case in result["cases"]} == EXPECTED_CASES
        assert len(result["cases"]) == len(
            EXPECTED_CASES
        ), "Duplicate or missing wire cases"
        if variant == "baseline":
            for case in result["cases"]:
                if case["name"] in ("full", "rotated_full"):
                    assert (
                        case["responses"] == 0
                    ), "Baseline failure differs from known silent full-cycle defect"
        else:
            for case in result["cases"]:
                assert case["responses"] == case["inclusive_count"], case
        return {
            "variant": variant,
            "actual_probe_exit": code,
            "case_count": len(result["cases"]),
            "control_failures": [],
            "expected_regression_failures": sorted(failures),
            "cases": result["cases"],
            "native_exit": result["native_exit"],
            "raw_udp_sha256": hashlib.sha256(
                (output / "wire.udp").read_bytes()
            ).hexdigest(),
        }

    return evidence.check("wire-oracle", verify)


def clean_native_after_timeout(output: Path, source: Path) -> dict:
    journal = output / "native-process.json"
    if not journal.exists():
        return {"status": "NO_NATIVE_PROCESS_JOURNAL"}
    record = json.loads(journal.read_text())
    pid = record["pid"]
    stat_path = Path(f"/proc/{pid}/stat")
    if not stat_path.exists():
        return {"status": "ALREADY_EXITED", "pid": pid}
    token = stat_path.read_text().rsplit(") ", 1)[1].split()[19]
    command = Path(f"/proc/{pid}/cmdline").read_bytes().split(b"\0")[0].decode()
    expected_binary = str(source / "build/px4_sitl_default/bin/px4")
    assert pid > 1 and record["pgid"] == pid and os.getpgid(pid) == pid
    assert (
        token == record["start_token"]
        and command == expected_binary == record["binary"]
    ), "Do not signal a reused or unrelated PID"
    sent = []
    for number, wait in (
        (signal.SIGINT, 5.0),
        (signal.SIGTERM, 3.0),
        (signal.SIGKILL, 1.0),
    ):
        try:
            os.killpg(pid, number)
        except ProcessLookupError:
            break
        sent.append(number.name)
        deadline = time.monotonic() + wait
        while time.monotonic() < deadline and stat_path.exists():
            # A zombie has no executable work left; the runner's init reaps it.
            state = stat_path.read_text().rsplit(") ", 1)[1].split()[0]
            if state == "Z":
                return {"status": "EXITED_AWAITING_REAP", "pid": pid, "signals": sent}
            time.sleep(0.1)
        if not stat_path.exists():
            break
    return {
        "status": "FORCED_CLEANUP",
        "pid": pid,
        "signals": sent,
        "proc_record_remaining": stat_path.exists(),
    }


def baseline(module, evidence, source: Path, python: str) -> bool:
    if not compile_capture(evidence, source, python):
        return False
    if not evidence.run(
        "sitl-build", ["make", "px4_sitl_default", "-j4"], cwd=source, timeout=2400
    ):
        return False
    dialect = generated_dialect(evidence, source, python)
    return dialect is not None and run_wire(
        evidence, source, dialect, python, "baseline"
    )


def candidate_proof(source: Path) -> dict:
    def git(*args):
        return subprocess.check_output(["git", *args], cwd=source, text=True).strip()

    assert git("rev-parse", "HEAD") == BASE
    assert (
        git("diff", "--name-only") == EVENT_FILE
    ), "Candidate contains unrelated production changes"
    assert git("hash-object", EVENT_FILE) == CANDIDATE_BLOB
    # No source commit/sign-off is created. A temporary index computes the exact
    # expected candidate tree while preserving the checkout's actual index.
    index = source.parent / "event-probe-tree.index"
    assert not index.exists()
    env = os.environ.copy()
    env["GIT_INDEX_FILE"] = str(index)
    try:
        subprocess.run(["git", "read-tree", BASE], cwd=source, env=env, check=True)
        subprocess.run(
            ["git", "add", "--", EVENT_FILE], cwd=source, env=env, check=True
        )
        tree = subprocess.check_output(
            ["git", "write-tree"], cwd=source, env=env, text=True
        ).strip()
        assert tree == CANDIDATE_TREE, "Complete candidate tree differs"
    finally:
        index.unlink(missing_ok=True)
    return {
        "base": BASE,
        "event_blob": CANDIDATE_BLOB,
        "tree": tree,
        "source_sha256": hashlib.sha256((source / EVENT_FILE).read_bytes()).hexdigest(),
        "source_commit_created": False,
        "dco_or_human_review_attested": False,
    }


def candidate(module, evidence, source: Path, python: str) -> bool:
    patch = Path(__file__).with_name("candidate.patch").resolve()

    def apply():
        assert hashlib.sha256(patch.read_bytes()).hexdigest() == PATCH_SHA256
        assert module.source_proof(source)["event_blob"] == BASE_EVENT_BLOB
        subprocess.run(["git", "apply", "--check", str(patch)], cwd=source, check=True)
        subprocess.run(["git", "apply", str(patch)], cwd=source, check=True)
        return candidate_proof(source)

    if not evidence.check("candidate-source", apply):
        return False
    if not evidence.run("format-changed", ["make", "format_changed"], cwd=source):
        return False
    if not evidence.check("post-format-source", lambda: candidate_proof(source)):
        return False
    format_passed = evidence.run("check-format", ["make", "check_format"], cwd=source)
    native_passed = module.native(evidence, source)
    build_passed = evidence.run(
        "sitl-build", ["make", "px4_sitl_default", "-j4"], cwd=source, timeout=2400
    )
    dialect = source / "build/event-probe-dialect/development.py"
    wire_passed = (
        run_wire(evidence, source, dialect, python, "candidate")
        if build_passed
        else False
    )
    final_passed = evidence.check("final-source", lambda: candidate_proof(source))
    return all((format_passed, native_passed, build_passed, wire_passed, final_passed))


def report(module, evidence) -> bool:
    expected = [
        "source",
        "python-version",
        "environment-setup",
        "python-dependencies",
        "python-packages",
        "tool-versions",
        "baseline/capture-inputs",
        "baseline/capture-offline-tests",
        "baseline/capture-build",
        "baseline/capture-proof",
        "baseline/sitl-build",
        "baseline/dialect-generation",
        "baseline/dialect-proof",
        "baseline/capture-identity",
        "baseline/wire-run",
        "baseline/wire-oracle",
        "candidate/candidate-source",
        "candidate/format-changed",
        "candidate/post-format-source",
        "candidate/check-format",
        "candidate/native-tests",
        "candidate/native-counts",
        "candidate/sitl-build",
        "candidate/capture-identity",
        "candidate/wire-run",
        "candidate/wire-oracle",
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
            "NATIVE_WIRE_CHECKS_PASSED" if passed else "NATIVE_WIRE_CHECKS_INCOMPLETE"
        ),
        "base": BASE,
        "candidate_blob": CANDIDATE_BLOB,
        "candidate_tree": CANDIDATE_TREE,
        "patch_sha256": PATCH_SHA256,
        "source_submission": "NOT_PERFORMED",
        "stages": stages,
        "limits": [
            "Actual disarmed native SIH/loopback MAVLink; no physical vehicle or flight",
            "Complete finite wire coverage is required; transport drops/control failures are not waived",
            "Full/near-full receiver latency is measured; workload acceptance remains an upstream review question",
            "Unchanged baseline native suite is not rerun; separate exact-source capability evidence applies",
            "Affected firmware-board build, clang-tidy/full CI, human review/DCO and upstream submission remain unrun",
        ],
    }
    (evidence.directory / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    summary = (
        "\n".join(
            [
                "## PX4 event-range native wire evidence",
                "",
                f"Result: **{result['status']}**",
                "",
                "No new PX4 source commit, DCO attestation or upstream submission.",
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
    module = load_capability()
    source = args.source.resolve()
    evidence = module.Evidence(args.evidence)
    phases = {
        "prepare": lambda: module.prepare(evidence, source),
        "setup": lambda: module.setup(evidence, source, args.python),
        "baseline": lambda: baseline(
            module,
            module.Evidence(evidence.directory / "baseline"),
            source,
            args.python,
        ),
        "candidate": lambda: candidate(
            module,
            module.Evidence(evidence.directory / "candidate"),
            source,
            args.python,
        ),
        "report": lambda: report(module, evidence),
    }
    return 0 if phases[args.phase]() else 1


if __name__ == "__main__":
    raise SystemExit(main())
