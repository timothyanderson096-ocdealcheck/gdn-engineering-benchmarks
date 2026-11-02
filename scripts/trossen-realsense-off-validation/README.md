# Trossen RealSense-OFF build-fix draft

Status: own-account validation completed. The baseline failed on the expected
missing header; the candidate demo, mock behavior, full CPU build, all 398 tests
and upstream pre-commit passed. See the
[completed evidence and handoff record](../../evidence/trossen-realsense-off-validation-2026-11-02/README.md).
No upstream submission or contact is included.

This is separate from the loader-regression draft. It deletes only the unused
RealSense component include from examples/hardware_registry_demo.cpp on frozen
upstream main. No CMake, registry, runtime branch, driver or loader-test changes
are part of this patch.

## Frozen inputs

| Input | Exact value |
| --- | --- |
| Repository | https://github.com/TrossenRobotics/trossen_sdk |
| Main revision | 8224f2f8279061af827ca17c36985e40a6833242 |
| Patch SHA-256 | 2cd2ec26eaa40be014e719dde09da5cc548798271727dbb46fe1db72ac35a770 |
| Baseline demo SHA-256 | 8d971cc859c9f0e1ad2551427de6ef34f2dab1d45de22b5e70a21337fd4f6937 |
| Candidate demo SHA-256 | c798c475fa62614fed4f82a92bcf98b4de07672cd8fb0a72148c182343a3c0b1 |
| Arm-library revision | 507451794d11e54f11494ef3be1d786ec6060d4a |
| Arrow and Parquet APT versions | 25.0.1-1 |
| Native runner | Ubuntu 24.04 x86-64 |
| Lint environment | Python 3.12.14; pre-commit 4.3.0; upstream hooks unchanged |

## Behavior contract and gates

1. Restore pristine main and verify the baseline file and patch digests.
2. Install CPU dependencies, but not RealSense. Explicitly configure RealSense,
   ZED, video encoding, Rerun, policy client and Python bindings OFF.
3. Build hardware_registry_demo against the real SDK. The baseline must fail
   with the example/RealSense-header include chain and the exact missing
   librealsense2/rs.hpp diagnostic. An unrelated error does not satisfy this gate.
4. Apply only the hash-verified one-line patch, without changing dependencies.
   Rebuild the same target in the same build directory.
5. Run the default mock-only demo with a 15-second timeout. Require two active
   components, the retrieved left arm with seven joints, both mock-arm IDs, and
   the completion message. Never pass --real.
6. Attempt upstream make build with NPROC=2. Only after that succeeds, run
   upstream make test serially with a 12-minute overall timeout.
7. Run the complete upstream pre-commit configuration in an independent job.
   Retain hook edits as failures; do not accept them into the candidate.
8. Verify the final tracked-source diff and file digest. Retain before/after
   logs, compiler commands, CMake cache, test logs and environment for seven days.

The baseline's expected failure is checked explicitly and recorded with its
actual exit code. Candidate failures remain failures. No assertion, skip,
automatic retry-to-green, or additional source change is introduced. The build
directory stays under the source root so existing cwd-relative test fixtures
keep their upstream layout.

## Why this job uses Arrow 25 rather than the loader job's Arrow 26

Pinned main still calls the three-argument, Status-returning
parquet::arrow::FileReader::Make API. Apache Arrow 25.0.1 retains that deprecated
overload; Arrow 26 removes it. This separate job therefore pins the official
25.0.1-1 Arrow and Parquet packages for both baseline and candidate. It does not
claim main is compatible with Arrow 26 or change the Parquet source.

The official Ubuntu noble/amd64 package index was checked on 2 November 2026 and
lists both exact packages. The Arrow package SHA-256 is
8783c4ded5f3329ef4fa5e2ce04d933b87a67cf2323f1e1ee0fb5eedf7329b54;
the Parquet package SHA-256 is
df1d7f4d33fbc93b96e1d004ade16a681d60e826bd1e2ae974c6fc44ef5e5eec.
APT uses the official repository's signed metadata; the workflow records the
installed package versions and fails if the pinned versions are unavailable.

Sources:

- https://github.com/TrossenRobotics/trossen_sdk/blob/8224f2f8279061af827ca17c36985e40a6833242/docs/installation.rst
- https://github.com/TrossenRobotics/trossen_sdk/blob/8224f2f8279061af827ca17c36985e40a6833242/examples/hardware_registry_demo.cpp
- https://github.com/TrossenRobotics/trossen_sdk/blob/8224f2f8279061af827ca17c36985e40a6833242/src/backends/lerobot_v2/lerobot_v2_backend.cpp
- https://github.com/apache/arrow/blob/apache-arrow-25.0.1/cpp/src/parquet/arrow/reader.h
- https://github.com/apache/arrow/blob/apache-arrow-26.0.0/cpp/src/parquet/arrow/reader.h
- https://packages.apache.org/artifactory/arrow/ubuntu/dists/noble/main/binary-amd64/Packages.gz

## Boundaries

This validates a pinned RealSense-OFF configuration and mock-only behavior.
RealSense-ON, cameras, robot arms, ZED/CUDA and other optional configurations are
not tested. Installing the arm dependency installs its supplied static archive;
it does not compile its driver source or contact hardware.

The workflow is restricted to the named validation branch in
timothyanderson096-ocdealcheck/gdn-engineering-benchmarks. It uses a read-only
token, no persisted checkout credentials, no user-provided secrets and no
deployment, upstream PR or maintainer-message action. A published validation
branch is not an accepted upstream contribution.

Prepared with AI assistance for human review. Static checks do not establish
that native compilation or runtime gates have passed.

---

Timothy Anderson — Spotted Ridge Engineering / OC Labs

Independent software verification · GDN (Global Decision Network)

timothyanderson096@gmail.com · [Engineering evidence](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks)
