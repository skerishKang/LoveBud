# LoveBud Shared Page Shell Contract

Refs #2698

## 1. Motivation

To prevent continuous drift of layout systems across key pages (Home, Browse, My Trees) and maintain brand consistency, this document defines the layout contract.

Historically, pages were developed separately, leading to:
* Different spacing variables.
* Drift in layout grid specifications.
* Inconsistent mobile responsiveness boundaries.

This contract locks down the common structure, CSS layout metrics, and grid configurations.

---

## 2. Current Page Structures

### A. Home (Landing Page)
* **Shell wrapper**: `.home-v3-shell`
* **Main container**: `.home-v3-main`
* **Hero banner section**: `.home-v3-hero`
* **Text/heading details**: `.home-v3-copy`
* **Layout preview Collage/Grid**: `.home-v3-collage`

### B. Browse (Search Curation)
* **Shell wrapper / container**: `main.search-container`
* **Main content area (left)**: `section` inside container
* **Hero title section**: `.browse-curation-shell`
* **Search / Filter control row**: `.browse-utility-row`
* **Results sub-header**: `.browse-results-head`
* **Appreciation hub sidebar (right)**: `aside.preview-sidebar`

### C. My Trees (Dashboard)
* **Outer content area**: `main.my-trees-content`
* **Shell wrapper / container**: `.my-trees-with-hub`
* **Main content area (left)**: `section.my-trees-main-column`
* **Search / Filter control row**: `section#myTreesFinder` (also known as `.my-trees-finder`)
* **Results sub-header**: `.my-trees-results-head`
* **Appreciation hub sidebar (right)**: `aside.my-trees-hub-panel`

---

## 3. Shared Shell Vocabulary

1. **page shell**: The outermost wrapper managing maximum page width and margins.
2. **hero/header block**: Title, subcopy, and visual context intro section.
3. **utility/search/filter row**: The horizontal controls for keyword matching and categorization chips.
4. **results/list header row**: Small header containing item count details, order sorting dropdown, and view layout switcher mounts.
5. **main content column**: Left-aligned primary flow list.
6. **right rail / appreciation hub / preview hub**: The sidebar component (fixed or sticky) on desktop displaying selected tree detail/previews.
7. **mobile single-column fallback**: Responsive layout collapsing two columns into one vertical stack.

---

## 4. CSS Ownership Rules

* **Shared Design Tokens**: Global visual constants (page padding, layout widths, common element radii) must reside in `css/global/tokens.css`.
  * Key tokens include:
    * `--page-shell-max`
    * `--page-pad-desktop`
    * `--page-pad-tablet`
    * `--page-pad-mobile`
    * `--hero-gap`
    * `--hero-title-size`
    * `--eyebrow-radius`
    * `--lovetree-card-radius-lg`
* **Geometry Alignment**: Right rail geometry of Browse and My Trees must remain aligned in desktop width using:
  * `grid-template-columns: minmax(0, 1fr) minmax(360px, 400px)`
  * `gap: 28px`
* **Home Page Style Parity**: The Home page landing layout is visually distinct but must share core page margins and sizing metrics where possible.
* **Editor Exclusion**: The Editor interface behaves as a specialized canvas workbench app and is excluded from the calm document page layout rules.

---

## 5. Scope Guardrails

* **No 3D/Orbit Implementation**: No 3D orbit viewer support is implemented in this contract slice.
* **No Runtime Logic changes**: Planning/contract definitions only.
* **No Full CSS Refactor**: Keeps existing stylesheets intact without rewriting classes.
* **No Scout modifications**: Scout AI helper components and configs must not be touched.
* **Production Activation remains BLOCKED**: The production release triggers remain untouched.
