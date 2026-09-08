# GDN engineering verification evidence — OC Labs

Public software verification evidence from **[Spotted Ridge Engineering by OC Labs](https://oc-labs.com.au/)**. Explore the [independent software verification service](https://oc-labs.com.au/software-check/) or inspect the reproducible results and limitations below.

GDN is an evidence-driven verification approach for AI-assisted software engineering. It separates creation from independent verification so that a plausible repair is not accepted merely because it looks correct or passes the most obvious checks.

Across two controlled three-case Node.js/TypeScript rounds and one single-case third round, **GDN achieved 6 verified repairs out of 7, compared with 3 out of 7 for a matched single-agent baseline**. The comparison produced three GDN wins, four ties, and zero GDN losses. One tie was a mutual failure: verification correctly withheld acceptance, but the bounded repair loop did not produce a verified result.

The key difference is not “more agents.” It is independent, evidence-driven verification of whether an apparent repair satisfies the relevant boundary conditions. In all three GDN wins, verifier-executed evidence exposed failures after the initial repair and normal checks had appeared to pass.

All seven cases—including ties and the mutual failure—are available here with protocols, pinned commits, frozen task statements, acceptance controls, control hashes, blinded review records, patches, commands, and limitations.

## Current highlights and ongoing work

### Flagship external reference — Micopay PR #34

A GDN-style verification contribution to [Micopay/micopaybridge PR #34](https://github.com/Micopay/micopaybridge/pull/34) was merged after the maintainer explicitly selected it over a competing implementation on the same issue.

The accepted approach did more than patch the visible mismatch:

- it challenged the lower-risk architectural option instead of assuming the more obvious ownership change was safe;
- it identified that changing schema ownership without also changing startup sequencing could break clean-database startup;
- its parity test exposed a real runtime/migration divergence: `min_rate` was `DECIMAL(5,4)` at runtime versus `DECIMAL(10,6)` in the migration;
- a mutation check restored the old type and confirmed that the targeted parity assertion failed;
- the resulting guard runs offline from source definitions, so future schema drift can fail CI without requiring PostgreSQL.

The maintainer specifically cited the architectural reasoning, the real defect found by the parity test, and the mutation check as reasons this PR was chosen. This is currently the strongest third-party public reference for the verification-first engineering approach.

### Ongoing external verification work

Additional public engineering contributions are being used to test the same workflow across different repositories and problem classes: inspect the requirement, challenge the apparent fix, build an executable assertion, attempt to falsify the repair, and only then classify the result.

Work in progress is **not counted as evidence** in the headline benchmark. Only results that are independently reviewable, merged, or otherwise externally validated will be promoted into the evidence set.

### Internal hardening / dogfooding

The same verification discipline is also being applied internally to OC Labs software: extracting decision logic into directly testable services, adding invariant and boundary tests, enforcing fail-closed validator contracts, removing duplicated or dead code, and keeping unverified changes off production paths.

This internal work is treated as engineering hardening rather than external proof. Its purpose is to make the method stricter on our own software before making broader claims about it elsewhere.

## Results

| Round and case | Single-agent baseline | GDN | Comparative result |
| --- | --- | --- | --- |
| Round 1: query-string encoded separators | Fail | Pass | GDN win |
| Round 1: p-map mapper indices | Pass | Pass | Tie |
| Round 1: validator.js malformed dates | Pass | Pass | Tie |
| Round 2: camelcase numeric boundary | Fail | Fail | Mutual-failure tie |
| Round 2: cli-truncate marker width | Fail | Pass | GDN win |
| Round 2: Commander uppercase exponent | Pass | Pass | Tie |
| Round 3: ofetch generic `create()` propagation | Fail | Pass | GDN win |
| **Combined verified repairs** | **3 / 7** | **6 / 7** | **3 wins, 4 ties, 0 losses** |

“Verified repair” means the arm satisfied the stated invariant, frozen acceptance control, repository regression checks, and scope discipline. A green direct example was insufficient when executed boundary evidence contradicted the requirement.

## Inspect the evidence

- [Round 1 evidence](evidence/round-1/README.md) — GDN 3/3, baseline 2/3.
- [Round 2 evidence](evidence/round-2/README.md) — GDN 2/3, baseline 1/3.
- [Round 3 evidence](evidence/round-3/README.md) — single-case GDN win; GDN 1/1, baseline 0/1.
- [Flagship verified-repair case study](evidence/case-study/verified-repair.md).
- [Reproducibility guide](REPRODUCIBILITY.md).
- [Public-release scope and exclusions](PUBLIC-RELEASE.md).
- [Third-party notices](THIRD-PARTY-NOTICES.md).
- [Local Creator–Verifier evidence demo](demo/creator-verifier/README.md).

The repository also contains the broader deterministic GDN implementation and its existing verification architecture. See [provider and trusted-verifier architecture](PROVIDER_AUTOMATION.md) for that separate implementation surface.

## Run the existing repository checks

```sh
npm ci
npm run check
```

The public baseline registers externally controlled trusted-verifier integration tests as skipped when their separate control pack is unavailable. The three-round evidence release does not reconstruct or replace those controls.

## Run the evidence demo

The Creator–Verifier demo is a dependency-free local explanation of Round 1 Case 1, not a production product:

```sh
cd demo/creator-verifier
npm ci
npm test
npm run dev
```

It contains no analytics, tracking, credentials, external services, or publishing configuration.

## Limitations

- Seven small public utility-library defects are not representative of all software engineering; Round 3 contains only one case.
- All sessions used the same inherited model family; the experiment tests role and session separation, not model-family independence.
- The coordinator prepared controls and made the final evidence classification; there was no external human adjudicator.
- GDN added verification cost in all cases, while only three cases produced a different successful source outcome.
- One Round 2 case remained a failure after the permitted GDN repair loop. Detection did not guarantee repair.
- Exact active-agent time, serving model identifier, reasoning effort, token usage, and credit cost were unavailable.
- This is not production certification, security certification, or proof of universal superiority.

## Work with Spotted Ridge Engineering by OC Labs

Spotted Ridge Engineering is the software verification service from OC Labs, using the GDN verification method. **Bounded software checks start from A$249** for one agreed software claim, behaviour or proposed fix. Scope, price and delivery time are agreed before work begins.

- [Explore software checks and the published offers](https://oc-labs.com.au/software-check/).
- [Read how the GDN method works](https://oc-labs.com.au/gdn/).
- [Enquire by email](mailto:tim@oc-labs.com.au?subject=Software%20verification%20enquiry%20from%20GitHub%20evidence).

When enquiring, include the expected and observed behaviour, the repository or build version, and the decision that needs evidence. Do not post credentials or private customer data in public issues.

These public records document specific engineering work and controlled experiments. Their stated scope and limitations apply; open-source contributions do not imply a customer relationship or endorsement.

## Accurate public finding

> Across seven controlled Node.js/TypeScript cases, GDN achieved 6 verified repairs compared with 3 for matched single-agent baselines. The result included three GDN wins, four ties, and zero GDN losses. The wins occurred when independent verification exposed failures after the initial repairs and normal checks had appeared to pass.

For Round 3 specifically:

> In this single case, both initial engineers produced the same incorrect abstraction, but independent GDN verification detected it and the permitted bounded repair produced the only acceptance-passing patch.

These findings are scoped to the published seven-case evidence set. The Round 3 result supports a single-case conclusion only.
