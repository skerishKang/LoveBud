# LoveBud Scout Live Provider Readiness Audit

## Baseline

## Endpoint Live Error Readiness Audit (slice update)

- endpoint error readiness audit added (`docs/product/lovebud-scout-live-endpoint-error-readiness-audit.md`)
- error taxonomy, safe-fail wiring, DI, and observability are aligned
- runtime Firebase / KV / provider API work remains blocked
- runtime dependency adapter skeleton (mock-disabled, no external calls) is the next recommended slice
- endpoint default remains stub
- UI default remains `local_stub`
- `tests/contracts/scout-live-endpoint-error-readiness-audit-contract.test.cjs` — focused error readiness audit

## Endpoint Live Error Taxonomy Contract (slice update)

- endpoint error taxonomy contract added (`docs/product/lovebud-scout-live-endpoint-error-taxonomy-contract.md`)
- error categories / canonical error codes / HTTP status mapping / response body shape / Retry-After policy / observability mapping / sensitive data prohibition all locked
- real Firebase / KV / provider API work remains blocked
- endpoint default remains stub
- UI default remains `local_stub`
- `tests/contracts/scout-live-endpoint-error-taxonomy-contract.test.cjs` — focused taxonomy contract

## Endpoint Live Auth/Rate-Limit Readiness Audit (slice update)

- endpoint live auth/rate-limit readiness audit added (`docs/product/lovebud-scout-live-auth-rate-limit-readiness-audit.md`)
- endpoint safe-fail wiring, DI contract, and observability contract are complete
- real Firebase / KV / provider API work remains blocked (NO-GO)
- endpoint default remains stub
- UI default remains `local_stub`
- recommended next slice: endpoint error taxonomy contract
- audit verdict: ready for endpoint error taxonomy contract; NOT ready for real Firebase/KV, `staging_live`, `production_live`, or real provider API call

## Auth/Rate-Limit Runtime Boundary Skeleton (slice update)

- auth/rate-limit runtime boundary skeleton added (functions/api/scout/live-auth-rate-limit-boundary.js)
- dependency injection seam only (verifyToken / checkRateLimit injected via context)
- no Firebase Admin SDK import / no Firebase token verification
- no KV / Durable Object / D1 runtime storage call
- no real provider API call
- endpoint default remains stub
- frontend default remains local_stub
- staging_live and production_live remain blocked

- `functions/api/scout/live-auth-rate-limit-boundary.js` — runtime boundary skeleton + DI seam + safe-fail defaults
- `tests/contracts/scout-live-auth-rate-limit-runtime-boundary-contract.test.cjs` — 28 sub-tests covering DI, safe defaults, no SDK / no storage / no fetch
- `verifyScoutLiveAuthBoundary` / `checkScoutLiveRateLimitBoundary` wrappers expose injected `verifyToken` / `checkRateLimit`


- **current main HEAD**: `6afb0aa5`
- **related issue**: #1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP)
- **Browse #1661** remains out of scope
- **open PR count**: 0
- **current live provider status**: provider-specific adapter selection boundary added; provider-specific adapter skeleton added behind disabled mode; no provider API call; staging_live and production_live remain blocked

## Audit Purpose

- 실제 provider/API key를 넣기 전에 readiness를 점검한다.
- 지금까지 구현한 boundary가 live integration을 감당할 수 있는지 본다.
- 이번 문서는 구현이 아니라 audit이다.
- default live AI usage는 여전히 금지다.

## Implemented Boundary Inventory

| Boundary | Status | Evidence |
|---|---|---|
| Manual Scout save flow | Pass | 기존 파일/테스트 |
| Local stub provider | Pass | scout-suggestion-provider |
| Draft modal suggestion button | Pass | scout-draft-ui |
| Serverless endpoint skeleton | Pass | functions/api/scout/suggest.js |
| Auth/rate-limit contract | Partial | parsing/policy only, no real Firebase/storage |
| Live config boundary | Pass | CONFIG_MISSING safe fail |
| Endpoint client | Pass | disabled by default |
| Source selector | Pass | local_stub default |
| Endpoint opt-in QA | Pass | mock fetch only |
| Prompt/response contract | Pass | docs + tests |
| Product Prompt safety note | Pass | EN/KR canonical |
| Adapter skeleton | Pass | no real call |
| Provider-specific adapter selection boundary | Pass | `functions/api/scout/provider-specific-adapter.js` (inert registry, neutral example provider) |
| Provider-specific adapter skeleton | Pass | `functions/api/scout/provider-specific-adapter.js` (disabled by default) |
| Mock executor path | Pass | network-free |
| Logging boundary | Pass | safe observability only |
| Timeout/retry boundary | Pass | mock executor only |
| Output safety filter | Pass | unsafe output → PROVIDER_ERROR |
| Secret/config/deployment checklist | Pass | docs + contract |
| Real provider adapter interface | Pass | config normalization + disabled safe-fail |
| Disabled-mode endpoint contract | Pass | endpoint live mode → PROVIDER_UNAVAILABLE/CONFIG_MISSING |
| Mock executor integration | Pass | ready_for_adapter + executor → full mock pipeline |
| Post-mock readiness audit | Pass | blocker inventory + next gate definition (PR #2259) |
| Staging rollout contract | Pass | rollout modes, kill switch, rollback, opt-in policy (PR #2261) |
| Auth/rate-limit persistence boundary | Pass | Firebase auth enforcement, persistent rate-limit storage requirements, quota policy (PR #2263) |
| Cost/quota abuse monitoring contract | Pass | cost caps, quota budget, abuse monitoring, provider failure accounting (PR #2265) |
| Secret rotation and incident runbook contract | Pass | secret storage/rotation, emergency revocation, incident response, compromise handling (PR #2267) |

## Readiness Verdict

```
Ready to plan a narrow real-provider adapter integration behind disabled live mode, but not ready for default live AI usage.
```

명확히 구분:

- **Ready for a narrow implementation slice**: Yes, with restrictions.
- **Ready for production/default live usage**: No.
- **Ready for frontend default endpoint_client**: No.

## Guardrails Confirmed

| Guardrail | Status | Evidence |
|---|---|---|
| No frontend API key | Pass | endpoint client/source selector tests |
| Default source remains local_stub | Pass | source selector tests |
| Endpoint default remains stub | Pass | endpoint tests |
| No real provider SDK import | Pass | adapter tests |
| No fetch/external source retrieval | Pass | guardrail tests |
| No auto-save | Pass | draft/save guardrails |
| CONFIG_MISSING safe fallback | Pass | live config tests |
| Response validation required | Pass | adapter validator |
| Output safety filter applied | Pass | #2248 tests |
| Logging excludes prompt/PII/secrets | Pass | #2244 tests |
| Timeout/retry bounded | Pass | #2246 tests |

## Still Not Ready / Blockers

1. **Firebase auth verification is still placeholder only** — `verifyScoutFirebaseToken()` is a TODO comment in `suggest.js`. Without real Firebase Admin SDK integration, there is no way to authenticate users or associate suggestion requests with accounts.

2. **Persistent rate-limit storage is still placeholder only** — `checkScoutRateLimit()` is a TODO comment. Without persistent storage (KV, Durable Objects, D1), rate limits cannot be enforced across requests.

3. **Real provider adapter implementation does not exist** — The adapter skeleton exists, but no real provider SDK integration, prompt execution, or response parsing is implemented. Only mock executor paths exist.

4. **Provider-specific secret management process is not implemented** — No documented process for how provider API keys will be injected, rotated, or audited in production.

5. **Staging feature-flag rollout process is not fully defined** — How `endpoint_client` or live mode is enabled in staging vs production is not documented beyond code-level flags.

6. **Abuse monitoring / operational alerting is not implemented beyond safe logging boundary** — No cost/quota controls, no usage alerts, no anomaly detection wired.

7. **Cost/quota controls are not implemented** — No spending limits, per-user request caps, or budget tracking mechanisms exist.

8. **No real-provider integration tests exist, and they must remain opt-in/network-off by default** — CI must remain network-free; any future provider test must use mock providers by default.

9. **GitGuardian false positive around safety patterns should be documented as advisory-only if recurring** — The safety filter patterns (`password-like`, `secret-like` values in detection arrays) may trigger false positives. These are safety code, not leaked secrets.

## Dependency Adapter Skeleton Status

A [dependency adapter skeleton](lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md) has been added (v20260607-1). It provides:
- A mock-disabled factory (`createScoutLiveDependencyAdapter`) returning default `verifyToken` / `checkRateLimit` / `requestId`
- Default `mockDisabled:true` so the endpoint cannot accidentally allow real traffic in skeleton mode
- No real Firebase Admin SDK, no real KV/DO/D1, no provider SDK, no fetch
- Not wired into `suggest.js` LIVE branch in this slice (wiring is a separate slice)
- Endpoint default `providerMode:"stub"` and frontend default `local_stub` preserved
- Real `verifyToken` / `checkRateLimit` / `requestId` implementations, staging_live, and production_live all remain blocked

## Dependency Adapter Endpoint Wiring Status

The dependency adapter skeleton is now wired into `functions/api/scout/suggest.js` LIVE branch (v20260607-1, wiring slice):
- `suggest.js` imports `createScoutLiveDependencyAdapter` from `live-auth-rate-limit-dependency-adapter.js`
- Wiring is **live-branch-only** (only inside `providerConfig.providerMode === "live"`)
- Default stub path and explicit stub path do NOT use the adapter
- Live mode uses the mock-disabled adapter by default (fail-closed)
- Tests can inject a real adapter via `context.liveAdapter` or `context.liveDependencies`
- Legacy direct DI (`context.verifyToken` / `context.checkRateLimit`) still works alongside the new injection
- When no real limiter is configured, the boundary's "rate-limit unavailable" safe-fail path fires (RATE_LIMIT_UNAVAILABLE / 503), preserving the existing taxonomy
- Observer safe-swallow remains
- Endpoint default `providerMode:"stub"`, frontend default `local_stub`, and endpoint client default disabled are all unchanged
- Real Firebase Admin SDK, real KV/DO/D1, provider SDK, and fetch are still NOT used
- Real `verifyToken` / `checkRateLimit` / `requestId` implementations, staging_live, and production_live all remain blocked

## Storage Adapter Skeleton Status

A [storage adapter skeleton](lovebud-scout-live-rate-limit-storage-adapter-skeleton.md) has been added (v20260607-1). It provides:
- A mock-disabled factory (`createScoutLiveRateLimitStorageAdapter`) returning default `checkQuota` / `consumeQuota` / `releaseQuota` / `sanitizePayload`
- Default `mockDisabled:true` so the endpoint cannot accidentally read or write real storage in skeleton mode
- No real KV / Durable Object / D1 / database / fetch / env storage binding access
- Storage payload sensitive data guardrails: allowlist (requestId, userKeyHash, ipHash, etc.) + denylist (token, apiKey, prompt, excerpt, sourceUrl, rawRequestBody, etc.)
- Response codes (`STORAGE_MOCK_DISABLED`, `STORAGE_NOT_IMPLEMENTED`) mappable to `RATE_LIMIT_UNAVAILABLE` at the endpoint boundary
- Not wired into `suggest.js` LIVE branch in this slice (wiring is a separate slice)
- Endpoint default `providerMode:"stub"` and frontend default `local_stub` preserved
- Real KV / Durable Object / D1 / database implementations, staging_live, and production_live all remain blocked

## Conditions for First Real Provider Slice

실제 provider를 붙이는 첫 slice의 조건:

- server/serverless only
- live mode disabled by default
- no frontend API key
- no default UI endpoint_client
- provider call behind explicit env/config
- CONFIG_MISSING remains safe fallback
- prompt builder and response validator must be used
- output safety filter must be applied
- logging must remain sanitized
- timeout/retry policy must remain bounded
- sourceUrl must not be fetched
- no auto-save

## Recommended Next Slice

```
[TECH] Add Scout real provider adapter interface behind disabled live mode
```

다만 이 slice도 실제 provider API를 호출하지 않고, provider-specific adapter interface와 config contract만 먼저 만드는 방향이 더 안전할 수 있다.

**더 안전한 대안:**

- `[TECH] Add Scout provider secret/config documentation and deployment checklist`
- `[TECH] Add Scout Firebase auth verification boundary`
- `[TECH] Add Scout rate-limit persistence boundary`
- `[PRODUCT] Define Scout live suggestion staging rollout checklist`

**실제 provider integration으로 간다면:**

```
[TECH] Add Scout real provider adapter behind disabled live mode
```

조건:
- no default live usage
- tests mock-only by default
- provider call behind explicit opt-in
- no API key committed
- CI must remain network-free

## Final Decision

```
The Scout live provider path is ready for a narrow, disabled-by-default real-provider adapter planning slice,
but not ready for default live AI usage or frontend default endpoint routing.
```

## Production Readiness Gates Audit Status

A consolidated [production readiness gates audit](lovebud-scout-live-provider-production-readiness-gates-audit.md) has been completed. It provides:
- Go/no-go matrix for first real provider adapter, staging_live, and production_live
- Endpoint default remains stub; UI default remains local_stub
- First provider-specific adapter skeleton is conditional only if disabled-by-default and no provider API call
- staging_live and production_live remain blocked
- Real provider API call remains blocked in the current slice

## Non-goals

- no real provider in this PR
- no API keys
- no provider SDK imports
- no live API call
- no external fetch
- no crawler
- no metadata extraction
- no auto-save
- no schema migration
- no #1661 Browse work

## Storage Adapter Dependency Wiring Status

The storage adapter skeleton is now wired into the live dependency adapter mock path (v20260607-1, wiring slice):
- `createScoutLiveDependencyAdapter(options?)` accepts a `storageAdapter` option
- When `storageAdapter` is not provided, the canonical mock-disabled storage adapter is used as the default
- `checkRateLimit` routes through `storageAdapter.checkQuota` with an allowlisted payload only
- Storage adapter results are mapped to dependency-adapter safe-fail codes
- Storage adapter throw is safe-swallowed
- `suggest.js` is NOT modified in this slice (wiring is dependency-internal)
- No real KV / Durable Object / D1 / database / fetch / env storage binding
- Real KV / DO / D1 / database / Firebase / provider SDK / staging / production all remain blocked

## Auth Verifier Adapter Skeleton Status

The auth verifier adapter skeleton has been added as a separate file
(`functions/api/scout/live-auth-verifier-adapter.js`, v20260607-1) ahead
of any Firebase Admin SDK integration. Status:

- A new `live-auth-verifier-adapter.js` module has been added with
  `createScoutLiveAuthVerifierAdapter(options?)` factory
- Default `mockDisabled: true` fail-closed behavior; `verifyToken` always
  returns `{ allowed: false, code: "VERIFIER_MOCK_DISABLED", userKey: null, userKeyHash: null }`
- `mockDisabled: false` mode returns `VERIFIER_NOT_IMPLEMENTED` shape
- Object.freeze applied to the returned adapter
- `sanitizeScoutLiveAuthVerifierPayload(payload, options?)` pure helper
  exported with `onProhibitedField: 'drop' | 'reject'` modes
- Allowed fields (allowlist): `requestId`, `tokenHash`,
  `authorizationScheme`, `providerMode`, `endpointPath`, `nowMs`
- Prohibited fields (denylist): `token`, `rawToken`, `authorization`,
  `authorizationHeader`, `apiKey`, `secret`, `password`, `cookie`,
  `sessionCookie`, `firebaseToken`, provider API key fields
  (`openaiApiKey`, `anthropicApiKey`, `geminiApiKey`, `groqApiKey`,
  `mistralApiKey`, `nvidiaApiKey`), `prompt`, `excerpt`, `sourceUrl`,
  `rawRequestBody`
- No Firebase Admin SDK / no `getAuth` / no `verifyIdToken` /
  no `verifyAccessToken` / no `cert` / no `initializeApp` in code
- No fetch / XMLHttpRequest / axios / external auth service URL
- No env auth binding (`env.AUTH`, `env.FIREBASE`,
  `process.env.SCOUT_*`, `import.meta.env`) access
- No KV / Durable Object / D1 / database runtime access
- No provider SDK imports (OpenAI / Anthropic / Gemini / Groq / Mistral
  / NVIDIA / Cohere / Perplexity)
- `verifyToken` result never includes raw token / authorization /
  apiKey / firebaseToken / sessionCookie
- Dependency adapter is NOT yet wired to the verifier (separate slice)
- `suggest.js` is NOT yet wired to the verifier (separate slice)
- Endpoint default `providerMode: "stub"` preserved
- Frontend source selector default `local_stub` preserved
- Frontend endpoint client default disabled preserved
- Runtime Firebase Admin SDK / real token verification /
  external auth service call: **NO** (blocked)
- `staging_live` / `production_live` rollout: **NO** (blocked)

## Auth Verifier Adapter Dependency Wiring Status

The auth verifier adapter skeleton is now wired into the live dependency
adapter mock path (v20260607-1, wiring slice):

- `live-auth-rate-limit-dependency-adapter.js` imports
  `createScoutLiveAuthVerifierAdapter` from `live-auth-verifier-adapter.js`
- `createScoutLiveDependencyAdapter(options?)` accepts a `verifierAdapter`
  option
- When `verifierAdapter` is not provided, the canonical mock-disabled
  verifier adapter
  (`createScoutLiveAuthVerifierAdapter({ mockDisabled: true })`) is used
  as the default
- `verifyToken` routes through `verifierAdapter.verifyToken` with an
  **allowlisted payload only** (no raw token / authorization header /
  API key / firebaseToken / session cookie / password / prompt /
  excerpt / sourceUrl / raw request body / provider API key fields)
- Allowed verifier payload fields (single source of truth at the dep
  adapter → verifier seam):
  - `requestId`
  - `tokenHash`
  - `authorizationScheme`
  - `providerMode`
  - `endpointPath`
  - `nowMs`
- Verifier result codes are mapped to dependency-adapter safe-fail codes:
  - `VERIFIER_MOCK_DISABLED` → `VERIFY_NOT_IMPLEMENTED`
  - `VERIFIER_NOT_IMPLEMENTED` → `VERIFY_NOT_IMPLEMENTED`
  - `VERIFIER_PAYLOAD_PROHIBITED` → `VERIFY_PAYLOAD_PROHIBITED`
  - unknown / missing code → `VERIFY_UNAVAILABLE`
- Verifier adapter throw is safe-swallowed (no throw propagation,
  returns `VERIFY_UNAVAILABLE`)
- The dependency adapter's `checkRateLimit` storage adapter wiring is
  unchanged
- The dependency adapter object remains frozen (immutable)
- `verifyToken` result still includes `userKey: null` and
  `userKeyHash: null` in mock-disabled / not-implemented mode (skeleton
  does not return real user identifiers)
- `suggest.js` is NOT modified in this slice (wiring is dependency-internal)
- New dependency-adapter response codes:
  - `VERIFY_PAYLOAD_PROHIBITED`
  - `VERIFY_UNAVAILABLE`
- No real Firebase Admin SDK, no `getAuth`, no `verifyIdToken`, no
  `verifyAccessToken`, no `cert`, no `initializeApp` in code
- No fetch / XMLHttpRequest / axios / external auth URL
- No KV / Durable Object / D1 / database / env auth binding
  (`env.AUTH`, `env.FIREBASE`, `process.env.SCOUT_*`, `import.meta.env`)
- No provider SDK imports (OpenAI / Anthropic / Gemini / Groq / Mistral
  / NVIDIA / Cohere / Perplexity)
- Real Firebase Admin SDK / real token verification / external auth
  service / `staging_live` / `production_live` / provider API all
  remain blocked

## Adapter Wiring Readiness Audit Status

The live auth/rate-limit adapter wiring has been audited as a single
coherent mock-disabled stage (v20260607-1, audit-only slice):

- A new readiness audit document has been added:
  `docs/product/lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md`
- The audit inventories and confirms:
  - auth verifier adapter skeleton (PR #2302)
  - auth verifier dependency wiring (PR #2304)
  - rate-limit storage adapter skeleton (PR #2299)
  - storage adapter dependency wiring (PR #2301)
  - dependency adapter endpoint wiring (PR #2297)
  - endpoint error taxonomy, observability, DI, safe-fail wiring
  - boundary reconcile and runtime boundary
- `mockDisabled:true` fail-closed default is confirmed consistent across
  verifier, storage, and dependency adapter
- Sensitive data (raw token / authorization / firebaseToken / API key
  / prompt / excerpt / sourceUrl / raw request body) is confirmed not
  propagated to verifier / storage / limiter / observability / response
  payloads
- No real Firebase Admin SDK, no real Firebase token verification, no
  real KV / Durable Object / D1, no real provider API, no external
  observability backend
- Endpoint default `providerMode: "stub"` preserved
- Explicit `providerMode: "stub"` path preserved
- Frontend source selector default `local_stub` preserved
- Frontend endpoint client default disabled preserved
- This audit slice is docs+tests only; no runtime code change
- Recommended next slice: `[TECH] Add Scout live auth/rate-limit
  runtime adapter implementation gate contract`
- Verdict: ready for runtime implementation gate contract: **Yes**;
  ready for real Firebase / KV / staging / production / provider API:
  **No** (all blocked)

## Runtime Adapter Implementation Gate Status

The live auth/rate-limit runtime adapter implementation gate contract
has been added as a docs+tests-only slice (v20260607-1, gate contract
slice, no runtime code change):

- A new gate contract document has been added:
  `docs/product/lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md`
- The gate locks 8 surfaces as forbidden until the gate is satisfied:
  - real Firebase Admin SDK
  - real external auth service
  - real KV / Durable Object / D1 storage
  - real external observability backend
  - real provider API call
  - `staging_live` opt-in
  - `production_live` opt-in
  - parallel `live-provider-auth-rate-limit-boundary.js` adoption
- The gate requires 11 pre-implementation evidence items to exist on
  `main` before any of the 8 surfaces can be unlocked
- The gate requires 5 ordered implementation steps
  (plan verifier → plan storage → one disabled-by-default impl →
  staging smoke → staging opt-in)
- All previous defaults are preserved:
  - endpoint default `providerMode: "stub"`
  - frontend source selector default `local_stub`
  - endpoint client default disabled
  - source selector `endpoint_client` default disabled
  - `verifierAdapter` / `storageAdapter` default mock-disabled
- The 4 runtime files remain locked by md5 normalized for LF/CRLF
  (cross-platform stable): dep-adapter `796a2aef…`, verifier
  `5a0a8534…`, storage `a4419b1e…`, suggest `deb6a6d7…`
- This gate slice is docs+tests only; no runtime code change
- Recommended next slice: `[PRODUCT] Plan Scout runtime Firebase
  auth verifier implementation` (or `[PRODUCT] Plan Scout runtime
  rate-limit storage implementation`)
- Verdict: gate contract locked: **Yes**; all 8 surfaces
  (Firebase Admin SDK / external auth / KV / DO / D1 / external
  observability / provider API / `staging_live` / `production_live`
  / parallel boundary): **No** (all blocked)
