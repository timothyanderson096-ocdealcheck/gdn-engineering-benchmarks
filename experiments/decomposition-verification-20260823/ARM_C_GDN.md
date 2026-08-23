# Arm C — Depth-2 decomposition + independent GDN verification

## Freeze state
Worker output and completion claims below were frozen before inspecting Arm A or Arm B outputs. The verifier section is appended only after the worker freeze.

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

The worker claims **R1–R12 are implemented**. This is self-report only and is not accepted as evidence.

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

_Pending after worker freeze._
