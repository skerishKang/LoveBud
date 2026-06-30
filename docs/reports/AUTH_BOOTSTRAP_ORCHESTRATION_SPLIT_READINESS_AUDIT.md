# Auth Bootstrap Orchestration Split Readiness Audit

## Audit Scope

- **Issue**: #3089
- **Parent**: #3086, #1882
- **Protected**: #2960 (detail panel tree context), #2856 (growth affordance), #3070 (save completion — paused)
- **Explicit exclusions**: #2972 (media), #2976 (copy centralization), Firebase/Auth provider/API/config changes, cache-key/storage format/redirect URL/session semantics changes
- **Runtime (this audit PR)**: No changes
- **Documentation only (this audit PR)**

## 1. Base SHA

- **Current main**: `3c9b02ac1cc32a6c2675c42840d8d4c9842f219a`
- **No open PRs interfering**: only #2960 (protected), #2856 (protected) are open
- **No pending changes** on `main`

## 2. Current `js/auth.js` Responsibility Cluster Map

Total: 758 lines. Single script, no IIFE (module vars prefixed with `__`). Boot: `document.addEventListener('DOMContentLoaded', initAuth)` (line 758).

### 2.1 Compatibility bootstrap / auth-mode resolution (lines 14–56)

Module-level variables resolved at parse time via `window.LoveBudAuthState.createBootstrapCompatibilityBoundary()`:
- `__authBootstrapCompat` (lines 14–17) — optional compatibility boundary from `auth-state.js`
- `__authStateModule`, `__authUiModule`, `__authSessionModule`, `__authFirebaseModule` (lines 18–30) — delegated module references
- `EMAIL_AUTH_MODE` (lines 31–46) — resolved from compat boundary → `__authStateModule.getEmailAuthMode()` → URL param `mode`/`__initialAuthMode` → `'login'`
- `AUTH_INIT_FLAG`, `AUTH_READY_FLAG`, `DROPDOWN_LISTENER_ATTACHED` (lines 47–55) — flag key constants
- `resolveAuthBootstrap(user)` (lines 57–66) — calls compat boundary or `window.LoveBudAuthBootstrap.resolve`

Key pattern: every module-level variable has a 3-level fallback: compat boundary → individual `__auth*Module` → inline fallback.

### 2.2 Login/signup UI fallback (lines 77–176)

- `isLoginPage()` (lines 77–83) — URL path check against `login.html`. Delegates to `__authStateModule.isLoginPage()`.
- `resolveEmailAuthMode()` (lines 85–97) — URL param `mode` / `__initialAuthMode`. Delegates to `__authStateModule.resolveEmailAuthMode()`.
- `callLoginPageModule(methodName, args)` (lines 99–107) — delegates to `window.LoveBudAuthLoginPage.callLoginPageModule`.
- `setEmailAuthMode(emailAuthMode)` (lines 109–112) — sets `EMAIL_AUTH_MODE` + syncs to `__authStateModule`.
- `syncEmailAuthModeUi(options)` (lines 114–167) — updates login/signup UI elements (title, helper, submitBtn, toggleBtn, badge). Attemps `callLoginPageModule` first, then native inline fallback with `data-i18n` + `window.applyI18n`.
- `setupLoginPageAuthUi()` (lines 169–176) — calls `callLoginPageModule('setupLoginPageAuthUi', ...)`.
- `setupEmailAuthEntry()` (lines 703–711) — calls `callLoginPageModule('setupEmailAuthEntry', ...)` for Firebase-independent UI binding.

### 2.3 Confirmed-session cache helpers (lines 200–217)

- `__authCacheBridge` (lines 201–209) — built from `window.LoveBudAuthCache.createConfirmedAuthCacheBridge` with cache key constants.
- 7 exported helpers (lines 211–217): `isInvalidAuthSessionError`, `clearStaleFirebaseAuthState`, `getCachedAuthUser`, `setConfirmedAuthCache`, `clearConfirmedAuthCache`, `getCachedAuthToken`, `persistConfirmedAuthSession`.
- Cache key policy documented at lines 68–75: `lovebud_auth_cache`, `lovebud_auth_confirmed`, `lovebud_auth_token` — cleared on logout.

### 2.4 Protected-route bridge (lines 219–249)

- `__authProtectedRouteBridge` (lines 219–249) — built from `__authFirebaseModule.createProtectedRouteBridge({...})` with 25+ callback injections.
- Bridge receives: `resolveEmailAuthMode`, `setupLoginPageAuthUi`, `applyCachedAuthState`, `markAuthLoading`, `markAuthReady`, `initOfflineAuth`, `attachDropdownListener`, `persistConfirmedAuthSession`, `updateNavUI`, `fireAuthReadyCallbacks`, `resolveAuthBootstrap`, `isInvalidAuthSessionError`, `clearStaleFirebaseAuthState`, `clearConfirmedAuthCache`, `setupGoogleBtn`, `setupEmailAuthForm`, `setupSignupForm`, `setupSignupGoogleBtn`, `authInitFlag`, `authReadyFlag`, `isLoginPage`, `getCachedAuthUser`, `buildUserDropdown`, `getEnvironmentCheckError`, `preloadRedirectTargetData`, `getRedirectTarget`.

This is the heaviest dependency injection in the file: 25+ function refs passed as a deps object.

### 2.5 Redirect preload / return target (lines 252–314)

- `preloadRedirectTargetData()` (lines 252–314) — fire-and-forget data preload after login. Delegates to `__authSessionModule.preloadRedirectTargetData()` or native: preloads trees list via `window.apiClient.getTrees()`, caches to `localStorage`, and optionally preloads first tree detail + memories if redirect target is editor or my-trees.
- `getRedirectTarget()` (lines 583–592) — resolved from URL param `redirect` → `getBasePath() + 'my-trees.html'`. Delegates to `__authSessionModule.getRedirectTarget()`.

### 2.6 Firebase/auth readiness coordination (lines 323–389)

- `initAuth()` (lines 323–333) — boot entry point: calls `setupEmailAuthEntry()` → `__authProtectedRouteBridge.initAuth()` → `initOfflineAuth()` fallback.
- `initOfflineAuth()` (lines 335–344) — delegates to bridge or native: `markAuthReady()`, `updateNavUI(null)`, `resolveAuthBootstrap(null)`, `fireAuthReadyCallbacks(null)`.
- `markAuthLoading()` (lines 346–360) — sets loading skeleton on `#auth-nav` / `#auth-nav-container`.
- `markAuthReady()` (lines 362–389) — sets `window[AUTH_READY_FLAG] = true`, removes spinner, restores visibility, adds `.auth-ready` class.
- `applyCachedAuthState()` (lines 316–321) — delegates to `__authProtectedRouteBridge.applyCachedAuthState()`.

### 2.7 Authenticated navigation/dropdown (lines 391–579)

- `getBasePath()` (lines 393–402) — resolves `/pages/` context for hrefs. Exported as `window.getBasePath`.
- `escapeHtml(value)` (lines 404–414) — delegates to `window.LoveBudSecurity.escapeHtml`.
- `buildLoginButton()` (lines 416–420) — returns login anchor HTML.
- `getUserAvatarInitial(user)` (lines 422–428) — returns first character of displayName/email.
- `buildUserDropdown(user)` (lines 430–469) — builds full dropdown HTML: avatar, menu items (my-trees, settings, logout).
- `updateHeaderLangToggleVisibility(isLoggedIn)` (lines 480–487) — ensures language toggle stays visible.
- `updateNavUI(user)` (lines 489–521) — delegates to `__authUiModule` or native: calls `persistConfirmedAuthSession`, then `buildUserDropdown` / `buildLoginButton`, sets innerHTML on `#auth-nav` / `#auth-nav-container`.
- `attachDropdownListener()` (lines 530–579) — single delegated click listener on `document` for `.user-dropdown-trigger` (toggle menu), `[data-auth-action="logout"]` (sign out), and outside-click (close). Uses `DROPDOWN_LISTENER_ATTACHED` guard.

### 2.8 Logout/offline/failure fallback (lines 581–741)

- `getEnvironmentCheckError()` (lines 598–602) — delegates to bridge or `__authFirebaseModule`.
- `getFriendlyErrorMessage(error, isGoogleLogin)` (lines 608–614) — delegates to bridge or `__authFirebaseModule`, fallback Korean message.
- `signInWithGoogle()` (lines 616–647) — delegates to bridge → `__authFirebaseModule` → native Firebase.
- `signOut()` (lines 649–680) — delegates to bridge → `__authFirebaseModule` → native Firebase sign out, then: `clearStaleFirebaseAuthState`, `localStorage.removeItem('isLoggedIn')`, `window.clearPrivateCaches()`, `clearConfirmedAuthCache()`, `window.location.reload()`.
- `setupGoogleBtn()` (lines 684–688) — delegates to `callLoginPageModule('setupGoogleBtn', ...)`.
- `signUpWithGoogle()` (lines 690–693) — delegates to `signInWithGoogle()`.
- `setupSignupGoogleBtn()` (lines 695–699) — delegates to `callLoginPageModule('setupSignupGoogleBtn', ...)`.
- `setupEmailAuthForm()` (lines 715–730) — delegates to `callLoginPageModule('setupEmailAuthForm', ...)`.
- `setupSignupForm()` (lines 732–742) — delegates to `callLoginPageModule('setupSignupForm', ...)`.

### 2.9 Global surface export (lines 744–756)

Exported globals:
- `window.signInWithGoogle` (line 745)
- `window.signOut` (line 746)
- `window.initAuth` (line 747)
- `window.getEnvironmentCheckError` (line 748)
- `window.getFriendlyErrorMessage` (line 749)
- `window.getConfirmedAuthUser` (line 752) — alias for `getCachedAuthUser`
- `window.hasConfirmedAuthSession` (lines 753–755) — `() => !!getCachedAuthUser()`
- `window.getCachedAuthToken` (line 756)
- `window.registerOnAuthReady` (line 189)
- `window.getBasePath` (line 402)

### 2.10 Auth-ready callback bridge (lines 178–198)

- `window.registerOnAuthReady` (line 189) — public registration API
- `fireAuthReadyCallbacks(user)` (lines 196–198) — internal: fires all registered callbacks
- Backed by `window.LoveBudAuthCallbacks.createAuthReadyCallbackBridge`

## 3. Auth-Related Global Ownership and Script Order

### Script load order — viewer/editor pages (`pages/view.html`)

```
Lines 76–78: Firebase SDK (firebase-app, firebase-auth) + firebase-config.js
Lines 80–87: Auth modules:
  80: auth-state.js → LoveBudAuthState, LoveBudAuthBootstrap
  81: auth-callbacks.js → LoveBudAuthCallbacks, __onAuthReadyCallbacks, __lastAuthUser
  82: auth-cache.js → LoveBudAuthCache
  83: auth-ui.js → LoveBudAuthUI
  84: auth-session.js → LoveBudAuthSession
  85: auth-firebase.js → LoveBudAuthFirebase
  86: auth-ui-templates.js → LoveBudAuthUiTemplates
  87: auth.js → initAuth (DOMContentLoaded boot), +10 exported globals
Lines 89–92: API/policy modules
Lines 94–99: i18n modules
Lines 101+: page-specific modules (shared-header, page-transitions, viewer/editor)
```

### Script load order — login/signup pages (`pages/login.html`)

```
Lines 115–124: i18n modules
Line 125:      shared-header.js
Lines 126–136: Auth modules (same order as view.html):
  126: auth-state.js
  127: auth-callbacks.js
  128: auth-cache.js
  129: auth-ui.js
  130: auth-session.js
  131: auth-firebase.js
  132: js/login/login-dom.js
  133: js/login/login-page.js
  134: auth-login-page.js → LoveBudAuthLoginPage
  135: auth-ui-templates.js
  136: auth.js → initAuth boots
Line 137:      login-page.js (legacy)
Line 138:      page-transitions.js
```

### `window.*` auth global ownership map

| Global | Owner File | Consumer(s) |
|--------|-----------|-------------|
| `LoveBudAuthState` | `auth-state.js` | `auth.js` (bootstrap resolve), `auth-protected-route.js` |
| `LoveBudAuthBootstrap` | `auth-state.js` | `auth.js` (`resolveAuthBootstrap`) |
| `LoveBudAuthCallbacks` | `auth-callbacks.js` | `auth.js` (callback bridge) |
| `LoveBudAuthCache` | `auth-cache.js` | `auth.js` (cache bridge) |
| `LoveBudAuthUI` | `auth-ui.js` | `auth.js` (nav UI fallback) |
| `LoveBudAuthUiTemplates` | `auth-ui-templates.js` | `auth-ui.js`, `auth.js` (template fallback) |
| `LoveBudAuthSession` | `auth-session.js` | `auth.js` (redirect + preload) |
| `LoveBudAuthFirebase` | `auth-firebase.js` | `auth.js` (protected bridge), `auth-protected-route.js` |
| `LoveBudAuthLoginPage` | `auth-login-page.js` | `auth.js` (login page UI delegation) |
| `LoveBudProtectedRoute` | `auth-protected-route.js` | `my-trees.js`, `settings.js`, `editor-auth-helpers.js` |
| `__onAuthReadyCallbacks` | `auth-callbacks.js` | `auth.js` (callback storage) |
| `__lastAuthUser` | `auth-callbacks.js`, `auth-protected-route.js` | `auth.js` (user cache) |
| `__lovebudAuthReady` | `auth-protected-route.js` | Page-level ready check |
| `__lovebudLoginAuthStateBound` | `auth-login-page.js` | Login page guard |
| `__lovebudEmailAuthEntryBound` | `auth-login-page.js` | Login page email entry guard |
| `EMAIL_AUTH_MODE` | `auth-firebase.js` | `auth.js` (sign-in mode) |
| `signInWithGoogle` | `auth.js` | Page-level Google sign-in trigger |
| `signOut` | `auth.js` | Page-level logout trigger, `shared-header.js` |
| `initAuth` | `auth.js` | Boot entry (DOMContentLoaded) |
| `getEnvironmentCheckError` | `auth.js` | `auth.js` internal, `auth-protected-route.js` |
| `getFriendlyErrorMessage` | `auth.js` | Login/auth form error display |
| `getConfirmedAuthUser` | `auth.js` | `shared-header.js`, `my-trees.js`, `settings.js`, `editor-auth-helpers.js`, `public-canvas-init.js` |
| `hasConfirmedAuthSession` | `auth.js` | `my-trees.js`, `settings.js` |
| `getCachedAuthToken` | `auth.js` | API calls, `editor-auth-helpers.js` |
| `registerOnAuthReady` | `auth.js` (via bridge) | `my-trees.js`, `public-canvas-init.js`, `page-level init` |
| `getBasePath` | `auth.js` | Page-level href resolution |

### Login/signup page dependency

`login.html` (and `signup.html`) use `auth-login-page.js` to build form UI. `auth.js` provides `callLoginPageModule` as the delegation mechanism. The login page modules (`login-dom.js`, `login-page.js`, `auth-login-page.js`) are loaded **before** `auth.js` in the script order, ensuring `window.LoveBudAuthLoginPage` is available when `initAuth` runs.

### Editor/viewer/My Trees route dependency

All authenticated routes read `window.getConfirmedAuthUser()` / `window.hasConfirmedAuthSession()` and `window.registerOnAuthReady()` for auth-gating. The `window.LoveBudProtectedRoute` namespace (`auth-protected-route.js`) provides the higher-level auth guard (`waitForAuthReady`, `requireAuthenticatedPage`). `auth.js` injects itself into the protected route bridge via `__authProtectedRouteBridge = __authFirebaseModule.createProtectedRouteBridge({...})`.

## 4. Lifecycle Boundary

### Auth readiness

- `initAuth()` is called on `DOMContentLoaded` (line 758).
- `markAuthLoading()` shows a loading skeleton immediately.
- Firebase `onAuthStateChanged` resolves → `markAuthReady()`, `updateNavUI()`, `fireAuthReadyCallbacks()`.
- `window[AUTH_READY_FLAG]` (`__lovebudAuthReady`) set to `true`.

### Cached confirmed session

- `applyCachedAuthState()` reads `localStorage` from `AUTH_CACHE_KEY` key.
- If cached user found → `setConfirmedAuthCache`, `updateNavUI`, `fireAuthReadyCallbacks` with cached user.
- On Firebase auth state change → `persistConfirmedAuthSession` updates cache.
- Cache key names: `AUTH_CACHE_KEY` (`lovebud_auth_cache`), `AUTH_CONFIRMED_KEY` (`lovebud_auth_confirmed`), `AUTH_TOKEN_KEY` (`lovebud_auth_token`).

### Token/session refresh

- `persistConfirmedAuthSession` stores user + token to cache.
- `getCachedAuthToken` reads token from cache.
- `isInvalidAuthSessionError` / `clearStaleFirebaseAuthState` handle stale token cleanup.
- Token lifecycle managed by `auth-cache.js` via `createConfirmedAuthCacheBridge`.

### Logout cleanup

`signOut()` sequence:
1. Firebase `auth().signOut()`
2. `clearStaleFirebaseAuthState()`
3. `localStorage.removeItem('isLoggedIn')`
4. `window.clearPrivateCaches()` — clears private data caches
5. `clearConfirmedAuthCache()` — removes `lovebud_auth_cache`, `lovebud_auth_confirmed`, `lovebud_auth_token`
6. `window.location.reload()`

Note: public browse cache (`lovebud_public_trees_cache`) is intentionally preserved (documented at line 673).

### Redirect target handling

- `getRedirectTarget()` resolved from URL param `redirect` → default `my-trees.html`.
- `preloadRedirectTargetData()` fire-and-forget: fetches trees list + first tree detail/memories into `localStorage` keys: `lovebud_trees_cache`, `tree_detail_{id}`, `tree_memories_{id}`.

### Offline/failure fallback

- `initAuth()` → `__authProtectedRouteBridge.initAuth()` → `initOfflineAuth()` (fallback path).
- `initOfflineAuth()`: `markAuthReady()` → `updateNavUI(null)` → `resolveAuthBootstrap(null)` → `fireAuthReadyCallbacks(null)` (all null-user).
- `signInWithGoogle()` has 3-level fallback: bridge → `__authFirebaseModule` → native Firebase with inline error messages.

## 5. Fallback vs Delegated Path Map

### Current design pattern

Every internal function in `auth.js` follows the same pattern:
```
function fn(args) {
  if (delegatedModule && delegatedModule.fn) return delegatedModule.fn(args);
  // inline fallback implementation
}
```

This is a **delegate-first, fallback-last** architecture. The inline fallback implementations exist because:
1. **Graceful degradation** — if a sub-module (`auth-state.js`, `auth-firebase.js`, etc.) fails to load (e.g., network error on script tag), `auth.js` can still boot with basic functionality.
2. **Backward compatibility** — during incremental module extraction, the fallback path preserves behavior until the delegated module is guaranteed available.
3. **Testing/development** — individual pages can load `auth.js` without requiring the full auth sub-module chain.

### Fallbacks that must NOT be removed

| Fallback | Why it must remain |
|----------|-------------------|
| `EMAIL_AUTH_MODE` inline resolution (lines 35–46) | Works without any auth sub-module loaded; used before `__authStateModule` may be ready |
| `isLoginPage()` inline (lines 79–83) | URL path check has no dependency on any module |
| `syncEmailAuthModeUi` inline DOM update (lines 126–167) | Login page must render even if `auth-login-page.js` fails to load |
| `buildLoginButton()` inline (line 419) | Login button must render even without `auth-ui.js` or `auth-ui-templates.js` |
| `buildUserDropdown()` inline (lines 430–469) | User dropdown must render on all pages without UI module dependency |
| `updateNavUI()` inline (lines 502–520) | Nav must work after `AUTH_READY_FLAG` even without `auth-ui.js` |
| `attachDropdownListener()` inline (lines 547–578) | Dropdown interactions must work on all pages |
| `signOut()` native path (lines 661–679) | Logout must work even if `auth-firebase.js` or protected route bridge is missing |
| `signInWithGoogle()` native path (lines 631–647) | Google sign-in must work with fallback Firebase initialization |
| `preloadRedirectTargetData()` inline (lines 262–313) | Post-login data preload must work even without `auth-session.js` |

### Byte-for-byte behavior preservation boundaries

The following interfaces must remain byte-for-byte compatible during any extraction:
- Cache keys: `lovebud_auth_cache`, `lovebud_auth_confirmed`, `lovebud_auth_token`
- Cache storage format: JSON in `localStorage`
- Cache key constants: `AUTH_CACHE_KEY`, `AUTH_CONFIRMED_KEY`, `AUTH_TOKEN_KEY`
- DOM IDs: `#auth-nav`, `#auth-nav-container`, `#userDropdown`, `.user-dropdown-trigger`, `.user-dropdown-menu`
- CSS classes: `.auth-ready`, `.show`, `[data-auth-action="logout"]`
- Redirect URL param: `?redirect=`
- Global flags: `__lovebudAuthReady`, `__lovebudAuthInitialized`
- Boot timing: `DOMContentLoaded → initAuth()`
- `signOut()` cleanup sequence: cache clear order, private caches, reload

### Auth mode differences

- `login` mode: shows login form UI, no display-name field
- `signup` mode: shows signup form UI with display-name field, different i18n labels
- Google sign-in: same `signInWithGoogle()` for both modes (`signUpWithGoogle()` just delegates)
- Email mode resolution: URL param `mode=signup` / `mode=login` — checked in `EMAIL_AUTH_MODE` module variable and `resolveEmailAuthMode()`

## 6. First Extraction Candidate (Exact 1)

### Candidate: `preloadRedirectTargetData()` + `getRedirectTarget()` → dedicated post-login preload module

**Rationale**: These two functions form a self-contained **post-login data preload cluster** with no dependency on auth bootstrap, auth-mode resolution, UI rendering, or session management. `getRedirectTarget()` reads URL params and returns a string. `preloadRedirectTargetData()` is a fire-and-forget async data loader with a single dependency on `window.apiClient`. Combined size: ~62 lines.

This cluster is orthogonal to init sequence — it is only called after successful login (from `auth-firebase.js` and `auth-protected-route.js` paths), never during auth bootstrap. Extraction would reduce `auth.js` by ~8% and remove the only direct `localStorage` write of tree cache data from the auth bootstrap file.

**Operation**: Behavior-preserving source split. Extract `getRedirectTarget` and `preloadRedirectTargetData` into a new `auth-session-preload.js`. Keep `auth.js` calling them through either `window.AuthSessionPreload` or the existing `window.LoveBudAuthSession` namespace.

**Key invariant**: `signInWithGoogle`, `setupEmailAuthForm`, `setupSignupForm` callbacks must still resolve `preloadRedirectTargetData` at the same point in the auth flow. `getRedirectTarget` must return the same URL string.

**Required changes**:
1. Create `js/auth/auth-session-preload.js` — host `preloadRedirectTargetData`, `getRedirectTarget`, and the `escapeHtml` helper (if needed)
2. `js/auth/auth.js` — remove extracted functions; import via `window.AuthSessionPreload` or delegate to `window.LoveBudAuthSession`
3. `pages/view.html`, `pages/login.html`, `pages/signup.html` — add `<script>` tag for the new module **before** `auth.js`

**Allowed files** (minimum set):
- `js/auth/auth-session-preload.js` (new)
- `js/auth/auth.js` (remove extracted functions, add delegation)
- `pages/view.html`, `pages/login.html`, `pages/signup.html` (add `<script>` tag)

**Forbidden files**:
- `js/auth/auth-cache.js`, `js/auth/auth-firebase.js`, `js/auth/auth-state.js`, `js/auth/auth-ui.js`, `js/auth/auth-ui-templates.js`, `js/auth/auth-callbacks.js`, `js/auth/auth-session.js`, `js/auth/auth-protected-route.js`, `js/auth/auth-login-page.js` (no existing auth module changes)
- `js/editor/*`, `js/viewer/*` (no page-specific modules)
- `css/*.css` (no CSS)
- `functions/*`, `modal_compute/*`, `netlify/*` (no deployment changes)

**Preserved globals**:
- All 10 existing `window.*` exports from `auth.js` (unchanged)
- `window.LoveBudAuthSession`, `window.LoveBudAuthFirebase`, `window.LoveBudProtectedRoute` (unchanged)
- New module may export `AuthSessionPreload` as a dedicated surface or extend `LoveBudAuthSession`

**Rollback condition**:
- If `preloadRedirectTargetData` is not callable from `signInWithGoogle` or `setupEmailAuthForm` after extraction → full rollback
- If `getRedirectTarget` returns a different URL → revert
- If `pages/view.html`, `pages/login.html`, or `pages/signup.html` script order breaks auth boot → revert
- If any page that loads `auth.js` without the new module breaks (fallback elimination) → revert
- If `localStorage` cache keys (`tree_detail_*`, `tree_memories_*`, `lovebud_trees_cache`) or their JSON format changes → revert

**Boundary**: Behavior-preserving source split only. No cache key rename, no storage format change, no redirect URL change, no namespace flatten. All auth sub-module fallback paths preserved.

## 7. Future Focused Verification Matrix

| Scenario | Verification method |
|----------|-------------------|
| Login (Google) | Focused contract test + signed-in production smoke |
| Login (email) | Focused contract test |
| Signup (email) | Focused contract test |
| Cached session (revisit within session) | Focused contract test: cache read → `getConfirmedAuthUser` returns user |
| Expired session (token expired on revisit) | Focused contract test: `isInvalidAuthSessionError` → re-login flow |
| Logout (Google) | Focused contract test: `signOut` clears cache + reloads |
| Logout (email) | Focused contract test |
| Protected route (viewer/editor without auth) | Focused contract test: redirect to login |
| Protected route (with valid session) | Focused contract test: `requireAuthenticatedPage` passes |
| Redirect return path (`?redirect=editor.html`) | Focused contract test: `getRedirectTarget` returns correct URL |
| Offline/failure state (Firebase unavailable) | Focused contract test: `initOfflineAuth` boots with null user |
| Preload data (post-login `apiClient.getTrees`) | Focused contract test: `preloadRedirectTargetData` stores to `localStorage` |
| Preload data (first tree detail + memories) | Focused contract test |
| Public page (search, intro — no auth needed) | Focused contract test: auth boots, UI shows login button |

### Remote CI
- GitHub Actions checks only (verify-static, Cloudflare Pages, GitGuardian)

### User production smoke
- One signed-in smoke: login → redirect to my-trees → verify dropdown
- One signed-out smoke: open public tree → verify login button shown

### Prohibited
- Blanket `npm test`, `npm run verify:remote`, `npm run check:pr-guardrails`

## 8. No-Go Areas (Explicit)

### Security-sensitive no-go

- No Firebase/Auth provider, API, config, or credential changes
- No raw token, session value, credential, or test-account password in documentation
- No cache-key, storage format, redirect URL, or session semantics changes
- No removal of fallback behavior until an equivalent tested boundary exists
- No user-visible login/signup redesign

### Protected PR scope

- **#2960**: `ux(editor): recompose detail panel with persistent tree context` — no detail-panel scope changes
- **#2856**: `fix(editor): stabilize growth affordance render` — no canvas-affordance scope changes
- **#3070**: `fix(editor): complete save feedback` — paused; no save-completion scope

### Other no-go

- No #2972 media scope changes
- No #2976 copy centralization scope changes
- No `js/editor/*` changes (except `editor-auth-helpers.js` if needed)
- No `js/viewer/*` changes
- No `css/*` changes
- No `functions/*`, `modal_compute/*`, `netlify/*` changes
- No test addition/modification in this audit PR (audit-only)
- No `Closes #1882`, `Fixes #1882`, `Resolves #1882` — only `Refs #1882`

## 9. Next Implementation PR Minimum Scope

### First extraction PR (after this audit):

1. **Create** `js/auth/auth-session-preload.js` — host `getRedirectTarget` and `preloadRedirectTargetData`
2. **Remove** extracted functions from `js/auth/auth.js`; delegate via `AuthSessionPreload` namespace (preserving existing `LoveBudAuthSession` delegation path)
3. **Add** `<script>` tag in `pages/view.html`, `pages/login.html`, `pages/signup.html` for the new module before `auth.js`
4. **No changes** to any other `js/auth/*.js` file, `js/editor/*`, `js/viewer/*`, `css/*`, or deployment files

### Verification (next implementation PR):

- `git diff --check` (no whitespace errors)
- Focused contract tests only:
  - `getRedirectTarget` returns correct URL from param and default
  - `preloadRedirectTargetData` calls `apiClient.getTrees` and writes to `localStorage`
  - `signInWithGoogle` still triggers preload after login
  - Script order: auth modules load order preserved
- Remote CI (GitHub Actions)
- One signed-in manual smoke: login → verify redirect + data preload
- One signed-out manual smoke: verify login page renders correctly
- No blanket `npm test`, no `npm run verify:remote`, no `npm run check:pr-guardrails`

## Audit Summary

- **Current state**: `js/auth.js` = 758 lines, no IIFE, ~35 internal functions, 10 exported globals, 6 module-level `__auth*` delegation variables
- **Clusters**: compatibility bootstrap (~56 lines), login/signup UI fallback (~100 lines), cache helpers (~18 lines), protected-route bridge (~31 lines), redirect preload (~62 lines), Firebase readiness (~67 lines), nav/dropdown (~189 lines), Google sign-in/signout/forms (~160 lines), exports (~13 lines)
- **Dependencies**: `LoveBudAuthState`, `LoveBudAuthCallbacks`, `LoveBudAuthCache`, `LoveBudAuthUI`, `LoveBudAuthUiTemplates`, `LoveBudAuthSession`, `LoveBudAuthFirebase`, `LoveBudAuthLoginPage`, `LoveBudProtectedRoute` — all loaded before `auth.js` in script order
- **Global surface**: 10 `window.*` functions exported from `auth.js`; 9 namespace objects from sub-modules
- **First extraction candidate**: Post-login data preload cluster (`getRedirectTarget` + `preloadRedirectTargetData`) — behavior-preserving source split, ~62 lines
- **Protected bridges**: #2960, #2856, #3070 — all preserved
- **Exclusions**: #2972 (media), #2976 (copy), Firebase/Auth provider changes, cache-key/storage/redirect/semantics changes, fallback removal
- **No-go**: No security-sensitive changes, no raw credential recording, no fallback removal, no global rename or namespace flatten in this slice

Refs #3089
Refs #3086
Refs #1882
