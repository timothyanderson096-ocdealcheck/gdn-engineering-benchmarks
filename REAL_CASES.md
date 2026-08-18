# Genuine resolved cases

> Calibration is only meaningful if the Dome is judged using information that was actually available at the time.

The real-case layer stores manually authored historical decisions separately from synthetic fixtures. It validates chronology and provenance, then adapts only resolved records into the unchanged calibration replay harness.

## Authoring workflow

1. Copy `real-cases/TEMPLATE.json` to a descriptive filename.
2. Preserve the question, desired result, timeframe, stakes, and hypotheses as they existed at decision time.
3. Identify the primary `caseSource` and every `verificationSource`.
4. Add evidence only to the stage when it first became available.
5. Mark timestamps approximate when exact precision is unavailable.
6. Keep later knowledge in `postOutcomeInformation` or resolution records.
7. Record outcome truth separately from the desired result.
8. Complete provenance and review metadata, then seek independent review where practical.

The `TEMPLATE` record is never loaded into calibration.

## No hindsight contamination

Validation rejects evidence acquired after its stage, stages after resolution, decision evidence originating after resolution, duplicate IDs, and post-outcome fields embedded in replay evidence. Outcome fields and post-outcome information are never passed into the Decision Case during historical replay.

Do not invent time precision. Every historical time uses `{ "value": "...", "approximate": true|false }`. Ordinal placeholder timestamps must be explicitly described as such in provenance notes.

## Sources and provenance

`caseSource` creates the original decision problem. `verificationSources` challenge, confirm, negotiate, or resolve it. Sources preserve identity, type, name, optional reference, access time, domain, provenance, and decision role. No universal trust score is created.

Evidence distinguishes direct observations, primary records, secondary sources, seller claims, user observations, and inference. An observation is never promoted to verified fact.

## Value components

> Do not reduce every advantage to price. Preserve the type of value it creates.

Optional `valueComponents` preserve `FINANCIAL`, `UTILITY`, `RISK_REDUCTION`, `TRANSACTION`, `OPTIONALITY`, and `OTHER` value separately. Each identifies its introduction stage or resolution, source, provenance, and monetary-value status.

`KNOWN` and `ESTIMATED` require an amount and currency. `UNKNOWN` and `NOT_APPLICABLE` preserve qualitative value without inventing a price. Components document calibration context only and never enter engine scoring.

## Outcome truth and unresolved cases

`actualOutcome` remains separate from `desiredResultAchieved`. Unresolved records remain valid but are excluded from metrics. Do not mark examples resolved without a documented real outcome.

## Commands

```sh
npm run calibration:real
npm run calibration:synthetic
```

The datasets are never combined implicitly.
