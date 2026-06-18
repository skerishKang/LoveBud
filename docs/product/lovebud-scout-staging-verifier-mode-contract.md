# Scout Staging Verifier Mode Contract

**Version**: 20260618-staging-verifier-contract-1
**Status**: CONTRACT-ONLY (no runtime activation)
**Slice Issue**: #2636 (follow-up)
**Parent Issue**: #1882 (must remain OPEN; never auto-close)

---

## Summary

This document defines the **staging verifier mode contract** for the Scout live
auth verifier adapter and dependency adapter. The staging mode is a
**contract-only skeleton** that:

- Defines the `STAGING` mode enum and `VERIFIER_STAGING_MOCK_VERIFIED` code
- Requires **explicit dependency injection** of a `stagingVerifier` function
- **Cannot be activated by any Cloudflare environment variable**
- Is intended **only for DI-based testing and contract verification** in CI
- Does **not** unblock #2636 (authenticated provider smoke remains BLOCKED)
- Does **not** activate production — production remains BLOCKED

---

## Why This Exists

Issue #2636 staging smoke test revealed that the authenticated success/provider
path is BLOCKED because the auth verifier runs in `mockDisabled: true` mode by
default, returning `VERIFIER_MOCK_DISABLED` → mapped to `AUTH_INVALID` (401)
for all bearer tokens.

This contract slice separates the **staging verifier boundary definition** from
any real implementation. It allows CI to verify that:

1. The staging mode enum exists in the contract
2. The default `mockDisabled: true` remains unchanged
3. Staging mode + `mockDisabled: true` → safe-fail (mock-disabled wins)
4. Staging mode + `mockDisabled: false` + missing `stagingVerifier` → safe-fail
5. Staging mode + `mockDisabled: false` + explicit DI `stagingVerifier` → sanitized `allowed: true` response possible
6. No raw token / auth / secret propagation occurs
7. Production runtime activation is not introduced

Actual staging verifier implementation and Cloudflare env activation are
**future slices** (separate PRs).

---

## Contract Scope

### In Scope (This PR)

| Item | Status |
|------|--------|
| `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.STAGING = 'staging'` | ✅ Added |
| `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_STAGING_MOCK_VERIFIED` | ✅ Added |
| `resolveVerifierMode()` recognizes STAGING | ✅ Updated |
| Factory branch for STAGING mode | ✅ Added |
| Strict DI requirement: `stagingVerifier` function mandatory | ✅ Enforced |
| Safe-fail when `mockDisabled !== false` (mock-disabled wins) | ✅ Preserved |
| Safe-fail when `stagingVerifier` missing | ✅ Returns NOT_IMPLEMENTED |
| Strict payload sanitization (`reject` mode for prohibited fields) | ✅ Mirrors Firebase runtime |
| Sanitized `userKeyHash` only in success response | ✅ Uses `deriveUserKeyHash` |
| No raw token / auth / secret propagation | ✅ Enforced |
| Dependency adapter DI boundary documentation | ✅ Updated |
| Contract test file | ✅ New `scout-staging-verifier-mode-contract.test.cjs` |
| Existing skeleton contract test updated | ✅ STAGING enum check added |

### Out of Scope (Future Slices)

| Item | Note |
|------|------|
| Cloudflare Preview env `SCOUT_SUGGEST_VERIFIER_MODE=staging` | Next slice — only after contract verified |
| Real staging verifier implementation (Firebase Admin SDK or custom) | Separate PR with production guard |
| Production activation | Explicitly BLOCKED; separate issue |
| Wiring into `suggest.js` LIVE branch | Separate slice |
| Rate-limit integration for staging | Separate slice |

---

## Mode Semantics

### Mode Resolution Priority

```
1. mockDisabled !== false  →  MOCK_DISABLED  (highest priority, default)
2. verifierMode === 'staging'  →  STAGING  (requires mockDisabled: false + stagingVerifier)
3. verifierMode === 'firebase'  →  FIREBASE_RUNTIME
4. verifierMode === 'firebase_disabled'  →  FIREBASE_DISABLED
5. verifierMode === 'firebase_config_missing'  →  FIREBASE_CONFIG_MISSING
6. (default)  →  NOT_IMPLEMENTED
```

### Staging Mode Entry Conditions

| Condition | Result |
|-----------|--------|
| `mockDisabled: true` (default) | **MOCK_DISABLED** — staging mode ignored, safe-fail |
| `mockDisabled: false` + no `verifierMode` | NOT_IMPLEMENTED |
| `mockDisabled: false` + `verifierMode: 'staging'` + no `stagingVerifier` | **NOT_IMPLEMENTED** — safe-fail |
| `mockDisabled: false` + `verifierMode: 'staging'` + `stagingVerifier: fn` | **STAGING** — active staging verifier |

> **Key invariant**: `STAGING` mode is **never** entered without an explicitly
> injected `stagingVerifier` function. There is no "built-in" mock verifier
> that returns `allowed: true` without DI.

---

## Staging Verifier Function Contract

```javascript
/**
 * @typedef {Object} StagingVerifierResult
 * @property {string} [uid] - User ID (preferred)
 * @property {string} [userKey] - Alternative user identifier
 */

/**
 * Staging mock verifier function (injected via DI, test-only).
 * @param {string} idToken - The bearer token from Authorization header
 * @returns {Promise<StagingVerifierResult>} - Must resolve to object with uid or userKey
 */
async function stagingVerifier(idToken) {
  // Test implementation ONLY — e.g.:
  // return { uid: 'staging-user-' + hash(idToken) };
}
```

**Rules:**
- Must be an `async` function accepting a single `idToken` string
- Must return an object with `uid` (preferred) or `userKey` (fallback)
- Returned `uid`/`userKey` is hashed via `deriveUserKeyHash` → 16-char hex `userKeyHash`
- Raw `uid`/`userKey`/claims/email are **never** propagated
- Throws are caught and safe-fail to `VERIFIER_FIREBASE_RUNTIME_FAILED`

---

## Response Codes

| Code | Meaning | allowed | userKeyHash |
|------|---------|---------|-------------|
| `VERIFIER_MOCK_DISABLED` | Default mock-disabled | false | null |
| `VERIFIER_NOT_IMPLEMENTED` | No implementation | false | null |
| `VERIFIER_STAGING_MOCK_VERIFIED` | Staging DI verifier accepted token | **true** | **16-char hex** |
| `VERIFIER_FIREBASE_RUNTIME_VERIFIED` | Firebase runtime accepted token | **true** | **16-char hex** |

**Critical**: `VERIFIER_STAGING_MOCK_VERIFIED` is a **dedicated success code**
(not a disabled/failed code) so downstream mappers cannot misinterpret it.

---

## Downstream Mapping (Dependency Adapter → Boundary)

### Dependency Adapter (`live-auth-rate-limit-dependency-adapter.js`)

Maps verifier codes to dependency codes:

| Verifier Code | Dependency Code | allowed |
|---------------|-----------------|---------|
| `VERIFIER_STAGING_MOCK_VERIFIED` | `VERIFY_RUNTIME_VERIFIED` | **true** |
| `VERIFIER_FIREBASE_RUNTIME_VERIFIED` | `VERIFY_RUNTIME_VERIFIED` | **true** |
| `VERIFIER_MOCK_DISABLED` | `VERIFY_NOT_IMPLEMENTED` | false |
| `VERIFIER_NOT_IMPLEMENTED` | `VERIFY_NOT_IMPLEMENTED` | false |
| `VERIFIER_FIREBASE_DISABLED` | `VERIFY_NOT_IMPLEMENTED` | false |
| `VERIFIER_FIREBASE_RUNTIME_DISABLED` | `VERIFY_NOT_IMPLEMENTED` | false |
| `VERIFIER_CONFIG_MISSING` | `VERIFY_UNAVAILABLE` | false |
| `VERIFIER_FIREBASE_RUNTIME_FAILED` | `VERIFY_UNAVAILABLE` | false |
| `VERIFIER_PAYLOAD_PROHIBITED` | `VERIFY_PAYLOAD_PROHIBITED` | false |

> The dependency adapter intentionally maps **both** `VERIFIER_STAGING_MOCK_VERIFIED`
> and `VERIFIER_FIREBASE_RUNTIME_VERIFIED` to the **same** success code
> `VERIFY_RUNTIME_VERIFIED`. This is correct: the downstream boundary treats
> any `VERIFY_RUNTIME_VERIFIED` as an authenticated success and proceeds to
> the provider path.

### Boundary Adapter (`live-auth-rate-limit-boundary.js`)

Maps dependency codes to HTTP responses:

| Dependency Code | HTTP Status | error.code | Route Status |
|-----------------|-------------|------------|--------------|
| `VERIFY_RUNTIME_VERIFIED` | 200 (proceeds to provider) | — | — |
| `VERIFY_NOT_IMPLEMENTED` | 401 | `AUTH_INVALID` | `auth-invalid` |
| `VERIFY_UNAVAILABLE` | 401 | `AUTH_INVALID` | `auth-invalid` |
| `VERIFY_PAYLOAD_PROHIBITED` | 401 | `AUTH_INVALID` | `auth-invalid` |

---

## Production Guards (Non-Negotiable)

1. **Default is mock-disabled**: `createScoutLiveAuthVerifierAdapter()` with no
   options → `MOCK_DISABLED` → `allowed: false`. Unchanged.

2. **suggest.js default unchanged**: `createScoutLiveDependencyAdapter({ mockDisabled: true })`
   remains the default in the LIVE branch. No env flag changes this.

3. **No env activation**: There is **no** `SCOUT_SUGGEST_VERIFIER_MODE` or similar
   Cloudflare env that activates staging mode. The only way to get a staging
   verifier is explicit DI in test code.

4. **No production auto-activation**: The dependency adapter does not read
   any env. The boundary does not read any env. Production can only be
   activated by a future slice that:
   - Implements a real verifier (Firebase Admin SDK or equivalent)
   - Adds explicit production guard config
   - Goes through separate PR with #1882 approval

5. **#2636 remains OPEN**: This contract PR does **not** unblock #2636.
   Authenticated provider smoke test still BLOCKED until a real verifier
   implementation is wired and tested.

---

## Non-Goals

- No real LLM provider call
- No provider SDK import
- No Firebase Admin SDK import
- No automatic token verification
- No `getAuth` / `verifyIdToken` / `cert` / `initializeApp` call performed by this module
- No external auth service call performed by this module
- No fetch / XMLHttpRequest / axios
- No env auth binding access
- No raw token, authorization header, API key, or session cookie in any response, log, or storage payload
- No wiring into `suggest.js` LIVE branch (separate slice)
- No Cloudflare env flag for staging activation

---

## Related Documents

- `lovebud-scout-live-auth-verifier-adapter-skeleton.md` — verifier adapter skeleton
- `lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md` — dependency adapter skeleton
- `lovebud-scout-live-endpoint-error-taxonomy-contract.md` — error taxonomy
- `lovebud-scout-staging-smoke-operator-handoff.md` — operator handoff for #2636
- `lovebud-scout-staging-api-key-smoke-runbook.md` — #2636 smoke runbook
- `lovebud-scout-staging-smoke-report-template.md` — #2636 report template

---

## Contract Tests

- `tests/contracts/scout-staging-verifier-mode-contract.test.cjs` — new contract test
- `tests/contracts/scout-live-auth-verifier-adapter-skeleton-contract.test.cjs` — updated for STAGING enum