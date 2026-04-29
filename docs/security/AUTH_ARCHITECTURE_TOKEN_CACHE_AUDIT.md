# Auth Architecture and Token Cache Audit

> **Status:** AUDIT_ONLY  
> **Source:** Issue #78  
> **Type:** Docs-only — no Auth runtime or token/cache behavior changes

---

## 1. Purpose

This document is the audit-only baseline for Issue #78.

The goal is to inventory the current Auth architecture before any security or structure cleanup is implemented. In particular, this audit records the surfaces that must be reviewed before changing global exports, token cache behavior, module delegation, alert handling, or cache key ownership.

This document does not authorize implementation. Any runtime change must be split into a follow-up PR with explicit verification.

---

## 2. Current Auth Architecture Summary

`js/auth.js` is the shared Auth runtime entry point. It participates in:

- login and logout wiring;
- auth-ready callback coordination;
- navigation/header Auth UI state;
- redirect and protected-page handling;
- cached Auth UI/session state;
- Firebase Auth session initialization and fallback behavior.

The `js/auth/auth-*.js` files act as narrower helper modules, but the runtime still depends on compatibility exports and fallback paths in `js/auth.js`.

Current module surfaces to audit before implementation:

- `js/auth.js` — shared runtime coordinator and compatibility layer.
- `js/auth/auth-cache.js` — Auth cache and confirmed Auth cache helpers.
- `js/auth/auth-ui.js` — navigation/Auth UI rendering and state updates.
- `js/auth/auth-firebase.js` — Firebase initialization/session integration helpers.
- `js/auth/auth-session.js` — session and redirect-adjacent behavior.
- `js/auth/auth-state.js` — current user/auth state access helpers.
- `js/auth/auth-callbacks.js` — auth-ready callback registration and delivery.
- `js/api/base-api-fetch.js` — API fetch path that may read or depend on cached Auth/token state.
- `js/postgres-client.js` — data client path that may depend on Auth/session state.

The safe assumption for Issue #78 is that `js/auth.js` is not yet a thin facade. Cleanup must preserve current runtime contracts until verified.

---

## 3. Global `window.*` Export Inventory

The following global exports are known or expected to be part of the Auth runtime contract and must be inventoried from implementation files before removal or migration.

| Export | Current role | Expected consumers / pages | Cleanup rule |
| --- | --- | --- | --- |
| `window.FIREBASE_CONFIG` | Firebase client config object | Auth bootstrap, Firebase config consumers | Do not change config values in Issue #78 cleanup. |
| `window.initFirebase()` | Firebase initialization entry | Auth runtime, pages that expect Firebase to be initialized | Do not remove without compatibility layer. |
| `window.__lovebudFirebaseInitialized` | Firebase initialization idempotency flag | Auth runtime/fallback paths | Preserve idempotency. |
| `window.__lovebudAuthInitialized` | Auth initialization flag | Protected pages and shared Auth runtime | Preserve boot order assumptions. |
| `window.__lovebudAuthReady` | Auth readiness flag | Protected pages and UI consumers | Do not treat pending Auth as signed-out. |
| `window.registerOnAuthReady(callback)` | Auth-ready callback registration | Protected pages, My Trees, Editor, header UI | Preserve callback behavior and late registration handling. |
| `window.__onAuthReadyCallbacks` | Legacy callback queue | Auth runtime/fallback paths | Do not remove in the first cleanup PR. |
| `window.LoveBud` / `window.LoveBud.auth` candidates | Future namespace target | Future compatibility namespace | Namespace migration must be separate. |

Principles:

- Legacy aliases must not be removed in the audit/documentation PR.
- A future `window.LoveBud.auth` namespace may be introduced only with compatibility exports preserved.
- Any global export reduction requires contract tests and page smoke first.

---

## 4. Token Cache Audit

Token-related names and paths that require review:

- `AUTH_TOKEN_KEY`
- `lovebud_auth_token`
- token read path
- token write path
- token remove/clear path
- API fetch path token attachment behavior
- Firebase ID token refresh behavior

Questions for the follow-up security PR:

1. Which module owns `AUTH_TOKEN_KEY`?
2. Which code writes `lovebud_auth_token`?
3. Which code reads `lovebud_auth_token`?
4. Which code removes `lovebud_auth_token` on logout or Auth failure?
5. Does `js/api/base-api-fetch.js` rely on a cached persistent token instead of requesting a fresh Firebase ID token?
6. Does `js/postgres-client.js` rely on the same token source or a separate Auth helper?
7. Can persistent Firebase ID token storage be reduced or removed without breaking API calls?

Security direction:

- Persistent Firebase ID token storage in `localStorage` should be reduced or removed only in a dedicated follow-up PR.
- API token acquisition should prefer an explicit Auth/Firebase helper if available.
- Logout must clear token state consistently.
- Token cache cleanup must not be mixed with UI copy, navigation, or protected-route changes.

---

## 5. Cached Auth UI Data Separation

Cached lightweight UI data must be treated separately from persistent ID token state.

UI/session cache candidates:

- `uid`
- `displayName`
- `email`
- confirmed Auth cache
- `lovebud_auth_cache`
- `lovebud_auth_confirmed`

Principles:

- Lightweight UI cache may be useful for reducing header flicker or preserving confirmed Auth state during boot.
- ID tokens are sensitive and should not be treated the same as display-only cache data.
- Confirmed Auth cache must not be used to permanently bypass Firebase Auth resolution.
- Pending Auth must remain pending; it must not be collapsed into signed-out behavior.

Follow-up PRs should document whether a cache key stores display metadata, Auth confirmation, or credentials/token-like state.

---

## 6. Alert Usage Inventory

Auth-related `alert()` calls should be inventoried before replacement.

Likely flow categories:

- login failure;
- signup failure;
- logout failure;
- redirect/protected-route failure;
- form validation;
- account/session edge cases.

Cleanup direction:

- Replacing `alert()` with inline form errors or toast UI is a UX behavior change.
- Alert replacement must be a dedicated Auth UX PR.
- Alert replacement must not be mixed with token cache, namespace migration, Firebase config, or protected-route changes.

Required inventory fields for the follow-up PR:

| Location | Flow | Current message source | Proposed replacement | Risk |
| --- | --- | --- | --- | --- |
| `js/auth.js` | TBD | TBD | Inline form error or toast | TBD |
| `pages/login.html` related runtime | TBD | TBD | Inline form error | TBD |

---

## 7. Cache Key Inventory

Known cache keys and key prefixes to inventory:

- `lovebud_trees_cache`
- `tree_detail_`
- `tree_memories_`
- `lovebud_auth_cache`
- `lovebud_auth_confirmed`
- `lovebud_auth_token`

Classification principle:

| Key / prefix | Category | Cleanup rule |
| --- | --- | --- |
| `lovebud_trees_cache` | data cache | Do not rename without migration/expiry plan. |
| `tree_detail_` | data cache prefix | Do not rename without cache invalidation plan. |
| `tree_memories_` | data cache prefix | Do not rename without cache invalidation plan. |
| `lovebud_auth_cache` | Auth UI/session cache | Keep separate from token storage. |
| `lovebud_auth_confirmed` | confirmed Auth cache | Preserve pending/signed-out semantics. |
| `lovebud_auth_token` | token-like cache | Security cleanup candidate; separate PR only. |

Central constants may be introduced later, but actual key name changes are forbidden in the audit PR.

---

## 8. CRLF / Formatting Audit

`js/auth.js` line ending and formatting state should be checked before any implementation PR.

Required checks:

- Determine whether `js/auth.js` uses CRLF, LF, or mixed line endings.
- Check `.gitattributes` for line ending rules.
- Avoid mixing semantic Auth changes with line ending normalization.

If normalization is needed, use a dedicated format-only PR:

- no Auth logic changes;
- no token/cache behavior changes;
- no global export changes;
- no alert replacement;
- diff reviewed as line-ending/format-only.

---

## 9. Safe PR Split

Recommended sequence:

1. **PR A: Auth audit documentation only**
   - This document.
   - No runtime changes.

2. **PR B: Token cache security cleanup**
   - Reduce or remove persistent ID token storage if approved.
   - Preserve API/Auth behavior with tests and smoke.

3. **PR C: Small auth cleanup, `var` to `const`/`let`**
   - Syntax/maintainability only.
   - No behavior changes.

4. **PR D: Auth UX alert cleanup**
   - Replace `alert()` with inline error/toast behavior.
   - Login smoke required.

5. **PR E: Namespace migration**
   - Add `window.LoveBud.auth` compatibility namespace.
   - Preserve legacy globals.

6. **PR F: Legacy fallback reduction**
   - Remove fallback code only after tests and namespace compatibility prove safe.

7. **PR G: Format-only line ending normalization**
   - Separate CRLF/LF normalization if needed.

---

## 10. Non-Goals / Guardrails

- No runtime changes.
- No Auth behavior changes.
- No global alias removal.
- No fallback removal.
- No token cache removal in this PR.
- No Firebase Console changes.
- No Firebase config value changes.
- No API behavior changes.
- No Login UI implementation changes.
- No protected-route behavior changes.
- No `js/auth.js` changes.
- No `js/auth/**` changes.
- No `js/api/**` changes.
- No `pages/*.html` changes.
- No CSS changes.
- No CRLF normalization implementation.
- No PR #7 changes.
- No prototype/reference/demo/variant changes.

---

## 11. Verification Checklist

- [ ] `git diff --check` passes.
- [ ] Changed files limited to `docs/security/AUTH_ARCHITECTURE_TOKEN_CACHE_AUDIT.md`.
- [ ] No JS/page/Auth/API/runtime changes.
- [ ] No token/cache behavior changes.
- [ ] Issue #78 remains open.
- [ ] PR body uses `Refs #78` only.

---

## Notes

Issue #78 remains open because implementation, tests, and staged Auth cleanup remain pending.
