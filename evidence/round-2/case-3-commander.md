# Round 2 Case 3 — Commander uppercase exponent arguments

## Locked case

- Repository: https://github.com/tj/commander.js
- Public fix PR: https://github.com/tj/commander.js/pull/2544
- Pinned commit: `c3ffcfcdac9237cb446ae0acc5b228380e6ba52a`
- Original: `-1E3` raised `commander.unknownOption`.
- Acceptance hash: `CDEBBA71AF98ADE159088EF2F66BDC9B412D7149C307F09753F37F695843D743`.
- Task hash: `80233C44F7616006D1FC1CCE2CD5C7125D58C4AD91A1BD9D2FD10806C8010B90`.

## Score

| Measure | Baseline | GDN |
|---|---|---|
| Original failure reproduced | Pass | Pass |
| Verified invariant | Pass | Pass |
| Regression/type | 1,356 pass, 5 skip; TSD/TSC pass | Same |
| Scope | `lib/command.js`, 1+/1- | Same |
| Side effects | None found | None found |
| Risk detection | Partial | Strong |
| Comparative result | **Pass/pass tie** | **Pass/pass tie** |

Both arms produced the identical minimal change:

```diff
-if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg)) return false;
+if (!/^-(\d+|\d*\.\d+)([eE][+-]?\d+)?$/.test(arg)) return false;
```

Both locked acceptance and the `NO_COLOR`-cleared full suite passed. The verifier additionally checked 23 valid forms and 17 malformed/option-like forms across required/optional positions, exponent signs, fractional mantissas, `-.5`, zeros, `Infinity`/`NaN`-like strings, and digit flags in program/subcommand hierarchies. All behaved as required. No repair loop was justified.

Blinded review was a tie because patch content was identical. GDN added evidence and elapsed cost without improving the delivered patch.
