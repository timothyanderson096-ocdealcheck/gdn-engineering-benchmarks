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

## Verified publication baseline

| Check | Result |
| --- | ---: |
| Test files | 16 |
| Tests passed | 159 |
| Failed | 0 |
| Skipped | 0 |
| Typecheck | Passed |
| Build | Passed |

This baseline was reproduced from the published snapshot. This publication makes no claim for the unrecovered historical 222-test result.

## Setup

Requirements:

- Node.js 20 or newer
- npm

Install the lockfile-pinned development dependencies:

```sh
npm ci
```

No provider credentials are needed for the automated test suite. Real provider execution is separately gated and is not part of the published baseline validation.

## Reproduce the baseline

```sh
npm run typecheck
npm test
npm run build
```

The expected Node test-runner summary is:

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
