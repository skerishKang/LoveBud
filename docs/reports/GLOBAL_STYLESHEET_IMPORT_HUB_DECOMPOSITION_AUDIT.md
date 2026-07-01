# Global Stylesheet Import Hub Decomposition Audit

**Issue:** #3107
**Status:** OPEN — audit-only; no CSS/HTML/JS/deployment changes
**Audit target:** `css/global.css` (680 lines)

> **Audit constraint:** No selector, declaration, variable, media-query, specificity, or
> stylesheet-load-order change. No `css/global.css` import-hub changes.

---

## 1. Import-order map

**Current `css/global.css` imports (lines 7–12):**

| Order | Import | Purpose |
|-------|--------|---------|
| 1 | `@import url('./global/tokens.css')` | Design token custom properties |
| 2 | `@import url('./global/global-base.css')` | Base/reset shared control |
| 3 | `@import url('./global/global-header.css')` | Shared header + auth nav (audited separately under #3104) |
| 4 | `@import url('./global/lovetree-calm-page-shell.css')` | Calm page shell layout |
| 5 | `@import url('./global/global-ready-state.css')` | Ready-state loading guard |
| 6 | `@import url('./global/global-transition-polish.css')` | Transition polish |

**Retained declarations** (lines 14–680): The hub keeps:
- `.lovetree-page-shell` (lines 15–30)
- `.lovetree-soft-surface`, `.lovetree-card`, `.lovetree-pill`, `.lovetree-chip` (lines 33–109)
- `.btn-round`, `.btn-primary`, `.btn-outline` (lines 111–163)
- `:root` control tokens (lines 349–372)
- `.emotion-path-highlight`, `.cta-appreciation`, `.card-appreciation`, `.emotion-tag-refined`, `.moment-indicator`, `.path-arrow-refined`, `.section-divider-soft`, `.insight-text`, `.appreciation-bg`, `.save-status-indicator` (lines 175–318)
- `.material-symbols-outlined` FOUC guard (lines 324–329)
- Eyebrow, hero, h1, lead, search-panel, page-hero, shared-mobile declarations (lines 332–680)

**Notable:** `.page-hero-eyebrow.lovetree-eyebrow::before` content-none reset (lines 388–395) — pseudo-element override in the hub.

---

## 2. Responsibility cluster map

### 2a. Hub-hosted vs imported

| Location | Clusters | Source file |
|----------|----------|-------------|
| Imported | Tokens, base, header, page-shell, ready-state, transition-polish | `./global/*.css` |
| Hub (retained) | Page-shell layout, card/pill/chip, button, `:root` control tokens, emotion/appreciation CTA, save-status, material-symbols FOUC, eyebrow/hero typography, shared-mobile, page-hero, focus-visible | `css/global.css` |

### 2b. Responsibility boundary

- **Page shell** (`lovetree-page-shell`, `lovetree-soft-surface`, `lovetree-card`) — hub retains layout and responsive variants
- **Shared control** (`btn-round`, `btn-primary`, `btn-outline`) — hub retains button base
- **Card/pill/chip** (`lovetree-pill`, `lovetree-chip`) — hub retains `is-active` state variants
- **Save status** (`save-status-indicator`) — hub retains `.saving/.saved/.failed` state
- **Material symbols** — hub retains FOUC guard
- **Focus-visible** — hub retains `body .btn-round:focus-visible` ... `outline: 2px solid var(--control-focus-ring)`

---

## 3. Protected invariants

- **Import order:** 6 `@import` statements, fixed order: tokens → base → header → page-shell → ready-state → transition-polish
- **Custom-property availability:** `:root` block (lines 349–372) defines `--control-*` tokens; these are available after the `@import` chain
- **Selector/specificity ordering:** `.lovetree-page-shell` (lines 15–16), `.lovetree-soft-surface` (lines 33–37), `.lovetree-card` (lines 40–57), `.lovetree-pill` (lines 60–81), `.lovetree-chip` (lines 84–109), `.btn-round` (lines 111–115) — fixed order
- **Page shell:** `lovetree-page-shell` `max-width`/`margin`/`padding` — shell hub
- **Shared button/form/card/save-status states:** `.save-status-indicator.saving/.saved/.failed` (lines 299–318) — hub-hosted
- **Responsive:** `@media (max-width: 768px)` for `.btn-round`, `.tag-chip`, `.page-hero-section` — hub-hosted
- **Focus-visible:** `body .btn-round:focus-visible` ... `outline: 2px solid var(--control-focus-ring)` (lines 590–596)

---

## 4. No-split/defer conclusion

**Why no split:**
- The `@import` order (tokens → base → header → page-shell → ready-state → transition-polish) is a single **cascade sequence**. Each import depends on the previous being loaded before its own declarations apply.
- The hub's retained declarations (`.lovetree-*`, `.btn-*`, `.save-status-*`, `.material-symbols-*`) interleave with imported styles through custom properties (`--control-*`, `--lovetree-*`). Breaking any existing `@import` or moving a retained cluster to a new file would require duplicating the token dependency or reordering the cascade.
- A **broader stylesheet aggregation / import-order contract** must be separately established before any extraction is reassessable.

**Recorded as `no-split / defer`.**

### Prerequisite for future split
- A stylesheet aggregation contract that defines:
  1. The exact import-order dependency chain (tokens → base ... → transition-polish)
  2. Which custom properties each imported file may consume
  3. Which `@media` blocks each imported file may contain
- Without this contract, any extraction risks breaking cascade ordering.

### Rollback triggers
- Change to `@import` order in `css/global.css`
- Change to `--control-*` or `--lovetree-*` custom property availability
- Change to selector ordering (`.lovetree-page-shell`, `.lovetree-card`, `.btn-round`, etc.)
- Change to `@media` breakpoint boundaries
- Change to focus-visible `outline: 2px solid var(--control-focus-ring)` rule

---

## 5. Explicit exclusions

| Scope | Exclusion |
|-------|-----------|
| #3104 global-header audit | Closed separately — no re-entry |
| `css/global.css` import-hub | No changes to `css/global.css` |
| `css/global/global-header.css` | No changes to header file |
| `css/global/global-header-language.css` | No changes to language sub-component |
| `css/global/global-base.css` | No changes to base |
| `css/global/tokens.css` | No changes to tokens |
| Editor / viewer UI | `pages/editor.html`, `pages/detail.html` — no scope |
| Auth / session | `js/auth.js`, `js/firebase-config.js` — no scope |
| #2960 | `ux/editor-detail-panel-tree-context` — no interaction |
| #2856 | `fix/editor-growth-affordance-stable-render` — no interaction |
| #3070 | Existing-save UX — excluded |
| #3072 | Mobile UX redesign — excluded |
| Runtime / deployment | No changes |

---

## 6. Verification matrix

| Scenario | Expected |
|----------|----------|
| Shared page shell | `lovetree-page-shell` — `max-width`, `margin: 0 auto` |
| Desktop/narrow responsive | `@media (max-width: 768px)` — `.btn-round padding: 10px`, `.page-hero-h1` |
| Guest/signed-in header | No direct header rule in hub — header is imported |
| Button/form/card | `.btn-round`, `.btn-primary`, `.btn-outline` — hub retains |
| Save-status | `.save-status-indicator.saving/.saved/.failed` — hub retains |
| Focus-visible | `body .btn-round:focus-visible` — `outline: 2px solid var(--control-focus-ring)` |
| Remote CI | Repository workflow must complete green before merge |

---

## 7. Appendix: File metrics (current main)

| Metric | Value |
|--------|-------|
| Total lines | 680 |
| `@import` | 6 |
| `@media` | 7 |
| `!important` | 6 |
| `var()` | ~122 |
| `:root` | 1 (lines 349–372) |
| `--control-*` custom properties | ~15 |

---

*Refs #3107, #3086, #1882*