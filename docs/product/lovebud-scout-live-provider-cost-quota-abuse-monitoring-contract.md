# LoveBud Scout Live Provider Cost / Quota / Abuse Monitoring Contract

## Document Status

- **Status**: Complete — defines cost cap policy, quota budget, usage accounting, abuse monitoring, suspicious usage reporting, provider failure accounting, abuse escalation, and manual kill-switch triggers for the Scout live provider path. Provider-specific adapter skeleton added behind disabled mode. Provider-specific adapter selection boundary added behind disabled mode (inert registry, neutral example provider only).
- **current main HEAD**: `f7d37545`
- **related issue**: #1882
- **Browse #1661** remains out of scope
- **current live provider status**: provider-specific adapter skeleton added; provider-specific adapter selection boundary added (inert registry, neutral example provider only); disabled-by-default; no provider API call; staging_live and production_live remain blocked

## Baseline

- Endpoint default remains **`stub`** — deterministic, network-free, no API key
- Frontend default remains **`local_stub`** — no network, no endpoint client
- Live mode safe-fails to `PROVIDER_UNAVAILABLE` or `CONFIG_MISSING` in all states
- No real provider SDK import, no fetch, no API key value propagation
- Staging rollout contract complete
- Auth/rate-limit persistence boundary complete
- Real provider API call verdict: **No** (all slices to date)
- Provider-specific adapter skeleton exists, disabled by default, returns safe-fail
- Provider-specific adapter selection boundary exists, disabled-by-default, inert registry, neutral example provider only

## Current State

Cost/quota/abuse monitoring is **not implemented** at runtime. The provider-specific adapter skeleton is added behind disabled mode. The auth/rate-limit boundary document defines abuse/cost gates at the design level but does not specify monitoring outputs, cost caps, or escalation policies. This contract fills that gap.

## Purpose

- 이 문서는 Scout live provider 사용 시 비용 상한, quota budget, abuse monitoring, suspicious usage reporting, provider failure accounting을 정의한다.
- 실제 cost monitoring runtime 구현은 하지 않는다 — 이 문서는 **설계 계약(design contract)**이다.
- 실제 구현은 별도의 slice에서 진행한다.

## Non-goals

- No real LLM provider implementation
- No provider SDK imports
- No API keys or environment variables
- No Firebase Admin SDK integration
- No KV/Durable Object/D1 implementation
- No runtime cost/quota monitoring implementation
- No endpoint behavior change
- No frontend behavior change
- No persistence or auto-save
- No Browse #1661 work

## Cost Cap Policy

### Cost Estimation Dimensions

| Dimension | Source | Example |
|---|---|---|
| Provider name | `SCOUT_SUGGEST_LLM_PROVIDER` | `openai-compatible`, `anthropic` |
| Model name | `SCOUT_SUGGEST_MODEL` | `gpt-4o-mini`, `claude-sonnet-4` |
| Input tokens (estimated) | Approx from `prompt.length / 4` (naive) | ~500 tokens for avg suggestion |
| Output tokens (estimated) | Approx from `maxOutputLength` | 50–500 tokens clamped |
| Cost per 1K input tokens | Provider-specific pricing | $0.15/1K input (gpt-4o-mini) |
| Cost per 1K output tokens | Provider-specific pricing | $0.60/1K output (gpt-4o-mini) |
| Estimated per-request cost | `(inputTokens * inputPrice + outputTokens * outputPrice) / 1000` | ~$0.0004/req |

### Cost Caps

| Cap Level | Staging | Production |
|---|---|---|
| Per-user daily cost cap | $0.01 (informational, no hard stop) | $0.10 (hard stop — live mode disabled for user) |
| Per-environment daily cost cap | $0.50 (informational) | $5.00 (hard stop — all live requests → stub) |
| Provider-level monthly cap | $15.00 (informational) | $150.00 (hard stop — provider disabled, alert) |
| Total monthly cap | $20.00 (informational) | $200.00 (hard stop — all live mode disabled, kill-switch triggered) |

### Cost Cap Hard Stop Behavior

When a cost cap is exceeded (hard stop tier):

```text
1. Live mode for the affected scope (user/environment/all) auto-disables
2. Affected requests return PROVIDER_UNAVAILABLE (never cost cap in error message)
3. No further provider calls until cap resets or manual override
4. Manual override requires environment-level config change and documented approval
5. Alert sent to monitoring channel (safe sanitized event, no PII/cost details in alert)
```

### Staging vs Production Cost Caps

| Policy | Staging | Production |
|---|---|---|
| Caps are lower | ✅ Staging caps < Production caps | N/A |
| Hard stop enforced | ❌ Informational only (monitor, no auto-stop) | ✅ Enforced |
| Override required for bypass | N/A | ✅ Manual approval + env config change |
| Audit log of overrides | N/A | ✅ Required |

## Quota Budget Policy

### Request Quota Tiers

| Budget Tier | Per-Minute Soft | Per-Hour Hard | Per-Day Hard | Applies To |
|---|---|---|---|---|
| Staging — authenticated live | 10 req/min | 100 req/hr | 500 req/day | Staging live mode |
| Production — authenticated live | 20 req/min | 200 req/hr | 1000 req/day | Production live mode |
| Free / unauthenticated | 5 req/min (stub only) | N/A | N/A | Stub-only mode |
| Admin / override | 100 req/min | 1000 req/hr | 5000 req/day | Explicit bypass flag |

### Quota Policy Rules

1. Staging quotas are **lower** than production quotas.
2. Per-minute soft: exceeded → `X-RateLimit-Warning` header, allow burst of +20%.
3. Per-hour hard: exceeded → `RATE_LIMITED` response.
4. Per-day hard: exceeded → `RATE_LIMITED` response, no further requests until window reset.
5. Quota buckets reset automatically at window boundary via TTL/storage expiry.
6. Quota counts are tracked in persistent storage (KV for per-minute, DO for per-hour/per-day).

## Usage Accounting Dimensions

Every cost/quota/abuse monitoring event must include the following safe dimensions:

| Dimension | Description | Example | PII/Sensitive? |
|---|---|---|---|
| `requestId` | Unique request identifier | `req-abc123` | No |
| `userKeyHash` | SHA-256 of Firebase uid | `a1b2c3d4...` | No (derived) |
| `providerMode` | Current provider mode | `live_mock`, `staging_live` | No |
| `providerName` | LLM provider name | `openai-compatible` | No |
| `modelName` | Model name | `gpt-4o-mini` | No |
| `adapterStatus` | Adapter interface status | `READY_FOR_ADAPTER` | No |
| `endpointPath` | API endpoint path | `/api/scout/suggest` | No |
| `quotaBucket` | Rate-limit tier | `authenticated-live` | No |
| `estimatedInputSize` | Approx input char count | 800 | No |
| `estimatedOutputSize` | Approx output char count | 200 | No |
| `retryCount` | Number of retries this request | 0 | No |
| `latencyMs` | Total adapter latency | 1200 | No |
| `errorCode` | Error code if any | `PROVIDER_ERROR` | No |
| `timestamp` | ISO timestamp of event | `2026-06-06T12:00:00Z` | No |
| `environment` | Deployment environment | `staging`, `production` | No |

### Prohibited Fields (Never in Cost/Quota/Abuse Events)

```text
- raw Firebase ID token
- API key / SCOUT_SUGGEST_LLM_API_KEY
- authorization header / bearer token
- prompt (raw assembled prompt text)
- excerpt, summary, memo (user-entered text)
- rawProviderResponse / rawModelOutput
- sourceUrl with sensitive query parameters
- email (raw)
- phone
- password / secret
- cookie / session
- raw userId (use hashed only)
- raw client IP (use hashed only)
```

## Abuse Monitoring Policy

### Abuse Detection Signals

| Signal | Detection Method | Severity |
|---|---|---|
| Repeated failed requests (>80% failure rate in 5 min) | Per-user failure rate monitor | Medium |
| Repeated `CONFIG_MISSING` / `PROVIDER_UNAVAILABLE` probes | Per-user error code frequency | Low |
| Burst traffic (>3x normal per-user rate) | Per-user rate comparison | Medium |
| Repeated safety filter violations (3+ in 1 hour) | Per-user safety filter block counter | High |
| Suspicious `sourceUrl` patterns (IP address URLs, internal hostnames) | URL pattern check (basic heuristics) | Low |
| Repeated timeout/retry exhaustion (5+ in 1 hour) | Per-user timeout counter | Medium |
| Same input sent repeatedly (>10 identical excerpts in 5 min) | Input hash comparison | Low |
| Requests from unusual geographic region | `CF-IPCountry` header (where available) | Low |

### Severity Levels

| Severity | Action | Notification |
|---|---|---|
| **Low** | Log event, no automatic action | Log only |
| **Medium** | Log event, soft throttle (reduce quota by 50% for 15 min) | Channel notification |
| **High** | Log event, hard block (suspend live mode for user for 1 hour) | Channel notification + on-call |
| **Critical** | Log event, environment-level kill switch | Pager/alert + on-call |

## Suspicious Usage Reporting

### Report Format

Suspicious usage reports must contain **safe metadata only**:

```json
{
  "reportId": "sus-20260606-001",
  "timestamp": "2026-06-06T12:00:00Z",
  "severity": "medium",
  "signal": "repeated_failed_requests",
  "userKeyHash": "a1b2c3d4...",
  "environment": "staging",
  "failureRate": 0.85,
  "totalRequests": 20,
  "failedRequests": 17,
  "windowMinutes": 5,
  "action": "soft_throttle"
}
```

### Report Content Rules

- No prompt text, excerpt, summary, memo, raw output, API key, token, or PII
- `userKeyHash` only — never raw uid, email, or IP
- Severity levels: `low`, `medium`, `high`, `critical`
- Action taken: `log_only`, `soft_throttle`, `hard_block`, `kill_switch`

### Report Delivery

| Severity | Delivery | Target |
|---|---|---|
| Low | Log only (structured JSON) | Log storage |
| Medium | Channel notification | Monitoring channel |
| High | Channel notification + email | Monitoring channel + ops |
| Critical | Pager/alert + email | On-call |

## Provider Failure Accounting

### Failure Counters

| Counter | Scope | Reset | Threshold Before Action |
|---|---|---|---|
| Timeout count | Per-user, rolling 1h window | On window expiry | 5 → soft throttle, 10 → hard block |
| Retry exhaustion count | Per-user, rolling 1h window | On window expiry | 5 → soft throttle |
| Malformed provider response count | Per-user, rolling 1h window | On window expiry | 3 → soft throttle |
| Safety filter block count | Per-user, rolling 1h window | On window expiry | 3 → hard block |
| Provider unavailable count | Per-provider, rolling 1h window | On window expiry | 10 → provider health check, 50 → kill switch |
| Config missing count | Per-user, rolling 1h window | On window expiry | 10 → soft throttle |

### Failure Accounting Rules

1. All counters are stored in persistent storage (KV for soft counts, DO for hard counts).
2. Counters are per-user except `provider_unavailable` which is per-provider.
3. Thresholds reset automatically on window expiry.
4. When threshold is exceeded, the defined action is taken.
5. Failure accounting data is **never exposed to users** — only internal monitoring.
6. Failure accounting events are logged with safe fields only.

## Abuse Escalation Policy

### Escalation Stages

| Stage | Trigger | Action | Duration | Escalation |
|---|---|---|---|---|
| **1 — Monitor** | Low severity signal | Log event | N/A | Auto-escalate if same signal repeats 3x in 1h |
| **2 — Soft Throttle** | Medium severity signal | Reduce per-user quota by 50% for 15 min | 15 min | Auto-escalate to Hard Block if 3+ soft throttles in 1h |
| **3 — Hard Block** | High severity signal | Suspend live mode for user for 1 hour | 1 hour | Manual escalation to Kill Switch |
| **4 — Kill Switch** | Critical severity signal | Disable live mode for entire environment | Manual reset | Environment admin only |

### Escalation Safety

- Hard block must not affect other users (per-user scope).
- Kill switch must not affect other environments (staging vs production).
- All escalation actions must be logged with safe event fields.
- Manual override must require documented approval.

## Manual Kill-Switch Trigger Policy

### Triggers

| Trigger | Condition | Action | Required Approval |
|---|---|---|---|
| Cost cap exceeded | Per-environment daily cost cap exceeded (hard stop tier) | Auto-disable live mode, environment-level | Automated (policy-defined), notify admin |
| Abuse threshold exceeded | High severity abuse signal sustained > 5 min | Manual kill-switch | On-call engineer |
| Provider error spike | Provider error rate > 50% in 5 min window | Manual kill-switch | On-call engineer |
| Latency spike | p95 latency > 30s for 5 min window | Manual kill-switch | On-call engineer |
| Safety filter spike | Safety filter block rate > 30% in 5 min window | Manual kill-switch | On-call engineer |
| Suspicious traffic spike | Request rate > 10x normal for 5 min window | Manual kill-switch | On-call engineer |

### Kill-Switch Execution

```text
1. Set SCOUT_SUGGEST_PROVIDER_MODE=stub (or unset)
2. Set SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=false
3. Verify endpoint returns providerMode:"stub" (automated check)
4. Verify frontend returns to local_stub (manual check)
5. Rotate provider API key if exposure suspected
6. Document incident and trigger reason
7. Notify product owner
```

## Monitoring Outputs Required Before Staging Live

Before enabling `staging_live`:

| Output | Format | Update Frequency |
|---|---|---|
| Daily quota summary | JSON report (request count by user, tier, window) | Daily |
| Cost estimate summary | JSON report (estimated cost by user, total) | Daily |
| Error code summary | JSON report (error count by code, user, provider) | Daily |
| Abuse event summary | JSON report (abuse signals, severity, actions) | Daily |
| Provider failure summary | JSON report (failure counters, threshold hits) | Daily |

All monitoring outputs must use **safe fields only** — no prompt, excerpt, raw output, API key, token, PII.

## Monitoring Outputs Required Before Production Live

Before enabling `production_live`:

| Output | Format | Requirements |
|---|---|---|
| Staging soak report | Document | Minimum 7 days staging with no critical abuse incident |
| Cost trend | Chart/summary | At least 14 days of cost data showing stable/expected usage |
| Abuse trend | Chart/summary | At least 14 days of abuse event data showing no escalation pattern |
| Rollback drill result | Document | Successful rollback from live mode to stub (documented) |
| Kill-switch drill result | Document | Successful kill-switch execution (documented) |

## Privacy / Logging Policy

### Allowed Fields (Cost / Quota / Abuse Monitoring)

```text
- requestId
- userKeyHash (SHA-256 of uid)
- providerMode
- providerName
- modelName
- adapterStatus
- endpointPath
- quotaBucket
- estimatedInputSize
- estimatedOutputSize
- retryCount
- latencyMs
- errorCode
- timestamp
- environment
- severity (for abuse events)
- action (for abuse events)
- failureCounter values
```

### Prohibited Fields (Never in Monitoring)

```text
- raw Firebase ID token
- API key / SCOUT_SUGGEST_LLM_API_KEY
- authorization header / bearer token
- prompt (raw assembled prompt)
- excerpt, summary, memo
- rawProviderResponse / rawModelOutput
- sourceUrl with sensitive query parameters
- email (raw)
- phone
- password / secret
- cookie / session
- raw uid (use hashed only)
- raw client IP (use hashed only)
```

### Logging Rules

1. All cost/quota/abuse events must pass through `sanitizeScoutLiveProviderLogPayload` or equivalent.
2. Logger failures must never break request flow.
3. Structured JSON logging for all monitoring events.
4. Do not log every rate-limit counter increment — only threshold events (quota reached, quota reset, rate-limited response, abuse signal, failure threshold hit).

## Verdict

| Question | Answer |
|---|---|
| Ready for cost/quota monitoring documentation | ✅ Yes (this document) |
| Ready for runtime monitoring implementation | ❌ No — implementation deferred |
| Ready for staging_live execution | ❌ No — monitoring outputs not yet produced |
| Ready for production_live execution | ❌ No — all production gates not satisfied |
| Ready for real provider API call in this slice | ❌ No — docs+tests only |
| Endpoint default remains stub | ✅ Yes |
| Frontend default remains local_stub | ✅ Yes |
| Cost cap policy defined | ✅ Yes |
| Quota budget policy defined | ✅ Yes |
| Usage accounting dimensions defined | ✅ Yes |
| Abuse monitoring policy defined | ✅ Yes |
| Suspicious usage reporting defined | ✅ Yes |
| Provider failure accounting defined | ✅ Yes |
| Abuse escalation policy defined | ✅ Yes |
| Manual kill-switch trigger policy defined | ✅ Yes |
| Monitoring outputs defined | ✅ Yes |
| Privacy/logging policy defined | ✅ Yes |

## Recommended Next Slice

**[TECH] Add Scout live provider secret rotation and incident runbook contract** → ✅ Completed (PR #2267)

**Why:** After cost/quota/abuse monitoring is defined, the next requirement before any real provider call is secret rotation, incident response, rollback drill procedure, and provider compromise handling. This slice would document the operational runbook without implementing secrets infrastructure.

**Alternative:**
```
[TECH] Implement Scout Firebase auth verification boundary
```
This would be the first implementation slice that actually wires Firebase Admin SDK token verification behind the `live` mode flag — still no real provider call, but auth logic becomes testable with mock tokens.

## Production Readiness Gates Audit Status

A consolidated [production readiness gates audit](lovebud-scout-live-provider-production-readiness-gates-audit.md) has been completed. It provides:
- Go/no-go matrix for first real provider adapter, staging_live, and production_live
- Endpoint default remains stub; UI default remains local_stub
- First provider-specific adapter skeleton is conditional only if disabled-by-default and no provider API call
- staging_live and production_live remain blocked
- Real provider API call remains blocked in the current slice

## Non-goals (this document)

- ❌ No real LLM provider implementation
- ❌ No provider SDK imports
- ❌ No API keys or environment variables
- ❌ No Firebase Admin SDK integration
- ❌ No KV/Durable Object/D1 implementation
- ❌ No runtime cost/quota monitoring implementation
- ❌ No endpoint behavior change
- ❌ No frontend behavior change
- ❌ No persistence or auto-save
- ❌ No Browse #1661 work

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
