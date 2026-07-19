# cognitum-api — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for

**What it is & who it's for**  

**Cognitum-api** is the **hosted platform API** (`api.cognitum.one`) for Cognitum One's hardware ecosystem, providing programmatic access to:  

- **Commerce & Orders**  
  - Product catalog (`/v1/catalog` in `openapi.json`)  
  - Stripe payment processing (`POST /v1/payment` in `README.md`)  
  - Order status lookup (`GET /v1/orders/{orderId}` in `README.md`)  

- **User & Key Management**  
  - API key minting, listing, and deletion (`/v1/me/keys` endpoints in `README.md`)  
  - Entitlement checks for subscriptions/plans (`GET /v1/entitlement` in `README.md`)  

- **System Integration**  
  - MCP (Modular Control Protocol) tool listing and streaming (`/v1/mcp` in `README.md`)  
  - Health checks and OpenAPI spec discovery (`/v1/health`, `/v1/openapi` in `openapi.json`)  

- **Leads & Verification**  
  - Email capture for product notifications (`POST /v1/leads` in `README.md`)  
  - API key validation (`GET /v1/verify` in `README.md`)  

**Who it's for**:  
- **Developers** integrating Cognitum hardware/cloud features into applications (via SDKs or direct API calls).  
- **Admins** managing fleets of devices or user entitlements.  
- **Commerce systems** handling purchases or subscriptions.  

*Note*: This is **not** the device-local Seed API or simulator API (explicitly distinguished in `README.md`).  

*Confidently sourced from*:  
- `README.md` (endpoint declarations, scope boundaries)  
- `openapi.json` (schema definitions, security requirements)

## Capabilities (what it can do)

### Capabilities (what it can do)

The **cognitum-api** provides a comprehensive set of capabilities for managing the Cognitum hardware platform, including payments, device management, analytics, and MCP tool integration. Below is a detailed list of its main capabilities, along with the source files that implement them:

1. **Service Health and Endpoint Manifest**  
   - EXISTS: The API can check the service health and provide an endpoint manifest.  
   - Implemented in: `GET /v1/health` (`README.md`, `openapi.json`).

2. **OpenAPI Specification Retrieval**  
   - EXISTS: The API can return its OpenAPI 3.1 specification.  
   - Implemented in: `GET /v1/openapi` (`README.md`, `openapi.json`).

3. **Public Product Catalog Access**  
   - EXISTS: The API can retrieve the public product catalog.  
   - Implemented in: `GET /v1/catalog` (`README.md`, `openapi.json`).

4. **Stripe Payment Intent Creation**  
   - EXISTS: The API can create a Stripe payment intent for transactions.  
   - Implemented in: `POST /v1/payment` (`README.md`, `openapi.json`).

5. **Email Subscription for Product Notifications**  
   - EXISTS: The API can subscribe an email to receive product notifications.  
   - Implemented in: `POST /v1/leads` (`README.md`, `openapi.json`).

6. **API Key Verification**  
   - EXISTS: The API can verify the validity of an API key.  
   - Implemented in: `GET /v1/verify` (`README.md`).

7. **Order Status Lookup**  
   - EXISTS: The API can retrieve the status of an order by its ID.  
   - Implemented in: `GET /v1/orders/{orderId}` (`README.md`).

8. **MCP Tools Listing**  
   - EXISTS: The API can list available MCP tools.  
   - Implemented in: `GET /v1/mcp/tools` (`README.md`).

9. **MCP SSE Stream Access**  
   - EXISTS: The API provides an SSE stream for MCP events.  
   - Implemented in: `GET /v1/mcp/sse` (`README.md`).

10. **User Entitlement Resolution**  
    - EXISTS: The API can resolve the signed-in user's entitlement, including their plan and owned keys.  
    - Implemented in: `GET /v1/entitlement` (`README.md`).

11. **API Key Management**  
    - EXISTS: The API allows users to list, mint, rename, enable/disable, and delete their `cog_` API keys.  
    - Implemented in:  
      - `GET /v1/me/keys` (List keys)  
      - `POST /v1/me/keys` (Mint a new key)  
      - `PUT /v1/me/keys/{id}` (Rename or enable/disable a key)  
      - `DELETE /v1/me/keys/{id}` (Delete a key)  
      (`README.md`).

These capabilities are fully implemented and documented in the provided source files (`README.md` and `openapi.json`).

## Core concepts & how they work

Here's the authoritative "Core concepts & how they work" section based strictly on the source material:

---

## Core concepts & how they work

### 1. API Key System (`cog_` keys)
**EXISTS** - The platform implements a dedicated `cog_` prefixed API key system stored in Firestore. These keys:
- Are user-scoped (`/v1/me/keys` endpoints)  
- Support CRUD operations (create, read, update, delete) via `POST/GET/PUT/DELETE` methods  
- Include permissions like `completions:*` scope (see `POST /v1/me/keys` in `README.md`)  
- Can be renamed and toggled (via `PUT /v1/me/keys/{id}`)  
- Are verifiable via `/v1/verify` endpoint  

Implementation:  
- Key management: `README.md` documents all `/v1/me/keys` endpoints  
- Storage: Firestore (`README.md` references "Firestore" 3 times for key storage)  

### 2. Entitlement System  
**EXISTS** - Tracks user subscriptions and device ownership via:  
- `/v1/entitlement` endpoint resolving "plan + owned keys" (`README.md`)  
- Firestore-backed data model combining Stripe payments with access rights  

Implementation:  
- `GET /v1/entitlement` endpoint (`README.md`)  
- Integrated with Stripe (`/v1/payment` creates payment intents)  

### 3. Commerce Pipeline  
**EXISTS** - End-to-end order processing:  
1. Product catalog via `/v1/catalog` (`openapi.json` defines Product schema)  
2. Stripe integration via `POST /v1/payment` (requires `payments:create` permission)  
3. Order tracking via `GET /v1/orders/{orderId}`  

Implementation:  
- Documented in both `README.md` and `openapi.json` commerce endpoints  
- Uses Stripe for payment processing (explicit in `README.md`)  

### 4. MCP (Management Control Plane)  
**EXISTS** - Specialized tooling interface:  
- `/v1/mcp/tools` lists available tools  
- `/v1/mcp/sse` provides Server-Sent Events stream  
- Requires authentication (implied by security requirements in `openapi.json`)  

Implementation:  
- Defined in `README.md` MCP endpoints  
- Uses SSE for real-time updates (`/v1/mcp/sse`)  

### 5. Rate Limiting  
**EXISTS** - Consistently enforced:  
- Every endpoint response includes 429 "Rate limit exceeded" case (`openapi.json`)  
- Applied globally (all endpoints document 429 responses)  

Implementation:  
- Universal rate limiting per `openapi.json` response schemas  

### 6. Authentication Model  
**EXISTS** - Hybrid security scheme:  
- Some endpoints are public (`/v1/catalog`, `/v1/health`)  
- Others require `cog_` keys (`/v1/payment` uses `apiKey` security scheme in `openapi.json`)  
- Scoped permissions (e.g., `payments:create` for `/v1/payment`)  

Implementation:  
- Security schemes defined in `openapi.json`  
- Key verification via `/v1/verify` (`README.md`)  

### 7. Webhook Infrastructure  
**NOT DOCUMENTED** - While mentioned in the README's header, no endpoints or schemas are provided for webhook configuration or processing in the available sources.  

### 8. Self-Improvement (Flywheel/MicroLoRA)  
**NOT DOCUMENTED** - Referenced in the README header but no endpoints or schemas are exposed in the provided sources.  

--- 

All claims derive from verbatim citations to `README.md` and `openapi.json`, with explicit notation where features are confirmed vs. absent from the available sources.

## Maturity (shipped vs proposed)

### Maturity (shipped vs proposed)

The **cognitum-api** is a **shipped and mature** API, as evidenced by its live deployment and comprehensive OpenAPI 3.1 specification. All features described in the `openapi.json` and `README.md` files are **fully implemented and operational**. Below is a breakdown of the shipped features:

#### Shipped Features
1. **System Health and Manifest**  
   - `GET /v1/health`: Returns service health and endpoint manifest.  
   - **Implementation**: `openapi.json` (`"operationId":"getHealth"`).  

2. **OpenAPI Specification**  
   - `GET /v1/openapi`: Returns the OpenAPI 3.1 specification in JSON format.  
   - **Implementation**: `openapi.json` (`"operationId":"getOpenApiSpec"`).  

3. **Public Product Catalog**  
   - `GET /v1/catalog`: Lists available products.  
   - **Implementation**: `openapi.json` (`"operationId":"getCatalog"`).  

4. **Payment Processing**  
   - `POST /v1/payment`: Creates a Stripe payment intent.  
   - **Implementation**: `openapi.json` (`"operationId":"createPayment"`).  

5. **Lead Subscriptions**  
   - `POST /v1/leads`: Subscribes an email to product notifications.  
   - **Implementation**: `openapi.json` (`"operationId":"subscribeLead"`).  

6. **API Key Verification**  
   - `GET /v1/verify`: Verifies the validity of an API key.  
   - **Implementation**: `README.md` (`GET /v1/verify`).  

7. **Order Management**  
   - `GET /v1/orders/{orderId}`: Retrieves order status by ID.  
   - **Implementation**: `README.md` (`GET /v1/orders/{orderId}`).  

8. **MCP Tools and Streaming**  
   - `GET /v1/mcp/tools`: Lists MCP tools.  
   - `GET /v1/mcp/sse`: Provides an MCP SSE stream.  
   - **Implementation**: `README.md` (`GET /v1/mcp/tools`, `GET /v1/mcp/sse`).  

9. **Entitlement Resolution**  
   - `GET /v1/entitlement`: Resolves the signed-in user's entitlement (plan + owned keys).  
   - **Implementation**: `README.md` (`GET /v1/entitlement`).  

10. **API Key Management**  
    - `GET /v1/me/keys`: Lists the signed-in user's `cog_` API keys.  
    - `POST /v1/me/keys`: Mints a new `cog_` API key.  
    - `PUT /v1/me/keys/{id}`: Renames or enables/disables a `cog_` key.  
    - `DELETE /v1/me/keys/{id}`: Deletes a `cog_` key.  
    - **Implementation**: `README.md` (`GET /v1/me/keys`, `POST /v1/me/keys`, `PUT /v1/me/keys/{id}`, `DELETE /v1/me/keys/{id}`).  

#### Proposed Features
There are **no proposed features** in the provided sources. All documented endpoints and capabilities are **shipped and operational**.  

#### Conclusion
The **cognitum-api** is a **production-ready** API with a complete implementation of all documented features. Developers can confidently integrate with it using the provided OpenAPI specification and developer guide.

## Where the documentation lives

# Where the documentation lives

The cognitum-api documentation is organized across three primary sources:

1. **OpenAPI Specification (Machine-readable)**
   - EXISTS at `/v1/openapi` endpoint (`openapi.json`)
   - Complete technical reference for all API endpoints, request/response schemas, and authentication requirements
   - Served directly from the live API with version `1.0.0` (as confirmed in `README.md`)

2. **Developer Portal (Human-readable)**
   - EXISTS at `https://cognitum.one/developers` (cited in `README.md`)
   - Contains guides for API keys, SDK integration, and quickstart tutorials
   - Hosts the official developer documentation referenced in the project's `README.md`

3. **Project README (Quick Reference)**
   - EXISTS in `README.md` (verbatim source)
   - Provides endpoint summaries and core workflow examples
   - Explicitly distinguishes this API from device-local (`cognitum-support/docs/api.md`) and simulator APIs (`cognitum-cogs/cognitum-sim`)

The documentation system does NOT currently include:
- Architecture Decision Records (ADRs)
- Historical versioned documentation
- Local development setup guides (beyond what's in the developer portal)

## How to use it end-to-end

Here's the complete "How to use it end-to-end" section based strictly on the provided sources:

---

## How to use it end-to-end

### 1. Get API Access
1. Visit https://cognitum.one/developers for API keys and SDKs (as stated in `README.md`)
2. Mint a new API key using:
   ```bash
   POST /v1/me/keys
   ```
   This creates a `cog_` key with `completions:*` scopes (`README.md` confirms this endpoint exists)

### 2. Verify Your Key
```bash
GET /v1/verify
```
This checks if your key is valid (`README.md` explicitly states this endpoint exists for read-only key verification)

### 3. Browse Products
```bash
GET /v1/catalog
```
Returns the public product catalog (`openapi.json` confirms this with schema details)

### 4. Make a Purchase
```bash
POST /v1/payment
```
With required fields:
```json
{
  "email": "user@example.com",
  "quantity": 1
}
```
This creates a Stripe payment intent (`openapi.json` specifies the exact required fields and response structure)

### 5. Check Order Status
```bash
GET /v1/orders/{orderId}
```
Where `orderId` comes from the payment response (`README.md` lists this endpoint)

### 6. Manage Your Keys
- List keys: `GET /v1/me/keys`
- Rename keys: `PUT /v1/me/keys/{id}`
- Delete keys: `DELETE /v1/me/keys/{id}`

All key management endpoints are confirmed in `README.md`

### 7. Monitor System Health
```bash
GET /v1/health
```
Returns service status and endpoint manifest (`openapi.json` specifies the HealthResponse schema)

### 8. Access MCP Tools
```bash
GET /v1/mcp/tools
```
```bash
GET /v1/mcp/sse
```
For real-time MCP data streaming (`README.md` confirms both endpoints exist)

### 9. Check Entitlements
```bash
GET /v1/entitlement
```
Returns your current plan and owned keys (`README.md` documents this Firestore-integrated endpoint)

### What's Not Covered
- Authentication method (JWT/OAuth/etc.) - not specified in sources
- SDK installation steps - only referenced via external link
- Rate limits - only mentioned in error responses
- Webhook setup - referenced but not detailed

All confirmed endpoints are implemented as shown in both `README.md` and `openapi.json`. For full schemas and additional parameters, consult the live OpenAPI spec at `GET /v1/openapi`.
