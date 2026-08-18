# Range-Card Exploration

> “The user defines the direction, not the tunnel.”

> “Never investigate only the nominated path when a nearby path may satisfy the objective better.”

> “Search for outcome-changing factors outside the user’s initial field of view.”

The military range-card analogy is a disciplined map of a primary field of attention, lateral sectors, and relationships across them. Decision Dome uses the analogy in a domain-neutral way: the Main Arc preserves the nominated path, Left and Right Arcs test adjacent pathways or hidden factors, and Interlocking Arcs show evidence, constraints, or relationships that matter across multiple paths.

## Boundary and purpose

Range-Card Exploration is separate from the decision engine. It does not score hypotheses, change confidence, tune weights, alter decision gates, or write historical snapshots. An arc is an investigation direction—not evidence and not a factual claim.

The two lateral purposes remain explicit:

- `ALTERNATIVE_PATH_EXPLORATION`: another route to the same objective.
- `HIDDEN_FACTOR_EXPLORATION`: an important variable the original framing may have omitted.

Every arc also records whether it was `USER_SUPPLIED` or `SYSTEM_PROPOSED`.

## Outcome-Changing Factor test

Every lateral candidate must answer:

> Could this factor or alternative materially change the probability, value, timing, conditions, or availability of the desired outcome?

Validation requires a positive materiality declaration, at least one affected outcome dimension, a rationale, a traceable objective link, an affected part of the objective, and a descriptive potential impact. Failed candidates are preserved as rejected observations for auditability rather than inserted into the range card.

This is deterministic structural validation, not semantic invention. Whoever proposes an arc must explain the link; the layer does not fabricate one.

## Evidence discipline

Statuses distinguish `PROPOSED`, `INVESTIGATING`, `EVIDENCE_SUPPORTED`, and `DISMISSED`. `EVIDENCE_SUPPORTED` is invalid without an evidence reference. Even then, the arc remains an exploration record referring to evidence; it never silently becomes an engine `Evidence` item.

Relationships support `SUPPORTS`, `CONTRADICTS`, `DEPENDS_ON`, `SHARES_EVIDENCE`, `COMPETES_WITH`, `AMPLIFIES_RISK`, `REDUCES_RISK`, and `OPENS_PATHWAY` across two or more arcs.

## Presentation and calibration

BALANCED exposes Main, Left, Right, interlocking factors, and their relationships. AUDIT exposes the complete result, including rejected candidates. CONDENSED remains empty unless an arc explicitly declares that it materially changes the conclusion, main risk, next action, or condition.

Resolved observations can record important factors surfaced, original-framing misses, useful lateral arcs, irrelevant noise, and whether an alternative path outperformed the main path. These observations are descriptive and do not change existing calibration formulas.

Domain-neutral vehicle and stock examples are available in `src/exploration/examples.ts` and runnable through `examples/range-card.ts`. They describe risks and incentives as possibilities requiring evidence, never as assumed facts or causal conclusions.
