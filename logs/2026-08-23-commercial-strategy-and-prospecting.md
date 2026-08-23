# GDN Commercial Strategy & Prospecting Log — 2026-08-23

## Session purpose
Capture the commercial direction developed today so the next outreach cycle starts from the refined position rather than re-deriving it.

## Core commercial line

**Generate less. Remove more. Verify everything.**

Supporting executive line:

**Less code. Less complexity. Verified behaviour.**

Technical framing:

**Reduce the codebase without reducing the guarantee.**

## Product wedge: Verified Simplification

GDN is not positioned as another code-generation or generic refactoring tool. The commercial wedge is **verified simplification**:

1. Establish the required behaviours and/or external rules the software must satisfy.
2. Baseline the current subsystem: complexity, dependencies, build/deploy burden, defect burden and maintenance effort.
3. Identify code, dependencies, services or abstractions that may no longer need to exist.
4. Simplify within bounded scope.
5. Independently verify that required behaviour is preserved.
6. Produce a before/after evidence report.

The valuable product is not deletion itself. It is **the confidence to safely remove complexity that teams are currently afraid to remove**.

## Best target pattern

Do not hunt only by industry. Hunt for companies publicly signalling software pain:

- technical debt
- legacy code
- monolith/platform consolidation
- dependency reduction
- migration or rewrite work
- engineering productivity problems
- slow builds/deploys
- cloud-cost optimisation
- post-acquisition integration
- regulatory change burden
- long-lived compatibility layers

Highest-value targets are organisations **paying a recurring maintenance tax because nobody is confident enough to delete old software**.

## External-truth-source industries

A particularly strong fit is software where an external rulebook sits above the implementation, because GDN can verify against something more objective than the existing code/tests.

Examples:

- Tax: legislation → ATO requirements/specifications → required software behaviour → implementation
- Payroll: awards/tax/super rules → required behaviour → implementation
- Insurance: policy/regulatory rules → required behaviour → implementation
- Banking/compliance: regulatory and transaction rules → implementation
- Aviation/medical/industrial systems: certification/safety requirements → implementation

Tax software was selected as an immediate hunting ground because years of regulatory logic can make simplification risky while providing an external source of truth for verification.

## Commercial pilot structure

### Small / startup — Verification Scout
Indicative scope: roughly AUD 1k–3k.

- one bounded component
- complexity and dependency analysis
- simplification candidates
- verification requirements
- evidence report

### Mid-size — Verified Simplification Pilot
Indicative scope: roughly AUD 5k–15k.

- one real maintenance-heavy subsystem
- baseline → simplify → verify → before/after report

### High Assurance
Indicative scope: AUD 25k+ depending on value and risk.

- multiple components / deeper requirement mapping
- stronger independent verification
- regression evidence
- broader assurance and management-level savings analysis

**Pricing rule:** do not discount the same offer. Lower price means reduced scope/assurance depth. If improved tooling reduces delivery effort after a quote, that productivity gain becomes margin rather than an automatic price reduction.

## Measurement model

Before/after measurements should include where relevant:

- lines/components removed
- dependencies removed
- services eliminated
- build/deploy time
- infrastructure burden
- engineer-hours spent maintaining the subsystem
- defect burden
- required behaviours
- regulatory requirements
- verified behaviour preservation

Case-study style outcome target:

> 28% less implementation complexity.  
> Fewer dependencies and maintenance hours.  
> 100% of identified required behaviours preserved under verification.

## Capability strategy

AI capability is moving too quickly to price or architect GDN around a static implementation method.

Operating rule:

**Sell today's guaranteed floor. Architect for the capability expected within the next 30–90 days. Re-evaluate at execution.**

Commit to outcomes, not the exact model/agent/tooling used to achieve them.

### Walking principle

**One foot verified. One foot exploring.**

Do not have both the technology and the promised outcome unproven at the same time. One foot stays planted in a capability already demonstrated; the other moves forward into emerging methods. Once the new capability is verified, it becomes the planted foot.

Use a rolling 90-day capability horizon rather than long static technology roadmaps.

## Operator conditioning principle

The goal is not occasional unsustainable bursts of extraordinary output. The goal is to **raise the sustainable operating floor** through better systems, faster thinking, clearer objectives and increasingly efficient use of AI tooling.

Capture useful thinking immediately, convert it into a principle/experiment/proposal, test it, and discard what does not survive evidence.

## Current outreach direction

Recent probes now include robotics and Australian tax/payroll/accounting software companies. TaxLodgic / Daniel Maggacis was identified as a high-priority direct prospect because the company is actively developing tax-compliance workflows and efficiency features.

Other tax/payroll/accounting prospects approached during this phase include LodgeiT, TaxTank, BGL Corporate Solutions, Lightning Payroll and Paysense.

## Immediate next action

Find **10 very small companies founded within roughly the last year** and assess them as low-friction pilot prospects.

Selection preference:

1. Founded since approximately August 2025.
2. Small enough that a founder/CTO is directly reachable.
3. Software-heavy or operationally dependent on software.
4. A bounded verification/simplification pilot would be useful now, even if the company is not yet suffering enterprise-scale legacy debt.
5. Prioritise companies where GDN can produce a measurable result quickly and earn the first external case study.

## Commercial objective

The immediate objective is not to perfect GDN in private. It is to find **one external company willing to say: "Okay. Prove it."**

Then:

**Probe → controlled pilot → measured result → verified case study → next customer.**
