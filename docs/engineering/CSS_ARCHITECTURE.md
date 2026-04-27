# CSS Architecture

This document records the current stylesheet entry points and verification expectations after the CSS split work in PR #181 and PR #182.

This is an architecture/verification reference only. It does not introduce new CSS behavior.

---

## 1. Global stylesheet import hub

`css/global.css` is the global stylesheet import hub.

Current import order:

1. `css/global/tokens.css`
2. `css/global/base.css`
3. `css/global/header.css`

Do not reorder these imports without explicit review and browser visual verification.

`tokens.css` must load before files that consume CSS variables. `base.css` depends on the global token layer. `header.css` consumes shared tokens and owns shared header-related surfaces.

---

## 2. Shared header stylesheet

`css/global/header.css` owns shared header, navigation, authentication, language, and mobile header styles.

Current ownership includes:

- `.nav-bar`
- `.nav-links`
- `.main-nav`
- `.main-nav-panel`
- `.nav-actions`
- language dropdown styles
- auth/user dropdown styles
- mobile nav controls
- header-scoped Material Symbols FOUC guard
- `#shared-header` CLS reserve rules

Changes to `css/global/header.css` can affect every page that renders the shared header. Treat these changes as shared-surface changes, not as page-local polish.

---

## 3. My Trees page stylesheet import hub

`css/my-trees.css` is the page-specific stylesheet import hub for `pages/my-trees.html`.

Current import order:

1. `css/my-trees/layout.css`
2. `css/my-trees/header.css`
3. `css/my-trees/cards.css`
4. `css/my-trees/states.css`
5. `css/my-trees/create-modal.css`
6. `css/my-trees/responsive.css`

Do not move My Trees page-specific rules into `css/global.css` unless the selector is intentionally shared across pages and the change is reviewed as a global style change.

---

## 4. My Trees split ownership

The current My Trees split is role-based:

| File | Ownership |
|------|-----------|
| `css/my-trees/layout.css` | page layout shell and content container |
| `css/my-trees/header.css` | My Trees page header, sort control, create button |
| `css/my-trees/cards.css` | tree grid, tree cards, card menu/dropdown |
| `css/my-trees/states.css` | empty/error states and create entry icon |
| `css/my-trees/create-modal.css` | create-tree modal, fields, goal card, modal actions |
| `css/my-trees/responsive.css` | My Trees responsive overrides |

Keep responsive overrides in `responsive.css` unless a rule must live next to a base rule for clarity and the split decision is documented in the PR.

---

## 5. Review and verification expectations

For CSS import hub or split changes, review should include:

- changed files are limited to the intended stylesheet/docs scope;
- import order is preserved unless the PR explicitly explains the dependency change;
- Network check confirms imported CSS files do not return 404;
- shared header smoke is performed when `css/global/header.css` changes;
- page-specific smoke is performed when a page stylesheet hub changes.

Visual verification must follow `docs/ops/BROWSER_VERIFICATION_URL_POLICY.md`. Do not report a visual PASS from an invented preview URL.

---

## 6. Non-goals

This document does not authorize:

- CSS code changes;
- `css/global.css` import order changes;
- `css/my-trees.css` import order changes;
- header/nav/auth/language/mobile CSS relocation;
- page cache-bust changes;
- prototype/reference/demo/variant cleanup or movement.
