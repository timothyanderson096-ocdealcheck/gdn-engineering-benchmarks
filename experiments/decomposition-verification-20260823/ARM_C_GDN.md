# Arm C — Depth-2 decomposition + independent GDN verification

## Freeze state
Worker output and completion claims below were frozen before inspecting Arm A or Arm B outputs. The verifier section was added only after that freeze.

## Exact worker prompt

> Implement the frozen task in `experiments/decomposition-verification-20260823/TASK.md` as `experiments/decomposition-verification-20260823/solutions/arm-c-gdn.mjs`.
>
> Use exactly the frozen source context and R1–R12 acceptance criteria. Before implementation, decompose the task to depth 2: task -> atomic subtasks with explicit requirement mapping. Then produce one worker solution. Do not use another arm's output, do not use an independent verifier while generating the worker answer, do not weaken any requirement, and do not claim execution evidence you have not actually observed.

## Depth-2 decomposition

### T1 — Validate and normalize each input check
- T1.1 Validate top-level `checks` is an array. **R1**
- T1.2 Validate every `id` is a string, trim it, reject empty trimmed ids. **R2**
- T1.3 Track trimmed ids in a case-sensitive set and reject duplicates. **R3**
- T1.4 Preserve input order and construct fresh output objects without mutation. **R4**
- T1.5 Validate status is exactly one of PASS / FAIL / UNRESOLVED. **R11**
- T1.6 Resolve `required` so only literal false is optional. **R7**

### T2 — Adjudicate individual checks
- T2.1 For PASS, require string evidence containing a non-whitespace character. **R5**
- T2.2 Normalize PASS without qualifying evidence to UNRESOLVED / `missing-evidence`. **R5**
- T2.3 Preserve FAIL as FAIL / `failed`. **R6**
- T2.4 Preserve UNRESOLVED as UNRESOLVED / `unresolved`. **R6**
- T2.5 Return each normalized check as `{ id, status, required, reason }`. **R2, R5, R6, R7**

### T3 — Aggregate batch outcome
- T3.1 Count every normalized check, including optional checks. **R8**
- T3.2 Compute overall from required checks only with FAIL precedence, then UNRESOLVED, else PASS. **R9**
- T3.3 If there are zero required checks, return overall UNRESOLVED. **R10**

### T4 — Keep execution deterministic and dependency-free
- T4.1 Use only ECMAScript built-ins and pure in-memory computation. **R12**
- T4.2 Do no I/O, network, logging, time, randomness, or environment reads. **R12**

## Frozen worker output

Path: `experiments/decomposition-verification-20260823/solutions/arm-c-gdn.mjs`

```js
export function adjudicateBatch(checks) {
  if (!Array.isArray(checks)) {
    throw new TypeError('checks must be an array');
  }

  const seenIds = new Set();

  const normalizedChecks = checks.map((check) => {
    if (check === null || typeof check !== 'object') {
      throw new TypeError('each check must be an object');
    }

    if (typeof check.id !== 'string') {
      throw new TypeError('check id must be a string');
    }

    const id = check.id.trim();
    if (id.length === 0) {
      throw new TypeError('check id must be non-empty after trimming');
    }

    if (seenIds.has(id)) {
      throw new TypeError('duplicate check id');
    }
    seenIds.add(id);

    if (
      check.status !== 'PASS' &&
      check.status !== 'FAIL' &&
      check.status !== 'UNRESOLVED'
    ) {
      throw new TypeError('invalid check status');
    }

    const required = check.required === false ? false : true;

    let status = check.status;
    let reason;

    if (status === 'PASS') {
      const hasEvidence =
        typeof check.evidence === 'string' && /\S/.test(check.evidence);

      if (hasEvidence) {
        reason = 'accepted';
      } else {
        status = 'UNRESOLVED';
        reason = 'missing-evidence';
      }
    } else if (status === 'FAIL') {
      reason = 'failed';
    } else {
      reason = 'unresolved';
    }

    return { id, status, required, reason };
  });

  const counts = {
    total: normalizedChecks.length,
    pass: 0,
    fail: 0,
    unresolved: 0,
  };

  for (const check of normalizedChecks) {
    if (check.status === 'PASS') counts.pass += 1;
    else if (check.status === 'FAIL') counts.fail += 1;
    else counts.unresolved += 1;
  }

  const requiredChecks = normalizedChecks.filter((check) => check.required);

  let overall;
  if (requiredChecks.length === 0) {
    overall = 'UNRESOLVED';
  } else if (requiredChecks.some((check) => check.status === 'FAIL')) {
    overall = 'FAIL';
  } else if (requiredChecks.some((check) => check.status === 'UNRESOLVED')) {
    overall = 'UNRESOLVED';
  } else {
    overall = 'PASS';
  }

  return {
    overall,
    counts,
    checks: normalizedChecks,
  };
}
```

## Frozen worker completion claims

The worker claimed **R1–R12 are implemented**. These claims were frozen before any independent execution evidence was observed.

| Requirement | Worker claim |
|---|---|
| R1 | COMPLETE |
| R2 | COMPLETE |
| R3 | COMPLETE |
| R4 | COMPLETE |
| R5 | COMPLETE |
| R6 | COMPLETE |
| R7 | COMPLETE |
| R8 | COMPLETE |
| R9 | COMPLETE |
| R10 | COMPLETE |
| R11 | COMPLETE |
| R12 | COMPLETE |

## Worker-observed execution evidence at freeze

None. No deterministic test, acceptance, typecheck, or build result was used to justify the worker's completion claims before freeze.

---

## Independent verifier

Verification was performed only after the worker solution and claims were frozen. Worker self-report was not accepted as evidence.

### Frozen acceptance runner

The exact frozen `acceptance/run.mjs` was executed against the exact committed Arm C solution with Node.js v22.16.0.

Command equivalent:

```text
node acceptance/run.mjs solutions/arm-c-gdn.mjs
```

Raw result:

```text
ACCEPTANCE_PASS
```

### Independent requirement probes

A separate verifier exercised each frozen requirement directly. It was not used to generate or repair the worker solution.

Raw result summary:

```text
R1  PASS
R2  PASS
R3  PASS
R4  PASS
R5  PASS
R6  PASS
R7  PASS
R8  PASS
R9  PASS
R10 PASS
R11 PASS
R12 PASS
VERIFIER_PASS 12/12
```

The R12 probe additionally inspected the exact committed solution source for runtime imports/dependencies and prohibited external-effect primitives used by the implementation. No imports, I/O, network, logging, time, randomness, environment reads, timers, or dynamic dependency calls were present.

## Claim -> verification requirement -> probe -> raw result -> adjudication

| Claim | Verification requirement | Independent probe | Raw result | Adjudication |
|---|---|---|---|---|
| R1 complete | Non-array input throws TypeError | null, object and string inputs | PASS | PASS |
| R2 complete | id is string, trims, non-empty | padded id, blank id, numeric id | PASS | PASS |
| R3 complete | trimmed duplicate rejected; case-sensitive distinction allowed | ` x ` + `x`; `x` + `X` | PASS | PASS |
| R4 complete | preserve order and caller input | deep-clone comparison, order check, fresh output object check | PASS | PASS |
| R5 complete | PASS needs non-whitespace string evidence | undefined, empty, whitespace, number, null, valid text | PASS | PASS |
| R6 complete | FAIL/UNRESOLVED cannot be upgraded by evidence | both statuses with evidence | PASS | PASS |
| R7 complete | only literal false is optional | false vs undefined/true/0/null/string | PASS | PASS |
| R8 complete | counts include all normalized checks including optional | optional PASS/FAIL plus required UNRESOLVED | PASS | PASS |
| R9 complete | overall uses required-only precedence FAIL > UNRESOLVED > PASS | optional failure, required unresolved, required fail, all required pass | PASS | PASS |
| R10 complete | zero required checks => UNRESOLVED | empty and all-optional batches | PASS | PASS |
| R11 complete | only exact three statuses accepted | lowercase, SKIP, empty, null, undefined, number | PASS | PASS |
| R12 complete | no dependencies or prohibited external effects | committed-source static scan plus execution of pure function | PASS | PASS |

## Arm C metrics

- Requirements claimed complete by worker: **12/12**.
- Requirements independently verified: **12/12**.
- Frozen acceptance runner: **PASS**.
- False completion claims: **0**.
- Defects caught only by independent verification: **0**.
- Verification false positives: **0**.
- Worker repair attempts after verification: **0**.

## Execution limitations

Repository-wide regression controls (`npm test`, `npm run typecheck`, `npm run build`) could not be executed because the local runtime could not resolve `github.com` to clone the full branch. The observed clone failure was:

```text
fatal: unable to access 'https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks.git/': Could not resolve host: github.com
```

Accordingly, no repository-wide regression pass is claimed. The task-specific frozen acceptance runner and independent requirement probes are the deterministic evidence used for Arm C.

## Arm C result boundary

Arm C passed all frozen task-specific checks. In this case verification **confirmed** the worker rather than finding a residual defect. This demonstrates evidence-gated completion on the selected task, but it does not show that verification improved the implementation, and it does not establish general superiority.
