# Result — Decomposition vs Verification Experiment — 2026-08-23

## Executive result

**Null quality result on this task.** All three arms produced implementations that passed the same frozen acceptance runner and the same post-freeze independent R1–R12 verifier.

- Arm A — flat prompt: **12/12 verified; acceptance PASS**.
- Arm B — depth-2 decomposition: **12/12 verified; acceptance PASS**.
- Arm C — depth-2 + GDN independent verification: **12/12 verified; acceptance PASS**.
- False completion claims: **0 / 36 total requirement claims**.
- Defects caught only by verification: **0**.
- Verification false positives: **0**.

This experiment therefore does **not** show that decomposition improved implementation compliance, because the flat arm already achieved full compliance. It also does **not** show that independent verification improved the implementation, because there was no residual defect to catch. Arm C did, however, convert self-reported completion into independently evidenced completion.

## Selected task

Frozen task: implement a dependency-free ECMAScript `adjudicateBatch(checks)` function with 12 independently checkable requirements covering input validation, trimmed/case-sensitive ids, non-mutation/order, evidence gating, status preservation, optional-vs-required semantics, counts, overall precedence, the zero-required boundary, exact status vocabulary, and no external side effects.

The frozen task and criteria are in `TASK.md`; they were not altered after any arm output.

## Final comparison

| Metric | Arm A — Flat | Arm B — Depth-2 | Arm C — Depth-2 + GDN |
|---|---:|---:|---:|
| Worker completion claims | 12/12 | 12/12 | 12/12 |
| Independently verified requirements | 12/12 | 12/12 | 12/12 |
| Frozen acceptance runner | PASS | PASS | PASS |
| Missed requirements | 0 | 0 | 0 |
| False completion claims | 0 | 0 | 0 |
| Defects found only by verification | n/a | n/a | 0 |
| Verification false positives | n/a | n/a | 0 |
| Hierarchical decomposition | No | Yes | Yes |
| Independent verification gate during arm | No | No | Yes |
| Post-result repair | 0 | 0 | 0 |

Arm A's frozen acceptance runner had not been executed during its original arm recording because that runtime could not access repository execution. During the final comparison, after all arm outputs were frozen, the exact Arm A solution was executed against the same frozen runner and returned `ACCEPTANCE_PASS`. The same independent requirement verifier also returned 12/12 for A. This later evidence does not alter the Arm A worker output.

## Requirement-level evidence

The final independent comparison applied the same direct probes to each exact frozen solution.

| Req | What was tested | A | B | C |
|---|---|---|---|---|
| R1 | Non-array input throws TypeError | PASS | PASS | PASS |
| R2 | id type, trimming, blank rejection | PASS | PASS | PASS |
| R3 | trimmed duplicate rejection and case sensitivity | PASS | PASS | PASS |
| R4 | input non-mutation, fresh output, order | PASS | PASS | PASS |
| R5 | PASS evidence must be non-whitespace string | PASS | PASS | PASS |
| R6 | FAIL / UNRESOLVED cannot be upgraded | PASS | PASS | PASS |
| R7 | only literal false is optional | PASS | PASS | PASS |
| R8 | counts include optional checks | PASS | PASS | PASS |
| R9 | required-only overall precedence | PASS | PASS | PASS |
| R10 | zero required checks => UNRESOLVED | PASS | PASS | PASS |
| R11 | exact status vocabulary only | PASS | PASS | PASS |
| R12 | no runtime dependency / prohibited external effects | PASS | PASS | PASS |

The frozen acceptance runner returned the same raw result for all three solutions:

```text
ACCEPTANCE_PASS
```

The post-freeze independent verifier returned:

```text
VERIFIER 12/12
```

for each arm.

## What decomposition changed

Depth-2 decomposition made the requirement structure explicit before coding. Arm B mapped 14 atomic subtasks to R1–R12, while Arm C independently produced a similarly explicit requirement-mapped plan.

On this task, that additional structure **did not produce a measurable compliance gain**: Arm A already passed 12/12. The experiment therefore cannot attribute any quality improvement to decomposition.

The useful observation is narrower: decomposition created a clearer implementation plan and requirement traceability, but traceability is not the same thing as demonstrated correctness.

## What verification changed

Verification changed the **epistemic status** of the result rather than the code.

Before verification, Arm C had 12 worker claims and zero execution evidence. GDN then converted each claim into an explicit verification requirement, exercised an independent probe, recorded the raw result, and adjudicated the requirement.

Outcome: all 12 claims were supported. No repair was required.

So in this experiment, independent verification added **assurance and evidence**, not a better implementation. That distinction matters commercially: a verification system should be allowed to return “the worker was already correct.” Manufacturing a defect to prove value would invalidate the experiment.

## False completion claims

There were **0 false completion claims** across the final independently checked outputs:

- Arm A: 0 / 12.
- Arm B: 0 / 12.
- Arm C: 0 / 12.

Total: **0 / 36**.

## Defects found only by verification

**0.**

The selected task did not leave a residual defect in Arm C for verification to expose.

## Verification false positives

**0.**

The independent verifier did not reject any requirement that the deterministic evidence supported.

## Execution limitations

The task-specific runner and independent requirement probes were executed with Node.js v22.16.0 against local copies matching the exact committed solution texts.

Repository-wide regression controls (`npm test`, `npm run typecheck`, `npm run build`) were not executed in the final runtime because direct Git clone could not resolve `github.com`:

```text
fatal: unable to access 'https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks.git/': Could not resolve host: github.com
```

No repository-wide pass is inferred or claimed.

Other limitations:

1. Single small synthetic task.
2. All three implementations were produced within the same broad model/tooling environment rather than independently sampled model populations.
3. The requirements were explicit and relatively local; they did not strongly stress long-horizon instruction retention or cross-file interactions.
4. The acceptance surface was visible as a frozen contract, even though Arm C did not inspect the runner during worker generation.
5. No repeated trials or randomised task order were used, so variance is unknown.
6. No meaningful cost/time comparison is available because exact model token counts and execution timing were not exposed consistently across arms.

## Does the result support decomposition, verification, both, or neither?

### Implementation-quality claim

**Neither.** There is no measured quality delta because A = B = C = 12/12.

### Process/assurance claim

**Verification is supported only as an evidence-gating process**, not as a demonstrated quality-improvement mechanism in this task. Arm C did what the architecture says it should do: it refused to treat worker self-report as proof, then independently established that the claims were correct.

Decomposition is supported only as useful requirement organisation/traceability here; no compliance benefit was demonstrated.

## Commercial relevance

This is not a sales proof that GDN catches defects decomposition misses. It should **not** be presented that way.

What it does demonstrate is a commercially relevant distinction between:

- “the engineer/agent says the task is complete”; and
- “each completion claim has an explicit independent evidence chain.”

For safety-, infrastructure-, autonomy-, calibration-, or other assurance-sensitive software, that evidence chain can still be valuable even when the original implementation is correct. But stronger commercial evidence requires tasks where plausible workers sometimes fail.

## Best next experiment

Run the same three-arm design on a **fresh, unseen, harder repository task with interacting requirements and a frozen hidden discriminator**.

Recommended design:

- choose 5 fresh real repository issues or equivalent tasks not previously solved by GDN;
- require at least 15 independently checkable requirements per task;
- include at least two interaction/state/edge-case requirements that are easy to satisfy locally but fail in combination;
- freeze acceptance before any arm runs;
- keep the discriminator hidden from workers while exposing only the user-facing specification;
- run A, B, and C with matched information/model budgets and no cross-arm access;
- permit Arm C verification to identify failures, then separately measure whether a bounded repair converts those failures to acceptance passes;
- report per-task and aggregate compliance, false completion claims, defect catches, false positives, repair conversion rate, execution cost, and time.

The experiment becomes commercially interesting only if repeated tasks produce a stable separation such as: decomposition reduces misses, and verification catches a meaningful fraction of the residual misses without excessive false positives.

## Final verdict

**Controlled null result, correctly reported.**

All three arms solved this task. Decomposition did not beat the flat prompt, and GDN verification did not uncover a defect. GDN's contribution in this run was independent evidence that the completion claims were true.

That is useful process evidence, but the next experiment must be materially harder before drawing any commercial conclusion about defect detection or engineering outcome improvement.
