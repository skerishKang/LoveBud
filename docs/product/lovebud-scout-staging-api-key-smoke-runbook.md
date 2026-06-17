# LoveBud Scout Staging API-Key Smoke Runbook

## Scope

- Staging-only manual smoke test for the Scout API-key provider transport path.
- Coverage: env/secret verification → curl smoke → safe-fail assertion → rollback confirmation.
- Not for production use. Not automated. Not part of CI.

## Preconditions

- Cloudflare Pages/Workers **staging** environment is deployed.
- Operator has:
  - Staging URL (e.g. `https://staging.lovebud.app` or CF preview URL)
  - Valid staging `Authorization: Bearer <staging-test-token>`
  - Cloudflare dashboard access (to set secrets)
- All code changes from the following have been deployed:
  - #2627 (API-key provider transport module)
  - #2629 (live adapter wiring)
  - #2630 (endpoint wiring)

## Required staging secrets and env vars

### Cloudflare Secrets (set via dashboard or `wrangler secret`)

| Secret name | Example value | Notes |
|---|---|---|
| `SCOUT_SUGGEST_LLM_API_KEY` | `<provider-api-key>` | Set as **Cloudflare Secret only**. Never in code, `.env`, docs, or PR body. |

### Cloudflare Environment Variables (set via dashboard or `wrangler`)

| Variable | Expected value | Purpose |
|---|---|---|
| `SCOUT_SUGGEST_PROVIDER_MODE` | `live` | Enable live provider path |
| `SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED` | `true` | Enable live adapter interface |
| `SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE` | `api_key` | Select API-key transport |
| `SCOUT_SUGGEST_PROVIDER_STAGE` | `staging` | **Must be `staging`** — production is blocked |
| `SCOUT_SUGGEST_LLM_PROVIDER` | `openai-compatible` | Provider protocol (chat-completions-v1) |
| `SCOUT_SUGGEST_MODEL` | `<model-name>` | Model identifier (e.g. `glm-5.2`) |
| `SCOUT_SUGGEST_LLM_BASE_URL` | `<provider-endpoint>` | Provider API base URL (e.g. `https://zenmux.ai/api/v1`) |

**Critical rules:**
- `SCOUT_SUGGEST_LLM_API_KEY` must be a **Cloudflare Secret**, not a plain environment variable.
- `SCOUT_SUGGEST_PROVIDER_STAGE` must be `staging` for staging tests. `production` blocks all provider calls.
- Never commit real values to GitHub, `.env`, docs, tests, or PR body.
- Use placeholder examples only in documentation and smoke commands.

## Manual smoke request

Send a request to the staging endpoint:

```bash
curl -v -X POST "$STAGING_URL/api/scout/suggest" \
  -H "content-type: application/json" \
  -H "authorization: Bearer <staging-test-token>" \
  -d '{
    "excerpt": "Went to the park and fed the ducks.",
    "requestedLanguage": "en",
    "desiredTone": "polite",
    "maxOutputLength": 80
  }'
```

The `excerpt` value must be short, public, fan-safe text only. No secrets, no PII, no real user data.

## Expected success response shape

```json
{
  "ok": true,
  "providerMode": "live_api_key",
  "suggestion": {
    "content": "…",
    "provider": "openai-compatible",
    "model": "<model-name>"
  }
}
```

- `suggestion.content` must not contain API keys, bearer tokens, raw provider output, or any prohibited fields.
- `providerMode` must be `live_api_key`.
- The request id is returned in the `x-lovebud-request-id` response header, not in the JSON body.

## Expected safe-fail responses

| Scenario | Expected code | Notes |
|---|---|---|
| Missing `Authorization` header | `UNAUTHORIZED` | Auth boundary |
| Invalid Bearer token | `UNAUTHORIZED` | Auth boundary |
| Rate limit exceeded | `RATE_LIMITED` | Rate-limit boundary |
| `SCOUT_SUGGEST_PROVIDER_STAGE=production` | `PROVIDER_UNAVAILABLE` or gate error | Production blocked |
| Missing `SCOUT_SUGGEST_LLM_API_KEY` | `CONFIG_MISSING` | Safe-fail before fetch |
| Missing `SCOUT_SUGGEST_MODEL` | `CONFIG_MISSING` | Safe-fail before fetch |
| Wrong `SCOUT_SUGGEST_LLM_PROVIDER` | `CONFIG_MISSING` | Safe-fail before fetch |
| Network error / provider down | `PROVIDER_ERROR` | Sanitized — no raw error text |
| Malformed provider response | `PROVIDER_ERROR` | Sanitized — no raw response |

All safe-fail responses return `{ "ok": false, "error": { "code": "…", "message": "…" } }` with no raw provider output, API key, or prompt text. The request id is returned in the `x-lovebud-request-id` response header, not in the JSON body.

## Log and privacy rules

- `prompt`, `excerpt`, `sourceUrl`, API keys, bearer tokens, raw provider responses must never appear in logs.
- Logged fields are limited to: `requestId`, `providerMode`, `status`, `errorCode`, `latencyMs`, `inputLength`, `language`, `tone`.
- Always sanitize before persisting any observability data.
- No auto-save or persistence of provider responses.

## Rollback / kill switch

If smoke test reveals issues or staging misbehaves, use any of the following to immediately disable the live provider path:

| Action | Mechanism |
|---|---|
| Set `SCOUT_SUGGEST_PROVIDER_MODE=stub` | Forces stub mode, no provider path |
| Set `SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=false` | Disables adapter, safe-fail |
| Remove `SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE` | No transport selected, safe-fail |
| Set `SCOUT_SUGGEST_PROVIDER_STAGE=production` | Stage gate blocks all provider calls |
| Set `SCOUT_SUGGEST_LLM_API_KEY` to empty | Missing API key gate blocks fetch |
| Redeploy previous known-good version | Full rollback |

All kill switches are env/secret changes — no code change needed. Apply via Cloudflare dashboard or `wrangler` and redeploy.

## Production activation blockers

The following must all be resolved before production activation:

- [ ] Production readiness gates audit sign-off
- [ ] Secret rotation and incident runbook contract sign-off
- [ ] Cost/quota abuse monitoring contract sign-off
- [ ] Firebase auth enforcement fully implemented (not placeholder)
- [ ] Rate-limit persistence fully implemented (not placeholder)
- [ ] Staging soak test report with no regressions
- [ ] Production kill switch drill completed
- [ ] Monitoring and alerting configured with sanitized log pipeline
- [ ] No real provider API call in normal CI
- [ ] No frontend provider call
- [ ] No raw provider response or secret exposure in any path

Normal CI must remain network-free. Frontend must never call a provider directly.

## Verification checklist

- [ ] All required env vars and secrets documented (7 env vars + 1 secret)
- [ ] Staging-only mode confirmed
- [ ] Production activation remains blocked
- [ ] Rollback / kill switch procedures documented
- [ ] No real API key values in this document
- [ ] No `.env` file committed
- [ ] No prompt/excerpt/sourceUrl/API key/rawProviderResponse exposed
- [ ] Smoke request uses placeholder secrets only
- [ ] Privacy and logging rules documented
- [ ] Refs #1882 (keeps #1882 open)
