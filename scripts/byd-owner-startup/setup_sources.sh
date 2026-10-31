#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: setup_sources.sh NEW_SOURCE_DIRECTORY SOURCE_RECORD_JSON" >&2
  exit 2
fi
byd_source_dir=$1
byd_record=$2
mkdir "$byd_source_dir"
byd_source_dir=$(cd "$byd_source_dir" && pwd)
cd "$byd_source_dir"

git clone --quiet https://github.com/jkaberg/pyBYD.git pyBYD
git -C pyBYD checkout --quiet --detach 995ef70a2b6bd287d58c1f8564e6b50eabc7f868
git clone --quiet https://github.com/jkaberg/hass-byd-vehicle.git hass-byd-vehicle
git -C hass-byd-vehicle checkout --quiet --detach e8d660b67c51dd848a15b8410618927a04993fb8
git clone --quiet https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks.git evidence
git -C evidence checkout --quiet --detach 58092145fd3e25a0afc31c716fefeff3f648f937

python - <<'PY'
from hashlib import sha256
from pathlib import Path

expected = {
    "pybyd-fan-level.patch": "ec306e5420e17a362968cdb89ea39f0b2b6c5a6bc3e5bb8c544c5b06206f1a83",
    "home-assistant-fan-speed.patch": "7ba7119b8ecef21266fbd2ddd4303aa607408ad01102276d5d290bf4c33254fe",
}
for name, digest in expected.items():
    path = Path("evidence/evidence/byd-fan-speed-64") / name
    if sha256(path.read_bytes()).hexdigest() != digest:
        raise SystemExit(f"Patch checksum mismatch: {name}")
print("Both pinned patch SHA256 values match")
PY

git -C pyBYD apply --check ../evidence/evidence/byd-fan-speed-64/pybyd-fan-level.patch
git -C hass-byd-vehicle apply --check ../evidence/evidence/byd-fan-speed-64/home-assistant-fan-speed.patch
git -C pyBYD apply ../evidence/evidence/byd-fan-speed-64/pybyd-fan-level.patch
git -C hass-byd-vehicle apply ../evidence/evidence/byd-fan-speed-64/home-assistant-fan-speed.patch

python - "$byd_record" <<'PY'
from hashlib import sha256
from pathlib import Path
import json
import subprocess
import sys

bases = {
    "pyBYD": "995ef70a2b6bd287d58c1f8564e6b50eabc7f868",
    "hass-byd-vehicle": "e8d660b67c51dd848a15b8410618927a04993fb8",
    "evidence": "58092145fd3e25a0afc31c716fefeff3f648f937",
}
for repo, expected in bases.items():
    actual = subprocess.check_output(["git", "-C", repo, "rev-parse", "HEAD"], text=True).strip()
    if actual != expected:
        raise SystemExit(f"Source base mismatch: {repo}")
expected_files = {
    "pyBYD/src/pybyd/_capabilities/hvac.py": "d5c6d017f96bac69e318d1fe1b744b7d89bcbc91",
    "pyBYD/tests/test_hvac_fan_level.py": "81e6d43cae0de47c01e2f1825a90887600a446e9",
    "hass-byd-vehicle/custom_components/byd_vehicle/climate.py": "70f33e0dedbc3224d01d6fe3d405afc784d98e5a",
    "hass-byd-vehicle/tests/test_climate_fan_speed.py": "416ace864b0802a2353be77e7e61d6ddc5504d65",
}
files = {}
for name, expected in expected_files.items():
    actual = subprocess.check_output(["git", "hash-object", name], text=True).strip()
    if actual != expected:
        raise SystemExit(f"Candidate file mismatch: {name}")
    files[name] = {"git_blob": actual, "sha256": sha256(Path(name).read_bytes()).hexdigest()}
for repo in ("pyBYD", "hass-byd-vehicle"):
    subprocess.run(["git", "-C", repo, "diff", "--check"], check=True)
record = {"source_bases": bases, "candidate_files": files, "patch_application_passed": True}
Path(sys.argv[1]).write_text(json.dumps(record, indent=2) + "\n")
print("Exact source bases and all four candidate file blobs match")
PY

