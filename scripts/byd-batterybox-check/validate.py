"""Validate the immutable BatteryBox label candidate without hardware access."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET


BASE = "2cc576278e05b7bb1778f1a50246b8072dc77883"
REPOSITORY = "https://github.com/TimWeyand/byd_battery_box.git"
PATCH_SHA256 = "588b81acaef434a4662ba030f59d7def6ca78a466b23cc4c6c80673d2c4daa12"
FILES = {
    "custom_components/byd_battery_box/bydboxclient.py": "44502ee30383dcd0a5ff4b6264584e0899ad9e8b",
    "tests/test_balancing_module_labels.py": "c25288ba57f540a5d55248ba65730e8da359121b",
}
HASSFEST_IMAGE = (
    "ghcr.io/home-assistant/hassfest@"
    "sha256:e2576d17e5af7a99c7b91ab852467914b330d63d4c092df27105e5a0c6540bfc"
)
CANDIDATE_REPOSITORY = "timothyanderson096-ocdealcheck/byd_battery_box"
# The public fork's reviewed, immutable two-file candidate commit.
CANDIDATE_SHA = "d812e7bd22cc2aefa18614b31aba48276e496565"
HACS_IMAGE = (
    "ghcr.io/hacs/action@"
    "sha256:35241cb9a8ce6a83f3fbe893880283419c59bea26e71d4c99e279856518bde25"
)
EXPECTED = (
    "source", "native-version", "venv", "install", "dependency-check", "packages",
    "runtime-versions", "regression", "regression-count", "ruff", "compile-version",
    "compile", "docker-probe", "hassfest-pull", "hassfest-image", "hassfest",
    "hacs-target", "hacs-pull", "hacs-image", "hacs",
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
        except Exception as error:  # Preserve the failed assertion, then report failure.
            self.record(stage, status="FAIL", exit_code=getattr(error, "returncode", None), error=str(error))
            print(f"{stage}: FAIL: {error}", flush=True)
            return False
        self.record(stage, status="PASS", exit_code=0, **details)
        print(f"{stage}: PASS", flush=True)
        return True

    def run(self, stage: str, command: list[str], *, cwd: Path | None = None,
            env: dict | None = None, timeout: int = 600) -> bool:
        log = self.directory / f"{stage}.log"
        started = time.monotonic()
        timed_out = False
        code = None
        error = None
        with log.open("wb") as output:
            try:
                process = subprocess.Popen(command, cwd=cwd, env=env, stdout=output,
                                           stderr=subprocess.STDOUT, start_new_session=True)
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
                output.write((error + "\n").encode())
        result = {
            "status": "PASS" if code == 0 and not timed_out else "FAIL",
            "exit_code": code,
            "timed_out": timed_out,
            "duration_seconds": round(time.monotonic() - started, 2),
            "command": command,
            "log": log.name,
        }
        if error is not None:
            result["error"] = error
        self.record(stage, **result)
        print(log.read_text(encoding="utf-8", errors="replace"), end="", flush=True)
        print(f"{stage}: {result['status']} (actual exit code {code})", flush=True)
        return result["status"] == "PASS"


def output(command: list[str], cwd: Path) -> str:
    return subprocess.check_output(command, cwd=cwd, text=True).strip()


def prepare(evidence: Evidence, source: Path) -> bool:
    patch = Path(__file__).with_name("candidate.patch")

    def restore():
        assert hashlib.sha256(patch.read_bytes()).hexdigest() == PATCH_SHA256, "Patch SHA256 mismatch"
        assert not source.exists(), "Source directory must be new"
        subprocess.run(["git", "clone", "--quiet", REPOSITORY, str(source)], check=True)
        subprocess.run(["git", "checkout", "--quiet", "--detach", BASE], cwd=source, check=True)
        assert output(["git", "rev-parse", "HEAD"], source) == BASE, "Source base mismatch"
        subprocess.run(["git", "apply", "--check", str(patch)], cwd=source, check=True)
        subprocess.run(["git", "apply", str(patch)], cwd=source, check=True)
        files = {}
        for name, expected in FILES.items():
            actual = output(["git", "hash-object", name], source)
            assert actual == expected, f"Candidate blob mismatch: {name}"
            files[name] = {"git_blob": actual, "sha256": hashlib.sha256((source / name).read_bytes()).hexdigest()}
        subprocess.run(["git", "diff", "--check"], cwd=source, check=True)
        return {"repository": REPOSITORY, "base": BASE, "patch_sha256": PATCH_SHA256,
                "candidate_files": files, "hardware_io": False}

    return evidence.check("source", restore)


def native(evidence: Evidence, source: Path, python: str) -> bool:
    if not evidence.run("native-version", [python, "-c", "import sys; assert sys.version_info[:3] == (3, 14, 8); print(sys.version)"]):
        return False
    venv = source.parent / "batterybox-venv"
    if not evidence.run("venv", [python, "-m", "venv", str(venv)]):
        return False
    runtime = str(venv / "bin/python")
    if not evidence.run("install", [runtime, "-m", "pip", "install", "homeassistant==2026.10.2",
                                     "pymodbus==3.13.1", "pytest==9.2.0", "pytest-asyncio==1.4.0",
                                     "ruff==0.17.3"], timeout=900):
        return False
    results = [evidence.run("dependency-check", [runtime, "-m", "pip", "check"])]
    results.append(evidence.run("packages", [runtime, "-m", "pip", "freeze"]))
    results.append(evidence.run("runtime-versions", [runtime, "-c",
        "from importlib.metadata import version; "
        "expected={'homeassistant':'2026.10.2','pymodbus':'3.13.1','pytest':'9.2.0','pytest-asyncio':'1.4.0','ruff':'0.17.3'}; "
        "actual={name:version(name) for name in expected}; print(actual); assert actual == expected"]))
    env = os.environ.copy()
    env["PYTHONPATH"] = str(source)
    junit = evidence.directory / "regression.xml"
    results.append(evidence.run("regression", [runtime, "-m", "pytest", "-q",
        "-o", "asyncio_default_fixture_loop_scope=function", "--junitxml", str(junit),
        "tests/test_balancing_module_labels.py"], cwd=source, env=env))

    def verify_count():
        suites = ET.parse(junit).getroot()
        cases = list(suites.iter("testcase"))
        assert len(cases) == 7, f"Expected exactly 7 regressions, got {len(cases)}"
        for kind in ("failure", "error", "skipped"):
            assert not list(suites.iter(kind)), f"Regression report contains {kind}"
        return {"tests": len(cases), "failures": 0, "errors": 0, "skipped": 0}

    results.append(evidence.check("regression-count", verify_count))
    results.append(evidence.run("ruff", [runtime, "-m", "ruff", "check", "custom_components/",
                                         "tests/test_balancing_module_labels.py"], cwd=source))
    return all(results)


def compile_source(evidence: Evidence, source: Path, python: str) -> bool:
    if not evidence.run("compile-version", [python, "-c", "import sys; assert sys.version_info[:3] == (3, 12, 14); print(sys.version)"]):
        return False
    files = sorted(str(path) for path in (source / "custom_components/byd_battery_box").glob("*.py"))
    files.append(str(source / "tests/test_balancing_module_labels.py"))
    return evidence.run("compile", [python, "-m", "py_compile", *files], cwd=source)


def hassfest(evidence: Evidence, source: Path) -> bool:
    # Both commands contact the real runner daemon; no mocked socket or privileged container.
    if not evidence.run("docker-probe", ["docker", "info"], timeout=60):
        return False
    if not evidence.run("hassfest-pull", ["docker", "pull", "--platform", "linux/amd64", HASSFEST_IMAGE], timeout=600):
        return False
    if not evidence.run("hassfest-image", ["docker", "image", "inspect", HASSFEST_IMAGE], timeout=60):
        return False
    # Preserve the image's normal entrypoint and full candidate workspace.
    return evidence.run("hassfest", ["docker", "run", "--rm", "--platform", "linux/amd64",
        "--mount", f"type=bind,source={source},target=/github/workspace",
        "--workdir", "/github/workspace", HASSFEST_IMAGE], timeout=900)


def github_resource(path: str, token: str) -> dict:
    url = f"https://api.github.com/repos/{CANDIDATE_REPOSITORY}"
    if path:
        url += f"/{path}"
    request = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "BatteryBox-candidate-validation"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise ValueError(f"GitHub API GET {url} failed with HTTP {error.code}") from error


def verify_hacs_target(evidence: Evidence, source: Path, token: str) -> bool:
    def verify():
        if len(CANDIDATE_SHA) != 40 or any(letter not in "0123456789abcdef" for letter in CANDIDATE_SHA):
            raise ValueError("An exact reviewed public candidate commit must be pinned before validation")
        if not token:
            raise ValueError("Read-only GitHub token is required")
        repository = github_resource("", token)
        if repository.get("full_name") != CANDIDATE_REPOSITORY or repository.get("private") is not False:
            raise ValueError("The candidate target must be the actual public BatteryBox fork")
        if repository.get("fork") is not True or repository.get("parent", {}).get("full_name") != "TimWeyand/byd_battery_box":
            raise ValueError("Candidate repository is not the expected proper GitHub fork")
        commit = github_resource(f"git/commits/{CANDIDATE_SHA}", token)
        if commit.get("sha") != CANDIDATE_SHA or [parent["sha"] for parent in commit.get("parents", [])] != [BASE]:
            raise ValueError("Candidate commit does not have the exact reviewed source base")
        # Build the expected complete tree with an isolated index. This includes
        # the added test and proves the public ref matches this exact patch.
        with tempfile.TemporaryDirectory(prefix="batterybox-index-") as directory:
            env = os.environ.copy()
            env["GIT_INDEX_FILE"] = str(Path(directory) / "index")
            subprocess.run(["git", "read-tree", BASE], cwd=source, env=env, check=True)
            subprocess.run(["git", "add", "--", *FILES], cwd=source, env=env, check=True)
            expected_tree = subprocess.check_output(["git", "write-tree"], cwd=source, env=env, text=True).strip()
        if commit.get("tree", {}).get("sha") != expected_tree:
            raise ValueError("Public candidate tree differs from the complete reviewed base plus immutable patch")
        return {"repository": CANDIDATE_REPOSITORY, "candidate_sha": CANDIDATE_SHA,
                "parent_sha": BASE, "tree_sha": expected_tree, "public": True, "proper_fork": True,
                "metadata": {"description": repository.get("description"),
                             "archived": repository.get("archived"),
                             "has_issues": repository.get("has_issues"),
                             "license": repository.get("license"), "topics": repository.get("topics")}}

    return evidence.check("hacs-target", verify)


def hacs(evidence: Evidence, source: Path) -> bool:
    token = os.environ.get("BYD_HACS_TOKEN", "")
    if not verify_hacs_target(evidence, source, token):
        return False
    if not evidence.run("hacs-pull", ["docker", "pull", "--platform", "linux/amd64", HACS_IMAGE], timeout=600):
        return False
    if not evidence.run("hacs-image", ["docker", "image", "inspect", HACS_IMAGE], timeout=60):
        return False
    env = os.environ.copy()
    env.update({"INPUT_GITHUB_TOKEN": token, "INPUT_REPOSITORY": CANDIDATE_REPOSITORY,
                "GITHUB_REPOSITORY": CANDIDATE_REPOSITORY, "REPOSITORY_REF": CANDIDATE_SHA,
                "INPUT_CATEGORY": "integration", "INPUT_COMMENT": "false"})
    # Only names appear in the command record. The token is inherited for this
    # subprocess, never placed in argv, logs, source records or artifacts.
    command = ["docker", "run", "--rm", "--platform", "linux/amd64"]
    for name in ("INPUT_GITHUB_TOKEN", "INPUT_REPOSITORY", "GITHUB_REPOSITORY",
                 "REPOSITORY_REF", "INPUT_CATEGORY", "INPUT_COMMENT"):
        command.extend(["--env", name])
    command.append(HACS_IMAGE)
    return evidence.run("hacs", command, env=env, timeout=900)


def report(evidence: Evidence) -> bool:
    stages = {}
    for stage in EXPECTED:
        path = evidence.directory / f"{stage}.json"
        stages[stage] = json.loads(path.read_text()) if path.exists() else {
            "stage": stage, "status": "NOT_RUN", "exit_code": None,
        }
    passed = all(result["status"] == "PASS" for result in stages.values())
    result = {"status": "MANDATORY_GATES_PASSED" if passed else "MANDATORY_GATES_INCOMPLETE",
              "mandatory_project_gates": "PASS" if passed else "INCOMPLETE",
              "hacs": stages["hacs"]["status"],
              "submission_status": "VALIDATED_FOR_REVIEW" if passed else "PREPARED_ONLY_REQUIRED_GATES_PENDING",
              "base": BASE, "patch_sha256": PATCH_SHA256,
              "candidate_repository": CANDIDATE_REPOSITORY, "candidate_sha": CANDIDATE_SHA,
              "validation_runner_repository": os.environ.get("GITHUB_REPOSITORY"),
              "hassfest_image": HASSFEST_IMAGE, "hacs_image": HACS_IMAGE, "stages": stages,
              "limits": ["Synthetic data-only regressions; no configured HA lifecycle or physical battery",
                         "client_test.py is never collected or executed",
                         "Informational mypy and Bandit checks are not included in this scoped job"]}
    write_json(evidence.directory / "result.json", result)
    lines = ["## BatteryBox mandatory candidate gates", "",
             f"Result: **{result['status']}**", "",
             f"Public candidate: `{CANDIDATE_REPOSITORY}@{CANDIDATE_SHA}`", "",
             f"Required HACS candidate gate: **{result['hacs']}**", "",
             "A pass covers required lint, compile, HACS and hassfest gates plus seven native regressions.",
             "Physical battery validation and configured HA lifecycle are outside this synthetic regression job.", "",
             "| Check | Result | Actual exit code |", "| --- | --- | --- |"]
    lines += [f"| {name} | {record['status']} | {record['exit_code']} |" for name, record in stages.items()]
    summary = "\n".join(lines) + "\n"
    (evidence.directory / "summary.md").write_text(summary, encoding="utf-8")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as destination:
            destination.write(summary)
    print(summary)
    return passed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("prepare", "native", "compile", "hassfest", "hacs", "report"))
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--evidence", required=True, type=Path)
    parser.add_argument("--python", default=sys.executable)
    args = parser.parse_args()
    evidence = Evidence(args.evidence)
    source = args.source.resolve()
    operations = {"prepare": lambda: prepare(evidence, source),
                  "native": lambda: native(evidence, source, args.python),
                  "compile": lambda: compile_source(evidence, source, args.python),
                  "hassfest": lambda: hassfest(evidence, source),
                  "hacs": lambda: hacs(evidence, source),
                  "report": lambda: report(evidence)}
    return 0 if operations[args.phase]() else 1


if __name__ == "__main__":
    raise SystemExit(main())
