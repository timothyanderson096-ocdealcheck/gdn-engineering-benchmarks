"""Compile actual PX4 mission methods with explicit boundary doubles, outside PX4."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys


def extract(text: str, signature: str) -> str:
    """Retain a complete source function, ignoring braces inside strings/comments."""
    start = text.index(signature)
    opening = text.index("{", start)
    depth = 0
    state = "code"
    index = opening
    while index < len(text):
        char = text[index]
        next_char = text[index + 1] if index + 1 < len(text) else ""
        if state == "line":
            if char == "\n":
                state = "code"
        elif state == "block":
            if char == "*" and next_char == "/":
                state = "code"
                index += 1
        elif state in ("string", "char"):
            if char == "\\":
                index += 1
            elif char == ('"' if state == "string" else "'"):
                state = "code"
        elif char == "/" and next_char in ("/", "*"):
            state = "line" if next_char == "/" else "block"
            index += 1
        elif char in ('"', "'"):
            state = "string" if char == '"' else "char"
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start:index + 1]
        index += 1
    raise ValueError(f"Unclosed function: {signature}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--bridge", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    source = args.source.resolve()
    bridge = args.bridge.resolve()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=False)
    text = source.read_text()
    methods = {
        "target_system": extract(bridge.read_text(), "static inline uint32_t mavlink_target_system("),
        "target_component": extract(text, "static inline bool targets_mission_manager("),
        "update_locked": extract(text, "mission_s\nMavlinkMissionManager::update_active_mission_locked("),
        "update": extract(text, "void\nMavlinkMissionManager::update_active_mission("),
        "metadata": extract(text, "void\nMavlinkMissionManager::update_mission_state()"),
        "current": extract(text, "void\nMavlinkMissionManager::send_mission_current("),
        "periodic": extract(text, "void\nMavlinkMissionManager::send()"),
        "handler": extract(text, "void\nMavlinkMissionManager::handle_mission_set_current("),
    }
    template = Path(__file__).with_name("probe.cpp.in").read_text()
    assert template.count("// @@METHODS@@") == 1
    generated = out / "probe.cpp"
    generated.write_text(text[:text.index("#include")] + template.replace("// @@METHODS@@", "\n\n".join(methods.values())))
    command = ["g++", "-std=c++17", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-pthread",
               "-fsanitize=undefined", "-fno-sanitize-recover=all", "-fno-omit-frame-pointer",
               str(generated), "-o", str(out / "probe")]
    compiler = subprocess.check_output(["g++", "--version"], text=True).splitlines()[0]
    with (out / "compile.log").open("w") as log:
        compiled = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
    manifest = {
        "source": str(source), "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "source_git_blob": subprocess.check_output(["git", "hash-object", str(source)], text=True).strip(),
        "bridge": str(bridge), "bridge_sha256": hashlib.sha256(bridge.read_bytes()).hexdigest(),
        "methods_sha256": {name: hashlib.sha256(body.encode()).hexdigest() for name, body in methods.items()},
        "template_sha256": hashlib.sha256(template.encode()).hexdigest(),
        "runner_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "generated_sha256": hashlib.sha256(generated.read_bytes()).hexdigest(),
        "compiler": compiler, "compile_command": command, "compile_exit": compiled.returncode,
        "scope": "Complete actual production methods. Decode, Dataman/uORB, status subscription and serializer/transport are boundary doubles; no PX4/SITL/wire/flight claim.",
    }
    if compiled.returncode:
        (out / "MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print((out / "compile.log").read_text())
        return compiled.returncode
    with (out / "run.log").open("w") as log:
        result = subprocess.run([str(out / "probe")], stdout=log, stderr=subprocess.STDOUT, timeout=30)
    manifest["run_exit"] = result.returncode
    lines = (out / "run.log").read_text().splitlines()
    summaries = [line[len("RESULT "):] for line in lines if line.startswith("RESULT ")]
    if len(summaries) == 1:
        manifest["observations"] = json.loads(summaries[0])
    (out / "MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print((out / "run.log").read_text())
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
