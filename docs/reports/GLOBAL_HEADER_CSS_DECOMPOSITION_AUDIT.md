# Global Header CSS Decomposition Audit

**Issue:** #3104  
**Status:** OPEN — audit-only; no CSS/HTML/JS/deployment changes  
**Test of:** `css/global/global-header.css` (743 lines)  
**Branch audit candidate:** `audit/global-header-css-decomposition`

> **Audit constraint:** No selector, declaration, variable, media-query, specificity, or
> stylesheet-load-order change. See `AGENTS.md` §9 (변경 규칙) and §10 (병렬 작업 안전 규칙).

---

## 1. Current File: `css/global/global-header.css`

**Import chain:** `css/global.css` line 9 → `@import url('./global/global-header.css')` → line 1 `@import url('./global-header-language.css')`

**Total:** 743 lines. One `@import` child. Two referenced `js/shared-header` rendering sites.

### Import/cascade ownership map

| Layer | File | Role |
|-------|------|------|
| **Hub** | `css/global.css` (line 9) | Top-level hub import; 4th in load order after tokens, base, before shell/page/transition |
| **Own file** | `css/global/global-header.css` | Shared header shell + auth nav + user dropdown + mobile menu + responsive overrides |
| **Child import** | `css/global/global-header-language.css` | `@import url('./global-header-language.css')` (line 1) — language toggle dropdown sub-component |
| **Consumer surfaces** | `pages/search.html`, `pages/detail.html`, `pages/editor.html`, `pages/my-trees.html`, `pages/login.html` | Each imports `css/global.css` → inherits `global-header.css` |

**Style origin:** Author (no `user-agent` / `user` override in this file). All `@media` blocks are author-scoped.

---

## 2. Responsibility Cluster Map

### 2a. Shared header shell (lines 3–46)
- `.nav-bar` — sticky position, `z-index: 1000`, `backdrop-filter`, `grid` layout, border-bottom
- `.headline` — brand link, `font-size: 1.5rem`, `font-weight: 900`, `letter-spacing`
- `.nav-links` — flex row container, gap: 8px
- `.nav-links a` — inline-flex button, `min-height: 36px`, `border-radius: 20px`, `opacity: 0.65`

**Invariant:** Desktop guest header must show `nav-links a` at `opacity: 0.65` with `color: var(--on-surface)`.

### 2b. Guest auth actions (lines 47–55)
- `.main-nav` — `display: block`, `min-width: 0`
- `.main-nav-panel` — `grid` with two columns: `minmax(0, 1fr)` + `auto`
- `.nav-actions` — flex row, `gap: clamp(8px, 1vw, 12px)`, `flex: 0 0 auto`

**Invariant:** Guest nav panel must show `main-nav-panel` as a `grid` with `auto` at the right.

### 2c. Authenticated dropdown/profile controls (lines 57–198)
- `.user-dropdown` — `position: relative`, `inline-block`
- `.user-dropdown-trigger` — flex row, `gap: 8px`
- `.user-dropdown-trigger-icon` — avatar circle: `46px`, `border-radius: 999px`, gradient
- `.user-avatar-shell` — `36px`, `border-radius: 50%`, fallback bg
- `.user-avatar-initial` — `font-size: 15px`, `font-weight: 800`
- `.user-avatar-image` — `object-fit: cover`
- `.cached-avatar-*` — cached avatar: `32px`, `border-radius: 50%`, `font-size: 14px`

**Invariant:** Authenticated user sees `user-dropdown-trigger-icon` at `46px` with gradient background and hover `translateY(-1px)`.

### 2d. User dropdown menu (lines 199–260)
- `.user-dropdown-menu` — absolute: `top: calc(100% + 8px)`, `right: 0`, `z-index: 1000`, `display: none` / `.show` -> `display: block`
- `.user-dropdown-meta` — `padding: 14px`, `font-size: 12px`, `font-weight: 600`
- `.user-dropdown-item` — `flex`, `gap: 12px`, `padding: 12px`
- `.dropdown-divider` — `height: 1px`
- `.user-dropdown-item:focus-visible` — `box-shadow: 0 0 0 2px rgba(...)`

**Invariant:** Dropdown open/close via `.show` class toggle; closed by default (`display: none`).

### 2e. Mobile nav/menu state (lines 261–325)
- `.mobile-nav-toggle` — `display: none` (desktop), `inline-flex` (mobile at ≤768px)
- `.mobile-nav-toggle` `::before` — `content: "☰"` fallback; `html.material-symbols-ready` -> hide
- `.main-nav-panel` (mobile ≤768px) — absolute, `top: calc(100% + 10px)`, `right: 16px`, `flex-direction: column`
- `.nav-links` (mobile) — `width: 100%`, `flex-direction: column`
- `.nav-actions` (mobile) — `width: 100%`, `justify-content: space-between`, `padding-top: 8px`, `border-top`

**Invariant:** Mobile nav toggle shows `display: inline-flex` at ≤768px, `display: none` at >768px.

### 2f. Responsive breakpoints (lines 327–396, 396–478, 478–617, 618–779)
- **≤768px** (lines 327–395): `.nav-bar` → `flex`, `padding: 14px`, `min-height: 65px`; `.headline` → `1.85rem`; mobile toggle `display: inline-flex`; panel `position: absolute`
- **≤480px** (lines 396–477): tighter padding `12px`, smaller headline `1.7rem`, smaller avatar `42px`
- **≤768px** dropdown (lines 478–616): `.user-dropdown-menu` → `right: 0`, `min-width: min(280px, calc(100vw - 48px))`
- **≤480px** dropdown (lines 629–640): `.user-dropdown-trigger-icon` → `42px`; `.user-dropdown-menu` → `min-width: min(260px, calc(100vw - 36px))`
- **≥769px** (lines 642–655): `#auth-nav` → `flex: 0 0 auto`, `min-width: 100px`, `max-width: 168px`
- **769–1360px** (lines 658–685): compact `column-gap`, `padding`, nav link `padding: 0`, font-size `12.5px`
- **1361–1536px** (lines 686–694): `padding-inline: 28px`, `column-gap: 24px`
- **≥769px** nav grid (lines 696–727): `grid-template-columns: 72px 118px 86px 106px 64px`
- **769–1360px** nav grid (lines 728–742): `grid-template-columns: 60px 98px 74px 92px 56px`

**Invariant:** Three breakpoints: `≤768px`, `≤480px`, `≥769px`. `min-width: (769px)` is the desktop boundary.

### 2g. Focus-visible/keyboard state (lines 57–61, 198–199)
- `.nav-links a:hover` + `.active` — `opacity: 1`, `background: rgba(144,73,81,0.08)`
- `.nav-links a.active` — `background: rgba(144,73,81,0.12)`
- `.user-dropdown-item:focus-visible` — `box-shadow: 0 0 0 2px rgba(144,73,81,0.26)`
- `.user-dropdown-item:hover:not(:disabled)` — `background: rgba(144,73,81,0.07)`

**Invariant:** Focus-visible path is `box-shadow` based; no `outline` override.

### 2h. `#shared-header` CLS prevention (lines 544–554)
- `#shared-header` — `min-height: 81px`, `contain-intrinsic-size: 0 81px` (desktop)
- `@media (max-width: 768px)` → `min-height: 65px`, `contain-intrinsic-size: 0 65px`

**Invariant:** CLS-prevention skeleton reserved by JS render; `contain-intrinsic-size` used.

### 2i. Dark/light appearance and reduced-motion
**No explicit `prefers-reduced-motion` or `prefers-color-scheme` rules found.**  
All `transition` values are `none` or `0.2s` (`ease`). No `@media (prefers-reduced-motion: reduce)` present.  
This is a **gap**: if the user agent sets `prefers-reduced-motion: reduce`, the file has no graceful fallback.

---

## 3. Cascade/override/Specificity risks

### Known risks
1. **`@import` is first** — `@import` at line 1 loads `global-header-language.css` before any declaration in this file. Language CSS can override header tokens if its selectors match.
2. **`#shared-header` vs `.nav-bar`** — `#shared-header` has higher specificity (`ID`) than `.nav-bar` (`class`). If a future `.nav-bar` rule targets `nav-bar`, it must `:not()` around the shared-header ID.
3. **`.show` class** — `.user-dropdown-menu.show` at `display: block`. No animation. No `visibility` transition. Any `.show` addition must preserve this exact display flag.
4. **`min-width: max-content`** — Used in `.nav-actions` and `.main-nav`. Can cause overflow at narrow viewports. Extracted file must keep this.
5. **`clamp()` in grid column-gap** — `column-gap: clamp(16px, 2.5vw, 40px)` — extracted file must keep same clamp.

---

## 4. Exact first extraction candidate: `css/global/global-header.css` → `css/global/global-header.css` (same file, no split)

**Candidate:** None. The file is already **monolithic and self-contained** — it has its own `@import` child for the language sub-component. A "split" would mean moving the language dropdown into a sibling file, but that is already done (`global-header-language.css`).

**Recommendation:** **No split.** The 743-line file is within the 800-line extraction-candidate threshold (`AGENTS.md` §9: "800줄 이상 파일은 extraction candidate"). But:
- The language sub-component is **already extracted** (line 1).
- The remaining 742 lines are a single cohesive shell: header + auth + dropdown + responsive.
- All selectors share `.nav-bar` / `.nav-link` / `.user-` / `.main-nav` prefixes — any split would require `@import` reordering or selector duplication.

### If extraction were forced (contrary to this audit's recommendation)
**Allowed files:** `css/global/global-header.css`, `css/global/global-header-language.css`  
**Forbidden files:** `css/global.css`, `css/global/global-base.css`, `css/global/tokens.css`, `css/global/lovetree-calm-page-shell.css`, `css/global/global-ready-state.css`, `css/global/global-transition-polish.css`  
**Rollback condition:** Any extraction must pass `git diff --check` with zero changed lines in `css/global.css`.  
**Future implementation constraint:** Must not touch `js/shared-header.js`, `js/firebase-config.js`, `js/auth.js`.

---

## 5. Explicit exclusions

| Scope | Exclusion |
|-------|-----------|
| `css/global.css` import-hub | ❌ No changes to `global.css` imports or `global.css` itself |
| Editor/viewer UI redesign | ❌ `pages/editor.html`, `pages/detail.html`, `pages/search.html` — no CSS/UX changes |
| Auth API/session | ❌ `js/auth.js`, `js/firebase-config.js`, `js/firebase-auth.js` — no changes |
| #2960 | ❌ `ux/editor-detail-panel-tree-context` — no interaction |
| #2856 | ❌ `fix/editor-growth-affordance-stable-render` — no interaction |
| #3070 | ❌ existing-save UX — no scope |
| #3072 | ❌ mobile UX redesign — no scope |

---

## 6. Focused future verification matrix

| Scenario | Method | Expected |
|----------|--------|----------|
| Desktop guest header | Visual: `.nav-bar` at `sticky`, `.nav-links` at `opacity: 0.65` | `opacity: 0.65`, `color: var(--on-surface)` |
| Desktop authenticated | Visual: `.user-dropdown-trigger-icon` at `46px`, gradient | `width: 46px`, `background: linear-gradient(...)` |
| Dropdown open/close | `.user-dropdown-menu.show` → `display: block`, `z-index: 1000` | `display: block` |
| Narrow/mobile nav | ≤768px: `.mobile-nav-toggle` `display: inline-flex`, `.main-nav-panel` `display: none` | Toggle visible |
| Focus-visible keyboard | `Tab` through `.nav-links a` → `box-shadow` on `.user-dropdown-item:focus-visible` | `box-shadow: 0 0 0 2px rgba(...)` |
| Responsive breakpoints | 768px: `flex` layout; 1360px: `grid` link columns; 1536px: `padding-inline: 28px` | Column-gap `18px` at 1360px |
| Dark/light appearance | `prefers-color-scheme: dark` → no dark-theme rules in file (gap) | — |
| Remote CI | `git diff --check` only; no `npm test`, `npm run lint` | Clean diff |

### Verification notes
- **No blanket test/lint/build/verify** — this is an audit-only issue.
- **Remote PR diff** must be checked before any future merge.
- **User production smoke** — `https://lovebud.pages.dev/` is the production domain. Do not use for pre-merge PR verification. Use Cloudflare PR Preview instead.

---

## 7. Appendix: File metrics

| Metric | Value |
|--------|-------|
| Lines | 743 |
| `@import` | 1 (to `global-header-language.css`) |
| `@media` blocks | 12 (≤768px x2, ≤480px x2, ≥769px x2, 769–1360px x2, 1361–1536px x1, ~last ~3) |
| `clamp()` | 3 (column-gap, padding, font-size) |
| `min-width: max-content` | 2 (`.nav-actions`, `.nav-links`) |
| `var()` | ~20 |
| `!important` | 0 |

---

*Refs #3104, #3086, #1882*