# GDN Engineering A/B Benchmark Protocol

## Question

> Does GDN produce a better verified software-engineering outcome than a single capable coding agent working from the same task, source commit, model tier, and tool access?

This benchmark tests ordinary functional correctness only. It excludes security work, credentials, external services, upstream writes, and the Mastra pilot.

## Locked environment and fairness controls

- Host: Windows, PowerShell; Node.js `v25.9.0`; npm `11.12.1`; git `2.53.0.windows.2`.
- Both arms use isolated detached worktrees at the same pinned commit and dependencies installed with `npm install --ignore-scripts --no-package-lock --no-audit --no-fund --legacy-peer-deps`.
- Both arms use the inherited Codex GPT-5-class configuration and the same local shell/file tools. The product does not expose an exact serving model identifier, reasoning-effort setting, token count, or credit total; these fields will be reported as unavailable, not inferred.
- The task statement for each case is the corresponding locked `evaluation/task.md`. Neither arm receives the upstream fix diff.
- Maximum active working time is 20 minutes per engineering arm per case. An arm stops earlier once evidence is sufficient to classify it.
- Test, fixture, dependency, generated-output, harness, audit, and evaluation-control changes are forbidden. Only necessary production-source changes are scoreable.
- The evaluation harnesses and rubric are locked before arm dispatch. SHA-256 hashes are recorded in case evidence.

## Baseline arm

One isolated coding-agent session receives only its worktree, task statement, acceptance command, regression command, environment, and restrictions. It investigates, edits production source, and validates independently. It receives no GDN reasoning, candidate patch, verifier result, upstream patch, or hidden evaluation result.

## GDN arm

1. An isolated candidate-engineer session receives the same information as the baseline and proposes a repair.
2. A separate verifier session receives the task, candidate worktree, and locked commands. It independently inspects source and patch, executes verification, probes boundary/regression risks, and reports evidence.
3. The candidate receives only verifier evidence that justifies changes and may perform one bounded repair loop.
4. The root session performs final evidence review and classification.

Agents use the same inherited model family/configuration. Therefore this benchmark tests role/session separation and verification, not model-family independence.

## Commands and evidence capture

Every arm must report commands actually executed. The coordinator independently reruns acceptance, regression, and build/type checks and saves stdout/stderr, exit status, `git diff`, `git status`, and timestamps under `evaluation/evidence/`. Wall-clock dispatch-to-completion time is recorded; active agent time is approximated by that interval because the product exposes no separate active-time counter.

## Precommitted evaluation rubric

Each anonymous patch is scored on:

| Field | Values / rule |
|---|---|
| Original failure reproduced | pass/fail before patch |
| Stated invariant repaired | acceptance harness exit 0/otherwise fail |
| Regression suite | documented repository command exit 0/otherwise fail |
| Typecheck/build | included repository command exit 0/otherwise fail/not applicable |
| Scope discipline | only necessary production source changed |
| New side effects | none/suspected/confirmed from evidence |
| Unresolved-risk detection | strong/partial/absent |
| Patch quality | blinded review of correctness, clarity, minimality, boundary coverage |

An arm is a verified success only if the direct invariant, regression suite, applicable build/type checks, and scope discipline all pass. A passing repository suite alone is insufficient. Final patches are copied as anonymous Arm A/Arm B diffs before comparative review; arm identities are revealed only after review notes are recorded.

## Decision rule and limitations

The central claim is supported only if GDN produces more verified successes or a materially safer/higher-quality patch on evidence, not merely more commentary. Equal outcomes with higher GDN cost count as cost without improvement. Three small utility-library defects cannot establish broad external validity. Agents share one host and inherited model family, and the evaluator is the coordinating root session; session separation is real, but model-family independence and a fully independent human judge are absent.
