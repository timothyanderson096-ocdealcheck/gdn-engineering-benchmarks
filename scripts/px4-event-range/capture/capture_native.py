"""Raw UDP capture using one native reader and the existing PX4UDP1 journal.

The caller compiles capture_native.cpp and supplies PX4_CAPTURE_NATIVE or the
native_binary keyword. No decoder, source changes or OS tuning occurs here.
"""

from __future__ import annotations

import json
import os
import signal
import socket
import struct
import subprocess
import threading
import time
from pathlib import Path

LOCAL = ("127.0.0.1", 14540)
REMOTE = ("127.0.0.1", 14580)
SO_RXQ_OVFL = 40
REQUESTED_RECEIVE_BUFFER = 16 * 1024 * 1024
JOURNAL_MAGIC = b"PX4UDP1\n"
JOURNAL_HEADER = struct.Struct("<Q4sHHI")


class JournalReader:
    """Append-only decoding of complete journal records; partial writes wait."""

    def __init__(self):
        self.pending = bytearray()
        self.magic_seen = False
        self.records = []
        self.observed_loss = False

    def feed(self, data: bytes, *, final=False):
        self.pending.extend(data)
        if not self.magic_seen:
            if len(self.pending) < len(JOURNAL_MAGIC):
                if final:
                    raise RuntimeError("Incomplete native journal magic")
                return
            if self.pending[: len(JOURNAL_MAGIC)] != JOURNAL_MAGIC:
                raise RuntimeError("Native journal magic differs")
            del self.pending[: len(JOURNAL_MAGIC)]
            self.magic_seen = True
        consumed = 0
        while len(self.pending) - consumed >= JOURNAL_HEADER.size:
            at, ip, port, length, drops = JOURNAL_HEADER.unpack_from(
                self.pending, consumed
            )
            end = consumed + JOURNAL_HEADER.size + length
            if end > len(self.pending):
                break
            if self.records and at < self.records[-1][0]:
                raise RuntimeError("Native monotonic timestamp moved backwards")
            self.records.append(
                (
                    at,
                    (socket.inet_ntoa(ip), port),
                    drops,
                    bytes(self.pending[consumed + JOURNAL_HEADER.size : end]),
                )
            )
            self.observed_loss = self.observed_loss or drops != 0
            consumed = end
        if consumed:
            del self.pending[:consumed]
        if final and self.pending:
            raise RuntimeError("Incomplete final native journal record")


class Collector:
    """Preserve the Python collector interface while moving recv to C++."""

    def __init__(self, output: Path, *, native_binary=None):
        self.output = Path(output).resolve()
        executable = native_binary or os.environ.get("PX4_CAPTURE_NATIVE")
        if not executable:
            raise RuntimeError(
                "Set PX4_CAPTURE_NATIVE to the reviewed compiled capture executable"
            )
        executable = Path(executable).resolve()
        if not executable.is_file():
            raise RuntimeError("Native capture executable is missing")
        self.journal = self.output / "wire.udp"
        self.status_path = self.output / "capture-native.json"
        for path in (self.journal, self.status_path, self.output / "tx.jsonl"):
            if path.exists():
                raise RuntimeError(f"Capture output must be new: {path.name}")
        self.transmitted = []
        self._reader = JournalReader()
        self._stream = None
        self._error = None
        self._closing = False
        self._closed = False
        self._lock = threading.RLock()
        self.capture_status = None
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._log = None
        self.process = None
        try:
            self.socket.setsockopt(
                socket.SOL_SOCKET, socket.SO_RCVBUF, REQUESTED_RECEIVE_BUFFER
            )
            self.socket.setsockopt(socket.SOL_SOCKET, SO_RXQ_OVFL, 1)
            self.socket.bind(LOCAL)
            self.socket.setblocking(False)
            self.effective_buffer = self.socket.getsockopt(
                socket.SOL_SOCKET, socket.SO_RCVBUF
            )
            self._log = (self.output / "capture-native.log").open("xb")
            self.process = subprocess.Popen(
                [
                    str(executable),
                    str(self.socket.fileno()),
                    str(self.journal),
                    str(self.status_path),
                ],
                pass_fds=(self.socket.fileno(),),
                stdin=subprocess.DEVNULL,
                stdout=self._log,
                stderr=subprocess.STDOUT,
                # Inherit the wire probe's process group so its outer watchdog
                # also bounds this reader if Python cannot run close().
            )
        except BaseException:
            self.socket.close()
            if self._log is not None:
                self._log.close()
            raise

    def _fail(self, message):
        if self._error is None:
            self._error = message

    def _check_child(self):
        if self.process is not None:
            code = self.process.poll()
            if code is not None and not self._closing:
                self._fail(f"Native capture exited unexpectedly with status {code}")

    def _refresh(self, *, final=False):
        self._check_child()
        if self._stream is None and self.journal.exists():
            self._stream = self.journal.open("rb", buffering=0)
        if self._stream is not None:
            try:
                self._reader.feed(self._stream.read(), final=final)
                if self._reader.observed_loss:
                    self._fail("Observed native SO_RXQ_OVFL receive loss")
            except (OSError, ValueError, RuntimeError) as error:
                self._fail(str(error))
        elif final:
            self._fail("Native capture produced no journal")

    @property
    def records(self):
        with self._lock:
            if not self._closed:
                self._refresh()
            return self._reader.records

    @property
    def reader_error(self):
        with self._lock:
            if not self._closed:
                self._refresh()
            return self._error

    def write(self, raw):
        with self._lock:
            if self._closed or self._closing:
                raise RuntimeError("Native capture is closing")
            # Do not parse a receive burst before transmitting a timed input.
            # Records/reader_error/close still validate the complete journal.
            self._check_child()
            if self._error:
                raise RuntimeError(self._error)
            sent_at = time.monotonic_ns()
            count = self.socket.sendto(raw, REMOTE)
            if count != len(raw):
                raise RuntimeError("Short UDP send")
            self.transmitted.append(
                {"at_ns": sent_at, "destination": REMOTE, "hex": raw.hex()}
            )
            return count

    def close(self):
        with self._lock:
            if self._closed:
                if self._error:
                    raise RuntimeError(self._error)
                return
            self._refresh()
            # A zero exit observed before our stop request is still unexpected.
            # Keep this check before _closing suppresses normal post-stop exits.
            before_stop = self.process.poll()
            if before_stop is not None:
                self._fail("Native capture exited before parent stop request")
            self._closing = True
            try:
                if before_stop is None:
                    self.process.send_signal(signal.SIGTERM)
                    # Popen.send_signal polls once more to avoid PID reuse; if
                    # it observed an exit, it skipped the signal entirely.
                    if self.process.returncode is not None:
                        self._fail("Native capture exited before stop signal delivery")
                    try:
                        self.process.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        self._fail("Native capture required forced termination")
                        self.process.kill()
                        self.process.wait(timeout=2)
                if self.process.returncode != 0:
                    self._fail(f"Native capture exit status {self.process.returncode}")
                self._refresh(final=True)
                if not self.status_path.is_file():
                    self._fail("Native capture status is missing")
                else:
                    self.capture_status = json.loads(self.status_path.read_text())
                    if self.capture_status.get(
                        "status"
                    ) != "STOPPED" or not self.capture_status.get("stop_requested"):
                        self._fail(f"Native capture failed: {self.capture_status}")
                    if self.capture_status.get("packets") != len(self._reader.records):
                        self._fail("Native capture journal/status packet counts differ")
            except (OSError, ValueError, subprocess.SubprocessError) as error:
                self._fail(str(error))
            finally:
                self.socket.close()
                if self._stream is not None:
                    self._stream.close()
                self._log.close()
                with (self.output / "tx.jsonl").open("x") as destination:
                    for record in self.transmitted:
                        destination.write(
                            json.dumps(record, separators=(",", ":")) + "\n"
                        )
                self._closed = True
            if self._error:
                raise RuntimeError(self._error)
