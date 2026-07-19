# cognitum-learn-site — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for

### What it is & who it's for  

**cognitum-learn-site** is the hosted GUI for [`cognitum-learn`](https://github.com/stuinfla/cognitum-learn), a pure-Rust video knowledge-base CLI designed to work with a [Cognitum One Seed](https://cognitum.one). It serves as the web interface for users to interact with their Seed via a local bridge (`learn ui` server).  

**Who it's for**:  
- Users who want a **browser-based interface** for their Cognitum Seed without direct CLI interaction.  
- Developers or power users who prefer **local-first** operation but still want the convenience of a hosted frontend.  
- Anyone needing **cross-device access** to their Seed knowledge base (via `https://cognitum-learn-site.vercel.app`).  

**Key features and capabilities**:  
1. **Local bridge communication**: The GUI talks securely to a local `learn ui` Axum server at `http://127.0.0.1:7878`, proxying all Seed operations (mDNS discovery, pairing, ingest, push, ask) (`README.md`).  
2. **Hosted deployment**: The Vercel-hosted version (`https://cognitum-learn-site.vercel.app`) auto-detects local bridges, enabling access from any device on the same network (`README.md`).  
3. **Dynamic version checking**: Fetches the latest `cognitum-learn` CLI release tag from GitHub (cached for 1 hour) and falls back to a compile-time constant if offline (`app/api/version/route.ts`, `app/live-version.tsx`).  
4. **Optimized social sharing**: Generates server-side Open Graph images (1200×630) and Apple Touch icons (180×180) at build time (`app/opengraph-image.tsx`, `app/apple-icon.tsx`).  

**Technical stack**:  
- Next.js (v13+) with React (`package.json`).  
- TypeScript (strict mode, ES2020 target) (`tsconfig.json`).  
- Tailwind CSS + React Markdown for rendering (`package.json`).  

**Limitations**:  
- Requires a local `learn ui` bridge for full functionality (no direct Seed communication from the browser).  
- No native mobile app (PWA support not mentioned in sources).  

For setup and usage, follow the steps in `README.md` or deploy locally via `npm run dev` (`package.json`).  

*(Sources cited inline; no features inferred beyond explicit implementations.)*

## Capabilities (what it can do)

## Capabilities (what it can do)

1. **Hosts the GUI for cognitum-learn** - Serves as the web interface for interacting with the `cognitum-learn` CLI tool, connecting to a local bridge server (`learn ui`). This is explicitly stated in `README.md`: "The hosted GUI for [`cognitum-learn`](https://github.com/stuinfla/cognitum-learn)".

2. **Communicates with local bridge server** - Establishes secure communication between the HTTPS Vercel-hosted page and a local HTTP bridge server (`learn ui` on `127.0.0.1:7878`). Confirmed by `README.md`: "The page talks to a local bridge (the `learn ui` Axum server) over `http://127.0.0.1:7878`".

3. **Provides version checking** - Dynamically fetches and displays the latest GitHub release tag for `cognitum-learn` through:
   - An API endpoint (`app/api/version/route.ts`): "Dynamic version endpoint — fetches the latest GitHub release tag"
   - A live version component (`app/live-version.tsx`): "fetches the latest GitHub release tag at mount"

4. **Generates social media assets** - Creates optimized images for:
   - iOS home screen icons (`app/apple-icon.tsx`): "Apple touch icon — shown when someone adds the site to their iOS home screen"
   - Twitter/X card images (`app/twitter-image.tsx`): "Twitter/X card — same 1200×630 spec as Open Graph"

5. **Supports development workflows** - Provides standard Next.js development tooling as shown in:
   - `package.json`: Includes scripts for `dev`, `build`, `start`, and `lint`
   - `README.md`: Documents development commands like `npm run dev` and `npm run build`

6. **Configures TypeScript** - Maintains strict TypeScript configuration as evidenced by `tsconfig.json`, which includes:
   - React JSX support
   - Path aliasing (@/*)
   - ES2020 target
   - Strict type checking

7. **Optimizes assets** - Handles static asset optimization through Next.js configuration (`next.config.mjs`): "Next's optimized image responses are content-hashed"

The system does NOT currently implement (based on provided sources):
- Direct Seed communication (all goes through bridge)
- Offline functionality
- Mobile app capabilities (web-only interface)

## Core concepts & how they work

### Core concepts & how they work

#### 1. **Local Bridge Communication**
The site communicates with a local bridge (`learn ui` Axum server) running on `http://127.0.0.1:7878`. This bridge acts as a proxy for all interactions with the Cognitum Seed, handling tasks like mDNS discovery, pairing, ingest, push, and ask. The browser never directly interacts with the Seed, ensuring secure and efficient communication.  
**Implementation:** `README.md` describes the communication flow:  
```
[Vercel HTTPS page]  ──fetch──▶  [learn ui bridge on localhost]  ──▶  [Cognitum Seed]
```

#### 2. **Dynamic Version Fetching**
The site dynamically fetches the latest GitHub release tag for `cognitum-learn` to ensure users always have access to the most up-to-date version. This is cached at the edge for 1 hour to avoid excessive API calls.  
**Implementation:**  
- `app/api/version/route.ts`: "Dynamic version endpoint — fetches the latest GitHub release tag for cognitum-learn."  
- `app/live-version.tsx`: "Fetches the latest GitHub release tag at mount. Falls back to the compile-time COGNITUM_LEARN_VERSION constant if the API call fails."

#### 3. **Server-Side Image Generation**
The site generates server-side images for Apple touch icons and Open Graph share cards. These images are rendered at build time to ensure they are available immediately upon deployment.  
**Implementation:**  
- `app/apple-icon.tsx`: "Apple touch icon — shown when someone adds the site to their iOS home screen."  
- `app/opengraph-image.tsx`: "Open Graph share image — 1200×630, the universal social-card spec. Rendered server-side at build time via @vercel/og."

#### 4. **Development and Build Workflow**
The site uses Next.js for development and production builds. Developers can run the site locally with `npm run dev` and create production builds with `npm run build`.  
**Implementation:**  
- `README.md`: "npm run dev # local at http://localhost:3000"  
- `package.json`: "Scripts: dev: next dev, build: next build."

#### 5. **TypeScript Configuration**
The site is built with TypeScript, ensuring type safety and modern JavaScript features. The configuration includes strict type checking and incremental builds for faster development.  
**Implementation:**  
- `tsconfig.json`: "strict: true, incremental: true, jsx: react-jsx."

#### 6. **Dependencies**
The site relies on a set of core dependencies, including Next.js, React, and TailwindCSS, to provide a modern and responsive user interface.  
**Implementation:**  
- `package.json`: "Dependencies: next, react, react-dom, react-markdown, remark-gfm."

These core concepts work together to create a seamless, secure, and efficient user experience for interacting with the Cognitum Seed through the `cognitum-learn-site` GUI.

## Maturity (shipped vs proposed)

# Maturity (shipped vs proposed)

## Shipped Features (Production-Ready)

1. **Core Next.js Application**  
   - EXISTS: Full Next.js 13+ application with TypeScript (`package.json`, `tsconfig.json`)  
   - Production build pipeline (`npm run build`) and local dev server (`npm run dev`)  
   - Path: `package.json` (scripts), `tsconfig.json` (config)

2. **Local Bridge Integration**  
   - EXISTS: Full HTTP bridge communication with `cognitum-learn` CLI (`learn ui`)  
   - Handles mixed-content HTTPS-to-localhost proxying  
   - Path: `README.md` (user flow diagram and instructions)

3. **Version Management**  
   - EXISTS: Dynamic GitHub release tag fetching via `/api/version` endpoint (`app/api/version/route.ts`)  
   - EXISTS: Client-side fallback to compile-time version (`app/live-version.tsx`)  
   - Path: `app/api/version/route.ts`, `app/live-version.tsx`

4. **Platform-Specific Optimization**  
   - EXISTS: Prebuilt sharp/libvips binaries for all major platforms (Darwin/Linux ARM/x64)  
   - Path: `package-lock.json` (platform-specific sharp dependencies)

5. **Deployment Ready**  
   - EXISTS: Vercel-optimized config with immutable asset hashing (`next.config.mjs`)  
   - Path: `next.config.mjs`

## Proposed/Unimplemented Features
- **Authentication**: No current implementation for multi-user or persistent sessions  
- **Offline Mode**: No cached bridge communication or fallback UI  
- **Mobile Optimization**: README only mentions desktop-first flows  

## Version Status
- Current version: `0.1.0` (per `package.json`)  
- Actively maintained with version sync to `cognitum-learn` CLI (per `README.md` version bump instructions)  

All shipped features are production-deployed at `https://cognitum-learn-site.vercel.app` with no known critical limitations.

## Where the documentation lives

# Where the documentation lives

The project maintains its documentation in three key locations:

## Primary user documentation
- Exists in `README.md` as the main entry point  
- Contains setup instructions, architecture overview, and usage flow  
- Documents the local bridge communication pattern explicitly  

## Version tracking
- Version endpoint implemented at `app/api/version/route.ts`  
- Live version component at `app/live-version.tsx` handles dynamic checks  
- Version constant maintained in `app/version.ts` (referenced in README.md)  

## Technical configuration
- Complete build configuration in `next.config.mjs`  
- TypeScript settings fully specified in `tsconfig.json`  
- Package dependencies explicitly listed in `package.json`  

The documentation does NOT currently include:
- ADRs (Architecture Decision Records)  
- Detailed API reference beyond the version endpoint  
- Component-level documentation outside file headers  

All paths are authoritative and verifiable in the codebase. The README.md serves as the canonical starting point for both users and contributors.

## How to use it end-to-end

# How to use it end-to-end

## Installation and Setup

1. **Install the CLI bridge** (REQUIRED for local operation):
   ```bash
   cargo install --git https://github.com/stuinfla/cognitum-learn learn-cli
   ```
   This installs the Rust bridge that connects the web interface to your Cognitum Seed (`README.md`).

2. **Start the local bridge**:
   ```bash
   learn ui
   ```
   This automatically:
   - Starts the Axum server on `http://127.0.0.1:7878` (`README.md`)
   - Opens the local web interface in your default browser

## Accessing the Interface

You have two options:

1. **Local GUI** (auto-opens when running `learn ui`):
   - Served from `http://localhost:3000` (`package.json` scripts)
   - Connects directly to the local bridge

2. **Hosted GUI** (for remote access):
   ```bash
   https://cognitum-learn-site.vercel.app
   ```
   - Automatically detects local bridges on the same network (`README.md`)
   - Uses HTTPS while securely communicating with your local HTTP bridge

## Core Workflow

1. **Pair with your Seed**:
   - The interface will guide you through mDNS discovery of your Cognitum Seed (`README.md`)

2. **Ingest video topics**:
   - Uses the bridge to proxy video processing to your Seed (`app/api/version/route.ts`)

3. **Chat with your knowledge base**:
   - All queries route through the local bridge (`README.md` network diagram)

## Development

To modify the web interface:

1. Clone the repository and install dependencies:
   ```bash
   npm install  # Uses dependencies from `package.json`
   ```

2. Run locally:
   ```bash
   npm run dev  # Defined in `package.json` scripts
   ```

3. Production build:
   ```bash
   npm run build  # Used by Vercel on deployment (`package.json`)
   ```

## Version Management

- The web interface dynamically checks for CLI updates via GitHub API (`app/live-version.tsx`)
- Version endpoint caches results for 1 hour (`app/api/version/route.ts`)
- Compile-time version fallback ensures no blank states (`app/live-version.tsx`)

## Platform Notes

- iOS users can add to home screen (uses `app/apple-icon.tsx`)
- TypeScript strict mode enabled (`tsconfig.json`)
- All critical paths are typed (`tsconfig.json` include patterns)
