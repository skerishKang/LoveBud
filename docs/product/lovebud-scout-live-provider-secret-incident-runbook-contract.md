# LoveBud Scout Live Provider Secret Rotation and Incident Runbook Contract

## Document Status

- **Status**: Complete — defines secret storage policy, rotation policy, emergency revocation, incident response workflow, severity levels, rollback/kill-switch drills, provider compromise handling, and post-incident review for the Scout live provider path. Provider-specific adapter skeleton added behind disabled mode.
- **current main HEAD**: `f7d37545`
- **related issue**: #1882
- **Browse #1661** remains out of scope
- **current live provider status**: provider-specific adapter skeleton added; disabled-by-default; no provider API call; staging_live and production_live remain blocked

## Baseline

- Endpoint default remains **`stub`** — deterministic, network-free, no API key
- Frontend default remains **`local_stub`** — no network, no endpoint client
- Live mode safe-fails to `PROVIDER_UNAVAILABLE` or `CONFIG_MISSING` in all states
- No real provider SDK import, no fetch, no API key value propagation
- Staging rollout, auth/rate-limit, cost/quota abuse contracts complete
- Real provider API call verdict: **No** (all slices to date)
- Provider-specific adapter skeleton exists, disabled by default, returns safe-fail

## Current State

Secret rotation, emergency revocation, and incident response are **not implemented** at runtime. The provider-specific adapter skeleton is added behind disabled mode. The deployment checklist defines high-level secret management rules but does not specify rotation frequency, emergency revocation workflow, incident severity levels, or provider compromise handling. This contract fills that gap.

## Purpose

- 이 문서는 Scout live provider 운영 시 secret 관리, incident 응답, rollback drill, provider compromize 대응을 정의한다.
- 실제 secret rotation runtime, incident handler runtime은 구현하지 않는다 — 이 문서는 **운영 runbook 계약(operational runbook contract)**이다.
- 실제 구현은 별도의 slice에서 진행한다.

## Non-goals

- No real LLM provider implementation
- No provider SDK imports
- No API keys or environment variables
- No secret rotation execution
- No Firebase Admin SDK integration
- No KV/Durable Object/D1 implementation
- No runtime secret management implementation
- No endpoint behavior change
- No frontend behavior change
- No persistence or auto-save
- No Browse #1661 work

## Secret Storage Policy

| Rule | Description |
|---|---|
| Platform secret storage only | Provider API keys stored exclusively in Cloudflare Pages/Workers Secrets or equivalent platform secret store |
| No committed secrets | API keys must never appear in repository, commits, or deployment artifacts |
| No frontend secrets | API keys must never be sent to or stored in browser JS, HTML, or localStorage |
| No log/error exposure | API keys must never appear in logs, error messages, console output, or response bodies |
| Staging/prod separated | Staging and production secrets must use separate key names and separate secret storage scopes |
| Least-privilege keys | If provider supports scoped/restricted keys, use the least privilege key that can perform suggestion prompts |
| Preview secret isolation | Preview/PR branch deployments must not have access to staging or production secrets |

## Secret Rotation Policy

### Scheduled Rotation

| Parameter | Value |
|---|---|
| Rotation frequency | Every 90 days |
| Rotation window | Scheduled during low-traffic period (e.g., Sunday 02:00–04:00 UTC) |
| Rotation owner | DevOps / Platform team |
| Rotation method | Generate new key in provider dashboard, update platform secret, verify, deprecate old key |
| Notification | 7 days before rotation: channel notification; 1 day before: reminder; after: verification confirmation |

### Rotation Workflow

```
1. Generate new provider API key (provider dashboard / API)
2. Add new key as secondary secret in platform secret store (dual-key mode if supported)
3. Verify new key works via health check or test request (staging only)
4. Switch primary secret reference to new key
5. Verify live mode still works (staging only — no real provider call in current slice)
6. Deprecate old key in provider dashboard (after verification window, e.g., 24h)
7. Remove old key from platform secret store
8. Document rotation event (safe metadata only: timestamp, rotated by, verification status)
```

### Dual-Key / Staged Rollout Strategy

If the provider supports multiple active keys (e.g., OpenAI API key groups):

```text
1. Add new key alongside existing key (no disruption)
2. Route a percentage of staging traffic to new key (if supported)
3. After verification window, switch all traffic to new key
4. Deprecate old key
```

If dual-key is not supported:

```text
1. Generate new key
2. Schedule rotation during low-traffic window
3. Update platform secret (brief switching window)
4. Verify immediately after update
5. If verification fails within 60 seconds, roll back to old key
```

### Verification After Rotation

```text
1. Send test request to staging endpoint with providerMode=live (stub/safe-fail is acceptable in current slice — real verification when runtime exists)
2. Check response is ok (or safe-fail is expected)
3. Check logs for no secret leakage
4. Confirm adapter interface status is READY_FOR_ADAPTER or CONFIG_MISSING (expected)
```

### Rollback After Failed Rotation

```text
1. Restore previous API key in platform secret store
2. Verify previous key works
3. Document rotation failure (timestamp, cause, action taken)
4. Schedule retry after root cause addressed
```

## Emergency Revocation Policy

### Triggers for Emergency Revocation

| Trigger | Example |
|---|---|
| Suspected key leakage | Key found in public repository, log, or third-party alert |
| Provider compromise | Provider reports security incident or recommends key rotation |
| Abuse spike | Suspicious usage pattern detected across multiple users |
| Accidental exposure | Key committed to git, displayed in error response, or logged |

### Emergency Revocation Workflow

```
1. IMMEDIATELY disable live adapter flag (SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=false)
2. Set provider mode to stub (SCOUT_SUGGEST_PROVIDER_MODE=stub)
3. Revoke compromised key in provider dashboard
4. Rotate to new key (following rotation workflow above)
5. Verify no request path can reach old key
6. Verify endpoint returns providerMode:"stub"
7. Verify frontend uses local_stub
8. Document incident
9. Review blast radius (how many requests used compromised key, what data was exposed)
```

### Post-Revocation Verification

```text
1. Send test request to endpoint — verify providerMode:"stub" (not live)
2. Check adapter interface — verify DISABLED or CONFIG_MISSING
3. Check logs — verify no secret value in any log line
4. If revoked key was exposed externally, rotate ALL provider secrets (not just one key)
5. Notify product owner and security contact
```

## Incident Response

### Incident Response Triggers

| # | Trigger | Detection Method |
|---|---|---|
| 1 | Provider API key leakage | GitGuardian alert, external report, log review |
| 2 | Provider compromise | Provider security advisory, dashboard alert |
| 3 | Abuse spike | Monitoring: request rate > 10x normal for 5 min |
| 4 | Cost cap exceeded | Monitoring: daily cost cap hard stop triggered |
| 5 | Provider error spike | Monitoring: provider error rate > 50% in 5 min |
| 6 | Timeout/retry exhaustion spike | Monitoring: timeout/retry rate > 30% in 5 min |
| 7 | Safety filter spike | Monitoring: safety filter block rate > 30% in 5 min |
| 8 | Unsafe output report | User report or automated content review |
| 9 | Logging leak | Log review finding prompt/excerpt/API key in log output |

### Incident Severity Levels

| Level | Label | Definition | Response Time | Escalation |
|---|---|---|---|---|
| **SEV0** | Emergency Kill Switch | Active security incident, confirmed key leakage, or PII/data exposure | Immediate (< 5 min) | Direct to on-call engineer + product owner |
| **SEV1** | Provider Disabled | Provider unavailable, provider compromise reported, or critical error spike > 50% | < 15 min | On-call engineer |
| **SEV2** | Degraded Live Provider | Partial provider degradation, cost cap near limit, or error spike > 30% | < 1 hour | Platform team |
| **SEV3** | Monitoring Only | Suspicious usage pattern, safety filter rate increase, or logging concern | < 24 hours | Logged for review |

### Incident Workflow

```
1. DETECT: Automated monitoring or manual report
2. CLASSIFY: Determine severity level (SEV0–SEV3)
3. CONTAIN: For SEV0–SEV1, immediately disable live mode (kill switch); for SEV2, soft throttle or restrict; for SEV3, monitor
4. DISABLE: Set SCOUT_SUGGEST_PROVIDER_MODE=stub; set SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=false
5. ROTATE/REVOKE: If key leakage, revoke and rotate immediately
6. VALIDATE: Verify endpoint returns stub, verify logs show no secret values
7. COMMUNICATE: Notify affected users (if any), product owner, and team via monitoring channel
8. RESTORE: After root cause addressed, restore live mode gradually (staging first)
9. REVIEW: Post-incident review within 5 business days
```

## Rollback Drill Policy

### Drill Scenarios

| Scenario | Action | Verification |
|---|---|---|
| Rollback from production_live to staging_live | Set `SCOUT_SUGGEST_PROVIDER_MODE=staging_live` | Endpoint returns `providerMode:"staging_live"` or safe-fail; frontend still `local_stub` |
| Rollback from staging_live to endpoint_stub | Set `SCOUT_SUGGEST_PROVIDER_MODE=stub` (or unset) | Endpoint returns `providerMode:"stub"` |
| Fallback to local_stub (full kill) | Set `SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=false` + unset `SCOUT_SUGGEST_PROVIDER_MODE` | Frontend uses `local_stub`; endpoint returns stub |
| No data migration rollback | No DB, KV, D1, or storage changes required | No rollback needed — confirmed by design (no auto-save, no persistence) |

### Drill Frequency

| Drill | Frequency | Environment |
|---|---|---|
| staging_live → endpoint_stub rollback | Monthly | Staging |
| Kill switch activation | Quarterly | Staging |
| Full local_stub fallback | Quarterly | Staging |
| Production rollback dry run | Biannually | Staging (documented, not production) |

### Drill Documentation

Each drill must produce a short report with:

```text
- Date and time
- Drill scenario
- Steps executed
- Results (pass/fail per verification step)
- Any unexpected behavior
- Action items (if any)
```

## Kill-Switch Drill Policy

### Drill Steps

```
1. Trigger: Manually set SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=false
2. Verify: Send POST to /api/scout/suggest — response providerMode is "stub"
3. Verify: Adapter interface returns DISABLED status
4. Verify: No live adapter invocation occurred (check logs for absence of live adapter events)
5. Verify: Frontend source selector still resolves local_stub
6. Restore: Re-enable live adapter flag
7. Verify: Original live mode behavior restored (safe-fail or expected state)
```

### Post-Drill Verification

```text
1. All verification steps pass
2. Logs show no secret leakage
3. No auto-save or persistence occurred during drill
4. Drill documented (timestamp, executor, results, any anomalies)
```

## Provider Compromise Handling

### Compromise Detection

| Signal | Action |
|---|---|
| Provider security advisory | Immediately initiate SEV0 |
| Dashboard shows unauthorized usage | Immediately initiate SEV0 |
| Unexplained cost spike | Immediately initiate SEV1 |
| Provider rate-limits our account unexpectedly | Investigate (SEV2) |

### Compromise Response Workflow

```
1. TRIGGER KILL SWITCH: Set SCOUT_SUGGEST_PROVIDER_MODE=stub, disable live adapter flag
2. REVOKE ALL KEYS: Revoke every provider API key associated with the compromised provider
3. ROTATE TO NEW KEYS: Generate new keys and update platform secrets
4. BLOCK PROVIDER: If provider-specific, block routing to that provider name/model in adapter config
5. VERIFY: Confirm no request path can reach compromised provider
6. AUDIT: Review logs for usage data, cost impact, and any user data exposure
7. NOTIFY: Inform product owner, security team, and affected users (if any)
8. RE-APPROVAL: Require manual approval before re-enabling any provider for that environment
9. POST-INCIDENT REVIEW: Within 5 business days
```

### Recovery Gates

Before re-enabling a provider after compromise:

```text
- [ ] Provider confirms incident resolved
- [ ] New API keys generated and stored in platform secret storage
- [ ] Kill switch drill passed (environment)
- [ ] Logging redaction verified
- [ ] No unauthorized usage detected for 24h (monitoring window)
- [ ] Manual approval obtained (product owner + security)
- [ ] Rollback plan verified
```

## Post-Incident Review

### Review Requirements

Every SEV0 or SEV1 incident must have a post-incident review within 5 business days.

### Review Template

```markdown
## Post-Incident Review

- **Incident ID**: INC-YYYYMMDD-NNN
- **Severity**: SEV0 / SEV1 / SEV2 / SEV3
- **Date**: YYYY-MM-DD
- **Duration**: X hours X minutes
- **Trigger**: (what detected the incident)
- **Root Cause**: (one sentence)
- **Blast Radius**: (number of affected users, requests, cost impact, data exposure)
- **User Impact**: (what users experienced)
- **Cost Impact**: (if applicable, estimated cost of incident)
- **Safety Impact**: (if applicable, was unsafe content returned)
- **Follow-Up Issues**: (list of GitHub issues created)
- **Reviewer**: (name)
- **Approved By**: (name)
```

### Review Content Rules

- No secret values, API keys, tokens, or raw credentials
- No user PII (use hashed identifiers only)
- No raw prompt or model output data
- Cost impact reported as estimated range, not exact dollar amount in public doc

## Privacy / Logging Policy

### Allowed Fields (Secret / Incident Monitoring)

```text
- requestId
- userKeyHash (SHA-256 of uid)
- providerMode
- providerName
- modelName
- adapterStatus
- endpointPath
- errorCode
- latencyMs
- timestamp
- environment
- incidentId
- severity (SEV0–SEV3)
- rotationEvent ("scheduled", "emergency", "rollback")
- verificationStatus
```

### Prohibited Fields (Never in Secret / Incident Events)

```text
- raw provider API key (SCOUT_SUGGEST_LLM_API_KEY value)
- authorization header / bearer token
- raw Firebase ID token
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
- old API key value
- new API key value
```

### Logging Rules

1. All secret/incident events must pass through `sanitizeScoutLiveProviderLogPayload` or equivalent.
2. Secret rotation events must not include old or new key values.
3. Incident events must not include credentials, tokens, or raw user data.
4. Logger failures must never break incident response flow.

## Verdict

| Question | Answer |
|---|---|
| Ready for secret/incident documentation | ✅ Yes (this document) |
| Ready for runtime secret rotation implementation | ❌ No — implementation deferred |
| Ready for staging_live execution | ❌ No — secret/incident not yet operationalized |
| Ready for production_live execution | ❌ No — all production gates not satisfied |
| Ready for real provider API call in this slice | ❌ No — docs+tests only |
| Endpoint default remains stub | ✅ Yes |
| Frontend default remains local_stub | ✅ Yes |
| Secret storage policy defined | ✅ Yes |
| Secret rotation policy defined | ✅ Yes |
| Emergency revocation policy defined | ✅ Yes |
| Incident response workflow defined | ✅ Yes |
| Incident severity levels defined | ✅ Yes |
| Rollback drill policy defined | ✅ Yes |
| Kill-switch drill policy defined | ✅ Yes |
| Provider compromise handling defined | ✅ Yes |
| Post-incident review defined | ✅ Yes |
| Privacy/logging policy defined | ✅ Yes |

## Recommended Next Slice

```
[PRODUCT] Audit Scout live provider production readiness gates
```

**Why:** After all design contracts (staging rollout, auth/rate-limit, cost/quota abuse, secret/incident) are complete, the next logical step is a consolidated production readiness audit. This audit would inventory all documented boundaries, identify remaining implementation gaps before any real provider adapter, and produce a final verdict on whether the first real provider adapter slice can begin.

**What it would include:**
- Comprehensive inventory of all documented boundaries (9+ contracts)
- Implementation status matrix (documented vs implemented)
- Remaining blocker list before any real provider API call
- Final readiness verdict for first real provider adapter slice
- No runtime changes, no provider calls, no secrets

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
- ❌ No secret rotation execution
- ❌ No Firebase Admin SDK integration
- ❌ No KV/Durable Object/D1 implementation
- ❌ No runtime secret management implementation
- ❌ No endpoint behavior change
- ❌ No frontend behavior change
- ❌ No persistence or auto-save
- ❌ No Browse #1661 work
