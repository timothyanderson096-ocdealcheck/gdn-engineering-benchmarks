# Round 3 evidence — `unjs/ofetch`

Round 3 is a single-case TypeScript generic-propagation benchmark. Its classification is a **GDN win**.

- **Baseline: Loss.** Repository typecheck passed, but frozen acceptance failed with 5 diagnostics.
- **GDN: Win.** Independent verification rejected the initial candidate, and the permitted bounded repair passed the frozen harness and blinded review.
- **Runtime tests:** both arms reached 27/28; the shared failure was caused by an unrelated hard-coded port 3000 versus allocated port 3001.
- **Controls:** frozen controls were rehashed successfully before final classification.

The strongest supported conclusion is limited to this case:

> In this single case, both initial engineers produced the same incorrect abstraction, but independent GDN verification detected it and the permitted bounded repair produced the only acceptance-passing patch.

## Reports

- [Protocol](protocol.md)
- [Selection and blinded decision](selection.md)
- [Final report](final-report.md)

## Audit records

- [Frozen control hashes](audit/control-hashes.md)
- [Blinded review record](audit/blinded-review-record.md)

## Reproducibility controls and selected patch

- [Frozen task statement](acceptance/task-statement.md)
- [Frozen TypeScript acceptance contract](acceptance/type-contract.ts)
- [Frozen acceptance runner](acceptance/run.mjs)
- [Acceptance package manifest](acceptance/package.json) and [lockfile](acceptance/package-lock.json)
- [Verified GDN patch](artifacts/patch-B.diff)

This benchmark supports a single-case conclusion only. It does not establish broad or universal GDN superiority.
