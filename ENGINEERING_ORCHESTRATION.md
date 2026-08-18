# Engineering Orchestration

> “Consensus triggers verification; it does not replace verification.”

> “Disagreement is useful when it produces testable verification work.”

> “Verified behavior outranks confident claims.”

The Engineering Orchestration layer coordinates a model-independent workflow:

`OBJECTIVE → PLANNER → BUILDER → ADVERSARIAL_REVIEWER → VERIFIER → EVIDENCE_JUDGE → REPAIR → RE-VERIFICATION → VERIFIED RESULT → OUTCOME EVIDENCE → REUSABLE LESSON`

It records coordination state only. It does not call providers, modify repositories, or alter Decision Dome scoring.

## Roles

- `PLANNER` decomposes the objective, constraints, tasks, and required checks.
- `BUILDER` creates a proposed artifact or change.
- `ADVERSARIAL_REVIEWER` searches for defects, failed assumptions, and testable failure modes.
- `VERIFIER` executes or evaluates observable checks.
- `EVIDENCE_JUDGE` compares claims with verification evidence and retains uncertainty.
- `REPAIRER` creates a new revision in response to verified defects.
- `SPECIALIST` and `OTHER` support bounded additional responsibilities.

Assignments retain distinct responsibilities, model identities, agent identities, tasks, and routing decisions.

## Claims, disagreement, and evidence

Agent claims and disagreements are not verification evidence. A disagreement stores both claims, agents and models involved, evidence cited by each side, the affected requirement, the verification needed, confidence, status, resolution, and notes. Resolution never deletes the original disagreement.

Verification requirements prefer automated tests, builds, typechecks, static analysis, deterministic reproduction, benchmarks, observable behavior, requirement checks, and artifact comparisons. `VerificationEvidence` records the procedure, observed result, artifacts, requirement, and timestamp.

The Evidence Judge returns `SUPPORTED`, `PARTIALLY_SUPPORTED`, `UNSUPPORTED`, `CONTRADICTED`, or `INSUFFICIENT_EVIDENCE`. A confident builder claim or unanimous agent agreement cannot produce `VERIFIED`; every requirement must have a passing latest verification result and the final claim must have a supported evidence judgment.

## Repair history

Failed verification can create a `RepairIteration` linking the failed checks and disagreements to both the original and repaired artifacts. Re-verification is a new record. Neither the proposal nor prior verification is overwritten.

## Portable learning

> “Engineering lessons should remain portable across models.”

Reusable lessons describe practices and failure modes without provider or model identity. Capability observations separately retain which model and agent performed each role, whether the observation was verified, latency, cost, and outcome.

The deterministic simulation demonstrates a reviewer finding a real state-mutation defect plus one non-material concern, verification confirming the defect, the judge rejecting completion, a repair, passing re-verification, and a model-neutral regression lesson.

## Presentation

CONDENSED reports result, verification status, verified-requirement count, unresolved issues, and next action. BALANCED adds assignments, disagreements, verification, repair iterations, and routing rationale. AUDIT exposes the complete session history.
