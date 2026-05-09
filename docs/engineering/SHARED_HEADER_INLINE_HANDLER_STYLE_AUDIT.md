# Shared Header Inline Handler & Style Audit

**Issue:** #126
**Scope:** Audit-only; no implementation changes
**Related:** js/shared-header.js, pages using shared header

---

## 1. Audit Target Summary

### 1.1 Files / Markup Under Audit

| Target | Location | Notes |
| :--- | :--- | :--- |
| Shared header container | pages/*.html header include | Per-page include; navbar/site-header region |
| Inline event handler | logo element onclick=window.location.href='...' | Navigation trigger |
| Cached avatar inline style | style=background-image: url(...) | Dynamic user avatar image |
| Language toggle inline style | style=display: ... (state-dependent) | i18n visibility toggle |
| Auth placeholder inline style | style=opacity: 0.5; pointer-events: none or similar | Pre-login disabled state |
| Header / nav CSS dependencies | css/global.css or page-specific CSS | Shared header styles |

**Working assumption:** Header markup lives in per-page HTML files (pages/*.html) as a shared include pattern; shared script and global CSS live at root level.

---

## 2. Inline Handler Questions

### 2.1 Logo Inline Handler

**Current:** <div class=logo onclick=window.location.href='...'> (or similar inline navigation handler)

**Questions:**
- Can the inline onclick be replaced with a semantic <a href=/ class=logo> element?
  - Navigation target is always the home page (/ or index.html)
  - No custom event data; pure navigation
- If converted to <a>, what is the impact on:
  - Mobile nav interactions (hamburger/toggle state)?
  - Header layout shift due to default <a> styling?
  - Accessibility (keyboard tab order, screen reader)?
- If staying as div with listener, can the inline handler be replaced with an ddEventListener call in js/shared-header.js?
  - CSP implications (removing inline script)
  - Page load timing / event delegation considerations

### 2.2 Event Listener Migration Feasibility

**Considerations:**
- Current page load order: shared header markup is inline in each page; js/shared-header.js is loaded via <script src=../js/shared-header.js></script> (or /js/...)
- Event delegation: can the logo click be attached safely in DOMContentLoaded?
- Dynamic pages: my-trees.html, detail.html - ensure consistent behavior across all pages

---

## 3. Inline Style Classification

### 3.1 State-Critical Inline Styles (cannot remove)

| Style | Reason | CSS class candidate |
| :--- | :--- | :--- |
| Cached avatar ackground-image | User-specific URL; highly dynamic | .avatar-cached[data-src=...] with JS-set style or --avatar-url custom property |
| Auth placeholder opacity / pointer-events | Visual disabled state pre-login | .auth-placeholder--disabled |
| Language toggle display | Toggle visibility for language picker | .lang-toggle--open / .lang-toggle--closed |

### 3.2 CSS-Movable Styles (can extract)

- Avatar container size, border-radius, fallback background color
- Language toggle icon size/color
- Header layout (flex/grid, spacing) that is currently duplicated inline

---

## 4. CSP & Accessibility Implications

### 4.1 CSP Hardening Value
- Removing inline onclick -> 'unsafe-inline' script allowance can be tightened
- Inline styles: style attributes are allowed by default in CSP; no 'unsafe-inline' needed except for style tags / style attributes are permitted unless 'unsafe-inline' is revoked for style (rare)
- Inline handlers are the primary CSP concern ('unsafe-inline' script)

### 4.2 Semantic Navigation
- <a href=/> is more accessible by default (screen reader link role, keyboard focus)
- If staying with div, must add 	abindex=0 and keydown handler for Enter/Space

---

## 5. Guardrails

- **Do not** change shared header runtime behavior in this audit PR
- **Do not** modify Auth handoff / session state handling
- **Do not** alter language toggle state machine / i18n logic
- **Do not** perform CSS refactor beyond marking what _could_ move
- **Do not** touch PR #7 or prototype/reference/demo/variant paths

---

## 6. Follow-up PR Split Proposal

### 6.1 Phase 1: Semantic Logo Link
- Convert inline handler logo div to <a class=logo href=/>
- CSS adjustments to match existing appearance
- Verify all pages still render identically

### 6.2 Phase 2: Avatar Class Extraction
- Replace inline ackground-image with style=background-image: ... -> class=avatar-cached + data-src or CSS custom property
- JS sets the actual background image (already does); inline style can be removed or replaced with --avatar-url

### 6.3 Phase 3: Language/Auth Placeholder Classes
- Replace style=display: ... with class=lang-toggle--open etc.
- Replace inline opacity/pointer-events with .auth-placeholder--disabled

### 6.4 Phase 4: CSP Hardening PR
- Remove inline event handlers entirely (after PRs above are stable)
- Tighten CSP to disallow 'unsafe-inline' for scripts
- Smoke all affected pages (home, search, editor, my-trees, detail, login)

---

## 7. Action Items (Next Steps)

- [ ] Verify current header markup across all pages/*.html files
- [ ] Confirm shared-header.js event listener set (if any) and load timing
- [ ] Draft PR #1 (Phase 1) — semantic logo link
- [ ] Draft PR #2 (Phase 2) — avatar class extraction
- [ ] Draft PR #3 (Phase 3) — language/auth placeholder classes
- [ ] Draft PR #4 (Phase 4) — CSP hardening + inline handler removal

---

## 8. Notes

This audit is **docs-only** and does not change any runtime behavior. Any implementation PRs derived from this audit must:
- Keep shared header CSS footprint minimal
- Maintain 375px mobile layout stability
- Not regress Search/Editor/My Trees header interactions
- Not break browser back/forward navigation
- Preserve auth placeholder disabled state visibly
