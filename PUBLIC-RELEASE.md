# Public release scope

## Purpose

This is a controlled technical evidence release for three GDN engineering A/B benchmark rounds and the local Creator–Verifier explanation demo. Rounds 1 and 2 contain three cases each; Round 3 is a single-case benchmark. The release is designed to let engineers inspect what was tested, what passed, what failed, and how classifications were made.

Across the seven published cases, GDN produced 6 verified repairs versus 3 for matched single-agent baselines. Round 3 specifically supports only a single-case finding: independent verification detected a shared incorrect abstraction and the permitted bounded repair produced the only acceptance-passing patch. The release does not establish universal superiority or certify production or security readiness.

## Included

- all three frozen benchmark protocols and selection reports;
- all seven case results and three final reports;
- the flagship verified-repair case study;
- frozen task statements and acceptance scripts;
- SHA-256 control-hash records;
- blinded-review records and the Round 2 timing/usage record;
- the seven final GDN patch artifacts;
- exact upstream URLs, commits, commands, and reproduction guidance;
- the Round 3 required evidence artifacts copied byte-for-byte from the completed benchmark workspace;
- upstream MIT license notices required for the patch context; and
- a dependency-free local Creator–Verifier evidence demo and tests.

## Excluded

- complete third-party source repositories and research clones;
- every `.git` directory or worktree administrative file;
- `node_modules`, dependency caches, npm caches, build output, coverage, temporary workspaces, and generated package-manager state not required for reproduction;
- environment files, credentials, tokens, user data, host configuration, private paths, and internal Codex artifacts;
- the original demo’s bundled hosting/OpenAI scaffold and `.openai/hosting.json`, because they are not needed by the public static demo and introduce local configuration and standalone licensing ambiguity;
- external trusted benchmark controls belonging to the repository’s pre-existing integration-test surface; and
- model usage figures that were not exposed by the product.

## Licensing and ownership

The benchmark narratives, controls, task statements, acceptance scripts, GDN patches, and static demo in this release were authored for this benchmark. Patch context refers to seven public upstream projects, all verified as MIT-licensed. Their notices are preserved under [`evidence/licenses/`](evidence/licenses/) and indexed in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

No complete upstream repository is vendored. Reproduction starts from the named public URL and exact commit, then applies the included patch.

## Privacy and path normalization

Machine-specific absolute paths were replaced with repository-relative public commands. A release audit rejects workstation paths, common credential patterns, environment files, dependency directories, caches, Git metadata below the repository root, and build output inside the intended release set.

## Contact-path audit

Public GitHub metadata reported that Discussions are disabled, the repository homepage is unset, and the account profile has no public website. The README includes the requested pilot section but deliberately provides no invented email, form, or website.

## Claim boundaries

Use:

> Across seven controlled Node.js/TypeScript cases, GDN achieved 6 verified repairs compared with 3 for matched single-agent baselines. The result included three GDN wins, four ties, and zero GDN losses.

For Round 3, use:

> In this single case, both initial engineers produced the same incorrect abstraction, but independent GDN verification detected it and the permitted bounded repair produced the only acceptance-passing patch.

Do not generalize the Round 3 result beyond one case or describe the combined result as universal superiority, production certification, security certification, independent certification, or proof that GDN always outperforms a single agent.
