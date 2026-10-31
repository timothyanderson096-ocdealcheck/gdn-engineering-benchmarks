"""Actual disarmed SIH/MAVLink REQUEST_EVENT probe; no flight or source mocks.

The decoder must be generated from the tested PX4 checkout's pinned development
dialect. UDP collection does no MAVLink decoding on its hot path. Complete raw
datagrams, observed kernel overflow counters and every requested sequence outcome
are retained. Transport loss or a changing event buffer makes a control fail; it
does not become a passing protocol assertion.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import importlib.util
import itertools
import json
import os
import select
import signal
import socket
import struct
import subprocess
import threading
import time
import traceback
from pathlib import Path

CLIENT = (245, 190)
AUTOPILOT = (1, 1)
LOCAL = ("127.0.0.1", 14540)
REMOTE = ("127.0.0.1", 14580)
SO_RXQ_OVFL = 40  # Linux socket ABI; standard Ubuntu runner only.
REQUESTED_RECEIVE_BUFFER = 16 * 1024 * 1024
BULK_WINDOW_SECONDS = 20.0
SMALL_WINDOW_SECONDS = 1.5
STARTUP_SECONDS = 45.0
STABLE_SEQUENCE_SECONDS = 2.0
EVENT_MODULUS = 1 << 16
JOURNAL_MAGIC = b"PX4UDP1\n"
# After the magic, repeat: monotonic_ns:uint64, IPv4:4bytes, source_port:uint16,
# payload_length:uint16, kernel_drop_counter:uint32, raw UDP payload bytes.
JOURNAL_HEADER = struct.Struct("<Q4sHHI")
CAPTURE_PINS = {
    "capture_native.cpp": "fe5ff6b8b2b7d0361cf27c68117d959ece8cf76e2cf6ff371b47ed5b407b02f4",
    "capture_native.py": "9cdd5616000effe72b13d44b4797ea9dc0caac6b2854b92ed4a5e5cae446864f",
}


def shutdown_native(
    process,
    binary: Path,
    rootfs: Path,
    environment: dict,
    output: Path,
    daemon_log: Path,
    prior_failures=(),
):
    """Observe natural shutdown, including a source-permitted missing trailer.

    PX4 queues shutdown on HPWORK. The worker may terminate with exit 0 before
    the daemon writes the RPC trailer; Client::_listen then returns -1/255.
    Only the complete joint observation below qualifies. This helper sends no
    signal and never turns an earlier harness/control failure into success.
    """
    command = [str(binary.with_name("px4-shutdown"))]
    proof = {
        "command": command,
        "client_exit": None,
        "native_exit": None,
        "prior_failures": list(prior_failures),
        "signals_sent": [],
        "accepted": False,
        "contract": "OWNED_ALIVE_NATIVE_THEN_CLI_0_OR_SILENT_255_WITH_FRESH_TERMINAL_MARKER_AND_NATURAL_EXIT0",
    }
    try:
        assert process.poll() is None, "Native process exited before shutdown request"
        journal = json.loads((output / "native-process.json").read_text())
        token = (
            Path(f"/proc/{process.pid}/stat").read_text().rsplit(") ", 1)[1].split()[19]
        )
        argv0 = (
            Path(f"/proc/{process.pid}/cmdline").read_bytes().split(b"\0")[0].decode()
        )
        assert (
            journal["pid"] == journal["pgid"] == process.pid == os.getpgid(process.pid)
        )
        assert (
            journal["start_token"] == token
            and journal["binary"] == str(binary) == argv0
        )
        proof["owned_native_alive_before_request"] = True
        offset = daemon_log.stat().st_size
        proof["daemon_log_offset_before_request"] = offset
        proof["request_at_ns"] = time.monotonic_ns()
        completed = subprocess.run(
            command,
            cwd=rootfs,
            env=environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=8,
            check=False,
        )
        proof["client_exit"] = completed.returncode
        proof["client_output_bytes"] = len(completed.stdout)
        proof["client_output_sha256"] = hashlib.sha256(completed.stdout).hexdigest()
        (output / "shutdown.log").write_bytes(completed.stdout)
        proof["native_exit"] = process.wait(timeout=15)
        tail = daemon_log.read_bytes()[offset:]
        proof["fresh_terminal_exit_marker"] = any(
            line.strip() == b"Exiting NOW." for line in tail.splitlines()
        )
        proof["post_request_log_sha256"] = hashlib.sha256(tail).hexdigest()
        proof["finished_at_ns"] = time.monotonic_ns()
        if completed.returncode == 0:
            proof["classification"] = "ACK_OBSERVED"
            client_contract = True
        elif completed.returncode == 255 and completed.stdout == b"":
            proof["classification"] = "NOT_OBSERVED_SOURCE_PERMITTED_SHUTDOWN"
            client_contract = True
        else:
            proof["classification"] = "UNACCEPTED_CLIENT_RESULT"
            client_contract = False
        proof["accepted"] = bool(
            client_contract
            and proof["native_exit"] == 0
            and proof["fresh_terminal_exit_marker"]
            and not proof["prior_failures"]
        )
        proof["scope"] = (
            "Normal shutdown request and natural native exit 0; no proof of RPC ACK for 255, exact thread schedule, or all hooks/resources drained"
        )
    except (
        AssertionError,
        KeyError,
        TypeError,
        ValueError,
        OSError,
        subprocess.SubprocessError,
    ) as error:
        proof["error"] = repr(error)
    proof["native_exit"] = process.poll()
    (output / "shutdown-proof.json").write_text(json.dumps(proof, indent=2) + "\n")
    return proof


class PythonCollector:
    def __init__(self, output: Path):
        self.output = output
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.setsockopt(
            socket.SOL_SOCKET, socket.SO_RCVBUF, REQUESTED_RECEIVE_BUFFER
        )
        self.socket.setsockopt(socket.SOL_SOCKET, SO_RXQ_OVFL, 1)
        self.socket.bind(LOCAL)
        self.socket.setblocking(False)
        self.effective_buffer = self.socket.getsockopt(
            socket.SOL_SOCKET, socket.SO_RCVBUF
        )
        self.records = []
        self.transmitted = []
        self.stop = threading.Event()
        self.reader_error = None
        self.thread = threading.Thread(target=self.collect, name="raw-udp-collector")
        self.thread.start()

    def collect(self):
        drops = 0
        try:
            while not self.stop.is_set():
                if not select.select([self.socket], [], [], 0.05)[0]:
                    continue
                while True:
                    try:
                        raw, ancillary, flags, address = self.socket.recvmsg(65535, 256)
                    except BlockingIOError:
                        break
                    if flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC):
                        raise RuntimeError(
                            "Truncated raw UDP data or ancillary metadata"
                        )
                    for level, kind, value in ancillary:
                        if level == socket.SOL_SOCKET and kind == SO_RXQ_OVFL:
                            drops = struct.unpack("=I", value)[0]
                    self.records.append((time.monotonic_ns(), address, drops, raw))
        except (OSError, RuntimeError) as error:
            self.reader_error = repr(error)

    def write(self, raw):
        sent_at = time.monotonic_ns()
        count = self.socket.sendto(raw, REMOTE)
        if count != len(raw):
            raise RuntimeError("Short UDP send")
        self.transmitted.append(
            {"at_ns": sent_at, "destination": REMOTE, "hex": raw.hex()}
        )
        return count

    def close(self):
        self.stop.set()
        self.thread.join(timeout=2)
        assert not self.thread.is_alive(), "UDP collector did not stop"
        self.socket.close()
        with (self.output / "wire.udp").open("wb") as destination:
            destination.write(JOURNAL_MAGIC)
            for at, address, drops, raw in self.records:
                destination.write(
                    JOURNAL_HEADER.pack(
                        at, socket.inet_aton(address[0]), address[1], len(raw), drops
                    )
                )
                destination.write(raw)
        with (self.output / "tx.jsonl").open("w") as destination:
            for record in self.transmitted:
                destination.write(json.dumps(record, separators=(",", ":")) + "\n")


def native_capture_module():
    directory = Path(__file__).resolve().parent / "capture"
    for name, expected in CAPTURE_PINS.items():
        assert (
            hashlib.sha256((directory / name).read_bytes()).hexdigest() == expected
        ), f"Reviewed native capture source changed: {name}"
    spec = importlib.util.spec_from_file_location(
        "px4_event_native_capture", directory / "capture_native.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def Collector(output: Path, *, native_binary: Path):
    """Require the reviewed native reader for the event burst; no fallback."""
    return native_capture_module().Collector(output, native_binary=native_binary)


class Probe:
    def __init__(self, collector, dialect, output: Path):
        self.collector = collector
        self.dialect = dialect
        self.output = output
        self.sender = dialect.MAVLink(
            collector, srcSystem=CLIENT[0], srcComponent=CLIENT[1]
        )
        self.checks = []
        self.cases = []
        self.heartbeat_stop = threading.Event()
        self.heartbeat_error = None
        self.send_lock = threading.Lock()
        self.heartbeat_thread = threading.Thread(
            target=self.heartbeats, name="client-heartbeats"
        )
        self.heartbeat_thread.start()

    def send(self, name: str, *args, **kwargs):
        with self.send_lock:
            getattr(self.sender, name)(*args, **kwargs)
            return self.collector.transmitted[-1]["at_ns"]

    def heartbeats(self):
        try:
            while not self.heartbeat_stop.is_set():
                self.send(
                    "heartbeat_send",
                    self.dialect.MAV_TYPE_GCS,
                    self.dialect.MAV_AUTOPILOT_INVALID,
                    0,
                    0,
                    0,
                )
                self.heartbeat_stop.wait(1.0)
        except (OSError, RuntimeError) as error:
            self.heartbeat_error = repr(error)

    def close(self):
        self.heartbeat_stop.set()
        self.heartbeat_thread.join(timeout=2)
        assert not self.heartbeat_thread.is_alive(), "Heartbeat sender did not stop"

    def decode(self, records):
        parser = self.dialect.MAVLink(None)
        parser.robust_parsing = True
        messages = []
        for at, address, _drops, raw in records:
            assert address == REMOTE, f"Unexpected UDP source endpoint {address!r}"
            for message in parser.parse_buffer(raw) or []:
                assert message.get_type() != "BAD_DATA", "Invalid MAVLink framing/CRC"
                source = (message.get_srcSystem(), message.get_srcComponent())
                assert source == AUTOPILOT, f"Unexpected MAVLink source {source!r}"
                if message.get_type() == "HEARTBEAT":
                    assert (
                        not message.base_mode & self.dialect.MAV_MODE_FLAG_SAFETY_ARMED
                    ), "Unexpected armed heartbeat"
                messages.append((at, message))
        return messages

    def check(self, name: str, passed: bool, *, kind="control", **details):
        self.checks.append(
            {"name": name, "passed": bool(passed), "kind": kind, "details": details}
        )

    def await_startup(self):
        deadline = time.monotonic() + STARTUP_SECONDS
        while time.monotonic() < deadline:
            messages = self.decode(list(self.collector.records))
            if any(message.get_type() == "HEARTBEAT" for _at, message in messages):
                break
            time.sleep(0.2)
        else:
            raise RuntimeError("No disarmed native SIH heartbeat")
        command_at = self.send(
            "command_long_send",
            *AUTOPILOT,
            self.dialect.MAV_CMD_RUN_PREARM_CHECKS,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
        )
        # Wait for observed quiet event state instead of guessing a boot delay.
        # Two genuine current-sequence messages must agree with the newest EVENT.
        while time.monotonic() < deadline:
            messages = self.decode(list(self.collector.records))
            acknowledgements = [
                message
                for at, message in messages
                if at >= command_at
                and message.get_type() == "COMMAND_ACK"
                and message.command == self.dialect.MAV_CMD_RUN_PREARM_CHECKS
            ]
            if acknowledgements:
                assert (
                    acknowledgements[-1].result == self.dialect.MAV_RESULT_ACCEPTED
                ), "Native prearm-check command rejected"
            events = [
                message for _at, message in messages if message.get_type() == "EVENT"
            ]
            current = [
                (at, message.sequence)
                for at, message in messages
                if message.get_type() == "CURRENT_EVENT_SEQUENCE"
            ]
            stable = (
                len(current) >= 2
                and current[-1][1] == current[-2][1]
                and (current[-1][0] - current[-2][0]) / 1e9 >= STABLE_SEQUENCE_SECONDS
            )
            if (
                acknowledgements
                and events
                and stable
                and events[-1].sequence == current[-1][1]
            ):
                self.check(
                    "native_disarmed_startup_and_prearm_ack",
                    True,
                    cached_event=events[-1].to_dict(),
                    latest_sequence=current[-1][1],
                    stable_sequence_seconds=(current[-1][0] - current[-2][0]) / 1e9,
                )
                return events[-1], current[-1][1]
            time.sleep(0.2)
        raise RuntimeError(
            "No accepted prearm ACK, genuine cached EVENT and stable native sequence within startup deadline"
        )

    def request_case(self, name: str, first: int, last: int, cached, latest: int):
        count = (last - first) % EVENT_MODULUS + 1
        duration = BULK_WINDOW_SECONDS if count > 100 else SMALL_WINDOW_SECONDS
        time.sleep(0.25)
        start = len(self.collector.records)
        requested_at = self.send(
            "request_event_send",
            target_system=AUTOPILOT[0],
            target_component=AUTOPILOT[1],
            first_sequence=first,
            last_sequence=last,
        )
        # A read-only receiver command queued during synchronous response work
        # measures receiver responsiveness; heartbeats run independently.
        time.sleep(0.01)
        parameter_at = self.send(
            "param_request_read_send", *AUTOPILOT, b"MAV_SYS_ID", -1
        )
        time.sleep(duration - 0.01)
        end = len(self.collector.records)
        raw = list(self.collector.records[start:end])
        messages = self.decode(raw)
        assert not self.collector.reader_error, self.collector.reader_error
        assert not self.heartbeat_error, self.heartbeat_error
        drops_before = self.collector.records[start - 1][2] if start else 0
        drops_after = raw[-1][2] if raw else drops_before
        overflow_delta = (drops_after - drops_before) % (1 << 32)
        self.check(
            f"{name}:no_kernel_receive_overflow",
            overflow_delta == 0,
            kernel_dropped=overflow_delta,
        )
        responses = [
            (at, message)
            for at, message in messages
            if message.get_type() in {"EVENT", "RESPONSE_EVENT_ERROR"}
        ]
        by_sequence = collections.Counter(
            message.sequence for _at, message in responses
        )
        ordered_expected = [(first + offset) % EVENT_MODULUS for offset in range(count)]
        expected = set(ordered_expected)
        correct = (
            set(by_sequence) == expected
            and len(responses) == count
            and all(n == 1 for n in by_sequence.values())
        )
        self.check(
            f"{name}:complete_inclusive_wire_range",
            correct,
            kind="regression" if count == EVENT_MODULUS else "control",
            expected=count,
            received=len(responses),
            unique=len(by_sequence),
            missing_count=len(expected - by_sequence.keys()),
            unexpected_count=len(by_sequence.keys() - expected),
            duplicate_sequences=sum(n > 1 for n in by_sequence.values()),
        )
        self.check(
            f"{name}:ordered_inclusive_wire_range",
            [message.sequence for _at, message in responses] == ordered_expected,
            kind="regression" if count == EVENT_MODULUS else "control",
        )
        errors = [
            message
            for _at, message in responses
            if message.get_type() == "RESPONSE_EVENT_ERROR"
        ]
        if name == "unavailable_single":
            self.check(
                "unavailable_single:one_error_without_event",
                len(errors) == 1 and len(responses) == 1,
            )
        self.check(
            f"{name}:error_reason_and_target",
            all(
                message.reason == self.dialect.MAV_EVENT_ERROR_REASON_UNAVAILABLE
                and (message.target_system, message.target_component) == CLIENT
                for message in errors
            ),
            error_responses=len(errors),
        )
        event_responses = [
            message for _at, message in responses if message.get_type() == "EVENT"
        ]
        if name == "hint_followup":
            self.check(
                "hint_followup:hint_points_to_cached_event",
                len(event_responses) == 1 and not errors,
            )
        self.check(
            f"{name}:event_destination",
            all(
                (message.destination_system, message.destination_component) == (0, 0)
                for message in event_responses
            ),
            event_responses=len(event_responses),
        )
        if cached.sequence in expected:
            same = [
                message
                for message in event_responses
                if message.sequence == cached.sequence
            ]
            self.check(
                f"{name}:cached_event_contents",
                len(same) == 1 and same[0].to_dict() == cached.to_dict(),
                kind="regression" if count == EVENT_MODULUS else "control",
            )
        parameters = [
            (at, message)
            for at, message in messages
            if at >= parameter_at
            and message.get_type() == "PARAM_VALUE"
            and message.param_id == "MAV_SYS_ID"
        ]
        self.check(
            f"{name}:read_only_receiver_response",
            bool(parameters),
            latency_seconds=(
                (parameters[0][0] - parameter_at) / 1e9 if parameters else None
            ),
        )
        heartbeat_times = [
            at for at, message in messages if message.get_type() == "HEARTBEAT"
        ]
        self.check(f"{name}:heartbeat_continues", bool(heartbeat_times))
        observed_latest = [
            message.sequence
            for _at, message in messages
            if message.get_type() == "CURRENT_EVENT_SEQUENCE"
        ]
        # A current-sequence change could mix unsolicited EVENTs with replies,
        # making exact full-range counts ambiguous. Preserve it as a failed control.
        self.check(
            f"{name}:stable_event_buffer",
            (bool(observed_latest) or count <= 100)
            and all(sequence == latest for sequence in observed_latest),
            latest_before=latest,
            observed_latest=observed_latest,
        )
        response_times = [at for at, _message in responses]
        record = {
            "name": name,
            "first": first,
            "last": last,
            "inclusive_count": count,
            "window_seconds": duration,
            "raw_record_slice": [start, end],
            "kernel_receive_drops": overflow_delta,
            "first_response_seconds": (
                (min(response_times) - requested_at) / 1e9 if response_times else None
            ),
            "last_response_seconds": (
                (max(response_times) - requested_at) / 1e9 if response_times else None
            ),
            "receiver_parameter_latency_seconds": (
                (parameters[0][0] - parameter_at) / 1e9 if parameters else None
            ),
            "actual_read_only_request_offset_seconds": (parameter_at - requested_at)
            / 1e9,
            "maximum_heartbeat_gap_seconds": max(
                (
                    (right - left) / 1e9
                    for left, right in itertools.pairwise(heartbeat_times)
                ),
                default=None,
            ),
            "responses": len(responses),
            "events": len(event_responses),
            "unavailable_errors": len(errors),
        }
        self.cases.append(record)
        with (self.output / f"{name}-responses.jsonl").open("w") as destination:
            for at, message in responses:
                destination.write(
                    json.dumps(
                        {
                            "at_ns": at,
                            "source": AUTOPILOT,
                            "message": message.to_dict(),
                        },
                        separators=(",", ":"),
                    )
                    + "\n"
                )
        return (
            errors[0].sequence_oldest_available
            if name == "unavailable_single" and len(errors) == 1
            else None
        )


def load_dialect(path: Path):
    spec = importlib.util.spec_from_file_location("px4_tested_development", path)
    assert spec is not None and spec.loader is not None
    dialect = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(dialect)
    return dialect


def main() -> int:
    def interrupted(_number, _frame):
        raise InterruptedError(
            "Wire probe interrupted; preserve bounded native cleanup"
        )

    signal.signal(signal.SIGTERM, interrupted)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--dialect", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--capture-native", type=Path, required=True)
    parser.add_argument("--expected-capture-sha256", required=True)
    args = parser.parse_args()
    source = args.source.resolve()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    build = source / "build/px4_sitl_default"
    binary = build / "bin/px4"
    rootfs = output / "rootfs"
    rootfs.mkdir()
    dialect = load_dialect(args.dialect.resolve())
    result = {
        "binary_sha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
        "dialect_sha256": hashlib.sha256(args.dialect.read_bytes()).hexdigest(),
        "harness_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "limits": [
            "Actual native SIH and loopback UDP; no physical vehicle, GCS UI or flight",
            "Fixed finite capture deadlines are explicit; kernel drops or incomplete ranges fail controls",
            "Measured synchronous-work latency is evidence, not maintainer acceptance of a workload budget",
        ],
    }
    collector = None
    probe = None
    process = None
    forced = False
    environment = os.environ.copy()
    environment.update(PX4_SIM_MODEL="sihsim_quadx", PX4_SIM_SPEED_FACTOR="1")
    environment.pop("PX4_NET_INTERFACE", None)
    try:
        capture_binary = args.capture_native.resolve()
        actual_capture_hash = hashlib.sha256(capture_binary.read_bytes()).hexdigest()
        assert (
            actual_capture_hash == args.expected_capture_sha256
        ), "Compiled recorder identity changed"
        result["capture_binary"] = str(capture_binary)
        result["capture_binary_sha256"] = actual_capture_hash
        collector = Collector(output, native_binary=capture_binary)
        probe = Probe(collector, dialect, output)
        result["receive_buffer"] = {
            "requested": REQUESTED_RECEIVE_BUFFER,
            "effective": collector.effective_buffer,
        }
        command = [
            str(binary),
            str(build / "etc"),
            "-s",
            "etc/init.d-posix/rcS",
            "-t",
            str(source / "test_data"),
            "-d",
        ]
        result["command"] = command
        with (output / "px4.log").open("wb") as log:
            process = subprocess.Popen(
                command,
                cwd=rootfs,
                env=environment,
                stdin=subprocess.DEVNULL,
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
            # The outer watchdog can identify and clean this exact process group
            # even if the Python fixture itself has to be killed forcibly.
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
            cached, latest = probe.await_startup()
            for name, first, last in [
                ("cached_single", cached.sequence, cached.sequence),
                (
                    "unavailable_single",
                    (latest + 1000) % EVENT_MODULUS,
                    (latest + 1000) % EVENT_MODULUS,
                ),
                (
                    "ordinary",
                    (cached.sequence - 1) % EVENT_MODULUS,
                    (cached.sequence + 1) % EVENT_MODULUS,
                ),
                ("wrap_short", EVENT_MODULUS - 2, 1),
                ("near_full", 0, EVENT_MODULUS - 2),
                ("full", 0, EVENT_MODULUS - 1),
                ("cached_after_full", cached.sequence, cached.sequence),
                (
                    "rotated_full",
                    cached.sequence,
                    (cached.sequence - 1) % EVENT_MODULUS,
                ),
                ("cached_after_rotated_full", cached.sequence, cached.sequence),
            ]:
                hint = probe.request_case(name, first, last, cached, latest)
                if name == "unavailable_single":
                    assert hint is not None, "No actual oldest-available hint to replay"
                    probe.request_case("hint_followup", hint, hint, cached, latest)
    except (AssertionError, OSError, RuntimeError, subprocess.SubprocessError):
        result["harness_error"] = traceback.format_exc()
    finally:
        if process is not None:
            prior = (
                [
                    check["name"]
                    for check in probe.checks
                    if not check["passed"] and check["kind"] == "control"
                ]
                if probe is not None
                else ["probe_setup_incomplete"]
            )
            if result.get("harness_error"):
                prior.append("harness_error")
            result["shutdown"] = shutdown_native(
                process, binary, rootfs, environment, output, output / "px4.log", prior
            )
            if probe is not None:
                probe.check(
                    "normal_shutdown_contract",
                    result["shutdown"]["accepted"],
                    **result["shutdown"],
                )
        if process is not None and process.poll() is None:
            forced = True
            os.killpg(process.pid, signal.SIGINT)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
        cleanup_errors = []
        for resource in (probe, collector):
            if resource is not None:
                try:
                    resource.close()
                except (AssertionError, OSError, RuntimeError) as error:
                    cleanup_errors.append(repr(error))
        if cleanup_errors:
            result["cleanup_errors"] = cleanup_errors
        if collector is not None:
            result["capture_status"] = collector.capture_status
        result["forced_cleanup"] = forced
        result["native_exit"] = process.returncode if process is not None else None
        result["checks"] = probe.checks if probe is not None else []
        result["cases"] = probe.cases if probe is not None else []
        result["control_failures"] = [
            c["name"]
            for c in result["checks"]
            if not c["passed"] and c["kind"] == "control"
        ]
        result["regression_failures"] = [
            c["name"]
            for c in result["checks"]
            if not c["passed"] and c["kind"] == "regression"
        ]
        result["status"] = (
            "HARNESS_OR_CONTROL_FAILURE"
            if result.get("harness_error")
            or cleanup_errors
            or forced
            or result["control_failures"]
            else (
                "REGRESSION_REPRODUCED"
                if result["regression_failures"]
                else "ALL_WIRE_CHECKS_PASSED"
            )
        )
        (output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
        print(
            json.dumps(
                {k: v for k, v in result.items() if k not in {"checks"}}, indent=2
            )
        )
    return (
        2
        if result["status"] == "HARNESS_OR_CONTROL_FAILURE"
        else (1 if result["regression_failures"] else 0)
    )


if __name__ == "__main__":
    raise SystemExit(main())
