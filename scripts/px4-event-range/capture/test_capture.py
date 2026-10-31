"""Synthetic UDP/helper controls, separate from actual PX4 wire validation."""

import importlib.util
import io
import json
import socket
import struct
import subprocess
import tempfile
import threading
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location(
    "native_capture_under_test", ROOT / "capture_native.py"
)
capture = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(capture)


class JournalTests(unittest.TestCase):
    def test_every_split_and_zero_length_datagram(self):
        raw = capture.JOURNAL_MAGIC
        expected = []
        for sequence, payload in enumerate((b"", b"\0binary\xff", bytes(range(256)))):
            at, port, drops = 1000 + sequence, 14580 + sequence, sequence
            raw += (
                capture.JOURNAL_HEADER.pack(
                    at, socket.inet_aton("127.0.0.1"), port, len(payload), drops
                )
                + payload
            )
            expected.append((at, ("127.0.0.1", port), drops, payload))
        for split in range(len(raw) + 1):
            with self.subTest(split=split):
                reader = capture.JournalReader()
                reader.feed(raw[:split])
                reader.feed(raw[split:], final=True)
                self.assertEqual(reader.records, expected)
                self.assertTrue(reader.observed_loss)
        reader = capture.JournalReader()
        for byte in raw:
            reader.feed(bytes((byte,)))
        reader.feed(b"", final=True)
        self.assertEqual(reader.records, expected)

    def test_partial_final_and_invalid_magic_fail(self):
        for raw in (
            b"PX4",
            b"WRONGMAG",
            capture.JOURNAL_MAGIC + b"\0" * 19,
            capture.JOURNAL_MAGIC
            + capture.JOURNAL_HEADER.pack(1, b"\x7f\0\0\x01", 1, 4, 0)
            + b"abc",
        ):
            with self.subTest(raw=raw), self.assertRaises(RuntimeError):
                capture.JournalReader().feed(raw, final=True)

    def test_closed_collector_records_are_still_readable(self):
        collector = capture.Collector.__new__(capture.Collector)
        collector._lock = threading.RLock()
        collector._closed = True
        collector._reader = capture.JournalReader()
        collector._reader.feed(capture.JOURNAL_MAGIC, final=True)

        def no_io_after_close(*args, **kwargs):
            raise AssertionError("closed collector attempted journal I/O")

        collector._refresh = no_io_after_close
        self.assertEqual(collector.records, [])

    def test_transmit_does_not_parse_receive_journal(self):
        class SocketDouble:
            def sendto(self, raw, remote):
                return len(raw)

        collector = capture.Collector.__new__(capture.Collector)
        collector._lock = threading.RLock()
        collector._closed = collector._closing = False
        collector._error = None
        collector.process = None
        collector.socket = SocketDouble()
        collector.transmitted = []

        def no_journal_io_before_transmit(*args, **kwargs):
            raise AssertionError("transmit attempted receive journal parsing")

        collector._refresh = no_journal_io_before_transmit
        self.assertEqual(collector.write(b"timed-input"), 11)
        self.assertEqual(collector.transmitted[-1]["hex"], b"timed-input".hex())

    def test_close_rejects_zero_exit_observed_before_stop(self):
        class ProcessDouble:
            returncode = None
            signals = 0
            polls = 0

            def poll(self):
                self.polls += 1
                if self.polls > 1:
                    self.returncode = 0
                return self.returncode

            def send_signal(self, signal_number):
                self.signals += 1

        class SocketDouble:
            def close(self):
                pass

        build = ROOT / ".test-build"
        build.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=build) as directory:
            output = Path(directory)
            (output / "wire.udp").write_bytes(capture.JOURNAL_MAGIC)
            status = output / "capture-native.json"
            status.write_text(
                json.dumps({"status": "STOPPED", "stop_requested": True, "packets": 0})
            )
            collector = capture.Collector.__new__(capture.Collector)
            collector.output = output
            collector.journal = output / "wire.udp"
            collector.status_path = status
            collector._reader = capture.JournalReader()
            collector._stream = None
            collector._error = None
            collector._closing = collector._closed = False
            collector._lock = threading.RLock()
            collector._log = io.StringIO()
            collector.socket = SocketDouble()
            collector.process = ProcessDouble()
            collector.transmitted = []
            with self.assertRaisesRegex(RuntimeError, "before parent stop"):
                collector.close()
            self.assertEqual(collector.process.signals, 0)


class NativeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.build = ROOT / ".test-build"
        cls.build.mkdir(exist_ok=True)
        cls.binary = cls.build / "capture_native"
        subprocess.run(
            [
                "g++",
                "-std=c++17",
                "-O2",
                "-Wall",
                "-Wextra",
                "-Werror",
                str(ROOT / "capture_native.cpp"),
                "-o",
                str(cls.binary),
            ],
            check=True,
        )

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(dir=self.build)
        self.output = Path(self.directory.name)
        self.old_local, self.old_remote = capture.LOCAL, capture.REMOTE
        capture.LOCAL = ("127.0.0.1", 0)  # Synthetic helper control only.
        self.sender = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sender.bind(("127.0.0.1", 0))
        self.sender.settimeout(2)
        capture.REMOTE = self.sender.getsockname()
        self.collector = capture.Collector(self.output, native_binary=self.binary)

    def tearDown(self):
        try:
            self.collector.close()
        except RuntimeError:
            pass  # A negative child-exit test explicitly checks the error below.
        self.sender.close()
        capture.LOCAL, capture.REMOTE = self.old_local, self.old_remote
        self.directory.cleanup()

    def test_actual_udp_bytes_source_and_same_fd_transmit(self):
        payloads = [b"", bytes(range(256)), b"\0\xff" * 1024]
        payloads.extend(struct.pack("<I", n) + b"batch" * 10 for n in range(64))
        # Include the maximum valid IPv4 UDP payload, never a truncated probe.
        payloads.append(bytes(n % 251 for n in range(65507)))
        address = self.collector.socket.getsockname()
        for payload in payloads:
            self.sender.sendto(payload, address)
        deadline = time.monotonic() + 3
        while (
            len(self.collector.records) < len(payloads) and time.monotonic() < deadline
        ):
            time.sleep(0.01)
        self.assertIsNone(self.collector.reader_error)
        records = list(self.collector.records)
        self.assertEqual([r[3] for r in records], payloads)
        self.assertTrue(
            all(r[1] == self.sender.getsockname() and r[2] == 0 for r in records)
        )
        self.assertEqual(self.collector.write(b"parent-sender"), 13)
        self.assertEqual(self.sender.recvfrom(100), (b"parent-sender", address))
        self.collector.close()
        self.assertEqual(self.collector.capture_status["packets"], len(payloads))
        reader = capture.JournalReader()
        reader.feed((self.output / "wire.udp").read_bytes(), final=True)
        self.assertEqual(reader.records, records)
        self.assertEqual(
            json.loads((self.output / "tx.jsonl").read_text())["hex"],
            b"parent-sender".hex(),
        )

    def test_unexpected_native_exit_is_failed(self):
        self.collector.process.kill()
        self.collector.process.wait(timeout=2)
        self.assertIn("exited unexpectedly", self.collector.reader_error)
        with self.assertRaises(RuntimeError):
            self.collector.close()
        with self.assertRaises(RuntimeError):
            self.collector.write(b"must-not-send")


if __name__ == "__main__":
    unittest.main()
