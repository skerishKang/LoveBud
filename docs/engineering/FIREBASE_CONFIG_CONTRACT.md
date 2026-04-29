# Firebase Config & Init Global Contract

Status: active runtime contract
Last synced for: Issue #220 Firebase config audit

---

## 1. Purpose

In the LoveBud vanilla static multipage runtime, Firebase config and initialization follow a specific global contract. This document specifies the global symbols, load order, dependent surfaces, and refactor guardrails to prevent accidental breakage during future work.

The contract covers:
- Firebase configuration object
- Firebase initialization flag and function
- Auth readiness tracking
- Auth-ready callback registration

---

## 2. Current Global Contract

### Firebase Configuration

```text
window.FIREBASE_CONFIG
```

Object containing Firebase Web SDK configuration:

```javascript
{
  apiKey: "AIzaSyDQNR8bNIp4LG4EGNwl1ew8B7Har-KJC90",
  authDomain: "relovetree.firebaseapp.com",
  projectId: "relovetree",
  storageBucket: "relovetree.firebasestorage.app",
  messagingSenderId: "1091063063536",
  appId: "1:1091063063536:web:065a746e2578c47dd7b335",
  measurementId: "G-D4R5XMGFK5"
}
```

### Firebase Initialization Flag

```text
window.__lovebudFirebaseInitialized
```

Boolean flag set to `true` after successful `firebase.initializeApp()` call.

### Firebase Initialization Function

```text
window.initFirebase()
```

Idempotent function that initializes Firebase app. Must be called AFTER `firebase-app.js` and `firebase-auth.js` are loaded.

Returns `true` if initialized successfully, `false` otherwise.

### Auth Initialization Flag

```text
window.__lovebudAuthInitialized
```

Boolean flag indicating Firebase Auth observer has been set up. Set during `initAuth()`.

### Auth Ready Flag

```text
window.__lovebudAuthReady
```

Boolean flag indicating auth state has been resolved (signed-in user confirmed or confirmed as signed-out).

**Important:** Do not treat `undefined` or pending auth state as confirmed signed-out. The `__lovebudAuthReady` flag must be `true` before considering auth state reliable.

### Auth-Ready Callback Registration

```text
window.registerOnAuthReady(callback)
```

Array-pattern callback registration for auth-ready notification.

```text
window.__onAuthReadyCallbacks
```

Array of callback functions to be invoked when auth state is confirmed.

---

## 3. Script/Load Order

Pages requiring Firebase must preserve this runtime order:

```text
1. Firebase SDK scripts (firebase-app.js, firebase-auth.js)
2. js/firebase-config.js
3. Auth layer scripts (js/auth.js)
4. Page-specific protected-page initialization
```

**Critical:** `js/firebase-config.js` must load AFTER Firebase SDK scripts. `js/auth.js` depends on `window.FIREBASE_CONFIG` and `initFirebase()` being available.

---

## 4. Dependent Surfaces

The Firebase config/init contract is used by:

| Page | Dependency |
|------|------------|
| `pages/login.html` | Auth initialization, Google/Email sign-in, signup flows |
| `pages/my-trees.html` | Protected page guard, auth state check |
| `pages/editor.html` | Protected page guard, auth state check |
| `pages/settings.html` | Protected page guard (planned), auth state check |
| Shared header auth UI on public pages | Auth nav rendering, dropdown behavior |

---

## 5. Guardrails

When modifying Firebase config/init behavior:

### Do Not

- Convert `var` to `const/let` or IIFE without a documented migration plan
- Remove or rename `FIREBASE_CONFIG`, `initFirebase`, `__lovebudFirebaseInitialized`
- Change Firebase config values in this work
- Change Firebase SDK script order
- Treat `undefined`/`pending` auth state as confirmed signed-out
- Remove `registerOnAuthReady` or `__onAuthReadyCallbacks` array-pattern

### Preserve

- `initFirebase()` idempotency (safe to call multiple times)
- Global auth-ready callback behavior (`registerOnAuthReady`)
- `__lovebudAuthReady` flag semantics (only `true` after Firebase confirms state)
- `FIREBASE_CONFIG` as the single source of truth in `js/firebase-config.js`

---

## 6. Future Migration Options

When refactoring, consider these ordered options:

### Option A: Keep Current Globals with Documented Contract (Recommended Short Term)

Keep existing globals (`FIREBASE_CONFIG`, `initFirebase`, etc.) with this documented contract. No runtime changes required.

### Option B: Add Window Namespace

```javascript
window.LoveBudFirebaseConfig = {
  config: FIREBASE_CONFIG,
  init: initFirebase,
  initialized: __lovebudFirebaseInitialized
};
```

Add namespace while keeping legacy globals for backward compatibility.

### Option C: IIFE with Explicit Exports

```javascript
window.LoveBudFirebase = (function() {
  // Private scope
  return {
    init: initFirebase,
    getConfig: () => ({...FIREBASE_CONFIG})
  };
})();
```

### Option D: Module Migration

ES module migration requires separate approval and coordinated rollout. Must not be mixed with other refactor work.

---

## 7. Required Tests Before Any Implementation

Before any Firebase config or auth-related implementation:

1. **login page smoke** - Google sign-in, email sign-in, sign-up flows work
2. **my-trees auth-pending smoke** - Auth pending state shows neutral skeleton, not stuck loading
3. **editor protected-page smoke** - Protected page guard redirects appropriately
4. **settings auth/return navigation smoke** - Auth state available on return navigation
5. **public header auth UI smoke** - Header auth UI renders correctly on public pages

---

## 8. References

- Issue #220: Firebase config audit
- `js/firebase-config.js` - Single source of truth
- `js/auth.js` - Auth layer implementation
- `docs/security/FIREBASE_CLIENT_CONFIG_POLICY.md` - Security policy