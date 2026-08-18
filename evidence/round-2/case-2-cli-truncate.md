# Round 2 Case 2 — cli-truncate marker-width budgeting

## Locked case

- Repository: https://github.com/sindresorhus/cli-truncate
- Public fix PR: https://github.com/sindresorhus/cli-truncate/pull/34
- Pinned commit: `2af3e232c8503d29bd81cb86c6a664721936fa0a`
- Original at 6 columns with marker `...`: `unico...` / `...today`, both width 8.
- Acceptance hash: `F9D35AB03BCBBAF74DA0B1C53A605557E954AB325549474B121EA9DBD8F5BF4B`.
- Task hash: `270BC2F432A887F764F30E24CCEF16F99F899FB20D53AD3454B2AD12D5B54A77`.

## Score

| Measure | Baseline | GDN |
|---|---|---|
| Original failure reproduced | Pass | Pass |
| Locked acceptance | Pass | Pass |
| Source lint / AVA / TSD | Pass / 11 / Pass | Same |
| Full width invariant | **Fail** | **Pass** |
| Scope | Only `index.js`, 2+/2- | Only `index.js`, 12+/2- |
| Side effects | Repair incomplete | None found in scope |
| Risk detection | Absent | Strong |
| Comparative result |  | **GDN win** |

Both initial patches replaced the hard-coded one-column offset with `stringWidth(truncationCharacter)`. The verifier then executed below-marker-width budgets and found 18 failures: for example, marker `...` at two columns returned width 3, and `界界` at three columns returned width 4. The baseline was frozen.

The bounded GDN loop fitted overwide markers with `slice-ansi` before budgeting. Re-verification exercised 54,128 start/end outputs across plain, ANSI, CJK, emoji, nested styles, wide/ANSI input, boundary spaces, and budgets 0–16. Every output stayed within budget; ANSI reset and grapheme integrity probes passed.

Baseline patch:

```diff
-const nearestSpace = getIndexOfNearestSpace(text, length - columns + 1, true);
+const nearestSpace = getIndexOfNearestSpace(text, length - columns + stringWidth(truncationCharacter), true);
@@
-const nearestSpace = getIndexOfNearestSpace(text, columns - 1);
+const nearestSpace = getIndexOfNearestSpace(text, columns - stringWidth(truncationCharacter));
```

GDN adds the same two corrections plus:

```diff
+function fitTruncationCharacter(truncationCharacter, columns, position, preferTruncationOnSpace) {
+  if (!preferTruncationOnSpace || position === 'middle' || stringWidth(truncationCharacter) <= columns) {
+    return truncationCharacter;
+  }
+  return sliceAnsi(truncationCharacter, 0, columns);
+}
@@
+truncationCharacter = fitTruncationCharacter(truncationCharacter, columns, position, preferTruncationOnSpace);
```

Coordinator hidden probe confirmed the distinction. Baseline returned widths 2, 3, and 4 for budgets 1, 2, and 3; GDN returned width-bounded results and exit 0. Both final arms passed the locked commands and scope audit.

Blinded review strongly preferred the GDN patch because the baseline did not handle an overwide marker.
