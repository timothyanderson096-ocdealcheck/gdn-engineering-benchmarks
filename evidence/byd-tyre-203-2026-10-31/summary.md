## BYD tyre-warning candidate checks

Result: **CANDIDATE_GATES_PASSED**

Public candidate: `timothyanderson096-ocdealcheck/hass-byd-vehicle@8f4abddeedadf23b2831a40ee55c0dd9088844d3`

Four suites run per revision: 14 isolated, 3 configured, 1 real-core-startup and 8 existing tests.
Baseline intentionally reproduces 12 assertion failures; candidate requires all 26 tests passing.
HA core, entry setup, services and states are real; BYD cloud/session inputs are synthetic. No vehicle, frontend or cloud claim.

| Check | Result | Actual exit |
| --- | --- | --- |
| source | PASS | 0 |
| native-version | PASS | 0 |
| native-venv | PASS | 0 |
| native-install | PASS | 0 |
| native-dependencies | PASS | 0 |
| native-packages | PASS | 0 |
| native-pins | PASS | 0 |
| baseline-native | PASS | 1 |
| baseline-native-counts | PASS | 0 |
| baseline-configured | PASS | 1 |
| baseline-configured-counts | PASS | 0 |
| baseline-started | PASS | 1 |
| baseline-started-counts | PASS | 0 |
| baseline-existing | PASS | 0 |
| baseline-existing-counts | PASS | 0 |
| candidate-native | PASS | 0 |
| candidate-native-counts | PASS | 0 |
| candidate-configured | PASS | 0 |
| candidate-configured-counts | PASS | 0 |
| candidate-started | PASS | 0 |
| candidate-started-counts | PASS | 0 |
| candidate-existing | PASS | 0 |
| candidate-existing-counts | PASS | 0 |
| lint-version | PASS | 0 |
| lint-venv | PASS | 0 |
| lint-install | PASS | 0 |
| lint-dependencies | PASS | 0 |
| lint-packages | PASS | 0 |
| lint-pins | PASS | 0 |
| ruff | PASS | 0 |
| black | PASS | 0 |
| fixture-ruff | PASS | 0 |
| fixture-black | PASS | 0 |
| mypy | PASS | 0 |
| docker-probe | PASS | 0 |
| hassfest-pull | PASS | 0 |
| hassfest-image | PASS | 0 |
| hassfest | PASS | 0 |
| hacs-target | PASS | 0 |
| hacs-pull | PASS | 0 |
| hacs-image | PASS | 0 |
| hacs | PASS | 0 |
