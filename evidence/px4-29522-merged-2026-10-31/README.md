# Accepted PX4 contribution: recover parameter and mission transactions

PX4 merged Timothy Anderson's [PR #29522](https://github.com/PX4/PX4-Autopilot/pull/29522) on 31 October 2026 after approval by `julianoes`. The accepted change is [commit 789389fd46fcfb8473544d2fb3eeabd85893294c](https://github.com/PX4/PX4-Autopilot/commit/789389fd46fcfb8473544d2fb3eeabd85893294c).

> “This all looks correct, thanks!” — julianoes, approving review

The contribution adds 18 lines across two MAVLink protocol files. It addresses failed parameter writes that omitted a current-value response, failed uploads that retained active transfer state, and recoverable download requests that ended a transfer prematurely.

| Original report | Resulting behavior |
| --- | --- |
| [#29315](https://github.com/PX4/PX4-Autopilot/issues/29315) | Return the unchanged current value after a rejected write to an existing parameter. |
| [#29285](https://github.com/PX4/PX4-Autopilot/issues/29285) | Release upload state after the applicable error acknowledgement. |
| [#29284](https://github.com/PX4/PX4-Autopilot/issues/29284) | Preserve the expected sequence after recoverable in-range download requests. |
| [#29283](https://github.com/PX4/PX4-Autopilot/issues/29283) | Release an upload after a mission-type mismatch. |

All four original reports were filed by `sisizhao018-alt` and are closed/completed. This is one accepted contribution addressing four reports. The underlying flight-control algorithms were unchanged.

## Verification and acceptance

The submitted source head is `b69e269d2e3eb2c1cc309873e690dbce0ee27bc5`. The maintainer approved it and merged the squash commit into `main` at 08:19:51 UTC on 31 October 2026.

Before submission, the recorded pinned native SITL build and formatting check passed. A separate disarmed native protocol replay recorded 34 passing checks at `c0d2c543080517c5455b790fd42097919b914363` plus the submitted patch. The [original raw test evidence](https://github.com/user-attachments/files/34180516/PX4-protocol-test-evidence.zip) is attached to the PR. That run tested parameter responses, cancellation/replacement of mission contents, and INT/legacy mission download recovery.

At the acceptance capture, the submitted head had 69 successful and 3 skipped CI checks, with 13 successful workflow runs. The merged commit had 81 successful and 12 skipped checks, with 17 successful and 3 skipped workflow runs. No failed or pending check was returned.

The maintainer considered a v1.18 backport unnecessary and requested no further change. The [machine-readable acceptance record](merge-result.json) links the PR, discussions, reviews, source changes and CI records.

## Practical limits

The 34-check replay used the stated pinned source; it was not rerun during acceptance capture. It did not exercise ordinary read-only parameter rejection, foreign-peer guards, congestion, physical hardware or flight. Upstream Codecov reported 0.00% of this diff hit even though its check succeeded; the targeted protocol evidence is the separately recorded replay. The merged source adds no standalone regression-test file.

This case records an accepted open-source software contribution. It does not establish PX4 employment, commercial endorsement, hardware certification or a measured financial value.

Prepared with AI assistance; upstream approval and source credit remain independently inspectable in the linked PR.

Timothy Anderson — Spotted Ridge Engineering / OC Labs · GDN (Global Decision Network) · [Engineering evidence](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks)
