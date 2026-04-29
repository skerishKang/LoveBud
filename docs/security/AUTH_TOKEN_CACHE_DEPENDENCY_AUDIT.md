# Auth Token Cache Dependency Audit

> **Status:** AUDIT_CAPTURED  
> **Source:** Issue #78 item 3  
> **Type:** Docs-only — no JS or runtime changes in this document

---

## 1. Purpose

This document captures the audit result for the Firebase ID token localStorage cache used in LoveBud's auth flow.

The audit maps every read, write, and delete of `AUTH_TOKEN_KEY` / `lovebud_auth_token` across the codebase, confirms API fetch dependencies on the cached token, and records the proposed migration path.

No token behavior changes are made in this document. Implementation is tracked under Issue #78 PR B.

---

## 2. Audit Source

| Field | Value |
|---|---|
| Source issue | Issue #78 item 3 |
| Priority | Highest-priority auth cleanup item |
| Audit scope | `js/auth.js`, `js/auth/auth-cache.js`, `js/auth/auth-session.js`, `js/auth/auth-firebase.js` |

---

## 3. Cache Key Inventory

| Key constant | Hardcoded string | Storage type | Defined in |
|---|---|---|---|
| `AUTH_TOKEN_KEY` | `lovebud_auth_token` | `localStorage` | `js/auth/auth-cache.js` |

### Related cache keys (same storage layer)

| Hardcoded string | Purpose |
|---|---|
| `lovebud_auth_cache` | Lightweight auth UI state (uid, displayName, email) |
| `lovebud_auth_confirmed` | Auth confirmation flag |
| `lovebud_trees_cache` | Tree list cache (non-auth) |
| `tree_detail_` | Per-tree detail cache prefix (non-auth) |
| `tree_memories_` | Per-tree memory cache prefix (non-auth) |

---

## 4. Read / Write / Delete Map

### Writes (`localStorage.setItem`)

| File | Location | Written value |
|---|---|---|
| `js/auth/auth-cache.js` | `cacheAuthToken(token)` | Firebase ID token string |
| `js/auth/auth-firebase.js` | `onIdTokenChanged` callback | Refreshed Firebase ID token |

### Reads (`localStorage.getItem`)

| File | Location | Consumer |
|---|---|---|
| `js/auth/auth-cache.js` | `getCachedToken()` | Returns token for API fetch header |
| `js/auth/auth-session.js` | Auth-ready check | Presence check (truthy / falsy) |

### Deletes (`localStorage.removeItem`)

| File | Location | Trigger |
|---|---|---|
| `js/auth/auth-cache.js` | `clearAuthToken()` | Called on logout |
| `js/auth/auth-firebase.js` | `onIdTokenChanged` (null branch) | Firebase session expiry / sign-out |

---

## 5. API Fetch Dependency

API calls that attach the cached token as an `Authorization: Bearer` header:

| File | Endpoint pattern | Token source |
|---|---|---|
| `js/auth/auth-cache.js` | All `/api/*` Cloudflare Worker calls | `getCachedToken()` → `localStorage.getItem(AUTH_TOKEN_KEY)` |

**Dependency confirmed.** Removing the token cache without providing an on-demand token path would break all authenticated API calls.

---

## 6. Risk Assessment

| Risk | Severity | Notes |
|---|---|---|
| `localStorage` accessible to injected scripts | **High** | XSS on any LoveBud page could exfiltrate a live Firebase ID token |
| Token valid window | Medium | Firebase ID tokens expire in ~1 hour; cached token may be used until expiry |
| No token rotation on read | Medium | Cached token is not refreshed on every API call; stale token may persist |
| Lightweight auth UI cache (`lovebud_auth_cache`) | Low | Contains uid/displayName/email only; no token value |

---

## 7. Proposed Migration Path

> **This section is a proposal only. No implementation is performed in this PR.**

1. **Replace `getCachedToken()` with on-demand Firebase token retrieval:**
   ```js
   // Proposed replacement for getCachedToken()
   async function getToken() {
     const user = firebase.auth().currentUser;
     if (!user) return null;
     return user.getIdToken(/* forceRefresh */ false);
   }
   ```
2. **Keep lightweight auth UI cache** (`lovebud_auth_cache`) for uid/displayName/email — no security risk.
3. **Remove `AUTH_TOKEN_KEY` writes and reads** after all API fetch paths are migrated to on-demand retrieval.
4. **Verify login / logout / my-trees / editor / API 401 / 403** before and after migration.
5. **Separate security PR** (Issue #78 PR B) required — do not combine with CSS or other cleanups.

---

## 8. Module Delegation Dependency

`js/auth.js` delegates token cache operations to `window.LoveBudAuthCache`. The following delegation path is in scope for Issue #78 item 2 (tracked separately):

| Delegating file | Module | Method |
|---|---|---|
| `js/auth.js` | `window.LoveBudAuthCache` | `cacheAuthToken`, `getCachedToken`, `clearAuthToken` |

Fallback code in `js/auth.js` must not be removed until all pages load `js/auth/auth-cache.js` correctly.

---

## 9. Guardrails

- **No JS changes in this document or its PR.**
- **No token behavior changes** until Issue #78 PR B is reviewed and approved.
- **No removal of global aliases** (`window.LoveBudAuthCache`, etc.) until usage is verified.
- **No mixing** with Search CSS extraction or other unrelated PRs.
- **No prototype/reference/demo/variant file changes.**
- **Implementation PR (PR B) must be CSS-free** — token cache migration is JS/auth-only.

---

## 10. Verification Checklist

- [ ] `git diff --check` passes
- [ ] Changed files limited to `docs/security/AUTH_TOKEN_CACHE_DEPENDENCY_AUDIT.md`
- [ ] No JS/CSS/page/runtime changes
- [ ] No `close`/`fixes`/`resolves` keywords for #78 in this document

---

## Notes

Issue #78 remains **open**. This document covers item 3 (token cache) only. Items 1, 2, 4–7 and the full PR split plan remain pending and are tracked under Issue #78.
