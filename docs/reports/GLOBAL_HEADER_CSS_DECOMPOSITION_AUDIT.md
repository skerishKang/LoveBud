# Global Header CSS Decomposition Audit

**Issue:** #3104
**Status:** OPEN — audit-only; no CSS/HTML/JS/deployment changes
**Audit target:** `css/global/global-header.css` (743 lines)

> **Audit constraint:** No selector, declaration, variable, media-query, specificity, or
> stylesheet-load-order change. No `css/global.css` import-hub changes.

---

## 1. Import / cascade ownership

**Import chain:**
- `css/global.css` line 9 → `@import url('./global/global-header.css')`
- `css/global/global-header.css` line 1 → `@import url('./global-header-language.css')`

**Consuming surfaces:** All pages that load `css/global.css` as their stylesheet hub.

**Style origin:** All rules are author-origin. The target stylesheet contains five `!important` declarations; any future extraction must preserve their selector and media-query context.

---

## 2. Responsibility clusters

### 2a. Shared header shell (lines 3–46)
- `.nav-bar`: `sticky`, `z-index: 1000`, `backdrop-filter`, `grid` layout, `border-bottom`
- `.headline`: brand link, `font-size: 1.5rem`, `font-weight: 900`, `letter-spacing`
- `.nav-links`: flex row container, gap 8px
- `.nav-links a`: `inline-flex`, `min-height: 36px`, `border-radius: 20px`, `opacity: 0.65`

### 2b. Guest auth actions (lines 47–55)
- `.main-nav`: `display: block`, `min-width: 0`
- `.main-nav-panel`: `grid` with two columns
- `.nav-actions`: flex row, `flex: 0 0 auto`

### 2c. Authenticated dropdown / profile controls (lines 57–198)
- `.user-dropdown`: `position: relative`, `display: inline-block`
- `.user-dropdown-trigger`: flex row, gap 8px
- `.user-dropdown-trigger-icon`: `width: 46px`, `height: 46px`, `border-radius: 999px`, gradient background
- `.user-avatar-shell`: `36px`, `border-radius: 50%`
- `.user-avatar-initial`: `font-size: 15px`, `font-weight: 800`, `color: var(--primary)`
- `.cached-avatar-*`: fallback avatar (`32px`, `border-radius: 50%`)

### 2d. User dropdown menu (lines 199–260)
- `.user-dropdown-menu`: `position: absolute`, `z-index: 1000`, `display: none` / `.show` → `display: block`
- `.user-dropdown-meta`: `padding: 14px 20px 10px`, `font-size: 12px`, `font-weight: 600`
- `.user-dropdown-item`: `flex`, `gap: 12px`, `padding: 12px`
- `.user-dropdown-item:focus-visible`: `box-shadow: 0 0 0 2px rgba(144,73,81,0.26)`

### 2e. Mobile nav / menu state (lines 261–325)
- `.mobile-nav-toggle`: `display: none` (desktop) → `display: inline-flex` (≤768px)
- `.main-nav-panel` (≤768px): `position: absolute`, `top: calc(100% + 10px)`, `flex-direction: column`
- `.nav-links` (≤768px): `width: 100%`, `flex-direction: column`
- `.nav-actions` (≤768px): `justify-content: space-between`, `border-top`

### 2f. Responsive breakpoints

| Breakpoint | Lines | Behavior |
|------------|-------|----------|
| ≤768px | 327–395 | `.nav-bar` → `flex`, `min-height: 65px`; mobile toggle visible; panel absolute |
| ≤480px | 396–477 | Tighter padding (`12px`), smaller headline (`1.7rem`), smaller avatar (`42px`) |
| ≤768px (dropdown) | 478–617 | `.user-dropdown-menu` right-aligned, `min-width: min(280px, calc(100vw - 48px))` |
| ≤480px (dropdown) | 629–640 | `.user-dropdown-trigger-icon` → `42px`; menu `min-width: min(260px, calc(100vw - 36px))` |
| ≥769px | 642–655 | `#auth-nav` → `flex: 0 0 auto`, `min-width: 100px`, `max-width: 168px` |
| 769–1360px | 658–685 | Compact `column-gap: 18px`, nav link `font-size: 12.5px` |
| 1361–1536px | 686–694 | `padding-inline: 28px`, `column-gap: 24px` |
| ≥769px (nav grid) | 696–727 | `grid-template-columns: 72px 118px 86px 106px 64px` |
| 769–1360px (nav grid) | 728–742 | `grid-template-columns: 60px 98px 74px 92px 56px` |

### 2g. `#shared-header` CLS prevention (lines 544–554)
- `#shared-header`: `min-height: 81px` (desktop), `contain-intrinsic-size: 0 81px`
- `@media (max-width: 768px)`: `min-height: 65px`, `contain-intrinsic-size: 0 65px`

### 2h. Dark/light appearance and reduced-motion
No `prefers-reduced-motion` or `prefers-color-scheme` query was found in this stylesheet. Whether this concern belongs to the shared header's responsibility or to a broader product accessibility scope cannot be determined from this audit alone.

---

## 3. Cascade / override / specificity risks

1. **`@import` is first** — `css/global/global-header.css` line 1 loads `global-header-language.css` before any declaration. Language dropdown CSS can override header tokens if its selectors match.
2. **`#shared-header` vs `.nav-bar`** — `#shared-header` (ID) has higher specificity than `.nav-bar` (class). Future selector changes must preserve the current `#shared-header` and `.nav-bar` cascade relationship and verify the CLS reservation behavior.
3. **`.show` class** — `.user-dropdown-menu.show` → `display: block`. No animation or transition. Any `.show` addition must preserve this display flag.
4. **`min-width: max-content`** — Used in `.nav-actions` and `.main-nav`. Can cause overflow at narrow viewports. Extracted file must keep this property.
5. **`clamp()` usage** — `column-gap: clamp(16px, 2.5vw, 40px)` in `.nav-bar`. Extracted file must retain same `clamp`.

---

## 4. First extraction candidate

### Conclusion: No safe first split

**Why no split:**
- `global-header-language.css` is already extracted as a child `@import` (line 1).
- The audited declaration and media-query ordering does not identify a behavior-preserving first split within the allowed files.
- A broader stylesheet aggregation/import-order contract would be a prerequisite before reassessing an extraction.

**Recorded as `no-split / defer`.**

### Prerequisite for future split
- A broader stylesheet aggregation / import-order contract must be separately established first.
- The `@media` block order and `#shared-header` CLS reservation must be preserved.
- No selector, declaration, `!important`, `@media` order, or `z-index` change.

### Rollback trigger
If any of the following changes:
- Selector ordering in this file
- `@media` query boundary (768px, 480px, 769px)
- `.user-dropdown-menu.show` display toggle
- `z-index: 1000` for dropdown
- `!important` usage pattern
- `.user-dropdown-menu` absolute positioning

→ **rollback and return to monolithic form.**

### Future implementation guardrails
- No HTML, JS, auth state, or session semantics changes.
- No `css/global.css` import-hub changes.
- No visual redesign of editor / viewer / auth pages.

---

## 5. Explicit exclusions

| Scope | Reason |
|-------|--------|
| `css/global.css` import-hub | No changes to `global.css` imports |
| Editor / viewer UI | `pages/editor.html`, `pages/detail.html` — no scope |
| Auth / session | `js/auth.js`, `js/firebase-config.js` — no scope |
| #2960 | `ux/editor-detail-panel-tree-context` — no interaction |
| #2856 | `fix/editor-growth-affordance-stable-render` — no interaction |
| #3070 | Existing-save UX — excluded |
| #3072 | Mobile UX redesign — excluded |

---

## 6. Verification matrix (future PR only)

| Scenario | Expected |
|----------|----------|
| Desktop guest header | `.nav-bar` sticky, `.nav-links` at `opacity: 0.65`, `color: var(--on-surface)` |
| Desktop authenticated | `.user-dropdown-trigger-icon` at `46px`, gradient, `border-radius: 999px` |
| Dropdown open/close | `.user-dropdown-menu.show` → `display: block`, `z-index: 1000` |
| Narrow/mobile nav | ≤768px: `.mobile-nav-toggle` `display: inline-flex`, `.main-nav-panel` absolute |
| Focus-visible keyboard | `Tab` → `.user-dropdown-item:focus-visible` → `box-shadow: 0 0 0 2px` |
| Responsive breakpoints | 768px: flex layout; 1360px: compact link grid; 1536px: `padding-inline: 28px` |
| Dark/light appearance | No corresponding `prefers-color-scheme` query was found in the target stylesheet; ownership is not determined by this audit |
| Remote CI | repository workflow must complete green before merge |

---

## 7. Appendix: File metrics (current main)

| Metric | Value |
|--------|-------|
| Total lines | 743 |
| `@import` (`@import`) | 1 (`global-header-language.css`) |
| `@media` blocks | 10 |
| `!important` | 5 (all in `@media (max-width: 480px)` `.lang-menu-trigger`) |
| `clamp()` | 3 |
| `var()` | ~20 |
| `!important` free scope | All other selectors |

---

*Refs #3104, #3086, #1882*