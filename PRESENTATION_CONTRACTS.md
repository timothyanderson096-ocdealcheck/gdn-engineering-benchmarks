# Presentation JSON contracts

> Never delete the detail. Only hide it by default.

The presentation contract is a stable boundary between Decision Dome and future user interfaces. A UI consumes versioned plain JSON rather than importing decision-engine types, mutable state, scoring helpers, or implementation details.

The boundary only serializes completed presentation models. It cannot influence scoring, hypotheses, confidence, conclusions, calibration, or snapshot history.

## Schema version

All three modes use:

```json
"schemaVersion": "decision-dome.presentation.v1"
```

For v1:

- Additive optional fields may remain backward compatible. Consumers should ignore fields they do not understand.
- Removing or renaming a field requires a new schema version.
- Changing the meaning of a field requires a new schema version.
- Internal engine refactors do not require a contract change unless the external JSON meaning or structure changes.

## Mode contracts

`CONDENSED` contains only the decision-facing summary: conclusion, confidence, main reason, main risk, next action, and available expansions. Runtime validation rejects audit-only fields in this payload.

`BALANCED` adds traceable evidence drivers, ranked unknowns, hypothesis summaries, contradictions, and reassessment information. Evidence and hypothesis IDs allow a UI to request the corresponding audit record.

`AUDIT` preserves the complete available Progressive Decision Compression audit representation, including evidence provenance, sources, hypothesis weights, wildcard hypotheses, contradictions, hunches, unknowns, predictions, snapshots, histories, outcomes, and learning notes.

## UI consumption

1. Check `schemaVersion` before interpreting the payload.
2. Discriminate on `mode`.
3. Render only fields belonging to that mode.
4. Use `availableExpansions` to offer deeper views.
5. Retain evidence and hypothesis IDs when linking from BALANCED to AUDIT.
6. Ignore unknown optional v1 fields for forward compatibility.

Compressed contracts hide detail from the current response; they do not delete detail from the underlying Decision Case. The same backend record can always be serialized as AUDIT.

## Validation and fixtures

The dependency-free validator checks the schema version, mode structure, JSON safety, confidence ranges, expansion records, and traceability fields. Serializers reject functions, classes, Maps, Sets, non-finite numbers, and other non-JSON values.

Verify deterministic fixtures without changing them:

```sh
npm run contracts
```

Regenerate fixtures explicitly:

```sh
npm run contracts:generate
```

Generation is never performed by the normal test command.
