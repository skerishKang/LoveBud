# Scout Live Auth/Rate-Limit Runtime Adapter Implementation Gate Contract

> Status: **gate contract locked (no implementation allowed yet)**
> Version: v20260607-1
> Audience: Scout live provider engineering, CTO, Document Lead,
> anyone who would propose a real runtime adapter PR.
> Scope: the conditions that **must** be satisfied before any real
> runtime adapter is wired into the live auth/rate-limit path.
> Related issues: #1882, #2308
> Predecessor slice: PR #2307 (`78b0c59f`, adapter wiring readiness
> audit)

## 1. Purpose

This document is a **gate contract** for the Scout live auth/rate-limit
runtime adapter implementation path. It exists to prevent any premature
or unauthorized introduction of:

- real Firebase Admin SDK / real Firebase token verification
- real external auth service
- real KV / Durable Object / D1 storage
- real external observability backend
- real provider API call
- `staging_live` or `production_live` opt-in
- adoption of the parallel `live-provider-auth-rate-limit-boundary.js`
  file as a runtime import

It is a **docs+tests only slice** (no runtime code change). The contract
defines what is locked, what is forbidden, what evidence is required
before any of the above can land, and the required order of future
implementation slices.

The gate contract is a precondition for any future PR that would
introduce a real runtime adapter. A PR that violates the gate must be
rejected by review, regardless of how small the change appears.

## 2. Non-goals

- No runtime behavior change
- No endpoint code change
- No real LLM provider implementation
- No live provider API call
- No provider SDK imports (OpenAI / Anthropic / Gemini / Groq /
  Mistral / NVIDIA / Cohere / Perplexity)
- No Firebase Admin SDK integration
- No real Firebase token verification
- No real external auth service
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

- main HEAD at gate time: `78b0c59f` (post PR #2307)
- last runtime code change: PR #2304 (`3ac2d940`, auth verifier
  dependency wiring)
- last test-only / docs-only change: PR #2307 (`78b0c59f`, adapter
  wiring readiness audit)
- open issues at gate time: #1882, #1661, #2234, #2281, #2308
- closed issues at gate time: #2306 (audit), #2305 (wiring),
  #2303 (skeleton), #2300 (wiring), #2298 (skeleton), #2296 (wiring),
  #2294 (skeleton), #2292 (audit), #2290 (taxonomy), #2288 (audit),
  #2286 (observability), #2284 (DI), #2282 (safe-fail), #2279 (reconcile),
  #2277 (boundary), #2275 / #2273 (selection boundary),
  #2271 (provider-specific skeleton), #2269 (production-readiness-gates
  audit), #2267 (secret incident runbook), #2265 (cost/quota/abuse),
  #2263 (auth/rate-limit persistence boundary), #2261 (staging rollout),
  #2259 (post-mock readiness audit)
- pre-existing test failure bucket: 3 editor-canvas failures (out of
  scope for this gate)

## 4. Current default state (locked by this gate)

The following defaults **must not** change without an explicit product
gate:

| Surface | Default | Lock location |
|---------|---------|---------------|
| Endpoint `providerMode` | `"stub"` | `functions/api/scout/suggest.js` (`SCOUT_SUGGEST_PROVIDER_MODES.STUB`) |
| Frontend source selector | `"local_stub"` | `js/scout/scout-suggestion-source-selector.js` |
| Endpoint client | `disabled` (opt-in) | `js/scout/scout-suggestion-endpoint-client.js` |
| Source selector `endpoint_client` row | `disabled` | `js/scout/scout-suggestion-source-selector.js` |
| `verifierAdapter` default | mock-disabled | `functions/api/scout/live-auth-rate-limit-dependency-adapter.js` |
| `storageAdapter` default | mock-disabled | `functions/api/scout/live-auth-rate-limit-dependency-adapter.js` |
| `checkRateLimit` in LIVE branch | `undefined` (RATE_LIMIT_UNAVAILABLE 503) | `functions/api/scout/suggest.js` |
| Canonical boundary file | `functions/api/scout/live-auth-rate-limit-boundary.js` | runtime import |
| Parallel boundary file | not adopted | `live-provider-auth-rate-limit-boundary.js` |

## 5. Gate scope (8 items)

The gate forbids the introduction of the following 8 items until the
gate is satisfied:

1. **Real Firebase Admin SDK** — `import 'firebase-admin'`,
   `import 'firebase-admin/app'`, `import 'firebase-admin/auth'`,
   `getAuth()`, `verifyIdToken()`, `verifyAccessToken()`, `cert()`,
   `initializeApp()`.
2. **Real external auth service** — any non-stub verifier that calls
   a third-party auth service over the network.
3. **Real KV / Durable Object / D1 storage** — `KVNamespace`,
   `DurableObjectNamespace`, `D1Database`, `env.KV`, `env.DB`,
   `env.SCOUT_KV`, `env.SCOUT_DB`, persistent rate-limit storage.
4. **Real external observability backend** — any non-stub observer
   sink that calls a third-party observability service over the
   network.
5. **Real provider API call** — any non-stub `providerMode` other than
   `"stub"`, including `openai`, `anthropic`, `gemini`, `groq`,
   `mistral`, `nvidia`, `cohere`, `perplexity`, or any other LLM
   provider.
6. **`staging_live` opt-in** — any runtime path that returns
   `providerMode: "staging_live"` or otherwise enables non-stub
   runtime in the staging environment.
7. **`production_live` opt-in** — any runtime path that returns
   `providerMode: "production_live"` or otherwise enables non-stub
   runtime in the production environment.
8. **Parallel boundary file adoption** — adopting
   `live-provider-auth-rate-limit-boundary.js` as a runtime import.

## 6. Gate rule

Any future PR that would introduce a gate-scope item **must**:

1. Cite this gate contract by file path and version.
2. Update gate status only for the specific surface it touches
   (not all 8). The PR description must list which gate item is
   being unlocked and which 7 remain locked.
3. Add focused unit + integration tests for that surface only.
4. Preserve endpoint default `providerMode: "stub"`, frontend default
   `local_stub`, and endpoint client default disabled unless an
   explicit product gate allows otherwise.
5. Pass `npm test` (1 contract test added per slice, total trajectory
   continues) and `npm run verify` (284/284).
6. Provide all required pre-implementation evidence (section 7).
7. Pass CTO review and a secret rotation readiness check.
8. Land as a single-surface, disabled-by-default, env-gated,
   staging-first, safe-error, no-sensitive-log, focused-test slice.

A PR that violates the gate must be rejected by review, regardless
of how small the change appears. A reviewer who is unsure must
escalate to the CTO before approving.

## 7. Required pre-implementation evidence (11 items)

The following 11 documents / artifacts must exist on `main` (or be
introduced as part of the implementation PR) before any gate-scope
item can be unlocked:

1. **Adapter wiring readiness audit** —
   `docs/product/lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md`
   (PR #2307, `78b0c59f`).
2. **Endpoint error taxonomy contract** —
   `docs/product/lovebud-scout-live-endpoint-error-taxonomy-contract.md`.
3. **Endpoint auth/rate-limit readiness audit** —
   `docs/product/lovebud-scout-live-auth-rate-limit-readiness-audit.md`.
4. **Production readiness gates audit** —
   `docs/product/lovebud-scout-live-provider-production-readiness-gates-audit.md`.
5. **Staging rollout contract** —
   `docs/product/lovebud-scout-live-provider-staging-rollout-contract.md`.
6. **Cost / quota / abuse monitoring contract** —
   `docs/product/lovebud-scout-live-provider-cost-quota-abuse-monitoring-contract.md`.
7. **Secret / config deployment checklist** —
   `docs/product/lovebud-scout-provider-secret-config-deployment-checklist.md`.
8. **Secret rotation / incident runbook** —
   `docs/product/lovebud-scout-live-provider-secret-incident-runbook-contract.md`.
9. **Rollback / kill-switch policy** — to be added as a separate
   doc slice; for now, the policy is "revert the PR" plus the
   `verifierAdapter` / `storageAdapter` / `providerMode` env
   override to fall back to mock-disabled.
10. **Observability policy** — to be added as a separate doc slice;
    for now, no observability backend; only ring-buffer observer
    in-process, with no PII / no raw token / no prompt / no
    excerpt / no sourceUrl in events.
11. **Privacy / safety payload allowlist** — defined inline in
    `live-auth-rate-limit-dependency-adapter.js` (storage) and
    `live-auth-verifier-adapter.js` (verifier). The allowlist
    enumerates `requestId`, `tokenHash`, `authorizationScheme`,
    `providerMode`, `endpointPath`, `nowMs`, and storage-specific
    safe fields. Raw `token`, `authorization`, `authorizationHeader`,
    `apiKey`, `secret`, `password`, `cookie`, `sessionCookie`,
    `firebaseToken`, prompt, excerpt, sourceUrl, rawRequestBody are
    explicitly denylisted.

## 8. Prohibited changes before gate satisfaction

The following changes are **explicitly forbidden** in any PR that
unlocks a gate-scope item, until all 11 evidence items above exist
on `main`:

- `import 'firebase-admin'` / `import 'firebase-admin/app'` /
  `import 'firebase-admin/auth'`.
- `getAuth()` / `verifyIdToken()` / `verifyAccessToken()` /
  `cert()` / `initializeApp()`.
- `KVNamespace` / `DurableObjectNamespace` / `D1Database` /
  `env.KV` / `env.DB` / `env.SCOUT_*` runtime access.
- `fetch` / `XMLHttpRequest` / `axios` / `node-fetch` / any
  external URL fetch.
- `openai` / `anthropic` / `@google/generative-ai` / `groq-sdk` /
  `@mistralai/mistralai` / `nvidia` / any LLM SDK.
- `process.env.*` / `import.meta.env.*` / `env.SCOUT_*` for live
  secret access.
- Endpoint default `providerMode` change away from `"stub"`.
- Frontend `scout-suggestion-source-selector.js` default change
  away from `local_stub`.
- Endpoint `scout-suggestion-endpoint-client.js` default change
  from disabled to enabled.
- Source selector `endpoint_client` default change to non-disabled.
- Raw token / API key / prompt / excerpt / sourceUrl /
  rawRequestBody propagation in payload, log, or response.
- Adopting `live-provider-auth-rate-limit-boundary.js` as a
  runtime import.
- Adding real secrets to `.env`, `.env.example`, GitHub Actions
  Secrets, Cloudflare Pages Secrets, or any other secret store
  without CTO approval.
- Test fixtures that contain real-looking API keys, tokens,
  cookies, or passwords. Use `TEST_FIXTURE_*_NOT_A_REAL_SECRET_*`
  patterns instead.

## 9. Allowed future implementation patterns

When a gate-scope item is unlocked, the implementation PR **must**
follow these patterns:

- **One surface per PR** — only one of the 8 gate items per PR.
- **Disabled-by-default** — the new surface is opt-in behind an
  env gate or a config flag, off by default in production.
- **Environment-gated** — the new surface is gated by
  `providerMode` and / or an env var like
  `SCOUT_RUNTIME_FIREBASE_ENABLED` (example name, to be confirmed
  in the implementation plan).
- **Staging-first** — the new surface lands in `staging_live` first
  for a minimum 1-day soak, then a 7-day soak, before any
  `production_live` opt-in is considered.
- **Safe errors only** — no internal exception messages, no stack
  traces, no SDK error echo in HTTP responses. The
  `live-auth-rate-limit-boundary.js` `mapToSafeErrorResponse`
  helper is the single source of truth.
- **No sensitive logs** — no raw token / API key / prompt /
  excerpt / sourceUrl / rawRequestBody in any log, observability
  event, or error response. The
  `live-auth-rate-limit-observability.js` sanitizer is the
  single source of truth.
- **Explicit rollback** — the PR must include a documented
  rollback / kill-switch path (env var, config flag, or revert
  commit).
- **Focused tests** — the PR must add focused unit + integration
  tests for the new surface only, mirroring the existing contract
  test pattern (≥ 20 sub-tests per new surface).
- **`providerMode: "stub"` fallback** — the runtime adapter
  must preserve `providerMode: "stub"` as the default fallback
  when the new surface is disabled or fails.

## 10. Required next implementation order

The 8 gate items must be unlocked in the following order. Each
item must be preceded by a `[PRODUCT] Plan ...` audit slice
(docs+tests only) and a `[TECH] Add ...` implementation slice
(docs+tests+runtime+disabled-by-default).

1. `[PRODUCT] Plan Scout runtime Firebase auth verifier
   implementation` — plan + audit, no real impl.
2. `[PRODUCT] Plan Scout runtime rate-limit storage
   implementation` — plan + audit, no real impl.
3. `[TECH] Add one disabled-by-default runtime adapter
   implementation` — e.g. verifier impl behind
   `providerMode: "firebase"` and env gate, off by default.
4. `[TECH] Add staging-only smoke test plan` — Cloudflare Pages
   staging deploy with `staging_live` opt-in.
5. `[TECH] Add staging_live opt-in rollout` — one-day soak →
   seven-day soak → production_live gate review.

Skipping a step or changing the order requires CTO approval.

## 11. Out of scope

- `#1661` tree-level social counts / Browse sorting.
- `#2281` Scout live auth/rate-limit endpoint safe-fail wiring
  contract (residue; superseded by later slices).
- `#2234` Scout live-provider prompt and response contract
  (separate slice; not blocked by this gate).
- `#1882` Scout link-based fan assistant MVP (parent issue;
  tracks all Scout slices).

## 12. Dependencies

- `78b0c59f` (PR #2307 — adapter wiring readiness audit) on `main`.
- `1ec55a6e` (PR #2301 — storage adapter dependency wiring).
- `ac42e0af` (PR #2302 — auth verifier adapter skeleton).
- `3ac2d940` (PR #2304 — auth verifier dependency wiring).
- All 12 wiring/boundary items in PR #2307 audit marked Done.
- All 4 runtime files locked by md5 in PR #2307 audit:
  dep-adapter `796a2aef…`, verifier `5a0a8534…`,
  storage `a4419b1e…`, suggest `deb6a6d7…`.

## 13. Acceptance

- New file:
  `docs/product/lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md`
  (this document).
- New test:
  `tests/contracts/scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.test.cjs`
  (≥ 24 sub-tests).
- 14 related docs updated with "Runtime Adapter Implementation
  Gate Status" section.
- Locked-hash md5 normalized for LF/CRLF (cross-platform stable).
- `npm test` adds 1 new passing test, total `1957 → 1958`.
- `npm run verify` 284/284.
- PR merged with squash, all CI checks green.

## 14. Go / no-go matrix

| # | Surface | Status | Notes |
|---|---------|--------|-------|
| 1 | Real Firebase Admin SDK | **No** | Gate 1; not unlocked |
| 2 | Real external auth service | **No** | Gate 2; not unlocked |
| 3 | Real KV / DO / D1 storage | **No** | Gate 3; not unlocked |
| 4 | Real external observability backend | **No** | Gate 4; not unlocked |
| 5 | Real provider API call | **No** | Gate 5; not unlocked |
| 6 | `staging_live` opt-in | **No** | Gate 6; not unlocked |
| 7 | `production_live` opt-in | **No** | Gate 7; not unlocked |
| 8 | Parallel boundary file adoption | **No** | Gate 8; not unlocked |
| 9 | Mock-disabled wiring audit | **Done** | PR #2307, `78b0c59f` |
| 10 | Endpoint error taxonomy contract | **Done** | PR #2291 |
| 11 | Endpoint auth/rate-limit readiness audit | **Done** | PR #2289 |
| 12 | Production readiness gates audit | **Done** | closed #2269 |
| 13 | Staging rollout contract | **Done** | closed #2261 |
| 14 | Cost / quota / abuse monitoring contract | **Done** | closed #2265 |
| 15 | Secret / config deployment checklist | **Done** | doc exists |
| 16 | Secret rotation / incident runbook | **Done** | closed #2267 |
| 17 | Rollback / kill-switch policy | **Partial** | inline-only; no separate doc |
| 18 | Observability policy | **Partial** | inline-only; no separate doc |
| 19 | Privacy / safety payload allowlist | **Done** | inline in dep adapter + verifier |

## 15. Remaining blockers

The following must be resolved before any gate-scope item is
unlocked:

1. Rollback / kill-switch policy as a separate doc slice
   (currently inline-only; needs a `[PRODUCT]` audit slice).
2. Observability policy as a separate doc slice (currently
   inline-only; needs a `[PRODUCT]` audit slice).
3. `[PRODUCT] Plan Scout runtime Firebase auth verifier
   implementation` slice (plan + audit, no real impl).
4. `[PRODUCT] Plan Scout runtime rate-limit storage
   implementation` slice (plan + audit, no real impl).
5. One-day staging soak drill.
6. Seven-day staging soak drill.
7. Secret rotation drill.
8. CTO approval per PR.

## 16. Locks / evidence

This gate is locked by:

- `tests/contracts/scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.test.cjs`
  (this slice).
- All 21 contract tests listed in PR #2307 audit
  `docs/product/lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md`
  section 13.

The gate contract test (this slice) verifies the **content** of
this document against the actual repository state and the locked
default behavior.

## 17. Explicit verdict

- Gate contract locked: **Yes** (this slice)
- Real Firebase Admin SDK implementation: **No** (gate 1; not unlocked)
- Real external auth service: **No** (gate 2; not unlocked)
- Real KV / DO / D1 storage: **No** (gate 3; not unlocked)
- Real external observability backend: **No** (gate 4; not unlocked)
- Real provider API call: **No** (gate 5; not unlocked)
- `staging_live` opt-in: **No** (gate 6; not unlocked)
- `production_live` opt-in: **No** (gate 7; not unlocked)
- Parallel boundary file adoption: **No** (gate 8; not unlocked)
- Recommended next slice: `[PRODUCT] Plan Scout runtime
  Firebase auth verifier implementation` (or `[PRODUCT] Plan
  Scout runtime rate-limit storage implementation`)

The mock-disabled wiring is consistent, fail-closed, and free of
external runtime access. The gate contract is now locked. The
next prerequisite is a `[PRODUCT] Plan` slice, not a real
implementation PR.

## Firebase Auth Verifier Implementation Plan Status

The runtime Firebase auth verifier implementation plan/audit has been
added as a docs+tests-only slice (v20260607-1, plan/audit slice, no
runtime code change, no Firebase Admin SDK import):

- A new plan document has been added:
  `docs/product/lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md`
- The plan satisfies step 1 of the runtime adapter implementation gate
  contract's required next implementation order
- The plan inventories the current mock-disabled verifier adapter,
  verifier dependency wiring, endpoint live branch wiring, error
  taxonomy, observability, secret/config policy, rollback policy, and
  privacy/safety payload policy
- The plan defines the future implementation surface for Firebase Admin
  SDK integration **without** implementing it
- The plan defines:
  - future target module (`functions/api/scout/live-auth-verifier-adapter.js`)
  - future target factory (`createScoutLiveAuthVerifierAdapter`)
  - future disabled-by-default `firebase` mode
  - future env-gated config names (example:
    `SCOUT_RUNTIME_FIREBASE_VERIFIER_ENABLED`,
    `SCOUT_RUNTIME_FIREBASE_PROJECT_ID`,
    `SCOUT_RUNTIME_FIREBASE_SERVICE_ACCOUNT_KEY`)
  - Firebase Admin SDK boundary (no global init at import time, no
    token verification at import time, no service account exposure,
    no token / service account logs)
  - token handling policy (raw Authorization header only at endpoint
    auth boundary, raw token only inside verifier call boundary, no
    raw token logs, no raw token persistence, no raw token propagation
    to storage / rate-limit / provider / observability, `tokenHash` /
    `authorizationScheme` only in safe payloads)
  - future verifier input / output contract (private rawToken
    boundary, allowed payload fields, no raw Firebase claims, no raw
    decoded token, no raw UID / email in response)
  - error mapping (`AUTH_INVALID` / `VERIFY_UNAVAILABLE` /
    `CONFIG_MISSING` / `VERIFY_PAYLOAD_PROHIBITED` /
    `VERIFY_NOT_IMPLEMENTED`)
  - required future tests (side-effect-free import, default
    mock-disabled, Firebase mode disabled unless env opt-in, no
    token logs, no service account logs, no provider API call, no
    storage call, no endpoint default live, safe error mapping,
    observer safe-swallow unchanged)
  - required future docs (gate status update, secret/config
    checklist, staging rollout plan, production readiness gates,
    incident/rotation runbook)
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
  Firebase Admin SDK import
- Recommended next slice: `[PRODUCT] Plan Scout runtime rate-limit
  storage implementation` (gate step 2), or `[PRODUCT]` audit
  slice for the rollback / kill-switch policy and observability
  policy docs
- Verdict: Firebase auth verifier implementation plan: **Yes**;
  real Firebase Admin SDK in this PR: **No**; real token
  verification in this PR: **No**; `staging_live` / `production_live`
  / provider API / external auth service / endpoint default live
  in this PR: **No** (all blocked)

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
