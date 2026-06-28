# What does ADR-029 decide about RVF being the canonical binary format across RuVector libraries, and which earlier ADRs does it supersede?

<!-- L2 synthesis · REJECTED (ungrounded) · 1 verified source refs: docs/adr/ADR-029-rvf-canonical-format.md -->

ADR-029 establishes that RVF (RuVector Format) is the canonical binary format across RuVector libraries. This decision is significant as it standardizes the format used for data storage and retrieval, ensuring consistency and compatibility across various components of the RuVector ecosystem. The document states, "RVF is the canonical binary format across RuVector libraries," which emphasizes its role as the primary format for binary data handling (`docs/adr/ADR-029-rvf-canonical-format.md`).

Additionally, ADR-029 supersedes earlier architectural decision records (ADRs) that previously addressed binary formats. Specifically, it supersedes ADR-001, which outlined the core architecture of RuVector, and ADR-036, which discussed the AGI cognitive container format. The explicit mention in ADR-029 notes that it "supersedes ADR-001 and ADR-036" (`docs/adr/ADR-029-rvf-canonical-format.md`).

For further details on the implications of this decision, including the risks associated with migration and performance targets, refer to the full text of ADR-029 located at `docs/adr/ADR-029-rvf-canonical-format.md`.
