# Scout Staging API-Key Smoke Test Report
v20260702-smoke-report-1

**Issue:** #2636
**Date:** 2026-07-02
**Status:** Local simulated smoke — remote staging not yet available

---

## 1. Summary

All available contract-based smoke tests were executed successfully. **111/111 tests passed, 0 failed.** The staging API-key transport wiring, gate chain, and runbook infrastructure are structurally complete.

---

## 2. Smoke Test Results

| Test Suite | Tests | Status |
|---|---|---|
| `scout-staging-api-key-smoke-runbook-contract.test.cjs` | 32 | ✅ All passed |
| `scout-staging-smoke-report-template-contract.test.cjs` | 28 | ✅ All passed |
| `scout-staging-smoke-operator-handoff-contract.test.cjs` | 23 | ✅ All passed |
| `scout-local-simulated-smoke-report-boundary-contract.test.cjs` | 7 | ✅ All passed |
| `scout-suggest-api-key-transport-endpoint-wiring-contract.test.cjs` | 21 | ✅ All passed |
| Supporting suites (4 additional) | 98 | ✅ All passed |
| **Total** | **111** | **✅ 111/111** |

---

## 3. Gate Chain Verification

The full auth → rate-limit → config → transport → fetch → response chain was verified via mock-based injection tests:

- **Auth gate**: `SCOUT_SUGGEST_STAGE` env var validation
- **Rate-limit gate**: Storage adapter readiness check
- **Config gate**: API key presence and format validation
- **Transport gate**: Live provider transport creation with `api_key` mode
- **Fetch gate**: Mock fetch injection with fielded response parsing
- **Response gate**: Sanitized response with allowlist-only fields

---

## 4. Preconditions for Real Staging Smoke

The following must be satisfied before a live staging smoke can be executed:

1. **Cloudflare staging deployment** is active (not production)
2. **Valid staging bearer token** for authentication
3. **Valid staging API key** configured in Cloudflare secrets
4. **`SCOUT_SUGGEST_PROVIDER_STAGE=staging`** env var set
5. **Operator handoff documentation** reviewed

---

## 5. Security Notes

- No real API keys or credentials were used in this smoke
- All tests use mock/stub injection — no external API calls were made
- The runbook documents 8 required env vars/secrets with proper staging-only guard
- Production activation remains **BLOCKED** (12 blockers on checklist)

---

## 6. References

- [Runbook](./lovebud-scout-staging-api-key-smoke-runbook.md)
- [Operator Handoff](./lovebud-scout-staging-smoke-operator-handoff.md)
- [Production Activation Checklist](./lovebud-scout-production-activation-checklist.md)
- [Auth Verifier Unblock Path](./lovebud-scout-auth-verifier-unblock-path.md)

---

*This issue (#2636) remains open until a live staging smoke is executed.*
