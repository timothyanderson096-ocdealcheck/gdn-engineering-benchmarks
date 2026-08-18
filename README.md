# GDN: evidence-driven AI engineering verification

> A reproducible architecture for moving AI-assisted engineering from plausible output toward verified outcomes.

GDN is a working verification architecture for AI-assisted engineering. It provides a transparent, testable path from model-generated candidates to evidence-backed outcomes while keeping generation separate from verification authority.

## Why this matters

AI-generated engineering can appear convincing without being correct. GDN provides a rigorous foundation for producing outcomes that are more transparent, testable, and trustworthy.

The architecture is designed to:

- separate model generation from verification authority;
- challenge candidate solutions rather than accept plausible output;
- preserve immutable provenance for requests, responses, patches, and decisions;
- test observable behaviour through targeted checks, independent discriminators, typechecking, and regression suites;
- record durable evidence for review and reproduction;
- fail closed when verification is incomplete, inconsistent, or compromised.

Provider adapters preserve request and response provenance, extract patches without repairing them, and pass only eligible unique candidates to the repository-grounded verifier. The verifier uses isolated workspaces, protected assets, target checks, independent discriminators, typechecking, regression tests, immutability checks, and evidence artifacts before classifying a repair as verified.

The wider decision layer remains deterministic and model-independent. It keeps evidence, hypotheses, uncertainty, stopping decisions, presentation, calibration, and historical snapshots explicit and reviewable.

See [`PROVIDER_AUTOMATION.md`](PROVIDER_AUTOMATION.md) for the provider and trusted-verifier architecture.

## Verification baselines

### Public GitHub CI

| Check | Result |
| --- | ---: |
| Test files | 16 |
| Tests discovered | 159 |
| Self-contained tests passed | 143 |
| Trusted integration tests skipped | 16 |
| Failed | 0 |
| Typecheck | Passed |
| Build | Passed |

Clean public GitHub CI executes every self-contained test. It registers the 16 trusted-verifier integration tests as skipped because their external trusted benchmark controls are intentionally excluded from this repository. GitHub does not independently verify those gated tests.

### Complete controlled local environment

| Check | Result |
| --- | ---: |
| Test files | 16 |
| Tests passed | 159 |
| Failed | 0 |
| Skipped | 0 |
| Typecheck | Passed |
| Build | Passed |

The complete controlled local environment includes the external trusted benchmark pack and executes all 159 tests successfully. This publication makes no claim for the unrecovered historical 222-test result.

## Setup

Requirements:

- Node.js 20 or newer
- npm

Install the lockfile-pinned development dependencies:

```sh
npm ci
```

Trusted-verifier integration tests use `GDN_BENCHMARK_ROOT` when it is set. For backwards compatibility, they otherwise look for the existing sibling directory `../gdn-benchmarks`. If neither location contains the complete trusted control pack, those 16 tests are registered as skipped with the reason `External trusted benchmark controls are not present.`

The external trusted controls remain outside this public repository and are neither reconstructed nor replaced by public stand-ins.

No provider credentials are needed for the automated test suite. Real provider execution is separately gated and is not part of the published baseline validation.

## Reproduce the baseline

```sh
npm run typecheck
npm test
npm run build
```

The expected public GitHub CI summary is:

```text
tests 159
pass 143
fail 0
skipped 16
```

With the external trusted benchmark pack available, the expected controlled local summary is:

```text
tests 159
pass 159
fail 0
skipped 0
```

## Included verification layer

- deterministic verification-probe ranking, stopping, calibration, optimization, and state-change behaviour;
- Anthropic and Gemini candidate-generation adapters with canonical requests and trusted provenance;
- strict patch extraction, exact-target enforcement, hashing, duplicate normalization, and zero duplicate-agreement weight;
- tournament orchestration that isolates generation failures from verification authority;
- repository-grounded verification with target, discriminator, typecheck, regression, protected-asset, and immutability checks;
- fail-closed classifications and persisted verification evidence.

## Publication boundaries

The repository excludes credentials and environment files, dependencies, build and coverage output, caches, Codex data, Flutter artifacts, generated benchmark workspaces, and machine-local artifacts. External benchmark archives, private trusted controls, real provider responses, and local tournament run directories are not included.

GDN is not presented as production-certified, independently validated, or proven superior to other approaches. The published baseline demonstrates the implementation and its reproducible checks; broader claims require further technical review, adversarial testing, and real-world evaluation.

## Review, collaboration, and pilots

GDN is now open for technical review, adversarial testing, collaboration, and potential pilot applications. Engineers, AI researchers, model providers, and organisations are invited to inspect the implementation, challenge its assumptions, and propose real engineering problems against which the architecture can be tested.

**Interested in testing GDN? Open an issue with a technical challenge, proposed experiment, or pilot enquiry.**
