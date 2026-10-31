# Battery capacity units — issue #6 — 31 October 2026

A sensor reporting 11059 Wh was interpreted as11059 kWh. The fix converts explicit supported energy units to kWh using Home Assistant's EnergyConverter and one value/unit state snapshot. kWh and absent/empty-unit legacy inputs preserve their behavior. Incompatible units log a warning and skip calculation; existing forecast retention, availability and timestamp behavior remain unchanged. The existing battery-only runtime cap is applied before integer conversion to handle large finite normalized capacities.

Candidate: [a6f76ef5858f39759ad9ff332041ea00dd148230](https://github.com/timothyanderson096-ocdealcheck/houseload_forecast/commit/a6f76ef5858f39759ad9ff332041ea00dd148230), based on a37dbdb2ab04cece733f949b636f5be97bdd2c2b. [Original issue #6](https://github.com/thokoh74-DE/houseload_forecast/issues/6). Full candidate tree 600e777f3ffea1cdf0bf0a74baa790de3737757a includes 13 files: one production implementation file, one regression file, targeted bilingual documentation/translations and changelog copies.

[Hosted run 41184738278](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/41184738278) passes all 20 recorded stages: exact 13 blobs/complete tree, eight unittest methods, dependencies, required Ruff plus explicit test path, actual Python 3.12.14 compilation, actual pinned Docker hassfest and all ten HACS validators on the proper public fork and exact SHA with no ignored checks. Native runtime Python 3.14.8 / HA 2026.10.2 / Ruff 0.17.3. [result.json](result.json) and [summary.md](summary.md) retain every actual exit and image pin.

The identical tests on the unchanged baseline expose 13 failed assertions/subtests and 3 numeric OverflowError cases; [raw baseline log](baseline-regressions.log) retains them. These are behavior/numeric failures in the original source, not setup or collection errors. Candidate all 8 methods pass, with zero failures/errors/skips ([log](regression.log), [counts](regression-result.json)). Controls cover kWh/unitless compatibility, Wh equivalence, other energy units, one-state snapshot, invalid units, startup availability, retained forecast publication/recovery and numeric limits. Edited JSON/copy checks and independent inspections also passed.

Artifact 13036402693: 21,103 bytes, SHA256 bd540916e7628af0c435a30d8adc55542aed1d8900001a6af91b1c027feb863d. HACS's existing nonblocking missing-categories warning remains visible in its raw log.

Tests use synthetic HA states, temporary SQLite/cache files, the full real coordinator and manually bound real sensor entities. No full config-entry/platform lifecycle, physical battery, manufacturer cloud, release-ZIP installation or reporter HA 2026.10.4/Python 3.14.9 environment is claimed. HACS manifest validation does not establish release-package installability. No release/version bump occurred. Existing timestamp advancement when retaining an older forecast is explicitly preserved and tested.

Prepared with AI assistance. Agent review and reproducible evidence do not constitute human maintainer approval.

Timothy Anderson — Spotted Ridge Engineering / OC Labs · GDN (Global Decision Network) · [Engineering evidence](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks)
