# Frozen task — verification batch adjudicator

Status: FROZEN before any arm output.

Implement a dependency-free ECMAScript module exporting `adjudicateBatch(checks)`.

Each check is `{ id, status, evidence?, required? }`, where status is exactly `PASS`, `FAIL`, or `UNRESOLVED`, and `required` defaults to true.

Return `{ overall, counts, checks }`. `overall` is one of the same three statuses. `counts` contains `total`, `pass`, `fail`, and `unresolved`. Each returned check contains trimmed `id`, normalized `status`, resolved boolean `required`, and reason: `accepted`, `failed`, `unresolved`, or `missing-evidence`.

## Frozen requirements

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

A frozen parameterized acceptance runner will live at `experiments/decomposition-verification-20260823/acceptance/run.mjs`. Repository test/typecheck/build remain regression controls.

Solution paths: Arm A `solutions/arm-a-flat.mjs`; Arm B `solutions/arm-b-depth2.mjs`; Arm C `solutions/arm-c-gdn.mjs` under this experiment directory.
