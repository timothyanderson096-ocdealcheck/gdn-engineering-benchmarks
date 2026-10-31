# DR11 native wire compatibility replay

Prepared privately for PX4 base `789389fd46fcfb8473544d2fb3eeabd85893294c`. This fixture has not been run against local PX4 or IPC. The caller builds and runs it on an authorized native runner for both the baseline and the reviewed corrected candidate. No old candidate hash is embedded: the caller must supply the reviewed mission-source SHA256 separately for each variant.

The claim is native SIH/MAVLink compatibility, telemetry status observations and mission integrity. `MISSION_CURRENT` has neither a request ID nor a path marker. Periodic and `mission_result` emissions can produce the same packet, so packet timing or counts here do not prove a handler-caused reply, one reply per request, or a latency guarantee. The separate actual-method C++ diagnostic establishes the causal control-flow behavior. This replay also does not force the pending-status-cache corner case or prove an atomic uORB snapshot.

The fixture uses the reviewed raw collector and dialect loader from `px4-event-range/wire_probe.py`, imported only after checking SHA256 `adf02b72bcab6846dc7f459997efadb6b2d3d9e8090d3aeb5154a850739dbe36`. Its DR07 startup, prearm commands and event assertions are not called. The only transmitted message methods allowed by this replay are heartbeat, mission upload/download/acknowledgement, `MISSION_SET_CURRENT`, and read-only parameter reads. It never sends arming, mode, actuator or `COMMAND_LONG` messages.

The runner uses Python 3.12.14 and the normal upstream native setup (`ubuntu.sh --no-nuttx --no-sim-tools`; empy 3.3.4, kconfiglib 14.1.0 and pyros-genmsg 0.5.8; remaining resolved requirements retained in its package manifest). The decoder is `development.py` generated from the recursively pinned source with explicit source `PYTHONPATH`, not an attributed registry pymavlink dialect:

- MAVLink `2e2b6af99084e4fde9bb304c84bb9253a1a98b6f`.
- pymavlink generator `19880422d451de4daba3fd96781076afb1cb889c`.

The caller retains the generator command/provenance and passes its expected generated-file SHA256. This fixture verifies the source/submodule heads, tracked generator cleanliness, mission-source and decoder hashes, and records generator/XML/dialect/binary/harness hashes. A binary hash identifies the executable; the separate runner's build/tree proof establishes its source relationship.

```bash
python dr11/wire/wire_probe.py \
  --source "$PX4_SOURCE" \
  --build "$PX4_SOURCE/build/px4_sitl_default" \
  --dialect "$GENERATED_DEVELOPMENT_PY" \
  --expected-mission-sha256 "$REVIEWED_MISSION_SHA256" \
  --expected-dialect-sha256 "$GENERATED_DEVELOPMENT_SHA256" \
  --shared-probe scripts/px4-event-range/wire_probe.py \
  --output "$EVIDENCE_DIR/wire"
```

The output directory must be new. The fixture starts the actual `bin/px4 <build/etc> -s etc/init.d-posix/rcS -t <source/test_data> -d` process in a fresh output-local rootfs, with `PX4_SIM_MODEL=sihsim_quadx`, speed factor 1, vehicle IDs 1/1 and client IDs 245/190. UDP is confined to `127.0.0.1:14580` → client port 14540. It rejects a pre-existing source-port binding, verifies that the launched PID owns that UDP socket, records PID/process-group/start token, and uses the normal `px4-shutdown` command. Forced or failed cleanup fails the replay.

The protocol sequence is:

1. Observe disarmed heartbeat, native global position and initial periodic current telemetry. Confirm the fresh rootfs has no mission using an actual download transaction.
2. Upload three mission items and require requests for all three plus a directed accepted `MISSION_ACK`. The mission consists of TAKEOFF, WAYPOINT and LAND near the observed simulator position; `SupportedCommandParams` masks are respected and unused floating parameters use NaN.
3. Download all three items, verify their full serialized mission content with documented unused-parameter normalization, and compare the upload ACK's mission ID with the download and current-message identity.
4. Observe a valid new selection, a same-sequence request, wrong system/component controls, and invalid sequences at count and uint16 maximum. Every case includes a typed, byte-decoded INT32 `MAV_SYS_ID` read barrier and continuing unarmed heartbeat/current telemetry. No negative control passes merely because no reply appeared.
5. Download all mission items again and require unchanged content and mission ID, with only the expected current-selection flag changed.

Each case records every observed `MISSION_CURRENT` field: sequence, total, state, mode, mission ID, fence ID and rally ID. Four-second observation windows after the read barrier and finite transfer/startup capture deadlines are fixture bounds, not MAVLink protocol deadlines. Missing observations fail compatibility/control checks without diagnosing a timeout violation.

Evidence files are `result.json`, `native-process.json`, `px4.log`, `shutdown.log`, `wire.udp`, `tx.jsonl` and `rx-decoded.jsonl`. The raw journal uses the frozen collector's `PX4UDP1` schema and records receive timestamps, source endpoint, observed kernel drop counter and full UDP bytes; TX records include timestamps, destination and complete frame bytes. No MAVLink decoding occurs on the collection hot path. Drops, truncation, bad framing/CRC, wrong source, armed heartbeat, rejected/incomplete mission transfers, missing cases or cleanup problems yield `HARNESS_OR_CONTROL_FAILURE` and exit 2. Successful completion yields `WIRE_COMPATIBILITY_CHECKS_PASSED` and exit 0. It never reports a causal-regression reproduction from wire packets.
