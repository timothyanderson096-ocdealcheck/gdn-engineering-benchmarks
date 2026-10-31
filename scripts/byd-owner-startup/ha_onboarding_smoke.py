#!/usr/bin/env python3
"""Run a real local HA onboarding/config-flow check without a BYD account.

Only a new temporary HA configuration is used. Authentication material stays in
memory or that temporary configuration; only redacted logs/results are retained.
No BYD user form is submitted, and this is not physical fan validation.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import signal
import socket
import subprocess
import tempfile
import time
from typing import Any
import urllib.error
import urllib.parse
import urllib.request


HA_VERSION = "2026.10.2"
PYTHON_VERSION = "3.14.8"
HVAC_SHA256 = "23aa1b210b06f80d3a2ea4d0813c2fe7375a3284dfdcba591831dfa82791c780"
CLIMATE_SHA256 = "2fdeb7c3bfa3a10e06a281ff901fb0ad5acedff6cc1f5b4272182f7bfe17b9db"
STEPS = {"user", "core_config", "analytics", "integration"}
CHECKS = (
    "source_and_runtime_preflight",
    "network_adapter_enumeration",
    "fresh_onboarding",
    "local_user_created",
    "local_token_exchange",
    "onboarding_completed",
    "normal_core_running",
    "byd_http_flow_handler_discovered",
    "byd_initial_user_form",
    "byd_flow_aborted",
    "no_byd_config_entry",
)


class CheckFailure(RuntimeError):
    """A failed required claim; messages never include response bodies."""


class HTTPFailure(CheckFailure):
    def __init__(self, method: str, path: str, status: int) -> None:
        self.status = status
        super().__init__(f"{method} {path.split('?')[0]} returned HTTP {status}")


class Redactor:
    def __init__(self) -> None:
        self.values: set[str] = set()

    def register(self, value: Any) -> None:
        if isinstance(value, str) and value:
            self.values.add(value)

    def auth_response(self, response: Any) -> None:
        if isinstance(response, dict):
            for key in ("auth_code", "access_token", "refresh_token"):
                self.register(response.get(key))

    def clean(self, text: str) -> str:
        for value in sorted(self.values, key=len, reverse=True):
            text = text.replace(value, "[REDACTED]")
        # Also protect common serialized auth fields if a failure logs a payload
        # before a response was parsed and explicitly registered.
        text = re.sub(
            r'(?i)(["\']?(?:access_token|refresh_token|auth_code|password)["\']?\s*[:=]\s*["\'])([^"\'\r\n]+)',
            r"\1[REDACTED]",
            text,
        )
        return re.sub(r"(?i)(Bearer\s+)[A-Za-z0-9._~+/-]+", r"\1[REDACTED]", text)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise CheckFailure(message)


def onboarding_status(value: Any) -> dict[str, bool]:
    require(isinstance(value, list), "Onboarding status must be a list")
    result: dict[str, bool] = {}
    for item in value:
        require(isinstance(item, dict), "Invalid onboarding status row")
        step, done = item.get("step"), item.get("done")
        require(step in STEPS and type(done) is bool, "Invalid onboarding step or flag")
        require(step not in result, "Duplicate onboarding step")
        result[step] = done
    require(set(result) == STEPS, "Missing onboarding steps")
    return result


def stop_child(
    process: subprocess.Popen[bytes], grace: tuple[float, float, float] = (25, 10, 5)
) -> dict[str, Any]:
    """Stop only our child process group, and observe its final exit status."""
    sent: list[str] = []
    if process.poll() is None:
        for sig, wait in zip((signal.SIGINT, signal.SIGTERM, signal.SIGKILL), grace, strict=True):
            try:
                os.killpg(process.pid, sig)
            except ProcessLookupError:
                pass
            else:
                sent.append(sig.name)
            try:
                process.wait(timeout=wait)
                break
            except subprocess.TimeoutExpired:
                continue
    require(process.poll() is not None, "HA child did not stop after SIGKILL")
    return {"signals_sent": sent, "exit_code": process.returncode, "stopped": True}


class LocalAPI:
    def __init__(self, base: str, timeout: float) -> None:
        self.base = base
        self.timeout = timeout
        self.token: str | None = None
        self.trace: list[dict[str, Any]] = []
        # These requests target our own loopback service, not a remote proxy.
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def request(self, method: str, path: str, data: Any = None, *, form: bool = False) -> Any:
        require(path.startswith("/") and "://" not in path, "Only local API paths are accepted")
        headers: dict[str, str] = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        body = None
        if data is not None:
            if form:
                body = urllib.parse.urlencode(data).encode()
                headers["Content-Type"] = "application/x-www-form-urlencoded"
            else:
                body = json.dumps(data).encode()
                headers["Content-Type"] = "application/json"
        request = urllib.request.Request(self.base + path, data=body, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                code = response.status
                content = response.read()
        except urllib.error.HTTPError as error:
            status = error.code
            error.close()
            self.trace.append({"method": method, "path": path.split("?")[0], "status": status})
            raise HTTPFailure(method, path, status) from None
        self.trace.append({"method": method, "path": path.split("?")[0], "status": code})
        require(code == 200, f"{method} {path.split('?')[0]} returned HTTP {code}")
        try:
            return json.loads(content)
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise CheckFailure(f"{method} {path.split('?')[0]} returned non-JSON content") from None


def preflight(python: Path, source: Path, out: Path) -> dict[str, Any]:
    climate = source / "custom_components/byd_vehicle/climate.py"
    manifest = source / "custom_components/byd_vehicle/manifest.json"
    require(climate.is_file() and manifest.is_file(), "BYD integration source is missing")
    require(hashlib.sha256(climate.read_bytes()).hexdigest() == CLIMATE_SHA256, "Unexpected BYD climate candidate bytes")
    manifest_data = json.loads(manifest.read_text())
    require(manifest_data.get("domain") == "byd_vehicle" and manifest_data.get("config_flow") is True, "Unexpected integration manifest")
    probe = r'''
import hashlib, inspect, json, platform
from importlib.metadata import version
from pathlib import Path
import ifaddr
from pybyd._capabilities.hvac import HvacCapability
adapters = ifaddr.get_adapters()
print(json.dumps({"python": platform.python_version(), "homeassistant": version("homeassistant"),
 "pybyd_metadata": version("pybyd"), "adapter_count": len(adapters),
 "fan_method_callable": callable(getattr(HvacCapability, "set_fan_level", None)),
 "pybyd_hvac_path": str(Path(inspect.getfile(HvacCapability)).resolve()),
 "hvac_sha256": hashlib.sha256(Path(inspect.getfile(HvacCapability)).read_bytes()).hexdigest()}))
'''
    result = subprocess.run([str(python), "-c", probe], capture_output=True, text=True, timeout=45)
    (out / "preflight.log").write_text(result.stdout + result.stderr)
    require(result.returncode == 0, f"Runtime/adapter preflight failed with exit {result.returncode}; see preflight.log")
    try:
        details = json.loads(result.stdout)
    except json.JSONDecodeError:
        raise CheckFailure("Runtime preflight returned invalid metadata") from None
    require(details.get("python") == PYTHON_VERSION, "Unexpected Python runtime")
    require(details.get("homeassistant") == HA_VERSION, "Unexpected HA runtime")
    require(details.get("hvac_sha256") == HVAC_SHA256 and details.get("fan_method_callable") is True, "Paired pyBYD fan candidate is not installed")
    expected_hvac = (source.parent / "pyBYD/src/pybyd/_capabilities/hvac.py").resolve()
    require(details.get("pybyd_hvac_path") == str(expected_hvac), "pyBYD is not loaded from the paired sibling source checkout")
    require(type(details.get("adapter_count")) is int and details["adapter_count"] > 0, "No network adapters were enumerated")
    return details


def run(args: argparse.Namespace) -> int:
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=False)
    # Preserve a virtualenv interpreter symlink: resolving it would select its
    # base interpreter and silently lose the installed HA/pyBYD environment.
    python, source = args.python.absolute(), args.source_dir.resolve()
    redactor = Redactor()
    record: dict[str, Any] = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "status": "FAILED",
        "checks": dict.fromkeys(CHECKS, False),
        "last_stage": "preflight",
        "byd_credentials_supplied": False,
        "vehicle_cloud_validation": False,
        "frontend_rendered": False,
    }
    process: subprocess.Popen[bytes] | None = None
    api: LocalAPI | None = None
    raw_log: Path | None = None
    log_file = None
    failure: Exception | None = None

    def stage(name: str) -> None:
        record["last_stage"] = name
        print(f"Checking {name}", flush=True)

    with tempfile.TemporaryDirectory(prefix="byd-ha-smoke-") as temporary:
        config = Path(temporary)
        try:
            record["runtime"] = preflight(python, source, out)
            record["checks"]["source_and_runtime_preflight"] = True
            record["checks"]["network_adapter_enumeration"] = True
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0))
                port = sock.getsockname()[1]
            api = LocalAPI(f"http://127.0.0.1:{port}", args.request_timeout)
            client_id = api.base + "/"
            (config / "configuration.yaml").write_text(
                "homeassistant:\n  name: BYD CI Setup Check\n  latitude: 0\n  longitude: 0\n"
                "  elevation: 0\n  unit_system: metric\n  time_zone: UTC\n  country: US\n"
                f"\ndefault_config:\n\nhttp:\n  server_host: 127.0.0.1\n  server_port: {port}\n"
            )
            components = config / "custom_components"
            components.mkdir()
            (components / "byd_vehicle").symlink_to(source / "custom_components/byd_vehicle", target_is_directory=True)
            raw_log = config / "child-output.log"
            log_file = raw_log.open("wb")
            process = subprocess.Popen(
                [str(python), "-m", "homeassistant", "--config", str(config), "--skip-pip-packages", "pybyd"],
                stdout=log_file, stderr=subprocess.STDOUT, start_new_session=True,
            )
            stage("fresh_onboarding")
            deadline = time.monotonic() + args.startup_timeout
            while True:
                require(process.poll() is None, "HA child exited before onboarding became available")
                try:
                    initial = onboarding_status(api.request("GET", "/api/onboarding"))
                    break
                except HTTPFailure as error:
                    if error.status not in (404, 503):
                        raise
                    if time.monotonic() >= deadline:
                        raise CheckFailure("HA onboarding endpoint did not become ready before startup timeout") from None
                    time.sleep(1)
                except (urllib.error.URLError, TimeoutError):
                    if time.monotonic() >= deadline:
                        raise CheckFailure("HA onboarding endpoint did not become ready before startup timeout") from None
                    time.sleep(1)
            require(not any(initial.values()), "HA configuration was not fresh")
            record["checks"]["fresh_onboarding"] = True

            stage("local_user_created")
            password = secrets.token_urlsafe(40)
            redactor.register(password)
            user = api.request("POST", "/api/onboarding/users", {
                "name": "BYD CI Setup Check", "username": "byd_ci_setup_check",
                "password": password, "client_id": client_id, "language": "en",
            })
            redactor.auth_response(user)
            require(isinstance(user, dict) and isinstance(user.get("auth_code"), str) and bool(user["auth_code"]), "Local user creation did not return an authorization code")
            record["checks"]["local_user_created"] = True

            stage("local_token_exchange")
            token = api.request("POST", "/auth/token", {"client_id": client_id, "grant_type": "authorization_code", "code": user["auth_code"]}, form=True)
            redactor.auth_response(token)
            require(isinstance(token, dict) and isinstance(token.get("access_token"), str) and bool(token["access_token"]), "Local token exchange failed")
            api.token = token["access_token"]
            record["checks"]["local_token_exchange"] = True

            stage("onboarding_completed")
            for step in ("core_config", "analytics"):
                api.request("POST", f"/api/onboarding/{step}")
            integration = api.request("POST", "/api/onboarding/integration", {"client_id": client_id, "redirect_uri": client_id})
            redactor.auth_response(integration)
            final = onboarding_status(api.request("GET", "/api/onboarding"))
            require(all(final.values()), "Not all HA onboarding steps completed")
            record["onboarding_steps"] = final
            record["checks"]["onboarding_completed"] = True

            stage("normal_core_running")
            deadline = time.monotonic() + args.startup_timeout
            while True:
                require(process.poll() is None, "HA child exited during startup")
                config_data = api.request("GET", "/api/config")
                require(isinstance(config_data, dict), "Invalid HA config response")
                require(config_data.get("recovery_mode") is False and config_data.get("safe_mode") is False, "HA entered recovery or safe mode")
                require(config_data.get("version") == HA_VERSION, "Wrong running HA version")
                if config_data.get("state") == "RUNNING":
                    break
                require(time.monotonic() < deadline, "HA core did not reach RUNNING")
                time.sleep(1)
            record["checks"]["normal_core_running"] = True

            stage("byd_http_flow_handler_discovered")
            handlers = api.request("GET", "/api/config/config_entries/flow_handlers")
            require(isinstance(handlers, list) and "byd_vehicle" in handlers, "HTTP flow handlers did not include BYD Vehicle")
            record["checks"]["byd_http_flow_handler_discovered"] = True

            stage("byd_initial_user_form")
            form = api.request("POST", "/api/config/config_entries/flow", {"handler": "byd_vehicle", "show_advanced_options": False})
            require(isinstance(form, dict) and form.get("type") == "form" and form.get("step_id") == "user", "BYD initial user form did not open")
            require(form.get("handler") == "byd_vehicle", "HTTP form belongs to an unexpected handler")
            require(not form.get("errors"), "BYD initial user form has errors")
            schema = form.get("data_schema")
            require(isinstance(schema, list), "BYD form schema is not serialized for HTTP")
            fields = sorted(field.get("name", "") for field in schema if isinstance(field, dict))
            require({"username", "password", "country_code"}.issubset(fields), "BYD form is missing required fields")
            flow_id = form.get("flow_id")
            require(isinstance(flow_id, str) and bool(re.fullmatch(r"[A-Za-z0-9_-]+", flow_id)), "BYD form has no valid flow identifier")
            record["form_fields"] = fields
            record["checks"]["byd_initial_user_form"] = True

            stage("byd_flow_aborted")
            api.request("DELETE", f"/api/config/config_entries/flow/{flow_id}")
            record["checks"]["byd_flow_aborted"] = True
            stage("no_byd_config_entry")
            entries = api.request("GET", "/api/config/config_entries/entry?domain=byd_vehicle")
            require(entries == [], "A BYD config entry unexpectedly exists")
            record["checks"]["no_byd_config_entry"] = True
        except Exception as error:
            failure = error
            record["failure"] = {"type": type(error).__name__, "message": redactor.clean(str(error))}
        finally:
            if process is not None:
                if process.poll() is not None and failure is None:
                    failure = CheckFailure("HA child exited before requested cleanup")
                    record["failure"] = {"type": type(failure).__name__, "message": str(failure)}
                try:
                    record["cleanup"] = stop_child(process)
                except Exception as error:
                    failure = failure or error
                    record["cleanup"] = {"stopped": False, "error": redactor.clean(str(error))}
                    if "failure" not in record:
                        record["failure"] = {"type": type(error).__name__, "message": redactor.clean(str(error))}
            else:
                record["cleanup"] = {"stopped": True, "process_started": False}
            if log_file is not None:
                log_file.close()
            if raw_log is not None and raw_log.exists():
                (out / "ha-startup.log").write_text(redactor.clean(raw_log.read_text(errors="replace")))
            if api is not None:
                # Trace contains methods, paths and status codes only.
                (out / "http-trace.json").write_text(json.dumps(api.trace, indent=2) + "\n")
    passed = failure is None and all(record["checks"].values()) and record["cleanup"]["stopped"]
    record["status"] = "PASSED" if passed else "FAILED"
    record["finished_at"] = datetime.now(timezone.utc).isoformat()
    (out / "result.json").write_text(redactor.clean(json.dumps(record, indent=2)) + "\n")
    print(f"HA onboarding smoke: {record['status']}; last stage: {record['last_stage']}", flush=True)
    return 0 if passed else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--python", type=Path, required=True)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True, help="New output directory; must not exist")
    parser.add_argument("--startup-timeout", type=float, default=300)
    parser.add_argument("--request-timeout", type=float, default=90)
    args = parser.parse_args()
    if not 1 <= args.startup_timeout <= 900 or not 1 <= args.request_timeout <= 180:
        parser.error("Startup timeout must be 1..900 and request timeout 1..180 seconds")
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
