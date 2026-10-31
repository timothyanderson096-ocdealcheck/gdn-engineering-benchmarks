"""Validate exact named DR11 diagnostic outcomes against the frozen contract."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def validate(expectations: dict, snapshot: str, directory: Path) -> dict:
    expected = expectations["snapshots"][snapshot]
    manifest = json.loads((directory / "MANIFEST.json").read_text())
    for field in ("source_git_blob", "compile_exit", "run_exit", "observations"):
        if manifest.get(field) != expected[field]:
            raise ValueError(f"{snapshot}: manifest {field} differs from exact expectation")
    for field, filename in (("runner_sha256", "run_probe.py"), ("template_sha256", "probe.cpp.in")):
        if manifest.get(field) != expectations["frozen_fixture"][filename]:
            raise ValueError(f"{snapshot}: unfrozen diagnostic {filename}")
    if set(manifest.get("methods_sha256", {})) != set(expectations["required_methods"]):
        raise ValueError(f"{snapshot}: missing or extra production method extraction")
    generated = directory / "probe.cpp"
    if hashlib.sha256(generated.read_bytes()).hexdigest() != manifest.get("generated_sha256"):
        raise ValueError(f"{snapshot}: generated source does not match manifest")

    lines = [line for line in (directory / "run.log").read_text().splitlines() if line]
    assertions = []
    counterexamples = []
    summaries = []
    for line in lines:
        if line.startswith(("PASS ", "FAIL ")):
            assertions.append(tuple(line.split(" ", 1)))
        elif line.startswith("COUNTEREXAMPLE "):
            counterexamples.append(line)
        elif line.startswith("RESULT "):
            summaries.append(json.loads(line[len("RESULT "):]))
        else:
            raise ValueError(f"{snapshot}: unrecognized diagnostic output: {line}")
    required = [(row["expected"][snapshot], row["name"]) for row in expectations["assertions"]]
    if len(required) != expectations["total_assertions"] or len(set(name for _, name in required)) != len(required):
        raise ValueError("Invalid frozen assertion-name contract")
    if assertions != required:
        raise ValueError(f"{snapshot}: assertion outcome/name/order differs; no skips or extra assertions allowed")
    if counterexamples != [expected["counterexample"]]:
        raise ValueError(f"{snapshot}: completion-order observation differs")
    if summaries != [expected["observations"]]:
        raise ValueError(f"{snapshot}: exact single summary differs")
    return {"snapshot": snapshot, "status": "EXPECTED_OUTCOMES_MATCH", **expected["observations"]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expectations", type=Path, default=Path(__file__).with_name("EXPECTATIONS.json"))
    parser.add_argument("--snapshot", choices=("baseline", "rejected", "candidate"), required=True)
    parser.add_argument("--directory", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(validate(json.loads(args.expectations.read_text()), args.snapshot, args.directory)))


if __name__ == "__main__":
    main()
