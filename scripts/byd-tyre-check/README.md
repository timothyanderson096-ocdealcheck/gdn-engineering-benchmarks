# Frozen tyre-warning candidate validation

This helper belongs in the engineering evidence repository, not the upstream integration. A normal push affecting this directory or its workflow on `main` runs it. It never invokes the integration's release workflow, writes GitHub comments, uses privileged Docker, or contacts a real BYD account.

It reconstructs upstream `e8d660b67c51dd848a15b8410618927a04993fb8` plus the preserved production patch and three frozen regression files. The actual public proper-fork candidate is `timothyanderson096-ocdealcheck/hass-byd-vehicle@8f4abddeedadf23b2831a40ee55c0dd9088844d3`. Before HACS it verifies the public fork's parent repository, exact candidate parent commit and complete Git tree against the reconstructed four-file candidate. HACS uses that actual fork and exact commit with no ignored checks. The token is ephemeral, read-only and never recorded in argv or artifacts.

Runtime tests use Python 3.14.8, Home Assistant 2026.10.2 and pybyd 0.0.79. Each baseline/candidate runs four suites: 14 isolated native cases, 3 configured lifecycle/service cases, 1 actual HA core-startup/service case, and 8 existing consumption cases. Baseline must fail only the twelve exact known assertions (8 native, 3 configured, 1 startup), with zero errors or skips. Candidate must pass all 26. Both actual process exits and exact JUnit outcomes are retained. Fixture/network/setup failures cannot qualify as defect reproduction.

HA entry setup, ten platform forwarding, client/car/state engine, registries, services and entity states run unchanged. The new case calls actual `hass.async_start` after entry setup, observes the started event and running state, then uses the real registered service and reloads the actual entry. Explicit seams replace BYD authentication/cloud reads and the HTTP session factory; outbound network is blocked. There is no physical vehicle, encrypted manufacturer transport, MQTT, browser/frontend, HTTP server or config-UI claim. These logs are review evidence; acceptance remains the maintainer's decision.

Project Ruff, Black and mypy commands run in a separate Python 3.11.15 environment containing only the three tools, matching the upstream lint workflow. Tool versions are frozen to the inspected current versions. Because upstream ignores `tests/`, all three added fixtures also receive explicit Ruff and Black checks. Black uses one worker to preserve check behavior across restricted local runtimes. Mypy in a separately installed Home Assistant runtime resolves a different dependency/type graph; it is not a substitute for the project's actual tool-only workflow.

Hassfest and HACS run as pinned Docker images with their normal entrypoints on a real runner daemon. Source proof, versions, dependency checks, raw synthetic DEBUG logs, JUnit, all actual exits and aggregate gate status are saved as seven-day artifacts. A failed or unrun stage leaves the aggregate incomplete.

Prepared with AI assistance. This helper and its logs provide inspectable verification evidence; maintainer acceptance and real-vehicle confirmation remain separate.

Timothy Anderson — Spotted Ridge Engineering / OC Labs · Independent software verification · GDN (Global Decision Network) · timothyanderson096@gmail.com · [Engineering evidence](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks)
