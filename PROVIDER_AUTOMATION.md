# Automated real-provider candidate generation

## Repository audit

The repository had no candidate-generation interface, `TournamentOrchestrator`, automated patch-ingestion implementation, frozen-MRE value type, or reusable hashing/provenance utility. Existing live tournament records are filesystem artifacts under the external `gdn-benchmarks` directory, not executable repository code.

The closest existing interface is `EngineeringAgentAdapter` in `src/orchestration/types.ts`. It is intentionally not reused for repair generation because it returns model-authored claims and optional provider metadata, while provider identity, benchmark identity, hashes, and extraction status in this lane must be trusted adapter-owned facts.

The existing capability mechanism is `CapabilityRegistry` plus `updateCapabilityRegistry` in `src/orchestration/registry.ts`; there is no type named `ModelCapabilityRegistry`. Provider generation does not update it. Only downstream verifier-backed `CapabilityObservation` records with evidence IDs may enter that registry, preserving its current evidence authority.

Frozen MREs were Markdown files with hashes recorded in operator/tournament artifacts. The new `FrozenMre` representation copies exact bytes, validates the expected SHA-256, and exposes only a frozen byte array. Manual candidate envelopes were raw-response and patch files plus hand-authored JSON/Markdown metadata. The new generation envelope makes those fields deterministic in code without changing the verifier.

Architectural binding: the trusted verifier is now a callable repository component, but its authority remains the existing external benchmark artifacts. `RepositoryGroundedTrustedCandidateVerifier` consumes the hash-pinned baseline archive, frozen MRE, seed patch, seeded-failure evidence, and operator-owned discriminator for each configured benchmark. It does not copy an answer key into provider artifacts or substitute new verification semantics.

## Provider architecture

- `CandidateProviderAdapter` is generation-only and has `providerClass = REAL_EXTERNAL_MODEL_API`.
- `AnthropicCandidateProviderAdapter` calls `POST https://api.anthropic.com/v1/messages` with the standard version header.
- `GeminiCandidateProviderAdapter` calls the model-specific `generateContent` endpoint and authenticates with `x-goog-api-key`.
- Credentials are request headers only. They are never included in canonical task bytes, provenance envelopes, or generated evidence artifacts.
- Provider response bodies are copied and hashed before JSON parsing.
- Adapter configuration, not model prose, owns provider ID and model ID.
- Provider-reported token usage is accepted only as non-negative safe integers. Monetary cost remains `UNKNOWN` because neither response deterministically reports it.

## Canonical immutable request

`buildCanonicalProviderRequest` constructs one UTF-8 byte sequence from:

1. a fixed schema marker;
2. trusted benchmark ID and frozen-MRE hash;
3. one canonical repair instruction;
4. the exact frozen MRE bytes between fixed delimiters.

Both providers receive that exact text. Only the unavoidable outer API JSON schema differs, and each provider payload receives its own hash and format identifier. The request is rebuilt after transport returns; hash or MRE mutation fails closed.

## Patch extraction and provenance

Patch extraction preserves raw provider bytes and exact extracted patch text. It does not rename paths, repair hunk counts, infer missing files, convert prose, merge suggestions, or alter code. It classifies `NO_PATCH`, `MULTIPLE_PATCHES`, `MALFORMED_PATCH`, `WRONG_TARGET`, `RESPONSE_FORMAT_FAILURE`, and `EXTRACTION_AMBIGUOUS` explicitly.

Successful patches receive both an exact patch hash and a normalized identity hash. Normalization removes transport-only diff decoration and path prefixes while preserving hunk coordinates and every patch line. It is used only for duplicate identity; the exact submitted patch remains the verifier artifact.

Every attempt records trusted adapter/model identity, `REAL_EXTERNAL_MODEL_API`, attempt and benchmark IDs, frozen-MRE/request/provider-payload/raw-response/patch hashes, timestamps, latency, authoritative token usage when present, `UNKNOWN` cost, extraction status, and fail-closed error classification.

## Tournament handoff

- two providers always remain two generation attempts;
- only `EXTRACTED` exact-target artifacts become verification candidates;
- identical normalized patches produce one verification candidate and one verifier call;
- duplicate agreement weight is fixed at zero;
- different normalized patches receive distinct workspace isolation keys;
- provider failures and malformed candidates never reach the verifier;
- candidate confidence, provider reputation, and model-authored metadata are absent from verification inputs.

The trusted verifier retains all sandbox, regression, evidence, protected-asset, ranking, and milestone authority.

## Trusted verifier binding

For every eligible unique patch, the verifier:

1. validates benchmark, frozen-MRE, canonical-request, generation-envelope, exact-patch, and normalized-patch identities;
2. reconstructs a fresh workspace from the hash-pinned `baseline-source.tar` and confirms the archive''s embedded commit;
3. applies the hash-pinned seed mutation, requiring exactly the configured implementation target to change;
4. runs `git apply --check` and applies the exact submitted candidate patch without repair;
5. compares all archive paths against the clean baseline, allowing source differences only at the permitted target;
6. executes the target, protected independent discriminator, typecheck, and full test suite;
7. rechecks repository and isolated dependency manifests after every command;
8. confirms the original sealed seeded workspace remains byte-identical;
9. emits command logs, protected-asset audits, `evidence-delta.json`, and `verification-result.json`.

Execution uses a copied, lockfile-matched dependency bundle inside the disposable workspace. Node''s permission model denies network and child-process access; read access is limited to the isolated workspace and trusted discriminator, and write access is limited to the disposable tool temp directory. Command timeouts and output limits fail closed.

Configured classifications include `VERIFIED_REPAIR`, `TARGET_FAIL`, `PARTIAL_REPAIR`, `TARGET_FIXED_REGRESSION_INTRODUCED`, `TARGET_FIXED_BUT_SEMANTICALLY_WRONG`, `VERIFICATION_WEAKENING`, `FAILURE_SUPPRESSION_ATTEMPT`, `EVIDENCE_BYPASS_ATTEMPT`, `OBJECTIVE_SUBSTITUTION`, `PROTECTED_ASSET_TAMPERING`, `PATCH_APPLICATION_FAILURE`, and `VERIFIER_ERROR`.
## Credentials and explicit real mode

Required configuration:

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL_ID`
- `GEMINI_API_KEY`
- `GEMINI_MODEL_ID`
- benchmark root via `GDN_BENCHMARK_ROOT` or `--benchmark-root`

Real calls require two independent gates: `GDN_REAL_PROVIDER_CALLS=1` and `--execute-real`. Normal tests use mocked transports and never call a provider.

Prepared reruns are limited to Benchmarks 07–10. Examples:

```text
npx tsx scripts/provider-tournament.ts --help
npx tsx scripts/provider-tournament.ts --execute-real --benchmark BENCH-SEEDED-MULTISTEP-10 --benchmark-root <path>
npx tsx scripts/provider-tournament.ts --execute-real --all-difficult --benchmark-root <path>
```

Generation artifacts are written under each benchmark's `tournament/automated-.../generation` directory. Eligible unique patches are verified immediately in fresh isolated workspaces. Generation, verification evidence, duplicate mappings, winner status, and milestone status are recorded under the run directory.


## Milestone policy

The existing `REAL_HETEROGENEOUS_MODEL_REPAIR_PROVEN_MANUAL` milestone remains unchanged. Generation success alone establishes no new milestone. `REAL_MULTI_PROVIDER_ADAPTER_TOURNAMENT_PROVEN` may be claimed only after a real Claude/Gemini run supplies eligible submitted artifacts and the complete trusted verification, regression, sandbox, protected-asset, and evidence chain passes. This lane does not establish production-defect repair or provider superiority.

