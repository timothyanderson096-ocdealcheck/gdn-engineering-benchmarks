# Credential-free HA startup and onboarding check

This workflow targets GitHub-hosted Ubuntu 24.04 and can also be started manually
from the repository Actions tab. Its initial publication runs the same check via
a narrow main-branch push/path trigger. A hosted pass must be demonstrated by an
actual run; the local runtime attempt correctly failed on the workspace adapter
permission. This work is separate from the GDN benchmark and does not count as an
accepted vehicle fix.

The workflow uses read-only repository permission, pinned action commits and no
BYD credentials. Artifacts contain only selected reports and redacted logs, with
seven-day retention. The HA config/authentication storage is never uploaded.

From the repository root, harness controls can be run with:

```sh
python -W error::ResourceWarning -m unittest discover -s scripts/byd-owner-startup -p "test_*.py" -v
```

`ha_onboarding_smoke.py` runs the exact pinned BYD fan candidate through normal
Home Assistant startup, a fresh local onboarding account, HTTP handler discovery
and the initial BYD user form. It never submits that form or supplies BYD account
details. This does not validate cloud authentication or any physical fan behavior.

Run with Python standard library only; the selected interpreter must already have
Python 3.14.8, Home Assistant 2026.10.2 and the paired editable pyBYD installed:

```sh
python ha_onboarding_smoke.py \
  --python /absolute/path/to/runtime/bin/python \
  --source-dir /absolute/path/to/byd-sources/hass-byd-vehicle \
  --out /absolute/path/to/new-evidence-directory
```

The paired library must reside at `byd-sources/pyBYD`. Candidate code bytes and
the actual imported library path are checked before launch. `--out` must not
exist; the harness never replaces an existing evidence directory or HA config.

The real `ifaddr.get_adapters()` call must succeed. An EPERM failure stops the
check, preserves its traceback and returns nonzero. No mocked adapter or source
workaround is used. On a functioning host the child HA and HTTP client share the
same process/network namespace, with a fresh configuration bound to loopback.

Mandatory checks are fresh onboarding, synthetic local user/token exchange,
all four onboarding steps complete, normal core state RUNNING without recovery
or safe mode, BYD HTTP handler recognition, serialized initial user form, flow
abort and absence of a configured BYD entry. Every mandatory check must pass.
The synthetic local password and tokens are generated or retained in memory;
the temporary HA configuration and its authentication storage are removed.

The child receives SIGINT, then SIGTERM and SIGKILL if necessary, and is reaped.
The result cannot pass if cleanup fails. Runtime logs retain ordinary warnings
and errors; known auth values and common serialized auth fields are redacted
before any log is placed in the evidence directory. Logs do not trace request
bodies or bearer headers.

Only these files can be produced in the output directory:

- `result.json`: per-check flags, stage, runtime metadata, failure and cleanup.
- `preflight.log`: runtime/adapter probe output; no credentials are generated yet.
- `ha-startup.log`: HA child output with auth-value redaction, if launch occurred.
- `http-trace.json`: HTTP method, path and status only, if launch occurred.

Home Assistant's ordinary onboarding may start optional default integrations;
their warnings remain visible. The check does not claim these integrations were
validated. No HACS/hassfest, frontend rendering, browser interaction, real BYD
account or car test is implied by this REST-level result.

Focused harness controls:

```sh
python -m unittest -v test_ha_onboarding_smoke.py
```

Those tests exercise log redaction, failed HTTP evidence, malformed onboarding
status, local destination restrictions and actual child termination. They are
controls on this harness, not a substituted HA/vehicle success result.

Prepared with Codex assistance for Timothy Anderson — Spotted Ridge Engineering / OC Labs.
GDN (Global Decision Network) · timothyanderson096@gmail.com
