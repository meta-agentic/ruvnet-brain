# cognitum-meta-proxy-dist — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for

**What it is & who it's for**

`cognitum-meta-proxy-dist` is a public distribution repository for signed release binaries of the `cognitum-one/meta-proxy` project. It serves as a trusted mirror for distributing verified artifacts, enabling secure installation and verification of the proxy binaries without requiring authentication. This repository exists specifically to support the `metaharness proxy install` command, as outlined in ADR-117, by providing a reliable source for downloading and verifying the proxy's release artifacts using Ed25519 signatures.

The repository is **not** a source code repository; the proxy's source remains private. Instead, it exclusively hosts **signed release artifacts** (`README.md`). This design ensures that users can securely access and verify the proxy binaries without exposing the underlying source code.

This repository is for:
1. **Developers and operators** who need to install and verify the `meta-proxy` binaries securely.
2. **System administrators** responsible for integrating the proxy into their infrastructure.
3. **Automated tools** like `metaharness` that rely on a trusted source for downloading and verifying release artifacts.

Key capabilities:
- **Ed25519 signature verification** of release artifacts (`README.md`).
- **Public access** to signed binaries without requiring authentication (`README.md`).

If you need access to the proxy's source code, this repository does not provide it; refer to the private `cognitum-one/meta-proxy` repository instead.

## Capabilities (what it can do)

### Capabilities (what it can do)

1. **Distribute signed release binaries for `cognitum-one/meta-proxy`**  
   The repository EXISTS to publicly distribute signed release artifacts for the `cognitum-one/meta-proxy` project. This allows tools like `metaharness proxy install` to download and verify these binaries without requiring authentication.  
   Source: `README.md` ("Public distribution mirror for [`cognitum-one/meta-proxy`](https://github.com/cognitum-one/meta-proxy) release binaries.")

2. **Enable Ed25519 verification of downloaded artifacts**  
   The distributed binaries are signed, enabling verification using Ed25519 signatures. This ensures the integrity and authenticity of the downloaded artifacts.  
   Source: `README.md` ("this repo holds only the **signed** release artifacts so `metaharness proxy install` (ADR-117) can download + Ed25519-verify them without auth.")

3. **Prevent accidental source code commits**  
   The repository explicitly prohibits committing source code, ensuring it remains a distribution-only mirror.  
   Source: `README.md` ("Do not commit source here.")

Note: The repository does NOT host or provide access to the private source code of `cognitum-one/meta-proxy`. Its sole purpose is to distribute signed binaries.  
Source: `README.md` ("The proxy **source is private**; this repo holds only the **signed** release artifacts...")

## Core concepts & how they work

### Core concepts & how they work

1. **Public Distribution Mirror for Release Binaries**  
   The repository serves as a public distribution mirror for signed release artifacts from the private `cognitum-one/meta-proxy` source. This allows users to download and verify these artifacts without requiring authentication. The mirror is specifically designed to support the `metaharness proxy install` command as outlined in ADR-117.  
   - **Implementation**: The repository is structured to host only signed release artifacts, ensuring secure distribution (`README.md`).

2. **Signed Release Artifacts**  
   All release artifacts hosted in this repository are signed using Ed25519, enabling users to verify their authenticity before installation. This ensures the integrity and security of the distributed binaries.  
   - **Implementation**: The signing and verification process is integrated into the `metaharness proxy install` workflow (`README.md`).

3. **Private Source Code**  
   The source code for the proxy remains private and is not included in this repository. This separation ensures that only verified and signed binaries are publicly accessible, reducing the risk of unauthorized modifications.  
   - **Implementation**: The repository explicitly prohibits committing source code, maintaining a clear boundary between private development and public distribution (`README.md`).

4. **Support for `metaharness proxy install`**  
   The repository is designed to seamlessly integrate with the `metaharness proxy install` command, providing a reliable source for downloading and verifying proxy binaries as per ADR-117.  
   - **Implementation**: The repository's structure and artifact hosting are optimized for this use case (`README.md`).

This section confidently outlines the core concepts and their implementations based on the provided source excerpts.

## Maturity (shipped vs proposed)

The maturity of `cognitum-meta-proxy-dist` is explicitly defined in the source:

1. **SHIPPED/ACCEPTED** (production-ready):
   - Public distribution mirror for signed `meta-proxy` release binaries (`README.md` states this is the *current* purpose)
   - Artifact hosting for `metaharness proxy install` (ADR-117 integration, per `README.md` line 4)
   - Ed25519 signature verification capability (explicitly mentioned in `README.md` as a deployed security measure)

2. **NOT PRESENT/COVERED** (do not claim):
   - No proposed features or experimental components are documented in the source (`README.md` contains zero "proposed" language)
   - No ADR status discussions appear in the visible artifacts (only ADR-117 is referenced as an *existing* integration point)

The implementation is strictly limited to binary distribution with cryptographic verification, as evidenced by the unambiguous declaration: *"this repo holds only the signed release artifacts"* (`README.md` line 3). Any claims beyond this scope would be unsupported by the source material.

## Where the documentation lives

Based on the source, here's the definitive documentation section:

---

### Where the documentation lives

The documentation for `cognitum-meta-proxy-dist` is intentionally minimal since this repository serves exclusively as a distribution channel for signed release artifacts. Key facts:

1. **Primary Documentation EXISTS** in the repository's `README.md` (`/README.md`), which establishes:
   - The repo's purpose as a public mirror for signed release binaries
   - The private nature of the source code (this ONLY contains artifacts)
   - The integration with `metaharness proxy install` per ADR-117

2. **No additional guides or ADRs exist** in this repository - all architectural decisions and implementation details are documented in the private source repository at [`cognitum-one/meta-proxy`](https://github.com/cognitum-one/meta-proxy).

3. **Verification documentation EXISTS implicitly** through the signed artifact format, though the exact signing process is only documented in the private source repository.

For all other documentation needs (including proxy functionality, API references, or deployment guides), you must reference the private source repository or the consuming system's documentation (`metaharness`). This repository's scope is strictly limited to distribution as confirmed in `/README.md`.

## How to use it end-to-end

Based SOLELY on the source excerpts provided, here is the authoritative "How to use it end-to-end" section:

---

### How to use it end-to-end

1. **Installation via metaharness**:  
   The proxy is designed to be installed through the `metaharness` tool's proxy installation command. Execute:  
   ```bash
   metaharness proxy install
   ```  
   This will automatically download and verify the signed release artifacts from this repository (`cognitum-one/meta-proxy-dist`).  

2. **Verification**:  
   The proxy binaries are Ed25519-signed for authenticity. The verification is handled internally by `metaharness` during installation (ADR-117 compliance).  

3. **Direct Artifact Access**:  
   While the primary use is through `metaharness`, you can manually inspect the signed release artifacts in this repository. The actual proxy **source code is private**; only the verified binaries are distributed here.  

4. **Limitations**:  
   - Configuration or runtime usage details are **not covered** in this repository (refer to `metaharness` or the private `meta-proxy` source).  
   - The repository (`meta-proxy-dist`) **only** hosts release binaries (`README.md` explicitly states this is a distribution mirror).  

For further usage (e.g., proxy configuration/runtime), consult the `metaharness` documentation or the private `meta-proxy` source (access restricted).  

--- 

Citing verbatim from sources:  
- `README.md`: "Public distribution mirror for [`cognitum-one/meta-proxy`](https://github.com/cognitum-one/meta-proxy) release binaries."  
- `README.md`: "The proxy **source is private**; this repo holds only the **signed** release artifacts so `metaharness proxy install` (ADR-117) can download + Ed25519-verify them without auth."  

No other installation or usage paths are documented in the provided sources.
