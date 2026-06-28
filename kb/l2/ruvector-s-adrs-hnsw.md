# Where are RuVector's ADRs and HNSW documentation kept in the repo?

<!-- L2 synthesis · ACCEPTED · 4 verified source refs: crates/ruvector-bench/docs/BENCHMARKS.md, docs/project-phases/phase2_hnsw_implementation.md, crates/ruvector-hnsw-repair/Cargo.toml, crates/ruvector-coherence-hnsw/Cargo.toml -->

The documentation for RuVector's Approximate Nearest Neighbor (ANN) and Hierarchical Navigable Small World (HNSW) algorithms can be found in the following locations within the repository:

1. **HNSW Implementation Documentation**: Detailed information about the HNSW implementation is located in the file at `docs/project-phases/phase2_hnsw_implementation.md`. This document includes technical details about the HNSW state management, serialization, and deserialization processes, which are crucial for understanding how the HNSW algorithm operates within RuVector.

2. **HNSW Integration Tests**: For practical examples and testing of the HNSW functionality, you can refer to the integration tests located at `crates/ruvector-core/tests/hnsw_integration_test.rs`. This file contains various tests that validate the performance and accuracy of the HNSW implementation, including tests for different vector counts and efSearch tuning.

3. **HNSW Repair and Coherence Documentation**: Additional HNSW-related documentation can be found in the `Cargo.toml` files for the HNSW repair and coherence crates:
   - The HNSW repair documentation is described in `crates/ruvector-hnsw-repair/Cargo.toml`, which outlines the purpose of the crate related to online HNSW graph repair.
   - The coherence-gated HNSW search documentation is in `crates/ruvector-coherence-hnsw/Cargo.toml`, detailing its functionality for faster beam search while maintaining recall.

For further exploration, you may also want to look into the benchmark options for ANN, which are detailed in the `crates/ruvector-bench/docs/BENCHMARKS.md` file. This document provides command-line options for running benchmarks that can help assess the performance of the ANN and HNSW implementations.
