"""Start normal disarmed PX4 SIH and query real daemon modules; no wire claim."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import signal
import subprocess
import time
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    args = parser.parse_args()
    source, evidence = args.source.resolve(), args.evidence.resolve()
    build = source / "build/px4_sitl_default"
    binary = build / "bin/px4"
    rootfs = build / "capability-smoke/rootfs"
    rootfs.mkdir(parents=True, exist_ok=False)
    environment = os.environ.copy()
    environment.update(PX4_SIM_MODEL="sihsim_quadx", PX4_SIM_SPEED_FACTOR="1")
    environment.pop("PX4_NET_INTERFACE", None)
    command = [
        str(binary),
        str(build / "etc"),
        "-s",
        "etc/init.d-posix/rcS",
        "-t",
        str(source / "test_data"),
        "-d",
    ]
    result = {
        "command": command,
        "environment": {"PX4_SIM_MODEL": "sihsim_quadx", "PX4_SIM_SPEED_FACTOR": "1"},
        "binary_sha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
        "checks": [],
        "wire_protocol": "NOT_RUN",
    }
    process = None
    successful = False
    forced = False

    def run_module(module: str, *arguments: str):
        executable = build / f"bin/px4-{module}"
        return subprocess.run(
            [str(executable), *arguments],
            cwd=rootfs,
            env=environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
            timeout=8,
        )

    try:
        with (evidence / "px4-sih.log").open("wb") as log:
            process = subprocess.Popen(
                command,
                cwd=rootfs,
                env=environment,
                stdin=subprocess.DEVNULL,
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline:
                assert (
                    process.poll() is None
                ), "Native SIH process exited during startup"
                status = run_module("listener", "vehicle_status", "-n", "1")
                (evidence / "vehicle-status.log").write_text(status.stdout)
                if status.returncode == 0 and re.search(
                    r"arming_state:\s*1\b", status.stdout
                ):
                    break
                time.sleep(1)
            else:
                raise AssertionError(
                    "No actual disarmed vehicle_status from normal SIH startup"
                )
            result["checks"].append(
                {
                    "name": "actual_disarmed_vehicle_status",
                    "passed": True,
                    "command_exit": status.returncode,
                }
            )
            for module in ("simulator_sih", "mavlink"):
                status = run_module(module, "status")
                (evidence / f"{module}-status.log").write_text(status.stdout)
                assert status.returncode == 0, f"Actual {module} status command failed"
                assert status.stdout.strip(), f"Actual {module} status output missing"
                result["checks"].append(
                    {
                        "name": f"actual_{module}_status",
                        "passed": True,
                        "command_exit": status.returncode,
                    }
                )
            successful = True
            shutdown = run_module("shutdown")
            result["shutdown_command_exit"] = shutdown.returncode
            (evidence / "shutdown.log").write_text(shutdown.stdout)
            assert shutdown.returncode == 0, "Native shutdown command failed"
            result["native_exit"] = process.wait(timeout=15)
            assert result["native_exit"] == 0, "Native process did not exit cleanly"
    except (AssertionError, OSError, subprocess.SubprocessError) as error:
        result["error"] = str(error)
        successful = False
    finally:
        if process is not None and process.poll() is None:
            forced = True
            os.killpg(process.pid, signal.SIGINT)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
        result["forced_cleanup"] = forced
        result["native_exit"] = process.returncode if process is not None else None
        result["status"] = "PASS" if successful and not forced else "FAIL"
        (evidence / "sih-startup-detail.json").write_text(
            json.dumps(result, indent=2) + "\n"
        )
        print(json.dumps(result, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
