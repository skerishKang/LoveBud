# LoveBud Browse ↔ My Trees Card Density & Empty-State Rhythm Contract

Refs #2703

## 1. Motivation

To maintain layout harmony and visual containment across **Browse** and **My Trees** pages without forcing identical cards redesign (retaining card visual distinctiveness based on their context roles).

Browse cards are designed as "Appreciation/Discovery Cards", while My Trees cards represent "Owner Dashboard Management Cards". This contract locks down spacing bounds, layout grids, token constants, and empty-state rhythm parameters to prevent design discrepancies.

---

## 2. Grid & Density Constants

Browse and My Trees align card grid layouts on desktop using the following parameters:
* **My Trees `.trees-grid`**: Arranged as a 2-column desktop grid with a `gap: var(--lovetree-card-grid-gap)` (24px) layout rhythm.
* **Browse List Layout**: Utilizes its own list density layout rules.
* **Hardcoded density values**: Hardcoded density parameters (e.g. My Trees grid gap, Browse card height/padding) are now routed through shared density tokens defined in `css/global/tokens.css`.
* **Card Corner Radius**:
  * My Trees uses `--lovetree-card-radius` (16px) or `--radius-default` (1rem).
  * Browse uses `--lovetree-card-radius-lg` (1.85rem) or `--radius-lg` (2rem).
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

* **No Forced Redesign**: Card layouts remain unique to their pages (Browse height: 336px; My Trees height: flow/variable).
* **No DOM/JS logic changes**: Card renderer and interactions are untouched.
* **No 3D/Orbit logic**: No WebGL or orbit visual assets are included.
* **Scout Invariance**: No changes to Scout AI features.
* **Production Activation remains BLOCKED**: The production release remains blocked.
