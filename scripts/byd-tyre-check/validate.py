"""Validate the frozen tyre-warning candidate with real HA and synthetic cloud reads."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

BASE = "e8d660b67c51dd848a15b8410618927a04993fb8"
REPOSITORY = "https://github.com/jkaberg/hass-byd-vehicle.git"
PATCH_SHA256 = "a2ba942eca0b5a8432d2b58819c48169978f2f89bbee0c237c0d7e9288090700"
FILES = {
    "custom_components/byd_vehicle/binary_sensor.py": "741b1d2a8185b38f5ccf692ce0f86cf5f9592148",
    "tests/test_tpms_replay.py": "aad30769274e7a0427744b2640209ae154c888e1",
    "tests/test_configured_tpms.py": "7501ce40a54fcb88b28aa7b95696782c0db53557",
    "tests/test_tpms_started.py": "eff5cde5b2dc63927b87c3b5d0cea4b9338464f8",
}
CANDIDATE_REPOSITORY = "timothyanderson096-ocdealcheck/hass-byd-vehicle"
CANDIDATE_SHA = "8f4abddeedadf23b2831a40ee55c0dd9088844d3"
HASSFEST_IMAGE = (
    "ghcr.io/home-assistant/hassfest@"
    "sha256:e2576d17e5af7a99c7b91ab852467914b330d63d4c092df27105e5a0c6540bfc"
)
HACS_IMAGE = (
    "ghcr.io/hacs/action@"
    "sha256:35241cb9a8ce6a83f3fbe893880283419c59bea26e71d4c99e279856518bde25"
)
RUNTIME_PACKAGES = {
    "homeassistant": "2026.10.2",
    "pybyd": "0.0.79",
    "pytest": "9.2.0",
    "pytest-asyncio": "1.4.0",
}
LINT_PACKAGES = {"ruff": "0.17.3", "black": "26.10.1", "mypy": "2.4.1"}
SUITES = {
    "native": ("tests/test_tpms_replay.py", 14),
    "configured": ("tests/test_configured_tpms.py", 3),
    "started": ("tests/test_tpms_started.py", 1),
    "existing": ("tests/test_legacy_consumption_sensors.py", 8),
}
# Exact expected failing cases/messages distinguish the defect from fixture failures.
BASELINE_FAILURES = {
    "native": {
        **{
            f"test_fault_clears_and_recurs[{corner}]": "AssertionError: assert 'on' == 'off'"
            for corner in (
                "left_front_tire_status",
                "right_front_tire_status",
                "left_rear_tire_status",
                "right_rear_tire_status",
            )
        },
        "test_initial_fault_clears": "AssertionError: assert 'unknown' == 'off'",
        "test_history_is_per_vehicle": "AssertionError: assert 'on' == 'off'",
        "test_restore_and_reload[partial]": "AssertionError: assert 'on' == 'off'",
        "test_restore_and_reload[healthy]": "AssertionError: assert 'on' == 'off'",
    },
    "configured": {
        "test_configured_all_wheels_and_other_vehicle": "AssertionError: assert ['on', 'on', 'off', 'on'] == ['off', 'off', 'off', 'off']",
        "test_configured_reload_and_partial": "AssertionError: assert 'on' == 'off'",
        "test_configured_startup_fault_first_healthy[True]": "AssertionError: assert 'unknown' == 'off'",
    },
    "started": {
        "test_started_service_warning_clears": "AssertionError: assert ['on', 'off', 'off', 'off'] == ['off', 'off', 'off', 'off']",
    },
    "existing": {},
}
EXPECTED = (
    "source",
    "native-version",
    "native-venv",
    "native-install",
    "native-dependencies",
    "native-packages",
    "native-pins",
    *(
        f"{variant}-{suite}{suffix}"
        for variant in ("baseline", "candidate")
        for suite in SUITES
        for suffix in ("", "-counts")
    ),
    "lint-version",
    "lint-venv",
    "lint-install",
    "lint-dependencies",
    "lint-packages",
    "lint-pins",
    "ruff",
    "black",
    "fixture-ruff",
    "fixture-black",
    "mypy",
    "docker-probe",
    "hassfest-pull",
    "hassfest-image",
    "hassfest",
    "hacs-target",
    "hacs-pull",
    "hacs-image",
    "hacs",
)


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


class Evidence:
    def __init__(self, directory: Path):
        self.directory = directory.resolve()
        self.directory.mkdir(parents=True, exist_ok=True)

    def record(self, stage: str, **result) -> None:
        write_json(self.directory / f"{stage}.json", {"stage": stage, **result})

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
        timeout: int = 600,
        expected_exit: int = 0,
    ) -> bool:
        log = self.directory / f"{stage}.log"
        started = time.monotonic()
        timed_out = False
        code = None
        error = None
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
            except OSError as exception:
                error = str(exception)
                destination.write((error + "\n").encode())
        passed = code == expected_exit and not timed_out
        record = {
            "status": "PASS" if passed else "FAIL",
            "exit_code": code,
            "expected_exit_code": expected_exit,
            "timed_out": timed_out,
            "duration_seconds": round(time.monotonic() - started, 2),
            "command": command,
            "log": log.name,
        }
        if error is not None:
            record["error"] = error
        self.record(stage, **record)
        # Full synthetic DEBUG output stays in the artifact, rather than duplicating it.
        print(
            f"{stage}: {record['status']} (actual exit {code}; expected {expected_exit}); {log}",
            flush=True,
        )
        if not passed:
            print(
                log.read_text(encoding="utf-8", errors="replace")[-12000:], flush=True
            )
        return passed


def output(command: list[str], source: Path, env: dict | None = None) -> str:
    return subprocess.check_output(command, cwd=source, env=env, text=True).strip()


def expected_tree(source: Path) -> str:
    with tempfile.TemporaryDirectory(prefix="tyre-index-") as directory:
        env = os.environ.copy()
        env["GIT_INDEX_FILE"] = str(Path(directory) / "index")
        subprocess.run(["git", "read-tree", BASE], cwd=source, env=env, check=True)
        # Upstream ignores tests/, so explicitly add only the reviewed files.
        subprocess.run(
            ["git", "add", "--force", "--", *FILES], cwd=source, env=env, check=True
        )
        return output(["git", "write-tree"], source, env)


def prepare(evidence: Evidence, source: Path) -> bool:
    bundle = Path(__file__).resolve().parent
    patch = bundle / "candidate.patch"

    def restore():
        assert (
            hashlib.sha256(patch.read_bytes()).hexdigest() == PATCH_SHA256
        ), "Patch SHA256 mismatch"
        assert not source.exists(), "Source root must be new"
        source.mkdir(parents=True)
        candidate = source / "candidate"
        baseline = source / "baseline"
        subprocess.run(
            ["git", "clone", "--quiet", REPOSITORY, str(candidate)], check=True
        )
        subprocess.run(
            ["git", "checkout", "--quiet", "--detach", BASE], cwd=candidate, check=True
        )
        assert output(["git", "rev-parse", "HEAD"], candidate) == BASE
        subprocess.run(
            ["git", "worktree", "add", "--quiet", "--detach", str(baseline), BASE],
            cwd=candidate,
            check=True,
        )
        subprocess.run(
            ["git", "apply", "--check", str(patch)], cwd=candidate, check=True
        )
        subprocess.run(["git", "apply", str(patch)], cwd=candidate, check=True)
        files = {}
        for name, blob in FILES.items():
            if name.startswith("tests/"):
                for checkout in (baseline, candidate):
                    shutil.copyfile(bundle / name, checkout / name)
            actual = output(["git", "hash-object", name], candidate)
            assert actual == blob, f"Candidate blob mismatch: {name}"
            files[name] = {
                "git_blob": actual,
                "sha256": hashlib.sha256((candidate / name).read_bytes()).hexdigest(),
            }
        subprocess.run(["git", "diff", "--check"], cwd=candidate, check=True)
        assert (
            output(["git", "diff", "--name-only"], baseline) == ""
        ), "Baseline production was modified"
        return {
            "repository": REPOSITORY,
            "base": BASE,
            "patch_sha256": PATCH_SHA256,
            "candidate_tree": expected_tree(candidate),
            "candidate_files": files,
            "cloud_io": False,
            "physical_vehicle": False,
        }

    return evidence.check("source", restore)


def versions(pins: dict) -> str:
    return (
        "from importlib.metadata import version; "
        f"expected={pins!r}; actual={{name:version(name) for name in expected}}; "
        "print(actual); assert actual == expected"
    )


def runtime_environment(
    evidence: Evidence, source: Path, python: str, name: str, version: tuple, pins: dict
) -> str | None:
    if not evidence.run(
        f"{name}-version",
        [
            python,
            "-c",
            f"import sys; print(sys.version); assert sys.version_info[:3] == {version!r}",
        ],
    ):
        return None
    venv = source / f"{name}-venv"
    if not evidence.run(f"{name}-venv", [python, "-m", "venv", str(venv)]):
        return None
    runtime = str(venv / "bin/python")
    if not evidence.run(
        f"{name}-install",
        [
            runtime,
            "-m",
            "pip",
            "install",
            *(f"{package}=={pin}" for package, pin in pins.items()),
        ],
        timeout=900,
    ):
        return None
    results = [
        evidence.run(f"{name}-dependencies", [runtime, "-m", "pip", "check"]),
        evidence.run(f"{name}-packages", [runtime, "-m", "pip", "freeze"]),
        evidence.run(f"{name}-pins", [runtime, "-c", versions(pins)]),
    ]
    return runtime if all(results) else None


def verify_counts(
    evidence: Evidence, stage: str, junit: Path, suite: str, variant: str
) -> bool:
    def verify():
        tree = ET.parse(junit).getroot()
        cases = list(tree.iter("testcase"))
        assert len(cases) == SUITES[suite][1], "Unexpected case count"
        assert not list(tree.iter("error")), "Fixture/setup/collection error"
        assert not list(tree.iter("skipped")), "Skipped test"
        failures = {
            case.attrib["name"]: case.find("failure").attrib["message"].splitlines()[0]
            for case in cases
            if case.find("failure") is not None
        }
        expected = BASELINE_FAILURES[suite] if variant == "baseline" else {}
        assert failures == expected, f"Unexpected behavioral failure(s): {failures!r}"
        return {
            "tests": len(cases),
            "failures": len(failures),
            "errors": 0,
            "skipped": 0,
            "passes": len(cases) - len(failures),
            "expected_failure_messages": failures,
        }

    return evidence.check(f"{stage}-counts", verify)


def native(evidence: Evidence, source: Path, python: str) -> bool:
    runtime = runtime_environment(
        evidence, source, python, "native", (3, 14, 8), RUNTIME_PACKAGES
    )
    if runtime is None:
        return False
    results = []
    for variant in ("baseline", "candidate"):
        checkout = source / variant
        env = os.environ.copy()
        env["PYTHONPATH"] = str(checkout)
        for suite, (file, _count) in SUITES.items():
            stage = f"{variant}-{suite}"
            junit = evidence.directory / f"{stage}.xml"
            expected_exit = int(
                variant == "baseline" and bool(BASELINE_FAILURES[suite])
            )
            results.append(
                evidence.run(
                    stage,
                    [
                        runtime,
                        "-m",
                        "pytest",
                        "-q",
                        "-s",
                        "-o",
                        "asyncio_default_fixture_loop_scope=function",
                        "--log-cli-level=DEBUG",
                        "--junitxml",
                        str(junit),
                        file,
                    ],
                    cwd=checkout,
                    env=env,
                    expected_exit=expected_exit,
                )
            )
            results.append(verify_counts(evidence, stage, junit, suite, variant))
    return all(results)


def lint(evidence: Evidence, source: Path, python: str) -> bool:
    # The project's actual workflow installs only these tools on Python 3.11.
    # Running mypy inside a HA runtime resolves a different dependency/type graph.
    runtime = runtime_environment(
        evidence, source, python, "lint", (3, 11, 15), LINT_PACKAGES
    )
    if runtime is None:
        return False
    env = os.environ.copy()
    env["BLACK_NUM_WORKERS"] = "1"
    checkout = source / "candidate"
    results = [
        evidence.run(
            "ruff", [runtime, "-m", "ruff", "check", "."], cwd=checkout, env=env
        ),
        evidence.run(
            "black", [runtime, "-m", "black", "--check", "."], cwd=checkout, env=env
        ),
        evidence.run("mypy", [runtime, "-m", "mypy", "."], cwd=checkout, env=env),
    ]
    fixtures = [file for file in FILES if file.startswith("tests/")]
    results.append(
        evidence.run(
            "fixture-ruff",
            [runtime, "-m", "ruff", "check", *fixtures],
            cwd=checkout,
            env=env,
        )
    )
    results.append(
        evidence.run(
            "fixture-black",
            [runtime, "-m", "black", "--check", *fixtures],
            cwd=checkout,
            env=env,
        )
    )
    return all(results)


def hassfest(evidence: Evidence, source: Path) -> bool:
    if not evidence.run("docker-probe", ["docker", "info"], timeout=60):
        return False
    if not evidence.run(
        "hassfest-pull", ["docker", "pull", "--platform", "linux/amd64", HASSFEST_IMAGE]
    ):
        return False
    if not evidence.run(
        "hassfest-image", ["docker", "image", "inspect", HASSFEST_IMAGE], timeout=60
    ):
        return False
    return evidence.run(
        "hassfest",
        [
            "docker",
            "run",
            "--rm",
            "--platform",
            "linux/amd64",
            "--mount",
            f"type=bind,source={source / 'candidate'},target=/github/workspace",
            "--workdir",
            "/github/workspace",
            HASSFEST_IMAGE,
        ],
        timeout=900,
    )


def github_resource(path: str, token: str) -> dict:
    url = f"https://api.github.com/repos/{CANDIDATE_REPOSITORY}"
    if path:
        url += f"/{path}"
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "BYD-tyre-candidate-validation",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def verify_hacs_target(evidence: Evidence, source: Path, token: str) -> bool:
    def verify():
        assert len(CANDIDATE_SHA) == 40 and all(
            c in "0123456789abcdef" for c in CANDIDATE_SHA
        ), "Pin the exact reviewed public candidate SHA"
        assert token, "Read-only GitHub token required"
        repository = github_resource("", token)
        assert (
            repository.get("full_name") == CANDIDATE_REPOSITORY
            and repository.get("private") is False
        )
        assert (
            repository.get("fork") is True
            and repository.get("parent", {}).get("full_name")
            == "jkaberg/hass-byd-vehicle"
        ), "Expected proper public integration fork"
        commit = github_resource(f"git/commits/{CANDIDATE_SHA}", token)
        assert commit.get("sha") == CANDIDATE_SHA
        assert [p["sha"] for p in commit.get("parents", [])] == [
            BASE
        ], "Candidate base differs"
        tree = expected_tree(source / "candidate")
        assert (
            commit.get("tree", {}).get("sha") == tree
        ), "Complete public candidate tree differs from reviewed source"
        return {
            "repository": CANDIDATE_REPOSITORY,
            "candidate_sha": CANDIDATE_SHA,
            "parent_sha": BASE,
            "tree_sha": tree,
            "public": True,
            "proper_fork": True,
            "metadata": {
                key: repository.get(key)
                for key in (
                    "description",
                    "archived",
                    "has_issues",
                    "license",
                    "topics",
                )
            },
        }

    return evidence.check("hacs-target", verify)


def hacs(evidence: Evidence, source: Path) -> bool:
    token = os.environ.get("BYD_HACS_TOKEN", "")
    if not verify_hacs_target(evidence, source, token):
        return False
    if not evidence.run(
        "hacs-pull", ["docker", "pull", "--platform", "linux/amd64", HACS_IMAGE]
    ):
        return False
    if not evidence.run(
        "hacs-image", ["docker", "image", "inspect", HACS_IMAGE], timeout=60
    ):
        return False
    env = os.environ.copy()
    env.update(
        {
            "INPUT_GITHUB_TOKEN": token,
            "INPUT_REPOSITORY": CANDIDATE_REPOSITORY,
            "GITHUB_REPOSITORY": CANDIDATE_REPOSITORY,
            "REPOSITORY_REF": CANDIDATE_SHA,
            "INPUT_CATEGORY": "integration",
            "INPUT_COMMENT": "false",
        }
    )
    command = ["docker", "run", "--rm", "--platform", "linux/amd64"]
    # Inherit token by name only. It never appears in recorded argv or artifacts.
    for name in (
        "INPUT_GITHUB_TOKEN",
        "INPUT_REPOSITORY",
        "GITHUB_REPOSITORY",
        "REPOSITORY_REF",
        "INPUT_CATEGORY",
        "INPUT_COMMENT",
    ):
        command.extend(["--env", name])
    command.append(HACS_IMAGE)
    return evidence.run("hacs", command, env=env, timeout=900)


def report(evidence: Evidence) -> bool:
    stages = {}
    for stage in EXPECTED:
        path = evidence.directory / f"{stage}.json"
        stages[stage] = (
            json.loads(path.read_text())
            if path.exists()
            else {"stage": stage, "status": "NOT_RUN", "exit_code": None}
        )
    passed = all(record["status"] == "PASS" for record in stages.values())
    result = {
        "status": "CANDIDATE_GATES_PASSED" if passed else "CANDIDATE_GATES_INCOMPLETE",
        "base": BASE,
        "patch_sha256": PATCH_SHA256,
        "candidate_repository": CANDIDATE_REPOSITORY,
        "candidate_sha": CANDIDATE_SHA,
        "runner_repository": os.environ.get("GITHUB_REPOSITORY"),
        "hassfest_image": HASSFEST_IMAGE,
        "hacs_image": HACS_IMAGE,
        "stages": stages,
        "limits": [
            "Synthetic BYD authentication/read endpoints and HTTP session factory; no real cloud or vehicle",
            "Real HA core startup occurs after configured entry setup; no frontend/HTTP server or config UI",
            "No long-duration scheduled polling, MQTT or encrypted manufacturer transport validation",
            "Baseline pytest exit 1 is expected only with exact listed defect failure messages; all setup errors fail validation",
            "Passing this job proposes evidence for review; maintainer acceptance is separate",
        ],
    }
    write_json(evidence.directory / "result.json", result)
    lines = [
        "## BYD tyre-warning candidate checks",
        "",
        f"Result: **{result['status']}**",
        "",
        f"Public candidate: `{CANDIDATE_REPOSITORY}@{CANDIDATE_SHA}`",
        "",
        "Four suites run per revision: 14 isolated, 3 configured, 1 real-core-startup and 8 existing tests.",
        "Baseline intentionally reproduces 12 assertion failures; candidate requires all 26 tests passing.",
        "HA core, entry setup, services and states are real; BYD cloud/session inputs are synthetic. No vehicle, frontend or cloud claim.",
        "",
        "| Check | Result | Actual exit |",
        "| --- | --- | --- |",
    ]
    lines += [
        f"| {name} | {record['status']} | {record['exit_code']} |"
        for name, record in stages.items()
    ]
    summary = "\n".join(lines) + "\n"
    (evidence.directory / "summary.md").write_text(summary, encoding="utf-8")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(
            os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8"
        ) as destination:
            destination.write(summary)
    print(summary)
    return passed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "phase", choices=("prepare", "native", "lint", "hassfest", "hacs", "report")
    )
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--evidence", required=True, type=Path)
    parser.add_argument("--python", default=sys.executable)
    args = parser.parse_args()
    evidence = Evidence(args.evidence)
    source = args.source.resolve()
    operations = {
        "prepare": lambda: prepare(evidence, source),
        "native": lambda: native(evidence, source, args.python),
        "lint": lambda: lint(evidence, source, args.python),
        "hassfest": lambda: hassfest(evidence, source),
        "hacs": lambda: hacs(evidence, source),
        "report": lambda: report(evidence),
    }
    return 0 if operations[args.phase]() else 1


if __name__ == "__main__":
    raise SystemExit(main())
