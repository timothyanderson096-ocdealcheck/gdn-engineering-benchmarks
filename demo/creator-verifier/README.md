# Creator–Verifier evidence demo

This dependency-free local demonstration explains the verification pattern using the real Round 1 query-string case. It is an explanation of published benchmark evidence, not a production product or a claim of universal performance.

The sequence is:

> Proposed repair → direct checks pass → independent verification probes boundaries → evidence reveals a gap → bounded repair → verified outcome

## Run

```sh
npm ci
npm test
npm run dev
```

Open `http://127.0.0.1:4173/`. The server binds only to the local loopback interface.

## What is included

- the actual Round 1 2/3 baseline versus 3/3 GDN scoreboard;
- the four executed raw-encoding boundary counterexamples;
- the frozen baseline versus repaired GDN paths;
- the recorded acceptance and repository commands; and
- an explicit limitation panel.

There are no dependencies, analytics, trackers, credentials, network services, publishing configuration, or external runtime calls.
