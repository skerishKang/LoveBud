# Auth.js Audit Report - Issue #1283

## File: js/auth.js (761 lines)

## Identified Modules

### 1. State Management (lines 14-55)
- `__authBootstrapCompat`, `__authStateModule`, `__authUiModule`
- `__authSessionModule`, `__authFirebaseModule`
- `EMAIL_AUTH_MODE`, `AUTH_INIT_FLAG`, `AUTH_READY_FLAG`

### 2. Auth Cache Layer (lines 72-216)
- Cache keys: `AUTH_CACHE_KEY`, `AUTH_CONFIRMED_KEY`, `AUTH_TOKEN_KEY`
- Functions: `getCachedAuthUser`, `setConfirmedAuthCache`, `clearConfirmedAuthCache`
- Bridge pattern: `__authCacheBridge`

### 3. Email Auth Mode (lines 84-166)
- `resolveEmailAuthMode()`, `setEmailAuthMode()`, `syncEmailAuthModeUi()`
- Login page mode handling (login vs signup)

### 4. Login Page UI (lines 168-175)
- `setupLoginPageAuthUi()` - delegates to `LoveBudAuthLoginPage` module

### 5. Auth Callbacks (lines 177-197)
- `__authReadyCallbackBridge` - callback registration/bridge pattern
- `registerOnAuthReady()`, `fireAuthReadyCallbacks()`

### 6. Firebase Auth (remainder)
- Main auth state observer
- Google sign-in
- Email/password auth
- Session persistence

## Recommended Extraction Order (Low Risk First)

1. `__authCacheBridge` helpers → `js/auth-cache-helpers.js`
2. `isLoginPage()`, `resolveEmailAuthMode()` → `js/auth-utils.js`
3. `syncEmailAuthModeUi()` → `js/auth-email-ui.js`
4. Protected route bridge functions

## Non-Goals (Per Issue)
- No auth provider changes
- No UI redesign
- No route gating changes
- No backend changes