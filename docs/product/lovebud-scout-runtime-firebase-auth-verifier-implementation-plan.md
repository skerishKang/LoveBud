# Scout Runtime Firebase Auth Verifier Implementation Plan

> Status: **plan/audit complete (still blocked, no real implementation)**
> Version: v20260607-1
> Audience: Scout live provider engineering, CTO, Document Lead,
> anyone who would propose a real Firebase auth verifier implementation
> PR.
> Scope: the planned design for a future runtime Firebase auth verifier
> implementation slice, in accordance with the runtime adapter
> implementation gate contract.
> Related issues: #1882, #2310
> Predecessor slice: PR #2309 (`da87d2d1`, runtime adapter
> implementation gate contract)
> Successor slice: `[PRODUCT] Plan Scout runtime rate-limit storage
> implementation` (or `[TECH] Add disabled-by-default Firebase auth
> verifier implementation scaffold` after all plan evidence is
> complete)

## 1. Purpose

This document is a **plan / audit only** slice for a future runtime
Firebase auth verifier implementation. It does **not** introduce any
runtime change. It does **not** introduce the Firebase Admin SDK. It
does **not** introduce real token verification.

It exists to satisfy the first ordered step of the runtime adapter
implementation gate contract (gate contract step 1 =
"plan verifier implementation"). It defines the future implementation
surface, the Firebase Admin SDK boundary, the token handling policy,
the future input/output contract, the error mapping, the required
tests, the required docs, the go / no-go matrix, the remaining
blockers, and the explicit verdict.

A future PR that would actually wire the Firebase Admin SDK **must**
cite this plan by file path and version, must satisfy the gate contract,
and must follow the implementation patterns defined in the gate
contract sections 5–10.

## 2. Non-goals

- No runtime behavior change
- No endpoint code change
- No real LLM provider implementation
- No live provider API call
- No provider SDK imports (OpenAI / Anthropic / Gemini / Groq /
  Mistral / NVIDIA / Cohere / Perplexity)
- No Firebase Admin SDK import (`firebase-admin`, `firebase-admin/app`,
  `firebase-admin/auth`)
- No real Firebase token verification (`getAuth()`,
  `verifyIdToken()`, `verifyAccessToken()`, `cert()`,
  `initializeApp()`)
- No real external auth service call
- No KV / Durable Object / D1 implementation
- No runtime persistent rate-limit storage call
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

- main HEAD at plan time: `da87d2d1` (post PR #2309)
- last runtime code change: PR #2304 (`3ac2d940`, auth verifier
  dependency wiring)
- last test-only / docs-only change: PR #2309 (`da87d2d1`, runtime
  adapter implementation gate contract)
- open issues at plan time: #1882, #1661, #2234, #2281, #2310
- closed issues at plan time: #2308 (gate), #2306 (audit), #2305
  (wiring), #2303 (skeleton), #2300 (wiring), #2298 (skeleton),
  #2296 (wiring), #2294 (skeleton), #2292 (audit), #2290 (taxonomy),
  #2288 (audit), #2286 (observability), #2284 (DI), #2282 (safe-fail),
  #2279 (reconcile), #2277 (boundary), #2275 / #2273 (selection
  boundary), #2271 (provider-specific skeleton),
  #2269 (production-readiness-gates audit), #2267 (secret incident
  runbook), #2265 (cost/quota/abuse), #2263 (auth/rate-limit
  persistence boundary), #2261 (staging rollout), #2259 (post-mock
  readiness audit)
- pre-existing test failure bucket: 3 editor-canvas failures (out of
  scope for this plan)

## 4. Current blocked state (still blocked, no change)

The following defaults **remain** in the blocked / mock-disabled state.
This plan does not change any of them:

| Surface | State | Notes |
|---------|-------|-------|
| `live-auth-verifier-adapter.js` | mock-disabled skeleton | PR #2302, `ac42e0af` |
| `verifierAdapter` option in dep adapter | mock-disabled default | PR #2304, `3ac2d940` |
| `live-auth-rate-limit-dependency-adapter.js` | mock-disabled default | PR #2295, #2297 |
| `live-auth-rate-limit-boundary.js` | canonical boundary file | PR #2278, #2280 |
| `live-provider-auth-rate-limit-boundary.js` | parallel file, not adopted | must not be imported |
| Runtime adapter implementation gate | gate contract locked | PR #2309, `da87d2d1` |
| Endpoint default `providerMode` | `"stub"` | `functions/api/scout/suggest.js` |
| Explicit `providerMode: "stub"` path | unchanged | same as above |
| Frontend source selector default | `"local_stub"` | `js/scout/scout-suggestion-source-selector.js` |
| Endpoint client default | `disabled` (opt-in) | `js/scout/scout-suggestion-endpoint-client.js` |
| Source selector `endpoint_client` row | `disabled` | same as above |
| `checkRateLimit` in LIVE branch | `undefined` (RATE_LIMIT_UNAVAILABLE 503) | `suggest.js` LIVE branch |
| Real Firebase Admin SDK | not imported | this plan forbids it |
| Real token verification | not implemented | this plan forbids it |
| `staging_live` opt-in | not adopted | this plan forbids it |
| `production_live` opt-in | not adopted | this plan forbids it |
| Provider API call | not invoked | this plan forbids it |

## 5. Gate alignment

This plan satisfies step 1 of the runtime adapter implementation gate
contract's required next implementation order:

1. **`[PRODUCT] Plan Scout runtime Firebase auth verifier
   implementation`** ← this plan (gate step 1)
2. `[PRODUCT] Plan Scout runtime rate-limit storage implementation`
   (gate step 2)
3. `[TECH] Add one disabled-by-default runtime adapter
   implementation` (gate step 3)
4. `[TECH] Add staging-only smoke test plan` (gate step 4)
5. `[TECH] Add staging_live opt-in rollout` (gate step 5)

### 5.1 Complete gate evidence (8 of 11 items)

The following gate evidence items are already on `main`:

1. Adapter wiring readiness audit (PR #2307, `78b0c59f`).
2. Endpoint error taxonomy contract.
3. Endpoint auth/rate-limit readiness audit.
4. Production readiness gates audit.
5. Staging rollout contract.
6. Cost / quota / abuse monitoring contract.
7. Secret / config deployment checklist.
8. Secret rotation / incident runbook.
9. Privacy / safety payload allowlist (inline in dep adapter + verifier).

### 5.2 Missing gate evidence (3 of 11 items)

The following gate evidence items are still missing and **must** be
added by future slices before any real Firebase auth verifier
implementation:

10. **Rollback / kill-switch policy** as a separate doc slice
    (currently inline-only; needs a `[PRODUCT]` audit slice).
11. **Observability policy** as a separate doc slice (currently
    inline-only; needs a `[PRODUCT]` audit slice).
12. **`[PRODUCT] Plan Scout runtime rate-limit storage
    implementation`** (gate step 2; this is the second
    implementation plan).

### 5.3 Pre-implementation checklist (11 items, gated)

Before any real Firebase auth verifier implementation PR can land,
all 11 gate evidence items must exist on `main`. This plan is item 1
of the 11. The other 2 missing items (rollback doc, observability
doc) must be added before the implementation PR.

## 6. Future implementation surface

The future runtime Firebase auth verifier implementation will land in:

- **Target module**: `functions/api/scout/live-auth-verifier-adapter.js`
  (already exists as mock-disabled skeleton from PR #2302)
- **Target factory**: `createScoutLiveAuthVerifierAdapter(options?)`
  (already exists from PR #2302)
- **New future mode**: `firebase` (a new entry in
  `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES`, distinct from
  `MOCK_DISABLED` and `NOT_IMPLEMENTED`)
- **Future env-gated config** (example names, to be confirmed in the
  implementation PR):
  - `SCOUT_RUNTIME_FIREBASE_VERIFIER_ENABLED` (default `false`)
  - `SCOUT_RUNTIME_FIREBASE_PROJECT_ID` (required when enabled)
  - `SCOUT_RUNTIME_FIREBASE_SERVICE_ACCOUNT_KEY` (required when
    enabled; injected via Cloudflare Pages Secrets, not `.env`)
  - `SCOUT_RUNTIME_FIREBASE_AUTH_HEADER` (default `authorization`)
- **Disabled-by-default**: even with the env vars set, the verifier
  must remain mock-disabled unless the implementation PR is merged
  and the env opt-in is explicit
- **No endpoint default change**: `SCOUT_SUGGEST_PROVIDER_MODES.STUB`
  remains the default. `providerMode: "stub"` remains the runtime
  default in `suggest.js`
- **No source selector default change**: `local_stub` remains the
  default in `scout-suggestion-source-selector.js`
- **No endpoint client default change**: `scout-suggestion-endpoint-client.js`
  remains opt-in / disabled by default

## 7. Future Firebase Admin SDK boundary

The future Firebase auth verifier implementation PR **must** obey the
following boundary rules:

- **Future implementation PR only**: the Firebase Admin SDK may only
  be imported in a future slice that explicitly cites this plan and
  the runtime adapter implementation gate contract.
- **Disabled-by-default**: the new `firebase` mode is off by default.
  The factory `createScoutLiveAuthVerifierAdapter({ mode: 'firebase' })`
  must not be called from `suggest.js` or any other runtime path
  without an explicit env opt-in.
- **No global init at import time**: the Firebase Admin SDK must
  **not** call `initializeApp()` at module import time. The
  initialization must be lazy and idempotent.
- **No token verification at import time**: `verifyIdToken`,
  `verifyAccessToken`, `getAuth`, `cert` must not be called at module
  import time. They must only be called inside the private
  `verifyToken` boundary.
- **No service account exposure**: the service account key value
  must not be returned, logged, or echoed in any response, error,
  or observability event. The factory must read the service account
  key from `env.SCOUT_RUNTIME_FIREBASE_SERVICE_ACCOUNT_KEY` (or
  equivalent) and pass it to `cert()` only inside the private
  verifier boundary.
- **No token / service account logs**: the future implementation
  must not log raw token, raw authorization header, raw decoded
  token, raw Firebase claims, raw UID, raw email, raw service
  account key, or any derivative that could be replayed.
- **No global side effects at import**: the new `firebase` mode
  must not register any global handlers, timers, or
  `initializeApp` side effects when the module is imported.

## 8. Token handling policy

The following token handling policy applies to the future Firebase
auth verifier implementation and is the single source of truth:

- **Raw Authorization header parsing** may only occur at the
  endpoint auth boundary (e.g. in `suggest.js` or
  `live-auth-rate-limit-boundary.js`).
- **Raw token** may only cross into the future verifier call
  boundary (`adapter.verifyToken(...)`). It must not be returned
  from the verifier, logged, persisted, or forwarded to the
  rate-limit / storage / provider / observability layers.
- **Raw token logs**: forbidden in any log, observability event,
  error response, or test fixture.
- **Raw token persistence**: forbidden in any storage, KV, DO, D1,
  in-memory cache, or `userKey` field of a verifier response.
- **Raw token propagation to other layers**: forbidden. The raw
  token must not be passed to `checkRateLimit`, the provider
  adapter, the observer, the observability event, or the
  storage adapter.
- **Safe payload allowlist** (already defined in
  `live-auth-verifier-adapter.js`):
  `requestId`, `tokenHash`, `authorizationScheme`,
  `providerMode`, `endpointPath`, `nowMs`.
- **Safe payload denylist** (already defined in
  `live-auth-verifier-adapter.js`):
  `token`, `rawToken`, `authorization`, `authorizationHeader`,
  `apiKey`, `secret`, `password`, `cookie`, `sessionCookie`,
  `firebaseToken`, `openaiApiKey`, `anthropicApiKey`,
  `geminiApiKey`, `groqApiKey`, `mistralApiKey`, `nvidiaApiKey`,
  `prompt`, `excerpt`, `sourceUrl`, `rawRequestBody`.
- **`userKey`**: the verifier response may set `userKeyHash`
  (a non-reversible hash) but not `userKey` (raw UID / email /
  provider-side identifier) unless the privacy policy explicitly
  allows it. The current policy is "do not set `userKey`".
- **`tokenHash`**: the verifier payload may include a non-reversible
  hash of the token (e.g. SHA-256 hex truncated to 16 chars) for
  tracing / rate-limit purposes. The hash must not be reversible
  and must not be used as a session identifier.

## 9. Future verifier input contract

The future Firebase auth verifier implementation PR **must** accept
the following input contract:

- **Private raw token boundary**: the `adapter.verifyToken(...)` call
  receives the raw token via a private field, not via the public
  safe payload. The safe payload is constructed inside the boundary
  and does not contain the raw token.
- **Safe payload fields** (mirroring
  `SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS`):
  - `requestId` (string, opaque)
  - `tokenHash` (string, non-reversible hash)
  - `authorizationScheme` (string, e.g. `"Bearer"`)
  - `providerMode` (string, e.g. `"stub"`, `"firebase"`)
  - `endpointPath` (string, e.g. `"/api/scout/suggest"`)
  - `nowMs` (number, current epoch ms)
- **Verbatim raw token**: passed to the private boundary only. Not
  part of the public safe payload. Not logged. Not forwarded.
- **Verbatim raw authorization header**: parsed at the endpoint
  boundary only. Not part of the public safe payload. Not logged.
- **Unknown fields**: dropped by `sanitizePayload` (allowlist-only).

## 10. Future verifier output contract

The future Firebase auth verifier implementation PR **must** return
the following output contract:

- `allowed` (boolean) — whether the token is valid.
- `code` (string) — a stable code from
  `SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES` (mapped from the verifier
  response) or from the verifier-specific code constants.
- `reason` (string) — a safe reason string. Must not contain the
  raw token, the raw authorization header, the raw decoded token,
  raw Firebase claims, raw UID, raw email, or raw service account
  key.
- `userKeyHash` (string, optional) — a non-reversible hash of a
  stable user identifier, for rate-limit / tracing purposes only.
  Must not be reversible.
- `userKey` (null or string, optional) — the current default is
  `null`. The privacy policy may be amended in a future slice to
  allow a non-reversible `userKey` (e.g. an opaque tenant id),
  but raw UID / email / phone must never be returned.
- **No raw Firebase claims** in the response.
- **No raw decoded token** in the response.
- **No raw service account key** in the response.
- **No internal exception message or stack trace** in the response.

## 11. Error mapping

The future Firebase auth verifier implementation PR **must** map
Firebase Admin SDK errors to the existing endpoint error taxonomy
(see `docs/product/lovebud-scout-live-endpoint-error-taxonomy-contract.md`):

| Firebase error | Mapped code | Notes |
|----------------|-------------|-------|
| Invalid token (`auth/argument-error` or `auth/invalid-id-token`) | `AUTH_INVALID` | safe-fail; safe reason string |
| Expired token (`auth/id-token-expired`) | `AUTH_INVALID` (or `AUTH_EXPIRED` if the taxonomy adds it) | safe-fail |
| Revoked token (`auth/token-revoked`) | `AUTH_INVALID` | safe-fail |
| Disabled user (`auth/user-disabled`) | `AUTH_INVALID` | safe-fail; no internal details |
| Verifier not initialized (`auth/app-not-initialized`) | `VERIFY_UNAVAILABLE` | safe-fail; 503 |
| Network / service unavailable (`auth/network-request-failed`) | `VERIFY_UNAVAILABLE` | safe-fail; 503 |
| Quota exceeded (`auth/quota-exceeded`) | `VERIFY_UNAVAILABLE` | safe-fail; 503 |
| Missing service account config | `CONFIG_MISSING` | safe-fail; logged with redacted config keys |
| Permission / IAM error | `VERIFY_UNAVAILABLE` | safe-fail; 503 |
| Unknown verifier error | `VERIFY_UNAVAILABLE` | safe-fail; 503; never echo the raw error |
| Payload contains prohibited field | `VERIFY_PAYLOAD_PROHIBITED` | safe-fail; 400 (or 503 per taxonomy) |
| Mock-disabled default | `VERIFY_NOT_IMPLEMENTED` | safe-fail; 503 |

All mapped responses must use the safe reason strings defined in
the endpoint error taxonomy contract. No Firebase error message
must be echoed to the client.

## 12. Required future tests

The future Firebase auth verifier implementation PR **must** add the
following tests (each as a focused contract test file, mirroring
the existing pattern):

- Module import remains side-effect-free (no `initializeApp` /
  `getAuth` / `cert` call at import time).
- Default mode remains `mock_disabled` (no env opt-in).
- `firebase` mode is disabled unless an explicit env / config opt-in
  is set.
- No token logs (assert that no log / observability event contains
  the raw token, raw authorization header, or raw decoded token).
- No service account logs (assert that no log / observability event
  contains the raw service account key, raw service account JSON,
  or any field that could be replayed).
- No provider API call (assert that the future Firebase verifier
  implementation does not call any LLM provider SDK).
- No storage call from verifier (assert that the future Firebase
  verifier implementation does not call `checkRateLimit`,
  `checkQuota`, `consumeQuota`, or any storage adapter).
- No endpoint default live (assert that
  `SCOUT_SUGGEST_PROVIDER_MODES.STUB` remains the default in
  `suggest.js`).
- Safe error mapping (assert that all Firebase error categories
  map to a code in the safe error taxonomy).
- Observer safe-swallow unchanged (assert that the
  `live-auth-rate-limit-observability.js` sanitizer continues to
  drop sensitive fields in the future implementation).
- Disabled-by-default assertion (assert that the factory with no
  options returns a mock-disabled adapter).
- `verifyToken` returns mock-disabled response by default.
- `sanitizePayload` rejects prohibited fields in `reject` mode.
- `sanitizePayload` drops prohibited fields in `drop` mode.
- `userKeyHash` is non-reversible (assert that the hash is a
  SHA-256-derived hex string, not a raw UID / email).
- `userKey` is `null` by default.

## 13. Required future docs

The future Firebase auth verifier implementation PR **must** update
the following docs:

- Update the runtime adapter implementation gate contract
  (`docs/product/lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md`)
  to mark the "Real Firebase Admin SDK" gate item as unlocked for
  that specific surface.
- Update the secret / config deployment checklist
  (`docs/product/lovebud-scout-provider-secret-config-deployment-checklist.md`)
  with the new Firebase-specific secret names and rotation policy.
- Update the staging rollout plan
  (`docs/product/lovebud-scout-live-provider-staging-rollout-contract.md`)
  with the Firebase verifier staging steps.
- Update the production readiness gates audit
  (`docs/product/lovebud-scout-live-provider-production-readiness-gates-audit.md`)
  with the Firebase verifier production gates.
- Update the incident / rotation runbook
  (`docs/product/lovebud-scout-live-provider-secret-incident-runbook-contract.md`)
  with the Firebase-specific rotation drill.
- Add a "Firebase Auth Verifier Implementation Status" section to
  all related docs that already have an "Adapter Wiring Readiness
  Audit Status" or "Runtime Adapter Implementation Gate Status"
  section.
- Add or update a separate rollback / kill-switch policy doc
  (currently inline-only in the gate contract).
- Add or update a separate observability policy doc
  (currently inline-only in the gate contract).

## 14. Go / no-go matrix

| # | Surface | Status | Notes |
|---|---------|--------|-------|
| 1 | Firebase auth verifier implementation plan | **Done** | this slice |
| 2 | Real Firebase Admin SDK in this PR | **No** | this PR is plan/audit only |
| 3 | Real token verification in this PR | **No** | this PR is plan/audit only |
| 4 | External auth service in this PR | **No** | this PR is plan/audit only |
| 5 | Endpoint default live in this PR | **No** | default remains `"stub"` |
| 6 | `staging_live` opt-in in this PR | **No** | blocked |
| 7 | `production_live` opt-in in this PR | **No** | blocked |
| 8 | Provider API call in this PR | **No** | blocked |
| 9 | Runtime adapter implementation gate | **Done** | PR #2309, `da87d2d1` |
| 10 | Adapter wiring readiness audit | **Done** | PR #2307, `78b0c59f` |
| 11 | Endpoint error taxonomy contract | **Done** | PR #2291 |
| 12 | Endpoint auth/rate-limit readiness audit | **Done** | PR #2289 |
| 13 | Production readiness gates audit | **Done** | closed #2269 |
| 14 | Staging rollout contract | **Done** | closed #2261 |
| 15 | Cost / quota / abuse monitoring contract | **Done** | closed #2265 |
| 16 | Secret / config deployment checklist | **Done** | doc exists |
| 17 | Secret rotation / incident runbook | **Done** | closed #2267 |
| 18 | Rollback / kill-switch policy | **Partial** | inline-only; needs separate doc |
| 19 | Observability policy | **Partial** | inline-only; needs separate doc |
| 20 | Privacy / safety payload allowlist | **Done** | inline in dep adapter + verifier |

## 15. Remaining blockers

The following must be resolved before any real Firebase auth
verifier implementation PR can land:

1. **Rollback / kill-switch policy** as a separate doc slice
   (currently inline-only; needs a `[PRODUCT]` audit slice).
2. **Observability policy** as a separate doc slice (currently
   inline-only; needs a `[PRODUCT]` audit slice).
3. **`[PRODUCT] Plan Scout runtime rate-limit storage
   implementation`** (gate step 2; this is the second
   implementation plan).
4. **One-day staging soak drill** (after the implementation PR).
5. **Seven-day staging soak drill** (after the implementation PR).
6. **Secret rotation drill** (Firebase service account key
   rotation drill).
7. **CTO approval** for the implementation PR.

## 16. Locks / evidence

This plan is locked by:

- `tests/contracts/scout-runtime-firebase-auth-verifier-implementation-plan-contract.test.cjs`
  (this slice).
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

## 17. Explicit verdict

- Ready for Firebase auth verifier implementation plan: **Yes**
- Ready for real Firebase Admin SDK implementation in this PR: **No**
- Ready for real token verification in this PR: **No**
- Ready for `staging_live` opt-in in this PR: **No**
- Ready for `production_live` opt-in in this PR: **No**
- Ready for provider API call in this PR: **No**
- Ready for external auth service in this PR: **No**
- Ready for endpoint default live in this PR: **No**
- Recommended next slice: `[PRODUCT] Plan Scout runtime
  rate-limit storage implementation` (gate step 2), or
  `[PRODUCT]` audit slice for the rollback / kill-switch policy
  and observability policy docs.

The mock-disabled wiring is consistent, fail-closed, and free of
external runtime access. The plan for a future Firebase auth
verifier implementation is now locked. The next prerequisite is
the rate-limit storage implementation plan, the rollback doc, and
the observability doc — not a real implementation PR.

## 18. Branch safety reminder

This slice was developed in strict serial branch safety mode to avoid
accidental commits to `main`:

- `git fetch origin` was run first.
- `git checkout main` was run in its own call.
- `git pull --ff-only origin main` was run next.
- `git rev-parse --short HEAD` confirmed the base SHA.
- `git status --short` confirmed a clean working tree.
- `git checkout -b product/scout-runtime-firebase-auth-verifier-plan`
  was run in a separate call.
- `git branch --show-current` confirmed the feature branch.
- `git status --short` and `git branch --show-current` were re-checked
  immediately before `git add` and `git commit`.

Any future slice that cites this plan must follow the same serial
branch safety pattern. A reviewer who sees a `git commit` against
`main` in a future implementation PR must reject the PR.

## Rate-limit Storage Implementation Plan Status

The runtime rate-limit storage implementation plan/audit has been
added as a docs+tests-only slice (v20260607-1, plan/audit slice, no
runtime code change, no KV / Durable Object / D1 implementation):

- A new plan document has been added:
  `docs/product/lovebud-scout-runtime-rate-limit-storage-implementation-plan.md`
- The plan satisfies step 2 of the runtime adapter implementation
  gate contract's required next implementation order
- The plan inventories the current mock-disabled storage adapter,
  storage dependency wiring, auth verifier plan, endpoint live
  branch wiring, error taxonomy, observability, cost/quota/abuse
  policy, rollback policy, and privacy/safety payload policy
- The plan defines the future implementation surface for KV /
  Durable Object / D1 storage **without** implementing it
- The plan defines:
  - future target module
    (`functions/api/scout/live-rate-limit-storage-adapter.js`)
  - future target factory
    (`createScoutLiveRateLimitStorageAdapter`)
  - future disabled-by-default `kv` / `durable_object` / `d1` modes
  - future env-gated config names (example:
    `SCOUT_RUNTIME_RATE_LIMIT_BACKEND`,
    `SCOUT_RUNTIME_RATE_LIMIT_KV_BINDING`,
    `SCOUT_RUNTIME_RATE_LIMIT_DO_BINDING`,
    `SCOUT_RUNTIME_RATE_LIMIT_D1_BINDING`,
    `SCOUT_RUNTIME_RATE_LIMIT_QUOTA_BUCKET`,
    `SCOUT_RUNTIME_RATE_LIMIT_WINDOW_SECONDS`,
    `SCOUT_RUNTIME_RATE_LIMIT_LIMIT_PER_WINDOW`)
  - storage backend boundary (no storage connection at import time,
    no quota read/write at import time, no binding/secret exposure,
    no raw storage key logs)
  - storage key policy (hash-based userKeyHash / ipHash /
    sessionKeyHash, endpointPath / providerMode / quotaBucket /
    windowKey / limitName, no raw UID/email/IP/token/authorization/
    API key, stable key format required)
  - storage payload policy (allowed fields, prohibited fields, no
    raw token, no authorization header, no firebaseToken, no API
    key, no prompt/excerpt/sourceUrl/raw request body, no raw
    UID/email/IP/provider response)
  - future storage input / output contract (checkQuota /
    consumeQuota / releaseQuota, decisionId, retryAfterSeconds,
    remaining quota if safe, no raw storage key, no raw user
    identifier)
  - quota lifecycle policy (pre-consumption validation, reservation
    before provider call, consume after provider success, release
    on provider failure, failure accounting, idempotency guard)
  - error mapping (RATE_LIMITED / RATE_LIMIT_UNAVAILABLE /
    RATE_LIMIT_STORAGE_UNAVAILABLE / CONFIG_MISSING /
    RATE_LIMIT_PAYLOAD_PROHIBITED / RATE_LIMIT_NOT_IMPLEMENTED)
  - required future tests (side-effect-free import, default
    mock-disabled, KV/DO/D1 modes disabled unless env opt-in, no
    raw token/API key, no raw user identifiers, storage
    unavailable safe-fail, quota exceeded maps to RATE_LIMITED,
    consume/release idempotency, no provider API call, no
    endpoint default live)
  - required future docs (gate status update, cost/quota/abuse
    monitoring contract, staging rollout plan, production
    readiness gates, incident/rotation runbook, separate
    rollback / observability policy docs)
- All previous defaults are preserved:
  - endpoint default `providerMode: "stub"`
  - frontend source selector default `local_stub`
  - endpoint client default disabled
  - source selector `endpoint_client` default disabled
  - `verifierAdapter` / `storageAdapter` default mock-disabled
- The 4 runtime files remain locked by md5 normalized for LF/CRLF
  (cross-platform stable): dep-adapter `796a2aef…`, verifier
  `5a0a8534…`, storage `a4419b1e…`, suggest `deb6a6d7…`
- This plan slice is docs+tests only; no runtime code change, no
  KV / Durable Object / D1 implementation, no runtime quota
  persistence
- Recommended next slice: `[PRODUCT] Add Scout rollback /
  kill-switch policy audit` (gate evidence 2), or `[PRODUCT] Add
  Scout runtime observability policy audit` (gate evidence 3)
- Verdict: rate-limit storage implementation plan: **Yes**; real
  KV / Durable Object / D1 in this PR: **No**; runtime quota
  persistence in this PR: **No**; `staging_live` / `production_live`
  / provider API / external auth service / endpoint default live
  in this PR: **No** (all blocked)

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
