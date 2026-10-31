"""Disarmed native SIH compatibility replay for PX4 MISSION_SET_CURRENT.

MISSION_CURRENT carries no request ID. This replay observes selection/status,
mission integrity and continued telemetry; it cannot prove which sender path
caused an individual packet or establish a response latency requirement.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import signal
import struct
import subprocess
import threading
import time
import traceback

BASE = "789389fd46fcfb8473544d2fb3eeabd85893294c"
MAVLINK = "2e2b6af99084e4fde9bb304c84bb9253a1a98b6f"
PYMAVLINK = "19880422d451de4daba3fd96781076afb1cb889c"
SHARED_SHA256 = "3aac3fefd1bddc8c3be023d5da3a6f550257254c32583820108bb3cc6837f074"
CLIENT = (245, 190)
AUTOPILOT = (1, 1)
REMOTE = ("127.0.0.1", 14580)
STARTUP_SECONDS = 45.0
TRANSACTION_SECONDS = 8.0
OBSERVATION_SECONDS = 4.0
CURRENT_FIELDS = (
    "seq", "total", "mission_state", "mission_mode", "mission_id", "fence_id",
    "rally_points_id",
)
CASE_NAMES = (
    "new_sequence", "same_sequence", "wrong_system", "wrong_component",
    "invalid_count_boundary", "invalid_uint16_max",
)
ALLOWED_SENDS = {
    "heartbeat_send", "mission_count_send", "mission_item_int_send",
    "mission_request_list_send", "mission_request_int_send", "mission_ack_send",
    "mission_set_current_send", "param_request_read_send",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def serializable(value):
    if isinstance(value, float) and not math.isfinite(value):
        return "NaN" if math.isnan(value) else str(value)
    if isinstance(value, dict):
        return {key: serializable(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [serializable(item) for item in value]
    if isinstance(value, (bytes, bytearray)):
        return value.hex()
    if hasattr(value, "tolist"):
        return serializable(value.tolist())
    return value


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(serializable(data), indent=2, allow_nan=False) + "\n")


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load reviewed module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def git(directory: Path, *arguments: str) -> str:
    return subprocess.check_output(
        ["git", *arguments], cwd=directory, text=True, timeout=30
    ).strip()


def udp_inodes(port: int) -> set[str]:
    """Linux native-runner provenance; do not probe or contact other sockets."""
    result = set()
    for line in Path("/proc/net/udp").read_text().splitlines()[1:]:
        fields = line.split()
        if int(fields[1].split(":")[1], 16) == port:
            result.add(fields[9])
    return result


def native_socket_identity(pid: int) -> dict:
    inodes = udp_inodes(REMOTE[1])
    owned = []
    for fd in Path(f"/proc/{pid}/fd").iterdir():
        try:
            link = os.readlink(fd)
        except FileNotFoundError:
            continue
        if link.startswith("socket:[") and link[8:-1] in inodes:
            owned.append({"fd": fd.name, "inode": link[8:-1]})
    if not owned:
        raise RuntimeError("Tested native PID does not own the expected UDP port")
    return {"pid": pid, "local_udp_port": REMOTE[1], "owned_sockets": owned}


class Replay:
    def __init__(self, collector, dialect, output: Path, process):
        self.collector = collector
        self.dialect = dialect
        self.output = output
        self.process = process
        self.sender = dialect.MAVLink(
            collector, srcSystem=CLIENT[0], srcComponent=CLIENT[1]
        )
        self.parser = dialect.MAVLink(None)
        self.parser.robust_parsing = True
        self.cursor = 0
        self.messages = []
        self.checks = []
        self.cases = []
        self.transfers = []
        self.send_lock = threading.Lock()
        self.heartbeat_stop = threading.Event()
        self.heartbeat_error = None
        self.heartbeat_thread = threading.Thread(
            target=self.heartbeats, name="dr11-client-heartbeats"
        )
        self.heartbeat_thread.start()

    def send(self, method: str, *args, **kwargs) -> int:
        if method not in ALLOWED_SENDS:
            raise ValueError(f"Command is outside this disarmed replay: {method}")
        with self.send_lock:
            getattr(self.sender, method)(*args, **kwargs)
            return self.collector.transmitted[-1]["at_ns"]

    def heartbeats(self):
        try:
            while not self.heartbeat_stop.is_set():
                self.send(
                    "heartbeat_send", self.dialect.MAV_TYPE_GCS,
                    self.dialect.MAV_AUTOPILOT_INVALID, 0, 0, 0,
                )
                self.heartbeat_stop.wait(1.0)
        except Exception as error:
            self.heartbeat_error = repr(error)

    def close(self):
        self.heartbeat_stop.set()
        self.heartbeat_thread.join(timeout=2)
        if self.heartbeat_thread.is_alive():
            raise RuntimeError("Client heartbeat thread did not stop")

    def require(self, name: str, condition: bool, **details):
        self.checks.append({"name": name, "passed": bool(condition), "details": details})
        if not condition:
            raise RuntimeError(f"Failed compatibility/control check: {name}")

    def pump(self):
        if self.collector.reader_error:
            raise RuntimeError(f"Raw collector failed: {self.collector.reader_error}")
        if self.heartbeat_error:
            raise RuntimeError(f"Client heartbeat failed: {self.heartbeat_error}")
        records = list(self.collector.records[self.cursor:])
        self.cursor += len(records)
        for at, address, drops, raw in records:
            if address != REMOTE:
                raise RuntimeError(f"Unexpected UDP source: {address!r}")
            if drops:
                raise RuntimeError(f"Observed kernel UDP receive drops: {drops}")
            for message in self.parser.parse_buffer(raw) or []:
                if message.get_type() == "BAD_DATA":
                    raise RuntimeError("Invalid MAVLink framing or CRC")
                source = (message.get_srcSystem(), message.get_srcComponent())
                if source != AUTOPILOT:
                    raise RuntimeError(f"Unexpected MAVLink source: {source!r}")
                if message.get_type() == "HEARTBEAT":
                    if message.base_mode & self.dialect.MAV_MODE_FLAG_SAFETY_ARMED:
                        raise RuntimeError("Observed armed heartbeat; stopping replay")
                self.messages.append((at, message))

    def wait_for(self, since: int, predicate, label: str, timeout=TRANSACTION_SECONDS):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            self.pump()
            for at, message in self.messages:
                if at >= since and predicate(message):
                    return at, message
            if self.process.poll() is not None:
                raise RuntimeError(f"Native process exited while waiting for {label}")
            time.sleep(0.05)
        raise RuntimeError(f"Capture deadline expired without {label}; not a protocol timeout claim")

    def collect_for(self, seconds: float):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            self.pump()
            if self.process.poll() is not None:
                raise RuntimeError("Native process exited during telemetry observation")
            time.sleep(0.05)
        self.pump()

    def directed(self, message) -> bool:
        return (
            (message.target_system, message.target_component) == CLIENT
            and message.mission_type == self.dialect.MAV_MISSION_TYPE_MISSION
        )

    def startup(self):
        started = time.monotonic_ns()
        self.wait_for(started, lambda m: m.get_type() == "HEARTBEAT", "disarmed heartbeat", STARTUP_SECONDS)
        _, position = self.wait_for(
            started,
            lambda m: m.get_type() == "GLOBAL_POSITION_INT" and m.lat != 0 and m.lon != 0,
            "native SIH global position", STARTUP_SECONDS,
        )
        self.wait_for(started, lambda m: m.get_type() == "MISSION_CURRENT", "initial periodic MISSION_CURRENT", STARTUP_SECONDS)
        self.require("native_disarmed_startup", True, latitude_int=position.lat, longitude_int=position.lon)
        return int(position.lat), int(position.lon)

    def mission_items(self, latitude: int, longitude: int) -> list[dict]:
        # SupportedCommandParams: TAKEOFF 0x78; WAYPOINT/LAND 0x7B.
        # Unsupported floating parameters use NaN; supported values are explicit.
        common = {"frame": self.dialect.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
                  "autocontinue": 1, "param3": math.nan, "param4": math.nan,
                  "x": latitude, "y": longitude}
        return [
            {**common, "seq": 0, "command": self.dialect.MAV_CMD_NAV_TAKEOFF,
             "current": 1, "param1": math.nan, "param2": math.nan, "z": 20.0},
            {**common, "seq": 1, "command": self.dialect.MAV_CMD_NAV_WAYPOINT,
             "current": 0, "param1": 0.0, "param2": 2.0, "x": latitude + 1000, "z": 20.0},
            {**common, "seq": 2, "command": self.dialect.MAV_CMD_NAV_LAND,
             "current": 0, "param1": 0.0, "param2": 0.0, "z": 0.0},
        ]

    def upload(self, items: list[dict]) -> int:
        sent = self.send("mission_count_send", *AUTOPILOT, len(items), mission_type=0)
        deadline = time.monotonic() + TRANSACTION_SECONDS * 3
        requested = []
        consumed = set()
        while time.monotonic() < deadline:
            at, message = self.wait_for(
                sent,
                lambda m: id(m) not in consumed and m.get_type() in {"MISSION_REQUEST_INT", "MISSION_REQUEST", "MISSION_ACK"},
                "mission upload request or acknowledgement",
                timeout=min(TRANSACTION_SECONDS, max(0.1, deadline - time.monotonic())),
            )
            consumed.add(id(message))
            self.require("upload_peer_and_type", self.directed(message), message=message.to_dict())
            if message.get_type() == "MISSION_ACK":
                self.require("three_item_upload_accepted", message.type == self.dialect.MAV_MISSION_ACCEPTED,
                             acknowledgement=message.to_dict(), requested_sequences=requested)
                self.require("all_uploaded_items_requested", set(requested) == set(range(len(items))))
                self.transfers.append({"name": "upload", "at_ns": sent,
                                       "ack_at_ns": at, "ack": message.to_dict(), "items": items})
                return int(message.opaque_id)
            self.require("native_int_upload_protocol", message.get_type() == "MISSION_REQUEST_INT")
            self.require("upload_request_in_range", 0 <= message.seq < len(items), sequence=message.seq)
            requested.append(int(message.seq))
            self.send("mission_item_int_send", *AUTOPILOT, **items[message.seq], mission_type=0)
        raise RuntimeError("Upload capture deadline expired")

    def download(self, name: str) -> tuple[int, list[dict]]:
        sent = self.send("mission_request_list_send", *AUTOPILOT, mission_type=0)
        _, count = self.wait_for(sent, lambda m: m.get_type() == "MISSION_COUNT", f"{name} mission count")
        self.require(f"{name}:count_peer_and_type", self.directed(count), message=count.to_dict())
        self.require(f"{name}:bounded_mission_count", 0 <= count.count <= 3, count=count.count)
        items = []
        for sequence in range(count.count):
            request = self.send("mission_request_int_send", *AUTOPILOT, sequence, mission_type=0)
            _, item = self.wait_for(
                request,
                lambda m: m.get_type() in {"MISSION_ITEM_INT", "MISSION_ACK"},
                f"{name} item {sequence}",
            )
            self.require(f"{name}:item_{sequence}_received", item.get_type() == "MISSION_ITEM_INT",
                         message=item.to_dict())
            self.require(f"{name}:item_{sequence}_identity", self.directed(item) and item.seq == sequence,
                         message=item.to_dict())
            items.append(item.to_dict())
        self.send("mission_ack_send", *AUTOPILOT, self.dialect.MAV_MISSION_ACCEPTED, mission_type=0)
        self.transfers.append({"name": name, "at_ns": sent, "count": count.to_dict(), "items": items})
        return int(count.opaque_id), items

    @staticmethod
    def content(item: dict) -> dict:
        # current is selection metadata, deliberately allowed to change.
        return {key: item[key] for key in (
            "seq", "frame", "command", "autocontinue", "param1", "param2",
            "param3", "param4", "x", "y", "z", "mission_type",
        )}

    def verify_uploaded_contents(self, expected: list[dict], actual: list[dict]):
        self.require("roundtrip_item_count", len(actual) == len(expected))
        for wanted, got in zip(expected, actual, strict=True):
            # Production formatting initializes unused params to zero on download.
            normalized = {**wanted, "mission_type": 0, "param3": 0.0}
            if wanted["command"] == self.dialect.MAV_CMD_NAV_TAKEOFF:
                normalized.update(param1=0.0, param2=0.0)
            self.require(
                f"roundtrip_item_{wanted['seq']}_contents",
                serializable(self.content(normalized)) == serializable(self.content(got)),
                expected=normalized, actual=got,
            )

    def identity(self, since: int, mission_id: int):
        _, current = self.wait_for(
            since,
            lambda m: m.get_type() == "MISSION_CURRENT" and m.total == 3 and m.mission_id == mission_id,
            "uploaded mission telemetry identity",
        )
        return {key: int(getattr(current, key)) for key in ("mission_id", "fence_id", "rally_points_id")}

    def request_case(self, name: str, target: tuple[int, int], requested: int,
                     expected: int, identity: dict, *, transition=False):
        self.pump()
        sent = self.send("mission_set_current_send", *target, requested)
        parameter_at = self.send("param_request_read_send", *AUTOPILOT, b"MAV_SYS_ID", -1)
        parameter_received, parameter = self.wait_for(
            parameter_at,
            lambda m: m.get_type() == "PARAM_VALUE" and m.param_id == "MAV_SYS_ID",
            f"{name} read-only receiver response",
        )
        self.require(f"{name}:receiver_parameter_type", parameter.param_type == self.dialect.MAV_PARAM_TYPE_INT32,
                     param_type=parameter.param_type)
        # PX4 byte-encodes INT32 parameters in the float32 wire field.
        # MAV_SYS_ID=1 therefore has float bits 0x00000001, not numeric 1.0.
        parameter_bits = struct.pack("<f", parameter.param_value)
        parameter_integer = struct.unpack("<i", parameter_bits)[0]
        self.require(f"{name}:receiver_read_barrier", parameter_integer == 1,
                     param_value=parameter.param_value, raw_float32_le=parameter_bits.hex(),
                     decoded_int32=parameter_integer)
        self.collect_for(OBSERVATION_SECONDS)
        end = time.monotonic_ns()
        packets = [(at, m) for at, m in self.messages if sent <= at <= end]
        currents = [(at, m) for at, m in packets if m.get_type() == "MISSION_CURRENT"]
        after_barrier = [(at, m) for at, m in currents if at >= parameter_received]
        heartbeats = [(at, m) for at, m in packets if m.get_type() == "HEARTBEAT"]
        record = {"name": name, "target": target, "requested_sequence": requested,
                  "expected_observed_sequence": expected, "tx_at_ns": sent,
                  "receiver_parameter_response_at_ns": parameter_received,
                  "capture_end_ns": end, "observation_seconds_after_barrier": OBSERVATION_SECONDS,
                  "heartbeats": len(heartbeats),
                  "current": [{"at_ns": at, **{field: int(getattr(m, field)) for field in CURRENT_FIELDS}}
                              for at, m in currents],
                  "causal_packet_attribution": "NOT_ESTABLISHED_PERIODIC_AND_MISSION_RESULT_CONFOUNDS"}
        self.cases.append(record)
        self.require(f"{name}:heartbeat_continues_unarmed", bool(heartbeats))
        self.require(f"{name}:continued_current_telemetry", len(after_barrier) >= 2,
                     observed=len(after_barrier), observation_seconds=OBSERVATION_SECONDS)
        self.require(f"{name}:observed_selection", any(m.seq == expected for _, m in after_barrier),
                     observed=[m.seq for _, m in after_barrier])
        if transition:
            self.require(f"{name}:final_selection", after_barrier[-1][1].seq == expected)
        else:
            self.require(f"{name}:selection_unchanged", all(m.seq == expected for _, m in currents))
        self.require(f"{name}:identity_and_metadata", all(
            m.total == 3 and all(int(getattr(m, key)) == value for key, value in identity.items())
            and 0 <= m.mission_state <= 5 and 0 <= m.mission_mode <= 2
            and m.get_msgbuf()[0] == 0xFD for _, m in currents
        ), identity=identity)

    def run(self):
        latitude, longitude = self.startup()
        _, empty = self.download("fresh_rootfs")
        self.require("fresh_rootfs_has_no_mission", not empty)
        items = self.mission_items(latitude, longitude)
        mission_id = self.upload(items)
        identity = self.identity(self.transfers[-1]["ack_at_ns"], mission_id)
        before_id, before = self.download("before_selection")
        self.require("upload_and_download_mission_id_agree", before_id == mission_id)
        self.verify_uploaded_contents(items, before)
        self.request_case("new_sequence", AUTOPILOT, 1, 1, identity, transition=True)
        self.request_case("same_sequence", AUTOPILOT, 1, 1, identity)
        self.request_case("wrong_system", (2, AUTOPILOT[1]), 2, 1, identity)
        self.request_case("wrong_component", (AUTOPILOT[0], 42), 2, 1, identity)
        self.request_case("invalid_count_boundary", AUTOPILOT, 3, 1, identity)
        self.request_case("invalid_uint16_max", AUTOPILOT, 65535, 1, identity)
        after_id, after = self.download("after_selection")
        self.require("mission_identity_preserved", after_id == before_id == mission_id)
        self.require("all_mission_items_preserved", serializable([self.content(m) for m in before])
                     == serializable([self.content(m) for m in after]))
        self.require("download_current_flags_match_selection", [m["seq"] for m in after if m["current"]] == [1])
        self.require("all_planned_cases_observed", [case["name"] for case in self.cases] == list(CASE_NAMES))


def provenance(source: Path, dialect: Path, expected_mission: str, expected_dialect: str) -> dict:
    mavlink = source / "src/modules/mavlink/mavlink"
    commits = {"source": git(source, "rev-parse", "HEAD"),
               "mavlink": git(mavlink, "rev-parse", "HEAD"),
               "pymavlink": git(mavlink / "pymavlink", "rev-parse", "HEAD")}
    if commits != {"source": BASE, "mavlink": MAVLINK, "pymavlink": PYMAVLINK}:
        raise RuntimeError(f"Source/generator pins differ: {commits}")
    for directory in (mavlink, mavlink / "pymavlink"):
        if git(directory, "status", "--porcelain", "--untracked-files=no"):
            raise RuntimeError(f"Modified pinned generator source: {directory}")
    mission = source / "src/modules/mavlink/mavlink_mission.cpp"
    if sha256(mission) != expected_mission or sha256(dialect) != expected_dialect:
        raise RuntimeError("Mission source or generated dialect differs from reviewed expected hash")
    paths = [mission, mavlink / "pymavlink/tools/mavgen.py",
             mavlink / "message_definitions/v1.0/development.xml",
             mavlink / "message_definitions/v1.0/common.xml", dialect]
    return {"commits": commits, "files": {str(path): sha256(path) for path in paths},
            "source_diff": git(source, "diff", "--", "src/modules/mavlink/mavlink_mission.cpp"),
            "decoder_origin": "Generated development.py from recursively pinned MAVLink/pymavlink sources; generation proof supplied by caller"}


def main() -> int:
    def interrupted(_number, _frame):
        raise InterruptedError("Replay interrupted; preserve bounded native cleanup")

    signal.signal(signal.SIGTERM, interrupted)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--build", type=Path)
    parser.add_argument("--dialect", type=Path, required=True)
    parser.add_argument("--expected-mission-sha256", required=True)
    parser.add_argument("--expected-dialect-sha256", required=True)
    parser.add_argument("--shared-probe", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    source, dialect = args.source.resolve(), args.dialect.resolve()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    build = args.build.resolve() if args.build else source / "build/px4_sitl_default"
    binary = build / "bin/px4"
    rootfs = output / "rootfs"
    rootfs.mkdir()
    result = {"claim": "NATIVE_WIRE_COMPATIBILITY_STATUS_AND_MISSION_INTEGRITY_ONLY",
              "planned_cases": CASE_NAMES,
              "harness_sha256": sha256(Path(__file__)),
              "limits": ["No request ID/path marker exists in MISSION_CURRENT; packet timing cannot attribute the packet to the handler",
                         "Periodic and mission_result emissions confound packet-alone causal proof; no one-reply-per-request or latency requirement is asserted",
                         "Finite observation deadlines bound this fixture; missing observations fail controls, not prove a protocol timeout violation",
                         "Mission metadata values are captured, not proof of a coherent uORB snapshot or the pending-status-cache corner case",
                         "Native disarmed SIH/loopback only; no physical vehicle, GCS UI, arming, mode or actuator command"]}
    collector = replay = process = None
    forced = False
    cleanup_errors = []
    environment = os.environ.copy()
    environment.update(PX4_SIM_MODEL="sihsim_quadx", PX4_SIM_SPEED_FACTOR="1")
    environment.pop("PX4_NET_INTERFACE", None)
    try:
        shared_path = args.shared_probe.resolve()
        if sha256(shared_path) != SHARED_SHA256:
            raise RuntimeError("Reviewed raw collector helper hash differs")
        result["shared_probe"] = {"path": str(shared_path), "sha256": SHARED_SHA256}
        shared = load_module(shared_path, "dr11_reviewed_raw_collector")
        result["provenance"] = provenance(source, dialect, args.expected_mission_sha256,
                                           args.expected_dialect_sha256)
        result["binary_sha256"] = sha256(binary)
        if udp_inodes(REMOTE[1]):
            raise RuntimeError("Expected native UDP port is already bound before launch")
        # This low-volume compatibility replay keeps its original Python reader.
        collector = shared.PythonCollector(output)
        result["receive_buffer"] = {"requested": shared.REQUESTED_RECEIVE_BUFFER,
                                    "effective": collector.effective_buffer}
        decoder = shared.load_dialect(dialect)
        command = [str(binary), str(build / "etc"), "-s", "etc/init.d-posix/rcS",
                   "-t", str(source / "test_data"), "-d"]
        result["command"] = command
        with (output / "px4.log").open("wb") as log:
            process = subprocess.Popen(command, cwd=rootfs, env=environment,
                                       stdin=subprocess.DEVNULL, stdout=log,
                                       stderr=subprocess.STDOUT, start_new_session=True)
            stat = Path(f"/proc/{process.pid}/stat").read_text()
            write_json(output / "native-process.json", {
                "pid": process.pid, "pgid": os.getpgid(process.pid),
                "start_token": stat.rsplit(") ", 1)[1].split()[19],
                "binary": str(binary), "command": command,
            })
            replay = Replay(collector, decoder, output, process)
            # startup() also runs in run(); this ownership proof waits only for
            # the real launched process's bind and never contacts another peer.
            deadline = time.monotonic() + STARTUP_SECONDS
            while time.monotonic() < deadline and not udp_inodes(REMOTE[1]):
                if process.poll() is not None:
                    raise RuntimeError("Native process exited before UDP initialization")
                time.sleep(0.1)
            result["native_socket_identity"] = native_socket_identity(process.pid)
            replay.run()
    except Exception:
        result["harness_error"] = traceback.format_exc()
    finally:
        if process is not None:
            prior = ([check["name"] for check in replay.checks if not check["passed"]]
                     if replay is not None else ["replay_setup_incomplete"])
            if result.get("harness_error"):
                prior.append("harness_error")
            result["shutdown"] = shared.shutdown_native(
                process, binary, rootfs, environment, output, output / "px4.log", prior
            )
            if replay is not None:
                replay.checks.append({"name": "normal_shutdown_command",
                                      "passed": result["shutdown"]["accepted"],
                                      "details": result["shutdown"]})
                replay.checks.append({"name": "native_exited_cleanly",
                                      "passed": process.poll() == 0,
                                      "details": {"exit_code": process.poll()}})
        if process is not None and process.poll() is None:
            forced = True
            try:
                os.killpg(process.pid, signal.SIGINT)
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
            except (OSError, subprocess.SubprocessError) as error:
                cleanup_errors.append(repr(error))
        # The client heartbeat sender must stop before its socket is closed.
        for resource in (replay, collector):
            if resource is not None:
                try:
                    resource.close()
                except Exception as error:
                    cleanup_errors.append(repr(error))
        if replay is not None:
            try:
                replay.pump()
            except Exception as error:
                cleanup_errors.append(repr(error))
            with (output / "rx-decoded.jsonl").open("w") as destination:
                for at, message in replay.messages:
                    record = {"at_ns": at, "source": AUTOPILOT, "message": message.to_dict()}
                    destination.write(json.dumps(serializable(record), allow_nan=False, separators=(",", ":")) + "\n")
        result.update(forced_cleanup=forced, cleanup_errors=cleanup_errors,
                      native_exit=process.returncode if process is not None else None,
                      checks=replay.checks if replay is not None else [],
                      cases=replay.cases if replay is not None else [],
                      transfers=replay.transfers if replay is not None else [])
        result["failed_checks"] = [check["name"] for check in result["checks"] if not check["passed"]]
        result["missing_cases"] = sorted(set(CASE_NAMES) - {case["name"] for case in result["cases"]})
        result["status"] = (
            "HARNESS_OR_CONTROL_FAILURE" if result.get("harness_error") or forced
            or cleanup_errors or result["failed_checks"] or result["missing_cases"]
            or result["native_exit"] != 0 else "WIRE_COMPATIBILITY_CHECKS_PASSED"
        )
        write_json(output / "result.json", result)
        print(json.dumps({key: value for key, value in serializable(result).items()
                          if key not in {"checks", "transfers", "cases"}}, indent=2))
    return 0 if result["status"] == "WIRE_COMPATIBILITY_CHECKS_PASSED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
