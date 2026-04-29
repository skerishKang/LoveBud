# Auth Module Delegation and Legacy Fallback Audit

> **Status:** AUDIT_CAPTURED  
> **Source:** Issue #78 item 2  
> **Type:** Docs-only — no JS or runtime changes in this document

---

## 1. Purpose

This document captures the audit result for `js/auth.js` module delegation and legacy fallback usage.

`js/auth.js` delegates auth sub-responsibilities to five `window.LoveBudAuth*` submodules. This audit maps which submodule is responsible for which concern, which pages load each submodule, and whether the fallback code inside `auth.js` is still actively executed.

No fallback code is removed in this document. No global aliases are modified. Bootstrap-only reduction of `auth.js` is tracked as a separate follow-up (Issue #78 PR F).

---

## 2. Audit Source

| Field | Value |
|---|---|
| Source issue | Issue #78 item 2 |
| Audit scope | `js/auth.js`, `js/auth/auth-state.js`, `js/auth/auth-ui.js`, `js/auth/auth-session.js`, `js/auth/auth-firebase.js`, `js/auth/auth-cache.js` |
| Related audit | `AUTH_TOKEN_CACHE_DEPENDENCY_AUDIT.md` (Issue #78 item 3) |

---

## 3. Module Delegation Map

`js/auth.js` checks for the presence of each `window.LoveBudAuth*` object and delegates to it. If the object is absent at runtime, `auth.js` falls back to its own inline implementation.

| Global module | Responsible submodule file | Primary concern |
|---|---|---|
| `window.LoveBudAuthState` | `js/auth/auth-state.js` | Auth state tracking, onAuthStateChanged callbacks, auth-ready signal |
| `window.LoveBudAuthUI` | `js/auth/auth-ui.js` | Navigation UI update, avatar/login button, auth-dependent DOM |
| `window.LoveBudAuthSession` | `js/auth/auth-session.js` | Session persistence, redirect preload, post-login redirect handling |
| `window.LoveBudAuthFirebase` | `js/auth/auth-firebase.js` | Firebase login, logout, onIdTokenChanged, signup |
| `window.LoveBudAuthCache` | `js/auth/auth-cache.js` | `AUTH_TOKEN_KEY` / `lovebud_auth_token` localStorage token cache, `getCachedToken()`, `clearAuthToken()` |

---

## 4. Per-Page Submodule Load Inventory

Each submodule must be loaded via `<script>` tag in the page HTML **before** `js/auth.js` bootstraps for delegation to succeed.

> **Note:** Rows marked `VERIFY` require direct inspection of the `<script>` load order in each page file. This checklist captures the audit structure; final values must be confirmed against current `main`.

### 4.1 Load Status per Page

| Page | auth-state.js | auth-ui.js | auth-session.js | auth-firebase.js | auth-cache.js |
|---|---|---|---|---|---|
| `pages/search.html` | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY |
| `pages/editor.html` | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY |
| `pages/detail.html` | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY |
| `pages/intro.html` | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY |
| `pages/my-trees.html` | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY |
| `pages/login.html` | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY |
| `pages/signup.html` | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY |

### 4.2 Audit Instructions

For each page, confirm the following in order:

1. Open the page HTML file.
2. Locate `<script src="../js/auth/auth-*.js">` tags.
3. Verify load order: submodules must appear **before** `<script src="../js/auth.js">`.
4. Mark each cell as `LOADED`, `MISSING`, or `PARTIAL` (loaded but after `auth.js`).
5. If any submodule is `MISSING` or `PARTIAL`, the fallback in `auth.js` is still actively executed for that page.

---

## 5. Fallback Code Necessity Checklist

Fallback code inside `js/auth.js` must remain until **all** of the following conditions are true for every page:

- [ ] `window.LoveBudAuthState` loaded before `auth.js` on all pages that use auth state
- [ ] `window.LoveBudAuthUI` loaded before `auth.js` on all pages that render auth-dependent nav
- [ ] `window.LoveBudAuthSession` loaded before `auth.js` on all pages that handle post-login redirect
- [ ] `window.LoveBudAuthFirebase` loaded before `auth.js` on all pages that call login/logout/signup
- [ ] `window.LoveBudAuthCache` loaded before `auth.js` on all pages that make authenticated API calls
- [ ] Smoke test passed: login, logout, redirect, my-trees load, editor load, API 401/403 — all pages
- [ ] CTO approval granted for fallback removal PR (Issue #78 PR F)

**Do not remove fallback code until all checkboxes above are confirmed.**

---

## 6. Delegation Call Pattern

The delegation pattern used in `js/auth.js` follows this structure for each module:

```js
// Example: LoveBudAuthState delegation pattern
if (window.LoveBudAuthState && typeof window.LoveBudAuthState.onAuthReady === 'function') {
  window.LoveBudAuthState.onAuthReady(callback);
} else {
  // fallback: inline auth-ready implementation
}
```

This pattern means:
- If the submodule is loaded and exposes the expected method → delegates to submodule.
- If the submodule is absent or incomplete → falls back to `auth.js` inline code.
- Both branches must remain functional until all pages confirm full submodule coverage.

---

## 7. Bootstrap-Only Reduction Plan

> **This section is a proposal only. No implementation is performed in this PR.**

Once all five submodules are confirmed loaded on every page (Section 5 checklist complete), `js/auth.js` can be reduced to bootstrap-only:

1. **PR F — Legacy fallback reduction** (Issue #78 PR F)
   - Remove inline fallback blocks from `auth.js`, one module at a time.
   - Start with `LoveBudAuthCache` (smallest surface area, already audited in `AUTH_TOKEN_CACHE_DEPENDENCY_AUDIT.md`).
   - Each removal must be smoke-tested: login → redirect → auth-gated page → logout.
2. **Do not combine fallback removal with token cache migration, CSS cleanup, or any other concern.**
3. **Keep legacy `window.*` aliases** until all pages are confirmed migrated (tracked separately as Issue #78 PR E).

---

## 8. Guardrails

- **No JS changes in this document or its PR.**
- **No fallback code removal** until Section 5 checklist is fully confirmed and CTO-approved.
- **No global alias removal** (`window.LoveBudAuth*`) until usage is verified per-page.
- **No mixing** with Search CSS extraction, token cache migration, or other unrelated PRs.
- **No prototype/reference/demo/variant file changes.**
- **No Auth/runtime/token/cache behavior changes** in any docs-only PR.

---

## 9. Verification Checklist

- [ ] `git diff --check` passes
- [ ] Changed files limited to `docs/security/AUTH_MODULE_DELEGATION_FALLBACK_AUDIT.md`
- [ ] No JS/CSS/page/runtime changes
- [ ] No `close`/`fixes`/`resolves` keywords for #78 in this document

---

## Notes

Issue #78 remains **open**. This document covers item 2 (module delegation / legacy fallback) only. Items 1, 3–7 and the full PR split plan remain pending under Issue #78.

See also: [`AUTH_TOKEN_CACHE_DEPENDENCY_AUDIT.md`](./AUTH_TOKEN_CACHE_DEPENDENCY_AUDIT.md) for the token cache read/write/delete map (Issue #78 item 3).
