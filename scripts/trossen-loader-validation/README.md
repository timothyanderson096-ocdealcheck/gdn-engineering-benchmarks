# Trossen loader regression draft — validation only

This isolated branch validates a tests-only draft against the exact unmerged
[Trossen SDK PR #358](https://github.com/TrossenRobotics/trossen_sdk/pull/358)
revision `594e7601b8f28cbc307a290c2f4685fd11dab44a`. It is not an upstream submission,
an accepted contribution, a hardware certification, or a test of current `main`.

## Frozen candidate

- Changed file: `tests/test_mcap_dataset_loader.cpp` only; 299 insertions, 1 deletion.
- Ten new recording-level tests use synthetic protobuf messages in real MCAP files.
- They exercise the actual SDK loader, not a reimplemented alignment algorithm.
- Coverage: 200 Hz joints over a 30 fps episode; non-ordinal nearest sampling of
  joints, mobile base and camera; increasing/equal timestamps; backward timestamps
  in each supported stream class; late camera/base starts; disjoint stream windows.
- A recorded-but-empty base-channel case is deliberately not claimed: Foxglove
  persists channels only when their first message is logged.
- No private recordings, emails, credentials, or original support archive are uploaded.

Patch SHA-256:
`721682c3052cdeb34481d6cb868a9e85fbef3145ccefbf5cb02d173b898d67bf`

Patched test-file SHA-256:
`ce3b5b45eb41ed2eedb2f02470a3a99979b265fd7d68374b084ab464402e022d`

## CI contract

The workflow runs only for changes to these validation files on
`validation/trossen-loader-regression-2026-11-02`. Its token is read-only, checkout
credentials are not retained, and it has no deployment or upstream-publication step.

The native job uses Ubuntu 24.04, Arrow/Parquet `26.0.0-1` (the upstream CI pin),
and arm-library release v1.11.0 at `507451794d11e54f11494ef3be1d786ec6060d4a`.
The arm package installs its supplied static library; it is not rebuilt from source.
The SDK configuration explicitly supplies `/usr/bin/protoc` because its pkg-config
path does not populate `Protobuf_PROTOC_EXECUTABLE`. System package versions are
recorded; the environment is not claimed to be fully hermetic.

It compiles the real SDK and loader-test target and runs all loader test suites.
It then obtains all 34 configured `test_*` targets from CMake's File API, builds
them independently of examples, and checks that CTest's executable inventory
matches exactly. The complete registered CPU suite runs without name filters;
unbuilt placeholders, missing executables and an empty suite fail validation.
The existing nested `build/tests` layout is retained for relative fixture paths.

Upstream `make build` remains a separate gate after the tests; its failure is not
suppressed. `make test` runs only if that full build succeeds. The direct full
CTest run can therefore supply suite evidence even when an unrelated example
blocks the all-target build. Tests run serially. The full test gate is bounded to
12 minutes, and the native job to 45 minutes. A separate job runs unchanged upstream
`pre-commit run --all-files` with pre-commit 4.3.0 and the upstream hook versions.
Hook-generated edits are retained as evidence but never accepted into the patch.

RealSense, ZED, video encoding, Rerun, policy clients, and Python bindings are
disabled. Their conditional tests, physical hardware, live services, and actual
LeRobot playback are outside this run. The ffmpeg CLI is installed so the enabled
video-file tests are not skipped merely because that executable is absent.

The preparation and final checks enforce the exact upstream SHA, patch digest,
test-file digest, and single-file diff. Raw logs, test inventories and JUnit XML are retained
as GitHub Actions artifacts for seven days. A successful upload is not a successful
test: inspect the actual job and step conclusions.

## First run and follow-up

[Run 41442119938](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/41442119938)
tested validation commit `050ffbcfb46f1c12723dbd2cc946987ec8b3886a`:

- The real SDK and loader executable compiled.
- All 29 loader tests passed, including all ten new recording regressions;
  zero failures or skips.
- Full upstream `pre-commit run --all-files` passed.
- Full `make build` failed because the unchanged `hardware_registry_demo.cpp`
  unconditionally included the RealSense header while RealSense was disabled.
- The original workflow consequently skipped `make test`. This was a validation
  sequencing gap; the independent all-test build and CTest run above address it
  without changing the candidate, weakening assertions or hiding the build error.

The initial artifacts and compact record are retained under
`evidence/trossen-loader-validation-2026-11-02/` on this branch. The
[completed follow-up record](../../evidence/trossen-loader-validation-2026-11-02/follow-up/README.md)
documents run `41446073405`: all 517 configured CPU tests passed with zero
failures or skips; the known unrelated example build remains a failed gate.
The separate current-main example fix has its own patch and workflow; it is not
applied to this tests-only source tree.

Timothy Anderson — Spotted Ridge Engineering / OC Labs
Independent software verification · GDN (Global Decision Network)
timothyanderson096@gmail.com
