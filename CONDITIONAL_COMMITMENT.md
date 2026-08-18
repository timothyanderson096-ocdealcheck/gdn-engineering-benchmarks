# Conditional commitment

> “Do not confuse unresolved uncertainty with unacceptable uncertainty.”

`ACT_WITH_CONDITIONS` is an explicit conclusion, not a certainty claim. It means a named protective mechanism bounds the highest-ranked unresolved risk. Conditions can require inspection, verification, warranty, contingency, approval, or another reversible protection before or during commitment.

The capability is additive. `analyzeWithConditions` runs the existing `analyze` function first and never changes hypothesis weights, evidence scores, confidence, decision thresholds, snapshots, or calibration formulas. It can decorate an existing `ACT`, whose sufficiency has already been established by the engine, or a configured high-confidence `ACQUIRE_INFORMATION` result when the required condition directly contains the information risk. The original uncertainty remains in `majorUncertainty`, confidence is copied unchanged, and the condition is stored on the conditional conclusion.

The default conditional policy is transparent and configurable: minimum confidence `0.90`, with `ACT` and `ACQUIRE_INFORMATION` as eligible base actions. `ACT` retains the engine's own sufficiency decision; the configured minimum is relevant to information-acquisition candidates. No observed confidence—including Case #001's approximately 90.4%—is hard-coded as a threshold.

Use `presentConditionalDecision` to expose structured conditions in CONDENSED and BALANCED views. AUDIT contains the complete conditional conclusion. `serializeConditionalDecisionPresentation` preserves the structured conditions as an additive conclusion field.

Case #001 has a separate versioned condition plan under `real-cases/conditions`. This preserves the historical case and snapshots exactly while allowing calibration reporting to identify candidate conditional-commitment stages without changing calibration mathematics.
