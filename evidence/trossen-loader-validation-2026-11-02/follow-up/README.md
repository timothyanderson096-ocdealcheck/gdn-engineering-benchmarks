# Trossen loader draft: full CPU validation

Recorded 2 November 2026. The tests-only candidate is unchanged from the initial
run. This is not a test of upstream main or an upstream submission.

## Exact inputs and observed results

- [Run 41446073405](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/41446073405).
- Validation commit: `797b2a1842d872bb18b86cb63bf1faafe983826c`.
- Upstream PR #358 source: `594e7601b8f28cbc307a290c2f4685fd11dab44a`.
- Patch SHA-256: `721682c3052cdeb34481d6cb868a9e85fbef3145ccefbf5cb02d173b898d67bf`.
- Patched test SHA-256: `ce3b5b45eb41ed2eedb2f02470a3a99979b265fd7d68374b084ab464402e022d`.
- Ubuntu 24.04; Arrow/Parquet `26.0.0-1`; exact environment in the native archive.

| Gate | Observed result |
| --- | --- |
| Focused loader tests | 29 passed, 0 failed, 0 skipped; 2.53 seconds |
| Configured CPU test targets | All 34 built; CTest executable inventory matched exactly |
| Unfiltered configured CPU suite | 517 passed, 0 failed, 0 skipped; 45.95 seconds |
| Upstream full pre-commit | Passed |
| Final tracked-source and patch integrity | Passed; test file only, original hashes unchanged |
| Full `make build` | Failed on the unchanged hardware demo's missing RealSense header |
| Subsequent `make test` command | Skipped after full-build failure; the independent full CTest gate above already ran successfully |

Both JUnit files, all 517 individual CTest outcomes, the 34-target inventory and
final source checks were inspected. No test filtering, assertion change, retry
or added skip was used for the full suite. The overall native job correctly
remains a failure because its separate whole-project build gate failed.

## Original artifacts retained here

| Archive | Artifact ID | SHA-256 |
| --- | --- | --- |
| `trossen-loader-native-41446073405-1.zip` | `13142827069` | `11f22a1b06a266ff767152782bdf6c705464a41e0157b623ee691d204e3c8a01` |
| `trossen-loader-quality-41446073405-1.zip` | `13142222621` | `7a22b10f7a6734e1e8d678cf8286a176bb5adb49bfe56ba6f81dd8023d24d6ca` |

Downloaded archives match GitHub's reported digests byte-for-byte. Native
evidence includes full CTest output, JUnit, discovery inventories, build logs,
environment, CMake cache and `LastTest.log`. JUnit output may be truncated per
test; the raw CTest log is retained separately.

## Handoff and limits

The loader implementation and APIs under test belong to unmerged PR #358, not
current main. Confirm the maintainer's preferred base before a separate upstream
test PR. Issue #445 is the recording-fixture follow-up identified by the author.
The independent current-main RealSense build fix is not applied in this tree.

Physical hardware, optional feature configurations and recorded-but-empty base
channel coverage remain outside this validation. No new upstream PR or message
was sent. The initial contribution record remains in the parent directory;
its outcome is now updated to full configured CPU test validation passed,
with the separate whole-project build limitation preserved.

Timothy Anderson — Spotted Ridge Engineering / OC Labs
Independent software verification · GDN (Global Decision Network)
timothyanderson096@gmail.com
