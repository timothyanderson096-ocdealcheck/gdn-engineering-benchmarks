# GDN Engineering A/B Round 2 Case Selection

Selection and reproduction were completed before any benchmark arm was dispatched.

## Case 1 — camelcase numeric identifier boundary

- Repository: https://github.com/sindresorhus/camelcase
- Public fix PR: https://github.com/sindresorhus/camelcase/pull/112
- Pinned faulty commit: `c9fa59df2e32611c5c71d0f219f661fa8e1dfdf8`
- Later known fix (withheld from arms): `e7dccc901ce645138a52dd5945e245773b4684c5`
- Install: `npm install --ignore-scripts --no-package-lock --no-audit --no-fund`
- Reproduction: locked harness observed `b2BRegistrationRequest`, expected `b2bRegistrationRequest`; exit 1.
- Regression: `npm test` passed 7 tests at selection.
- Invariant: identifiers following digits remain correctly cased when followed by a word separator.
- Risks: PascalCase, multiple numeric identifiers, hyphen/underscore ordering, consecutive uppercase options.

## Case 2 — cli-truncate marker-width budget

- Repository: https://github.com/sindresorhus/cli-truncate
- Public fix PR: https://github.com/sindresorhus/cli-truncate/pull/34
- Pinned faulty commit: `2af3e232c8503d29bd81cb86c6a664721936fa0a`
- Later known fix (withheld from arms): `f16fcaba3732c29a13586504535390c9e4d6167b`
- Install: same unlocked npm install command.
- Reproduction: with 6 columns and marker `...`, end produced `unico...` and start produced `...today`, both display width 8; exit 1.
- Regression: source lint, 11 AVA tests, and TSD passed at selection.
- Known host risk: composite `npm test` asks XO's project service to parse declaration files it cannot associate on this Node/Windows host; the locked split commands avoid masking source/type evidence.
- Invariant: word-aware start/end truncation reserves the marker's full display width.
- Risks: ANSI style inheritance, wide markers, small budgets, exact-space boundaries, other positions.

## Case 3 — Commander uppercase exponent argument

- Repository: https://github.com/tj/commander.js
- Public fix PR: https://github.com/tj/commander.js/pull/2544
- Pinned faulty commit: `c3ffcfcdac9237cb446ae0acc5b228380e6ba52a`
- Later known fix (withheld from arms): `a6bcd2ec188dd684c11076ea74747b46eb32f44c`
- Install: `npm ci --ignore-scripts --no-audit --no-fund`.
- Reproduction: parsing `-1E3` as a required argument raised `commander.unknownOption`; exit 1.
- Regression: after temporarily removing inherited `NO_COLOR`, `npm test` passed 1,356 tests, skipped 5, plus TSD and TypeScript compilation.
- Invariant: uppercase and lowercase scientific notation receive equivalent negative-number argument classification; malformed forms remain options.
- Risks: exponent signs, fractional mantissas, digit option flags, malformed numeric-looking flags.

## Exclusions

- `pretty-ms` sub-second colon notation: deterministic, but the pinned repository's old lint stack crashes on Node 25 (`util.isDate` removal), so it failed the clean regression gate.
- Other cli-truncate defect from PR #32: not selected to avoid two scored cases from one repository.
- `json5` bare-hex nontermination and minimatch candidates: excluded because their salient framing overlaps denial-of-service/security concerns, outside scope.
