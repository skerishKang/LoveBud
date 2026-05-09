# Auth Global Exports Inventory

Issue: #78

## Purpose

Document all `window.LoveBudAuth*` global exports before any namespace cleanup or alias removal.

This inventory is the prerequisite for Issue #78 global exports and legacy aliases cleanup.

## Scope

- Docs-only audit document.
- No global alias removal.
- No namespace migration.
- No JS changes.

## LoveBudAuth* Global Exports

| Export Name | Source File | Type | Purpose |
|------------|-------------|------|---------|
| `window.LoveBudAuthState` | `js/auth/auth-state.js` | module | Auth state management |
| `window.LoveBudAuthUI` | `js/auth/auth-ui.js` | module | Auth UI rendering |
| `window.LoveBudAuthSession` | `js/auth/auth-session.js` | module | Session management |
| `window.LoveBudAuthFirebase` | `js/auth/auth-firebase.js` | module | Firebase auth integration |
| `window.LoveBudAuthCache` | `js/auth/auth-cache.js` | module | Auth cache management |
| `window.LoveBudAuthCallbacks` | `js/auth/auth-callbacks.js` | module | Auth callbacks |
| `window.LoveBudAuthBootstrap` | `js/auth.js` | module | Auth initialization bootstrap |
| `window.LoveBudAuthLoginPage` | `js/auth/auth-login-page.js` | module | Login page controller |

## Legacy Aliases

| Alias Name | Source | Maps To | Status |
|-----------|--------|---------|--------|
| `window.LoveBudLoginPageController` | `js/auth/auth-login-page.js` | `LoveBudAuthLoginPage` | Legacy alias, do not use |
| `window.LoveBudLoginPageAuthError` | `js/auth/auth-login-page.js` | Login page error handler | Legacy alias |
| `window.EMAIL_AUTH_MODE` | `js/auth/auth-firebase.js` | Internal | Runtime internal |

## Loading Order

The following order must be preserved:

```
1. js/auth/auth-state.js     → LoveBudAuthState
2. js/auth/auth-ui.js        → LoveBudAuthUI
3. js/auth/auth-session.js   → LoveBudAuthSession
4. js/auth/auth-firebase.js  → LoveBudAuthFirebase
5. js/auth/auth-cache.js     → LoveBudAuthCache
6. js/auth/auth-callbacks.js → LoveBudAuthCallbacks
7. js/auth/auth-login-page.js → LoveBudAuthLoginPage
8. js/auth.js               → LoveBudAuthBootstrap
```

## Usage by Pages

| Page | Loaded Modules |
|------|---------------|
| `index.html` | auth-state, auth-ui, auth-session, auth-firebase, auth-cache, auth-callbacks, auth |
| `pages/login.html` | auth-state, auth-ui, auth-session, auth-firebase, auth-cache, auth-login-page, auth |
| `pages/settings.html` | auth-state, auth-ui, auth-session, auth-firebase, auth-cache, auth-callbacks, auth |
| `pages/my-trees.html` | auth-state, auth-ui, auth-session, auth-firebase, auth-cache, auth-callbacks, auth |
| `pages/editor.html` | auth-state, auth-ui, auth-session, auth-firebase, auth-cache, auth-callbacks, auth |

## Legacy Alias Preservation Principles

1. **Do not remove** legacy aliases until all pages are updated.
2. **Do not create new** legacy aliases.
3. **Document existing** legacy aliases before cleanup.
4. **Keep backward compatibility** during migration.

## Related

- Refs #78