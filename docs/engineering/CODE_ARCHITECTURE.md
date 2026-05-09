# Code Architecture

This document defines LoveBud's default code architecture policy for new work and safe refactoring.

LoveBud still contains HTML script loading and browser-global module patterns. Do not assume that ES module `import/export` or `type="module"` conversion is safe by default.

---

## 1. Module Size and Thin Entrypoint Policy

New files should stay small, focused, and reviewable.

Guidelines:

- Keep new files at or below 500 lines whenever practical.
- If a feature is likely to exceed 500 lines, split it during the design phase.
- Do not wait until a file becomes a large monolith before extracting helpers.
- Entry files should remain thin entrypoints or orchestration layers.
- Actual logic should live in feature-specific helper/module files.
- Do not accumulate UI, API, state, cache, validation, rendering, auth, fallback, and compatibility responsibilities in one file.

Standard policy wording:

> Do not grow a single file into a large fallback bundle. Keep entrypoint files thin: orchestration only. Move reusable logic into focused helper modules. Preserve the current project loading model; do not convert to `type="module"` unless the task explicitly authorizes it.

---

## 2. Modularization and Separation of Concerns

Separation of concerns is the default design principle.

A file should have one clear primary responsibility. Avoid mixing these responsibilities in one file:

- UI rendering
- API transport
- normalization
- state management
- cache/session handling
- validation
- auth/bootstrap logic
- fallback compatibility
- DOM event delegation
- route/runtime orchestration

Reusable logic should move into focused helper modules.

Current repository examples:

- `js/auth/auth-ui.js` owns auth UI builders and dropdown behavior.
- `js/auth/auth-session.js` owns auth session helpers.
- `js/auth/auth-cache.js` owns auth cache helpers.
- `js/auth/auth-firebase.js` owns Firebase auth integration and protected-route fallback behavior.
- `js/api/public-tree-adapter.js` owns public tree/memory adapter and compatibility normalization for browse paths.

Illustrative example only:

```text
Preferred split for a growing feature:
- feature-state.js
- feature-api.js
- feature-renderer.js
- feature-validation.js
- feature-entry.js as orchestration only

Avoid:
- one file that handles API calls, rendering, state, validation, fallback, auth, and UI events together
```

---

## 3. Browser-Global Module Split Policy

LoveBud currently uses HTML script loading and browser-global module patterns in several areas.

Therefore, modularization does not automatically mean ES module conversion.

Default split approach:

- keep the existing HTML script loading model;
- split code into focused files that attach explicit browser globals where needed;
- preserve script order;
- preserve existing public global APIs;
- preserve auth bootstrap behavior;
- preserve shared-header initialization behavior;
- preserve Firebase initialization behavior.

Do not convert scripts to ES modules unless the task explicitly authorizes it.

Prohibited unless explicitly approved:

```html
<script type="module" src="..."></script>
```

```js
import { something } from './module.js';
export function something() {}
```

Reason:

`type="module"` changes script execution timing, scope, loading order, and global availability. In LoveBud this can affect:

- script order;
- global API availability;
- auth bootstrap;
- shared-header rendering;
- Firebase initialization;
- fallback compatibility paths.

---

## 4. Entrypoint and Shell Policy

Root files and page entry files should not become large fallback bundles.

Preferred roles:

| File type | Preferred role |
|-----------|----------------|
| page entry script | orchestration shell |
| root compatibility file | compatibility shell |
| feature helper file | focused logic owner |
| renderer file | DOM rendering only |
| API file | API transport / response handling only |
| state file | state transitions only |
| validation file | validation only |

A root file may coordinate modules, preserve compatibility globals, or expose a stable facade. It should not accumulate all feature logic.

Current repository example:

- `js/auth.js` should be managed as a compatibility/orchestration shell.
- `js/auth/auth-ui.js`, `js/auth/auth-session.js`, `js/auth/auth-cache.js`, and `js/auth/auth-firebase.js` should continue to own focused auth responsibilities.

Avoid growing root files into large fallback bundles that contain UI, auth, state, cache, rendering, route guard, Firebase bootstrap, and compatibility logic together.

---

## 5. Large File Refactor Safety Sequence

Do not turn a large existing file into a thin shell in one broad PR.

Use a staged safety sequence:

1. Add or identify contract tests, route tests, or runtime tests.
2. Extract focused helper modules without changing behavior.
3. Sync page script order or loading order.
4. Keep compatibility globals stable.
5. Verify browser/runtime behavior.
6. Shrink fallback/root shell only after helper behavior is proven.
7. Remove obsolete fallback logic in a separate PR when safe.

Recommended sequence:

```text
contract test
→ helper extraction
→ page/script order sync
→ browser/runtime verification
→ fallback shrink
```

Do not combine broad extraction, behavior changes, module-system conversion, and UI polish in one PR.

---

## 6. Area-Specific Notes

### Auth

Auth code is especially sensitive.

Auth changes can affect:

- Firebase initialization;
- session/cache handling;
- protected route behavior;
- shared header auth state;
- dropdown UI;
- login/logout behavior;
- fallback compatibility.

New auth work should start with thin entrypoints and focused helpers. Do not grow `js/auth.js` into a large fallback bundle.

### Search / Browse

Search/Browse code should keep separate:

- API fetching;
- adapter/normalization;
- rendering;
- preview hydration;
- state;
- filters;
- UI events.

Do not mix display filters and publication/write guards.

### Editor

Editor code should keep separate:

- rendering;
- state;
- persistence;
- validation;
- autosave/cache;
- UI events;
- API calls.

### Modal / API

Modal/API refactors should keep route behavior, response shape, auth, entitlement, SQL conditions, and runtime environment behavior stable unless the task explicitly authorizes changes.

---

## 7. Review Checklist

For new code or refactor PRs, check:

- Is any new file likely to exceed 500 lines?
- If yes, was it split during design rather than after becoming a monolith?
- Is the entry file thin?
- Are reusable helpers in focused modules?
- Are unrelated responsibilities mixed in one file?
- Does the PR preserve the current loading model?
- Does the PR avoid unauthorized `type="module"` conversion?
- Does the PR avoid broad fallback bundle growth?
- If refactoring a large file, are contract tests, route tests, or runtime tests in place first?
- Are script order and browser globals preserved?

---

## 8. Non-Goals

This policy does not require:

- immediate refactoring of all existing large files;
- converting the project to a bundler;
- converting scripts to ES modules;
- deleting compatibility shells;
- shrinking fallback files without tests;
- splitting files mechanically just to reduce line count.

The goal is to prevent new large monoliths and to make future refactors safe, staged, and reviewable.
