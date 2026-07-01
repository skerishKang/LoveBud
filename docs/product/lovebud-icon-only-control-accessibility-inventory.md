# LoveBud Icon-Only Control Accessibility Inventory

## Status and scope
* **Status**: Proposed/Planning Audit (No active code implementation in UI, API, or database schema has been introduced in this slice).
* **Scope**: This document maps, categorizes, and audits active interactive icon-only controls across the entire LoveBud codebase (Home, Browse/Search, My Trees, Editor, Viewer, Authentication, shared overlays, and mobile surfaces).

## Audit method and inclusion rules
* **Audit Method**: Scanning routes and source markup for interactive tags (`<button>`, `<a>`, `<div role="button">`) containing only raw icons/glyphs (SVG, Material Symbols) with no visible companion text.
* **Inclusion Rules**: Every control is categorized by route, stable identifier, visual purpose, current name source, role, state semantics, keyboard/focus behaviors, ownership boundaries, and final disposition.
* **Announce Rule**: Raw icon glyphs are not recognized as accessible names. Decorative/non-interactive SVG/images within parent controls must not be announced to avoid duplicate screen reader announcements.

## Home
* **Control**: Theme toggle or settings button in main header (if present as icon-only).
  * DOM selector: `#settingsBtn` (if icon-only)
  * Visual purpose: Toggle settings drawer
  * Accessible name source: `aria-label` or raw Material glyph
  * Role: `button`
  * State semantics: `aria-expanded` (missing in current state)
  * Keyboard behavior: Toggles via enter/space keys
  * Focus behavior evidence: Standard outline
  * Ownership: Shared Header
  * Disposition: `missing state semantics`

## Browse and Search
* **Control 1**: Mobile Preview Close Button.
  * DOM selector: `#previewMobileClose`
  * Visual purpose: Close mobile preview bottom drawer/sheet
  * Accessible name source: None (Missing accessible name, announces raw text glyph "close")
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Standard click handler
  * Focus behavior evidence: Highlighted focus ring
  * Ownership: Browse page controllers
  * Disposition: `missing name`

* **Control 2**: Share/Copy link button.
  * DOM selector: `.btn-preview-share` or `.share-copy-trigger`
  * Visual purpose: Copy public tree URL
  * Accessible name source: Announces raw icon glyph "share"
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Standard click handler
  * Focus behavior evidence: Outline focus
  * Ownership: Browse page controllers
  * Disposition: `missing name`

## My Trees
* **Control 1**: Modal Close Button in Create Tree Modal.
  * DOM selector: `#createTreeModalCloseBtn`
  * Visual purpose: Close the tree creation modal
  * Accessible name source: `aria-label="닫기"` (Verbatim "닫기" found in `my-trees.html` line 116)
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Standard click handler (toggles display state)
  * Focus behavior evidence: Outlined focus ring
  * Ownership: My Trees page controllers
  * Disposition: `compliant`

* **Control 2**: Tree Card Action Button (Edit/Delete dropdown trigger).
  * DOM selector: `.tree-card-actions-trigger`
  * Visual purpose: Open the contextual actions menu for a specific tree
  * Accessible name source: Raw glyph "more_vert"
  * Role: `button`
  * State semantics: `aria-haspopup="menu"`, `aria-expanded` (missing)
  * Keyboard behavior: Missing arrow key navigation support
  * Focus behavior evidence: Outlined focus
  * Ownership: My Trees page controllers
  * Disposition: `missing state semantics`

## Editor
* **Control 1**: Canvas zoom in button.
  * DOM selector: `#btnZoomIn`
  * Visual purpose: Zoom in canvas view
  * Accessible name source: Raw glyph "zoom_in"
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Standard click handler
  * Focus behavior evidence: Focus outline
  * Ownership: Canvas toolbar / Editor toolbar
  * Disposition: `missing name`

* **Control 2**: Canvas zoom out button.
  * DOM selector: `#btnZoomOut`
  * Visual purpose: Zoom out canvas view
  * Accessible name source: Raw glyph "zoom_out"
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Standard click handler
  * Focus behavior evidence: Focus outline
  * Ownership: Canvas toolbar / Editor toolbar
  * Disposition: `missing name`

## Viewer
* **Control 1**: Audio toggle button.
  * DOM selector: `#btnAudioToggle`
  * Visual purpose: Mute/unmute video background track
  * Accessible name source: Raw glyph "volume_up" or "volume_off"
  * Role: `button`
  * State semantics: `aria-pressed` (missing or dynamic text only)
  * Keyboard behavior: Keydown handlers bound
  * Focus behavior evidence: Standard focus ring
  * Ownership: Viewer shell controllers
  * Disposition: `missing state semantics`

* **Control 2**: Viewer Close Button.
  * DOM selector: `.viewer-close-btn`
  * Visual purpose: Exit player/viewer
  * Accessible name source: Raw glyph "close"
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Standard escape/click triggers
  * Focus behavior evidence: Outlined focus
  * Ownership: Viewer shell controllers
  * Disposition: `missing name`

## Authentication and shared overlays
* **Control 1**: Close button for the global shared header mobile overlay.
  * DOM selector: `.shared-header-mobile-close`
  * Visual purpose: Dismiss hamburger menu
  * Accessible name source: Raw icon glyph
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Keyboard triggers dismissed
  * Focus behavior evidence: Standard outline
  * Ownership: Shared Header Mobile Overlay
  * Disposition: `missing name`

## Representative mobile surfaces
* **Control 1**: Drawer collapse handlebar button.
  * DOM selector: `.drawer-handle-bar`
  * Visual purpose: Toggle preview sheet drawer height
  * Accessible name source: None (Decorative icon)
  * Role: `button` (rendered as `div` without aria-role)
  * State semantics: Missing `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
  * Keyboard behavior: Unreachable via keyboard navigation
  * Focus behavior evidence: No focus outline, tab-index -1
  * Ownership: Mobile Preview Controllers
  * Disposition: `focus issue`

## Findings by disposition
* **compliant**: `#createTreeModalCloseBtn` (My Trees).
* **missing name**: `#previewMobileClose`, `.btn-preview-share`, `#btnZoomIn`, `#btnZoomOut`, `.viewer-close-btn`, `.shared-header-mobile-close`.
* **misleading name**: None.
* **missing state semantics**: `#settingsBtn` (Home), `.tree-card-actions-trigger` (My Trees), `#btnAudioToggle` (Viewer).
* **focus issue**: `.drawer-handle-bar` (Mobile surfaces).
* **decorative/non-interactive**: Decorative background SVGs on the growth stage tree structure page.

## Protected and delegated ownership
* **Toolbar Clarity Boundary**: Toolbar accessibility improvements from `#3073` are referred to as existing evidence.
* **Contrast and Semantics**: Image accessibility and visual contrast are delegated to `#3006`.
* **Mobile Shell and Canvas**: Mobile touch handling and canvas bounds are delegated to `#3072`.
* **Protected Audits**: Issues `#2972`, `#2976`, `#2960`, and `#2856` are strictly protected and no-touch boundaries.

## Ranked remediation candidates
1. **Candidate 1: Mobile Preview Close Button (`#previewMobileClose` / Search)**
   * Route/File: `pages/search.html` & `js/search/index.js`
   * Remedy: Add `aria-label="미리보기 닫기"` and ensure the child glyph tag has `aria-hidden="true"`.
   * Required Test: Assert selector `#previewMobileClose` has exact `aria-label` attribute and no screen reader text collision.
2. **Candidate 2: Canvas Zoom Controls (`#btnZoomIn` / `#btnZoomOut` / Editor)**
   * Route/File: `pages/editor.html`
   * Remedy: Add `aria-label="확대"`, `aria-label="축소"`.
   * Required Test: Assert zoom selectors exist and possess localized accessible name values.
3. **Candidate 3: Audio Toggle Button (`#btnAudioToggle` / Viewer)**
   * Route/File: `pages/view.html` or `public-tree-viewer-shell.html`
   * Remedy: Introduce `aria-label="오디오 켜기/끄기"` and dynamic `aria-pressed` attributes.
   * Required Test: Assert dynamic changes update ARIA attributes cleanly.

## Regression coverage requirements
* **Visual Representation Rules**: Decorative icons inside button controls must have `aria-hidden="true"`.
* **Accessible Name Verification**: Test scripts must verify that interactive icon-only elements have non-empty accessible name attributes (`aria-label` or `aria-labelledby`).
* **Semantic States Verification**: Controls that expand or toggle must reflect state updates in their accessibility attributes.

## Explicit non-goals
* No UI tag click handler, layout modifications, or style sheet rewrites.
* No API endpoint parameters, database query filtering, or database schema additions.
* No Scout token configuration, live Firebase, or provider credentials verification.
* No active code modification inside workspace HTML, JS, or CSS files.

## References
* Refs #3121 (A11y icon audit contract)
* Refs #3073 (Toolbar clarity evidence)
* Refs #3006 (Contrast ownership boundary)
* Refs #3072 (Mobile shell canvas behavior)
* Refs #2972 (Protected context)
* Refs #2976 (Protected context)
* Refs #2960 (Protected context)
* Refs #2856 (Protected context)
* Refs #1882 (Browse URL state context)
