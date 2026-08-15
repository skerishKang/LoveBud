# Cloudflare → Neon Runtime Feasibility Audit (#4000)

## Status

**Phase:** Historical #4001 architecture forensic (Reconciled with current-main & #4004 platform authority)
**Parent:** #4000
**Historical LoveBud source baseline:** `cc6cb26854e4cc692d3109debe05b0de1ab23a89`
**Historical LoveTree comparison baseline:** `06dfb7e52a3c5a96d309142bbeb06a3445a18f96`
**Current main reference:** `600b92c60cad039de93a0b3b90f8d93860454d85`
**Audit branch:** `docs/4000-cloudflare-neon-runtime-audit`
**Subsequent authoritative decisions:** #4004 (Shared Platform / Auth Authority), #4003 (Direct-Neon Browse Query Core Isolation — Merged PR #4012 / Prototype Draft PR #4045)

### Reconciliation & Current Platform Context (Post-#4004 / #4003 / #4045)

This document preserves the original technical forensics conducted under #4001 while recording subsequent authoritative platform decisions:

1. **Direct-Neon Read Feasibility & Foundation:** The historical recommendation to prototype a direct Neon Serverless HTTP Browse transport (`GO_NEON_SERVERLESS_READ_PROTOTYPE`) had its foundation query core isolated and merged in PR #4012 (Issue #4003), followed by an experimental transport prototype attached in downstream lane #4003 / Draft PR #4045 (source-prototyped and source+CI validated, while live runtime parity, latency, CPU, and query-count evidence remain pending).
2. **Platform & Backend Authority Supersession:** The original cross-repository verdict `BOUNDED_INTEROPERABILITY_REQUIRED` reflected the state prior to platform convergence. It is **superseded by Issue #4004**, which established that LoveBud and LoveTree share a unified platform, auth, and database authority rather than running dual independent writable backends.
3. **Data Authority:** The LoveBud database lineage (`133-relovetree` with 36 users, 45 Trees, 287 Memories) is the candidate canonical production data authority, whereas `lovetree-limone` (7 Trees, 4 Memories, no `public.users` table) provides Cloudflare-native architectural references to be selectively converged.

---

This audit evaluates whether LoveBud general request/response backend work should move from:

```text
browser
→ Cloudflare Pages / Pages Functions
→ Modal FastAPI
→ Neon PostgreSQL
```

toward:

```text
browser
→ Cloudflare Pages / Workers
→ direct Neon access
→ Neon PostgreSQL
```

Modal is not proposed for deletion. The target role is to retain Modal for workloads that actually justify a specialized compute runtime, such as AI/model inference, GPU work, large batch jobs, Python-heavy processing, or long-running asynchronous work.

No Production route, database, secret, Cloudflare configuration, Firebase configuration, Modal configuration, or LoveTree code is mutated by this audit.

---

## 1. Executive finding

A direct Cloudflare → Neon backend is technically feasible for LoveBud, and the strongest evidence is not hypothetical: the sibling `skerishKang/lovetree-limone` repository already runs the same broad pattern on Cloudflare with:

```text
Cloudflare runtime
→ @neondatabase/serverless
→ Drizzle neon-http
→ Neon PostgreSQL
```

and implements Firebase ID-token verification in Worker-compatible Web Crypto.

However, that sibling runtime also creates the main architecture constraint: LoveTree already has an active Auth/API/DB implementation and canonical schema. Therefore #4000 must not simply make LoveBud a second independently writable backend and later point LoveTree at it. Backend-authority convergence requires a separate domain/schema decision.

For the first LoveBud implementation slice, the lowest-risk option is **Neon Serverless Driver over HTTP for one read-only Browse parity prototype**. Hyperdrive remains a serious candidate for later phases, especially if interactive/session-style PostgreSQL transactions or global connection pooling become the dominant requirement, but it adds a new Cloudflare resource/configuration and has default read-query caching semantics that require deliberate disabling on freshness/security-sensitive paths.

### Audit verdicts & current supersession status

```text
[HISTORICAL VERDICT — SOURCE-PROTOTYPED IN #4003 / #4045 (RUNTIME EVIDENCE PENDING)]
GO_NEON_SERVERLESS_READ_PROTOTYPE

[HISTORICAL VERDICT — SUPERSEDED BY #4004 PLATFORM AUTHORITY]
BOUNDED_INTEROPERABILITY_REQUIRED
```

- `GO_NEON_SERVERLESS_READ_PROTOTYPE`: Preserved as the historical recommendation to prototype direct Neon access for read-only Browse. This was subsequently source-prototyped and source+CI validated in downstream lane #4003 / Draft PR #4045, with live runtime parity, latency, CPU, and query-count evidence pending.
- `BOUNDED_INTEROPERABILITY_REQUIRED`: Preserved as the historical baseline verdict preventing cross-repository dual writes before platform governance was established. This verdict has been **superseded by Issue #4004**, which selected a unified platform backend and authentication authority for LoveBud and LoveTree.

---

## 2. Current LoveBud runtime boundary

### 2.1 Cloudflare is already an application gateway

At the baseline SHA, `functions/api/[[path]].js` does substantially more than static forwarding. It owns or participates in:

- same-origin `/api/*` routing;
- request-ID creation/normalization;
- write-body size enforcement;
- selected authorization-presence guards;
- route-to-Modal mapping;
- 25-second Modal timeout handling;
- bounded upstream/degraded error responses;
- Browse-summary Cache API handling;
- selected authenticated/private versus anonymous/public route decisions.

Representative mappings include:

| Same-origin route | Current upstream |
|---|---|
| `GET /api/community/trees?view=summary` | `GET /modal/browse/latest` |
| `GET /api/community/growing-trees` | `GET /modal/browse/growing` |
| `GET /api/community/memories` | `GET /modal/community/memories` |
| `GET /api/trees` | `GET /modal/private/trees` |
| `POST /api/trees` | `POST /modal/private/trees` |
| `GET /api/trees/:id` with auth | `GET /modal/private/trees/:id` |
| `GET /api/trees/:id` anonymous | `GET /modal/trees/:id` |
| `PUT /api/trees/:id` | `PUT /modal/private/trees/:id` |
| `DELETE /api/trees/:id` | `DELETE /modal/private/trees/:id` |
| `POST /api/trees/:id/fork` | `POST /modal/private/trees/:id/fork` |
| `GET /api/private/trees/:id/capability` | `GET /modal/private/trees/:id/capability` |

Memory routing is additionally factored through `functions/_shared/memory-route-proxy.js`. Tree/Memory social routes have dedicated Pages Function files under `functions/api/trees/...` and related directories rather than relying exclusively on the catch-all.

### 2.2 Modal is currently the general backend runtime

`modal_compute/app.py` exposes the primary FastAPI application. Current responsibilities include:

- Browse latest/growing reads;
- public Tree and Memory reads;
- owner Tree and Memory reads;
- Tree and Memory CRUD;
- fork;
- comments;
- likes;
- reactions;
- public view recording;
- appreciation ordering;
- hub layout;
- public social-read boundaries;
- Firebase authentication;
- Plus/private-storage entitlement checks;
- input validation and normalization;
- PostgreSQL calls and error translation.

Current Modal runtime allocation:

```python
cpu=0.25
memory=512
scaledown_window=300
min_containers=1
```

`min_containers=1` means the general backend is intentionally kept warm. That is a valid latency choice, but it also means Modal is acting as a continuously available application server rather than only burst/specialized compute.

### 2.3 Neon is the current canonical LoveBud database

`modal_compute/db.py` connects through psycopg/psycopg_pool and currently defines:

```text
pool min_size             1
pool max_size             4
pool max_idle             300s
DB connect timeout        10s
DB statement timeout      20s
pool acquire timeout      15s
private-read retry count  3
```

Operational connection failures reset the pool and retry. The migration must preserve the semantics that matter, not mechanically reproduce a long-lived Python pool in a Worker environment.

---

## 3. Route/workload migration classification

The exact implementation surface is broader than a single proxy. The migration should be ordered by consistency requirements.

| Surface | Current Modal responsibility | Workload class | First-wave candidate? | Primary blocker/risk |
|---|---|---|---|---|
| Browse summary | aggregate public Tree read | multi-read/aggregate read | **Yes** | response parity + cache semantics |
| Growing Browse | aggregate public Tree read | multi-read/aggregate read | After summary | semantic parity |
| Public Tree detail | Tree + social-count reads | fresh authorization/visibility-sensitive read | Later | revocation/no-stale contract |
| Public Memory detail/list | public membership/visibility reads | fresh policy-sensitive read | Later | parent/child visibility |
| Owner Tree list/detail | Firebase auth + owner read | authenticated read | Later | Worker auth parity |
| Owner Memory list/detail | Firebase auth + owner read | authenticated read | Later | auth + ownership parity |
| Tree create/update/delete | owner writes | writes | No | transactions/read-after-write/idempotency |
| Memory create/update/delete | owner writes | writes | No | explicit rollback/source-ack contracts |
| Fork | multi-row owner write | transactional write | No | atomicity + visibility |
| Likes/reactions/comments | auth + idempotent social writes | concurrency-sensitive write | No | idempotency + visibility serialization |
| Views | public social write | concurrency-sensitive write | No | dedupe/count semantics |
| Appreciation order | owner write | write | No | ordering authority |
| Hub layout | owner write | revision/concurrency write | No | serialized revision contract |
| Scout/provider work | provider/AI boundary | specialized compute candidate | **Keep separate** | provider/rate-limit/runtime design |

Recent LoveBud security/concurrency work reinforces this ordering. Current main includes explicit transaction rollback for Memory source acknowledgement, serialized Moment social writes with visibility revocation, scoped private caches, and serialized hub-layout revisions. A runtime migration that starts with these writes would expand risk unnecessarily.

---

## 4. Browse summary is the correct first parity target

`fetch_latest_public_tree_snapshots()` is not a trivial `SELECT *` endpoint. The modern path performs:

- public Tree filtering;
- public Memory count aggregation;
- quality eligibility (`>= 3` public Memories);
- emotion-tag aggregation;
- social-count join;
- representative visual Memory selection via lateral query;
- `latest` / `popular` / `likes` / `views` ordering;
- schema-capability detection and legacy fallback.

This makes Browse useful for a parity test because it exercises real database behavior while avoiding owner authentication and write safety.

The first prototype must preserve the current external `/api/community/trees?view=summary` contract and compare a candidate direct-Neon implementation against the existing Modal-backed result for the same fixture/database state.

No Production cutover should be part of the prototype PR.

---

## 5. Existing cache contracts constrain Hyperdrive use

### 5.1 Browse already has a Cloudflare response-cache path

The current catch-all uses `caches.default` for Browse summary. Cache misses call Modal; successful upstream responses can be stored with a public cache policy.

Therefore adding another database-level cache is not automatically beneficial. The direct-Neon prototype should first isolate runtime-hop savings and query behavior.

### 5.2 Public Tree detail intentionally forbids persistent response caching

`tests/contracts/public-tree-read-cache-contract.test.cjs` explicitly enforces that anonymous Tree detail:

- does not consult `caches.default`;
- does not persist the public Tree body;
- calls the current authority again on the next request;
- returns `Cache-Control: no-store`;
- cannot serve a previously-public body after visibility revocation.

This is a security/privacy contract, not a performance omission.

Recent platform privacy audits further reinforce this invariant:
- **Cloudflare Edge Browse Stale-Cache Boundary (#4051 / #4052):** Public Browse summaries cached at the Cloudflare edge must invalidate or expire within strict bounded windows so visibility revocations (making a public Tree private or deleting it) promptly take effect across anonymous readers.
- **Client/Browser Browse & Preview Cache Boundary (#4055):** Browser-side memory and preview caches must honor visibility boundaries and re-validate before presenting sensitive tree content.

Therefore, direct-Neon migration must guarantee that visibility revocation correctness never depends on stale database or edge caches.

### 5.3 Hyperdrive query caching is therefore not universally safe by default

Current Cloudflare Hyperdrive documentation states that query caching is enabled by default for eligible reads, with default settings:

```text
max_age                 60s
stale_while_revalidate  15s
```

and cached read results are not invalidated when the application writes to the origin database. Cloudflare recommends a cache-disabled Hyperdrive configuration for permissions, sessions, authentication, read-after-write, and other reads that must be fresh.

Consequences for LoveBud:

- Browse may tolerate a bounded cache policy if it matches product requirements.
- public Tree visibility/revocation reads must not use a stale Hyperdrive cache.
- owner authorization/entitlement decisions must be fresh.
- write acknowledgement/canonical rereads must be fresh.

A future Hyperdrive design would likely require either caching disabled globally for LoveBud authority reads or separate cached/fresh bindings with strict routing.

This additional policy surface is a reason not to make Hyperdrive the first prototype dependency.

---

## 6. Hyperdrive vs Neon Serverless Driver

### 6.1 Cloudflare Hyperdrive

Current official Cloudflare characteristics relevant to LoveBud:

- supports PostgreSQL and Neon;
- available on Workers Free and Paid;
- Free allowance: `100,000` database statements per day;
- recommended PostgreSQL Worker driver: `node-postgres (pg)`;
- Cloudflare's current pg example recommends a version newer than `8.16.3`;
- global/managed origin connection pooling;
- creates a new application client per Worker request while Hyperdrive maintains origin pooling;
- supports prepared statements with recommended drivers;
- operates pool connections in transaction mode;
- default read-query caching is enabled unless explicitly disabled.

LoveBud-specific integration cost:

- current `package.json` has `pg ^8.12.0`, below Cloudflare's current recommended example version;
- no current Hyperdrive binding/config exists in the repository;
- repository search found no current Hyperdrive integration;
- a Hyperdrive resource and binding would be a new external runtime dependency;
- freshness-sensitive routes require explicit cache-disabled policy.

Hyperdrive remains attractive if LoveBud later needs native `pg` compatibility, interactive transaction semantics, and centralized database connection pooling across Workers.

### 6.2 Neon Serverless Driver

Current official Neon characteristics relevant to LoveBud:

- designed for serverless/edge environments including Cloudflare Workers;
- supports PostgreSQL over HTTP or WebSockets;
- HTTP is intended for single queries and multiple queries in non-interactive transactions;
- `transaction()` supports multi-query non-interactive transactions and isolation options;
- WebSocket `Pool`/`Client` provides node-postgres-like session/interactive transaction support;
- WebSocket clients in Cloudflare Workers must be created, used, and closed within a request.

LoveBud-specific integration cost:

- requires adding `@neondatabase/serverless` (and optionally Drizzle if adopted);
- requires a Worker-side `DATABASE_URL` secret boundary;
- no additional Hyperdrive resource is needed for the first prototype;
- HTTP one-shot access fits the first Browse-read slice.

### 6.3 Strong internal evidence: LoveTree already uses the Neon Serverless pattern

At LoveTree baseline `06dfb7e52a3c5a96d309142bbeb06a3445a18f96`:

`package.json` already includes:

```text
@neondatabase/serverless ^1.1.0
drizzle-orm             0.45.2
@cloudflare/vite-plugin
@cloudflare/workers-types
wrangler
```

`db/index.ts` is:

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const sql = neon(databaseUrl);
return drizzle(sql, { schema });
```

`server/api/handler.ts` constructs the DB from `env.DATABASE_URL` inside the request handling path and routes Trees, Memories, comments, and social operations directly without a Modal hop.

This proves the runtime pattern is already viable in the owner's Cloudflare ecosystem. It does **not** prove LoveBud schema/API parity, latency superiority, or write-safety parity.

---

## 7. Firebase authentication is Worker-portable, but entitlement authority is separate

### 7.1 Current LoveBud authentication

LoveBud Modal currently verifies Firebase ID tokens by:

- requiring `Authorization: Bearer <token>`;
- obtaining Google's Firebase signing certificates;
- caching signing-key material by upstream cache policy;
- checking JWT `kid`;
- verifying RS256 signature;
- checking project audience and issuer;
- extracting UID/email;
- failing closed when verification cannot be completed.

Plus/private-storage decisions additionally query Firestore user entitlement/profile state.

### 7.2 LoveTree already implements Worker-native Firebase verification

At the LoveTree comparison baseline, `server/api/auth.ts` already performs Firebase ID-token verification in the Cloudflare-compatible runtime using Web Crypto:

- fetches Google's Secure Token JWK keys;
- imports RSA JWKs with `crypto.subtle.importKey`;
- caches keys using `Cache-Control` max-age;
- enforces `alg=RS256` and `kid`;
- verifies signature with `crypto.subtle.verify`;
- validates `aud`, `iss`, `sub`, `exp`, `iat`, and `auth_time`;
- extracts UID/email/name/picture;
- fails closed.

Therefore the basic authentication primitive does not require Modal.

### 7.3 Entitlement remains a migration decision

The LoveBud Plus/private-storage authority currently reads Firestore profile/entitlement fields. Moving token verification to Workers does not automatically decide where entitlement truth should live.

Before owner/private writes migrate, choose one explicit authority:

```text
continue Firestore entitlement reads from the Worker
OR
converge entitlement state into the canonical backend domain/database
```

Do not introduce duplicate entitlement truth.

---

## 8. Free-plan headroom

### 8.1 Owner-provided Cloudflare dashboard observations

Manual dashboard evidence supplied during the #4000 discussion:

Account, Aug 1–12:

```text
Workers requests       ~5.66K
Workers CPU time       ~69,761 ms
Workers build minutes  58 / 3,000
Observability events   0
```

LoveBud Production, recent 7 days:

```text
successful requests  ~137
errors               0
subrequests          ~129
```

LoveBud Preview:

```text
successful requests  ~10
errors               0
subrequests          ~9
```

These values remain manual screenshot evidence because this audit session does not have authenticated Cloudflare account analytics/API access.

### 8.2 Current official Workers Free limits relevant to the prototype

Current Cloudflare documentation lists:

```text
requests                    100,000/day
CPU time per HTTP request   10 ms
memory                      128 MB
external subrequests        50/request
Hyperdrive DB statements    100,000/day
```

Waiting on network operations such as database queries does not count as Worker CPU time.

### 8.3 Usage interpretation

If the observed account `5.66K` requests over Aug 1–12 were spread evenly, the arithmetic mean is roughly:

```text
472 Worker requests/day
≈ 0.47% of the 100,000/day Free request limit
```

This is **not** a daily-peak proof; the Free limit resets daily and actual per-day peak data is still required.

Observed Workers build usage:

```text
58 / 3,000 ≈ 1.9%
```

LoveBud's observed Production request count is far below the account total.

The account-wide CPU total cannot be used to infer LoveBud migration safety because it aggregates multiple deployed projects and does not provide a reliable per-LoveBud invocation distribution. The owner screenshots show no LoveBud exceeded-resource errors in the viewed period, but API-level CPU evidence remains a Phase-1 benchmark requirement.

### 8.4 Cost conclusion

Request-count and Hyperdrive-query allowances are not current blockers at observed traffic. The only Free-plan dimension that requires direct prototype evidence is **per-invocation CPU** after DB query construction, response normalization, and later auth logic move into the Worker.

Therefore Free-plan uncertainty is not a reason to block a read-only prototype.

---

## 9. Why the first prototype should use Neon Serverless HTTP

For the first read-only Browse parity slice, Neon Serverless HTTP has the narrowest change surface:

1. no Hyperdrive resource creation;
2. no Hyperdrive binding/wrangler migration needed for the first experiment;
3. no implicit Hyperdrive read-cache policy to reconcile;
4. one-shot/aggregate read is a direct fit for Neon HTTP;
5. the sibling LoveTree runtime already demonstrates the same Cloudflare + Neon Serverless family of integration;
6. response parity and CPU can be measured before deciding how writes should connect.

This is not a global driver decision.

After the route/transaction inventory is complete, write migration should compare:

```text
A. Neon HTTP non-interactive transactions
B. Neon WebSocket Pool/Client interactive transactions
C. Hyperdrive + pg with cache-disabled fresh authority reads
```

against the exact current LoveBud write semantics.

---

## 10. Proposed Phase-1 prototype contract

Create a separate small implementation child after this audit.

### Target

```text
GET /api/community/trees?view=summary
```

### Candidate direct path

```text
Pages Function / Worker
→ @neondatabase/serverless HTTP
→ canonical Neon database
→ same response contract
```

### Required constraints

- existing Production route remains Modal-backed;
- no schema migration;
- no writes;
- no Firebase auth migration in the same PR;
- no Redis/KV/DO introduction;
- no public Tree detail migration;
- no Modal configuration changes;
- same sort normalization (`latest`, `popular`, `likes`, `views`);
- same limit normalization;
- deterministic local contract tests;
- direct path must be opt-in/test-only or otherwise isolated from Production;
- compare response shape/status/headers against current Modal path;
- record Worker CPU and end-to-end latency in Preview/runtime evidence before any cutover proposal.

### Success gate

```text
response parity             PASS
security contract           PASS
Worker CPU                  acceptable
end-to-end latency          non-worse, preferably materially better
Neon query behavior         acceptable
rollback                    trivial
```

If latency is not materially better and operational complexity rises, retain Modal for the route rather than migrating for architectural aesthetics.

---

## 11. Cross-repository backend authority

### 11.1 Earlier Drive decision

The connected Google Drive source `LOVEBUD_TO_V4_PRODUCT_SPINE_INTEGRATION_MATRIX_20260808.md` records an earlier V4 integration principle:

- V4 is the final UI/UX baseline;
- LoveBud is the source of truth for product intent, behavioral rules, and product/API contracts;
- the current LoveTree backend should be reused where it already provides stable Auth/API/DB/Production capability;
- V4 should not create a second auth/runtime merely for UI integration.

That document predates #4000.

### 11.2 Historical LoveTree comparison findings

At the audit baseline, the LoveTree repository contained:

- Cloudflare runtime/tooling;
- `@neondatabase/serverless`;
- Drizzle schema and query layer;
- direct `DATABASE_URL` Worker DB construction;
- Firebase Worker-native token verification;
- Tree/Memory/comment/social routers;
- Tree and Memory persistence and visibility logic;
- current concurrency/idempotency work.

Therefore at the time of the #4001 audit, there were **two real backend implementations** with overlapping domain responsibilities:

```text
LoveBud
Cloudflare gateway → Modal → Neon

LoveTree
Cloudflare runtime → Neon Serverless/Drizzle → Neon
```

### 11.3 Historical baseline analysis at #4001

Making LoveBud a shared backend authority immediately at that time would have required deciding:

- which database/schema becomes canonical;
- whether existing LoveTree records migrate;
- how Tree/Memory field contracts converge;
- which visibility semantics win;
- how current LoveTree write concurrency/idempotency contracts map;
- whether Firebase project/identity boundaries are the same;
- whether LoveBud and LoveTree should share one physical Neon database or only one API authority;
- how deployment ownership changes without dual writes.

### Historical cross-repository verdict (Superseded)

```text
BOUNDED_INTEROPERABILITY_REQUIRED [SUPERSEDED]
```

Historical meaning at #4001:

- proceed with simplifying LoveBud's own runtime;
- use LoveTree's direct-Neon implementation as technical reference evidence;
- do not create cross-repository dual writes;
- separately decide canonical Tree/Moment backend authority before pointing LoveTree at LoveBud or vice versa.

### 11.4 Subsequent platform authority decision (#4004) and supersession

Following this audit, the owner and platform governance established Issue #4004 (`[Architecture][Platform] Shared LoveBud / LoveTree Backend and Auth Authority Decision`), which officially resolved the cross-repository authority question:

1. **One Shared Platform Backend & Auth Authority:** LoveBud and LoveTree share a single authentication and backend authority. Duplicate independently writable canonical backends are rejected.
2. **Canonical Data Lineage:** Direct inspection of active databases established the canonical lineage:
   - LoveBud `133-relovetree`: 36 users / 45 Trees / 287 Memories.
   - `lovetree-limone`: 7 Trees / 4 Memories, no `public.users` table.
   - Neither database currently contains a `neon_auth` schema.
   Therefore, LoveBud's database lineage is established as the candidate canonical production-data authority.
3. **Architectural Convergence:** LoveTree's Cloudflare-native implementation patterns (Workers, Drizzle, Neon serverless driver) will be selectively converged into the canonical platform rather than maintaining two competing backends.
4. **Unified Authentication:** Neon Auth is accepted as an evaluation candidate for unified authentication across both surfaces to replace Firebase Auth.
5. **Downstream Direct-Neon Prototype:** Downstream prototype work proceeded under Issue #4003 / Draft PR #4045, attaching an experimental direct-Neon Browse transport in Cloudflare Pages Functions (source-prototyped and source+CI validated, while live runtime parity, latency, CPU, and query-count evidence remain pending in that draft).

Consequently, `BOUNDED_INTEROPERABILITY_REQUIRED` is preserved only as the historical #4001 finding and is explicitly **superseded by Issue #4004**.

---

## 12. Risks and stop conditions

### STOP — write migration without transaction parity

Do not move any write that depends on explicit rollback, idempotency, revision serialization, or visibility concurrency until the Worker-side equivalent is tested.

### STOP — stale visibility/permission caching

Do not enable query/response caching for authorization, entitlement, private/public visibility, revocation, or canonical read-after-write paths without an explicit freshness contract.

### STOP — dual canonical backends

Do not allow LoveBud and LoveTree to independently mutate separate canonical Tree/Moment models while both are presented as one product backend.

### STOP — CPU evidence failure

If the direct read prototype consistently exceeds the selected Workers plan CPU limit, do not proceed on the assumption that network wait is free; profile the actual application CPU or choose the appropriate Workers plan/runtime.

### STOP — no material product benefit

If direct Cloudflare→Neon latency is not materially better and operational complexity is higher, keeping Modal on the route is an acceptable outcome.

---

## 13. Source inventory

### LoveBud baseline source

- `functions/api/[[path]].js`
- `functions/api/trees.js`
- `functions/api/memories.js`
- `functions/_shared/memory-route-proxy.js`
- `functions/api/trees/...` dedicated social routes
- `modal_compute/app.py`
- `modal_compute/auth.py`
- `modal_compute/db.py`
- `modal_compute/public_reads.py`
- `modal_compute/owner_reads.py`
- current write/social modules and regression contracts
- `tests/contracts/public-tree-read-cache-contract.test.cjs`
- `package.json`

### LoveTree comparison source

Baseline `06dfb7e52a3c5a96d309142bbeb06a3445a18f96`:

- `package.json`
- `db/index.ts`
- `db/schema.ts`
- `server/api/handler.ts`
- `server/api/auth.ts`
- `server/api/trees.ts`
- `server/api/memories.ts`
- related access/social/comment modules

### Connected Drive source

- `LOVEBUD_TO_V4_PRODUCT_SPINE_INTEGRATION_MATRIX_20260808.md`

### Current primary vendor documentation checked

Cloudflare official documentation:

- Workers platform limits
- Workers pricing
- Pages Functions pricing
- Hyperdrive overview/getting started
- Hyperdrive pricing
- Hyperdrive Neon provider guide
- Hyperdrive node-postgres guide
- Hyperdrive connection pooling
- Hyperdrive query caching

Neon official documentation:

- Neon Serverless Driver
- serverless driver HTTP/WebSocket transaction behavior
- Cloudflare Workers support

---

## 14. Final decision and reconciliation summary

### 14.1 Historical #4001 audit decisions (Aug 2026)

1. **Direct runtime prototype:**
   ```text
   GO_NEON_SERVERLESS_READ_PROTOTYPE
   ```
   *Historical reason:* The first Browse read is a one-shot/aggregate read that fits Neon HTTP, the integration has the smallest external configuration surface, it avoids Hyperdrive's default stale-query cache policy during the first experiment, and an active sibling repository already demonstrates the same Cloudflare + Neon Serverless architecture.
   *Execution status:* Source-prototyped and source+CI validated in downstream prototype lane #4003 / Draft PR #4045; live runtime parity, latency, CPU, and query-count evidence remain pending.

2. **Historical cross-repository verdict:**
   ```text
   BOUNDED_INTEROPERABILITY_REQUIRED [SUPERSEDED]
   ```
   *Historical reason:* LoveTree already had an active Cloudflare + Neon backend with its own schema, auth, and write contracts. Cross-repository dual writes were prohibited prior to platform governance.
   *Supersession status:* **Superseded by Issue #4004**.

### 14.2 Active platform authority (#4004)

```text
ONE_SHARED_PLATFORM_BACKEND_AND_AUTH_AUTHORITY
CANONICAL_DATA_LINEAGE_PRESERVATION (LoveBud 133-relovetree)
DIRECT_NEON_BROWSE_TRANSPORT_PROTOTYPE (#4003 / #4045)
```

- **Shared Platform Direction:** LoveBud and LoveTree converge on a single shared backend/data/auth authority (#4004).
- **Production Data Authority:** LoveBud database lineage (`133-relovetree`) is the candidate canonical production data authority.
- **Transitional Implementation Prototype:** Direct-Neon Browse transport is source-prototyped under #4003 / Draft PR #4045 (with query core foundation merged in PR #4012) without dual writes or premature production cutover, pending live runtime parity, latency, CPU, and query-count verification.

### 14.3 Canonical final semantics summary

```text
DIRECT_CLOUDFLARE_NEON_FEASIBILITY     = SOURCE_PROVEN
DIRECT_NEON_BROWSE_SOURCE_PROTOTYPE   = IMPLEMENTED (#4003 / PR #4012 MERGED, PR #4045 DRAFT)
LIVE_DIRECT_NEON_RUNTIME_PARITY       = PENDING (Preview/runtime benchmark pending owner action)
PRODUCTION_CUTOVER                     = NOT_AUTHORIZED
SHARED_PLATFORM_AUTHORITY              = GOVERNED_BY_#4004
MODAL                                  = RETAIN_FOR_SPECIALIZED_COMPUTE
NEON                                   = CANONICAL_RELATIONAL_PERSISTENCE
REDIS                                  = NOT_REQUIRED_BY_DEFAULT
```
