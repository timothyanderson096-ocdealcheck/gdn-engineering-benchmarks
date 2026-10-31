# BYD tyre warning #203 — 31 October 2026

A previously observed warning can now clear when all four tyre-status fields and tirepressure_system explicitly equal zero. Initial all-zero/unknown behavior and warnings across missing/negative data are preserved. Reporter dochtie supplied the symptoms and healthy payload in [issue203](https://github.com/jkaberg/hass-byd-vehicle/issues/203).

Exact candidate: [8f4abddeedadf23b2831a40ee55c0dd9088844d3](https://github.com/timothyanderson096-ocdealcheck/hass-byd-vehicle/commit/8f4abddeedadf23b2831a40ee55c0dd9088844d3), based on e8d660b67c51dd848a15b8410618927a04993fb8.

[Hosted run41184584593](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/41184584593) passed all42 recorded stages. Actual baseline pytest exits remain1 for the three defective suites:8 native assertion failures,3 configured failures and1 actual-core-startup failure. Baseline existing8 controls pass. Candidate all26 pass, with zero setup/collection errors or skips. [result.json](result.json), [summary.md](summary.md) and the JUnit files retain exact outcomes.

[Download the full original validation artifact](validation-artifact.zip):84 files,294261 bytes, SHA256 778bd6fda789fa5f897853c94ca79e8841f99a1e891a326ca02b8de5e94e092c. It includes full, unmodified synthetic DEBUG logs named baseline-started.log, candidate-started.log, baseline-configured.log and candidate-configured.log, plus isolated/existing logs, every gate JSON, JUnit, versions, dependency records and native container logs. The large DEBUG files are distributed in this ZIP so their complete contents remain available.

Runtime: Python3.14.8 / HA2026.10.2 / pybyd0.0.79. Actual upstream tool-only Python3.11.15 Ruff/Black/mypy pass, and the three added fixtures pass explicit-path Ruff/Black. Actual pinned Docker hassfest reports zero invalid integrations. All ten HACS validators pass against the proper public fork and exact SHA without ignored checks.

The automated flow uses real HA config-entry setup, all ten platforms, client/car/state engine, registries, registered fetch_realtime service, sensor state, unload/reload and actual hass.async_start with its started event. Fixtures replace BYD authentication/cloud reads and the HTTP-session factory; outbound network calls are blocked. Synthetic VINs and data are used throughout. No actual vehicle, BYD cloud/encryption, MQTT, browser/config UI or HTTP frontend validation is claimed.

An extra mypy diagnostic inside the installed HA runtime has the same five pre-existing errors on baseline/candidate; one optional attempt hit an internal mypy error before confirmation. This is separate from the passing upstream tool-only lint workflow. Inherited nonfatal warnings are retained in the archive.

Prepared with AI assistance. Agents independently inspected code, fixtures, helper and actual hosted evidence. Human maintainer review and real-vehicle confirmation remain outstanding.

Timothy Anderson — Spotted Ridge Engineering / OC Labs · GDN (Global Decision Network)  
timothyanderson096@gmail.com · [Engineering evidence](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks)
