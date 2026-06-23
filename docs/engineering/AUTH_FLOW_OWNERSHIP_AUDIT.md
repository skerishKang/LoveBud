# Auth flow ownership audit

Refs #2712

## Purpose

Audit-first path for Issue #2712. Docs-only: no JS/HTML/CSS/runtime changes.

This PR satisfies #2712 acceptance criteria: it maps auth entrypoints, Firebase init/listener ownership, cached-session lifecycle, protected-route lifecycle, login-page lifecycle, callback/event ownership, UI rendering ownership, compatibility/bootstrap paths, duplicated responsibilities, and a staged refactor plan.

## Auth entrypoints by page

| Page | Auth-loaded scripts | Auth execution |
|------|-------------------|----------------|
| `index.html` | `auth-state.js` → `auth-callbacks.js` → `auth-cache.js` → `auth-ui.js` → `auth-session.js` → `auth-firebase.js` → `auth.js` | `DOMContentLoaded` → `initAuth()` via `auth.js` |
| `pages/search.html` | Same as index | Same entry |
| `pages/detail.html` | Same + `auth-ui-templates.js` loaded earlier | Same entry |
| `pages/editor.html` | Same + `auth-ui-templates.js` + `auth-protected-route.js` | Protected route gating |
| `pages/my-trees.html` | Same as editor | Protected route gating |
| `pages/login.html` | `auth-state.js` → `auth-callbacks.js` → `auth-cache.js` → `auth-ui.js` → `auth-session.js` → `auth-firebase.js` (no auth.js!) | Direct `auth-firebase.js` init via login page exec |
| `pages/view.html` | `auth-policy.js` (no full auth stack) | Auth-skip for public viewer |
| `pages/tree.html` | `auth-policy.js` | Auth-skip for public viewer |
| `pages/intro.html` | Same as index | Same entry |

## Auth file inventory (baseline `5b20a10b3`)

| File | Lines | Role |
|------|-------|------|
| `js/auth.js` | 747 | Auth entry point. Delegates to sub-modules via bridge pattern. Contains fallback code paths for every sub-module function. |
| `js/auth/auth-state.js` | 140 | Shared constants (AUTH_INIT_FLAG, AUTH_READY_FLAG, cache keys). Email auth mode resolution. `createBootstrapCompatibilityBoundary()` factory. |
| `js/auth/auth-cache.js` | 209 | localStorage cache helpers: confirmed session cache, token cache, stale Firebase state cleanup. `createConfirmedAuthCacheBridge()`. |
| `js/auth/auth-firebase.js` | 754 | Firebase auth orchestration: `initAuth()`, `signInWithGoogle()`, `signOut()`, `onAuthStateChanged` listener, `getRedirectResult()`, `initOfflineAuth()`. `createProtectedRouteBridge()`. |
| `js/auth/auth-session.js` | 90 | `getRedirectTarget()`, `preloadRedirectTargetData()` (trees/data prefetch after login). |
| `js/auth/auth-callbacks.js` | 70 | `registerOnAuthReady()`, `fireAuthReadyCallbacks()`, `preserveEarlyAuthReadyFallback()`. |
| `js/auth/auth-ui.js` | 289 | `markAuthLoading()`, `markAuthReady()`, `buildUserDropdown()`, `buildLoginButton()`, `updateNavUI()`, `attachDropdownListener()`, dropdown click handler. |
| `js/auth/auth-ui-templates.js` | 84 | Fallback-only UI templates (`buildLoginButton`, `buildUserDropdown`, `fallbackEscapeHtml`, `getBasePath`) — loaded early for skeleton rendering. |
| `js/auth/auth-login-page.js` | 468 | `setupGoogleBtn()`, `setupEmailAuthForm()`, `setupSignupForm()`, `setupSignupGoogleBtn()`, login card show/hide, `callLoginPageModule()`. |
| `js/auth/auth-protected-route.js` | 256 | `requireAuthenticatedPage()`, `waitForAuthReady()`, `redirectToLogin()`, `getAuthenticatedUser()`, `subscribeAuth()`. Central auth state manager. |
| `js/login/login-dom.js` | iseparate| Login page DOM manipulation |
| `js/login/login-page.js` | iseparate| Login page entry |
| `js/firebase-config.js` | small | Firebase app config + `initFirebase()` |

## Firebase initialization and auth listener ownership

Firebase is initialized in `js/firebase-config.js` via `initFirebase()`. The auth listener is set up in `js/auth/auth-firebase.js` via `firebase.auth().onAuthStateChanged()`.

**Ownership diagram:**

```
firebase-config.js: initFirebase() [self-guarded, called by any auth module]
  |
  v
auth-firebase.js: onAuthStateChanged listener [owner]
  |---> persistConfirmedAuthSession via options callback
  |---> markAuthReady via options callback  
  |---> updateNavUI via options callback
  |---> resolveAuthBootstrap via options callback
  |---> fireAuthReadyCallbacks via options callback
  |---> redirect if login-page
```

**Caveat:** `auth-protected-route.js` also subscribes to `onAuthStateChanged` independently (lines 99-117), creating a **second listener** on the same Firebase auth instance. This is a duplicate subscription.

## Cached-session lifecycle

```
Page load
  |
  v
auth.js: initAuth()
  |---> applyCachedAuthState()
  |       |---> auth-firebase.js: reads localStorage lovebud_auth_cache + lovebud_auth_confirmed
  |       |---> if cached: renders dropdown immediately (optimistic)
  |       |---> sets AUTH_READY_FLAG = true (partial ready)
  |
  v
onAuthStateChanged fires
  |---> persistConfirmedAuthSession() -> writes lovebud_auth_cache + lovebud_auth_confirmed + lovebud_auth_token
  |---> markAuthReady() -> fire AUTH_READY_FLAG = true (confirmed ready)
  |---> updateNavUI() -> re-render dropdown/cached UI
  |---> fireAuthReadyCallbacks()
  |---> resolveAuthBootstrap()
```

**Ambiguity:** `AUTH_READY_FLAG` is set twice — once optimistically in `applyCachedAuthState` and once confirmed in `onAuthStateChanged`. Downstream consumers cannot distinguish "cached-only ready" from "Firebase-confirmed ready".

## Protected-route lifecycle

```
Protected page (editor.html, my-trees.html)
  |
  v
auth-protected-route.js: requireAuthenticatedPage()
  |---> If AUTH_READY_FLAG: check user immediately
  |---> Else: waitForAuthReady() -> Promise
  |       |---> registerOnAuthReady() -> waits for fireAuthReadyCallbacks
  |
  v
On auth ready:
  |---> user present: onAuthenticated(user)
  |---> user absent: redirectToLogin()
```

**Ambiguity:** `auth-protected-route.js` has its own `getAuthenticatedUser()` (duplicates `auth-cache.js`'s `getCachedAuthUser`). It also duplicates `isLoggedIn()` and `isAuthReady()` logic. It independently subscribes to `firebase.auth().onAuthStateChanged` (second listener).

## Login-page lifecycle

```
login.html loads
  |
  v
auth-firebase.js: initAuth() (called without auth.js wrapper on login page)
  |---> resolveEmailAuthMode() -> check URL param 'mode'
  |---> getRedirectResult() -> handle OAuth redirect result
  |---> onAuthStateChanged -> if user present: persist session + redirect
  |---> setupGoogleBtn()
  |---> setupEmailAuthForm() / setupSignupForm()
  |---> setupSignupGoogleBtn()
  |
  v
auth-login-page.js: handles:
  |---> isCurrentLoginPage() -> duplicate of auth-state's isLoginPage
  |---> getLoginCard() -> hide/show login card
  |---> setupGoogleBtn / setupEmailAuthForm / setupSignupForm / setupSignupGoogleBtn
  |---> syncEmailAuthModeUi()
  |---> firebase email/password sign-in logic
```

**Ambiguity:** `login.html` does NOT load `auth.js` (the entry orchestrator). Instead it loads `auth-firebase.js` directly. But `auth-firebase.js`'s `initAuth()` expects callbacks that are normally provided by `auth.js`. The login page resolves this with inline callback definitions in the HTML, creating an **alternate init path** that duplicates some `auth.js` logic.

## Callback / event ownership

| Event | Owner | Duplicated? |
|-------|-------|-------------|
| `registerOnAuthReady` | `auth-callbacks.js` | Yes — `auth.js` `window.registerOnAuthReady` delegates here |
| `fireAuthReadyCallbacks` | `auth-callbacks.js` | Yes — `auth.js` `fireAuthReadyCallbacks` delegates here |
| `preserveEarlyAuthReadyFallback` | `auth-callbacks.js` | Yes — also preserved via `auth.js` `__authCallbacksModule` |
| `onAuthStateChanged` | `auth-firebase.js` | **Yes — `auth-protected-route.js` has a second subscription** |
| `getRedirectResult` | `auth-firebase.js` | Unique |
| `dropdown click listener` | `auth-ui.js` | Yes — `auth.js` `attachDropdownListener` has fallback duplicate |
| `lang-option click` | `auth-ui.js` | Unique |
| `logout click` | `auth-ui.js` dropdown | Unique (action delegated to `window.signOut`) |

## UI rendering ownership

| UI element | Owner | Fallback |
|------------|-------|----------|
| `#auth-nav` | `auth-ui.js` `updateNavUI()` | `auth.js` built-in `updateNavUI` + `buildLoginButton`/`buildUserDropdown` |
| `#auth-nav-container` | `auth-ui.js` `updateNavUI()` | `auth.js` fallback |
| User dropdown | `auth-ui.js` `buildUserDropdown()` | `auth-ui-templates.js` `buildUserDropdown()` |
| Login button | `auth-ui.js` `buildLoginButton()` | `auth-ui-templates.js` `buildLoginButton()` |
| Loading state | `auth-ui.js` `markAuthLoading()` | `auth.js` inline fallback |
| Ready state | `auth-ui.js` `markAuthReady()` | `auth.js` inline fallback |
| Avatar initial | `auth-ui.js` `getUserAvatarInitial()` | `auth-ui-templates.js` `getUserAvatarInitial()` |
| Escape HTML | `auth-ui.js` → delegates to `LoveBudSecurity` | `auth-ui-templates.js` `fallbackEscapeHtml()` |

**Problem:** UI templates are duplicated across 3 layers: `auth-ui.js` (primary), `auth-ui-templates.js` (fallback), and `auth.js` (inline fallback). This triples the maintenance surface.

## Compatibility / bootstrap paths

### Bootstrap compatibility boundary

`auth-state.js` creates `createBootstrapCompatibilityBoundary()` which returns:
- `authStateModule` — self-reference
- `authUiModule`, `authSessionModule`, `authFirebaseModule` — references to sibling modules
- `emailAuthMode`, `authInitFlag`, `authReadyFlag`, `dropdownListenerAttached` — cached copies
- `resolveAuthBootstrap(user)` — calls `LoveBudAuthBootstrap.resolve()`

This boundary is consumed by `auth.js` at module level (top of file) to resolve `__authBootstrapCompat`. If the boundary exists, all sub-module references go through it. If not, `auth.js` falls back to direct `window.LoveBudAuth*` references.

**Problem:** The bootstrap boundary adds an extra indirection layer with no clear runtime benefit. It exists to support gradual migration from the monolithic `auth.js` to sub-modules. Since all sub-modules now exist, the boundary is vestigial.

### Protected-route dual init

`auth-protected-route.js` has two initialization paths:
1. Via `window.LoveBudAuthFirebase.onAuthStateChanged` (if available)
2. Via direct `firebase.auth().onAuthStateChanged` (fallback)

Neither path removes the existing `onAuthStateChanged` listener in `auth-firebase.js`, creating a duplicate.

## Duplicated or ambiguous responsibilities

| Responsibility | Files | Ambiguity |
|---------------|-------|-----------|
| `isLoginPage()` | `auth.js` (lines 77-83), `auth-state.js` (lines 34-41), `auth-login-page.js` (lines 4-9), `auth-firebase.js` (line 127 via `isProtectedRoute()`) | Four implementations of the same path check |
| `resolveEmailAuthMode()` | `auth.js` (lines 85-97), `auth-state.js` (lines 18-32) | Two implementations, identical logic |
| `getCachedAuthUser()` | `auth-cache.js` (lines 67-78), `auth-protected-route.js` `getAuthenticatedUser()` (lines 155-168) | `auth-protected-route.js` duplicates localStorage auth_cache read |
| `buildLoginButton()` | `auth-ui.js` (lines 86-94), `auth-ui-templates.js` (lines 17-21), `auth.js` (lines 413-417) | Three implementations, `auth-ui-templates.js` has no i18n |
| `buildUserDropdown()` | `auth-ui.js` (lines 105-154), `auth-ui-templates.js` (lines 33-74), `auth.js` (lines 427-466) | Three implementations. `auth-ui.js` has lang selector + settings link; `auth-ui-templates.js` has disabled settings + no lang; `auth.js` fallback has disabled settings + no lang |
| `getBasePath()` | `auth-ui.js` (lines 45-49), `auth-ui-templates.js` (lines 2-6), `auth.js` (lines 390-396) | Three implementations, identical logic |
| `escapeHtml()` | `auth-ui.js` (lines 51-60), `auth-ui-templates.js` (lines 8-15), `auth.js` (lines 401-411) | Three implementations, identical logic |
| `onAuthStateChanged` | `auth-firebase.js` (line 672), `auth-protected-route.js` (lines 109-115) | Two subscriptions to same Firebase event |
| `setEmailAuthMode()` | `auth.js` (lines 109-112), `auth-state.js` (lines 126-128) | `auth.js` calls `auth-state` after setting locally |
| `markAuthLoading()` | `auth-ui.js` (lines 8-15), `auth.js` (lines 343-357) | `auth.js` fallback duplicates inline |
| `markAuthReady()` | `auth-ui.js` (lines 17-43), `auth.js` (lines 359-386) | `auth.js` fallback duplicates inline |

## Runtime-critical files (not to touch casually)

| File | Risk | Reason |
|------|------|--------|
| `js/auth/auth-firebase.js` | **HIGH** | Contains `onAuthStateChanged`, sign-in/out, redirect flow. Breaking any of these breaks all auth. |
| `js/auth/auth-cache.js` | **HIGH** | Cache key names (lovebud_auth_cache, lovebud_auth_confirmed, lovebud_auth_token) must never change without migration. Clearing stale Firebase state must preserve active session. |
| `js/auth.js` | **MEDIUM** | 747-line fallback file. Changing the delegation logic could break the bridge/sub-module handoff. |
| `js/auth/auth-login-page.js` | **MEDIUM** | Email auth form submission, Firebase sign-in error handling. Changes affect login UX for all users. |
| `js/auth/auth-protected-route.js` | **MEDIUM** | Route protection gating. Breaking this exposes protected pages or blocks legitimate users. |

## Staged low-risk refactor plan

### Phase 1: Remove triplicated UI templates (low risk)

1. PR: Remove `auth-ui-templates.js` `escapeHtml`, `getBasePath`, `buildLoginButton`, `buildUserDropdown` — delegate to `auth-ui.js` exclusively.
2. PR: Remove inline fallback UI builders from `auth.js` (lines 390-466, 413-417, 427-466) — delegate to `auth-ui.js` exclusively.
3. PR: Remove `auth.js` inline `markAuthLoading` / `markAuthReady` — delegate to `auth-ui.js`.

### Phase 2: Deduplicate cross-file helpers (low risk)

4. PR: Remove duplicate `isLoginPage()` from `auth-login-page.js` and `auth.js` — reference `auth-state.js` implementation.
5. PR: Remove duplicate `resolveEmailAuthMode()` from `auth.js` — reference `auth-state.js`.
6. PR: Remove duplicate `setEmailAuthMode()` body from `auth.js` — delegate to `auth-state.js`.

### Phase 3: Remove bootstrap compatibility boundary (medium risk)

7. Audit: Verify all pages load sub-modules in the correct order (auth-state → auth-cache → auth-callbacks → auth-ui → auth-session → auth-firebase → auth.js).
8. PR: Remove `createBootstrapCompatibilityBoundary()` from `auth-state.js` — no longer needed since all sub-modules exist.
9. PR: Simplify `auth.js` module-level resolution — remove `__authBootstrapCompat` branch, always read `window.LoveBudAuth*` directly.

### Phase 4: Deduplicate auth state subscriptions (medium risk)

10. PR: Remove `auth-protected-route.js`'s independent `onAuthStateChanged` listener — use existing `authUI.updateNavUI()` or `registerOnAuthReady()` instead.
11. PR: Remove `auth-protected-route.js`'s `getAuthenticatedUser()` — delegate to `auth-cache.js` `getCachedAuthUser()`.

### Phase 5: Thin auth.js entry (high risk — defer)

12. PR: Remove inline fallback code from `auth.js` for `signInWithGoogle`, `signOut`, `setupGoogleBtn`, `setupEmailAuthForm`, `setupSignupForm`, `setupSignupGoogleBtn` — these already delegate to sub-modules via `callLoginPageModule` or `__authProtectedRouteBridge`. The inline fallback paths are dead code if all sub-modules load successfully.

### Defer (risky or blocked)

- `auth.js` (747 lines) full thin-entrypoint conversion — Depends on Phase 1-5 completion. Cannot safely inline-delegate all responsibilities until sub-module loading is guaranteed on all pages.
- `auth-firebase.js` (754 lines) split — Contains `initAuth`, `signInWithGoogle`, `signOut`, `onAuthStateChanged`, `getRedirectResult`. These are deeply intertwined. Splitting requires ensuring the `onAuthStateChanged` callback chain is preserved.
- Auth cache key policy change — Keys are read by `auth.js`, `auth-cache.js`, `auth-protected-route.js`, and Firebase itself. Changing key names requires coordinated migration.
- Login page `auth.js`-less init path — `login.html` skips `auth.js` entirely. Normalizing this requires ensuring `auth.js`'s bridge setup steps are not needed for login-only flows.

## Acceptance criteria checklist

- [x] docs-only: no JS/HTML/CSS changes
- [x] auth entrypoints documented by page type
- [x] Firebase init and auth listener ownership documented
- [x] cached-session lifecycle documented
- [x] protected-route lifecycle documented
- [x] login-page lifecycle documented
- [x] callback/event ownership documented
- [x] UI rendering ownership documented
- [x] compatibility/bootstrap paths identified
- [x] duplicated/ambiguous responsibilities enumerated
- [x] runtime-critical files identified
- [x] staged low-risk refactor plan with 5 phases + deferred items
- [x] no behavior changes
- [x] no Firebase config changes
- [x] no route protection behavior changes
- [x] no Scout/My Trees/Browse changes
- [x] no module conversion (type="module")
- [x] keeps #1882 open
