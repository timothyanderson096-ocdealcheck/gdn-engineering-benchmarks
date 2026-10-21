# BYD fan-speed candidate — issue #64

Prepared for Timothy Anderson / OC Labs, 21 October 2026, with OpenAI Codex assistance.

**Status: locally tested candidate seeking owner validation. No upstream PR, release, vehicle test or BYD endorsement is claimed.** This is separate from this repository's controlled benchmarks and is not counted in their results.

The request is [jkaberg/pyBYD#64](https://github.com/jkaberg/pyBYD/issues/64). The maintainer confirmed that `ClimateStartParams` accepts `wind_level` but the Home Assistant integration does not expose it. Current `BydCar.hvac` also needs a higher-level method to retain the integration's existing command/error architecture.

## Changes

1. [pyBYD patch](pybyd-fan-level.patch): adds `car.hvac.set_fan_level(level, duration=...)`. Under the existing per-vehicle command lock it preserves the known driver/passenger targets, recirculation and A/C mode. Missing or invalid settings are rejected. Levels 1–7 are candidate raw command levels; neither their physical meaning nor support across models has been established.
2. [Home Assistant patch](home-assistant-fan-speed.patch): adds fan modes to the climate entity when the new library method is available. Existing PIN gating, command error translation and post-action refresh remain in use. Reported fan mode comes from `wind_position`; submitting a command does not change that readback optimistically.

The library patch also completes `start()`'s projections for three values its **existing unchanged payload already sets**: passenger temperature, circulation and A/C mode. Without that correction, an immediate start → fan sequence can replay older settings. Tests cover the actual `BydCar` sequence and rollback after rejection.

Fan changes reissue `OPENAIR` for the integration's configured climate duration. They therefore renew the remote climate run; they do not preserve its remaining timer. This behaviour needs owner acceptance. A/C AUTO/manual mode is preserved; whether AUTO accepts an explicit fan level remains an open physical test question.

No recirculation selector, airflow-direction control, defrost control, charging feature, login change or telemetry mapping change is included.

## Exact revisions

| Component | Upstream base | Tested local candidate |
| --- | --- | --- |
| pyBYD | `995ef70a2b6bd287d58c1f8564e6b50eabc7f868` | `a3cc941` |
| hass-byd-vehicle | `e8d660b67c51dd848a15b8410618927a04993fb8` | `938974b` |

Both mail patches pass `git apply --check` against their named clean bases. [SHA256SUMS](SHA256SUMS) records their hashes. The patches include source changes and automated tests; complete third-party repositories are not vendored. Upstream MIT notices are retained in [licenses](licenses/).

## Local evidence

| Check | Result | Environment / boundary |
| --- | --- | --- |
| pyBYD configured non-e2e test suite | **333 passed** | Python 3.12.14, pytest 9.1.1 |
| New library fan tests (included above) | **29 passed** | Real capabilities, state engine and parameter serialization; mocked BYD client |
| Integration test suite | **32 passed** | Python 3.14.8, Home Assistant 2026.10.2 |
| New integration tests (included above) | **24 passed** | Includes real `climate.set_fan_mode` service dispatch to the serialized parameters at the mocked BYD client boundary |
| Repository Ruff / Black / Mypy checks | **Pass for both repositories** | Checks run with Python 3.12, following the CI-style dependency boundary; Black uses one worker because local Unix worker sockets are unavailable |
| Mutation control | **Expected failure** | Removing the three additional start projections makes the actual start → fan preservation test fail for passenger/circulation/A/C mode; restoring them passes |
| Independent agent inspection | No remaining blocking finding | Same inherited model family; independent inspection is not physical validation or a separate model benchmark |

Home Assistant reports its existing HTTP application deprecation warning during tests. Mypy 2.4.0 encountered an internal error in the Python 3.14 runtime environment; the repository checks passed in Python 3.12 environments. The HA lint environment intentionally omits HA runtime dependencies, as its existing CI does; it is not a full type audit of HA internals. Runtime tests use the real HA package.

HACS, hassfest, upstream CI, physical controls, cloud authentication/transport and encrypted BYD requests were not exercised. Tests never logged in to BYD or sent a vehicle command.

## Reproduce locally

From a parent directory containing this evidence repository:

```sh
git clone https://github.com/jkaberg/pyBYD.git
git -C pyBYD checkout 995ef70a2b6bd287d58c1f8564e6b50eabc7f868
git -C pyBYD apply ../byd-review-evidence/evidence/byd-fan-speed-64/pybyd-fan-level.patch

git clone https://github.com/jkaberg/hass-byd-vehicle.git
git -C hass-byd-vehicle checkout e8d660b67c51dd848a15b8410618927a04993fb8
git -C hass-byd-vehicle apply ../byd-review-evidence/evidence/byd-fan-speed-64/home-assistant-fan-speed.patch

uv venv --python 3.14 .byd-runtime
uv pip install --python .byd-runtime/bin/python homeassistant==2026.10.2 pytest==9.1.1 pytest-asyncio==1.4.0 -e './pyBYD[dev]'
cd hass-byd-vehicle
../.byd-runtime/bin/python -m pytest --asyncio-mode=auto -q tests
cd ..

uv venv --python 3.12 .byd-library
uv pip install --python .byd-library/bin/python -e './pyBYD[dev]'
cd pyBYD
../.byd-library/bin/python -m pytest -q -m 'not e2e'
../.byd-library/bin/python -m ruff check .
../.byd-library/bin/python -m black --check --workers 1 .
../.byd-library/bin/python -m mypy src/pybyd
cd ..

uv venv --python 3.12 .byd-lint
uv pip install --python .byd-lint/bin/python ruff black mypy
cd hass-byd-vehicle
../.byd-lint/bin/python -m ruff check . tests/test_climate_fan_speed.py
../.byd-lint/bin/python -m black --check --workers 1 . tests/test_climate_fan_speed.py
../.byd-lint/bin/python -m mypy .
```

Use `byd-review-evidence` as the evidence checkout directory in these commands. Later unpinned dev-tool releases can differ from this run (Ruff 0.17.1, Black 26.10.1, Mypy 2.4.0, Pydantic 2.14.1). All version/revision statements describe local evidence, not upstream CI success.

## Owner validation and release gates

See [OWNER_VALIDATION.md](OWNER_VALIDATION.md). Needed evidence includes supported raw levels, actual fan response, AUTO/manual interaction, nonfan settings remaining unchanged, duration renewal and redacted logs from a real HA installation.

The integration still pins released `pybyd==0.0.79`. That version has no `set_fan_level` method, so the candidate hides the fan feature and preserves existing controls. To test the new control locally, install the paired patched library in a development HA environment using the repository's editable-library workflow. Normal distribution needs an upstream library release and integration dependency update after validation; no future version number is invented here.

Single-zone cars with missing/zero passenger targets, unknown circulation or unknown A/C mode are intentionally rejected rather than guessed. Owner evidence may justify a narrowly defined compatibility rule later. The reported `wind_position` model is reused; its relationship to command `windLevel` is not treated as proven.

## Work record

Preparation effort was not timed. This candidate was prepared and locally checked on 21 October 2026; first external review and vehicle validation are pending at package creation. Internal inspection caught collateral-setting resets and an incomplete-projection interaction before external submission. No external correction round, merge, acceptance time or performance improvement is claimed.
