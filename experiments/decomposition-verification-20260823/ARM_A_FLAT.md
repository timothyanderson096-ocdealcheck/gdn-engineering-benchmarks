# Arm A — flat prompt

## Isolation

This arm used one flat implementation prompt. No hierarchical decomposition was used. No independent GDN verification was used during worker generation. `TASK.md` and the parameterized acceptance runner were frozen before the worker solution was written. No later-arm outputs were inspected or created.

## Exact worker input prompt

> Implement a dependency-free ECMAScript module exporting `adjudicateBatch(checks)` at `experiments/decomposition-verification-20260823/solutions/arm-a-flat.mjs`.
>
> Each check is `{ id, status, evidence?, required? }`, where status is exactly `PASS`, `FAIL`, or `UNRESOLVED`, and `required` defaults to true.
>
> Return `{ overall, counts, checks }`. `overall` is one of the same three statuses. `counts` contains `total`, `pass`, `fail`, and `unresolved`. Each returned check contains trimmed `id`, normalized `status`, resolved boolean `required`, and reason: `accepted`, `failed`, `unresolved`, or `missing-evidence`.
>
> Requirements: R1 `checks` must be an array; otherwise throw TypeError. R2 every id must be a non-empty string after trimming; output the trimmed id. R3 duplicate ids after trimming are forbidden and compared case-sensitively; throw TypeError. R4 preserve input order and do not mutate the input array or its objects. R5 PASS requires evidence containing at least one non-whitespace character; otherwise normalize to UNRESOLVED with `missing-evidence`. R6 FAIL stays FAIL with `failed`; UNRESOLVED stays UNRESOLVED with `unresolved`; evidence cannot upgrade them. R7 only literal `required: false` is optional; omitted or any other value resolves to true. R8 counts cover all normalized checks, including optional checks. R9 overall uses required checks only with precedence any FAIL => FAIL, else any UNRESOLVED => UNRESOLVED, else all required PASS => PASS. R10 zero required checks, including empty or all-optional input, => overall UNRESOLVED. R11 any status other than exactly PASS, FAIL, or UNRESOLVED throws TypeError. R12 no runtime dependencies or I/O, network, logging, time, randomness, or environment reads.
>
> Produce the implementation only. Do not decompose the task into subtasks and do not invoke a separate verifier.

## Worker output

```js
export function adjudicateBatch(checks) {
  if (!Array.isArray(checks)) {
    throw new TypeError('checks must be an array');
  }

  const seenIds = new Set();
  const normalized = [];
  const counts = { total: 0, pass: 0, fail: 0, unresolved: 0 };

  for (const check of checks) {
    const id = typeof check?.id === 'string' ? check.id.trim() : '';
    if (!id) {
      throw new TypeError('check id must be a non-empty string');
    }
    if (seenIds.has(id)) {
      throw new TypeError(`duplicate check id: ${id}`);
    }
    seenIds.add(id);

    if (check.status !== 'PASS' && check.status !== 'FAIL' && check.status !== 'UNRESOLVED') {
      throw new TypeError(`invalid status for ${id}`);
    }

    const required = check.required !== false;
    let status;
    let reason;

    if (check.status === 'PASS') {
      if (typeof check.evidence === 'string' && check.evidence.trim().length > 0) {
        status = 'PASS';
        reason = 'accepted';
      } else {
        status = 'UNRESOLVED';
        reason = 'missing-evidence';
      }
    } else if (check.status === 'FAIL') {
      status = 'FAIL';
      reason = 'failed';
    } else {
      status = 'UNRESOLVED';
      reason = 'unresolved';
    }

    normalized.push({ id, status, required, reason });
    counts.total += 1;
    if (status === 'PASS') counts.pass += 1;
    else if (status === 'FAIL') counts.fail += 1;
    else counts.unresolved += 1;
  }

  const requiredChecks = normalized.filter((check) => check.required);
  let overall = 'UNRESOLVED';

  if (requiredChecks.length > 0) {
    if (requiredChecks.some((check) => check.status === 'FAIL')) {
      overall = 'FAIL';
    } else if (requiredChecks.some((check) => check.status === 'UNRESOLVED')) {
      overall = 'UNRESOLVED';
    } else {
      overall = 'PASS';
    }
  }

  return { overall, counts, checks: normalized };
}
```

Committed worker solution: `solutions/arm-a-flat.mjs`.

## Worker completion claims

The flat worker claims that R1–R12 are implemented and that the module is dependency-free and side-effect-free. These are worker self-reports, not independent verification findings.

## Worker-claimed requirement matrix

| Req | Worker claim | Basis of claim |
| --- | --- | --- |
| R1 | COMPLETE | Array guard throws TypeError. |
| R2 | COMPLETE | id is type-checked, trimmed, and rejected when empty. |
| R3 | COMPLETE | Set tracks trimmed ids case-sensitively. |
| R4 | COMPLETE | Builds new output objects in input iteration order. |
| R5 | COMPLETE | PASS requires non-whitespace string evidence. |
| R6 | COMPLETE | FAIL and UNRESOLVED are preserved with fixed reasons. |
| R7 | COMPLETE | `check.required !== false` resolves optionality. |
| R8 | COMPLETE | Counts increment for every normalized check. |
| R9 | COMPLETE | Overall uses only filtered required checks with FAIL precedence. |
| R10 | COMPLETE | Overall initializes UNRESOLVED when no required checks exist. |
| R11 | COMPLETE | Exact status whitelist enforced. |
| R12 | COMPLETE | Module imports nothing and performs no external operations. |

## Deterministic evidence

A frozen task-specific runner exists at `acceptance/run.mjs`, and repository regression controls are `npm test`, `npm run typecheck`, and `npm run build`.

Execution was **not available from the connected GitHub write/read interface used for this arm**. A local clone attempt was also unavailable because the execution environment could not resolve `github.com`. Therefore the following are deliberately **UNEXECUTED / UNRESOLVED**, not reported as passes:

- frozen task acceptance runner;
- repository test suite;
- repository typecheck;
- repository build.

A branch-only workflow was added to request those checks on branch pushes, but no workflow result was available to this arm at recording time. No green status is inferred from the implementation text.

## Observations

- Hierarchical decomposition: none.
- Independent verifier: none.
- Repair loop: none.
- Worker solution attempts all twelve requirements in one pass.
- Token, model identifier, and exact active execution time were not exposed by the connected tooling and are therefore unavailable.

## Arm A status

**WORKER CLAIM: COMPLETE.**

**EVIDENCE STATUS: UNRESOLVED pending deterministic execution.**

This arm must not be counted as acceptance-passing unless later deterministic evidence actually supports it.
