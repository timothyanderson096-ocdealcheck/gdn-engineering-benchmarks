# GDN engineering benchmarks

This repository publishes a reproducible baseline for the deterministic Decision Dome and GDN engineering-verification work. It contains the decision engine, calibration and presentation layers, provider-generation adapters, trusted candidate verification, examples, fixtures, and automated tests needed to inspect the implementation without relying on machine-local benchmark workspaces.

## Purpose

The project separates model-generated repair candidates from trusted verification. Provider adapters preserve immutable request and response provenance, extract patches without repairing them, fail closed on malformed or ineligible output, and pass only eligible unique patches to the verifier. The repository-grounded verifier uses isolated workspaces, protected assets, target checks, an independent discriminator, typechecking, regression tests, and evidence artifacts before classifying a repair as verified.

The decision layer remains deterministic and model-independent. It keeps evidence, hypotheses, uncertainty, stopping decisions, presentation, calibration, and historical snapshots explicit and reviewable.

See [`PROVIDER_AUTOMATION.md`](PROVIDER_AUTOMATION.md) for the provider and trusted-verifier architecture.

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

The publication baseline was reproduced from 16 test files with Node's test runner:

```text
tests 159
pass 159
fail 0
skipped 0
```

Typechecking and the TypeScript build also completed successfully. This publication makes no claim for an unrecovered historical 222-test result.

## Included verification layer

- deterministic verification-probe ranking, stopping, calibration, optimization, and state-change behavior;
- Anthropic and Gemini candidate-generation adapters with canonical requests and trusted provenance;
- strict patch extraction, exact-target enforcement, hashing, duplicate normalization, and zero duplicate-agreement weight;
- tournament orchestration that isolates generation failures from verification authority;
- repository-grounded verification with target, discriminator, typecheck, regression, protected-asset, and immutability checks;
- fail-closed classifications and persisted verification evidence.

## Publication boundaries

The repository excludes credentials and environment files, dependencies, build and coverage output, caches, Codex data, Flutter artifacts, generated benchmark workspaces, and machine-local artifacts. External benchmark archives, private trusted controls, real provider responses, and local tournament run directories are not included.
