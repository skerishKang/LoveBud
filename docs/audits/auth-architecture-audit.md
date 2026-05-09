# Auth Architecture Audit

**Status:** Draft audit  
**Owner:** CTO  
**Date:** 2026-04-26  
**Scope:** docs-only inventory; no runtime changes

---

## 1. Purpose

This document records the current LoveBud authentication structure before implementation cleanup. It is descriptive only and does not approve code changes.

---

## 2. Files reviewed

- `js/auth.js`
- `js/auth/auth-state.js`
- `js/auth/auth-cache.js`
- `js/auth/auth-session.js`
- `js/auth/auth-firebase.js`
- `js/auth/auth-ui.js`

---

## 3. Current module map

### 3.1 `js/auth.js`

`js/auth.js` currently works as a compatibility/bootstrap layer. It reads extracted modules from `window.*` when present and keeps inline fallback behavior for older loading paths.

Observed module references:

- `window.LoveBudAuthState`
- `window.LoveBudAuthUI`
- `window.LoveBudAuthSession`
- `window.LoveBudAuthFirebase`
- `window.LoveBudAuthCache`
- `window.LoveBudAuthCallbacks`

Observed global hooks:

- `window.LoveBudAuthBootstrap`
- `window.registerOnAuthReady`
- `window.__onAuthReadyCallbacks`
- `window.getBasePath`

### 3.2 `js/auth/auth-state.js`

Owns shared auth constants and lightweight state helpers.

Important keys:

- `__lovebudAuthInitialized`
- `__lovebudAuthReady`
- `lovebud_auth_cache`
- `lovebud_auth_confirmed`
- `lovebud_auth_token`

Important helpers:

- email auth mode resolution
- login page detection
- dropdown listener state

### 3.3 `js/auth/auth-cache.js`

Owns confirmed-session browser cache helpers, stale Firebase state cleanup, and cached token read/write helpers.

Current browser cache entries:

- confirmed user summary
- confirmed auth flag
- Firebase ID token metadata

The cached token reader rejects missing, malformed, or near-expired values.

### 3.4 `js/auth/auth-session.js`

Owns redirect target resolution and post-login preload behavior.

Observed preload cache areas:

- tree list cache
- first tree detail cache
- first tree memories cache

### 3.5 `js/auth/auth-firebase.js`

Owns Firebase initialization, Google sign-in, sign-out, offline fallback, environment checks, and friendly error messages.

Notable behavior:

- Falls back to offline auth mode when Firebase is unavailable.
- Uses a configurable auth wait timeout through `window.__LOVEBUD_AUTH_WAIT_MS`.
- Uses popup login first and redirect fallback for selected popup failures.

### 3.6 `js/auth/auth-ui.js`

Owns auth loading/ready UI, login button HTML, user dropdown HTML, language options, and dropdown event delegation.

---

## 4. Risk inventory

| Area | Risk | Severity | Notes |
|------|------|----------|-------|
| Browser-stored auth token metadata | Wider impact if arbitrary script execution ever occurs | High | Keep server-side authorization as the real trust boundary. |
| Duplicated fallback behavior | Extracted modules and `auth.js` fallback may diverge | Medium | Remove fallback only after script loading is fixed by tests. |
| Blocking `alert()` messages | Hard to style and hard to test | Medium | Replace with login-page status UI in a later PR. |
| Offline fallback | Cached user UI can appear before full Firebase confirmation | Medium | Must not grant backend access by itself. |
| Preload caches | Stale tree/memory display risk | Low/Medium | Define cache freshness separately. |
| Mixed line endings | Formatting churn risk | Low | Avoid mixing cleanup with behavior changes. |

---

## 5. Recommended follow-up PR split

### PR A — docs-only inventory

This audit. No code changes.

### PR B — login-page status UI

Replace selected blocking auth messages with an inline login status area.

### PR C — cached token dependency inventory

Find all readers of cached auth token metadata before changing storage behavior.

### PR D — fallback removal preparation

Add script-load-order or static checks, then remove duplicated fallback from `js/auth.js` later.

### PR E — private cache freshness policy

Define TTL and invalidation for tree and memory preload caches.

---

## 6. CTO decision points

1. Should current browser token metadata stay for MVP stability?
2. Should login errors move to inline UI before a global toast system exists?
3. Should `auth.js` remain a compatibility layer until after production stabilization?
4. Which fixed slot should be used for Firebase/Auth verification?

---

## 7. Explicit non-changes

- No auth code changes.
- No Firebase config changes.
- No storage behavior changes.
- No login UI behavior changes.
- No API behavior changes.
- No branch or slot updates.
