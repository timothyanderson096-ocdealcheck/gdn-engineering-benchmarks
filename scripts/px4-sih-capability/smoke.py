"""Real normal SIH readiness: native status exits plus owned disarmed UDP heartbeats."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import select
import signal
import socket
import subprocess
import time
from pathlib import Path

LOCAL = ("127.0.0.1", 14540)
REMOTE = ("127.0.0.1", 14580)
READY_SECONDS = 60.0


def load_dialect(path: Path):
    spec = importlib.util.spec_from_file_location("tested_sih_development", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def udp_inodes(port: int) -> set[str]:
    return {
        fields[9]
        for line in Path("/proc/net/udp").read_text().splitlines()[1:]
        if (fields := line.split()) and int(fields[1].split(":")[1], 16) == port
    }


def native_udp_owner(pid: int) -> dict:
    inodes = udp_inodes(REMOTE[1])
    owned = []
    for file in Path(f"/proc/{pid}/fd").iterdir():
        try:
            link = os.readlink(file)
        except FileNotFoundError:
            continue
        if any(link == f"socket:[{inode}]" for inode in inodes):
            owned.append(link)
    assert owned, "Native process does not own the expected MAVLink UDP port"
    return {"pid": pid, "local_port": REMOTE[1], "sockets": owned}


def main() -> int:
    def interrupted(_number, _frame):
        raise InterruptedError("Readiness probe interrupted; preserve cleanup")

    signal.signal(signal.SIGTERM, interrupted)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--dialect", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    args = parser.parse_args()
    source = args.source.resolve()
    evidence = args.evidence.resolve()
    output = evidence / "startup"
    output.mkdir(exist_ok=False)
    build = source / "build/px4_sitl_default"
    binary = build / "bin/px4"
    rootfs = output / "rootfs"
    rootfs.mkdir()
    dialect = load_dialect(args.dialect.resolve())
    decoder = dialect.MAVLink(None)
    decoder.robust_parsing = True
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
        "binary_sha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
        "dialect_sha256": hashlib.sha256(args.dialect.read_bytes()).hexdigest(),
        "readiness_window_seconds": READY_SECONDS,
        "checks": {},
        "heartbeats": [],
        "module_attempts": [],
        "claim": "SIH_STARTUP_AND_LOOPBACK_READINESS_ONLY",
    }
    process = None
    receiver = None
    forced = False
    ready = False
    cleanup_errors = []

    def module(name: str, *arguments: str):
        return subprocess.run(
            [str(build / f"bin/px4-{name}"), *arguments],
            cwd=rootfs,
            env=environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=4,
            check=False,
        )

    try:
        assert not udp_inodes(
            REMOTE[1]
        ), "Native MAVLink port is already bound before launch"
        receiver = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        receiver.bind(LOCAL)
        receiver.setblocking(False)
        with (output / "px4-sih.log").open("wb") as log:
            process = subprocess.Popen(
                command,
                cwd=rootfs,
                env=environment,
                stdin=subprocess.DEVNULL,
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
            stat = Path(f"/proc/{process.pid}/stat").read_text()
            (output / "native-process.json").write_text(
                json.dumps(
                    {
                        "pid": process.pid,
                        "pgid": os.getpgid(process.pid),
                        "start_token": stat.rsplit(") ", 1)[1].split()[19],
                        "binary": str(binary),
                        "command": command,
                    },
                    indent=2,
                )
                + "\n"
            )
            deadline = time.monotonic() + READY_SECONDS
            next_status = 0.0
            while time.monotonic() < deadline:
                assert process.poll() is None, "Native SIH exited during readiness"
                if select.select([receiver], [], [], 0.1)[0]:
                    while True:
                        try:
                            raw, address = receiver.recvfrom(65535)
                        except BlockingIOError:
                            break
                        assert address == REMOTE, f"Unexpected UDP endpoint {address!r}"
                        for message in decoder.parse_buffer(raw) or []:
                            assert (
                                message.get_type() != "BAD_DATA"
                            ), "Invalid MAVLink framing/CRC"
                            if message.get_type() == "HEARTBEAT":
                                assert (
                                    message.get_srcSystem(),
                                    message.get_srcComponent(),
                                ) == (1, 1)
                                assert (
                                    not message.base_mode
                                    & dialect.MAV_MODE_FLAG_SAFETY_ARMED
                                ), "Unexpected armed heartbeat"
                                result["heartbeats"].append(
                                    {
                                        "at_ns": time.monotonic_ns(),
                                        "endpoint": address,
                                        "source": [1, 1],
                                        "raw_hex": bytes(message.get_msgbuf()).hex(),
                                        "message": message.to_dict(),
                                    }
                                )
                if time.monotonic() >= next_status:
                    for name, arguments, key in (
                        ("listener", ("vehicle_status", "-n", "1"), "disarmed_status"),
                        ("simulator_sih", ("status",), "sih_status"),
                        ("mavlink", ("status",), "mavlink_status_exit"),
                    ):
                        if result["checks"].get(key):
                            continue
                        try:
                            status = module(name, *arguments)
                            (output / f"{name}-client.log").write_text(status.stdout)
                            result["module_attempts"].append(
                                {
                                    "module": name,
                                    "exit": status.returncode,
                                    "stdout_bytes": len(status.stdout.encode()),
                                }
                            )
                            passed = status.returncode == 0
                            if name == "listener":
                                passed = passed and bool(
                                    re.search(r"arming_state:\s*1\b", status.stdout)
                                )
                            # MAVLink uses raw printf on the daemon's stdout.
                            # Its source returns0 only with at least one instance;
                            # empty forwarded client stdout is an expected contract.
                            result["checks"][key] = passed
                        except subprocess.TimeoutExpired:
                            result["module_attempts"].append(
                                {"module": name, "timed_out": True}
                            )
                    next_status = time.monotonic() + 1.0
                if (
                    time.monotonic() < deadline
                    and all(
                        result["checks"].get(key)
                        for key in (
                            "disarmed_status",
                            "sih_status",
                            "mavlink_status_exit",
                        )
                    )
                    and len(result["heartbeats"]) >= 2
                ):
                    result["native_udp_identity"] = native_udp_owner(process.pid)
                    ready = True
                    break
            assert (
                ready
            ), "Normal SIH modules and two actual disarmed heartbeats did not become ready within deadline"
            shutdown = module("shutdown")
            (output / "shutdown.log").write_text(shutdown.stdout)
            result["shutdown_exit"] = shutdown.returncode
            assert shutdown.returncode == 0
            assert process.wait(timeout=15) == 0, "Native process did not exit cleanly"
    except (AssertionError, OSError, subprocess.SubprocessError) as error:
        result["error"] = repr(error)
        ready = False
    finally:
        if receiver is not None:
            receiver.close()
        if process is not None and process.poll() is None:
            forced = True
            try:
                os.killpg(process.pid, signal.SIGINT)
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)
            except (OSError, subprocess.SubprocessError) as error:
                cleanup_errors.append(repr(error))
        result.update(
            forced_cleanup=forced,
            cleanup_errors=cleanup_errors,
            native_exit=process.returncode if process is not None else None,
        )
        result["status"] = (
            "PASS"
            if ready
            and not forced
            and not cleanup_errors
            and result["native_exit"] == 0
            else "FAIL"
        )
        (output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
