# Measurement-First Output and User Context

> “Prefer measurement over loaded interpretation.”

> “Facts stay facts. User advantages stay user advantages.”

> “The conclusion may change, but the evidence record does not.”

> “Decision Dome should complement the user’s knowledge, not silently replace it.”

## Measurement-first discipline

`MeasurementStatement` stores a named metric, value, unit, optional range, confidence, timestamp, and source references. Its default `interpretationStatus` is `NONE`: when the number is sufficient, the output reports the number.

Interpretations remain explicit and attributed as `USER_DEFINED`, `SYSTEM_DEFINED_WITH_RULE`, or `SOURCE_DEFINED`. System-defined interpretations require a rule identifier. Loaded terms such as “rare,” “bargain,” “money pit,” “safe,” or “excellent investment” are invalid unless the statement also supplies a definition, uncertainty statement, and domain. The supporting measurement is always rendered first.

This safeguard is structural rather than semantic. It prevents silent labels; it does not create domain-specific definitions or pricing rules.

## User Context and Local Advantage

`UserContextFactor` records a personal skill, access path, cost advantage, network, knowledge, preference, risk tolerance, liquidity requirement, time advantage, owned resource, personal utility, or other relevant constraint. `LocalAdvantage` adds the mechanism by which an advantage may operate.

Every factor preserves:

- Its link to the user’s objective and affected constraint
- `USER_STATED`, `USER_DOCUMENTED`, `VERIFIED_EXTERNAL`, or `INFERRED` origin
- Independent verification status
- Descriptive potential impact
- Any explicitly declared contextual change

User confirmation is not external verification. Externally verified context requires a source reference. Context records never become engine `Evidence` records.

## Base and contextual assessments

`applyUserContext` accepts an already-completed `AnalysisResult`, clones its conclusion, snapshot, and evidence into a base assessment, and applies only explicitly material context factors. It may produce a different practical action, next step, or condition, but it does not mutate the base result or recalculate confidence.

The contextual confidence is copied from the base engine result and carries an explicit warning that user context has not recalibrated it. No magnitude of a local advantage is inferred unless supplied through a separate measurement.

## Presentation and calibration

CONDENSED shows context only when a factor explicitly changes the conclusion, main risk, next action, condition, or practical interpretation. BALANCED shows key measurements, material context, and practical differences. AUDIT preserves raw measurements, all origins and verification statuses, base assessment, contextual assessment, and their differences.

Resolved observations can record whether context improved the decision, proved misleading, was overestimated, or whether measurement-first output avoided interpretive error. These observations are descriptive and do not alter calibration mathematics.
