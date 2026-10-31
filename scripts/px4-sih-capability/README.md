# Unchanged PX4 SIH readiness recovery

The first standard hosted run, [41186705281](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/41186705281), passed all 226 native tests, including the 27 previously blocked daemon/POSIX tests, and built full SITL. Its overall capability result remains incomplete: our smoke helper incorrectly required nonempty forwarded client stdout from `mavlink status`. Actual PX4 source uses raw `printf` for that status, and the full instance dump appears in the daemon log. The preserved failed artifact is not relabelled.

This separate job keeps the original five helper files unchanged and reuses their reviewed setup/source functions plus exact dependency constraints. It builds full SITL on unchanged `789389fd46fcfb8473544d2fb3eeabd85893294c`, generates the source-pinned MAVLink decoder and starts the normal disarmed SIH airframe in a new rootfs. It does **not rerun the unchanged native test suite** or apply a candidate patch.

A bounded readiness loop requires real disarmed `vehicle_status`, successful SIH and MAVLink status exits, and two actual CRC-decoded disarmed heartbeats from system/component 1/1 on loopback UDP 14580 → 14540. The launched native PID must own the expected transmitting socket. MAVLink status client stdout is retained even when empty; the actual daemon log retains its raw status output. No status text, socket, native process or packet is mocked.

The native shutdown command and process exit must both succeed. Forced signal cleanup, missing readiness, timeout, source changes or failed checks keep the result incomplete. Raw heartbeat bytes, timestamps, endpoint/source metadata, module attempts, native logs, dependency/source pins and real process exits are retained as ordinary Actions artifacts. The outer watchdog identifies the exact native process group from a PID/start-time journal if cleanup must be forced.

This proves normal SIH startup and loopback readiness only. It does not claim protocol-regression, candidate, board, full-CI, physical flight, human review or upstream acceptance. No PX4 source commit, personal DCO, sign-off or PR is created. Prepared with AI assistance as independent verification evidence.

Timothy Anderson — Spotted Ridge Engineering / OC Labs · GDN (Global Decision Network) · [Engineering evidence](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks).
