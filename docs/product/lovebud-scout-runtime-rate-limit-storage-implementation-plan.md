# Scout Runtime Rate-Limit Storage Implementation Plan

> Status: **plan/audit complete (still blocked, no real implementation)**
> Version: v20260607-1
> Audience: Scout live provider engineering, CTO, Document Lead,
> anyone who would propose a real runtime rate-limit storage
> implementation PR.
> Scope: the planned design for a future runtime rate-limit storage
> implementation slice, in accordance with the runtime adapter
> implementation gate contract.
> Related issues: #1882, #2312
> Predecessor slice: PR #2311 (`65924f61`, runtime Firebase auth
> verifier implementation plan) — gate step 1 done
> Successor slice: `[PRODUCT] Add Scout rollback / kill-switch
> policy audit` or `[PRODUCT] Add Scout runtime observability
> policy audit` (gate evidence 2 / 3), then
> `[TECH] Add one disabled-by-default runtime adapter
> implementation` (gate step 3)

## 1. Purpose

This document is a **plan / audit only** slice for a future runtime
rate-limit storage implementation. It does **not** introduce any
runtime change. It does **not** introduce KV / Durable Object / D1.
It does **not** introduce persistent quota reservation, consume, or
release.

It exists to satisfy the second ordered step of the runtime adapter
implementation gate contract (gate contract step 2 =
"plan rate-limit storage implementation"). It defines the future
implementation surface, the storage backend boundary, the storage
key policy, the storage payload policy, the future input / output
contract, the quota lifecycle policy, the error mapping, the
required tests, the required docs, the go / no-go matrix, the
remaining blockers, and the explicit verdict.

A future PR that would actually wire KV / Durable Object / D1
**must** cite this plan by file path and version, must satisfy the
gate contract, and must follow the implementation patterns defined
in the gate contract sections 5–10.

## 2. Non-goals

- No runtime behavior change
- No endpoint code change
- No real LLM provider implementation
- No live provider API call
- No provider SDK imports (OpenAI / Anthropic / Gemini / Groq /
  Mistral / NVIDIA / Cohere / Perplexity)
- No Firebase Admin SDK import (`firebase-admin`, `firebase-admin/app`,
  `firebase-admin/auth`)
- No real Firebase token verification
- No real external auth service call
- No KV / Durable Object / D1 implementation
- No `KVNamespace` / `DurableObjectNamespace` / `D1Database` /
  `env.KV` / `env.DB` / `env.SCOUT_KV` / `env.SCOUT_DB` runtime
  access
- No persistent rate-limit quota state
- No runtime quota reservation / consume / release implementation
- No external observability / logging backend integration
- No external URL fetching
- No crawler or metadata extraction
- No frontend default endpoint_client behavior change
- No source selector default change
- No backend / schema migration
- No automatic save
- No Browse #1661 work
- No production deploy
- No `.env` additions for live secrets
- No GitGuardian-flagging strings (test fixtures must use
  `TEST_FIXTURE_*_NOT_A_REAL_SECRET_*`)

## 3. Baseline commit

- main HEAD at plan time: `65924f61` (post PR #2311)
- last runtime code change: PR #2304 (`3ac2d940`, auth verifier
  dependency wiring)
- last test-only / docs-only change: PR #2311 (`65924f61`, runtime
  Firebase auth verifier implementation plan)
- open issues at plan time: #1882, #1661, #2234, #2281, #2312
- closed issues at plan time: #2310 (Firebase plan), #2308 (gate),
  #2306 (audit), #2305 (wiring), #2303 (skeleton), #2300 (wiring),
  #2298 (skeleton), #2296 (wiring), #2294 (skeleton), #2292 (audit),
  #2290 (taxonomy), #2288 (audit), #2286 (observability), #2284
  (DI), #2282 (safe-fail), #2279 (reconcile), #2277 (boundary),
  #2275 / #2273 (selection boundary), #2271 (provider-specific
  skeleton), #2269 (production-readiness-gates audit), #2267 (secret
  incident runbook), #2265 (cost/quota/abuse), #2263 (auth/rate-limit
  persistence boundary), #2261 (staging rollout), #2259 (post-mock
  readiness audit)
- pre-existing test failure bucket: 3 editor-canvas failures (out of
  scope for this plan)

## 4. Current blocked state (still blocked, no change)

The following defaults **remain** in the blocked / mock-disabled state.
This plan does not change any of them:

| Surface | State | Notes |
|---------|-------|-------|
| `live-rate-limit-storage-adapter.js` | mock-disabled skeleton | PR #2299, `3205f94e` |
| `storageAdapter` option in dep adapter | mock-disabled default | PR #2301, `1ec55a6e` |
| `live-auth-rate-limit-dependency-adapter.js` | mock-disabled default | PR #2295, #2297 |
| `live-auth-rate-limit-boundary.js` | canonical boundary file | PR #2278, #2280 |
| `live-provider-auth-rate-limit-boundary.js` | parallel file, not adopted | must not be imported |
| Runtime adapter implementation gate | gate contract locked | PR #2309, `da87d2d1` |
| Firebase auth verifier implementation plan | plan complete | PR #2311, `65924f61` |
| `live-auth-verifier-adapter.js` | mock-disabled skeleton | PR #2302, `ac42e0af` |
| `verifierAdapter` option in dep adapter | mock-disabled default | PR #2304, `3ac2d940` |
| Endpoint default `providerMode` | `"stub"` | `functions/api/scout/suggest.js` |
| Explicit `providerMode: "stub"` path | unchanged | same as above |
| Frontend source selector default | `"local_stub"` | `js/scout/scout-suggestion-source-selector.js` |
| Endpoint client default | `disabled` (opt-in) | `js/scout/scout-suggestion-endpoint-client.js` |
| Source selector `endpoint_client` row | `disabled` | same as above |
| `checkRateLimit` in LIVE branch | `undefined` (RATE_LIMIT_UNAVAILABLE 503) | `suggest.js` LIVE branch |
| Real KV / Durable Object / D1 storage | not implemented | this plan forbids it |
| Real quota reservation / consume / release | not implemented | this plan forbids it |
| `staging_live` opt-in | not adopted | this plan forbids it |
| `production_live` opt-in | not adopted | this plan forbids it |
| Provider API call | not invoked | this plan forbids it |

## 5. Gate alignment

This plan satisfies step 2 of the runtime adapter implementation gate
contract's required next implementation order:

1. `[PRODUCT] Plan Scout runtime Firebase auth verifier
   implementation` ← PR #2311, `65924f61` (gate step 1, done)
2. **`[PRODUCT] Plan Scout runtime rate-limit storage
   implementation`** ← this plan (gate step 2)
3. `[TECH] Add one disabled-by-default runtime adapter
   implementation` (gate step 3)
4. `[TECH] Add staging-only smoke test plan` (gate step 4)
5. `[TECH] Add staging_live opt-in rollout` (gate step 5)

### 5.1 Complete gate evidence (9 of 11 items)

The following gate evidence items are already on `main`:

1. Adapter wiring readiness audit (PR #2307, `78b0c59f`).
2. Endpoint error taxonomy contract.
3. Endpoint auth/rate-limit readiness audit.
4. Production readiness gates audit.
5. Staging rollout contract.
6. Cost / quota / abuse monitoring contract.
7. Secret / config deployment checklist.
8. Secret rotation / incident runbook.
9. Privacy / safety payload allowlist (inline in dep adapter +
   storage adapter + verifier).

### 5.2 Missing gate evidence (2 of 11 items)

The following gate evidence items are still missing and **must** be
added by future slices before any real rate-limit storage
implementation PR can land:

10. **Rollback / kill-switch policy** as a separate doc slice
    (currently inline-only; needs a `[PRODUCT]` audit slice).
11. **Observability policy** as a separate doc slice (currently
    inline-only; needs a `[PRODUCT]` audit slice).

### 5.3 Pre-implementation checklist (11 items, gated)

Before any real rate-limit storage implementation PR can land, all
11 gate evidence items must exist on `main`. The 2 missing items
above are the only remaining blockers in the gate evidence set.
After those 2 docs are added, all 11 gate evidence items will be
complete, and gate step 3 (one disabled-by-default runtime adapter
implementation) may begin.

## 6. Future implementation surface

The future runtime rate-limit storage implementation will land in:

- **Target module**:
  `functions/api/scout/live-rate-limit-storage-adapter.js`
  (already exists as mock-disabled skeleton from PR #2299)
- **Target factory**: `createScoutLiveRateLimitStorageAdapter(options?)`
  (already exists from PR #2299)
- **New future modes**: `kv`, `durable_object`, `d1` (new entries in
  `SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES`, distinct from
  `MOCK_DISABLED` and `NOT_IMPLEMENTED`). Exactly one mode may be
  selected per deployment.
- **Future env-gated config** (example names, to be confirmed in the
  implementation PR):
  - `SCOUT_RUNTIME_RATE_LIMIT_BACKEND` (default `""`; one of
    `"kv"`, `"durable_object"`, `"d1"`)
  - `SCOUT_RUNTIME_RATE_LIMIT_KV_BINDING` (default `""`; the
    Cloudflare Pages KV binding name, e.g. `"SCOUT_RATE_LIMIT_KV"`)
  - `SCOUT_RUNTIME_RATE_LIMIT_DO_BINDING` (default `""`; the
    Durable Object binding name)
  - `SCOUT_RUNTIME_RATE_LIMIT_D1_BINDING` (default `""`; the
    D1 binding name)
  - `SCOUT_RUNTIME_RATE_LIMIT_QUOTA_BUCKET` (default `"default"`)
  - `SCOUT_RUNTIME_RATE_LIMIT_WINDOW_SECONDS` (default `60`)
  - `SCOUT_RUNTIME_RATE_LIMIT_LIMIT_PER_WINDOW` (default `60`)
- **Disabled-by-default**: even with the env vars set, the storage
  adapter must remain mock-disabled unless the implementation PR is
  merged and the env opt-in is explicit.
- **No endpoint default change**: `SCOUT_SUGGEST_PROVIDER_MODES.STUB`
  remains the default. `providerMode: "stub"` remains the runtime
  default in `suggest.js`.
- **No source selector default change**: `local_stub` remains the
  default in `scout-suggestion-source-selector.js`.
- **No endpoint client default change**:
  `scout-suggestion-endpoint-client.js` remains opt-in / disabled by
  default.

## 7. Future storage backend boundary

The future rate-limit storage implementation PR **must** obey the
following boundary rules:

- **Future implementation PR only**: KV / Durable Object / D1 may
  only be accessed in a future slice that explicitly cites this plan
  and the runtime adapter implementation gate contract.
- **Disabled-by-default**: the new `kv` / `durable_object` / `d1`
  modes are off by default. The factory
  `createScoutLiveRateLimitStorageAdapter({ mode: 'kv' })` must not
  be called from `suggest.js` or any other runtime path without an
  explicit env opt-in.
- **No storage connection at import time**: the storage adapter must
  **not** open a KV namespace, instantiate a Durable Object, or open
  a D1 database at module import time. The connection must be lazy
  and idempotent, established only inside the `checkQuota` /
  `consumeQuota` / `releaseQuota` private boundary.
- **No quota read / write at import time**: the storage adapter must
  not read or write quota state at import time. Reads and writes
  must only occur inside the private boundary.
- **No binding / secret exposure**: the storage binding name, the
  binding object, the database id, and any related secret values
  must not be returned, logged, or echoed in any response, error,
  or observability event.
- **No raw storage key logs**: the storage adapter must not log raw
  storage keys if they include user-derived material. The key must
  be hashed before logging, or the log entry must omit the key
  entirely.
- **No global side effects at import**: the new `kv` / `durable_object`
  / `d1` modes must not register any global handlers, timers, or
  side effects when the module is imported.

## 8. Storage key policy

The following storage key policy applies to the future rate-limit
storage implementation and is the single source of truth:

- **Hash-based user-derived material**:
  - `userKeyHash` (a non-reversible hash of a stable user identifier;
    must not be a raw UID or email)
  - `ipHash` (a non-reversible hash of the client IP; must not be a
    raw IPv4 / IPv6 address)
  - `sessionKeyHash` (a non-reversible hash of a session identifier;
    must not be a raw session cookie or session id)
- **Endpoint and quota metadata**:
  - `endpointPath` (e.g. `"/api/scout/suggest"`)
  - `providerMode` (e.g. `"stub"`, `"firebase"`)
  - `quotaBucket` (e.g. `"default"`, `"scout_suggest_per_user"`)
  - `windowKey` (e.g. `"20260607-15-46"`, a window-aligned timestamp
    string)
  - `limitName` (e.g. `"scout_suggest_per_user_per_minute"`)
- **Prohibited key material**:
  - raw UID / email / phone
  - raw IPv4 / IPv6 address
  - raw token / raw authorization header / raw API key
  - raw session cookie / raw session id
  - raw provider response / raw model output
- **Stable key format** must be documented before implementation.
  The format is recommended to be
  `v1:{endpointPath}:{providerMode}:{quotaBucket}:{windowKey}:{userKeyHash}:{limitName}`,
  but the implementation PR may adjust this as long as it remains
  stable, hash-only, and versioned.

## 9. Storage payload policy

The following storage payload policy applies to the future
rate-limit storage implementation. The allowlist and denylist
below extend (but do not replace) the existing
`SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_ALLOWED_FIELDS` and
`SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_PROHIBITED_FIELDS` defined in
`functions/api/scout/live-rate-limit-storage-adapter.js`:

- **Allowed payload fields**:
  - `requestId` (string, opaque)
  - `userKeyHash` (string, non-reversible hash)
  - `ipHash` (string, non-reversible hash)
  - `sessionKeyHash` (string, non-reversible hash)
  - `endpointPath` (string)
  - `providerMode` (string)
  - `windowKey` (string)
  - `limitName` (string)
  - `nowMs` (number, current epoch ms)
  - `quotaBucket` (string)
  - `requestedUnits` (number, requested quota units)
- **Prohibited payload fields**:
  - `token`, `rawToken`, `authorization`, `authorizationHeader`
  - `apiKey`, `secret`, `password`, `cookie`, `sessionCookie`
  - `firebaseToken`
  - `openaiApiKey`, `anthropicApiKey`, `geminiApiKey`, `groqApiKey`,
    `mistralApiKey`, `nvidiaApiKey`
  - `prompt`, `excerpt`, `sourceUrl`, `rawRequestBody`
  - raw `uid`, raw `email`, raw `ip`, raw `sessionId`
  - `rawProviderResponse`, `rawModelOutput`

## 10. Future storage input contract

The future rate-limit storage implementation PR **must** accept the
following input contract:

- **Public methods**:
  - `checkQuota(payload)` — non-mutating read; returns whether the
    request is allowed, the current remaining quota, and the
    `retryAfterSeconds` hint.
  - `consumeQuota(payload)` — mutating read; reserves and consumes
    quota; returns whether the consumption succeeded, the new
    remaining quota, and the `decisionId`.
  - `releaseQuota(payload)` — mutating write; releases a previously
    reserved quota; returns whether the release succeeded, the new
    remaining quota, and a `decisionId`.
- **Private raw input boundary**: the raw `rawToken` /
  `authorizationHeader` / `apiKey` / `prompt` / `excerpt` /
  `sourceUrl` / `rawRequestBody` must never enter any storage
  method. The safe payload is constructed inside the boundary and
  does not contain raw sensitive fields.
- **Quota reservation id or decision id**: each `consumeQuota` call
  returns a `decisionId` (opaque, hash-derived). The `releaseQuota`
  call may reference a previous `decisionId` to release a specific
  reservation. The `decisionId` is **not** a session id and is
  **not** a raw user identifier.
- **`retryAfterSeconds`**: a safe integer hint for the client. Must
  not contain any user-derived material.
- **`remaining` quota if safe**: the public methods may return a
  `remaining` field as an integer, but only if it is safe (i.e. the
  integer does not leak the actual quota budget or the user's
  current position). The implementation PR must justify whether
  `remaining` is exposed.

## 11. Future storage output contract

The future rate-limit storage implementation PR **must** return the
following output contract:

- `allowed` (boolean) — whether the quota check / consume succeeded.
- `code` (string) — a stable code from
  `SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES` (mapped from the storage
  response) or from the storage-specific code constants.
- `reason` (string) — a safe reason string. Must not contain the
  raw token, the raw authorization header, the raw decoded token,
  raw Firebase claims, raw UID, raw email, raw IP, raw storage key,
  raw session id, or any other sensitive material.
- `retryAfterSeconds` (number, optional) — a safe integer hint.
- `quotaBucket` (string, optional) — the bucket that was checked
  / consumed / released. Safe to expose.
- `decisionId` (string, optional) — an opaque, hash-derived
  reservation id. Safe to expose.
- **No raw storage key** in the response.
- **No raw user identifier** in the response.
- **No raw binding name** in the response.
- **No internal exception message or stack trace** in the response.

## 12. Quota lifecycle policy

The future rate-limit storage implementation PR **must** define and
follow this quota lifecycle policy:

- **Pre-consumption validation**: before calling `consumeQuota`, the
  storage adapter (or the boundary) must validate the payload
  against the allowlist. Prohibited fields cause a safe-fail with
  `STORAGE_PAYLOAD_PROHIBITED` / `RATE_LIMIT_PAYLOAD_PROHIBITED`.
- **Reservation before provider call**: the boundary (or the
  storage adapter) must call `checkQuota` (or a reservation variant)
  before any provider API call. If the quota check fails, the
  provider call must not be made.
- **Consume after provider success**: the boundary must call
  `consumeQuota` only after a successful provider response. A
  provider failure must not consume quota.
- **Release on provider failure or validation failure**: the boundary
  must call `releaseQuota` on provider failure, validation failure,
  or timeout. A release failure must be logged as a safe
  observability event (no sensitive data) and must not crash the
  endpoint.
- **Failure accounting**: quota consumption must be idempotent.
  Repeated `consumeQuota` calls with the same `decisionId` must
  not double-charge the quota. Repeated `releaseQuota` calls with
  the same `decisionId` must be safe and idempotent.
- **Idempotency guard**: each `consumeQuota` call must use a unique
  `decisionId` (or a hash-derived equivalent). The storage backend
  must enforce idempotency on the `decisionId` to prevent
  double-charging on retries.

## 13. Error mapping

The future rate-limit storage implementation PR **must** map storage
errors to the existing endpoint error taxonomy (see
`docs/product/lovebud-scout-live-endpoint-error-taxonomy-contract.md`):

| Storage error | Mapped code | Notes |
|---------------|-------------|-------|
| Quota exceeded | `RATE_LIMITED` | safe-fail; 429 |
| Storage unavailable (KV / DO / D1 backend) | `RATE_LIMIT_UNAVAILABLE` | safe-fail; 503 |
| Config missing (binding not configured) | `CONFIG_MISSING` | safe-fail; 503 |
| Payload contains prohibited field | `RATE_LIMIT_PAYLOAD_PROHIBITED` | safe-fail; 400 (or 503 per taxonomy) |
| Reservation failure (timeout, conflict) | `RATE_LIMIT_UNAVAILABLE` | safe-fail; 503 |
| Consume failure (write timeout, conflict) | `RATE_LIMIT_STORAGE_UNAVAILABLE` | safe-fail; 503 |
| Release failure (write timeout, conflict) | observability-only safe warning | no sensitive data; no response change |
| Unknown storage error | `RATE_LIMIT_STORAGE_UNAVAILABLE` | safe-fail; 503; never echo the raw error |
| Mock-disabled default | `RATE_LIMIT_NOT_IMPLEMENTED` | safe-fail; 503 |

All mapped responses must use the safe reason strings defined in
the endpoint error taxonomy contract. No storage error message must
be echoed to the client.

## 14. Required future tests

The future rate-limit storage implementation PR **must** add the
following tests (each as a focused contract test file, mirroring
the existing pattern):

- Module import remains side-effect-free (no KV namespace open, no
  Durable Object instantiation, no D1 database open at import time).
- Default mode remains `mock_disabled` (no env opt-in).
- `kv` / `durable_object` / `d1` modes are disabled unless an
  explicit env / config opt-in is set.
- No raw token / API key / prompt / source payload in any storage
  payload (assert that the sanitizer drops prohibited fields).
- No raw user identifiers in storage keys (assert that storage keys
  contain only hash-derived fields and bucket metadata).
- Storage unavailable safe-fail (assert that KV / DO / D1 backend
  failures map to `RATE_LIMIT_UNAVAILABLE` / `RATE_LIMIT_STORAGE_UNAVAILABLE`).
- Quota exceeded maps to `RATE_LIMITED`.
- Consume / release idempotency (assert that repeated `consumeQuota`
  with the same `decisionId` does not double-charge; repeated
  `releaseQuota` with the same `decisionId` is safe).
- No provider API call from storage adapter (assert that the
  storage adapter does not call any LLM provider SDK).
- No endpoint default live (assert that
  `SCOUT_SUGGEST_PROVIDER_MODES.STUB` remains the default in
  `suggest.js`).
- Disabled-by-default assertion (assert that the factory with no
  options returns a mock-disabled adapter).
- `checkQuota` returns mock-disabled response by default.
- `consumeQuota` returns mock-disabled response by default.
- `releaseQuota` returns mock-disabled response by default.
- `sanitizePayload` rejects prohibited fields in `reject` mode.
- `sanitizePayload` drops prohibited fields in `drop` mode.
- `userKeyHash` is non-reversible (assert that the hash is a
  SHA-256-derived hex string, not a raw UID / email).
- `decisionId` is opaque (assert that the `decisionId` is a
  hash-derived string, not a raw session id).

## 15. Required future docs

The future rate-limit storage implementation PR **must** update the
following docs:

- Update the runtime adapter implementation gate contract
  (`docs/product/lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md`)
  to mark the "Real KV / Durable Object / D1 storage" gate item as
  unlocked for that specific surface.
- Update the cost / quota / abuse monitoring contract
  (`docs/product/lovebud-scout-live-provider-cost-quota-abuse-monitoring-contract.md`)
  with the new rate-limit storage cost / quota / abuse monitoring
  policy.
- Update the staging rollout plan
  (`docs/product/lovebud-scout-live-provider-staging-rollout-contract.md`)
  with the rate-limit storage staging steps.
- Update the production readiness gates audit
  (`docs/product/lovebud-scout-live-provider-production-readiness-gates-audit.md`)
  with the rate-limit storage production gates.
- Update the incident / rotation runbook
  (`docs/product/lovebud-scout-live-provider-secret-incident-runbook-contract.md`)
  with the rate-limit storage incident drill.
- Add a "Rate-limit Storage Implementation Status" section to all
  related docs that already have an "Adapter Wiring Readiness
  Audit Status" / "Runtime Adapter Implementation Gate Status" /
  "Firebase Auth Verifier Implementation Plan Status" section.
- Add or update a separate rollback / kill-switch policy doc
  (currently inline-only in the gate contract).
- Add or update a separate observability policy doc
  (currently inline-only in the gate contract).

## 16. Go / no-go matrix

| # | Surface | Status | Notes |
|---|---------|--------|-------|
| 1 | Rate-limit storage implementation plan | **Done** | this slice |
| 2 | Real KV in this PR | **No** | this PR is plan/audit only |
| 3 | Real Durable Object in this PR | **No** | this PR is plan/audit only |
| 4 | Real D1 in this PR | **No** | this PR is plan/audit only |
| 5 | Runtime quota persistence in this PR | **No** | this PR is plan/audit only |
| 6 | External auth service in this PR | **No** | this PR is plan/audit only |
| 7 | Endpoint default live in this PR | **No** | default remains `"stub"` |
| 8 | `staging_live` opt-in in this PR | **No** | blocked |
| 9 | `production_live` opt-in in this PR | **No** | blocked |
| 10 | Provider API call in this PR | **No** | blocked |
| 11 | Runtime adapter implementation gate | **Done** | PR #2309, `da87d2d1` |
| 12 | Firebase auth verifier implementation plan | **Done** | PR #2311, `65924f61` |
| 13 | Adapter wiring readiness audit | **Done** | PR #2307, `78b0c59f` |
| 14 | Endpoint error taxonomy contract | **Done** | PR #2291 |
| 15 | Endpoint auth/rate-limit readiness audit | **Done** | PR #2289 |
| 16 | Production readiness gates audit | **Done** | closed #2269 |
| 17 | Staging rollout contract | **Done** | closed #2261 |
| 18 | Cost / quota / abuse monitoring contract | **Done** | closed #2265 |
| 19 | Secret / config deployment checklist | **Done** | doc exists |
| 20 | Secret rotation / incident runbook | **Done** | closed #2267 |
| 21 | Rollback / kill-switch policy | **Partial** | inline-only; needs separate doc |
| 22 | Observability policy | **Partial** | inline-only; needs separate doc |
| 23 | Privacy / safety payload allowlist | **Done** | inline in dep adapter + storage |

## 17. Remaining blockers

The following must be resolved before any real rate-limit storage
implementation PR can land:

1. **Rollback / kill-switch policy** as a separate doc slice
   (currently inline-only; needs a `[PRODUCT]` audit slice).
2. **Observability policy** as a separate doc slice (currently
   inline-only; needs a `[PRODUCT]` audit slice).
3. **One-day staging soak drill** (after the implementation PR).
4. **Seven-day staging soak drill** (after the implementation PR).
5. **Secret rotation drill** (Cloudflare Pages KV namespace
   rotation, Durable Object migration, D1 database backup drill).
6. **CTO approval** for the implementation PR.

## 18. Locks / evidence

This plan is locked by:

- `tests/contracts/scout-runtime-rate-limit-storage-implementation-plan-contract.test.cjs`
  (this slice).
- `tests/contracts/scout-runtime-firebase-auth-verifier-implementation-plan-contract.test.cjs`
  (PR #2311).
- `tests/contracts/scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.test.cjs`
  (PR #2309).
- `tests/contracts/scout-live-auth-rate-limit-adapter-wiring-readiness-audit-contract.test.cjs`
  (PR #2307).
- All 21 prior contract tests listed in PR #2307 audit
  `docs/product/lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md`
  section 13.

The plan contract test (this slice) verifies the **content** of
this document against the actual repository state and the locked
default behavior.

## 19. Branch safety reminder

This slice was developed in strict serial branch safety mode to
avoid accidental commits to `main`:

- `git fetch origin` was run first.
- `git checkout main` was run in its own call.
- `git pull --ff-only origin main` was run next.
- `git rev-parse --short HEAD` confirmed the base SHA.
- `git status --short` confirmed a clean working tree.
- `git checkout -b product/scout-runtime-rate-limit-storage-plan`
  was run in a separate call.
- `git branch --show-current` confirmed the feature branch.
- `git status --short` and `git branch --show-current` were re-checked
  immediately before `git add` and `git commit`.

Any future slice that cites this plan must follow the same serial
branch safety pattern. A reviewer who sees a `git commit` against
`main` in a future implementation PR must reject the PR.

## 20. Explicit verdict

- Ready for rate-limit storage implementation plan: **Yes**
- Ready for real KV / Durable Object / D1 implementation in this
  PR: **No**
- Ready for runtime quota persistence in this PR: **No**
- Ready for `staging_live` opt-in in this PR: **No**
- Ready for `production_live` opt-in in this PR: **No**
- Ready for provider API call in this PR: **No**
- Ready for external auth service in this PR: **No**
- Ready for endpoint default live in this PR: **No**
- Recommended next slice: `[PRODUCT] Add Scout rollback /
  kill-switch policy audit` (gate evidence 2), or `[PRODUCT] Add
  Scout runtime observability policy audit` (gate evidence 3).
  After both are merged, gate step 3 (one disabled-by-default
  runtime adapter implementation) may begin.

The mock-disabled wiring is consistent, fail-closed, and free of
external runtime access. The plan for a future rate-limit storage
implementation is now locked. The next prerequisite is the
rollback / kill-switch policy doc and the observability policy
doc — not a real implementation PR.

## Rollback / Kill-switch Policy Audit Status

The Scout rollback / kill-switch policy audit has been added as a
docs+tests-only slice (v20260607-1, audit slice, no runtime code
change, no kill-switch implementation, no Cloudflare env/secret
change, no deployment rollback):

- A new audit document has been added:
  `docs/product/lovebud-scout-rollback-kill-switch-policy-audit.md`
- The audit satisfies gate evidence 10 of 11 in the runtime
  adapter implementation gate contract
- The audit inventories the current safe baseline (endpoint
  default `providerMode: "stub"`, explicit stub source,
  frontend default `local_stub`, endpoint client default
  disabled, `verifierAdapter` / `storageAdapter` default
  mock-disabled, `staging_live` / `production_live` blocked)
- The audit defines 8 independent kill-switch surfaces
  (Firebase auth verifier, rate-limit storage, external
  observability, provider API, endpoint live mode, endpoint
  client, `staging_live`, `production_live`) and the required
  future kill-switch controls for each
- The audit defines:
  - rollback baseline (endpoint default stub + explicit stub +
    frontend local_stub + endpoint client disabled + verifier
    and storage mock-disabled)
  - 8-scenario incident rollback decision tree (verifier
    outage / storage outage / provider API failure / external
    observability outage / quota spike / cost spike / safety
    regression / secret rotation)
  - per-surface rollback policies (secret/config rollback,
    quota/cost rollback, auth verifier rollback, rate-limit
    storage rollback, provider API rollback, observability
    rollback, staging / prod rollback)
  - privacy / safety rules during rollback (no raw token, no
    authorization header, no firebaseToken, no API key, no
    prompt / excerpt / sourceUrl / raw request body, no raw
    provider response, no raw user identifier in any log,
    error, event, or incident note)
  - disabled-by-default + env-gated + safe-fallback pattern
    for every kill-switch
  - required future tests (default mock-disabled, env opt-in
    paths, no live default, safe-fallback to stub / local_stub
    / disabled, no raw secrets or identifiers in any log /
    error / event)
  - required future docs (gate status update, incident
    runbook, secret rotation runbook, quota incident
    runbook, observability policy doc, separate observability
    policy doc — gate evidence 11 of 11)
- All previous defaults are preserved:
  - endpoint default `providerMode: "stub"`
  - frontend source selector default `local_stub`
  - endpoint client default disabled
  - source selector `endpoint_client` default disabled
  - `verifierAdapter` / `storageAdapter` default mock-disabled
  - `staging_live` / `production_live` blocked
- The 4 runtime files remain locked by md5 normalized for
  LF/CRLF (cross-platform stable): dep-adapter `796a2aef…`,
  verifier `5a0a8534…`, storage `a4419b1e…`, suggest
  `deb6a6d7…`
- This audit slice is docs+tests only; no runtime code change,
  no kill-switch implementation, no Cloudflare env/secret
  change, no deployment rollback, no provider API call, no
  Firebase Admin SDK import, no KV / Durable Object / D1
  implementation
- Recommended next slice: `[PRODUCT] Add Scout runtime
  observability policy audit` (gate evidence 11 of 11).
  After that is merged, all 11 gate evidence items will be
  complete, and gate step 3 (one disabled-by-default runtime
  adapter implementation) may begin
- Verdict: rollback / kill-switch policy audit: **Yes**; real
  kill-switch implementation in this PR: **No**; real Firebase
  Admin SDK in this PR: **No**; real KV / Durable Object / D1
  in this PR: **No**; real provider API in this PR: **No**;
  real external observability backend in this PR: **No**;
  `staging_live` / `production_live` opt-in in this PR: **No**
  (all blocked)

## Runtime Observability Policy Audit Status

The Scout runtime observability policy audit has been added as a
docs+tests-only slice (v20260607-1, audit slice, no runtime code
change, no external observability backend, no live metrics sink,
no live alerting pipeline):

- A new audit document has been added:
  `docs/product/lovebud-scout-runtime-observability-policy-audit.md`
- The audit satisfies **gate evidence 11 of 11** in the runtime
  adapter implementation gate contract
- After this audit, all 11 gate evidence items are now complete;
  gate step 3 (one disabled-by-default runtime adapter
  implementation scaffold) may begin
- The audit defines the safe event schema for all 10 observability
  surfaces (endpoint request lifecycle / auth verifier / rate-limit
  storage / provider adapter / error taxonomy / rollback /
  cost-quota / staging_live / production_live / incident
  response)
- The audit defines the allowed observability field allowlist
  (17 safe fields: requestId / providerMode / endpointPath /
  errorCode / safeStatus / latencyMs / retryAfterSeconds /
  quotaBucket / decisionId / adapterKind / mockDisabled /
  environmentLabel / severity / retryCount / maxRetries /
  timeoutMs / eventType)
- The audit defines the prohibited observability fields (raw
  token / authorization / firebaseToken / API key / secret /
  service account / prompt / excerpt / sourceUrl / raw request
  body / raw provider response / raw Firebase claims / raw
  decoded token / raw storage key / raw UID / email / raw IP /
  cookie / sessionCookie)
- The audit defines:
  - safe event schema (base / auth / rate-limit / provider /
    rollback / cost / staging / production / incident)
  - error taxonomy alignment (AUTH_REQUIRED / AUTH_INVALID /
    RATE_LIMITED / RATE_LIMIT_UNAVAILABLE /
    RATE_LIMIT_PAYLOAD_PROHIBITED /
    RATE_LIMIT_STORAGE_UNAVAILABLE / PROVIDER_UNAVAILABLE /
    CONFIG_MISSING / PROVIDER_ERROR / VALIDATION_ERROR)
  - privacy / safety policy (safe metadata only / no sensitive
    payload capture / no replay of sensitive payloads / no raw
    source material / no prompt/excerpt/sourceUrl logging / no
    token/API key/service account logging)
  - external observability backend policy (not implemented /
    disabled-by-default / environment-gated / independent
    kill-switch / fail closed or silently drop telemetry / must
    not block endpoint response / must not change endpoint
    response body / must not auto-save data)
  - alerting policy (no alerts implemented / future alerts
    sanitized fields only / alert thresholds documented before
    staging_live / alert messages no sensitive values)
  - incident observability policy (safe IDs/hashes only / no raw
    token/API key/prompt/sourceUrl in incident reports /
    sensitive logging suspected disables external backend first
    / rollback decision trace safe fields only)
  - rollback / kill-switch alignment (observability backend
    independent kill-switch / rollback events safe / kill-switch
    activation no secrets / fallback baseline stub/local_stub)
  - required future tests (observer safe-swallow / external
    backend disabled by default / external backend kill-switch
    prevents export / no sensitive fields in emitted events / no
    prompt/excerpt/sourceUrl in events / no raw token/API
    key/service account in events / endpoint response unaffected
    by observer failures / no provider API call from
    observability / no storage/auth call from observability /
    docs examples safe fake metadata only)
- All previous defaults are preserved:
  - endpoint default `providerMode: "stub"`
  - frontend source selector default `local_stub`
  - endpoint client default disabled
  - source selector `endpoint_client` default disabled
  - `verifierAdapter` / `storageAdapter` default mock-disabled
  - `staging_live` / `production_live` blocked
  - external observability backend not integrated
  - live alerting pipeline not implemented
- The 4 runtime files remain locked by md5 normalized for
  LF/CRLF (cross-platform stable): dep-adapter `796a2aef…`,
  verifier `5a0a8534…`, storage `a4419b1e…`, suggest
  `deb6a6d7…`
- This audit slice is docs+tests only; no runtime code change,
  no external observability backend integration, no live metrics
  sink, no live tracing sink, no live alerting sink, no
  Firebase Admin SDK import, no KV / Durable Object / D1
  implementation, no provider API call
- Recommended next slice: `[TECH] Add one disabled-by-default
  runtime adapter implementation scaffold` (gate step 3, still
  scaffold, not a real production live implementation)
- Verdict: runtime observability policy audit: **Yes**; gate
  evidence 11 of 11 complete after this audit: **Yes**; real
  external observability backend in this PR: **No**; real
  alerting in this PR: **No**; real Firebase Admin SDK in this
  PR: **No**; real KV / Durable Object / D1 in this PR: **No**;
  real provider API in this PR: **No**; `staging_live` /
  `production_live` opt-in in this PR: **No** (all blocked)

## Firebase Auth Verifier Disabled Scaffold Status

The first disabled-by-default runtime adapter implementation
scaffold for the Scout Firebase auth verifier has been added as a
scaffold slice (v20260607-1, scaffold slice, no real Firebase
Admin SDK, no real token verification, no endpoint default live
behavior):

- The auth verifier adapter
  (`functions/api/scout/live-auth-verifier-adapter.js`) has been
  extended with a future Firebase scaffold mode
- New mode constants: `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES`
  now includes `FIREBASE_DISABLED` and `FIREBASE_CONFIG_MISSING`
- New response code constants:
  `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES` now includes
  `VERIFIER_FIREBASE_DISABLED` and `VERIFIER_CONFIG_MISSING`
- The factory `createScoutLiveAuthVerifierAdapter(options)` now
  accepts an optional `verifierMode` option that, combined with
  `mockDisabled: false`, selects one of the Firebase scaffold
  branches
- The Firebase scaffold branches safe-fail with
  `VERIFIER_FIREBASE_DISABLED` or `VERIFIER_CONFIG_MISSING`
  without importing or calling the Firebase Admin SDK, without
  verifying any token, and without reading any env / secret
- The scaffold does **not** change the existing
  `createScoutLiveAuthVerifierAdapter({})` default behavior
  (`mockDisabled: true`, `mode: MOCK_DISABLED`,
  `code: VERIFIER_MOCK_DISABLED`)
- The scaffold does **not** change the existing
  `createScoutLiveAuthVerifierAdapter({ mockDisabled: false })`
  behavior (`mode: NOT_IMPLEMENTED`,
  `code: VERIFIER_NOT_IMPLEMENTED`)
- Module import remains side-effect-free: no Firebase init, no
  token verify, no storage call, no provider call, no env read
- No Firebase Admin SDK import (`firebase-admin`,
  `firebase-admin/app`, `firebase-admin/auth`)
- No `getAuth` / `verifyIdToken` / `verifyAccessToken` /
  `cert` / `initializeApp` call
- No fetch / XMLHttpRequest / axios
- No KV / Durable Object / D1 / database access
- No provider SDK imports (OpenAI / Anthropic / Gemini / Groq /
  Mistral / NVIDIA / Cohere / Perplexity)
- No `process.env` / `import.meta.env` / `env.SCOUT_*` /
  `env.FIREBASE_*` reads
- No raw token / authorization header / API key / firebaseToken
  in any response, log, or storage payload
- All previous defaults are preserved:
  - endpoint default `providerMode: "stub"`
  - explicit stub path (`providerMode: "stub"`) unchanged
  - frontend source selector default `local_stub`
  - endpoint client default disabled
  - source selector `endpoint_client` default disabled
  - `verifierAdapter` / `storageAdapter` default mock-disabled
  - `staging_live` / `production_live` blocked
  - dependency adapter behavior unchanged
  - `suggest.js` unchanged
- The 3 locked runtime files (dep-adapter, storage, suggest)
  remain locked by md5 normalized for LF/CRLF (cross-platform
  stable). The auth verifier adapter is intentionally modified
  in this scaffold slice (it gets the new Firebase scaffold
  code) and is therefore NOT in the lock list
- This scaffold slice is disabled-by-default and safe-fail
  only; no real Firebase Admin SDK, no real token verification,
  no real external auth service call, no real provider API call,
  no real KV / Durable Object / D1 implementation
- Recommended next slice: `[TECH] Wire disabled Firebase auth
  verifier scaffold into dependency adapter contract` or
  `[TECH] Add disabled rate-limit storage runtime scaffold`
- Verdict: Firebase auth verifier disabled scaffold: **Yes**;
  real Firebase Admin SDK in this PR: **No**; real token
  verification in this PR: **No**; real external auth service
  call in this PR: **No**; real provider API in this PR:
  **No**; real KV / Durable Object / D1 in this PR: **No**;
  `staging_live` / `production_live` opt-in in this PR: **No**
  (all blocked)

## Firebase Auth Verifier Disabled Scaffold Readiness Audit Status

A CTO review / readiness audit (v20260607-1) has been added for the
first disabled-by-default runtime adapter implementation scaffold
(Scout Firebase auth verifier). The audit is docs+tests only — no
runtime behavior change. Findings:

- The scaffold remains disabled-by-default and safe-fail only
- The scaffold is **not** a real Firebase implementation
- The scaffold does **not** import `firebase-admin`
- The scaffold does **not** perform real token verification
- The dependency adapter and `suggest.js` remain unchanged
- The endpoint default `providerMode: "stub"` is preserved
- The explicit stub path is preserved
- The frontend default `local_stub` is preserved
- The endpoint client default disabled state is preserved
- The locked runtime files remain locked by LF/CRLF-normalized
  md5 (verifier `81f80368…`, dep-adapter `796a2aef…`, storage
  `a4419b1e…`, suggest `deb6a6d7…`)
- Recommended next slice:
  `[TECH] Wire disabled Firebase auth verifier scaffold into
  dependency adapter contract`
- Verdict: CTO review / readiness audit complete: **Yes**; real
  Firebase Admin SDK: **No**; real token verification: **No**;
  `staging_live` / `production_live` opt-in: **No** (all blocked)

## Disabled Firebase Verifier Dependency Wiring Status

A subsequent slice (PR #2324) has wired the disabled Firebase auth verifier scaffold into the dependency adapter contract. It provides:
- `VERIFIER_FIREBASE_DISABLED` → `VERIFY_NOT_IMPLEMENTED` safe-fail mapping
- `VERIFIER_CONFIG_MISSING` → `VERIFY_UNAVAILABLE` safe-fail mapping
- Existing verifier mappings preserved
- Default dependency adapter `mockDisabled:true` behavior unchanged
- Dependency adapter does not auto-enable Firebase mode
- No Firebase Admin SDK / real token verification / fetch / provider SDK / env secret usage
- `suggest.js` unchanged (no Firebase scaffold wiring in this slice)
- Endpoint default remains `stub`; explicit `stub` preserved
- Frontend default remains `local_stub`; endpoint client default remains disabled

