# Arm B — Depth-2 decomposition

Status: WORKER OUTPUT FROZEN. No independent verification authority was used during generation. No repair was made after deterministic execution.

## Exact worker prompt

```text
Implement the frozen verification-batch adjudicator for Arm B.

Before writing code, decompose the task to depth 2: first into major tasks, then into atomic subtasks. Every atomic subtask must explicitly map to one or more frozen requirements R1-R12. After the decomposition is written, implement the solution in one pass. Do not use an independent verifier, do not inspect any other experiment arm, do not weaken the requirements, and do not repair the implementation after seeing acceptance results.

Implement a dependency-free ECMAScript module exporting `adjudicateBatch(checks)`.

Each check is `{ id, status, evidence?, required? }`, where status is exactly `PASS`, `FAIL`, or `UNRESOLVED`, and `required` defaults to true.

Return `{ overall, counts, checks }`. `overall` is one of the same three statuses. `counts` contains `total`, `pass`, `fail`, and `unresolved`. Each returned check contains trimmed `id`, normalized `status`, resolved boolean `required`, and reason: `accepted`, `failed`, `unresolved`, or `missing-evidence`.

Frozen requirements:
R1. `checks` must be an array; otherwise throw TypeError.
R2. Every id must be a non-empty string after trimming; output the trimmed id.
R3. Duplicate ids after trimming are forbidden, compared case-sensitively; throw TypeError.
R4. Preserve input order and do not mutate the input array or its objects.
R5. PASS requires evidence containing at least one non-whitespace character; otherwise normalize to UNRESOLVED with `missing-evidence`.
R6. FAIL stays FAIL with `failed`; UNRESOLVED stays UNRESOLVED with `unresolved`. Evidence cannot upgrade them.
R7. Only literal `required: false` is optional. Omitted or any other value resolves to true.
R8. Counts cover all normalized checks, including optional checks.
R9. Overall uses required checks only: any FAIL => FAIL; else any UNRESOLVED => UNRESOLVED; else all required PASS => PASS.
R10. Zero required checks, including empty or all-optional input, => overall UNRESOLVED.
R11. Any status other than exactly PASS, FAIL, or UNRESOLVED throws TypeError.
R12. No runtime dependencies or I/O, network, logging, time, randomness, or environment reads.

The frozen acceptance runner is `experiments/decomposition-verification-20260823/acceptance/run.mjs`. Repository test/typecheck/build are regression controls. Write the solution for `experiments/decomposition-verification-20260823/solutions/arm-b-depth2.mjs`.
```

## Depth-2 decomposition produced before implementation

### Task 1 — Validate and normalize each input check
- **1.1 Validate batch container** — reject non-arrays with `TypeError`. **Maps: R1.**
- **1.2 Normalize and validate identifiers** — require string ids, trim them, reject empty trimmed ids, preserve case. **Maps: R2.**
- **1.3 Enforce unique normalized ids** — track trimmed ids in a case-sensitive set and reject duplicates. **Maps: R3.**
- **1.4 Validate status vocabulary** — accept only exact `PASS`, `FAIL`, `UNRESOLVED`. **Maps: R11.**
- **1.5 Resolve optionality** — only literal `required: false` becomes optional; all other values become required. **Maps: R7.**
- **1.6 Normalize PASS evidence** — require a string with at least one non-whitespace character; otherwise convert PASS to `UNRESOLVED` / `missing-evidence`. **Maps: R5.**
- **1.7 Preserve terminal negative/unknown states** — FAIL remains FAIL / `failed`; UNRESOLVED remains UNRESOLVED / `unresolved`, regardless of evidence. **Maps: R6.**
- **1.8 Return new normalized objects in input order** — map without assigning into caller-owned inputs. **Maps: R4.**

### Task 2 — Aggregate normalized results
- **2.1 Count every normalized check** — populate total/pass/fail/unresolved across required and optional checks. **Maps: R8.**
- **2.2 Isolate required checks for overall adjudication** — optional checks must not influence overall. **Maps: R9.**
- **2.3 Apply overall precedence** — required FAIL first, then required UNRESOLVED, otherwise PASS. **Maps: R9.**
- **2.4 Handle no-required-check boundary** — empty input or all-optional input yields overall UNRESOLVED. **Maps: R10.**

### Task 3 — Keep execution deterministic and self-contained
- **3.1 Use only language/runtime primitives** — no imports, dependencies, I/O, network, logging, clock, randomness, or environment access. **Maps: R12.**
- **3.2 Return exact top-level shape** — `{ overall, counts, checks }`, with normalized check fields only. **Maps: task contract; supports R2, R5-R10.**

## Frozen worker output

Path: `experiments/decomposition-verification-20260823/solutions/arm-b-depth2.mjs`

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
      throw new TypeError('check id must not be empty');
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
        typeof check.evidence === 'string' && check.evidence.trim().length > 0;
      if (!hasEvidence) {
        status = 'UNRESOLVED';
        reason = 'missing-evidence';
      } else {
        reason = 'accepted';
      }
    } else if (status === 'FAIL') {
      reason = 'failed';
    } else {
      reason = 'unresolved';
    }

    return { id, status, required, reason };
  });

  const counts = { total: normalizedChecks.length, pass: 0, fail: 0, unresolved: 0 };
  for (const check of normalizedChecks) {
    if (check.status === 'PASS') counts.pass += 1;
    else if (check.status === 'FAIL') counts.fail += 1;
    else counts.unresolved += 1;
  }

  const requiredChecks = normalizedChecks.filter((check) => check.required);
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

  return { overall, counts, checks: normalizedChecks };
}
```

## Worker completion claims — frozen before comparison with Arm A

The worker claims **R1-R12 complete** and claims the required output shape is implemented. These are worker claims, not independent verification evidence.

| Requirement | Worker claim | Decomposition node |
|---|---|---|
| R1 | COMPLETE | 1.1 |
| R2 | COMPLETE | 1.2 |
| R3 | COMPLETE | 1.3 |
| R4 | COMPLETE | 1.8 |
| R5 | COMPLETE | 1.6 |
| R6 | COMPLETE | 1.7 |
| R7 | COMPLETE | 1.5 |
| R8 | COMPLETE | 2.1 |
| R9 | COMPLETE | 2.2, 2.3 |
| R10 | COMPLETE | 2.4 |
| R11 | COMPLETE | 1.4 |
| R12 | COMPLETE | 3.1 |

## Deterministic evidence actually executed

After the worker output and claims were fixed, the exact frozen acceptance runner content from `acceptance/run.mjs` was executed locally against the exact Arm B solution with Node.js v22.16.0.

Command equivalent:

```text
node acceptance/run.mjs solutions/arm-b-depth2.mjs
```

Raw result:

```text
ACCEPTANCE_PASS
```

No repair or code change was made after this result.

A direct Git clone of the experiment branch was also attempted to run repository-wide regression controls, but the execution environment could not resolve `github.com`:

```text
fatal: unable to access 'https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks.git/': Could not resolve host: github.com
```

Therefore repository-wide `npm test`, `npm run typecheck`, and `npm run build` are **UNEXECUTED in Arm B**, not claimed as passes. The frozen experiment acceptance runner is the only executed deterministic acceptance evidence recorded here.

## Requirement-by-requirement evidence status

This is an Arm B record, not GDN independent adjudication. `ACCEPTANCE_PASS` is deterministic evidence for the cases encoded by the frozen runner; worker self-report remains separate.

| Requirement | Worker claim | Deterministic evidence available in this arm |
|---|---|---|
| R1 | COMPLETE | Frozen runner rejects null/object batch; acceptance passed. |
| R2 | COMPLETE | Frozen runner checks trim, blank id, non-string id; acceptance passed. |
| R3 | COMPLETE | Frozen runner checks duplicate trimmed id and case-sensitive distinct ids; acceptance passed. |
| R4 | COMPLETE | Frozen runner deep-compares input before/after and checks order; acceptance passed. |
| R5 | COMPLETE | Frozen runner checks whitespace and non-string evidence downgrade; acceptance passed. |
| R6 | COMPLETE | Frozen runner checks FAIL/UNRESOLVED remain unchanged despite evidence; acceptance passed. |
| R7 | COMPLETE | Frozen runner checks false optionality and non-false value (`0`) resolving required; acceptance passed. |
| R8 | COMPLETE | Frozen runner checks counts including optional FAIL/UNRESOLVED; acceptance passed. |
| R9 | COMPLETE | Frozen runner checks optional failures do not drive overall and required precedence cases; acceptance passed. |
| R10 | COMPLETE | Frozen runner checks empty and all-optional batches => UNRESOLVED; acceptance passed. |
| R11 | COMPLETE | Frozen runner rejects lower-case `pass` and `SKIP`; acceptance passed. |
| R12 | COMPLETE | The frozen runner does not directly probe every prohibited side effect. The frozen source contains no imports, I/O, network, logging, time, randomness, or environment reads, but no independent verifier is used in Arm B. |

## Execution observations

- Decomposition depth: 2.
- Atomic subtasks: 14.
- Frozen requirement mappings: every R1-R12 mapped before coding.
- Worker implementation attempts: 1.
- Post-acceptance repair attempts: 0.
- Acceptance execution: PASS.
- Repository regression execution: unavailable because the local runtime could not resolve GitHub for cloning.
- Independent verification authority: none by design.
- Other-arm inspection before freeze: none.

## Arm B result boundary

Arm B produced an acceptance-passing implementation under the frozen runner using explicit depth-2 decomposition. This does **not** establish that decomposition caused the pass, does not establish broad superiority over a flat prompt, and does not substitute for Arm C's independent claim-to-evidence adjudication.
