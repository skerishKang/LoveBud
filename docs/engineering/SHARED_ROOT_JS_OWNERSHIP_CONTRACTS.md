# Shared Root JS Ownership Contracts

> Status: documentation only
> Related: #411, #72
> Runtime impact: none
> Builds on: [SHARED_ROOT_JS_AUDIT.md](./SHARED_ROOT_JS_AUDIT.md)

## 1. Purpose

Issue #411 tracks the contract follow-up after the Issue #72 shared root JS audit. This document records the current ownership, namespace, compatibility alias, and page loading-order boundaries for the remaining shared root JavaScript files before any relocation, wrapper extraction, or ES module conversion work.

This document is not implementation approval. It does not authorize JavaScript edits, HTML script-order edits, file moves, file renames, Auth behavior changes, Firebase config changes, or shared header behavior changes.

## 2. Scope

In scope:

- `js/auth.js`
- `js/i18n.js`
- `js/firebase-config.js`
- `js/page-shell.js`
- `js/shared-header.js`
- global namespace contracts
- compatibility aliases
- page script loading order
- shared vs page-specific JS boundary recommendations

Out of scope:

- implementation
- file moves
- page markup changes
- script reorder changes
- Auth behavior changes
- Firebase config value changes
- header behavior changes
- ES module conversion
- PR #7/prototype/reference/demo/variant changes

## 3. Current shared root ownership map

| File | Owner axis | Primary role | Dependency boundary | Current recommendation |
| --- | --- | --- | --- | --- |
| `js/auth.js` | Auth runtime / compatibility entrypoint | Broad legacy/global auth entrypoint that delegates to auth submodules and login-page providers when available. | Must load after Firebase SDK, `firebase-config`, i18n, `shared-header`, auth submodules, and intended login provider globals. | Keep shared. Do not shrink, split, or reorder without Auth-specific tracking and fixed-slot verification. |
| `js/i18n.js` | i18n compatibility shim | Compatibility shim that verifies the i18n core stack is already loaded. It intentionally does not auto-load i18n modules. | Must load after `js/i18n/i18n-core.js` and related dictionary scripts, and before dependent page code that assumes the shim check has run. | Keep as thin shared shim. Future migration should document module ownership before removing the shim. |
| `js/firebase-config.js` | Firebase client initialization contract | Single browser-visible Firebase config/init boundary. Provides idempotent Firebase initialization behavior after Firebase SDK scripts are loaded. | Must load after Firebase SDK and before auth Firebase runtime modules or `auth.js` initialization. | Keep shared. Value migration or provider migration belongs to Firebase/Auth-specific tracking only. |
| `js/page-shell.js` | Shared page initialization orchestrator | Coordinates optional `renderSharedHeader()`, `applyI18n()`, and page-specific `afterInit()` hooks. | Depends on `shared-header.js` and i18n globals only when the corresponding options are enabled. | Keep shared thin orchestrator. Do not add header markup ownership or page business logic. |
| `js/shared-header.js` | Header markup and header-specific behavior | Owns shared header markup, active nav state, path context, language toggle, mobile nav, settings return-link capture, and auth container creation. | May call `window.initAuth()` after rendering because the dynamic auth container may not exist before header render. | Keep shared. Helper extraction is separate and must follow shared-header-specific guardrails. |

## 4. Global namespace and compatibility alias inventory

### `js/auth.js`

Observed namespace contract:

| Symbol / global | Direction | Ownership note |
| --- | --- | --- |
| `window.LoveBudAuthBootstrap` | defines if absent | Auth bootstrap readiness object with `resolve`, `whenReady`, snapshot, and resolved-user accessors. |
| `window.__onAuthReadyCallbacks` | defines if absent | Legacy callback array used when auth callback module delegation is unavailable. |
| `window.registerOnAuthReady` | defines | Public callback registration API for consumers that need auth-ready notification. |
| `window.getBasePath` | defines | Legacy helper used by auth UI link generation. |
| `window.initAuth` | defines later in the file | Broad auth initialization entrypoint and shared-header rebind target. |
| `window.signOut` | defines later in the file | Legacy/public logout action expected by older consumers. |
| `window.signInWithGoogle` | defines later in the file | Legacy/public Google sign-in action expected by older consumers. |
| `window.getConfirmedAuthUser` | defines later in the file | Shared-header may use this when available for confirmed-session rendering. |
| `window.__lovebudAuthInitialized` | reads/writes through auth-state flag | Auth initialization guard. |
| `window.__lovebudAuthReady` | reads/writes through auth-state flag | Auth readiness flag. |
| `window.__lastAuthUser` | reads/writes | Last known user snapshot for callback replay. |
| `window.__initialAuthMode` | reads | Login/signup mode seed used as a fallback when auth-state module is unavailable. |
| `window.LoveBudAuthState` | reads optional module | Auth state constants and helpers. |
| `window.LoveBudAuthCallbacks` | reads optional module | Auth-ready callback delegation. |
| `window.LoveBudAuthCache` | reads optional module | Auth cache and token/session helpers. |
| `window.LoveBudAuthUI` | reads optional module | Nav/dropdown/login UI delegation. |
| `window.LoveBudAuthSession` | reads optional module | Redirect and preload helpers. |
| `window.LoveBudAuthFirebase` | reads optional module | Firebase adapter and offline fallback delegation. |
| `window.LoveBudLoginPageController` | reads optional provider | Login page controller provider for page-specific login behavior. |
| `window.LoveBudAuthLoginPage` | reads optional provider | Auth-owned login page provider and email auth execution target. |
| `window.apiClient` | reads optional API client | Used for post-login redirect target preload when available. |
| `window.applyI18n` | reads optional i18n function | Used when synchronizing login modal text. |

Boundary rule: removing or renaming any of the public `window.*` exports above requires a dedicated compatibility PR and affected-page verification. This document does not authorize removal.

### `js/i18n.js`

Observed namespace contract:

| Symbol / global | Direction | Ownership note |
| --- | --- | --- |
| `window.getCurrentLang` | reads | Sanity check for whether i18n core loaded before the compatibility shim. |

Boundary rule: this file is intentionally a shim. It should not become an auto-loader or dictionary owner without a separate i18n architecture decision.

### `js/firebase-config.js`

Observed namespace contract:

| Symbol / global | Direction | Ownership note |
| --- | --- | --- |
| `FIREBASE_CONFIG` | defines script-global variable | Browser-visible client configuration boundary. Values are intentionally not reproduced in this document. |
| `FIREBASE_INIT_FLAG` | defines script-global variable | Initialization flag key. |
| `initFirebase` | defines script-global function | Idempotent Firebase app initialization function. |
| `window.__lovebudFirebaseInitialized` | writes through flag key | Runtime marker after successful Firebase initialization. |
| `firebase` | reads global SDK object | Must already exist before initialization can succeed. |

Boundary rule: config value changes are not shared-root cleanup. They belong to Firebase config/security tracking. Do not print config values in audit or review reports.

### `js/page-shell.js`

Observed namespace contract:

| Symbol / global | Direction | Ownership note |
| --- | --- | --- |
| `window.LoveTreePageShell` | defines canonical namespace | Exposes `initSharedPage(options)`. |
| `window.LovetreePageShell` | defines compatibility alias | Legacy alias retained for compatibility. |
| `window.renderSharedHeader` | reads optional function | Called only when `renderHeader` option is true. |
| `window.applyI18n` | reads optional function | Called only when `applyI18n` option is true. |

Boundary rule: `page-shell.js` should remain orchestration-only. It must not absorb header markup, Auth, or page-specific business logic.

### `js/shared-header.js`

Observed namespace contract:

| Symbol / global | Direction | Ownership note |
| --- | --- | --- |
| `window.renderSharedHeader` | defines public function | Renders shared header markup and binds header behavior. |
| `window.t` | reads optional i18n translator | Used by header text generation with fallback to key. |
| `window.setCurrentLang` | reads optional i18n setter | Used by language dropdown. |
| `window.applyI18n` | reads optional i18n applier | Used after language selection and rerender flows. |
| `window.triggerLangChange` | reads optional i18n event helper | Used by language dropdown when available. |
| `window.initAuth` | reads optional auth initializer | Called after header render because auth containers are dynamically created. |
| `window.getConfirmedAuthUser` | reads optional auth helper | Used for immediate confirmed-session header rendering when available. |
| `window.__lovebudSettingsReturnLinkBound` | reads/writes guard flag | Prevents duplicate settings return-link capture binding. |
| `window.__lovebudSharedHeaderLangBound` | reads/writes guard flag | Prevents duplicate language rerender listener binding. |
| `lovebud-lang-change` | listens event | Re-renders shared header when language changes. |

Boundary rule: header markup, mobile navigation, language dropdown binding, path context, and auth container creation remain owned by `shared-header.js`. Page shell may call it, but must not duplicate its behavior.

## 5. Page script loading order summary

The repository still uses a bundler-free static multipage model. Page script tag order is a runtime contract because scripts define and read browser globals rather than using an ES module graph.

Current high-level Auth/Login order documented by the script-load contract:

1. Firebase SDK
2. `firebase-config`
3. i18n scripts
4. `shared-header`
5. auth submodules
6. login page controller family
7. `auth.js`
8. final page-specific controller scripts

Representative observed pages:

| Page | Shared root loading pattern | Contract note |
| --- | --- | --- |
| `pages/login.html` | Firebase SDK -> `firebase-config` -> i18n core/dictionaries -> `i18n.js` -> `shared-header.js` -> auth submodules -> login controller family -> `auth.js` -> final login page script. | Highest-risk Auth/Login provider-selection page. Do not reorder through a docs PR. |
| `pages/my-trees.html` | API/page scripts first, then Firebase SDK -> `firebase-config` -> i18n core/dictionaries -> `i18n.js` -> `shared-header.js` -> auth submodules -> `auth-login-page.js` -> `auth.js` -> inline `renderSharedHeader()`. | Auth-gated page where header render and auth initialization must remain coordinated. |
| Other `pages/*.html` consumers | Must be checked against `SCRIPT_LOAD_ORDER.md` before edits. | This document records the contract only; it does not verify every page at runtime. |

## 6. Page-specific vs shared JS boundary recommendation

| Area | Recommendation | Rationale |
| --- | --- | --- |
| Auth runtime | Keep shared root entrypoint until Auth-specific split work is separately approved. | `auth.js` still provides compatibility globals and delegates to multiple auth modules. |
| i18n shim | Keep as thin shared compatibility shim. | It protects load-order assumptions without owning dictionaries. |
| Firebase config | Keep shared singleton init contract. | Multiple pages and auth runtime depend on the same client initialization boundary. |
| Page shell | Keep shared thin orchestrator. | It coordinates shared header/i18n/page hook order without owning page behavior. |
| Shared header | Keep shared component. Consider helper extraction only after a dedicated shared-header PR. | It owns markup plus header-specific behavior and has explicit Auth/i18n coupling. |
| Page controllers | Keep page-specific. | Search, Editor, My Trees, Detail, Login, and Settings behavior should remain outside shared root files. |
| Future namespace docs | Add before implementation. | Any new namespace, wrapper, or alias deprecation should be documented before code changes. |

## 7. Guardrails

- Do not combine this documentation with implementation.
- Do not edit `js/auth.js`, `js/i18n.js`, `js/firebase-config.js`, `js/page-shell.js`, or `js/shared-header.js` in this PR.
- Do not edit `pages/*.html` script order in this PR.
- Do not remove or rename `window.*` exports without a dedicated compatibility PR.
- Do not change Auth provider selection through script order.
- Do not change Firebase config values.
- Do not move header markup ownership out of `shared-header.js` without a dedicated design/engineering decision.
- Do not touch PR #7/prototype/reference/demo/variant paths.

## 8. Not verified

This docs-only audit did not perform browser/runtime verification.

Not verified:

- login runtime smoke
- authenticated session persistence
- Firebase runtime initialization
- full-page script execution across every page
- Cloudflare preview behavior
- fixed test slot behavior

Static review only:

- existing docs and source files were read for ownership and namespace inventory
- no runtime behavior was changed
- no values from Firebase config or private payloads are reproduced here

## 9. Follow-up axes

1. Auth compatibility export test
   - Add or update a contract test for public `window.*` auth exports if future auth cleanup proceeds.

2. Header helper extraction decision
   - Use `SHARED_HEADER_CONFIG_HELPER_DECISION.md` before extracting path, language, return-link, or mobile-nav helpers.

3. Firebase config migration tracking
   - Keep config value and provider migration work under Firebase/Auth-specific tracking.

4. Page script order inventory
   - If any future PR touches page script tags, require a page-by-page dependency chain and affected-page smoke verification.

5. Namespace deprecation plan
   - Before removing compatibility aliases such as `window.LovetreePageShell`, publish a deprecation map and consumer inventory.
