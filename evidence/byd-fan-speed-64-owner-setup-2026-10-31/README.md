# BYD fan-speed owner setup — installation checked, full startup blocked

Updated 31 October 2026. Owner-testing setup supplement for the existing fan-speed candidate in jkaberg/pyBYD#64. This work is separate from the repository’s controlled benchmark and is not counted as an accepted fix.

The existing owner guide explains physical checks, but its development setup points to a container-specific launcher that does not install or mount the integration. This supplement connects the already tested paired patches to a fresh local Home Assistant configuration.

**Observed result:** Python 3.14.8 and Home Assistant 2026.10.2 installed successfully with the paired editable pyBYD. Package compatibility checks passed. The actual HA loader recognized the BYD manifest in process, imported its config-flow module and built the initial seven-field user form. This did not run HTTP or the full flow manager. Normal HA startup was attempted and failed before onboarding because this workspace denies network-adapter enumeration (`ifaddr.get_adapters()` / `getifaddrs`: `PermissionError: [Errno 1] Operation not permitted`). Full startup, HTTP discovery, onboarding, frontend rendering, cloud authentication and physical fan behavior remain unverified. No supported HA configuration workaround was found; use a compatible host. No credentials or car access were supplied.

## Prerequisites

Use a development computer with a compatible POSIX environment, Git, uv, network access for public source/packages, Python 3.14 support and permission for HA to enumerate local network adapters. The original integration tests used Python 3.14.8 / Home Assistant 2026.10.2. Native Windows commands are not supplied here; Windows-specific adaptation remains pending. The commands create a new directory and must not be adapted to an existing production HA configuration.

The recorded installation used disposable absolute paths and explicitly provisioned Python 3.14.8. The two public source checkouts and pinned patches matched the recipe below. Editable installation happened before patch application in this run; the executable source path and final four candidate file hashes were checked afterward. Startup used a fresh neutral configuration bound to 127.0.0.1:18123. This is phase-level evidence, not a claim that the entire recipe completed onboarding verbatim.

## Prepare fresh source

Run from a chosen parent directory. Stop on any failure. The initial mkdir deliberately fails if that destination already exists.

```sh
set -eu
mkdir byd-fan-owner-lab
cd byd-fan-owner-lab
BYD_FAN_LAB="$PWD"

git clone https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks.git byd-review-evidence
git -C byd-review-evidence checkout --detach 58092145fd3e25a0afc31c716fefeff3f648f937

git clone https://github.com/jkaberg/pyBYD.git
git -C pyBYD checkout --detach 995ef70a2b6bd287d58c1f8564e6b50eabc7f868

git clone https://github.com/jkaberg/hass-byd-vehicle.git
git -C hass-byd-vehicle checkout --detach e8d660b67c51dd848a15b8410618927a04993fb8

uv venv --python 3.14.8 .byd-runtime
.byd-runtime/bin/python - <<'PY'
from hashlib import sha256
from pathlib import Path

root = Path("byd-review-evidence")
expected = {
    "home-assistant-fan-speed.patch": "7ba7119b8ecef21266fbd2ddd4303aa607408ad01102276d5d290bf4c33254fe",
    "pybyd-fan-level.patch": "ec306e5420e17a362968cdb89ea39f0b2b6c5a6bc3e5bb8c544c5b06206f1a83",
}
for name, digest in expected.items():
    path = root / "evidence/byd-fan-speed-64" / name
    if sha256(path.read_bytes()).hexdigest() != digest:
        raise SystemExit(f"Patch checksum mismatch: {name}")
print("Both pinned patch checksums match")
PY

git -C pyBYD apply --check ../byd-review-evidence/evidence/byd-fan-speed-64/pybyd-fan-level.patch
git -C hass-byd-vehicle apply --check ../byd-review-evidence/evidence/byd-fan-speed-64/home-assistant-fan-speed.patch
git -C pyBYD apply ../byd-review-evidence/evidence/byd-fan-speed-64/pybyd-fan-level.patch
git -C hass-byd-vehicle apply ../byd-review-evidence/evidence/byd-fan-speed-64/home-assistant-fan-speed.patch

uv pip install --python .byd-runtime/bin/python homeassistant==2026.10.2 -e ./pyBYD
uv pip check --python .byd-runtime/bin/python

mkdir -p ha-config/custom_components
ln -s "$BYD_FAN_LAB/hass-byd-vehicle/custom_components/byd_vehicle" "$BYD_FAN_LAB/ha-config/custom_components/byd_vehicle"

.byd-runtime/bin/python - <<'PY'
from importlib.metadata import version
from pathlib import Path
import inspect

from pybyd._capabilities.hvac import HvacCapability

expected = (Path.cwd() / "pyBYD/src/pybyd/_capabilities/hvac.py").resolve()
actual = Path(inspect.getfile(HvacCapability)).resolve()
if actual != expected:
    raise SystemExit(f"Unexpected pyBYD source: {actual}")
if not callable(getattr(HvacCapability, "set_fan_level", None)):
    raise SystemExit("Patched fan capability is missing")
manifest = Path("ha-config/custom_components/byd_vehicle/manifest.json")
if not manifest.is_file():
    raise SystemExit("Development integration is not linked")
if version("homeassistant") != "2026.10.2":
    raise SystemExit("Unexpected Home Assistant version")
print("Patched library path and integration link verified")
print("Home Assistant:", version("homeassistant"))
print("pyBYD source:", actual)
PY

uv pip freeze --python .byd-runtime/bin/python > installed-packages.txt
git -C pyBYD diff --check
git -C hass-byd-vehicle diff --check
```

Package-resolution success, the editable-import check and source checks above must succeed. The dependency list is a record of the resulting environment, not a lockfile or the original full test environment.

## Check the host, then start separately

Before startup, this normal adapter-enumeration prerequisite must work:

```sh
.byd-runtime/bin/python -c "import ifaddr; print(len(ifaddr.get_adapters()))"
```

An operation-not-permitted error here means this host cannot run the normal HA HTTP path. Stop and use a compatible development host; no fake adapters or source patch are part of this guide.


Only after setup succeeds, run this from the lab directory:

```sh
.byd-runtime/bin/python -m homeassistant --config "$PWD/ha-config" --skip-pip-packages pybyd
```

Retain `--skip-pip-packages pybyd`. The integration manifest intentionally still pins released pyBYD 0.0.79; normal dependency installation can replace the editable candidate and hide the new fan feature. No manifest version is invented or changed.

Use the local address shown by Home Assistant, complete fresh onboarding, and check that BYD Vehicle appears under Add Integration. Stop there for setup-only verification. Do not add the BYD account or start a control test while merely preparing the environment. Stop the process with Ctrl-C.

Before owner testing, record platform, Python/HA/package versions, base commits and patch hashes. The consenting owner configures credentials locally. Follow the original [OWNER_VALIDATION.md](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/blob/58092145fd3e25a0afc31c716fefeff3f648f937/evidence/byd-fan-speed-64/OWNER_VALIDATION.md) for physical fan mapping, AUTO/manual behavior, setting preservation, timer renewal and redacted logs. Do not infer fan motion from a successful command acknowledgement.

## Evidence and remaining gates

- [Owner's development-environment blocker](https://github.com/jkaberg/pyBYD/issues/64#issuecomment-6320401493).
- [Maintainer requires an actual car and BYD Cloud before PR submission](https://github.com/jkaberg/pyBYD/issues/64#issuecomment-6309170559), acknowledged by Tim in the following reply.
- [Pinned upstream development launcher](https://github.com/jkaberg/hass-byd-vehicle/blob/e8d660b67c51dd848a15b8410618927a04993fb8/scripts/dev/start-ha-dev.sh) supplies the editable-library and skip-dependency pattern; its /config and /workspaces paths are container-specific.
- [Pinned original candidate, evidence and checksum manifest](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/tree/58092145fd3e25a0afc31c716fefeff3f648f937/evidence/byd-fan-speed-64).
- Both upstream main revisions still matched the patch bases during this review. This does not guarantee future main compatibility.
- Installation and package preflight passed; in-process manifest recognition and direct initial-form construction passed. Full bootstrap/onboarding, HACS/hassfest, cloud and physical validation remain open. Editable builds can generate version metadata; it is not part of either fan patch. Use the checked source path and method to identify the paired candidate.

Next step: use a compatible clean development host for normal HA startup, fresh onboarding and HTTP/frontend integration discovery; then the consenting owner performs the agreed real-car checks.

Prepared with Codex assistance for Timothy Anderson — Spotted Ridge Engineering / OC Labs, GDN (Global Decision Network).

timothyanderson096@gmail.com
