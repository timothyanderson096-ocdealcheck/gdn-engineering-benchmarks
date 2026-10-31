# BatteryBox module-label validation — 31 October 2026

The balancing-total attribute now labels modules 1, 2, …, matching the other cell attributes and dashboard. Only the exported label changes; zero-based cell lookup, counts and module ordering are preserved.

Candidate: [d812e7bd22cc2aefa18614b31aba48276e496565](https://github.com/timothyanderson096-ocdealcheck/byd_battery_box/commit/d812e7bd22cc2aefa18614b31aba48276e496565), based on TimWeyand/byd_battery_box at 2cc576278e05b7bb1778f1a50246b8072dc77883. Related reporter issue: [redpomodoro/byd_battery_box#21](https://github.com/redpomodoro/byd_battery_box/issues/21).

[Hosted run 41184505991](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/41184505991) passed all 20 recorded stages: exact source/complete tree, seven native regressions, dependencies, Ruff, actual Python 3.12.14 compilation, actual pinned Docker hassfest and all ten HACS validators against the proper public fork and exact candidate SHA. [result.json](result.json) contains process exits and image pins; [summary.md](summary.md) lists each gate.

The unchanged baseline has six assertion failures and one passing control ([log](baseline.log), [JUnit](baseline.xml)); the identical candidate tests all pass ([log](regression.log), [JUnit](regression.xml)). Native runtime: Python 3.14.8, Home Assistant 2026.10.2, pymodbus 3.13.1. Ruff 0.17.3. Artifact 13035872087, 19,424 bytes; SHA256 d9f3f180508e1d2eb2998630bc53a39aadf74c13cef9c6a67e89b0d0c9c8f330.

The [first hosted run](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/41184268303) passed native/lint/compile/hassfest but stopped before HACS because the helper used a trailing slash on GitHub's repository metadata URL. The canonical-URL correction affected the evidence helper only; production candidate and assertions were unchanged.

These are synthetic data-only regressions through real client/decoder/sensor classes with network connections blocked. No configured HA lifecycle, physical battery or manufacturer cloud test is claimed. The integration's hardcoded-device client_test.py was never executed. Informational mypy/Bandit are outside this hosted job; no release/version bump occurred. Maintainer acceptance remains pending.

Prepared with AI assistance; agents inspected the diff and evidence. No human-review attestation is made.

Timothy Anderson — Spotted Ridge Engineering / OC Labs · GDN (Global Decision Network)  
timothyanderson096@gmail.com · [Engineering evidence](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks)
