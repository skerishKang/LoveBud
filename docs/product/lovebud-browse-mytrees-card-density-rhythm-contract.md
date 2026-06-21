# LoveBud Browse ↔ My Trees Card Density & Empty-State Rhythm Contract

Refs #2703, Step 2 follow-up (view-mode parity)

## 1. Motivation

To maintain layout harmony and visual containment across **Browse** and **My Trees** pages without forcing identical cards redesign (retaining card visual distinctiveness based on their context roles).

Browse cards are designed as "Appreciation/Discovery Cards", while My Trees cards represent "Owner Dashboard Management Cards". This contract locks down spacing bounds, layout grids, token constants, and empty-state rhythm parameters to prevent design discrepancies.

---

## 2. Grid & Density Constants

Browse and My Trees align card grid layouts on desktop using the following parameters:
* **My Trees `.trees-grid`**: Arranged as a 2-column desktop grid with a `gap: var(--lovetree-card-grid-gap)` (24px) layout rhythm.
* **Browse List Layout**: Utilizes its own list density layout rules.
* **Hardcoded density values**: Hardcoded density parameters (e.g. My Trees grid gap, Browse card height/padding) are now routed through shared density tokens defined in `css/global/tokens.css`.
* **Card Corner Radius** (after PR #2765, both pages align):
  * Browse uses `--lovetree-card-radius-lg` (1.85rem) or `--radius-lg` (2rem).
  * My Trees uses `--lovetree-card-radius-lg` (1.85rem) — unified with Browse.
* **Card Shadows**:
  * Hover: `--lovetree-card-shadow-hover`
  * Active/Selected ring: `--lovetree-card-ring-active`
  * Active/Selected shadow: `--lovetree-card-shadow-active`

---

## 3. Empty-State Visual Standards

Both Browse and My Trees share common token geometry for their empty state/error states:
* **Surface Background**: `--lovetree-empty-state-surface`
* **Border Lines**: `--lovetree-empty-state-border`
* **Corner Radius**: `--lovetree-empty-state-radius`
* **Card Shadows**: `--lovetree-empty-state-shadow`
* **Text/Heading Colors**: `--lovetree-empty-state-text` / `--lovetree-empty-state-heading-text`
* **Icon Color/Opacity**: `--lovetree-empty-state-icon-color` / `--lovetree-empty-state-icon-opacity`

*Visual copy/text remains page-specific to preserve different contexts.*

---

## 4. Constraint Boundaries

* **No Forced Redesign**: Card layouts remain unique to their pages, but height is now unified.
* **Unified Card Height**: After PR #2765, both Browse and My Trees `.tree-card` use `height: var(--lovetree-card-media-height-browse)` (336px). The legacy `--lovetree-card-media-height-mytrees: 184px` token was removed because it was no longer referenced after the height unification.
* **No DOM/JS logic changes**: Card renderer and interactions are untouched.
* **No 3D/Orbit logic**: No WebGL or orbit visual assets are included.
* **Scout Invariance**: No changes to Scout AI features.
* **Production Activation remains BLOCKED**: The production release remains blocked.

---

## 5. View-Mode Parity (Step 2 follow-up)

The shared `css/tree-view-mode.css` provides three user-selectable view modes
(`large`, `compact`, `list`) for both pages. The following invariants are
locked by `tests/contracts/tree-view-mode-parity-contract.test.cjs`:

### 5.1 Per-mode gap values are token-driven

| Mode | Browse `#resultsList` | My Trees `.trees-grid` | Token |
|---|---|---|---|
| `large` (default desktop) | 24px | 24px | `var(--lovetree-card-grid-gap)` |
| `compact` (default desktop) | 18px | 18px | `var(--lovetree-card-grid-gap-compact)` |
| `list` (desktop) | 14px | 14px | (compact-stacked rhythm, kept narrow) |

### 5.2 Mobile compact breakpoint is identical

Both pages collapse `compact` from 3-col to 2-col at `max-width: 640px`, with
`min-height: 260px` enforced on `.tree-card` for stable card heights.

### 5.3 List mode parity on class-name divergence

Browse uses `.tree-card-media` / `.tree-card-body`; My Trees uses
`.tree-card-thumb` / `.tree-card-info`. The list-mode rules in
`css/tree-view-mode.css` must apply to **both** inner class names so the
visual outcome is identical:
* List-mode `border-radius: var(--lovetree-card-radius-lg) 0 0 var(--lovetree-card-radius-lg)` is applied to **both** `.tree-card-media` and `.tree-card-thumb` selectors.
* List-mode `padding: 14px 16px` is applied to **both** `.tree-card-body` and `.tree-card-info` selectors.
* Stacked list (≤480px) `border-radius: var(--lovetree-card-radius-lg) var(--lovetree-card-radius-lg) 0 0` applies to both selectors.

### 5.4 Intentional divergences (NOT parity violations)

* **Default mode per page**: Browse defaults to `compact` (storageKey
  `lovebud:browse:viewMode`), My Trees defaults to `large` (storageKey
  `lovebud:myTrees:viewMode`). Locked by
  `tests/contracts/tree-view-mode-switcher-contract.test.cjs`.
* **Compact-mode card size on My Trees**: My Trees compact mode applies
  page-local overrides to make cards visually smaller (`.tree-card-thumb
  { height: 140px; padding: 12px }`, `.tree-card-info { padding: 12px }`,
  `.tree-card-title { font-size: 0.95rem }`). Browse compact inherits base
  card sizing. This is documented as an intentional asymmetry in §1.
