# Progressive Decision Compression

> Never delete the detail. Only hide it by default.

Progressive Decision Compression is a presentation layer over a completed Decision Dome analysis. It does not score evidence, change thresholds, update hypotheses, rewrite conclusions, or mutate historical snapshots.

Experienced users can focus on the conclusion and next action while full auditability remains one expansion away.

## Modes

- `CONDENSED` returns the conclusion, confidence, main reason, main uncertainty, and next action or reassessment trigger.
- `BALANCED` adds leading evidence, high-value unknowns, and competing-hypothesis summaries.
- `AUDIT` exposes all analysis available in the case: evidence and provenance, sources, hypotheses and weights, wildcard hypotheses, contradictions, hunches, unknowns, predictions, snapshots, histories, outcomes, and lessons.

`AUTO` chooses one of those modes from confidence, stakes, uncertainty, contradictions, and unresolved information value. Every threshold is named and configurable through `PresentationThresholds`; the defaults are policy starting points rather than unquestionable truths.

An explicit `CONDENSED`, `BALANCED`, or `AUDIT` preference always overrides AUTO selection.

## Expansion contract

Every result describes future UI expansion targets:

- Show analysis
- Show evidence
- Show hypotheses
- Show source trail
- Show history
- Show full audit

Compressed results omit detailed fields from the returned view, but the input `DecisionCase` remains unchanged. Calling `buildAuditData` against that same backend record always recovers the complete available audit representation.

Decision Case v0.1 stores the latest conclusion and confidence but does not store earlier conclusion values inside its snapshots. The presentation context therefore accepts optional conclusion and confidence histories, such as those preserved by calibration replay. When they are absent, AUDIT reports that limitation rather than inventing historical values.

Run the example with:

```sh
npx tsx examples/presentation.ts
```
