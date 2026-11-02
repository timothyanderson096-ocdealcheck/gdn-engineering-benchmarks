# Trossen loader draft: initial hosted validation

Recorded 2 November 2026. This is validation of an independent tests-only draft,
not an upstream submission, approval or merge.

## Exact inputs and result

- Validation commit: `050ffbcfb46f1c12723dbd2cc946987ec8b3886a`.
- Upstream PR #358 source: `594e7601b8f28cbc307a290c2f4685fd11dab44a`.
- Patch SHA-256: `721682c3052cdeb34481d6cb868a9e85fbef3145ccefbf5cb02d173b898d67bf`.
- Patched test SHA-256: `ce3b5b45eb41ed2eedb2f02470a3a99979b265fd7d68374b084ab464402e022d`.
- [Actions run 41442119938](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/41442119938).
- Native job: `125266284030`; quality job: `125266283760`.

| Gate | Observed result |
| --- | --- |
| Real SDK shared library and loader test build | Passed |
| Focused loader CTest | 29 passed, 0 failed, 0 skipped; 2.60 seconds |
| New real-MCAP recording regressions | All 10 passed within the 29-case run |
| Full upstream pre-commit configuration | Passed; broken-symlink hook had no applicable files |
| Final source integrity | Passed; intended test file only |
| Full upstream `make build` | Failed in unchanged `hardware_registry_demo.cpp` |
| Upstream `make test` | Skipped after the full build failure |

The full-build diagnostic was `fatal error: librealsense2/rs.hpp: No such file or
directory`: the example includes a concrete RealSense header even when
`TROSSEN_ENABLE_REALSENSE=OFF`. The test patch does not change the example. The
overall native job is a failure; the focused pass does not turn it into a full
project pass.

## Preserved original artifacts

The two ZIP files in this directory are byte-for-byte original Actions artifacts,
downloaded and checked against GitHub's reported SHA-256 digests. They remain
available here after the short Actions artifact retention expires.

| Archive | Original artifact ID | SHA-256 |
| --- | --- | --- |
| `trossen-loader-native-41442119938-1.zip` | `13140997948` | `a18124a4896bd5fecb807ee2da8812865d10ea5fc62af9e2c640d2f4b73a7a58` |
| `trossen-loader-quality-41442119938-1.zip` | `13139118598` | `50c4cb4f15b7445793aa476a8bf2d5c11c8f57cb3ceb21f81f3775bb1174ea2d` |

Native evidence includes configuration/environment, source checks, focused and
full-build logs, loader JUnit results, CMake cache and CTest's `LastTest.log`.
JUnit's per-test output may be truncated; consult `LastTest.log` for the complete
raw output. Quality evidence includes the full hook log and post-hook diff. The
latter is the unchanged intended candidate, not an accepted hook modification.
No private recordings, support emails or credentials are included.

## Follow-up contract and contribution record

The revised loader workflow builds every configured test executable independently
of examples, checks CTest discovery coverage, and runs the complete configured
CPU suite. It retains the full-build gate and its failure rather than changing
the tests-only patch or suppressing the defect. The separate one-line example
fix is tested on pinned upstream main, never inserted into this loader tree.

| Field | Record |
| --- | --- |
| Work reference | Trossen SDK issue #445 / draft PR #358; recording-level loader tests |
| Preparation effort | Not measured; no productivity or replacement-cost claim |
| First upstream submission | Not submitted |
| Avoidable correction | Initial CI preflight missed the example's optional-header dependency, and full-suite execution was incorrectly coupled to the all-target build |
| Design discussion | PR #358's author identifies recording fixtures as follow-up issue #445; empty recorded base-channel coverage remains deferred |
| Review wait | Not applicable: no new upstream request sent |
| Outcome | Focused native validation passed; broader CPU validation pending at this record's creation |
| Time to acceptance | Not applicable; no upstream acceptance claimed |
| Reusable lesson | Verify the documented feature-OFF build and keep test-target execution independent of unrelated example build failures |

Timothy Anderson — Spotted Ridge Engineering / OC Labs
Independent software verification · GDN (Global Decision Network)
timothyanderson096@gmail.com
