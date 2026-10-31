# Hosted Home Assistant startup result — 31 October 2026

**Passed:** credential-free installation, real adapter enumeration, normal Home Assistant startup, fresh onboarding and the initial BYD HTTP setup flow.

[GitHub Actions run 41182281872](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/41182281872) completed successfully on its first attempt at source commit `d88c7744cf47270373c87394ad3b2625f0dc48dc`. The repository's existing test/typecheck/build workflow also passed at that commit.

| Required check | Result |
| --- | --- |
| Exact runtime, candidate hashes and editable-library path | Passed |
| Real network-adapter enumeration | Passed; 3 adapters |
| Fresh onboarding state | Passed |
| Synthetic local user and token exchange | Passed |
| All four onboarding steps complete | Passed |
| Normal core RUNNING, without safe/recovery mode | Passed |
| BYD HTTP handler discovery | Passed |
| Serialized initial BYD user form | Passed |
| Flow cancellation and no configured BYD entry | Passed |
| Child cleanup | SIGINT; exit 0; stopped |

Runtime: GitHub-hosted Ubuntu 24.04, Python 3.14.8 and Home Assistant 2026.10.2. The paired source bases and all four candidate file hashes match the existing patches. Editable pyBYD metadata became `0.0.80.dev0+g995ef70a2.d20261031`; this is build metadata, not a new package release.

The run uploaded nine selected report/log files. Artifact 13034788983 has SHA256 `6c9a52937e0923f2daf5b9db681ba5393f9713d88057003b4baa1c712ffd9f47`. The archive digest, per-check JSON and HTTP trace were independently checked. Temporary HA configuration/authentication storage was removed and was not uploaded.

## Boundaries

The ordinary HA startup log retains unavailable FFmpeg, Bluetooth-management capabilities and turbojpeg, plus zlib fallback warnings. Those optional capabilities were not validated. They did not prevent the required REST/setup checks.

No BYD credentials or actual car were used. Frontend rendering, BYD cloud authentication, physical fan mapping, AUTO/manual behavior, preserved climate settings, timer renewal and HACS/hassfest remain unverified. This result does not satisfy the maintainer's actual-car/BYD Cloud requirement before proposing the feature PR.

The original managed workspace still denies adapter enumeration. The successful run used a separate authorized GitHub host; it did not change that workspace policy. No new accepted fix or benchmark result is counted.

Prepared with Codex assistance and independent agent inspection for Timothy Anderson — Spotted Ridge Engineering / OC Labs.  
GDN (Global Decision Network) · timothyanderson096@gmail.com
