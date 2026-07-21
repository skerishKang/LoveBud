# LoveBud Browse ↔ My Trees Card Density & Empty-State Rhythm Contract

Refs #2703, Step 2 follow-up (view-mode parity)

## 1. Motivation

To maintain layout harmony and visual containment across **Browse** and **My Trees** pages as one appreciation-first LoveTree card family.

> **#3608 Phase 1 (2026-07-21) — contract revision**
>
> **Retired (obsolete):** Browse = Appreciation/Discovery Card vs My Trees =
> Owner Dashboard Management Card as a reason for *default density* or
> *compact geometry* divergence. That framing produced intentional compact
> asymmetry (My Trees smaller thumbs / auto height) which is **discarded**.
>
> **Current:** Browse and My Trees are appreciation-first canonical cards.
> Empty/invalid storage → both default to **compact**. Valid saved
> `large`/`list` preferences remain per-page and independent. Compact core
> geometry is **identical** across surfaces. Surface extensions
> (Browse public tags, My Trees visibility icon / selection) stay inside
> shared slots. **large/list geometry convergence is Phase 2.**

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
| `large` (user preference) | 24px | 24px | `var(--lovetree-card-grid-gap)` |
| `compact` (**default** when storage empty/invalid) | 18px | 18px | `var(--lovetree-card-grid-gap-compact)` |
| `list` (user preference) | 14px | 14px | (compact-stacked rhythm, kept narrow) |

### 5.2 Mobile compact breakpoint is identical

Both pages collapse `compact` from 3-col to 2-col at `max-width: 640px`
(card height 280px / media 90px) and keep 2-col at `max-width: 480px`
(card height 260px / media 80px / gap 10px). Core compact geometry is
shared via combined selectors in `css/tree-view-mode.css`.

### 5.3 List mode parity on class-name divergence

Browse uses `.tree-card-media` / `.tree-card-body`; My Trees may still use
`.tree-card-thumb` / `.tree-card-info` under the shared media wrapper. The
list-mode rules in `css/tree-view-mode.css` must apply to **both** inner
class names so the visual outcome is identical:
* List-mode `border-radius: var(--lovetree-card-radius-lg) 0 0 var(--lovetree-card-radius-lg)` is applied to **both** `.tree-card-media` and `.tree-card-thumb` selectors.
* List-mode `padding: 14px 16px` is applied to **both** `.tree-card-body` and `.tree-card-info` selectors.
* Stacked list (≤480px) `border-radius: var(--lovetree-card-radius-lg) var(--lovetree-card-radius-lg) 0 0` applies to both selectors.

### 5.4 Defaults and compact geometry (#3608 Phase 1)

* **Default mode (empty / invalid storage):** Browse and My Trees both use
  `defaultMode: 'compact'` (storage keys remain independent:
  `lovebud:browse:viewMode`, `lovebud:myTrees:viewMode`). Valid saved
  `large` / `list` / `compact` values are **not** rewritten.
* **Compact core geometry is identical** on both surfaces (card height,
  media height, body padding/rows/gap, title/subtitle typography). Owned
  by combined `#resultsList` + `.trees-grid` compact selectors in
  `css/tree-view-mode.css`.
* **Obsolete compact asymmetry (discarded):** My Trees-only compact rules
  that forced `thumb height: 140px`, `padding: 12px`, `title font-size:
  0.95rem`, and mobile `height: auto` / `min-height: 240px` are removed.
  Those rules encoded the retired “owner dashboard smaller card” premise.
* **large / list geometry convergence:** deferred to #3608 Phase 2. Phase 1
  only guarantees preferences still switch modes without forcing compact.
* **Surface extensions (allowed differences):** Browse public metadata/tags;
  My Trees public/private visibility icon + selected-card + hub selection.
  Extensions must stay inside shared slots and must not break compact
  media/title/footer/CTA alignment.

## 6. Card Surface Parity (Step 4 follow-up)

After Step 4, both Browse and My Trees cards share the same surface
treatment (warm gradient + heavy raised box-shadow + accent ::before /
::after bars + lift on hover). The legacy divergence ("Browse keeps its
warm gradient feel. My Trees keeps its stable surface") is retired.

Locked by `tests/contracts/card-surface-parity-contract.test.cjs`:

* **Surface**: Both pages use `var(--lovetree-card-surface-browse)` (warm
  radial+linear gradient) for the base card background. My Trees must
  **not** use `var(--lovetree-soft-surface)` for the card itself.
* **Box-shadow**: Both pages use the same heavy raised box-shadow
  (`0 20px 48px rgba(75, 64, 57, 0.1)` + inset) for the base card.
  The lighter `var(--lovetree-card-shadow)` token is retained for
  empty-state and hub usage where a flatter surface is preferred.
* **Accent bars**: Both pages define `.tree-card::before` (top accent)
  and `.tree-card::after` (right accent), visible on hover/selected.
* **Hover**: Both pages lift the card by `translateY(-3px)` and switch
  to the Browse-style hover shadow + inset ring.
* **Selected state**: Both pages use the same active gradient background
  + active shadow + ring, and the open-link button darkens to
  `rgba(144, 73, 81, 0.92)` background with `--surface-container-lowest`
  text.
