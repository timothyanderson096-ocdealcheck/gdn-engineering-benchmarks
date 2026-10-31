# Native raw UDP capture

This helper addresses observed Python receive loss in the PX4 event-range test harness. It changes no PX4 source, protocol oracle, requested/actual socket buffer, endpoint or operating-system setting. The actual 65,535-response baseline control with zero observed kernel overflow still has to pass on standard GitHub Actions before capture capability is established.

Compile separately after ordinary upstream environment setup:

```sh
g++ -std=c++17 -O2 -Wall -Wextra -Werror capture_native.cpp -o "$RUNNER_TEMP/px4-capture-native"
```

The runner pins source and executable hashes and sets `PX4_CAPTURE_NATIVE` to that exact executable for the wire subprocess. Importing capture_native.py has no environment or native-process requirement. `Collector(output)` requires the environment at construction, or an explicit `native_binary=` argument; it never falls back to the Python reader silently. The integration owner chooses which already-reviewed low-volume fixture retains the original Python collector.

Python creates/binds the same IPv4 UDP socket, requests the same16MiB SO_RCVBUF and reports the actual granted value, enables SO_RXQ_OVFL and retains that same FD for sends. It passes the FD to one C++ child with pass_fds. The child does no decoding, filtering, socket tuning or packet fabrication. Linux recvmmsg batches use heap-backed payload/control buffers; every batch resets the kernel-updated message fields. Truncation, invalid metadata, socket/I/O errors or observed receive loss fail the capture.

The native child writes the exact existing journal: magic `PX4UDP1\n`, then20-byte little-endian `<Q4sHHI>` headers (CLOCK_MONOTONIC nanoseconds, network-order IPv4 bytes, host port encoded little-endian, UDP payload length, cumulative observed kernel drop counter), followed by exact UDP bytes. Timestamps are dequeue observations in the same clock domain as Python TX timestamps, not kernel packet-arrival timestamps. Zero-length UDP payloads are records, not EOF. Batch writes handle EINTR/short writes, flush at1MiB or receive quiescence, and preserve the quiet tail. The counter is carried forward when a packet lacks ancillary metadata. Zero observed overflow is not a mathematical guarantee of no loss; the unchanged exact range/count/order controls remain required.

`Collector` preserves `.socket`, `.records` (append-only sequence with len/slice/list semantics, readable after close), `.transmitted`, `.write(raw)`, `.effective_buffer`, `.reader_error` and `.close()`. Records are parsed incrementally only when Python reads the interface, outside the native receive path. Partial journal writes remain buffered until a complete header and payload exist; a partial final EOF fails. No record is invented or skipped. Unexpected child exit is failed even with exit0.

Timed sends only poll native-child health and inspect already recorded errors; they do not parse the receive journal before transmission. This avoids Python burst parsing moving the intended parameter-request offset. Journal/loss validation still happens through records, reader_error and close before protocol success can be reported. The wire fixture records the actual TX offset rather than assuming the requested sleep duration was met.

The caller stops its sender/native PX4 process before closing the collector. Collector close requests SIGTERM only for its separate capture child, which drains queued packets to EAGAIN and flushes; a three-second parent watchdog kills a nonquiescent capture and marks failure. That expected capture-child stop is distinct from any PX4 signal cleanup. Native errors/forced stop fail close; raw journal and TX bytes remain. Final status and parsed packet count must agree. No retries or response caps are implemented.

The capture reader inherits the wire probe's process group, so the outer watchdog also stops it if Python is killed before close. It does not create a separate session or escape that watchdog. Any child exit observed before the parent stop request is failed, including exit0 with an otherwise well-formed status; normal post-stop exit0 is distinguished explicitly.

Artifacts added beside the existing wire outputs are capture-native.log and capture-native.json. Status includes STOPPED/CAPTURE_FAILED, error, stop_requested, packets, payload_bytes, batches, journal_bytes and kernel_dropped. `capture_status` exposes the final JSON after close. wire.udp and tx.jsonl retain their prior names/schema. The runner must retain all three output types and helper/executable identities.

Local implementation evidence is deliberately separate from PX4 validation. One initial small synthetic loopback control verified exact zero-length/binary/batched/max-size UDP bytes, source IP/port, parent transmission on the same FD and unexpected-child-exit failure; it was run once before the instruction to reserve further socket validation for Actions. It is not PX4 IPC/SITL or a full-rate zero-drop claim. Offline tests cover every journal split position, byte-at-a-time input, ancillary counter preservation, malformed/partial final records, and post-close reads. Compile/static/parser checks can run locally; no repeat of the local UDP test is needed. Actual full-rate protocol controls and raw evidence must be reviewed on Actions.
