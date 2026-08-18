# Model Capability Registry

> “The system should learn which model is best for which role, not crown one universal winner.”

The registry is provider-neutral. A `ModelIdentity` may name a generic provider adapter, but routing does not encode commercial model preferences. `EngineeringAgentAdapter` defines the future integration boundary without making live calls.

Each `CapabilityProfile` stores supported roles, context limit, notes, and multiple role/task/domain-specific `RolePerformance` records. These records track:

- Sample size and successful observations
- Reliability and verification pass rate
- Disagreement usefulness
- Repair success rate
- Average latency and cost when observed
- Confidence in the estimate
- Failure modes and last update

There is deliberately no universal model score.

## Deterministic routing

Routing accepts authored constraints covering role, task and domain tags, required context, minimum sample size, and optional latency or cost ceilings. It excludes ineligible profiles, then sorts eligible alternatives by:

1. Role/task-specific reliability
2. Sample size
3. Stable model ID ordering

Every decision preserves all considered alternatives, exclusions, matching tags, supporting observation IDs, rationale, and uncertainty. Low-sample estimates explicitly retain high uncertainty. Raising the minimum sample requirement can exclude an apparently perfect but weakly evidenced candidate.

## Descriptive updates

Capability observations include valid planning, first-pass verification, useful defects, false-positive noise, verifier catches, unsupported-consensus overrides, successful repairs, routing effectiveness, and avoidable rework.

The summary helper uses simple transparent ratios within an exact role/task/domain group. Estimate confidence grows linearly to ten observations and is capped at one. This is an exploratory statistic, not automatic weighting or reinforcement learning, and it never changes Decision Dome scoring.
