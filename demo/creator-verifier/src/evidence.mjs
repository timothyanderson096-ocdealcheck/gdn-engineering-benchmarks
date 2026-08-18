export const stages = [
  {
    kicker: "01 / PROPOSED REPAIR",
    title: "Two engineers chose the same one-line change.",
    summary: "Both arms limited decoded-separator detection to legacy comma mode. The change was narrow, readable, and directly addressed the supplied example.",
    status: "shared",
    label: "Same patch",
    output: ["baseline  base.js  +1 −1", "GDN       base.js  +1 −1", "initial source outcome: content-identical"],
  },
  {
    kicker: "02 / DIRECT CHECKS",
    title: "The locked harness and normal suite both passed.",
    summary: "The ordinary completion signals were green in both arms. Nothing in the frozen acceptance example or repository suite distinguished the patches.",
    status: "pass",
    label: "Green",
    command: "node evidence/round-1/cases/1-query-string/acceptance.mjs <worktree>\nnpm test",
    output: ["locked acceptance  PASS", "repository suite   155 passed · 1 known failure", "lint               3 pre-existing warnings"],
  },
  {
    kicker: "03 / INDEPENDENT VERIFICATION",
    title: "The verifier challenged the requirement, not the patch style.",
    summary: "‘Literal separator in the raw value’ implies boundaries around percent triplets and plus normalization. Four deterministic probes exercised those boundaries.",
    status: "gap",
    label: "4 contradictions",
    command: "node --input-type=module -e \"...percent/hex/space boundary assertions...\"",
    output: ["% in a%25b   → split inside %25", "7 in a%37b   → split inside %37", "7 in a%7Cb   → split inside %7C", "space in a+b → split after + normalization"],
  },
  {
    kicker: "04 / EVIDENCE DECISION",
    title: "Green checks were reclassified as an incomplete repair.",
    summary: "Executed outputs contradicted the full invariant. The baseline was frozen; GDN opened one repair loop because the evidence met the protocol gate.",
    status: "gap",
    label: "Baseline frozen",
    output: ["baseline  locked checks: PASS · full invariant: FAIL", "GDN       locked checks: PASS · repair loop: JUSTIFIED", "control files remained unchanged"],
  },
  {
    kicker: "05 / BOUNDED REPAIR",
    title: "Raw boundaries were preserved before decoding.",
    summary: "The GDN patch scanned the untouched raw value, skipped complete %HH triplets, recorded only literal separators, and decoded each resulting segment afterward.",
    status: "repair",
    label: "One loop",
    output: ["comma compatibility kept on the legacy path", "custom separators scanned against rawValue", "final scope: base.js · +33 −4"],
  },
  {
    kicker: "06 / VERIFIED OUTCOME",
    title: "The same four probes now separated the two paths.",
    summary: "Re-verification found no further contradiction across the original checks and expanded boundary matrix. The frozen baseline continued to fail all four decisive probes.",
    status: "verified",
    label: "GDN verified",
    output: ["baseline  0/4 boundary probes · FAIL", "GDN       4/4 boundary probes · PASS", "Round 1   baseline 2/3 · GDN 3/3"],
  },
];

export const probes = [
  { separator: "%", raw: "foo=a%25b", expected: '"a%b"', baseline: '["a","25b"]', gdn: '"a%b"' },
  { separator: "7", raw: "foo=a%37b", expected: '"a7b"', baseline: '["a%3","b"]', gdn: '"a7b"' },
  { separator: "7", raw: "foo=a%7Cb", expected: '"a|b"', baseline: '["a%","Cb"]', gdn: '"a|b"' },
  { separator: "space", raw: "foo=a+b", expected: '"a b"', baseline: '["a","b"]', gdn: '"a b"' },
];

export function stageAt(index) {
  if (!Number.isInteger(index) || index < 0 || index >= stages.length) {
    throw new RangeError("stage index is outside the published evidence sequence");
  }
  return stages[index];
}
