I've prepared a fan-speed-only candidate and would appreciate owner validation of the command mapping before treating it as ready for normal use.

[Paired patches, exact bases and local evidence](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/tree/58092145fd3e25a0afc31c716fefeff3f648f937/evidence/byd-fan-speed-64) · [Owner test steps](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/tree/58092145fd3e25a0afc31c716fefeff3f648f937/evidence/byd-fan-speed-64/OWNER_VALIDATION.md)

The pyBYD patch adds `car.hvac.set_fan_level()`; the integration exposes HA fan modes when that method is available. It preserves known driver/passenger targets, circulation and A/C mode, rejects missing settings, and keeps fan readback authoritative. It uses the existing PIN/error/refresh paths. A start→fan regression also caught incomplete projections of settings already sent by `start()`; that is covered in the library patch without changing its outgoing start payload.

Local checks:
- pyBYD: **333 tests passed**, including 29 new fan tests.
- Integration: **32 tests passed**, including 24 new tests and real HA `climate.set_fan_mode` dispatch to a **mocked BYD client**.
- Applicable Ruff, Black and Mypy checks pass.

**No car or BYD cloud was used.** Raw levels 1–7 are candidates from the existing model, not verified command-to-physical-speed mappings. In particular, the earlier report of level 2/full power means that correspondence must not be assumed. Does an owner have confirmed `windLevel` values, and can they check behaviour in AUTO versus manual mode?

The command reissues `OPENAIR` for the configured duration, so timer renewal also needs checking. Unknown passenger/circulation/mode data is rejected rather than guessed. The pinned 0.0.79 library keeps existing controls and hides fan support; testing the new control needs the paired patched library. Upstream release/dependency updates and real HA logs remain pending. No upstream PR or production-ready result is claimed yet.

AI assistance: OpenAI Codex prepared the changes, tests and this request; the package records independent agent inspection and its limits.

Tim / OC Labs
