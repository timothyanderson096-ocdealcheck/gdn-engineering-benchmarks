# GDN Engineering A/B Case Selection

Selection was completed before arm dispatch. All accepted failures were executed locally at the exact pinned commit, and each repository's existing regression suite passed without the new invariant.

## Accepted case 1 — query-string encoded separator

- Repository: https://github.com/sindresorhus/query-string
- Public issue: https://github.com/sindresorhus/query-string/issues/336
- Pinned faulty commit: `2e1f45aafb71ef247572b10d9d37dce67cd825ac`
- Known later fix commit (withheld from arms): `ec67feafcef38759e5ec76f7bc69aa835bc05b9c`
- Setup: `npm install --ignore-scripts --no-package-lock --no-audit --no-fund --legacy-peer-deps`
- Reproduction: `node evaluation/acceptance.mjs <pinned-worktree>`; observed `{"foo":["a","b"]}` and exit 1 instead of scalar `"a|b"`.
- Regression/type command: `npm test` (155 passing, one repository-declared expected failure at selection time).
- Invariant: only literal raw separators create elements; encoded separators remain element data.
- Risks: decoded/literal separator combinations, other array formats, double decoding.

## Accepted case 2 — p-map async input index

- Repository: https://github.com/sindresorhus/p-map
- Public fix PR: https://github.com/sindresorhus/p-map/pull/88
- Pinned faulty commit: `65aaa8f4d7e757a5254a146c4c39403efa9e2139`
- Known later fix commit (withheld from arms): `1af51b57534b284ead73cca65f26b56bb9390768`
- Setup: same npm install command above.
- Reproduction: locked acceptance harness resolves promised inputs in order 1, 2, 0; observed mapper pairs `[["a",2],["b",0],["c",1]]`, exit 1.
- Regression/type command: `npm test` (50 passing at selection time).
- Invariant: mapper indices correspond to input iteration order, independent of value settlement order.
- Risks: concurrency/backpressure, iterator ordering, rejected promised inputs, synchronous values.

## Accepted case 3 — validator.js malformed date shape

- Repository: https://github.com/validatorjs/validator.js
- Public fix PR: https://github.com/validatorjs/validator.js/pull/2443
- Pinned faulty commit: `96ff3b299084b05d52895688f0f7c98c9232047a`
- Known later fix commit (withheld from arms): `ff56dcf5ad16abc4127528eafae559ac716863fb`
- Setup: same npm install command above.
- Reproduction: locked harness observed `2024-05` throwing `TypeError` and `2024-05-01-abc` returning true; exit 1.
- Regression/build/lint command: set `SPAWN_WRAP_SHIM_ROOT` to a case-local directory, then `npm test` (263 passing, 100% statement coverage at selection time).
- Invariant: malformed segment counts return false without throwing; valid complete dates remain accepted.
- Risks: configured formats/delimiters, empty segments, strict-mode behavior, valid dates.

## Rejected candidates

- `normalize-url` localhost explicit-port bug: deterministic invariant failure, but the pinned repository's current dependency resolution caused an unrelated ESLint project-service failure under this host, weakening clean regression comparability.
- Additional `validator.js` isFloat/isPort/isRgbColor defects: reproducible, but rejected to avoid multiple scored cases from one repository and to improve behavioral diversity.
- Discovery sessions initially blocked twice by an automated safety classifier despite ordinary non-security wording. One narrower discovery session later completed. This affected search efficiency, not arm access or scoring.
