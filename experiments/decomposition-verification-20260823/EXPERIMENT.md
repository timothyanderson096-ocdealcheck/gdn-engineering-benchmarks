# Decomposition vs Verification Experiment — 2026-08-23

## Question
Does hierarchical task decomposition improve instruction compliance, and does independent GDN-style verification catch failures that decomposition alone still misses?

## Arms
A. Flat prompt: one model receives the complete task and requirements in one block.

B. Depth-2 decomposition: the same task is split into tasks and atomic subtasks before implementation. No independent verification authority is added.

C. Depth-2 + independent verification: same decomposition as B, but completion is not accepted from worker self-report. Each claimed requirement is converted into an explicit verification requirement and checked independently against observable evidence.

## Controls
- Same frozen task and source context for all three arms.
- Same model family where possible.
- Same information budget and no access to other arms' outputs before submission.
- No changes to main. All experiment material remains on this branch.
- Do not weaken or alter acceptance criteria after seeing outputs.
- Separate worker claims from verifier evidence.

## Task selection criteria
Choose one existing GDN engineering benchmark or equivalent repository-grounded coding task that:
1. has at least 6 independently checkable requirements;
2. contains at least one interaction/edge-case requirement easy for a plausible implementation to miss;
3. has deterministic acceptance evidence available from repository tests, typecheck, build, or a frozen discriminator;
4. can be evaluated without changing private trusted controls;
5. is small enough for all three arms to complete under comparable budgets.

If an existing published case cannot satisfy these criteria without contaminating the comparison, define a new synthetic repository-grounded task on this branch only, with frozen acceptance criteria written before any arm is run.

## Required outputs per arm
- exact input prompt;
- decomposition plan where applicable;
- worker output or proposed patch;
- explicit completion claims;
- deterministic test/typecheck/build evidence where available;
- requirement-by-requirement compliance matrix;
- token/time/tool-use observations if available;
- failures, false positives, and unresolved items.

## Verification contract for Arm C
For every claimed requirement:
CLAIM -> VERIFICATION REQUIREMENT -> INDEPENDENT PROBE -> RAW RESULT -> ADJUDICATION.

A requirement may be marked PASS only when evidence supports it. Worker checkboxes/self-report are not evidence. If evidence is missing or ambiguous, mark UNRESOLVED rather than PASS.

## Primary metrics
1. Requirement compliance rate.
2. Acceptance-pass rate.
3. Number of missed requirements.
4. Number of false completion claims.
5. Number of defects caught only by independent verification.
6. Verification false positives.
7. Extra execution cost/time where observable.

## Interpretation
This is a small controlled experiment, not evidence of broad superiority. A useful result is either:
- decomposition measurably improves compliance over the flat arm; or
- independent verification identifies residual failures/self-reported completion errors that decomposition does not eliminate.

A null result is acceptable and must be reported as such.

## Final report
Produce RESULT.md with:
- selected task and frozen criteria;
- A/B/C results table;
- requirement-level evidence;
- what decomposition changed;
- what verification changed;
- limitations;
- commercial implication, if any;
- recommended next experiment.
