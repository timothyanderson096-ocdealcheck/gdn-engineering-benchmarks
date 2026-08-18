# Evidence Expansion

> “The input is the starting evidence field, not the final knowledge state.”

> “Good input improves the starting position; the Dome earns its value by expanding beyond what the user already knows.”

> “A question is not evidence.”

> “Range Card defines where else to look. Evidence Expansion defines what to seek there.”

## Starting evidence

`StartingEvidenceField` preserves supplied material exactly as a starting point. Origins include user input, app output, documents, listings, screenshots, market data, contracts, filings, sensors, APIs, and manual observations. Each item separately records whether it is measured, claimed, observed, inferred, or externally verified.

An app displaying “20-day momentum +22%” contributes a measured app output. It does not verify the company’s fundamentals or make the app authoritative. A listing saying “drives perfectly” remains a seller claim. Publication and repetition do not upgrade either item into verified fact.

Specialist apps can therefore serve as useful probes into one part of a decision without becoming the complete decision system.

## Probes and gaps

`ExpansionProbe` records a question, purpose, objective link, triggering evidence and unknowns, target gaps, Range Card links, expected impact, authored information value, outcome dimensions, scope, status, and eventual result-evidence IDs.

`EvidenceGap` records what is missing, why it matters, affected conclusions or hypotheses, resolving evidence, materiality status, and Range Card links.

Planning does not invent a new score. It sorts authored probe information values and the authored values of linked gaps. Up to four probes are selected as highest-value, next useful, lateral, and optional. Non-outcome-changing probes are rejected. Low-value probes linked only to optional gaps can be deferred using an explicit configurable planning threshold. Remaining probes are deferred, and the plan carries a stopping rule to prevent endless investigation.

## Evidence discipline and chronology

Probes, questions, hypotheses, and search directions are never engine evidence. Only actual `Evidence` wrapped as `AcquiredEvidence` can enter reassessment. Each acquired item retains its producing probe and acquisition time.

The expanded field preserves starting evidence, acquired evidence, gaps, rejected evidence, contradictions, probe provenance, chronology, and reassessment history.

## Range Card and context boundaries

Range Card arc IDs are validated when a plan is built. An arc says where else to inspect; linked probes state what information to seek there. User Context remains a separate personal layer and is never inserted into externally sourced evidence.

## Reassessment

`reassessAfterExpansion` clones the prior analysis, appends only actual acquired evidence, and calls the unchanged engine. The resulting record contains previous and new conclusions and confidence, introduced evidence, changes, invariants, remaining material gaps, and distinct previous/new snapshot IDs. Previous evidence, conclusions, and snapshots are never overwritten.

## Presentation and calibration

CONDENSED shows the current conclusion and confidence, a material new finding when one changed the assessment, the main remaining gap, and the next probe. BALANCED adds starting evidence, acquired evidence, gaps, prioritized probes, and changes. AUDIT preserves the full plan, provenance, contradictions, chronology, rejected/deferred probes, and reassessment history.

Resolved observations describe decisive, useful, noisy, duplicate, or missed probes; stopping quality; misleading starting evidence; and whether expansion overturned or strengthened the initial view. Existing calibration mathematics remain unchanged.
