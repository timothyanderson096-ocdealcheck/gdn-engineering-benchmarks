# Verified Repair: When a Passing AI Patch Was Still Wrong

## Executive summary

AI-generated software repairs can be persuasive before they are dependable. A patch may be small, readable, and fully green against the tests it was given while still violating the requirement at a meaningful boundary. For engineering teams, that is a commercially important failure mode: the output looks complete, review effort appears finished, and latent incorrectness moves downstream.

This case study reports a controlled three-case Node.js benchmark comparing one capable coding agent with a GDN workflow built around independent, evidence-driven verification. Both arms received the same task, pinned source commit, model tier, environment, tools, and time cap. The baseline had one engineering turn. GDN added a separate verifier and permitted a bounded repair loop only when executed counterevidence justified it.

GDN produced **3/3 verified repairs**. The matched single-agent baseline produced **2/3**. Two cases were outcome ties. The difference came from one flagship case in which both engineers initially made the same plausible repair, both passed the frozen acceptance harness and normal repository suite, and only independent boundary probing exposed that the repair was incomplete.

This is evidence of a specific benefit under controlled conditions, not proof that GDN is broadly superior. Its commercial value depends on whether the additional verification cost prevents enough false-positive “successful” repairs to justify that cost.

## Result

| Case | Single-agent baseline | GDN verified | Comparative outcome |
|---|---|---|---|
| Encoded query separators | Failed the full invariant despite green checks | Passed after verifier-driven repair | GDN win |
| Async mapper indices | Passed | Passed with content-identical patch | Tie |
| Malformed date segments | Passed | Passed with content-identical patch | Tie |
| **Verified repairs** | **2/3** | **3/3** | **GDN +1 case** |

All final patches passed their applicable repository test, type, build, and lint commands. The baseline loss was not assigned because of a conventional red test. It was assigned because directly executed counterexamples contradicted the stated invariant.

## The commercial problem

The operational risk in AI-assisted engineering is not limited to obviously broken code. A more difficult class of failure has four attractive properties:

1. the patch is narrow and easy to explain;
2. the supplied reproduction turns green;
3. the normal regression suite passes; and
4. source-level review favors the patch because it appears minimal.

Those signals are useful, but they are not equivalent to verified correctness. When the requirement describes a behavioral class rather than one example, an implementation can satisfy the example and miss the class. If teams treat the green example as completion, they can incur later debugging, support, rollback, and confidence costs precisely because the failure was difficult to distinguish from success at review time.

The commercial question for GDN is therefore concrete: can independent verification find important gaps that an otherwise capable engineer, normal tests, and ordinary patch review miss often enough to justify the extra work?

## Controlled methodology

The benchmark used three public, deterministic, non-security JavaScript defects at exact pre-fix commits. Each case was reproduced locally before acceptance. Task statements and external acceptance harnesses were frozen and SHA-256 hashed before either arm began.

For every case:

- baseline and GDN started from separate worktrees at the same commit;
- both received the same requirement, environment, tools, and maximum working time;
- neither could change tests, fixtures, dependencies, acceptance controls, or audit artifacts to obtain a pass;
- the baseline was a single isolated coding agent and was frozen after its turn;
- the GDN candidate worked independently, after which a separate verifier inspected the implementation and executed its own checks;
- a repair loop was allowed only when the verifier produced executable evidence that contradicted the candidate;
- the coordinator reran final acceptance and repository suites; and
- final patches were reviewed anonymously where practical.

The agents used the same inherited model family and configuration. The experiment tested role and session separation, not model-family independence.

## The differentiating case

The flagship defect concerned query parsing with a configurable array separator. The requirement was behavioral: only a separator literally present in the raw query value should create an array boundary; a percent-encoded separator should remain data.

### 1. Both arms made the same minimal initial repair

The existing parser decoded a value to discover separators. Both engineers independently restricted that decoded-separator behavior to the legacy comma mode. Their initial change was one line, directly addressed the supplied example, and looked appropriately minimal.

### 2. Both passed the locked harness and normal suite

The external acceptance harness passed. The repository's full command also passed: 155 tests, one repository-declared known failure, and only three pre-existing non-fatal lint warnings. A conventional engineering handoff would have had multiple reasons to call the repair successful.

### 3. Independent verification found four raw-encoding counterexamples

The verifier challenged the phrase “literal separator in the raw value,” including valid separator characters that can also occur in encoding syntax or after normalization.

```text
separator % with foo=a%25b  → baseline returned ["a","25b"]
separator 7 with foo=a%37b  → baseline returned ["a%3","b"]
separator 7 with foo=a%7Cb  → baseline returned ["a%","Cb"]
separator space, foo=a+b    → baseline returned ["a","b"]
```

The expected scalar results were `a%b`, `a7b`, `a|b`, and `a b`. In the first three cases, the parser treated characters inside `%HH` triplets as raw separators. In the fourth, `+` was converted to a space before separator detection, creating a boundary that did not exist literally in the input.

These were not speculative review comments. They were deterministic executions that exited non-zero against the initial repair.

### 4. The bounded GDN repair loop addressed the evidence

The verifier's counterexamples justified one repair loop. The candidate separated comma and custom-separator handling, preserved the untouched raw value, scanned for literal boundaries while skipping complete percent triplets, and delayed plus normalization and decoding until after raw segments were identified.

The locked harness and 155-test suite still passed. Re-verification then covered the original examples, all four counterexamples, malformed percent sequences, `decode:false`, null and empty values, literal and encoded plus, non-ASCII separators, and comma compatibility. No further contradiction was found.

### 5. The frozen baseline still failed

The coordinator executed the same boundary probe against both final worktrees:

```text
baseline: {"percent":["a","25b"],"hex":["a%3","b"],"hexEscape":["a%","Cb"],"plusSpace":["a","b"]} — FAIL
GDN:      {"percent":"a%b","hex":"a7b","hexEscape":"a|b","plusSpace":"a b"} — PASS
```

The baseline remained frozen after its permitted turn. The comparison therefore preserves the core distinction: one engineer completed a plausible repair; GDN subjected its plausible repair to independent challenge and changed it only after counterevidence.

## What GDN Actually Added

GDN did not win because several agents voted for the same answer. In fact, the two engineers initially agreed, the acceptance harness agreed, the repository suite agreed, and the blinded patch reviewer preferred the smaller baseline patch.

GDN added a different function: an independent session was responsible for trying to disprove the repair against the requirement. That verifier:

- translated requirement language into boundary classes;
- executed counterexamples outside the happy-path reproduction;
- distinguished green tests from a verified invariant;
- supplied evidence precise enough to justify a bounded source change; and
- reran both standard and adversarial checks after the change.

The additional agent count is incidental. The value-bearing mechanism is independent, evidence-driven verification with authority to contradict a passing candidate.

## Cost and where GDN did not improve the result

GDN was not uniformly more efficient. In the async-index and malformed-date cases, both arms produced content-identical verified patches. The extra verifier work increased evidence and confidence but did not improve the source outcome. Approximate dispatch-to-classification time was higher for GDN in all three cases, and materially higher in the flagship case because verification triggered a repair loop and re-verification.

The product did not expose exact active-agent time, token usage, or credits, so this benchmark does not invent a numeric return-on-investment calculation. The evidence supports a tradeoff, not a free improvement: one prevented false-positive repair and two cases of verification cost without a different patch.

## Limitations

- This was a three-case utility-library benchmark, not a representative sample of all engineering work.
- All sessions used the same inherited model family; the result does not demonstrate model independence.
- The coordinator prepared controls and made the final evidence classification; there was no external human adjudicator.
- The Case 1 frozen harness did not itself cover every valid separator. The decisive evidence came from verifier probes, and the harness was not edited after dispatch.
- Repository dependency versions were resolved without lockfiles using the same command in paired worktrees.
- Wall-clock intervals were approximate, while active time and visible usage data were unavailable.

## Commercial implication

The benchmark supports a narrow, commercially relevant proposition: independent verification can prevent a repair from being declared successful merely because it looks minimal and passes expected checks. Here, that happened once in three cases.

That benefit must be evaluated against the two ties. GDN should not be positioned as “more agents produce better code.” It should be evaluated as a risk-control mechanism: spend additional verification effort where the cost of a false-positive repair, the breadth of the invariant, or the weakness of existing test coverage makes independent challenge valuable.

The defensible conclusion is:

> In one controlled three-case benchmark, independent verification converted one plausible but incomplete repair into a verified repair, producing a 3/3 result versus 2/3 for a matched single-agent baseline. Two cases were outcome ties with additional verification cost. The result justifies further replication and cost measurement; it does not establish broad superiority.
