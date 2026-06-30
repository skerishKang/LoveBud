# LoveBud Client Token Storage Threat Model and Decision Record

## Meta

* Status: DECISION_RECORD
* Scope: docs-only; no auth runtime, Firebase, API, storage behavior, CSP, cookie, or server changes
* Related: Refs #2987 / Refs #1882
* Baseline source files:
  * `js/auth/auth-state.js`
  * `js/auth/auth-cache.js`
  * `js/auth.js`

---

## 1. Decision summary

* **Current choice**: sessionStorage-backed token cache is retained as a short-term interim model.
* This document does **not** propose a localStorage-to-sessionStorage migration PR.
* HttpOnly cookie / BFF-backed session cookie model is **not** implemented now.
* sessionStorage reduces persistent browser-storage exposure but **does not eliminate active XSS risk** — any injected same-origin script can still read the token and issue authenticated requests.

---

## 2. Current verified baseline

| Key | Storage location | Contents | Write owner | Read owner | Clear behavior | Security classification | Cross-tab / hard-reload implication |
|-----|------------------|----------|-------------|------------|----------------|-------------------------|-------------------------------------|
| `lovebud_auth_token` | **sessionStorage** | `{ uid, token, expiresAt }` | `persistConfirmedAuthSession()` via `sessionStorage.setItem()` | `getCachedAuthToken()` via `sessionStorage.getItem()` | Cleared on logout, invalid session, 30s pre-expiry; also removed from localStorage defensively | **High** — Firebase ID token (~1hr TTL) | **Per-tab**; same-tab hard reload/restore preserves sessionStorage; opener-created tab may receive an initial copy; independent tab starts empty |
| `lovebud_auth_cache` | **localStorage** | `{ uid, displayName, email }` | `setConfirmedAuthCache()` / `persistConfirmedAuthSession()` via `localStorage.setItem()` | `getCachedAuthUser()` via `localStorage.getItem()` | Cleared on logout; also cleared when confirmed flag is false | **Medium** — non-sensitive profile data | **Cross-tab persistent**; survives hard reload |
| `lovebud_auth_confirmed` | **localStorage** | `"true"` (string flag) | `setConfirmedAuthCache()` / `persistConfirmedAuthSession()` via `localStorage.setItem()` | `getCachedAuthUser()` checks `localStorage.getItem(confirmedKey) === "true"` | Cleared on logout; also cleared when cache is invalid | **Low** — boolean flag only | **Cross-tab persistent**; survives hard reload |

> **Note**: The issue text references a legacy localStorage token path. The current implementation baseline (see §2 above) stores the token **only in sessionStorage**; the localStorage token key is defensively cleared on every read/write. This document records the current baseline neutrally without judging past design choices.

---

## 3. Lifecycle map

| Stage | Behavior | Verified in source |
|-------|----------|-------------------|
| Firebase user confirmed | `onAuthStateChanged` fires → `persistConfirmedAuthSession(user)` called | ✅ `auth.js:507` |
| Token acquisition | `user.getIdTokenResult()` → `{ uid, token, expiresAt }` persisted to `sessionStorage` | ✅ `auth-cache.js:147-163` |
| Token record persistence | `{ uid, token, expiresAt }` → `sessionStorage.setItem(tokenKey, JSON.stringify(...))` | ✅ `auth-cache.js:154-162` |
| Authenticated request token read | `getCachedAuthToken()` reads from `sessionStorage`, parses, checks expiry | ✅ `auth-cache.js:105-124` |
| 30-second expiry safety window | If `Date.now() >= expiresAt - 30000` → token removed, `null` returned | ✅ `auth-cache.js:116-118` |
| Logout / invalid-session clear | `signOut()` → `clearConfirmedAuthCache()` → clears all 3 keys from localStorage + token from sessionStorage | ✅ `auth-cache.js:80-86`, `auth.js:675` |
| Hard reload behavior | `sessionStorage` preserved on same-tab hard reload/restore; `localStorage` cache/confirmed survive → UI renders cached profile until token re-acquired | ✅ sessionStorage semantics |
| Second-tab behavior | New independent tab has no `sessionStorage` token → `getCachedAuthToken()` returns `null` → treated as unauthenticated until next login/refresh; opener-created tab may receive an initial copy via sessionStorage inheritance; Firebase re-bootstrap on load may re-populate token in some environments | ⚠️ not fully verified; depends on environment |

> **Not verified in this docs-only slice**: Exact timing of token refresh, Firebase internal token rotation, cross-tab session synchronization via BroadcastChannel or storage events (not implemented).

---

## 4. Threat model

| Threat | Current mitigation | Residual risk | Out-of-scope mitigation |
|--------|-------------------|---------------|-------------------------|
| **Stored-token theft from persistent browser storage** | Token in `sessionStorage` only; localStorage key defensively cleared on every read/write | `sessionStorage` is still accessible to any same-origin XSS | HttpOnly cookie model (out of scope) |
| **Active XSS authenticated action risk** | Token not in localStorage reduces persistent exposure | **sessionStorage alone does not eliminate XSS account risk.** Any active injected script can still access same-origin browser session context, read the token from `sessionStorage`, and issue authenticated requests. | CSP hardening, Trusted Types, XSS prevention (separate workstream) |
| **Stale session / expired token reuse** | 30-second pre-expiry guard removes token before actual expiry | Race condition if request fires in the 30s window and token expires before response | Token refresh / rotation (future) |
| **Shared-device persistence** | Token cleared on tab close / session end; UI cache survives | User profile visible on shared device until explicit logout | Explicit logout UX (existing) |
| **Cross-tab expectations** | Token is per-top-level-browsing-context; independent tabs start empty; opener-created tabs may inherit initial copy; Firebase re-bootstrap on load may re-populate token | User confusion when second tab shows logged-out state; opener-created tab may appear logged-in | Session synchronization (out of scope); actual Firebase re-bootstrap behavior is runtime-dependent |
| **CSRF (only if future cookie model considered)** | N/A — no cookie-based auth currently | N/A | CSRF protection design required for cookie model (see §5) |

> **Firebase public client configuration is not itself a credential leak.** The Firebase Web API key is intended for public client use; it authorizes project access but does not grant data access without user authentication.

---

## 5. Options considered

### A. Current scoped sessionStorage interim model
* **Security property**: Reduces persistent token exposure; token lost on tab close / hard reload.
* **Tradeoff**: Does not mitigate active XSS; per-tab token breaks multi-tab UX.
* **Implementation prerequisites**: Already implemented; baseline verified.
* **Non-goals**: Not XSS-proof; not a cookie replacement.

### B. Deliberate HttpOnly same-origin BFF/session-cookie model
* **Security property**: Token never touches JavaScript-accessible storage; HttpOnly cookie immune to XSS read.
* **Tradeoff**: Requires backend (BFF) for token exchange/refresh; CSRF protection mandatory; adds infrastructure complexity.
* **Implementation prerequisites**:
  * CSRF protection design (double-submit cookie, SameSite=Strict/Lax, or custom header)
  * Session revocation mechanism (server-side blocklist or short TTL with refresh)
  * Logout invalidation (cookie clear + server-side session destroy)
  * Refresh/session rotation policy (short-lived access token + refresh token rotation)
  * Same-origin API boundary (BFF proxies Firebase calls; no direct client→Firebase)
  * Multi-tab behavior (cookie shared across tabs; refresh coordination)
  * Server-side deployment and observability (BFF service, logging, metrics)
* **Non-goals**: Not a drop-in replacement; requires new backend service.

---

## 6. Decision and migration gates

* **Chosen**: Retain current sessionStorage interim model.
* Future runtime migration will be a separate issue / PR.
* **Pre-migration evidence required** (each must have browser QA + auth smoke test):
  * Login
  * Token refresh
  * Expiry / 30s guard
  * Logout
  * Hard reload
  * Second tab behavior
  * Invalid session handling
  * Authenticated API retry / Authorization header attachment

* Migration PR **must** include browser QA and auth smoke tests.
* This docs-only PR **does not claim** behavior test completion.

---

## 7. Dependencies kept separate

Each of the following is a separate workstream, not coupled to token storage decision:

* CSP / renderer XSS hardening
* URL sanitization
* iframe referrer policy
* Firebase config
* Auth UI
* Protected-route behavior

---

## 8. Non-goals

* No auth provider replacement
* No `js/auth.js`, `js/auth/**`, `js/api/**` changes
* No localStorage/sessionStorage runtime migration
* No cookie/server/BFF implementation
* No Firebase Console changes
* No secret/token values in docs
* No claim that current state is XSS-proof

---

## 9. Follow-up test matrix

| Scenario | Minimum assertion | Owner | Required before runtime migration |
|----------|-------------------|-------|-----------------------------------|
| Login | `sessionStorage.setItem("lovebud_auth_token", {...})` called; token present in sessionStorage | Auth | ✅ |
| Refresh | `getCachedAuthToken()` returns valid token; 30s guard not triggered prematurely | Auth | ✅ |
| Expiry | Token removed from sessionStorage when `Date.now() >= expiresAt - 30000` | Auth | ✅ |
| Logout | `sessionStorage.removeItem(tokenKey)` + `localStorage.removeItem(...)` for all 3 keys | Auth | ✅ |
| Hard reload | Same-tab hard reload/restore preserves `sessionStorage` token; `localStorage` cache/confirmed persist | Auth | ✅ |
| Second tab | Independent tab starts empty; opener-created tab may inherit initial `sessionStorage` copy; Firebase re-bootstrap on load may re-populate token — verify actual behavior per environment | Auth | ✅ |
| Invalid session | `getCachedAuthToken()` returns `null` on corrupted/missing token | Auth | ✅ |
| Authenticated retry | Request includes `Authorization: Bearer <token>` from sessionStorage | Auth | ✅ |

---

*End of decision record*