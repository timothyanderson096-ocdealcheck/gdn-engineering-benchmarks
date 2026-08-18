# GDN engineering verification evidence

GDN is an evidence-driven verification approach for AI-assisted software engineering. It separates creation from independent verification so that a plausible repair is not accepted merely because it looks correct or passes the most obvious checks.

Across two controlled three-case Node.js/TypeScript rounds and one single-case third round, **GDN achieved 6 verified repairs out of 7, compared with 3 out of 7 for a matched single-agent baseline**. The comparison produced three GDN wins, four ties, and zero GDN losses. One tie was a mutual failure: verification correctly withheld acceptance, but the bounded repair loop did not produce a verified result.

The key difference is not “more agents.” It is independent, evidence-driven verification of whether an apparent repair satisfies the relevant boundary conditions. In all three GDN wins, verifier-executed evidence exposed failures after the initial repair and normal checks had appeared to pass.

All seven cases—including ties and the mutual failure—are available here with protocols, pinned commits, frozen task statements, acceptance controls, control hashes, blinded review records, patches, commands, and limitations.

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

## Work with OC Labs / Request a GDN pilot

Potential pilot inputs include a real engineering defect, an AI-generated change that needs independent challenge, or an existing verification workflow that may be accepting false positives.

The publication audit found GitHub Discussions disabled for this repository and found no verified public OC Labs website or profile contact URL. This release therefore does not invent an email address, contact form, or pilot endpoint. A verified public channel should be added before this section is used as an operational request path.

## Accurate public finding

> Across seven controlled Node.js/TypeScript cases, GDN achieved 6 verified repairs compared with 3 for matched single-agent baselines. The result included three GDN wins, four ties, and zero GDN losses. The wins occurred when independent verification exposed failures after the initial repairs and normal checks had appeared to pass.

For Round 3 specifically:

> In this single case, both initial engineers produced the same incorrect abstraction, but independent GDN verification detected it and the permitted bounded repair produced the only acceptance-passing patch.

These findings are scoped to the published seven-case evidence set. The Round 3 result supports a single-case conclusion only.
