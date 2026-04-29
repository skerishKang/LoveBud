# Repository Folder-Prefix Naming Audit

> **Audit type**: Docs-only. No renames performed.
> **Date**: 2026-04-29
> **Branch**: `docs/repository-folder-prefix-naming-audit`
> **Base SHA (main)**: `ec93afb070a11373d224f3279d6735f6f07bc6f6`
> **Related**: Refs #223, Refs #65, Refs #72, Refs #225

---

## 1. Purpose

Inventory all files under refactored sub-folders and identify whether each file conforms to its folder's `folder-name-*` prefix rule. This document is the prerequisite step before any implementation renames are scheduled.

**This document does NOT rename any file.** All rename proposals must be implemented in separate, dedicated PRs.

---

## 2. Naming Convention Rules (per folder)

| Folder | Expected prefix | Convention enforced? |
|---|---|---|
| `js/search/` | `search-*` | Target rule |
| `js/auth/` | `auth-*` | Target rule |
| `js/editor/` | `editor-*` | Target rule |
| `js/login/` | `login-*` | Target rule |
| `css/*/` | Separate decision required | See §6 |

---

## 3. Current Naming Convention Observed

The repository uses a two-layer pattern for JS modules:

- **Root-level legacy files** (e.g. `js/search.js`, `js/auth.js`, `js/editor.js`): flat, page-scoped entrypoints that predate the sub-folder refactor.
- **Sub-folder modules** (e.g. `js/search/`, `js/auth/`, `js/editor/`, `js/login/`): refactored modules. These are the **primary audit scope**.

Files in the sub-folders mostly follow the `folder-name-*` prefix already. A small set of files inside `js/search/` omit the prefix (using only a functional descriptor with no folder-name prefix).

CSS sub-folders use a **selector-ownership / component-module** naming style (e.g. `base.css`, `controls.css`, `canvas.css`, `sidebar.css`) rather than a `folder-name-*` prefix style. This is a distinct convention and is treated separately in §6.

---

## 4. Folder-by-Folder Inventory

### 4.1 `js/search/` — 6 files

| File | Has `search-*` prefix? | Status |
|---|---|---|
| `js/search/card-renderer.js` | ❌ No | **Mismatch** |
| `js/search/index.js` | ❌ No (entry-point convention) | **Intentional exception** — `index.js` is an accepted module-entry pattern |
| `js/search/preview-renderer.js` | ❌ No | **Mismatch** |
| `js/search/search-preview-cache.js` | ✅ Yes | Compliant |
| `js/search/search-ui.js` | ✅ Yes | Compliant |
| `js/search/search-url-state.js` | ✅ Yes | Compliant |

> ⚠️ **PR #344 already covers `js/search/` filename normalization.** All mismatch items in this folder are marked as covered. No rename proposals are made here; see §7.1.

### 4.2 `js/auth/` — 7 files

| File | Has `auth-*` prefix? | Status |
|---|---|---|
| `js/auth/auth-cache.js` | ✅ Yes | Compliant |
| `js/auth/auth-callbacks.js` | ✅ Yes | Compliant |
| `js/auth/auth-firebase.js` | ✅ Yes | Compliant |
| `js/auth/auth-login-page.js` | ✅ Yes | Compliant |
| `js/auth/auth-session.js` | ✅ Yes | Compliant |
| `js/auth/auth-state.js` | ✅ Yes | Compliant |
| `js/auth/auth-ui.js` | ✅ Yes | Compliant |

✅ **All 7 files are fully compliant.** No mismatches.

### 4.3 `js/editor/` — 22 files

| File | Has `editor-*` prefix? | Status |
|---|---|---|
| `js/editor/editor-auth-helpers.js` | ✅ Yes | Compliant |
| `js/editor/editor-bindings.js` | ✅ Yes | Compliant |
| `js/editor/editor-canvas-interaction.js` | ✅ Yes | Compliant |
| `js/editor/editor-canvas-layout.js` | ✅ Yes | Compliant |
| `js/editor/editor-canvas-node.js` | ✅ Yes | Compliant |
| `js/editor/editor-canvas-viewport.js` | ✅ Yes | Compliant |
| `js/editor/editor-canvas.js` | ✅ Yes | Compliant |
| `js/editor/editor-data-loader-fallbacks.js` | ✅ Yes | Compliant — uses established `*-fallbacks` sub-suffix pattern |
| `js/editor/editor-data-loader.js` | ✅ Yes | Compliant |
| `js/editor/editor-detail-ui.js` | ✅ Yes | Compliant |
| `js/editor/editor-dom-selectors.js` | ✅ Yes | Compliant |
| `js/editor/editor-entry-fallbacks.js` | ✅ Yes | Compliant — uses established `*-fallbacks` sub-suffix pattern |
| `js/editor/editor-helpers.js` | ✅ Yes | Compliant |
| `js/editor/editor-i18n-refresh.js` | ✅ Yes | Compliant |
| `js/editor/editor-memory-actions.js` | ✅ Yes | Compliant |
| `js/editor/editor-memory-form.js` | ✅ Yes | Compliant |
| `js/editor/editor-page-helpers.js` | ✅ Yes | Compliant |
| `js/editor/editor-rename-ui.js` | ✅ Yes | Compliant |
| `js/editor/editor-root-helpers.js` | ✅ Yes | Compliant |
| `js/editor/editor-save-status.js` | ✅ Yes | Compliant |
| `js/editor/editor-shell-helpers.js` | ✅ Yes | Compliant |
| `js/editor/editor-tree-helpers.js` | ✅ Yes | Compliant |

✅ **All 22 files are fully compliant.**

**Established sub-suffix patterns observed in `js/editor/`:**
- `*-helpers.js` — utility helper grouping
- `*-fallbacks.js` — graceful degradation / offline fallback
- `*-canvas-*.js` — canvas sub-module grouping

These are intentional and should be preserved in future files added to this folder.

### 4.4 `js/login/` — 2 files

| File | Has `login-*` prefix? | Status |
|---|---|---|
| `js/login/login-dom.js` | ✅ Yes | Compliant |
| `js/login/login-page.js` | ✅ Yes | Compliant |

✅ **All 2 files are fully compliant.** No mismatches.

---

## 5. Mismatch Table — Actionable Items

> Items covered by PR #344 are listed but not proposed for rename here.

| # | Current path | Proposed path | Reason | References to update | Risk | Suggested PR slice |
|---|---|---|---|---|---|---|
| M-01 | `js/search/card-renderer.js` | `js/search/search-card-renderer.js` | Missing `search-` prefix; root-level `js/search-card-renderer.js` already uses this name | `js/search/index.js` imports; any pages importing this module | Low | Already covered by PR #344 |
| M-02 | `js/search/preview-renderer.js` | `js/search/search-preview-renderer.js` | Missing `search-` prefix; root-level `js/search-preview-renderer.js` already uses this name | `js/search/index.js` imports; any pages importing this module | Low | Already covered by PR #344 |

**Total actionable mismatches: 2** (both in `js/search/`, both already covered by PR #344)

---

## 6. CSS Convention — Separate Analysis

CSS sub-folders use **component/role-based naming** rather than `folder-name-*` prefix. This is a distinct, established convention.

### 6.1 `css/search/` — 9 files

| File | Pattern |
|---|---|
| `base.css` | Generic component role (entry/reset) |
| `controls.css` | Component role |
| `empty-state.css` | Component role |
| `growing-trees.css` | Feature-specific |
| `hero-controls.css` | Component role |
| `preview-sidebar.css` | Component role |
| `responsive.css` | Breakpoint scope |
| `results-skeleton.css` | Component role |
| `tree-card.css` | Component role |

### 6.2 `css/editor/` — 9 files

| File | Pattern |
|---|---|
| `base.css` | Generic component role |
| `canvas.css` | Component role |
| `detail-panel.css` | Component role |
| `layout.css` | Layout scope |
| `memory-form.css` | Component role |
| `overrides.css` | Override scope |
| `responsive-tail.css` | Breakpoint scope |
| `responsive.css` | Breakpoint scope |
| `sidebar.css` | Component role |

### 6.3 CSS Convention Decision Required

**Classification: `needs convention decision`**

The current CSS naming style (`base.css`, `controls.css`, `canvas.css`, etc.) is consistent within each sub-folder and reflects a well-understood **CSS module / selector-ownership** pattern. Applying a `folder-name-*` prefix (e.g. `search-base.css`, `editor-canvas.css`) would:

- Require updating all `@import` statements in parent CSS files
- Introduce no functional benefit if import paths already establish context
- Diverge from the semantic clarity that role-based names provide in CSS

**Recommendation**: Decide on one of the following before any CSS renames:
1. Keep current role-based CSS naming (no change) — **preferred if imports are always folder-scoped**
2. Adopt `folder-name-*` prefix for CSS to match JS convention — requires dedicated CSS convention PR

A separate RFC or convention-decision PR should address this before scheduling any CSS renames.

---

## 7. Exclusions

### 7.1 PR #344 — Search filename normalization (Already in Progress)

The following items are **excluded from rename proposals in this audit** because they are already being handled by PR #344:

- `js/search/card-renderer.js` → `js/search/search-card-renderer.js`
- `js/search/preview-renderer.js` → `js/search/search-preview-renderer.js`

No overlap or duplication with PR #344 is introduced by this document.

### 7.2 Prototype / Reference / Demo / Variant paths

Excluded from audit scope:
- `hotspot-prototype/`
- `scrapbook-demo/`
- Any file with `/prototype/`, `/reference/`, `/demo/`, or `/variant/` in its path
- PR #7 paths (excluded, no contact)

### 7.3 External / Vendor / Static Assets

- `assets/` directory: static assets excluded
- Any CDN-sourced or vendored files: excluded

### 7.4 Non-JS/CSS directories (out of scope for prefix rule)

- `pages/`, `functions/`, `modal_compute/`, `tests/`, `scripts/`, `netlify/`, `.github/`
- Root-level files: `package.json`, `package-lock.json`, `vercel.json`, etc.

---

## 8. Root-Level Legacy Files (Informational)

The following root-level `js/*.js` files are counterparts to their sub-folder modules. They are **not in scope for rename** under this audit (they are flat entrypoints, not sub-folder modules), but should be tracked for eventual consolidation:

| Legacy file | Sub-folder module |
|---|---|
| `js/auth.js` | `js/auth/` |
| `js/editor.js` | `js/editor/` |
| `js/search.js` | `js/search/` |
| `js/login-page.js` | `js/login/` |

---

## 9. Recommended Implementation Order

1. **Search filename normalization** — Already PR #344. No action needed here.
2. **JS folder rename PRs by folder** — Only if new non-compliant files are added; current inventory shows zero open mismatches outside `js/search/`.
3. **CSS convention decision PR** — Draft an RFC or decision doc before any CSS sub-folder renames.
4. **Tests / docs naming cleanup** — Evaluate only if a dedicated naming pass is warranted after JS/CSS work is stable.

---

## 10. Mismatch Count Summary

| Folder | Total files | Mismatches | Status |
|---|---|---|---|
| `js/search/` | 6 | 2 | Already covered by PR #344 |
| `js/auth/` | 7 | 0 | ✅ Fully compliant |
| `js/editor/` | 22 | 0 | ✅ Fully compliant |
| `js/login/` | 2 | 0 | ✅ Fully compliant |
| `css/search/` | 9 | — | Needs convention decision |
| `css/editor/` | 9 | — | Needs convention decision |
| **Total JS** | **37** | **2** | Both covered by PR #344 |

---

*This document is a docs-only audit. No files were renamed. No issues were closed.*
