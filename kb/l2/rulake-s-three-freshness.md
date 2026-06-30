# What are ruLake's three freshness modes (Fresh / Eventual / Frozen) and how do they differ?

<!-- L2 synthesis · ACCEPTED · 2 verified source refs: plugins/rulake-kernels/commands/rulake-kernel-status.md, docs/adrs/ADR-157-optional-accelerator-plane.md -->

ruLake operates with three distinct freshness modes: **Fresh**, **Eventual**, and **Frozen**. Each mode dictates how the system handles data consistency and kernel selection based on the requirements of the task at hand.

1. **Fresh Mode**:
   - In this mode, the system requires strict determinism. Only deterministic kernels are eligible for dispatch, ensuring that the output is bit-identical across runs. This is crucial for scenarios where exact reproducibility is necessary. The selection of kernels in this mode is governed by the need for deterministic output, which is enforced by the logic in the kernel selection process. Specifically, the code checks if the kernel is deterministic and meets the minimum batch size and dimension requirements before dispatching it. This is evident in the implementation where it states, "Always honor Fresh / Frozen determinism requirement" (`docs/adrs/ADR-157-optional-accelerator-plane.md`).

2. **Eventual Mode**:
   - This mode allows for more flexibility, permitting the use of non-deterministic kernels. It is suitable for scenarios where exact reproducibility is not critical, and the system can tolerate some variability in the results. The kernel selection in this mode does not enforce the deterministic requirement, allowing for potentially faster or more efficient kernels to be used, as indicated by the sample output from the `/rulake-kernel-status` command, which shows that under `Consistency::Eventual`, a non-deterministic kernel (like `wgpu`) can be selected (`plugins/rulake-kernels/commands/rulake-kernel-status.md`).

3. **Frozen Mode**:
   - In Frozen mode, the system does not recheck the data once it has been cached. This means that once data is retrieved and cached, it remains unchanged, and the system will not attempt to refresh or validate it against the backend. This mode is useful for scenarios where data stability is prioritized over freshness, and it can lead to performance improvements by reducing the overhead of constant data validation. The kernel selection process in this mode also adheres to the determinism requirement, similar to Fresh mode, as indicated by the same logic that applies to kernel selection (`docs/adrs/ADR-157-optional-accelerator-plane.md`).

In summary, the key differences among the three modes are:
- **Fresh**: Requires deterministic kernels for exact reproducibility.
- **Eventual**: Allows non-deterministic kernels, suitable for scenarios where some variability is acceptable.
- **Frozen**: Caches data without rechecking, prioritizing stability and performance over freshness.

For further details on the implementation and behavior of these modes, refer to the following paths:
- `/rulake-kernel-status` for kernel capabilities and dispatch preferences (`plugins/rulake-kernels/commands/rulake-kernel-status.md`).
- The kernel selection logic and determinism requirements can be found in the ADR-157 documentation (`docs/adrs/ADR-157-optional-accelerator-plane.md`).
