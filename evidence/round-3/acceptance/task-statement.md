# Engineering task (frozen)

Pinned commit: `3617666273f439e1de2d2d1599c28fe86e075dbc`

Required invariant:

> A generic response type supplied through `$Fetch.create()` must propagate to the returned `$Fetch` callable and its relevant methods without degrading to an incorrect or overly broad type.

Implement the smallest sound source change that satisfies this invariant. Preserve explicit per-call response-type overrides and the complete `$Fetch` surface (`raw`, `native`, and `create`). Add or adjust source-owned repository tests only if genuinely useful, but do not alter existing tests, fixtures, external acceptance controls, control hashes, or benchmark artifacts to manufacture a pass.

Validate the relevant TypeScript contract and repository tests. Report exact commands, changed source scope, limitations, and unresolved risks.

Constraints: work only in the assigned worktree; do not browse or inspect the source issue, upstream fixes, pull requests, commits after the pin, acceptance controls, audit files, other arms, or benchmark reports; do not commit, push, publish, open issues or PRs, contact maintainers, use credentials, or use provider APIs.

Matched resources: GPT-5.6 Codex Sol tier, high reasoning, local shell and repository tools, 15-minute active-time cap.