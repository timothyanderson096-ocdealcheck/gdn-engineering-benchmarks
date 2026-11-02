# Trossen RealSense-OFF build fix: verified handoff

Recorded 2 November 2026. Prepared and tested on the author's validation branch;
not submitted, reviewed by an upstream maintainer, approved or merged upstream.

## Exact candidate and result

- [Run 41447064346](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/41447064346), both jobs successful.
- Validation commit: `c86e5c825be283e56f6840d0ad1abfcb753aa0fb`.
- Upstream main: `8224f2f8279061af827ca17c36985e40a6833242`.
- Change: one unused include deleted from `examples/hardware_registry_demo.cpp`.
- Patch SHA-256: `2cd2ec26eaa40be014e719dde09da5cc548798271727dbb46fe1db72ac35a770`.
- Candidate file SHA-256: `c798c475fa62614fed4f82a92bcf98b4de07672cd8fb0a72148c182343a3c0b1`.
- Ubuntu 24.04; Arrow/Parquet `25.0.1-1`; all optional features explicitly OFF.

| Gate | Observed result |
| --- | --- |
| Pristine baseline demo build | Exit 2, specifically missing `librealsense2/rs.hpp` through the demo's RealSense include |
| Apply frozen one-line patch | Passed exact file and complete diff digest checks |
| Candidate demo build | Passed in the same build tree and dependency environment |
| Default mock-only demo | Passed: two mock arms, correct left-arm joint count, both IDs and completion |
| Upstream `make build NPROC=2` | Passed |
| Upstream `make test`, serial | 398 passed, 0 failed, 0 skipped; 22.93 seconds |
| Upstream full pre-commit | Passed |
| Final source integrity | Passed; one include deletion only |

The 398 individual outcomes and matching CTest inventory were inspected. No
assertions or skips were added, no extra production change was made, and no
hardware was contacted. Registration remains in the feature-gated SDK
implementation; the removed header has no registration side effect.

## Original artifacts retained here

| Archive | Artifact ID | SHA-256 |
| --- | --- | --- |
| `trossen-realsense-off-native-41447064346-1.zip` | `13142259554` | `20cd8e89975b3d25092b3b6b4e07a9bebea2419df20868f80b369cf8283a8e4f` |
| `trossen-realsense-off-quality-41447064346-1.zip` | `13142154059` | `f79a4226babbeb0b04e819809e62549b2b021b3d701fbccd8f3aa8af8642efb9` |

Archives match GitHub's reported SHA-256 digests. They retain the actual baseline
exit code, before/after compiler logs, mock output, full build/test logs, CTest
inventory, compiler commands, environment and final source checks.

## Proposed upstream handoff — not sent

**Title:** Fix hardware registry demo build with RealSense disabled

### Summary

The documented `TROSSEN_ENABLE_REALSENSE=OFF` build fails without librealsense
because `hardware_registry_demo.cpp` includes the concrete RealSense component
header even though it uses only the registry interface. Remove that unused
include. Component registration and the demo's runtime behavior are unchanged.

### Changes

- Delete one unused include from the hardware registry demo; no CMake, driver,
  factory key, runtime branch or loader changes.

### Test Plan

- [x] Reproduced the exact pristine-main missing-header failure with RealSense absent.
- [x] Rebuilt the patched demo in the same environment and ran its default mock path.
- [x] `make build NPROC=2` in the explicit CPU-only configuration.
- [x] `make test`: 398 passed, zero failures or skips.
- [x] `pre-commit run --all-files` using unchanged upstream hooks.
- [ ] RealSense-enabled build and physical hardware: not run; not claimed.

### Breaking Changes

None intended. The existing `--real` path and registration implementation are
unchanged; the workflow never invokes that path.

### Related Issues

This is an independent build defect discovered during loader-test validation,
not a fix for issue #445. The loader test contribution remains separate.

Prepared with AI assistance for human review. Arrow 25.0.1 is used because this
pinned main revision still uses the older Parquet API; this does not claim Arrow
26 compatibility. Exact commands and dependencies are in the linked run and
validation workflow.

## Contribution record

Preparation effort was not measured. No upstream submission or review request
has been sent, so review wait and time to acceptance are not applicable. The
outcome is a prepared, independently source-reviewed, CPU-validated one-line
patch. No post-submission correction round or design negotiation has occurred.
Reusable lesson: a feature-OFF build must not acquire the optional library's
headers through an unused example include; keep dependency versions compatible
with the exact upstream revision under test.

Timothy Anderson — Spotted Ridge Engineering / OC Labs
Independent software verification · GDN (Global Decision Network)
timothyanderson096@gmail.com
