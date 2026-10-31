"""Focused harness controls; these tests are not Home Assistant validation."""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import signal
import subprocess
import sys
import threading
import unittest

from ha_onboarding_smoke import (
    CheckFailure,
    HTTPFailure,
    LocalAPI,
    Redactor,
    onboarding_status,
    stop_child,
)


class HarnessTests(unittest.TestCase):
    def test_log_redaction_preserves_ordinary_evidence(self) -> None:
        redactor = Redactor()
        redactor.register("random-password-value")
        redactor.auth_response({"auth_code": "generated-code", "access_token": "local-token"})
        log = (
            "PermissionError: operation not permitted\n"
            "random-password-value generated-code local-token\n"
            'payload={"refresh_token":"not-yet-registered"}\n'
            "Authorization: Bearer unusual.token.value\n"
        )
        cleaned = redactor.clean(log)
        self.assertIn("PermissionError: operation not permitted", cleaned)
        for value in ("random-password-value", "generated-code", "local-token", "not-yet-registered", "unusual.token.value"):
            self.assertNotIn(value, cleaned)

    def test_incomplete_duplicate_or_nonboolean_onboarding_is_rejected(self) -> None:
        correct = [{"step": step, "done": False} for step in ("user", "core_config", "analytics", "integration")]
        self.assertEqual(set(onboarding_status(correct)), {"user", "core_config", "analytics", "integration"})
        for invalid in (correct[:-1], correct + [correct[0]], [{"step": "user", "done": 1}] + correct[1:]):
            with self.subTest(invalid=invalid), self.assertRaises(CheckFailure):
                onboarding_status(invalid)

    def test_local_api_never_accepts_a_remote_destination(self) -> None:
        api = LocalAPI("http://127.0.0.1:1", 1)
        with self.assertRaises(CheckFailure):
            api.request("GET", "https://remote.invalid/path")
        with self.assertRaises(CheckFailure):
            api.request("GET", "/https://remote.invalid/path")

    def test_http_failure_does_not_copy_secret_response_body(self) -> None:
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b'{"password":"do-not-retain-this-body"}')

            def log_message(self, *_args: object) -> None:
                return

        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            api = LocalAPI(f"http://127.0.0.1:{server.server_port}", 2)
            with self.assertRaises(HTTPFailure) as error:
                api.request("GET", "/failure")
            self.assertEqual(error.exception.status, 500)
            self.assertNotIn("do-not-retain", str(error.exception))
            self.assertEqual(api.trace, [{"method": "GET", "path": "/failure", "status": 500}])
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_cleanup_kills_and_reaps_an_uncooperative_child(self) -> None:
        child = subprocess.Popen(
            [sys.executable, "-u", "-c", (
                "import signal,time; "
                "signal.signal(signal.SIGINT,signal.SIG_IGN); "
                "signal.signal(signal.SIGTERM,signal.SIG_IGN); "
                "print('ready',flush=True); time.sleep(120)"
            )],
            stdout=subprocess.PIPE,
            start_new_session=True,
        )
        try:
            self.assertEqual(child.stdout.readline(), b"ready\n")
            result = stop_child(child, (0.05, 0.05, 2))
            self.assertTrue(result["stopped"])
            self.assertEqual(result["signals_sent"], ["SIGINT", "SIGTERM", "SIGKILL"])
            self.assertEqual(result["exit_code"], -signal.SIGKILL)
        finally:
            if child.poll() is None:
                child.kill()
                child.wait(timeout=2)
            child.stdout.close()


if __name__ == "__main__":
    unittest.main()
