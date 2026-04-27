# Page Script Load Order Runtime Contract

## Status

Documentation only. This document records the current page script load order contract and the review checklist for future changes.

This document does not change runtime behavior.

Out of scope:

```text
- pages/*.html edits
- js/*.js edits
- CSS edits
- Auth/Login behavior changes
- package.json creation
- bundler or build-step introduction
```

---

## Baseline architecture

LoveBud currently uses a bundler-free static multipage structure.

The browser loads each page directly from `pages/*.html` or the root entry pages. Those HTML files include scripts with classic `<script src="..."></script>` tags rather than an ES module graph or a bundler-generated dependency graph.

Because of that structure, script tag order is a runtime contract.

A script may:

```text
- define a browser global on window
- read a browser global that was defined by an earlier script
- register callbacks for a later script
- bind DOM events after earlier page markup exists
- assume Firebase, i18n, shared header, auth cache, or auth session helpers already exist
```

Changing script order is therefore not just formatting. It can change which provider is selected, whether a fallback path runs, or whether the same login form is bound more than once.

---

## General rule

For `pages/*.html`, do not reorder scripts unless the PR explicitly proves the affected dependency chain.

A safe script-order change must identify:

```text
1. what global each moved script creates
2. what globals it reads
3. whether it binds DOM events
4. whether it changes auth/session/cache state
5. whether an older fallback path becomes active by accident
6. whether a page controller can now run before its dependencies exist
```

---

## Auth/Login load order contract

Auth/Login is the highest-risk script-order area because it combines Firebase SDK loading, browser-global auth modules, login-page controllers, redirect handling, session cache, and UI binding.

The high-level dependency order is:

```text
1. Firebase SDK
2. firebase-config
3. i18n scripts
4. shared-header
5. auth-state
6. auth-callbacks
7. auth-cache
8. auth-ui
9. auth-session
10. auth-firebase
11. login page controller family
12. auth.js
13. final page-specific controller scripts
```

### 1. Firebase SDK

Firebase SDK scripts must load before any LoveBud code that calls `firebase`, `firebase.auth`, or `initFirebase`.

Typical order:

```html
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
```

### 2. firebase-config

`js/firebase-config.js` must load after the Firebase SDK and before auth runtime modules that initialize Firebase.

Expected role:

```text
- define Firebase client config helpers
- expose initFirebase behavior used by Auth/Login runtime
```

### 3. i18n scripts

The i18n scripts must load before page controllers that call `applyI18n`, `onLangChange`, or language-specific UI synchronization.

Expected role:

```text
- register translation dictionaries
- expose language helpers
- provide applyI18n for page and header controllers
```

### 4. shared-header

`js/shared-header.js` should load before page-specific controllers that call `renderSharedHeader`.

Expected role:

```text
- define shared header rendering helpers
- provide header containers that Auth UI may later fill or update
```

### 5. Auth submodules

The auth submodules are browser-global support modules. They should load before the broad auth entrypoint `js/auth.js`.

Expected order:

```html
<script src="../js/auth/auth-state.js"></script>
<script src="../js/auth/auth-callbacks.js"></script>
<script src="../js/auth/auth-cache.js"></script>
<script src="../js/auth/auth-ui.js"></script>
<script src="../js/auth/auth-session.js"></script>
<script src="../js/auth/auth-firebase.js"></script>
```

Dependency purpose:

| Script | Runtime role |
| --- | --- |
| `auth-state.js` | shared flags, cache keys, login page detection, email auth mode helpers |
| `auth-callbacks.js` | auth-ready callback registration and callback firing helpers |
| `auth-cache.js` | confirmed user cache, token cache, stale Firebase state clearing helpers |
| `auth-ui.js` | login button, dropdown, loading/ready nav UI, auth UI rendering helpers |
| `auth-session.js` | redirect target and post-login preload/session helpers |
| `auth-firebase.js` | Firebase-specific adapter, sign-in/sign-out, auth observer, offline fallback |

### 6. Login page controller family

Login page controller scripts must be loaded before `js/auth.js` if `auth.js` is expected to discover or delegate to them at startup.

Current controller-family order should preserve this shape:

```html
<script src="../js/login/login-dom.js"></script>
<script src="../js/login/login-page.js"></script>
<script src="../js/auth/auth-login-page.js"></script>
```

Expected globals:

| Script | Expected global |
| --- | --- |
| `js/login/login-dom.js` | `window.LoveBudLoginDom` |
| `js/login/login-page.js` | `window.LoveBudLoginPageController` |
| `js/auth/auth-login-page.js` | `window.LoveBudAuthLoginPage` |

`js/login/login-page.js` may use `window.LoveBudLoginDom` when available. Therefore, `login-dom.js` should stay before `login-page.js`.

### 7. auth.js

`js/auth.js` is the broad legacy/global auth entrypoint. It reads previously loaded auth module globals and chooses/delegates login-page behavior through the available login provider boundary.

Because `auth.js` makes provider-selection and bootstrap decisions, it should not run before the intended provider globals exist.

High-risk globals:

```text
window.LoveBudLoginPageController
window.LoveBudAuthLoginPage
window.LoveBudAuthFirebase
window.LoveBudAuthState
window.LoveBudAuthCallbacks
window.LoveBudAuthCache
window.LoveBudAuthUI
window.LoveBudAuthSession
```

### 8. Page-specific controller scripts

Final page-specific controller scripts, such as the login page shell controller, may assume that i18n, shared header, and auth globals already exist.

For the login page, this final layer includes behavior such as:

```text
- render shared header on DOMContentLoaded
- apply i18n after header/page elements are available
- synchronize language UI
- prepare inline error display hooks
```

---

## PR #211 active provider transition risk

PR #211 is an active provider transition area for Auth/Login. It is especially sensitive to script order.

The risk centers on three runtime boundaries:

```text
window.LoveBudLoginPageController
window.LoveBudAuthLoginPage
js/auth.js provider selection
```

The intended transition must not accidentally occur through script reordering alone.

Risk examples:

```text
- auth.js runs before the intended provider global exists
- the legacy provider remains active because the new controller was loaded too late
- the new controller becomes active before contract coverage expects it
- both old and new providers bind the same submit or click handler
- redirect query handling changes because setup ownership changed
- invalid credential UI changes because a different provider path handled the error
- Google login and email login stop sharing the same session/cache semantics
```

For active provider transition work, script order must be reviewed together with the Auth/Login transition plan and fixed-slot browser verification requirements.

---

## Contributor checklist before changing script order

Before changing any `pages/*.html` script order, answer all of the following:

```text
- Is this PR explicitly allowed to edit HTML?
- Is this PR explicitly allowed to edit Auth/Login runtime behavior?
- Which script tags are moving?
- Which window globals do those scripts create?
- Which window globals do those scripts consume?
- Does any moved script bind DOM events?
- Does any moved script initialize Firebase, auth state, cache, session, redirect, or header UI?
- Could the move activate a fallback path that was previously inactive?
- Could the move bind the same form/button more than once?
- Does the affected page still load i18n before applyI18n/onLangChange users?
- Does the affected page still load shared-header before renderSharedHeader users?
```

For Auth/Login pages, also confirm:

```text
- Firebase SDK loads before firebase-config.
- firebase-config loads before auth-firebase/auth.js initialization.
- auth-state loads before auth modules that read flags/cache keys/page mode helpers.
- auth-callbacks loads before auth.js callback registration delegation.
- auth-cache loads before auth-firebase/auth.js cache/session logic.
- auth-ui loads before auth.js nav/dropdown rendering delegation.
- auth-session loads before redirect/preload behavior is used.
- auth-firebase loads before auth.js delegates Firebase runtime behavior.
- login-dom loads before login-page controller code that may read LoveBudLoginDom.
- LoveBudLoginPageController and/or LoveBudAuthLoginPage load before auth.js provider selection.
- The expected active provider matches the current PR phase.
```

---

## Verification expectations

For this documentation PR:

```text
- changed files must be docs only
- new document link must be reachable from the engineering docs index
- no runtime test is required because runtime files are not changed
```

For a future implementation PR that changes page script order:

```text
- run syntax checks for changed JS files
- run relevant contract tests
- perform browser smoke on the affected page
- for Auth/Login, use the required fixed test slot flow before declaring runtime PASS
```

Auth/Login smoke should include at minimum:

```text
- login page loads without fatal console error
- Google login button still binds exactly once
- email modal opens and closes
- login/signup toggle does not double-bind
- invalid credential path is visible and stable
- valid login persists session/cache as expected
- explicit redirect query still controls post-login redirect
- logout returns the user to non-auth state
```

---

## Bundler note

A bundler, module loader, or ES module conversion may eventually reduce this class of risk, but that is not part of this document or this PR.

Until a separate architecture PR explicitly introduces and verifies such a change, `pages/*.html` script order remains the runtime dependency contract.

---

## Related documents

- [AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md](./AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md)
- [SEARCH_RUNTIME_CONTRACT.md](./SEARCH_RUNTIME_CONTRACT.md)
- [CODE_ARCHITECTURE.md](./CODE_ARCHITECTURE.md)
- [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md)
