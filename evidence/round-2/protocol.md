# GDN Engineering A/B Round 2 Protocol

## Question

Does independent, evidence-driven GDN verification produce a better verified engineering outcome than one capable coding agent under matched conditions on three fresh public defects?

Round 2 is a fresh replication. It does not reuse Mastra, query-string, p-map, validator.js, their repositories, or their defect patterns.

## Locked environment and controls

- Windows/PowerShell; Node.js `v25.9.0`; npm `11.12.1`; git `2.53.0.windows.2`.
- Separate detached worktrees for `baseline-single-agent` and `gdn-verified` at the exact same commit.
- Same inherited Codex GPT-5-class model tier/configuration, task statement, shell/file tools, dependencies, and 20-minute maximum active turn for each matched engineer.
- Exact serving model identifier, reasoning-effort field, active-time counter, tokens, and credits are not exposed; unavailable values will be reported, not inferred.
- Candidate and baseline may edit necessary production source only. Tests, fixtures, dependencies, generated artifacts, evaluation controls, protocol, and audit files are frozen.
- No arm may inspect other worktrees, upstream fixes, research clones, verifier evidence not addressed to it, or the web.
- Acceptance/task SHA-256 hashes are recorded before dispatch and rechecked after final evaluation.

## Arms

Baseline uses one isolated coding-agent turn. Once complete, its worktree is frozen.

GDN uses the minimum roles:

1. one isolated candidate engineer;
2. one independent verifier that inspects and executes checks rather than restating the candidate; and
3. at most one bounded repair loop, only if executed verifier evidence contradicts or materially qualifies the candidate.

The root coordinator independently reruns final acceptance/regression checks and decides supported, contradicted, or unresolved from evidence.

## Locked regression commands

- Case 1: `npm test`.
- Case 2: `npx xo index.js test.js`, `npx ava`, and `npx tsd`. The declaration-file project-service failure from the composite `npm test` was reproduced before selection and is an environment/tooling incompatibility; declaration types are still checked by TSD.
- Case 3: temporarily remove inherited `NO_COLOR`, run `npm test`, then restore it. This prevents the host environment from contradicting Commander's own color-environment tests.

## Precommitted evaluation

| Field | Rule |
|---|---|
| Original failure reproduced | locked harness fails before patch |
| Verified repair | locked harness and independent invariant probes pass |
| Regression/type/build | all locked commands exit 0 |
| Scope discipline | only necessary production source changed |
| Side effects | none / suspected / confirmed from execution |
| Risk detection | strong / partial / absent |
| Patch quality | blinded task-and-diff review where practical |
| Time/usage | actual timestamps and visible values; unavailable stated plainly |

An arm is a verified success only if the full stated invariant, locked regression checks, and scope discipline pass. A green locked example is insufficient when executed boundary evidence contradicts the requirement. GDN wins, ties, losses, and inconclusive results are reported without adjustment.

## Interpretation limits

Three small library defects cannot establish broad superiority. Sessions share one host and model family; this is workflow/session independence, not model-family independence. Verification cost counts even when it does not change a patch.
