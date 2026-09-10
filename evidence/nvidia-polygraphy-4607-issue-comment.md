I independently reproduced the branch-freezing part of this issue against TensorRT commit `c93b7d4893184af4882f9f1862e13a5c64b8677d` using Polygraphy and ONNX Runtime on CPU.

A four-node branched Identity/Add graph produces outputs `[2, 4]` for input samples `[1, 2]`. With correct per-sample intermediate feeds, input reduction in both linear and bisect modes produces `[2, 3]`: a removed branch is frozen using the first sample. Single-sample and `--no-reduce-inputs` controls preserve their expected outputs. The original graph passes the checker; this reproduction isolates a mismatch introduced by reduction.

I prepared a conservative guard that rejects branch freezing when the reducer's data loader contains multiple iterations. A shared DataLoaderCache lets the check handle one-shot generators and previously cached fallback outputs. The diagnostic points to a consistent single-sample run or `--no-reduce-inputs`.

Validation against the pinned source:
- Eight regression cases fail before the patch and pass afterward.
- All 16 focused CPU tests pass afterward, including eight controls.
- The full TensorRT/Polygraphy test suite was not run; the self-contained test file was run with `--noconftest`.

This is a guard against incorrect reduction, not full multi-sample branch-freezing support. It does not duplicate the separate `data to-input` aliasing fix in #4779.

[Reproduction and validation scripts](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/tree/ab1ecaaa0644f48669336cace102b836ba5d1491/evidence/in-progress/nvidia-polygraphy-4607) · [Passing validation run](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/actions/runs/34438215413) · [Tested patch](https://github.com/timothyanderson096-ocdealcheck/gdn-engineering-benchmarks/blob/agent/nvidia-polygraphy-4607-20260910/evidence/nvidia-polygraphy-4607-verified-guard.patch)

Would this focused guard be an acceptable direction for a PR?
