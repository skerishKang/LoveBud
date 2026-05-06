# Auth / Editor Runtime Inventory — Issue #834

**Generated:** 2026-05-06
**Branch:** `audit/auth-editor-runtime-inventory-834`
**Scope:** `auth`, `editor` runtime structure — inventory, dependency mapping, naming audit

> This audit is **read-only**. No runtime code, CSS, HTML, import/script order, or behavior was modified.

---

## 1. Runtime Inventory Table

### 1.1 JS: Auth Module

| File | Lines | Window Export | Role | Loaded from |
|---|---|---|---|---|
| `js/auth.js` | 1386 | `window.signInWithGoogle`, `window.signOut`, `window.initAuth`, `window.getEnvironmentCheckError`, `window.getFriendlyErrorMessage`, `window.registerOnAuthReady`, `window.LoveBudAuthBootstrap` | Auth orchestrator + fallback container | All pages via `login.html`, `editor.html`, etc. |
| `js/auth/auth-state.js` | 67 | `window.LoveBudAuthState` | Shared constants + lightweight state | Both `login.html` and `editor.html` |
| `js/auth/auth-callbacks.js` | — | `window.LoveBudAuthCallbacks` | Callback registration (`registerOnAuthReady`) | Both |
| `js/auth/auth-cache.js` | — | `window.LoveBudAuthCache` | Auth cache operations (get/clear/validate) | Both |
| `js/auth/auth-ui.js` | 283 | `window.LoveBudAuthUI` | UI builders (`buildUserDropdown`, `buildLoginButton`, `attachDropdownListener`, `markAuthReady`) | Both |
| `js/auth/auth-session.js` | 88 | `window.LoveBudAuthSession` | Redirect target + session preload | Both |
| `js/auth/auth-firebase.js` | 395 | `window.LoveBudAuthFirebase` | Firebase auth integration (`initAuth`, `signInWithGoogle`, `signOut`) | Both |
| `js/auth/auth-login-page.js` | 374 | `window.LoveBudAuthLoginPage` | Login-page specific UI setup (modals, forms, toggles) | `login.html` only |

### 1.2 JS: Editor Module

| File | Lines | Window Export | Role | Loaded from |
|---|---|---|---|---|
| `js/editor.js` | 779 | `window.updateDetailPanel`, `window.refreshMemories` | Editor orchestrator + inline fallback container | `editor.html` |
| `js/editor/editor-dom-selectors.js` | — | `window.LoveBudEditorDom` | DOM element cache | `editor.html` |
| `js/editor/editor-root-helpers.js` | 116 | `window.LoveBudEditorUtils` | Root memory identification | `editor.html` |
| `js/editor/editor-canvas-layout.js` | — | (via `window.createEditorCanvas`) | Tree layout algorithm | `editor.html` |
| `js/editor/editor-canvas-node.js` | — | (via `createEditorCanvas`) | SVG node rendering | `editor.html` |
| `js/editor/editor-canvas-interaction.js` | — | (via `createEditorCanvas`) | Canvas interaction (click, drag) | `editor.html` |
| `js/editor/editor-canvas-viewport.js` | — | (via `createEditorCanvas`) | Viewport/zoom management | `editor.html` |
| `js/editor/editor-canvas.js` | — | `window.createEditorCanvas` | Canvas factory | `editor.html` |
| `js/editor/editor-rename-ui.js` | — | (via `createEditorDetailUI`) | Tree rename interface | `editor.html` |
| `js/editor/editor-detail-ui.js` | — | `window.createEditorDetailUI` | Detail panel factory | `editor.html` |
| `js/editor/editor-memory-actions.js` | — | `window.createEditorMemoryActions` | Memory CRUD operations | `editor.html` |
| `js/editor/editor-memory-form.js` | — | `window.createEditorMemoryForm` | Memory form factory | `editor.html` |
| `js/editor/editor-helpers.js` | 188 | `window.LoveBudEditorHelpers` | i18n helpers, `escapeHtml`, `safeUrl`, YouTube utils | `editor.html` |
| `js/editor/editor-save-status.js` | — | `window.LoveBudEditorSaveStatus` | Save status indicator state | `editor.html` |
| `js/editor/editor-page-helpers.js` | — | `window.LoveBudEditorPageHelpers` | Page routing, auth redirect | `editor.html` |
| `js/editor/editor-tree-helpers.js` | — | `window.LoveBudEditorTreeHelpers` | Tree creation, initial memory | `editor.html` |
| `js/editor/editor-bindings.js` | — | `window.LoveBudEditorBindings` | Event binding layer | `editor.html` |
| `js/editor/editor-auth-helpers.js` | 46 | `window.LoveBudEditorAuthHelpers` | Auth session check for editor gate | `editor.html` |
| `js/editor/editor-data-loader.js` | — | `window.LoveBudEditorDataLoader` | Tree + memory data operations | `editor.html` |
| `js/editor/editor-data-loader-fallbacks.js` | — | `window.LoveBudEditorDataLoaderFallbacks` | Data loader inline fallbacks | `editor.html` |
| `js/editor/editor-entry-fallbacks.js` | — | `window.LoveBudEditorResolverFallbacks` | Entry helper inline fallbacks | `editor.html` |
| `js/editor/editor-shell-helpers.js` | 93 | `window.LoveBudEditorShellHelpers` | Shell copy (i18n text application), `showToast` fallback | `editor.html` |
| `js/editor/editor-i18n-refresh.js` | — | — | i18n re-application after lang change | `editor.html` |

### 1.3 JS: Login Module (non-auth prefix)

| File | Lines | Window Export | Role |
|---|---|---|---|
| `js/login/login-dom.js` | — | `window.LoveBudLoginDom` | DOM element selectors for login page |
| `js/login/login-page.js` | 252 | `window.LoveBudLoginPageController` | Login page UI controller |

### 1.4 External / Shared Dependencies

| File | Window Export | Used By |
|---|---|---|
| `js/cache-utils.js` | `window.LoveBudCache` | Editor (tree/memories caching) |
| `js/utils/normalize.js` | `window.LoveBudNormalize` | Editor (memory normalization) |
| `js/utils/path.js` | — | Editor (path helpers) |
| `js/utils/ui.js` | `window.LoveBudUI` | Editor (showToast) |
| `js/utils/media.js` | `window.LoveBudMedia` | Editor (YouTube ID extraction, thumbnail) |
| `js/api/auth-policy.js` | — | Editor (API auth policy) |
| `js/api/base-api-fetch.js` | — | Editor (API fetch) |
| `js/postgres-client.js` | `window.apiClient` | Auth (preload), Editor (data ops) |
| `js/firebase-config.js` | `window.initFirebase` | Auth (Firebase SDK init) |
| `js/i18n.js` | `window.applyI18n`, `window.t`, `window.getCurrentLang`, `window.setCurrentLang` | Auth (syncEmailAuthModeUi), Editor (all text) |
| `js/shared-header.js` | `window.renderSharedHeader` | Both (shared header injection) |
| `js/page-transitions.js` | — | Both (page transition effects) |

### 1.5 CSS Inventory

| File | Role | Import Method |
|---|---|---|
| `css/editor.css` | Editor entrypoint | Single `<link>` in `editor.html`, imports 13 partials via `@import` |
| `css/editor/base.css` | Code style fix + shared base | `@import` from `editor.css` |
| `css/editor/layout.css` | Grid/flex layout | `@import` |
| `css/editor/sidebar.css` | Left sidebar | `@import` |
| `css/editor/canvas.css` | SVG canvas | `@import` |
| `css/editor/canvas-toolbar.css` | Canvas topbar tools | `@import` |
| `css/editor/memory-form.css` | Memory creation form | `@import` |
| `css/editor/detail-panel.css` | Right detail panel | `@import` |
| `css/editor/responsive.css` | Responsive breakpoints | `@import` |
| `css/editor/mode-selection.css` | Link/text mode toggle | `@import` |
| `css/editor/status-settings.css` | Tree status/settings UI | `@import` |
| `css/editor/memory-edit.css` | Memory edit mode | `@import` |
| `css/editor/overrides.css` | Last-in-cascade overrides | `@import` |
| `css/editor/responsive-tail.css` | Final responsive overrides | `@import` |
| `css/login.css` | Login page styling | Single `<link>` in `login.html` (no partials) |
| `css/global.css` | Shared shell + tokens | Both pages |

### 1.6 HTML Entrypoints

| Page | Key CSS | JS Load Order (abbreviated) |
|---|---|---|
| `pages/login.html` | `global.css`, `login.css` | Firebase SDK → firebase-config.js → i18n/* → shared-header.js → auth/auth-*.js → login/*.js → auth.js → login-page.js |
| `pages/editor.html` | `global.css`, `editor.css` | utils/* → editor/editor-dom-selectors.js through editor-shell-helpers.js → api/* → postgres-client.js → editor.js → editor-i18n-refresh.js → Firebase SDK → firebase-config.js → i18n/* → shared-header.js → auth/auth-*.js → auth.js |
| `pages/my-trees.html` | `my-trees.css` | (not in scope; loads auth similarly) |
| `pages/detail.html` | `detail.css` | (not in scope) |
| `pages/settings.html` | `settings.css` | (not in scope) |

---

## 2. Entrypoint → Dependency Mapping

### 2.1 Auth Dependency Graph

```
auth.js (orchestrator)
├── LoveBudAuthState → auth-state.js
├── LoveBudAuthUI → auth-ui.js
├── LoveBudAuthSession → auth-session.js
├── LoveBudAuthFirebase → auth-firebase.js
├── LoveBudAuthCallbacks → auth-callbacks.js
├── LoveBudAuthCache → auth-cache.js
├── LoveBudAuthLoginPage → auth-login-page.js
│   ├── LoveBudLoginPageController → js/login/login-page.js (fallback)
│   │   └── LoveBudLoginDom → js/login/login-dom.js
│   └── (inline fallback if not loaded)
├── window.apiClient → postgres-client.js (preloadRedirectTargetData)
├── window.applyI18n → i18n.js
├── window.initFirebase → firebase-config.js
├── window.renderSharedHeader → shared-header.js
├── firebase SDK (external, CDN)
└── (inline fallbacks for ALL submodules when not loaded)
```

### 2.2 Editor Dependency Graph

```
editor.js (orchestrator)
├── LoveBudEditorUtils → editor-root-helpers.js
├── LoveBudEditorHelpers → editor-helpers.js
├── LoveBudEditorShellHelpers → editor-shell-helpers.js
├── LoveBudEditorSaveStatus → editor-save-status.js
├── LoveBudEditorPageHelpers → editor-page-helpers.js
├── LoveBudEditorTreeHelpers → editor-tree-helpers.js
├── LoveBudEditorBindings → editor-bindings.js
├── LoveBudEditorDataLoader → editor-data-loader.js
├── LoveBudEditorAuthHelpers → editor-auth-helpers.js
│   └── window.getConfirmedAuthUser → auth.js
├── LoveBudEditorDataLoaderFallbacks → editor-data-loader-fallbacks.js
├── LoveBudEditorResolverFallbacks → editor-entry-fallbacks.js
├── createEditorCanvas → editor-canvas.js
│   ├── editor-canvas-layout.js
│   ├── editor-canvas-node.js
│   ├── editor-canvas-interaction.js
│   └── editor-canvas-viewport.js
├── createEditorDetailUI → editor-detail-ui.js
│   └── editor-rename-ui.js
├── createEditorMemoryActions → editor-memory-actions.js
├── createEditorMemoryForm → editor-memory-form.js
├── LoveBudEditorDom → editor-dom-selectors.js
├── LoveBudCache → cache-utils.js
├── LoveBudNormalize → utils/normalize.js
├── LoveBudUI → utils/ui.js
├── LoveBudMedia → utils/media.js
├── window.apiClient → postgres-client.js
├── window.applyI18n → i18n.js
├── window.registerOnAuthReady → auth.js
└── (inline fallbacks for ALL submodules when not loaded)
```

### 2.3 Auth → Editor Cross-Dependency

```
editor.js
  └── editor-auth-helpers.js
       └── window.getConfirmedAuthUser → auth.js exports
  └── window.registerOnAuthReady → auth.js exports
  └── window.onAuthReady → (fallback pattern)
  └── redirectToEditorLogin → navigates to login.html with redirect param
```

---

## 3. Folder-Prefix Inconsistency List

### 3.1 Prefix Naming

| Pattern | Files | Issue |
|---|---|---|
| **auth.js (root)** / **auth/*.js** (subdir) | `js/auth.js` + `js/auth/auth-*.js` | Root file has no prefix; subdirectory files use `auth-`. The root file is the entrypoint, subfiles are modules. This is acceptable but inconsistent. |
| **editor.js (root)** / **editor/*.js** (subdir) | `js/editor.js` + `js/editor/editor-*.js` | Same pattern as auth. Root file is entrypoint, subfiles are modules. |
| **editor-root-helpers.js** / **LoveBudEditorUtils** | `window.LoveBudEditorUtils` | Breaks the `LoveBudEditor*` naming convention. Other editor submodules export `LoveBudEditorHelpers`, `LoveBudEditorDom`, etc. This one uses `LoveBudEditorUtils` — note the lowercase `s`. |
| **js/login/** | `js/login/login-page.js`, `js/login/login-dom.js` | Login modules live in `js/login/` but export `LoveBudLogin*`. No `auth-` prefix on the directory, though functionally these are auth-related. |
| **auth-login-page.js** in `js/auth/` | Exports `LoveBudAuthLoginPage` | Overlaps functionally with `js/login/login-page.js` (`LoveBudLoginPageController`). Both implement `syncEmailAuthModeUi`, `setupLoginPageAuthUi`, `setupGoogleBtn`, etc. This is an intentional dual-path architecture (see 4.2). |

### 3.2 Naming Convention Matrix

| Module Group | Directory Prefix | File Name Prefix | Window Export Prefix | Consistent? |
|---|---|---|---|---|
| Auth | `auth/` | `auth-` | `LoveBudAuth` | Yes |
| Editor | `editor/` | `editor-` | `LoveBudEditor` | Yes (except root-helpers: `LoveBudEditorUtils`) |
| Login | `login/` | `login-` | `LoveBudLogin` | Yes |
| Utils | `utils/` | — | `LoveBud*` | Mixed |

### 3.3 CSS: No Auth Subdirectory

- `css/editor/` has 13 partial files with clear role-based naming (`base.css`, `canvas.css`, `layout.css`, etc.)
- No `css/auth/` or `css/login/` subdirectory exists. `login.css` is a single flat file (478 lines).
- **Finding:** CSS structure is editor-modernized but auth is not.

---

## 4. Decomposition Candidate List

### 4.1 Candidates from Auth Module

| ID | Candidate | Current Location | Rationale | Priority |
|---|---|---|---|---|
| D1 | **Auth Gate (route helper)** | `auth.js:initAuth`, `editor-auth-helpers.js` | Route-based redirect logic is scattered. A dedicated `auth-gate.js` could handle protected-route checks and redirect fallbacks. | Medium |
| D2 | **Modal Binding Split** | `auth.js:setupEmailAuthForm`, `auth.js:setupSignupForm`, `auth-login-page.js` | Email auth modal setup (~200 lines) is baked into `auth.js`. Could be a separate `auth-email-modal.js`. | Low |
| D3 | **Session Sync** | `auth-session.js`, `auth.js:preloadRedirectTargetData` | Session-persist + preload logic could be a standalone sync module with a clear state machine. | Medium |
| D4 | **Cache Policy Centralization** | `auth.js` inline, `auth-cache.js`, `auth-state.js` | Cache keys (`lovebud_auth_cache`, `lovebud_auth_confirmed`, `lovebud_auth_token`) are duplicated between auth.js inline fallback and auth-state.js exports. | Medium |

### 4.2 Candidates from Editor Module

| ID | Candidate | Current Location | Rationale | Priority |
|---|---|---|---|---|
| E1 | **Renderer Decomposition** | `editor-canvas.js` → `createEditorCanvas` | Canvas factory bundles layout, node rendering, interaction, and viewport via factory pattern. Already well-modularized but the `createEditorCanvas` function could be broken into smaller factories. | Low |
| E2 | **i18n Refresh** | `editor-i18n-refresh.js`, `editor-shell-helpers.js` | i18n re-apply logic is isolated in one module. This is already decomposed and could be formalized as a reusable `i18n-refresher`. | Low |
| E3 | **Shared State Wrapper** | `window.currentTreeData`, `window.currentTreeMemories` | Editor stores critical state on `window` directly. A `LoveBudEditorState` wrapper would provide controlled access and change notifications. | High |
| E4 | **Inline Fallback Extraction** | `editor.js` (scattered) | ~15 inline fallback functions (~300 lines) are defined inside `editor.js`. These could be extracted to `editor-entry-fallbacks.js` or similar. | High |
| E5 | **Data Loader with Centralized Error Handling** | `editor-data-loader.js`, `editor-data-loader-fallbacks.js` | Error rendering (`renderTreeLoadError`) is a fallback. Could be a full module with standardized error states. | Medium |

### 4.3 Dual-Path Architecture

| ID | Candidate | Current Location | Rationale | Priority |
|---|---|---|---|---|
| DP1 | **Login controller dual path** | `js/auth/auth-login-page.js` AND `js/login/login-page.js` | Both implement `syncEmailAuthModeUi`, `setupLoginPageAuthUi`, `setupGoogleBtn`, etc. `auth.js` tries `LoveBudAuthLoginPage` first, falls back to inline, which falls back to `LoveBudLoginPageController`. This is by design but creates maintenance burden. | Medium |

---

## 5. Risk Level Classification

| Risk | Description | Severity | Files Affected |
|---|---|---|---|
| R-1 | **Inline fallback sprawl** | `editor.js` contains ~15 inline fallback implementations totaling ~300 lines. Every fallback is a maintenance point that must mirror the real implementation. | **High** | `js/editor.js` |
| R-2 | **Circular dependency risk** | `auth.js` exports `getConfirmedAuthUser` → `editor-auth-helpers.js` calls it → `editor.js` calls `registerOnAuthReady`. Both sides reference each other's window exports. | **High** | `js/auth.js`, `js/editor/editor-auth-helpers.js`, `js/editor.js` |
| R-3 | **Global namespace pollution** | ~10+ window-level exports per module. Risk of collision with browser extensions, third-party scripts, or future modules. | **Medium** | All `auth/*.js`, `editor/*.js` |
| R-4 | **Duplicate utility implementations** | `escapeHtml` exists in `auth.js` (inline), `auth-ui.js`, and `editor-helpers.js`. `getBasePath` exists in both `auth.js` and `auth-ui.js`. | **Medium** | Multiple files |
| R-5 | **Implicit dependency on script load order** | `editor.js` `DOMContentLoaded` handler checks for `window.LoveBudEditor*` exports. If submodules fail to load before the DOM event, all functionality degrades to fallbacks. | **High** | `js/editor.js` |
| R-6 | **Dual login controller code** | `auth-login-page.js` and `login-page.js` both implement the same methods. Changes must be applied to both, risking drift. | **Medium** | `js/auth/auth-login-page.js`, `js/login/login-page.js` |
| R-7 | **CSS import cascade** | `editor.css` uses 13 `@import` statements. This blocks parallel download and creates a cascade dependency. | **Low** | `css/editor.css` |
| R-8 | **auth.js fires DOMContentLoaded init itself** | `auth.js:1386` calls `document.addEventListener('DOMContentLoaded', initAuth)` at the end. This fires regardless of page context, triggering login-page-specific UI setup even on editor.html (functions like `setupGoogleBtn` silently fail when buttons don't exist). | **Low** | `js/auth.js` |
| R-9 | **Editor redirect double-check** | `editor.js` checks `getConfirmedSessionUser()` synchronously, then falls back to `registerOnAuthReady(async callback)`. If auth is already in offline/ready mode when the DOM event fires, the sync check works — but if Firebase is still loading, only the async callback path matters. This dual-path is fragile. | **Medium** | `js/editor.js` |

---

## 6. Recommended Split Order

If migration is pursued in future PRs, split in this order to minimize risk:

1. **Extract shared utilities** (`escapeHtml`, `getBasePath`) to `js/utils/dom.js` — eliminates R-4
2. **Extract inline editor fallbacks** from `editor.js` into `editor-entry-fallbacks.js` — addresses R-1
3. **Wrap editor state** (`currentTreeData`, `currentTreeMemories`) in `LoveBudEditorState` — addresses E3, R-3
4. **Centralize editor auth redirect** into a single `editor-auth-gate.js` — addresses R-9, D1
5. **Consolidate login controller paths** — choose `login-page.js` or `auth-login-page.js` as canonical — addresses R-6, DP1
6. **Extract email auth modal** to `auth-email-modal.js` — addresses D2
7. **Centralize cache policy** into a single source of truth — addresses D4

---

## 7. Browser Verification Requirements

When any patch touches `auth` or `editor` runtime files, verify against these scenarios:

| # | Scenario | Context | Check |
|---|---|---|---|
| V1 | Unauthenticated → Editor redirect | Open `editor.html` without login | Redirects to `login.html?redirect=editor.html` |
| V2 | Authenticated → Editor load | Login, then open `editor.html` | Tree loads, canvas renders |
| V3 | Auth dropdown works | Click user avatar after login | Dropdown shows, my-trees/settings/logout functional |
| V4 | Logout clears auth cache | Logout from any page | `lovebud_auth_*` localStorage keys cleared |
| V5 | New memory creation | Click "add memory" in editor | Form appears, memory saves, canvas updates |
| V6 | Memory edit/delete | Select existing memory | Edit mode works, delete removes node |
| V7 | i18n toggle (ko ↔ en) | Switch language | All editor labels + auth dropdown update |
| V8 | Canvas interactions | Click nodes, use recenter | Node selection, focus, recenter all work |
| V9 | Responsive (320px–1440px) | Resize browser | Sidebar collapses, canvas scales, detail panel stacks |
| V10 | Offline / slow network | Throttle network / disconnect | Cached auth UI renders, offline fallback activates |
| V11 | Login with Google | Click Google login button | Popup opens, authentication completes, redirects |
| V12 | Login with Email | Click email login, submit form | Modal opens, authentication completes, redirects |
| V13 | Sign-up with Email | Toggle to signup mode, submit | Account created, redirects to my-trees |
| V14 | Invalid session recovery | Corrupted/expired Firebase session | Detects, logs out, clears caches cleanly |

---

## 8. Migration Non-Goals

The following are **explicitly out of scope** for the audit. Future PRs addressing these areas should have explicit approval:

- ❌ No path rename (e.g., `js/auth/auth-*.js` → `js/auth/*.js`)
- ❌ No runtime split (e.g., extracting `auth-gate.js` as a new file that changes load order)
- ❌ No import/script order change in `login.html` or `editor.html`
- ❌ No `module` type migration (`.mjs`, `type="module"`)
- ❌ No bundler introduction (Webpack, Vite, esbuild)
- ❌ No auth behavior change (login/signup flow, session persistence logic)
- ❌ No editor UX change (canvas interaction, memory form, detail panel)
- ❌ No prototype/reference/demo/variant modification
- ❌ No PR #7 impact

---

## 9. Guardrails

All parties must observe these guardrails during any follow-up work:

1. **No direct modification of `main` branch.** All work in feature branches with PR.
2. **No `ready` / `merge` / `Issue close` keywords** in branch names, commit messages, or PR descriptions.
3. **No `close` keyword** in any commit or PR body.
4. **PR against `main`** with `draft` status until explicitly approved.
5. **Verification must pass** (see Section 7) before any merge is considered.
6. **PR #7 must remain unaffected.** The diff must not touch files that overlap with PR #7's scope.
7. **`.secrets/` and `.ssh-backup/`** must never appear in commits per `.gitignore`.
8. **Line count limit:** Any new source file must stay under 500 lines. If a file approaches 500 lines, refactor before adding more.

---

## 10. PR #7 Non-Impact Statement

This audit document is a read-only inventory. It:

- Creates **no runtime code changes** in `js/`, `css/`, `pages/`
- Modifies **no HTML `script` tags** or CSS `link` tags
- Changes **no import/load order**
- Touches **no files within PR #7's scope** (assuming PR #7 does not overlap with `docs/engineering/`)
- Resides entirely within `docs/engineering/AUTH_EDITOR_RUNTIME_INVENTORY_834.md`

Any future PR that acts on the recommendations in this document must independently verify non-overlap with PR #7.

---

## Appendix: Quick-Reference Table

| Metric | Value |
|---|---|
| Auth JS files (root + subdir) | 8 (`auth.js` + 7 submodules) |
| Editor JS files (root + subdir) | 21 (`editor.js` + 20 submodules) |
| Login JS files | 2 (`login-dom.js`, `login-page.js`) |
| CSS entrypoints | 2 (`editor.css`, `login.css`) |
| CSS partials (editor) | 13 |
| CSS partials (auth/login) | 0 (flat file) |
| Shared utility dependencies | 7+ (`cache-utils`, `normalize`, `path`, `ui`, `media`, `auth-policy`, `base-api-fetch`) |
| Window exports (auth) | ~10 |
| Window exports (editor) | ~15 |
| Inline fallbacks in `editor.js` | ~15 functions (~300 lines) |
| Inline fallbacks in `auth.js` | ~20 functions (~500 lines) |
| Duplicated functions | `escapeHtml` (3 places), `getBasePath` (2 places), `syncEmailAuthModeUi` (2 places) |
| Naming inconsistencies | 4 notable |
| Decomposition candidates | 8 |
| Risk items | 9 |
