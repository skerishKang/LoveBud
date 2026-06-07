# Scout Runtime Observability Policy Audit

> Status: **audit complete (runtime observability policy gate
> evidence 11 of 11 locked)**
> Version: v20260607-1
> Audience: Scout live provider engineering, CTO, Document Lead,
> incident response, anyone who would propose a real runtime
> adapter PR.
> Scope: runtime observability policy for any future runtime
> adapter PR (Firebase auth verifier, rate-limit storage, external
> observability backend, provider API, `staging_live`,
> `production_live`).
> Related issues: #1882, #2316
> Predecessor slice: PR #2315 (`18136318`, rollback / kill-switch
> policy audit)
> Successor slice: `[TECH] Add one disabled-by-default runtime
> adapter implementation scaffold` (gate step 3, first scaffold
> only, no production live)

## 1. Purpose

This document is an **audit / docs+tests only** slice that locks the
**runtime observability policy** for the Scout live provider path.
It does **not** introduce any runtime change. It does **not**
introduce any external observability backend. It does **not**
implement any live metrics sink, tracing sink, or alerting sink. It
does **not** call any provider API. It does **not** change any
Cloudflare env / secret. It does **not** perform any deployment
change.

It exists to satisfy gate evidence 11 of 11 in the runtime adapter
implementation gate contract. After this slice is merged, **all 11
gate evidence items will be complete**, and gate step 3 (one
disabled-by-default runtime adapter implementation) may begin.

This audit defines the current safe baseline, the observability
surfaces, the allowed observability field allowlist, the
prohibited observability fields, the safe event schema per
surface, the error taxonomy alignment, the privacy / safety
policy, the external observability backend policy, the alerting
policy, the incident observability policy, the rollback /
kill-switch alignment, the required future tests, the go / no-go
matrix, the remaining blockers, and the explicit verdict.

## 2. Non-goals

- No runtime behavior change
- No endpoint code change
- No `suggest.js` change
- No `live-auth-rate-limit-dependency-adapter.js` change
- No `live-auth-verifier-adapter.js` change
- No `live-rate-limit-storage-adapter.js` change
- No `live-auth-rate-limit-observability.js` change
- No `live-auth-rate-limit-boundary.js` change
- No actual external observability backend implementation
- No external logging / monitoring backend integration
- No metrics sink / trace sink / alert sink implementation
- No live provider API call
- No provider SDK import (OpenAI / Anthropic / Gemini / Groq /
  Mistral / NVIDIA / Cohere / Perplexity)
- No Firebase Admin SDK import (`firebase-admin`,
  `firebase-admin/app`, `firebase-admin/auth`)
- No real Firebase token verification
- No KV / Durable Object / D1 implementation
- No runtime persistent rate-limit storage call
- No actual kill-switch implementation
- No Cloudflare env / secret change
- No `wrangler secret` / `wrangler kv` / `wrangler d1` /
  `wrangler pages` deployment command
- No raw token / authorization header / `firebaseToken` / API key /
  prompt / excerpt / sourceUrl / raw request body / raw provider
  response / raw Firebase claims / raw decoded token / raw
  storage key / raw UID / email / raw IP / cookie / sessionCookie
  logging
- No external URL fetch
- No crawler or metadata extraction
- No frontend default `endpoint_client` behavior change
- No source selector default change
- No backend / schema migration
- No automatic save
- No Browse #1661 work
- No production deploy
- No `.env` additions for live secrets
- No GitGuardian-flagging strings (test fixtures must use
  `TEST_FIXTURE_*_NOT_A_REAL_SECRET_*`)

## 3. Baseline commit

- main HEAD at audit time: `18136318` (post PR #2315)
- last runtime code change: PR #2304 (`3ac2d940`, auth verifier
  dependency wiring)
- last test-only / docs-only change: PR #2315 (`18136318`,
  rollback / kill-switch policy audit)
- open issues at audit time: #1882, #1661, #2234, #2281, #2316
- closed issues at audit time: #2314 (rollback audit), #2312
  (rate-limit storage plan), #2310 (Firebase plan), #2308 (gate),
  #2306 (audit), #2305 (wiring), #2303 (skeleton), #2300 (wiring),
  #2298 (skeleton), #2296 (wiring), #2294 (skeleton), #2292
  (audit), #2290 (taxonomy), #2288 (audit), #2286 (observability),
  #2284 (DI), #2282 (safe-fail), #2279 (reconcile), #2277
  (boundary), #2275 / #2273 (selection boundary), #2271
  (provider-specific skeleton), #2269 (production-readiness-gates
  audit), #2267 (secret incident runbook), #2265 (cost/quota/
  abuse), #2263 (auth/rate-limit persistence boundary), #2261
  (staging rollout), #2259 (post-mock readiness audit)
- pre-existing test failure bucket: 3 editor-canvas failures (out
  of scope for this audit)

## 4. Current safe baseline

The following defaults **remain** as the observability baseline.
Any future observability PR must restore the system to this state
on kill-switch activation or rollback.

| Surface | Baseline | Lock location |
|---------|----------|---------------|
| Endpoint `providerMode` | `"stub"` | `functions/api/scout/suggest.js` (`SCOUT_SUGGEST_PROVIDER_MODES.STUB`) |
| Explicit stub path (`providerMode: "stub"`) | unchanged | same as above |
| Frontend source selector | `"local_stub"` | `js/scout/scout-suggestion-source-selector.js` |
| Endpoint client | `disabled` (opt-in) | `js/scout/scout-suggestion-endpoint-client.js` |
| Source selector `endpoint_client` row | `disabled` | same as above |
| `verifierAdapter` default | mock-disabled | `functions/api/scout/live-auth-rate-limit-dependency-adapter.js` |
| `storageAdapter` default | mock-disabled | `functions/api/scout/live-auth-rate-limit-dependency-adapter.js` |
| Dependency adapter (mock-disabled) | mock-disabled | `functions/api/scout/live-auth-rate-limit-dependency-adapter.js` |
| Live observability helper | pure sanitizer (in-memory ring buffer only) | `functions/api/scout/live-auth-rate-limit-observability.js` |
| Live observability allowlist | 10 safe fields | `SCOUT_LIVE_OBSERVABILITY_FIELDS` in the helper |
| External observability backend | not integrated | this audit forbids it |
| Real logging backend | not invoked | this audit forbids it |
| Metrics sink / trace sink / alert sink | not implemented | this audit forbids it |
| Real Firebase Admin SDK | not imported | this audit forbids it |
| Real token verification | not implemented | this audit forbids it |
| Real KV / Durable Object / D1 storage | not implemented | this audit forbids it |
| Real provider API call | not invoked | this audit forbids it |
| `staging_live` opt-in | not adopted | this audit forbids it |
| `production_live` opt-in | not adopted | this audit forbids it |
| Runtime adapter implementation gate | gate contract locked | PR #2309, `da87d2d1` |
| Firebase auth verifier implementation plan | plan complete | PR #2311, `65924f61` |
| Rate-limit storage implementation plan | plan complete | PR #2313, `f03f8497` |
| Rollback / kill-switch policy audit | audit complete | PR #2315, `18136318` |
| Runtime observability policy audit | audit complete (this slice) | this slice, #2316 |

## 5. Gate alignment

This audit satisfies gate evidence 11 of 11 in the runtime adapter
implementation gate contract. After this slice is merged, **all 11
gate evidence items will be complete**.

### 5.1 Gate evidence checklist (11 items, gated)

Before any real runtime adapter implementation PR can land, all
11 gate evidence items must exist on `main`. After this slice:

1. Adapter wiring readiness audit (PR #2307, `78b0c59f`).
2. Endpoint error taxonomy contract.
3. Endpoint auth/rate-limit readiness audit.
4. Production readiness gates audit.
5. Staging rollout contract.
6. Cost / quota / abuse monitoring contract.
7. Secret / config deployment checklist.
8. Secret rotation / incident runbook.
9. Privacy / safety payload allowlist.
10. Rollback / kill-switch policy audit (PR #2315, `18136318`).
11. **Runtime observability policy audit** ← this slice.

### 5.2 Gate step 3 prerequisite

After this slice is merged, gate step 3 (one disabled-by-default
runtime adapter implementation) may begin. Gate step 3 is
**still** a scaffold slice, not a real live implementation. Gate
step 3 must:

- Stay disabled-by-default (no default `live` behavior)
- Stay env-gated (no opt-in by source code)
- Stay safe-fail (any failure falls back to the baseline stub /
  `local_stub` / disabled state)
- Not include a real Firebase Admin SDK import
- Not include a real KV / Durable Object / D1 call
- Not include a real provider API call
- Not include a real external observability backend integration
- Not include a real alerting pipeline
- Not opt into `staging_live` or `production_live`

### 5.3 Predecessor plan cross-references

This audit cites the following predecessor plans / contracts /
audits:

- Runtime adapter implementation gate contract
  (`docs/product/lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md`,
  PR #2309, `da87d2d1`).
- Runtime Firebase auth verifier implementation plan
  (`docs/product/lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md`,
  PR #2311, `65924f61`).
- Runtime rate-limit storage implementation plan
  (`docs/product/lovebud-scout-runtime-rate-limit-storage-implementation-plan.md`,
  PR #2313, `f03f8497`).
- Rollback / kill-switch policy audit
  (`docs/product/lovebud-scout-rollback-kill-switch-policy-audit.md`,
  PR #2315, `18136318`).
- Endpoint error taxonomy contract
  (`docs/product/lovebud-scout-live-endpoint-error-taxonomy-contract.md`).
- Live observability helper
  (`functions/api/scout/live-auth-rate-limit-observability.js`,
  v20260607-1).

## 6. Observability surfaces

The future runtime adapter implementation PR **must** provide a
sanitized observability event for each of the following 10
surfaces. Each surface's events must:

- Use the allowlist-only sanitization pattern
- Map to the endpoint error taxonomy
- Be safe-swallowed (never throw into the request path)
- Be safe-fail (no event must block the response)

| # | Surface | Event kind | When emitted |
|---|---------|-----------|--------------|
| 1 | Endpoint request lifecycle | `endpoint_request` | On every `live` request (start) |
| 2 | Auth verifier | `auth_decision` | After verifier runs (success or failure) |
| 3 | Rate-limit storage | `rate_limit_decision` | After storage check (allow / block / unavailable) |
| 4 | Provider adapter | `provider_decision` | After provider call (success / failure / unavailable) |
| 5 | Error taxonomy | `error_event` | On any non-success response (code from taxonomy) |
| 6 | Rollback / kill-switch | `rollback_event` | On kill-switch activation or rollback trigger |
| 7 | Cost / quota / abuse | `cost_event` | On per-window quota threshold (stub-safe) |
| 8 | `staging_live` | `staging_event` | On `staging_live` opt-in only (blocked in this PR) |
| 9 | `production_live` | `production_event` | On `production_live` opt-in only (blocked in this PR) |
| 10 | Incident response | `incident_event` | On incident note creation (safe IDs only) |

## 7. Allowed observability fields (allowlist)

The future observability implementation **must** restrict emitted
events to the following allowlist. Any field not in this
allowlist must be dropped before any event is recorded or
forwarded.

| Field | Type | Purpose |
|-------|------|---------|
| `requestId` | string | Cross-request correlation id (sanitized alnum, max 128 chars) |
| `providerMode` | enum | `"stub"` / `"live"` (the runtime mode at emit time) |
| `endpointPath` | string | Safe path (e.g. `/api/scout/suggest`) — not full URL |
| `errorCode` | enum | One of the error taxonomy codes (or null) |
| `safeStatus` | enum | Sanitized decision status (e.g. `auth_required`, `authenticated`) |
| `latencyMs` | non-negative int | Sanitized end-to-end latency (ms) |
| `retryAfterSeconds` | non-negative int | From rate-limit decision only (0 if not applicable) |
| `quotaBucket` | string | Sanitized bucket name (alnum + `:` `-` `_`, max 256 chars) |
| `decisionId` | string | Per-decision correlation id (sanitized alnum, max 128 chars) |
| `adapterKind` | enum | `"verifier"` / `"storage"` / `"provider"` / `"observability"` / `"boundary"` |
| `mockDisabled` | boolean | Whether the adapter was mock-disabled at emit time |
| `environmentLabel` | enum | `"dev"` / `"staging"` / `"production"` / `"test"` (not raw hostname) |
| `severity` | enum | `"info"` / `"warn"` / `"error"` / `"critical"` (sanitized, no payload) |
| `retryCount` | non-negative int | Number of retries so far (0 if not applicable) |
| `maxRetries` | non-negative int | Configured max retries (0 if not applicable) |
| `timeoutMs` | non-negative int | Configured timeout (ms) (0 if not applicable) |
| `eventType` | enum | One of the 10 surface event kinds |

The existing live observability helper
(`functions/api/scout/live-auth-rate-limit-observability.js`)
already implements 10 of these fields for the boundary decision
event. A future observability PR may expand the allowlist with
new fields, but each new field must be documented in this audit
and locked by a contract test before it can be emitted.

## 8. Prohibited observability fields

The future observability implementation **must never** record or
forward any of the following fields. Any candidate event
containing a prohibited field name must be rejected at sanitize
time.

| Prohibited field | Reason |
|------------------|--------|
| `token` | Raw bearer token (any kind) |
| `authorization` | Raw `Authorization` header value |
| `firebaseToken` | Raw Firebase ID token |
| `apiKey` / `apikey` / `api_key` | Raw provider or Firebase API key |
| `secret` / `secretValue` | Raw secret value |
| `serviceAccount` / `serviceAccountKey` | Raw service account JSON or value |
| `prompt` | Raw prompt text sent to the provider |
| `excerpt` | Raw excerpt text (the user-supplied source material) |
| `sourceUrl` | Raw source URL (may contain user query, PII, token) |
| `requestBody` / `body` / `rawBody` | Raw request body (may contain prompt / excerpt / sourceUrl) |
| `providerResponse` / `rawProviderResponse` | Raw provider response body |
| `firebaseClaims` / `rawClaims` | Raw decoded Firebase ID token claims |
| `decodedToken` / `rawDecodedToken` | Raw decoded token payload |
| `storageKey` / `rawStorageKey` | Raw storage key (may contain UID / email / IP) |
| `uid` / `rawUid` / `userId` / `user_id` | Raw user identifier |
| `email` / `emailAddress` | Raw email address |
| `ip` / `ipAddress` / `clientIp` | Raw IP address |
| `cookie` / `sessionCookie` / `sessionId` | Raw cookie / session identifier |
| `password` | Raw password (not currently used, but must not appear) |
| `phone` / `phoneNumber` | Raw phone number (not currently used, but must not appear) |
| `key` (as a generic field name) | Ambiguous — must be replaced by a typed field name |

The existing live observability helper enforces the boundary
decision side of this policy via the
`SCOUT_LIVE_OBSERVABILITY_FIELDS` allowlist and the
`sanitizeScoutLiveBoundaryEvent` function. A future observability
PR must extend the sanitizer to cover the other 9 surfaces.

## 9. Safe event schema

Each of the 10 surfaces emits a sanitized event. Every event has
a **base event schema** and a **surface-specific extension**.

### 9.1 Base event fields (all surfaces)

| Field | Type | Required |
|-------|------|----------|
| `eventType` | enum (one of the 10 surface kinds) | yes |
| `requestId` | sanitized string | yes |
| `providerMode` | `"stub"` / `"live"` | yes |
| `endpointPath` | safe path | yes |
| `environmentLabel` | `"dev"` / `"staging"` / `"production"` / `"test"` | yes |
| `severity` | `"info"` / `"warn"` / `"error"` / `"critical"` | yes |
| `latencyMs` | non-negative int | yes |
| `mockDisabled` | boolean | yes |
| `timestamp` | ISO 8601 string (sanitized, no sub-millisecond) | yes |

### 9.2 Auth event fields (surface 2)

- `errorCode` (one of `AUTH_REQUIRED` / `AUTH_INVALID` / null)
- `safeStatus` (`authenticated` / `auth_required` / `auth_invalid`)
- `adapterKind` (`verifier`)

### 9.3 Rate-limit event fields (surface 3)

- `errorCode` (one of `RATE_LIMITED` / `RATE_LIMIT_UNAVAILABLE` /
  `RATE_LIMIT_PAYLOAD_PROHIBITED` /
  `RATE_LIMIT_STORAGE_UNAVAILABLE` / null)
- `safeStatus` (`rate_limit_allowed` / `rate_limited` /
  `rate_limit_unavailable`)
- `retryAfterSeconds` (non-negative int)
- `quotaBucket` (sanitized string)
- `adapterKind` (`storage`)

### 9.4 Provider event fields (surface 4)

- `errorCode` (one of `PROVIDER_UNAVAILABLE` / `PROVIDER_ERROR` /
  `CONFIG_MISSING` / `VALIDATION_ERROR` / null)
- `safeStatus` (`provider_allowed` / `provider_blocked` /
  `provider_unavailable`)
- `retryCount` (non-negative int)
- `maxRetries` (non-negative int)
- `timeoutMs` (non-negative int)
- `adapterKind` (`provider`)
- `decisionId` (sanitized string)

### 9.5 Error event fields (surface 5)

- `errorCode` (any taxonomy code)
- `safeStatus` (sanitized decision)
- `severity` (from the taxonomy severity mapping)

### 9.6 Rollback event fields (surface 6)

- `errorCode` (the rollback trigger code, or `ROLLBACK_TRIGGERED`)
- `safeStatus` (`rollback_engaged` /
  `rollback_partial` / `rollback_failed`)
- `adapterKind` (`observability` or the relevant surface kind)
- `decisionId` (sanitized string)

### 9.7 Cost / quota / abuse event fields (surface 7)

- `quotaBucket` (sanitized string)
- `errorCode` (one of `QUOTA_THRESHOLD` / `COST_THRESHOLD` /
  `ABUSE_DETECTED` / null)
- `safeStatus` (`within_budget` / `over_budget`)
- `adapterKind` (`storage`)

### 9.8 Staging / production event fields (surfaces 8, 9)

- `errorCode` (the live-mode trigger code, or null)
- `safeStatus` (`staging_live` / `production_live` / `blocked`)
- `adapterKind` (`observability`)

### 9.9 Incident event fields (surface 10)

- `decisionId` (sanitized string)
- `safeStatus` (`incident_logged` / `incident_suppressed`)
- `severity` (`error` / `critical`)
- `errorCode` (one of `INCIDENT_VERIFIER` / `INCIDENT_STORAGE` /
  `INCIDENT_PROVIDER` / `INCIDENT_OBSERVABILITY` / null)

## 10. Error taxonomy alignment

The observability mapping must remain aligned with the endpoint
error taxonomy contract. The following error codes have an
explicit observability mapping:

| Error code | HTTP status | Observability event | Severity |
|------------|-------------|---------------------|----------|
| `AUTH_REQUIRED` | 401 | yes (`auth_decision`) | warn |
| `AUTH_INVALID` | 401 | yes (`auth_decision`) | warn |
| `RATE_LIMITED` | 429 | yes (`rate_limit_decision`) | warn |
| `RATE_LIMIT_UNAVAILABLE` | 503 | yes (`rate_limit_decision`) | error |
| `RATE_LIMIT_PAYLOAD_PROHIBITED` | 400 | yes (`rate_limit_decision`) | warn |
| `RATE_LIMIT_STORAGE_UNAVAILABLE` | 503 | yes (`rate_limit_decision`) | error |
| `PROVIDER_UNAVAILABLE` | 503 | yes (`provider_decision`) | error |
| `PROVIDER_ERROR` | 502 | yes (`provider_decision`) | error |
| `CONFIG_MISSING` | 503 | yes (`error_event`) | error |
| `VALIDATION_ERROR` | 400 | yes (`error_event`) | info |

The `CONFIG_MISSING` and `PROVIDER_ERROR` cases may not have
emitted observability events in the existing boundary observability
contract; a future observability PR may emit them but must
sanitize the payload to allowed fields only.

## 11. Privacy / safety policy

- **Safe metadata only** — every event must use only the
  allowlist in section 7.
- **No sensitive payload capture** — no raw token, no
  authorization header, no `firebaseToken`, no API key, no
  prompt, no excerpt, no sourceUrl, no raw request body, no raw
  provider response, no raw Firebase claims, no raw decoded
  token, no raw storage key, no raw UID, no email, no raw IP, no
  cookie, no sessionCookie, no password, no phone.
- **No replay of sensitive payloads** — even if a future
  observability backend supports request replay, the payload
  must be the sanitized event, not the raw request.
- **No raw source material in observability** — the
  `excerpt` / `prompt` / `sourceUrl` fields are user-supplied
  source material; they must never appear in any event.
- **No raw user identifiers** — only the sanitized
  `userKeyHash` (or `decisionId`) form may appear; the raw UID /
  email / IP / sessionId must not.
- **No secret value in any log / error / event** — no
  `apiKey`, no `secret`, no `serviceAccountKey`, no
  `firebaseToken`, no `decodedToken`.
- **Safe-swallow on observer throw** — if an observer throws,
  the throw must be swallowed and the request must continue
  unaffected. This is already implemented in
  `safeInvokeScoutLiveObserver` in the existing helper.

## 12. External observability backend policy

- **Not implemented in this PR** — no external observability
  backend integration in this audit slice.
- **Disabled-by-default** — a future observability backend must
  be disabled by default. The default state is the existing
  in-memory ring buffer (or no observer at all in production).
- **Environment-gated** — the backend is controlled by an env
  var (example name:
  `SCOUT_RUNTIME_OBSERVABILITY_BACKEND` with values
  `disabled` / `local` / `external`). The default is `disabled`
  (or `local` in dev).
- **Independent kill-switch** — the observability backend must
  have its own kill-switch (example env var:
  `SCOUT_RUNTIME_OBSERVABILITY_BACKEND_KILL_SWITCH`). The
  kill-switch must engage before any external export and must
  fall back to safe local events or no events at all.
- **Fail closed or silently drop telemetry** — if the backend
  fails, the request must continue. The observer must
  safe-swallow the throw (already implemented in
  `safeInvokeScoutLiveObserver`).
- **Must not block endpoint response** — observability failures
  must never delay or fail the response.
- **Must not change endpoint response body** — observability
  state must never leak into the response body or headers.
- **Must not auto-save data** — no automatic persistence of
  events to disk, KV, D1, or any other storage.

## 13. Alerting policy

- **No alerts implemented in this PR** — no alerting pipeline,
  no alert sink, no PagerDuty / Slack / email integration.
- **Future alerts must use sanitized fields only** — an
  alert message may include `errorCode`, `safeStatus`,
  `severity`, `quotaBucket`, `environmentLabel`, `decisionId`,
  but must not include any prohibited field from section 8.
- **Alert thresholds must be documented before `staging_live`**
  — any future alert must have a documented threshold and
  owner before `staging_live` opt-in.
- **Alert messages must not contain sensitive values** — the
  alert template must use only sanitized fields. A test must
  verify this.

## 14. Incident observability policy

- **Incident notes must use safe IDs / hashes only** — any
  incident note may include `decisionId`, `quotaBucket`,
  `environmentLabel`, `errorCode`, `safeStatus`, `severity`,
  `latencyMs`, but must not include any prohibited field.
- **No raw token / API key / prompt / sourceUrl in incident
  reports** — incident reports are subject to the same
  sanitization policy as runtime events.
- **Sensitive logging suspected → disable external backend
  first** — if any prohibited field is observed in a runtime
  event, the incident response must disable the external
  observability backend before any further investigation.
- **Preserve rollback decision trace with safe fields only** —
  the rollback decision tree from the rollback / kill-switch
  policy audit may be referenced, but only via safe fields.

## 15. Rollback / kill-switch alignment

- **Observability backend must have independent kill-switch** —
  the observability backend kill-switch is independent from
  the verifier / storage / provider kill-switches. Disabling
  the observability backend must not affect any other surface.
- **Rollback events must be safe** — a rollback event must use
  only the allowlist in section 7 and must not include any
  prohibited field.
- **Kill-switch activation must not log secrets** — the
  kill-switch activation log must use only safe fields. The
  reason for activation may be a sanitized reason code, but
  must not include the raw secret value or the raw env var
  name.
- **Fallback baseline remains stub / `local_stub` / disabled** —
  on any observability rollback, the endpoint falls back to
  the baseline (default stub / frontend `local_stub` / endpoint
  client disabled).

## 16. Required future tests

A future observability implementation PR must include tests for
all of the following:

1. **Observer safe-swallow** — if the observer throws, the
   throw is swallowed and the response is unaffected.
2. **External backend disabled by default** — without the env
   var set, no external export happens.
3. **External backend kill-switch prevents export** — when the
   kill-switch is engaged, no external export happens.
4. **No sensitive fields in emitted events** — emitted events
   contain only allowlist fields.
5. **No prompt / excerpt / sourceUrl in events** — these
   fields are never present in any emitted event.
6. **No raw token / API key / service account in events** —
   these fields are never present in any emitted event.
7. **Endpoint response unaffected by observer failures** — an
   observer throw does not change the response body or status.
8. **No provider API call from observability** — the
   observability layer does not call any provider API.
9. **No storage / auth call from observability** — the
   observability layer does not call any storage or auth
   backend.
10. **Docs examples contain safe fake metadata only** — any
    example in any doc or test uses clearly fake strings (e.g.
    `TEST_FIXTURE_*_NOT_A_REAL_SECRET_*`).
11. **Sanitizer rejects unknown fields** — the sanitizer drops
    any field not in the allowlist.
12. **Sanitizer redacts user identifiers** — the sanitizer
    converts any user identifier to its `userKeyHash` form.
13. **Alerting template uses safe fields only** — any alert
    template uses only allowlist fields.
14. **Incident note template uses safe fields only** — any
    incident note template uses only allowlist fields.

## 17. Go / no-go matrix

| Item | Status in this PR |
|------|-------------------|
| Runtime observability policy audit | **Done** |
| External observability backend | **No** (still blocked) |
| Real alerting | **No** (still blocked) |
| Real Firebase Admin SDK | **No** (still blocked) |
| Real KV / Durable Object / D1 | **No** (still blocked) |
| Real provider API | **No** (still blocked) |
| `staging_live` opt-in | **No** (still blocked) |
| `production_live` opt-in | **No** (still blocked) |
| Real external auth service | **No** (still blocked) |
| Real persistent rate-limit storage | **No** (still blocked) |
| Endpoint default `live` | **No** (still `stub`) |
| Frontend default `endpoint_client` | **No** (still disabled) |
| Source selector default | **No** (still `local_stub`) |
| Real `wrangler secret` registration | **No** (still blocked) |
| Real `wrangler kv` / `wrangler d1` | **No** (still blocked) |
| Real `wrangler pages` deploy | **No** (still blocked) |
| Browse #1661 work | **No** (still blocked) |
| Schema migration | **No** (still blocked) |
| Auto-save | **No** (still blocked) |

## 18. Remaining blockers after this audit

After this slice is merged, the following items remain before any
real runtime adapter implementation PR can land:

1. **Staging soak** — a future staging soak test plan must be
   added.
2. **Secret rotation drill** — a future secret rotation drill
   plan must be added.
3. **CTO approval** — a CTO review of this audit and the
   proposed next scaffold PR is required.
4. **Actual disabled-by-default runtime adapter scaffold** —
   gate step 3 may begin. Gate step 3 is still a scaffold slice
   (no real Firebase / KV / provider / staging_live /
   production_live).

## 19. Recommended next slice

`[TECH] Add one disabled-by-default runtime adapter implementation
scaffold`. This is gate step 3, not a real production live
implementation. The scaffold must:

- Stay disabled-by-default (no default `live` behavior)
- Stay env-gated (no opt-in by source code)
- Stay safe-fail (any failure falls back to baseline stub /
  `local_stub` / disabled state)
- Not include a real Firebase Admin SDK import
- Not include a real KV / Durable Object / D1 call
- Not include a real provider API call
- Not include a real external observability backend integration
- Not include a real alerting pipeline
- Not opt into `staging_live` or `production_live`

The scaffold may add a single runtime adapter module that is
importable but not invoked, with a mock-disabled default, so
that the next gate step 4 (integration test) can verify the
disabled-by-default + env-gated + safe-fail contract.

## 20. Explicit verdict

- Ready for runtime observability policy audit: **Yes**
- Gate evidence 11 of 11 complete after this audit: **Yes**
- Ready for external observability backend in this PR: **No**
- Ready for real Firebase / KV / provider runtime in this PR:
  **No**
- Ready for staging_live in this PR: **No**
- Ready for production_live in this PR: **No**
- Recommended next slice: `[TECH] Add one disabled-by-default
  runtime adapter implementation scaffold`

The runtime observability policy is now locked. The mock-disabled
wiring is consistent, fail-closed, and free of external runtime
access. All 11 gate evidence items are now complete. The next
prerequisite is gate step 3 — not a real implementation PR — and
that scaffold must still stay disabled-by-default, env-gated, and
safe-fail.

## 21. Branch safety reminder

This audit slice must be merged via PR — not by direct commit
to `main`. Future slices that cite this audit must follow the
same **serial** branch safety pattern:

1. `git fetch origin` (serial)
2. `git checkout main` (serial)
3. `git pull --ff-only origin main` (serial)
4. `git rev-parse --short HEAD` (verify base)
5. `git status --short` (verify clean)
6. `git checkout -b <feature-branch>` (serial, separate
   command)
7. `git branch --show-current` (verify branch)
8. Only after the branch is confirmed: file edits, `git add`,
   `git commit`, `git push`, PR creation.

A reviewer who sees a `git commit` against `main` in a future
implementation PR must reject the PR. Never batch `git checkout
main` with `git checkout -b` in the same tool call. Never commit
without first running `git branch --show-current` and confirming
the result.

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

## Disabled Firebase Verifier Dependency Wiring Status

The disabled Firebase auth verifier scaffold result codes are now wired into the Scout live dependency adapter contract (v20260607-1, wiring-only slice, no runtime live behavior change, no real Firebase Admin SDK, no real token verification):

- `VERIFIER_FIREBASE_DISABLED` maps to `VERIFY_NOT_IMPLEMENTED`
- `VERIFIER_CONFIG_MISSING` maps to `VERIFY_UNAVAILABLE`
- Existing mappings preserved: `VERIFIER_MOCK_DISABLED`, `VERIFIER_NOT_IMPLEMENTED`, `VERIFIER_PAYLOAD_PROHIBITED` → same dependency-adapter codes
- Unknown verifier code and verifier throw still safe-fail to `VERIFY_UNAVAILABLE`
- No automatic Firebase mode enable in dependency adapter
- Default `createScoutLiveDependencyAdapter()` behavior remains `mockDisabled: true`
- `suggest.js` remains unchanged
- Endpoint default `providerMode: "stub"` preserved
- Explicit stub path preserved
- Frontend default `local_stub` preserved
- Endpoint client default disabled preserved
- `staging_live` / `production_live` remain blocked
- No real Firebase Admin SDK / no real token verification / no fetch / no provider SDK / no env secret usage / no KV / DO / D1
