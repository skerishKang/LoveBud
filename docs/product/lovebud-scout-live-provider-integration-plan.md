# Scout Live Provider Integration Plan

- **Issue**: #2616
- **Parent Issue Reference**: #1882 (Keeps #1882 open.)

---

## 1. Current Status Summary
- **UI/Scaffold/Contracts**: Fully present in the repository. The frontend and stub adapters are wired up.
- **Stub-First Endpoint**: The `functions/api/scout/suggest.js` serves mock responses by default.
- **Skeleton-Safe Live Path**: The `functions/api/scout/live-provider-adapter.js` defines configuration validation and prompt builders but safely rejects execution without live provider connections.
- **Provider Adapter safe-fails**: Without active configuration gates, the adapter falls back immediately to safe default errors without initiating real provider requests.

---

## 2. First Provider Decision
- **Allowed First Provider Candidates**: The initial implementation will choose exactly one of:
  - **OpenAI-compatible** endpoint
  - **OpenRouter-compatible** endpoint
  - **NVIDIA/OpenAI-compatible** endpoint
- **Single Provider Focus**: Supporting a multi-provider router is a non-goal for this stage. Multi-provider routing architecture is strictly forbidden to limit complexity.

---

## 3. Required Gates
Any real provider call must strictly enforce that all the following gates pass before execution:
- `SCOUT_SUGGEST_PROVIDER_MODE=live`
- `SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=true`
- `SCOUT_SUGGEST_LLM_PROVIDER` must be present.
- `SCOUT_SUGGEST_MODEL` must be present.
- `SCOUT_SUGGEST_LLM_API_KEY` must be present and fetched *only* as a server-side Cloudflare secret.
- **Auth Boundary**: Firebase ID token verification must pass beforehand.
- **Rate-limit Boundary**: Request counts must remain within the limit adapter's bounds.

---

## 4. Safe-Fail Rules
In case of any execution or gateway failure:
- **Missing Configuration**: Returns `CONFIG_MISSING` or `PROVIDER_UNAVAILABLE`.
- **Authentication Failure**: Returns the standard `UNAUTHORIZED` or `FORBIDDEN` taxonomy errors.
- **Rate Limit Exceeded**: Returns `RATE_LIMITED` or `RATE_LIMIT_UNAVAILABLE`.
- **LLM Provider Timeout/Error**: Returns `PROVIDER_UNAVAILABLE` or `PROVIDER_ERROR`.
- **No Auto-Save**: Responses must never write directly to the persistent database without user review.
- **User Review Required**: All suggestions must be audited and explicitly accepted by the user.

---

## 5. Secret Policy
- **Names Reference Only**: Code references secret names only. Real credentials must never be committed.
- **No Committed Secrets**: Committing real key values or `.env` files is strictly prohibited. There must be no .env commit.
- **Server-Side Cloudflare Secret Only**: The LLM API key must live exclusively as a Cloudflare Pages environment secret.
- **No Frontend API Keys**: Prohibits frontend API keys or exposure of secrets in browser client bundles.
- **No Secrets in Logs**: Secret values or partial credentials must never be written to console outputs or logs.
- **Environment Isolation**: Separate environment secrets must be maintained for staging and production.

---

## 6. CI/Testing Policy
- **Network-Free Default CI**: Normal CI workflows must remain entirely network-free. No active LLM fetches.
- **No Browser-Side Provider Fetch**: Browser-side LLM fetches or direct API calls from frontend JS are forbidden.
- **Mock Executor Tests**: Local unit/contract suites must rely entirely on mock execution.
- **Opt-In Integration Tests**: Real provider calls are allowed only within explicit, opt-in integration test files triggered by environment flags.
- **Static Safeguards**: Contract tests must verify the absence of raw keys, `.env` files, or client-side secret leakage.

---

## 7. Staging Plan
- **Staging-Only First**: Rollouts must target staging environments first.
- **Deployment Evidence Packet**: Activation requires a staging evidence packet capturing safe endpoint behavior.
- **Manual Verification Checklist**: Verification checks must be conducted manually against preflight lists.
- **Production Activation Separate**: Production activation is a separate phase requiring its own issue, PR, and manual approval gates.

---

## 8. Implementation Sequence
- **Step 1**: Docs/contracts plan only (this slice).
- **Step 2**: Server-side provider executor skeleton with mock executor tests.
- **Step 3**: Staging secret configuration documentation and evidence check.
- **Step 4**: Staging live opt-in integration tests.
- **Step 5**: Production activation issue (tracked independently, separate from #2616).

---

## 9. Logging & Privacy Rules
To protect user privacy and secret keys, log payloads must **never** record:
- The user prompt or content snippets.
- Excerpts of scraped source text.
- `sourceUrl` references.
- `SCOUT_SUGGEST_LLM_API_KEY` or other authorization tokens.
- PII (Personally Identifiable Information).
- Raw provider response structures containing completions (no rawProviderResponse).
