# Round 2 session timing and usage

Timestamps are coordinator wall-clock checkpoints in Australia/Sydney. A paired engineering end is the first checkpoint after both baseline and candidate completion notifications. GDN classification checkpoints are the first captured checkpoint after final verifier disposition; they are conservative notification intervals, not active-compute measurements.

| Case | Pair dispatch | Both engineers notified | Pair interval | Final GDN classification checkpoint | GDN dispatch-to-classification |
|---|---|---|---:|---|---:|
| 1 | `2026-08-18T15:41:26.9349086+10:00` | `2026-08-18T15:45:14.1823923+10:00` | 227.25 s | `2026-08-18T15:55:12.9385310+10:00` | 826.00 s |
| 2 | `2026-08-18T15:45:27.2036755+10:00` | `2026-08-18T15:48:11.1533966+10:00` | 163.95 s | `2026-08-18T15:55:18.7552309+10:00` | 591.55 s |
| 3 | `2026-08-18T15:55:18.7552309+10:00` | `2026-08-18T15:58:50.7281398+10:00` | 211.97 s | `2026-08-18T16:02:46.2277554+10:00` | 447.47 s |

The product did not expose per-agent active time, exact serving model identifier, reasoning-effort setting, token usage, or credits. Those values are unavailable; no estimates are substituted.
