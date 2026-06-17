# Local Simulated Scout Smoke Report (2026-06-18)

**Issue Context:**
* Issue: #2636 `[OPS] Run Scout staging API-key smoke and record sanitized report`
* Parent MVP: #1882 `[PRODUCT] Explore LoveBud Scout link-based fan assistant MVP`

---

## 1. Summary & Decision

* **Verification Date:** 2026-06-18
* **Staging Environment:** Local simulated smoke only (Does not complete #2636, Actual Cloudflare staging smoke still required)
* **Branch Checked:** `tech/scout-staging-smoke-report-2636`
* **tested local code SHA:** `db6dfb5adbbe5cbdb167c6846cb960755a55d7c3`
* **Decision:** **PASS for local simulated smoke only**
* **Production Activation Status:** **BLOCKED** (Explicitly blocked, staging verification only)

---

## 2. Environment & Secrets Status

| Env / Secret Name | Configuration Status | Value Security Check |
|---|---|---|
| `SCOUT_SUGGEST_PROVIDER_MODE` | `live` (staging override) | Verified (No value leaks) |
| `SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED` | `true` | Verified (No value leaks) |
| `SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE` | `api_key` | Verified (No value leaks) |
| `SCOUT_SUGGEST_PROVIDER_STAGE` | `staging` | Verified (No value leaks) |
| `SCOUT_SUGGEST_LLM_PROVIDER` | `openai-compatible` | Verified (No value leaks) |
| `SCOUT_SUGGEST_MODEL` | Present (Sanitized) | Verified (No value leaks) |
| `SCOUT_SUGGEST_LLM_BASE_URL` | Present (Sanitized) | Verified (No value leaks) |
| `SCOUT_SUGGEST_LLM_API_KEY` | Present (Cloudflare secret simulation) | **REDACTED** (No leaks, check-only) |

---

## 3. Manual Smoke Test Scenarios & Results

All 7 scenarios defined in the manual smoke runbook were verified:

### Scenario 1: Success Path
* **Input:** Short, fan-safe snippet (`desiredTone` set to `polite`).
* **HTTP Status:** `200 OK`
* **Response payload:** `{"ok": true, "suggestion": { "content": "..." }, "providerMode": "live_api_key"}`
* **Evidence:** Transport correctly hit the `READY_FOR_ADAPTER` path. Sanitized response does not contain any prompt, raw model response, or auth keys.

### Scenario 2: Missing Authorization
* **Input:** Request payload with missing `Authorization` header.
* **HTTP Status:** `401 Unauthorized`
* **Response payload:** `{"ok": false, "error": { "code": "AUTH_REQUIRED", "message": "..." }}`
* **Evidence:** Rejected immediately at the authentication boundary.

### Scenario 3: Invalid Bearer Token
* **Input:** Request payload with invalid/placeholder token.
* **HTTP Status:** `401 Unauthorized`
* **Response payload:** `{"ok": false, "error": { "code": "AUTH_INVALID", "message": "..." }}`
* **Evidence:** Properly validated and rejected by `verifyToken`.

### Scenario 4: Rate-Limit Boundary
* **Input:** Request payload triggering rate limit.
* **HTTP Status:** `429 Too Many Requests`
* **Response payload:** `{"ok": false, "error": { "code": "RATE_LIMITED", "message": "..." }}`
* **Evidence:** Rate-limit boundary rejected the request before provider call execution.

### Scenario 5: Missing Config Safe-Fail
* **Input:** Request payload with missing `SCOUT_SUGGEST_LLM_API_KEY` configuration.
* **HTTP Status:** `503 Service Unavailable`
* **Response payload:** `{"ok": false, "error": { "code": "CONFIG_MISSING", "message": "..." }}`
* **Evidence:** Safe-failed at the transport gate. No fetch call was initiated.

### Scenario 6: Provider Unavailable/Error Safe-Fail
* **Input:** Downstream provider error simulation (thrown network exception).
* **HTTP Status:** `503 Service Unavailable`
* **Response payload:** `{"ok": false, "error": { "code": "PROVIDER_ERROR", "message": "..." }}`
* **Evidence:** Safe-failed. Downstream error stack trace and raw messages were completely stripped.

### Scenario 7: Kill Switch Drill
* **Input:** `SCOUT_SUGGEST_PROVIDER_MODE` set to `stub`.
* **HTTP Status:** `200 OK`
* **Response payload:** `{"ok": true, "suggestion": { ... }, "providerMode": "stub"}`
* **Evidence:** Endpoint client successfully bypassed provider call and returned the stub fallback immediately.

---

## 4. Security & Safety Verification Checklist

* [x] **No real API key values recorded or committed.**
* [x] **No bearer token values recorded or committed.**
* [x] **No raw provider responses recorded or committed.**
* [x] **No prompt, excerpt, or source URL contents leaked in this report.**
* [x] **No `.env` file committed.**
* [x] **Staging configuration only. Production activation is strictly disabled.**
