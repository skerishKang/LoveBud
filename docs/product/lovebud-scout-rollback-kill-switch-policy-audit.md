# Scout Rollback / Kill-Switch Policy Audit

> Status: **audit complete (rollback / kill-switch policy gate
> evidence 10 of 11 locked)**
> Version: v20260607-1
> Audience: Scout live provider engineering, CTO, Document Lead,
> incident response, anyone who would propose a real runtime
> adapter PR.
> Scope: rollback and kill-switch policy for any future runtime
> adapter PR (Firebase auth verifier, rate-limit storage, external
> observability, provider API, `staging_live`, `production_live`).
> Related issues: #1882, #2314
> Predecessor slice: PR #2313 (`f03f8497`, runtime rate-limit
> storage implementation plan)
> Successor slice: `[PRODUCT] Add Scout runtime observability
> policy audit` (gate evidence 11 of 11), then `[TECH] Add one
> disabled-by-default runtime adapter implementation` (gate
> step 3)

## 1. Purpose

This document is an **audit / docs+tests only** slice that locks the
**rollback and kill-switch policy** for the Scout live provider
path. It does **not** introduce any runtime change. It does **not**
introduce any kill-switch implementation. It does **not** change any
Cloudflare env / secret. It does **not** perform any deployment
rollback.

It exists to satisfy gate evidence 10 of 11 in the runtime adapter
implementation gate contract. After this slice, only gate evidence
11 (observability policy) remains. After both are merged, all 11
gate evidence items will be complete, and gate step 3 (one
disabled-by-default runtime adapter implementation) may begin.

This audit defines the rollback baseline, the kill-switch surfaces,
the required future kill-switch controls, the incident rollback
decision tree, the per-surface rollback policies (secret/config,
quota/cost, auth verifier, rate-limit storage, provider API,
observability, staging/prod), the privacy/safety rules during
rollback, the required future tests, the go/no-go matrix, the
remaining blockers, and the explicit verdict.

## 2. Non-goals

- No runtime behavior change
- No endpoint code change
- No actual kill-switch implementation
- No Cloudflare env / secret change
- No real deployment rollback
- No `wrangler secret` / `wrangler kv` / `wrangler d1` /
  `wrangler pages` deployment command
- No real LLM provider implementation
- No live provider API call
- No provider SDK imports (OpenAI / Anthropic / Gemini / Groq /
  Mistral / NVIDIA / Cohere / Perplexity)
- No Firebase Admin SDK import (`firebase-admin`,
  `firebase-admin/app`, `firebase-admin/auth`)
- No real Firebase token verification
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

- main HEAD at audit time: `f03f8497` (post PR #2313)
- last runtime code change: PR #2304 (`3ac2d940`, auth verifier
  dependency wiring)
- last test-only / docs-only change: PR #2313 (`f03f8497`,
  rate-limit storage implementation plan)
- open issues at audit time: #1882, #1661, #2234, #2281, #2314
- closed issues at audit time: #2312 (rate-limit storage plan),
  #2310 (Firebase plan), #2308 (gate), #2306 (audit), #2305 (wiring),
  #2303 (skeleton), #2300 (wiring), #2298 (skeleton), #2296 (wiring),
  #2294 (skeleton), #2292 (audit), #2290 (taxonomy), #2288 (audit),
  #2286 (observability), #2284 (DI), #2282 (safe-fail), #2279
  (reconcile), #2277 (boundary), #2275 / #2273 (selection
  boundary), #2271 (provider-specific skeleton),
  #2269 (production-readiness-gates audit), #2267 (secret incident
  runbook), #2265 (cost/quota/abuse), #2263 (auth/rate-limit
  persistence boundary), #2261 (staging rollout), #2259 (post-mock
  readiness audit)
- pre-existing test failure bucket: 3 editor-canvas failures (out of
  scope for this audit)

## 4. Current safe baseline (rollback baseline)

The following defaults **remain** as the rollback baseline. Any
future kill-switch action must restore the system to this state.

| Surface | Baseline | Lock location |
|---------|----------|---------------|
| Endpoint `providerMode` | `"stub"` | `functions/api/scout/suggest.js` (`SCOUT_SUGGEST_PROVIDER_MODES.STUB`) |
| Explicit stub path (`providerMode: "stub"`) | unchanged | same as above |
| Frontend source selector | `"local_stub"` | `js/scout/scout-suggestion-source-selector.js` |
| Endpoint client | `disabled` (opt-in) | `js/scout/scout-suggestion-endpoint-client.js` |
| Source selector `endpoint_client` row | `disabled` | same as above |
| `verifierAdapter` default | mock-disabled | `functions/api/scout/live-auth-rate-limit-dependency-adapter.js` |
| `storageAdapter` default | mock-disabled | `functions/api/scout/live-auth-rate-limit-dependency-adapter.js` |
| `checkRateLimit` in LIVE branch | `undefined` (RATE_LIMIT_UNAVAILABLE 503) | `functions/api/scout/suggest.js` |
| Canonical boundary file | `functions/api/scout/live-auth-rate-limit-boundary.js` | runtime import |
| Parallel boundary file | not adopted | `live-provider-auth-rate-limit-boundary.js` |
| Runtime adapter implementation gate | gate contract locked | PR #2309, `da87d2d1` |
| Firebase auth verifier implementation plan | plan complete | PR #2311, `65924f61` |
| Rate-limit storage implementation plan | plan complete | PR #2313, `f03f8497` |
| Rollback / kill-switch policy audit | audit complete (this slice) | this slice, #2314 |
| Real Firebase Admin SDK | not imported | this audit forbids it |
| Real token verification | not implemented | this audit forbids it |
| Real KV / Durable Object / D1 storage | not implemented | this audit forbids it |
| Real external observability backend | not integrated | this audit forbids it |
| Real provider API call | not invoked | this audit forbids it |
| `staging_live` opt-in | not adopted | this audit forbids it |
| `production_live` opt-in | not adopted | this audit forbids it |

## 5. Gate alignment

This audit satisfies gate evidence 10 of 11 in the runtime adapter
implementation gate contract.

### 5.1 Predecessor gate evidence (10 of 11 items)

The following gate evidence items are already on `main` (after this
slice, 10 of 11):

1. Adapter wiring readiness audit (PR #2307, `78b0c59f`).
2. Endpoint error taxonomy contract.
3. Endpoint auth/rate-limit readiness audit.
4. Production readiness gates audit.
5. Staging rollout contract.
6. Cost / quota / abuse monitoring contract.
7. Secret / config deployment checklist.
8. Secret rotation / incident runbook.
9. Privacy / safety payload allowlist.
10. **Rollback / kill-switch policy audit** ← this slice.

### 5.2 Missing gate evidence (1 of 11 items)

The following gate evidence item is still missing and **must** be
added by a future slice before any real runtime adapter
implementation PR can land:

11. **Observability policy** as a separate doc slice (currently
    inline-only; needs a `[PRODUCT]` audit slice).

### 5.3 Pre-implementation checklist (11 items, gated)

Before any real runtime adapter implementation PR can land, all
11 gate evidence items must exist on `main`. The 1 missing item
(observability policy) is the only remaining blocker in the gate
evidence set. After that doc is added, all 11 gate evidence items
will be complete, and gate step 3 (one disabled-by-default runtime
adapter implementation) may begin.

### 5.4 Predecessor plan cross-references

This audit cites the following predecessor plans / contracts:

- Runtime adapter implementation gate contract
  (`docs/product/lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md`,
  PR #2309, `da87d2d1`).
- Runtime Firebase auth verifier implementation plan
  (`docs/product/lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md`,
  PR #2311, `65924f61`).
- Runtime rate-limit storage implementation plan
  (`docs/product/lovebud-scout-runtime-rate-limit-storage-implementation-plan.md`,
  PR #2313, `f03f8497`).

## 6. Kill-switch surfaces

The future kill-switch implementation PR **must** provide an
**independent** kill-switch control for each of the following 8
surfaces. Each kill-switch must be:

- **Independent** — disabling one surface must not affect any
  other surface.
- **Disabled-by-default** — the kill-switch is a "no-op pass-through"
  by default. Enabling the kill-switch is an explicit env / config
  action.
- **Environment-gated** — the kill-switch is controlled by an env
  var or a config flag, not by source code.
- **Safe-fail** — when the kill-switch is engaged, the surface
  returns the safe-fail response from the existing endpoint error
  taxonomy contract.

| # | Surface | Future kill-switch env var (example name) |
|---|---------|-------------------------------------------|
| 1 | Firebase auth verifier | `SCOUT_RUNTIME_FIREBASE_VERIFIER_KILL_SWITCH` |
| 2 | Rate-limit storage adapter | `SCOUT_RUNTIME_RATE_LIMIT_STORAGE_KILL_SWITCH` |
| 3 | External observability backend | `SCOUT_RUNTIME_OBSERVABILITY_BACKEND_KILL_SWITCH` |
| 4 | Provider API call | `SCOUT_RUNTIME_PROVIDER_API_KILL_SWITCH` |
| 5 | Endpoint live mode (overall) | `SCOUT_RUNTIME_LIVE_MODE_KILL_SWITCH` |
| 6 | Endpoint client | `SCOUT_RUNTIME_ENDPOINT_CLIENT_KILL_SWITCH` |
| 7 | `staging_live` opt-in | `SCOUT_RUNTIME_STAGING_LIVE_KILL_SWITCH` |
| 8 | `production_live` opt-in | `SCOUT_RUNTIME_PRODUCTION_LIVE_KILL_SWITCH` |

## 7. Required future kill-switch controls

The future kill-switch implementation PR **must** provide the
following controls:

- **Independent per-surface disable control** — each of the 8
  surfaces above must have its own kill-switch.
- **Disabled-by-default initial state** — the kill-switch is
  initially disabled. Engaging the kill-switch is an explicit
  action.
- **Environment-gated enablement** — the kill-switch is enabled by
  an env var or a config flag, not by source code.
- **Safe fallback to stub / local_stub** — when the kill-switch is
  engaged, the surface returns the safe-fail response, and the
  endpoint falls back to the baseline (default stub / frontend
  `local_stub`).
- **Config missing safe-fail** — if a kill-switch env var is set to
  an unknown value, the system must safe-fail to the baseline.
- **No secret exposure** — the kill-switch env var value must not
  contain any secret or credential. The kill-switch must not echo
  the env var value in any response, log, or observability event.
- **No user data loss** — engaging the kill-switch must not delete
  any user data, persistent storage, or KV / DO / D1 records.
- **No auto-save during rollback** — engaging the kill-switch must
  not trigger any auto-save, schema migration, or persistent write.
  The system must remain read-only with respect to user data
  during rollback.

## 8. Rollback baseline (target state after kill-switch)

When any kill-switch is engaged, the system must restore to the
following baseline:

- **Server endpoint deterministic stub** — `providerMode: "stub"` is
  the runtime default. The endpoint returns the deterministic stub
  response.
- **Frontend `local_stub`** — the frontend source selector
  defaults to `local_stub`. The endpoint client is disabled.
- **Endpoint client disabled** — the endpoint client is disabled
  by default. The frontend falls back to in-process local stub.
- **Provider API disabled** — no live provider API call is made.
  The endpoint returns the stub response without calling the
  provider adapter.
- **Verifier / storage mock-disabled** — the verifier and storage
  adapters return mock-disabled / not-implemented responses. The
  endpoint maps these to `VERIFY_NOT_IMPLEMENTED` /
  `RATE_LIMIT_NOT_IMPLEMENTED` safe-fail codes.

## 9. Incident rollback decision tree

The future kill-switch implementation PR **must** provide the
following incident rollback decision tree. The decision tree is a
**policy** — the actual code that enforces the policy is in the
future implementation PR, not in this audit.

### 9.1 Auth failures spike

- **Symptom**: Firebase auth verifier fails for > 5% of requests
  over a 5-minute window in `staging_live`, or for any request in
  `production_live`.
- **Action**: Engage `SCOUT_RUNTIME_FIREBASE_VERIFIER_KILL_SWITCH`
  → verifier falls back to mock-disabled / safe-fail →
  `VERIFY_NOT_IMPLEMENTED` 503.
- **Owner**: Incident response on-call.
- **Escalation**: CTO if production user impact.

### 9.2 Rate-limit storage unavailable

- **Symptom**: KV / Durable Object / D1 backend returns
  `unavailable` for > 1% of requests over a 1-minute window, or any
  quota reservation fails.
- **Action**: Engage
  `SCOUT_RUNTIME_RATE_LIMIT_STORAGE_KILL_SWITCH` → storage falls
  back to mock-disabled / safe-fail → `RATE_LIMIT_NOT_IMPLEMENTED`
  503.
- **Owner**: Incident response on-call.
- **Escalation**: CTO if production user impact.

### 9.3 Provider API failures

- **Symptom**: Provider API returns 5xx for > 2% of requests over a
  5-minute window, or any rate-limit / quota error from the
  provider.
- **Action**: Engage `SCOUT_RUNTIME_PROVIDER_API_KILL_SWITCH` →
  endpoint returns deterministic stub response without calling the
  provider.
- **Owner**: Incident response on-call.
- **Escalation**: CTO if production user impact.

### 9.4 Quota / cost anomaly

- **Symptom**: Daily cost exceeds the threshold defined in the
  future cost / quota / abuse monitoring contract, or per-user
  quota consumption is abnormal.
- **Action**: Engage
  `SCOUT_RUNTIME_PROVIDER_API_KILL_SWITCH` first, then engage
  `SCOUT_RUNTIME_RATE_LIMIT_STORAGE_KILL_SWITCH` if needed.
- **Owner**: Incident response on-call.
- **Escalation**: CTO.

### 9.5 Secret suspected exposed

- **Symptom**: Cloudflare Pages Secret, Firebase service account
  key, or provider API key is suspected to be exposed in a log,
  observability event, error response, or external system.
- **Action**: Engage all 8 kill-switches immediately, then rotate
  the exposed secret per the secret rotation / incident runbook.
- **Owner**: Incident response on-call + CTO.
- **Escalation**: CTO + Document Lead.

### 9.6 Sensitive logging suspected

- **Symptom**: Raw token, authorization header, API key, prompt,
  excerpt, sourceUrl, or raw request body is suspected to appear
  in a log, observability event, error response, or external
  system.
- **Action**: Engage `SCOUT_RUNTIME_OBSERVABILITY_BACKEND_KILL_SWITCH`
  first, then engage the relevant adapter kill-switch
  (Firebase verifier, rate-limit storage, or provider API) to stop
  the source of the leak.
- **Owner**: Incident response on-call + CTO.
- **Escalation**: CTO.

### 9.7 Staging smoke failure

- **Symptom**: Staging smoke test fails for any of the 8 surfaces
  in `staging_live`.
- **Action**: Engage the relevant kill-switch for the failing
  surface. Do **not** promote to `production_live`.
- **Owner**: Incident response on-call.
- **Escalation**: CTO.

### 9.8 Production user-impacting failure

- **Symptom**: User reports a failure in `production_live` that
  impacts their ability to use Scout.
- **Action**: Engage
  `SCOUT_RUNTIME_PRODUCTION_LIVE_KILL_SWITCH` → production
  environment falls back to `staging_live` opt-in or to the
  baseline.
- **Owner**: CTO.
- **Escalation**: CTO + Document Lead.

## 10. Secret / config rollback policy

The future kill-switch implementation PR **must** obey the
following secret / config rollback policy:

- **No real secret changes in this PR** — this audit does not
  change any real secret. The future implementation PR also must
  not change any real secret without CTO approval.
- **Platform-managed future secrets** — future secrets (Firebase
  service account key, provider API keys, Cloudflare Pages
  Secrets) must be managed by the platform (Cloudflare Pages
  Secrets, GitHub Actions Secrets), not by `.env` files.
- **Rotate on suspected exposure** — if a secret is suspected to be
  exposed, the secret must be rotated per the secret rotation /
  incident runbook.
- **Disable live mode before rotation if exposure affects
  runtime** — if the suspected exposure affects runtime, the
  relevant kill-switch must be engaged before the secret is
  rotated.
- **Do not log old or new secret values** — the secret rotation
  drill must not log the old or new secret values, the secret name,
  the binding name, or any other secret metadata. The drill must
  use redacted placeholders (`TEST_FIXTURE_*_NOT_A_REAL_SECRET_*`)
  in any test fixture or runbook example.

## 11. Quota / cost rollback policy

The future kill-switch implementation PR **must** obey the
following quota / cost rollback policy:

- **Disable provider API first** — on a quota / cost anomaly,
  disable the provider API first to stop the cost bleed.
- **Preserve endpoint stub fallback** — the endpoint must continue
  to return the deterministic stub response during the rollback.
  No user-facing outage.
- **Rate-limit storage unavailable maps to safe-fail** — if the
  rate-limit storage is unavailable, the endpoint returns
  `RATE_LIMIT_UNAVAILABLE` 503 (safe-fail). It must not call the
  provider API to "save" the quota.
- **Cost anomaly threshold future policy** — the threshold for
  triggering the cost anomaly rollback is defined in the future
  cost / quota / abuse monitoring contract, not in this audit.

## 12. Auth verifier rollback policy

The future kill-switch implementation PR **must** obey the
following auth verifier rollback policy:

- **Disable Firebase verifier mode** — on a Firebase verifier
  incident, disable the `firebase` mode in the verifier adapter.
- **Fallback to mock-disabled / safe-fail** — the verifier returns
  `VERIFY_NOT_IMPLEMENTED` 503. The endpoint maps this to a
  safe-fail response.
- **No raw token logs** — the rollback must not log the raw
  token, the raw authorization header, the raw decoded token, the
  raw Firebase claims, the raw UID, the raw email, or the raw
  service account key.
- **Never persist raw token during incident** — the rollback must
  not persist the raw token to any storage, KV, DO, D1, in-memory
  cache, or `userKey` field of a verifier response.

## 13. Rate-limit storage rollback policy

The future kill-switch implementation PR **must** obey the
following rate-limit storage rollback policy:

- **Disable KV / DO / D1 mode** — on a rate-limit storage incident,
  disable the `kv` / `durable_object` / `d1` mode in the storage
  adapter.
- **Fallback to mock-disabled / safe-fail** — the storage returns
  `RATE_LIMIT_NOT_IMPLEMENTED` 503. The endpoint maps this to a
  safe-fail response.
- **No raw storage key logs** — the rollback must not log the raw
  storage key, the raw binding name, the raw quota state, or any
  user-derived material.
- **No raw user identifiers in incident notes** — the rollback
  notes / post-mortem must not include raw UID, raw email, raw IP,
  raw session id, or any user-derived material. All references
  must use hash-derived placeholders.

## 14. Provider API rollback policy

The future kill-switch implementation PR **must** obey the
following provider API rollback policy:

- **Disable live provider adapter** — on a provider API incident,
  disable the live provider adapter. The endpoint falls back to
  the deterministic stub response.
- **Preserve deterministic stub response** — the stub response is
  the single source of truth for the fallback behavior. The
  endpoint must return it consistently, regardless of the
  kill-switch state.
- **No prompt / excerpt / sourceUrl logging** — the rollback must
  not log the prompt, the excerpt, the sourceUrl, the raw request
  body, the raw provider response, or the raw model output.
- **No auto-save** — the rollback must not trigger any auto-save,
  schema migration, or persistent write. The system must remain
  read-only with respect to user data during rollback.

## 15. Observability rollback policy

The future kill-switch implementation PR **must** obey the
following observability rollback policy:

- **Disable external backend first if leakage suspected** — on a
  suspected observability leak, disable the external observability
  backend first. The local ring-buffer observer (if implemented)
  continues to work in-process.
- **Preserve safe local events if implemented** — local in-process
  events (ring-buffer observer) are safe and may continue to work
  during the rollback. They are not subject to the external
  observability kill-switch.
- **No sensitive replay** — the rollback must not replay any
  sensitive event, raw token, raw authorization header, raw
  decoded token, raw Firebase claims, raw UID, raw email, raw IP,
  raw session id, raw prompt, raw excerpt, raw sourceUrl, or raw
  request body to any external system.

## 16. Staging / prod rollback policy

The future kill-switch implementation PR **must** obey the
following staging / prod rollback policy:

- **`staging_live` disable before production consideration** — if
  staging smoke fails, the `staging_live` opt-in must be disabled
  before any consideration of `production_live` opt-in.
- **`production_live` requires tested rollback path** — the
  `production_live` opt-in may only be enabled after the rollback
  path for each of the 8 kill-switch surfaces has been tested in
  `staging_live` for at least 7 days.
- **Rollback owner and approval required** — the
  `production_live` opt-in may only be enabled by a named
  rollback owner (CTO or designee) with explicit CTO approval.
  The owner must be reachable on-call.

## 17. Privacy / safety during rollback

The future kill-switch implementation PR **must** enforce the
following privacy / safety rules during any rollback:

- **No raw token** in any log, observability event, error
  response, incident note, or post-mortem.
- **No authorization header** in any log, observability event,
  error response, incident note, or post-mortem.
- **No `firebaseToken`** in any log, observability event, error
  response, incident note, or post-mortem.
- **No API key** (any provider) in any log, observability event,
  error response, incident note, or post-mortem.
- **No prompt / excerpt / sourceUrl / raw request body** in any
  log, observability event, error response, incident note, or
  post-mortem.
- **No raw provider response** in any log, observability event,
  error response, incident note, or post-mortem.
- **No raw user identifier** (UID, email, phone, IP, session id) in
  any log, observability event, error response, incident note, or
  post-mortem. All references must use hash-derived placeholders.

## 18. Required future tests

The future kill-switch implementation PR **must** add the following
tests (each as a focused contract test file, mirroring the
existing pattern):

- Each live surface can be disabled independently (assert that
  engaging the Firebase verifier kill-switch does not affect the
  rate-limit storage kill-switch, and vice versa).
- Default remains disabled (assert that all 8 kill-switches are
  `false` / `no-op` by default).
- Fallback returns stub / local_stub (assert that the endpoint
  returns the deterministic stub response when any kill-switch is
  engaged).
- No sensitive data in rollback logs / errors / events (assert
  that engaging a kill-switch does not emit a raw token, raw
  authorization header, raw API key, raw prompt, or raw user
  identifier in any log, error, or observability event).
- Provider API not called after kill-switch (assert that the
  provider API is not called after
  `SCOUT_RUNTIME_PROVIDER_API_KILL_SWITCH` is engaged).
- Firebase verifier not called after kill-switch (assert that the
  Firebase verifier is not called after
  `SCOUT_RUNTIME_FIREBASE_VERIFIER_KILL_SWITCH` is engaged).
- Storage not called after kill-switch (assert that the rate-limit
  storage is not called after
  `SCOUT_RUNTIME_RATE_LIMIT_STORAGE_KILL_SWITCH` is engaged).
- Endpoint client default disabled (assert that the endpoint client
  is disabled by default in the source selector, and that
  engaging the kill-switch is a no-op since the client is already
  disabled).
- Kill-switch engages the safe-fail response from the existing
  endpoint error taxonomy contract.
- Rollback baseline invariant (assert that after a kill-switch is
  engaged and then disengaged, the system returns to the exact
  baseline state with no side effects).

## 19. Go / no-go matrix

| # | Surface | Status | Notes |
|---|---------|--------|-------|
| 1 | Rollback / kill-switch policy audit | **Done** | this slice |
| 2 | Real kill-switch implementation in this PR | **No** | this PR is audit only |
| 3 | Real Firebase Admin SDK in this PR | **No** | blocked |
| 4 | Real KV / Durable Object / D1 in this PR | **No** | blocked |
| 5 | Real provider API in this PR | **No** | blocked |
| 6 | Real external observability backend in this PR | **No** | blocked |
| 7 | `staging_live` opt-in in this PR | **No** | blocked |
| 8 | `production_live` opt-in in this PR | **No** | blocked |
| 9 | Runtime adapter implementation gate | **Done** | PR #2309, `da87d2d1` |
| 10 | Firebase auth verifier implementation plan | **Done** | PR #2311, `65924f61` |
| 11 | Rate-limit storage implementation plan | **Done** | PR #2313, `f03f8497` |
| 12 | Adapter wiring readiness audit | **Done** | PR #2307, `78b0c59f` |
| 13 | Endpoint error taxonomy contract | **Done** | PR #2291 |
| 14 | Endpoint auth/rate-limit readiness audit | **Done** | PR #2289 |
| 15 | Production readiness gates audit | **Done** | closed #2269 |
| 16 | Staging rollout contract | **Done** | closed #2261 |
| 17 | Cost / quota / abuse monitoring contract | **Done** | closed #2265 |
| 18 | Secret / config deployment checklist | **Done** | doc exists |
| 19 | Secret rotation / incident runbook | **Done** | closed #2267 |
| 20 | Privacy / safety payload allowlist | **Done** | inline in dep adapter + verifier + storage |
| 21 | Observability policy | **Partial** | inline-only; needs separate doc |

## 20. Remaining blockers

The following must be resolved before any real runtime adapter
implementation PR can land:

1. **Observability policy** as a separate doc slice (currently
   inline-only; needs a `[PRODUCT]` audit slice). This is the
   only remaining gate evidence item.
2. **One-day staging soak drill** (after the implementation PR).
3. **Seven-day staging soak drill** (after the implementation PR).
4. **Secret rotation drill** (per the secret rotation / incident
   runbook).
5. **Kill-switch drill** (per this rollback / kill-switch policy
   audit, in `staging_live`).
6. **CTO approval** for the implementation PR.

## 21. Locks / evidence

This audit is locked by:

- `tests/contracts/scout-rollback-kill-switch-policy-audit-contract.test.cjs`
  (this slice).
- `tests/contracts/scout-runtime-rate-limit-storage-implementation-plan-contract.test.cjs`
  (PR #2313).
- `tests/contracts/scout-runtime-firebase-auth-verifier-implementation-plan-contract.test.cjs`
  (PR #2311).
- `tests/contracts/scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.test.cjs`
  (PR #2309).
- `tests/contracts/scout-live-auth-rate-limit-adapter-wiring-readiness-audit-contract.test.cjs`
  (PR #2307).
- All 21 prior contract tests listed in PR #2307 audit
  `docs/product/lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md`
  section 13.

The audit contract test (this slice) verifies the **content** of
this document against the actual repository state and the locked
default behavior.

## 22. Branch safety reminder

This slice was developed in strict serial branch safety mode to
avoid accidental commits to `main`:

- `git fetch origin` was run first.
- `git checkout main` was run in its own call.
- `git pull --ff-only origin main` was run next.
- `git rev-parse --short HEAD` confirmed the base SHA.
- `git status --short` confirmed a clean working tree.
- `git checkout -b product/scout-rollback-kill-switch-policy-audit`
  was run in a separate call.
- `git branch --show-current` confirmed the feature branch.
- `git status --short` and `git branch --show-current` were
  re-checked immediately before `git add` and `git commit`.

Any future slice that cites this audit must follow the same serial
branch safety pattern. A reviewer who sees a `git commit` against
`main` in a future implementation PR must reject the PR.

## 23. Explicit verdict

- Ready for rollback / kill-switch policy audit: **Yes**
- Ready for real kill-switch implementation in this PR: **No**
- Ready for real Firebase Admin SDK in this PR: **No**
- Ready for real KV / Durable Object / D1 in this PR: **No**
- Ready for real provider API in this PR: **No**
- Ready for real external observability backend in this PR: **No**
- Ready for `staging_live` opt-in in this PR: **No**
- Ready for `production_live` opt-in in this PR: **No**
- Recommended next slice: `[PRODUCT] Add Scout runtime
  observability policy audit` (gate evidence 11 of 11). After
  that is merged, all 11 gate evidence items will be complete,
  and gate step 3 (one disabled-by-default runtime adapter
  implementation) may begin.

The mock-disabled wiring is consistent, fail-closed, and free of
external runtime access. The rollback / kill-switch policy is now
locked. The next prerequisite is the observability policy doc —
not a real implementation PR.
