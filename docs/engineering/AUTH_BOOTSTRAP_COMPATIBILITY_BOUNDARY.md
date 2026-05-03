# Auth Bootstrap Compatibility Boundary

**Status:** Active staged-refactor boundary  
**Owner:** CTO / Engineering Lead  
**Related issue:** #705  
**Source tracker:** #78

This document defines the compatibility boundary that must be preserved while `js/auth.js` is reduced toward a thinner bootstrap/orchestration file.

The first Auth refactor steps must be behavior-equivalent. They must not change Firebase provider behavior, login/signup semantics, protected-route behavior, API token handling, cache key names, or user-facing Auth UI. The goal is to make the large Auth entrypoint easier to review without changing the runtime contract.

---

## 1. Current boundary summary

`js/auth.js` currently behaves as the browser-global Auth entrypoint. It coordinates modules under `js/auth/` while preserving legacy global exports expected by pages and older runtime code.

Current main already has several helper modules loaded before `js/auth.js`, including:

- `js/auth/auth-state.js`
- `js/auth/auth-callbacks.js`
- `js/auth/auth-cache.js`
- `js/auth/auth-ui.js`
- `js/auth/auth-session.js`
- `js/auth/auth-firebase.js`
- `js/auth/auth-login-page.js`

The entrypoint should continue to be a classic script. Do not convert it or any Auth helper to ES modules unless a separate architecture decision explicitly approves that loading model change.

---

## 2. Globals that must remain stable

The first staged extraction must preserve these public browser globals:

```text
window.signInWithGoogle
window.signOut
window.initAuth
window.getEnvironmentCheckError
window.getFriendlyErrorMessage
window.getConfirmedAuthUser
window.hasConfirmedAuthSession
window.getCachedAuthToken
window.registerOnAuthReady
window.getBasePath
```

The following shared runtime flags and callback containers must remain compatible:

```text
window.__onAuthReadyCallbacks
window.__lastAuthUser
window.__lovebudAuthInitialized
window.__lovebudAuthReady
window.LoveBudAuthBootstrap
```

If a future PR believes any global can be removed, that PR must first add an audit proving it is unused across all active pages and tests. Do not remove globals opportunistically during a file-size refactor.

---

## 3. Cache and token key contract

These key names are part of the Auth compatibility boundary and must not change in the first refactor PR:

```text
lovebud_auth_cache
lovebud_auth_confirmed
lovebud_auth_token
```

Logout and invalid-session cleanup must keep clearing confirmed private Auth state. Public Browse cache handling must remain separate from private Auth/My Trees/Editor caches.

Do not alter token lifetime, token refresh behavior, confirmed-session semantics, or localStorage/sessionStorage key names as part of the first split.

---

## 4. Allowed first extraction candidates

A narrow implementation PR may move one of these responsibilities out of `js/auth.js` when the helper already exists or can be added as a browser-global helper:

1. Bootstrap compatibility resolver wiring.
2. Auth ready callback registration/fire bridge.
3. Confirmed Auth cache wrapper functions.
4. Protected-route bridge construction arguments.
5. Legacy alias/global export setup.

The recommended first code PR is the smallest extraction that removes responsibility from `js/auth.js` without altering behavior. Avoid mixing multiple areas in one PR unless the same helper boundary requires them to move together.

---

## 5. Forbidden combinations

Do not combine Auth bootstrap refactor work with:

- login page copy or layout changes;
- signup policy changes;
- Firebase provider changes;
- password policy changes;
- token/cache security behavior changes;
- protected-route policy changes;
- API endpoint or payload changes;
- Browse/Search, Editor, My Trees, or Detail UI changes;
- package, workflow, or dependency changes;
- PR #7 or prototype/reference/demo/variant path changes.

A refactor PR must be behavior-equivalent and narrow enough to review by changed responsibility boundary.

---

## 6. Script order contract

Pages that use Auth must continue loading helper modules before `js/auth.js`. The Auth entrypoint may depend on existing helper globals but must keep fallback behavior where active runtime still requires it.

Minimum order expectation:

```text
firebase SDK / firebase-config
shared i18n and shared header dependencies as needed
js/auth/auth-state.js
js/auth/auth-callbacks.js
js/auth/auth-cache.js
js/auth/auth-ui.js
js/auth/auth-session.js
js/auth/auth-firebase.js
login helper modules where login page requires them
js/auth/auth-login-page.js where login page requires it
js/auth.js
page-specific login/auth script where present
```

Any script order change requires a focused contract test or manual page inventory explaining why the order remains safe.

---

## 7. Required verification per implementation PR

Static verification:

```text
git diff --check
node --check changed JS files
npm test
npm run verify
```

Auth/browser verification for runtime-sensitive PRs:

```text
Login page opens in login mode: PASS/FAIL
Login page opens in signup mode: PASS/FAIL
Google login button remains wired: PASS/FAIL
Email login/signup flow remains wired: PASS/FAIL
Logged-out protected pages redirect/block as before: PASS/FAIL
Logged-in header/nav auth state renders: PASS/FAIL
Logout clears confirmed auth state and redirects/reloads as before: PASS/FAIL
My Trees protected load after login: PASS/FAIL
Editor protected load after login: PASS/FAIL
Console fatal errors: NONE/PRESENT
Network fatal errors: NONE/PRESENT
```

Because Auth behavior is runtime-sensitive, final PASS must use Cloudflare Preview or an assigned fixed test slot with deployed SHA confirmation. Local-only checks are not final PASS.

---

## 8. Batch verification handling

Auth refactor PRs may be accumulated as draft PRs under the batch verification policy only when they are independent and do not block other work. However, Auth is high-risk. If a PR changes login/session/protected-route behavior, verify it immediately rather than waiting for the batch.

For draft batch PRs, use this status language:

```text
Status: DRAFT_IMPLEMENTED / AUTH_RUNTIME_VERIFICATION_NOT_STARTED
Static checks: PASS or NOT_RUN
Browser verification: NOT_STARTED
Merge candidate: NO
```

---

## 9. First implementation recommendation

The safest next code PR after this boundary note is one of:

1. Move legacy Auth global export setup into a focused helper while preserving all exported names.
2. Move protected-route bridge argument construction into a focused helper without changing any callback function references.
3. Move callback bridge fallback wiring into `auth-callbacks.js` while preserving `window.registerOnAuthReady` behavior.

Do not start with Firebase sign-in/sign-out behavior or token/cache semantics. Those are higher-risk and require immediate fixed-slot Auth verification.

---

## 10. Completion criteria for #705

Issue #705 can move toward completion only after one or more narrow PRs:

- reduce `js/auth.js` responsibility;
- preserve the listed global contracts;
- preserve cache key and token behavior;
- pass static checks;
- pass fixed-slot or Cloudflare runtime Auth verification;
- document remaining Auth cleanup as follow-up rather than hiding it in one broad PR.
