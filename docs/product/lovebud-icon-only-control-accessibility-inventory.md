# LoveBud Icon-Only Control Accessibility Inventory

## Status and scope
* **Status**: Initial static-code inventory. It covers verified representative active controls and identifies controls requiring runtime/browser verification before route-wide remediation.
* **Scope**: Verified representative controls across active routes.

## Audit method and inclusion rules
* **Audit Method**: Scanning routes and source markup for interactive tags (`<button>`, `<a>`, `<div role="button">`) containing only raw icons/glyphs (SVG, Material Symbols) with no visible companion text.
* **Inclusion Rules**: Every control is categorized by route, stable identifier, visual purpose, current name source, role, state semantics, keyboard/focus behaviors, ownership boundaries, and final disposition.
* **Announce Rule**: Raw icon glyphs are not recognized as accessible names. Decorative/non-interactive SVG/images within parent controls must not be announced to avoid duplicate screen reader announcements.

## Home
* **Needs runtime/browser verification**:
  * Theme toggle / settings trigger: Candidate selector `#settingsBtn` (potentially located in custom layout branches or header files but not found in `index.html` main body). Must be verified dynamically.

## Browse and Search
* **Control 1**: Mobile Preview Close Button.
  * Selector: `#previewMobileClose`
  * Exact file path: `pages/search.html`
  * Visual purpose: Close mobile preview bottom drawer/sheet
  * Current accessible name: `aria-label="감상 닫기"` from markup.
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Standard click handler
  * Focus behavior evidence: Standard focus outline
  * Ownership: Browse page controllers
  * Disposition: `compliant` for accessible-name coverage. Optional future visual-copy review is out of scope; do not rank this as a remediation candidate.

* **Needs runtime/browser verification**:
  * Share/Copy link button: Candidate selector `.btn-preview-share` or `.share-copy-trigger`. Must be verified at runtime to ensure exact template location.

## My Trees
* **Control 1**: Modal Close Button in Create Tree Modal.
  * Selector: `#createTreeModalCloseBtn`
  * Exact file path: `pages/my-trees.html`
  * Visual purpose: Close the tree creation modal
  * Current accessible name: `aria-label="닫기"` from markup.
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Standard click handler
  * Focus behavior evidence: Standard focus outline
  * Ownership: My Trees page controllers
  * Disposition: `compliant` for accessible-name coverage. Focus restoration logic is needed (focus lost upon modal close).

* **Control 2**: Modal Close Button in My Trees Hub Panel.
  * Selector: `#myTreesHubClose`
  * Exact file path: `pages/my-trees.html`
  * Visual purpose: Close mobile/desktop preview hub sidebar
  * Current accessible name: `aria-label="닫기"` from markup.
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Standard click handler
  * Focus behavior evidence: Standard focus outline
  * Ownership: My Trees page controllers
  * Disposition: `compliant` for accessible-name coverage.

* **Needs runtime/browser verification**:
  * Tree Card Action Button: Candidate selector `.tree-card-actions-trigger`.

## Editor
* **Control 1**: Canvas zoom in button.
  * Selector: `#zoomInCanvasBtn`
  * Exact file path: `js/editor/templates/editor-canvas-topbar-template.js`
  * Visual purpose: Zoom in canvas view
  * Current accessible name: `aria-label="확대"` from markup.
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Keydown listener on canvas container
  * Focus behavior evidence: Standard focus outline
  * Ownership: Canvas toolbar / Editor toolbar
  * Disposition: `compliant` for accessible-name coverage. State indicator alerts (max zoom limit hit) are needed.

* **Control 2**: Canvas zoom out button.
  * Selector: `#zoomOutCanvasBtn`
  * Exact file path: `js/editor/templates/editor-canvas-topbar-template.js`
  * Visual purpose: Zoom out canvas view
  * Current accessible name: `aria-label="축소"` from markup.
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Keydown listener on canvas container
  * Focus behavior evidence: Standard focus outline
  * Ownership: Canvas toolbar / Editor toolbar
  * Disposition: `compliant` for accessible-name coverage. State indicator alerts (min zoom limit hit) are needed.

* **Control 3**: Floating Toolbar More Button.
  * Selector: `#ftbMoreBtn`
  * Exact file path: `js/editor/templates/editor-floating-toolbar-template.js`
  * Visual purpose: Toggle overflow action menu
  * Current accessible name: `aria-label="더 보기"` from markup.
  * Role: `button`
  * State semantics: `aria-expanded="false"`, `aria-haspopup="true"` (toggled dynamically via `js/editor/editor-floating-toolbar-dropdown.js`)
  * Keyboard behavior: Roving focus navigation (arrows) implemented in `js/editor/editor-floating-toolbar-keyboard.js`
  * Focus behavior evidence: Standard focus outline
  * Ownership: Editor toolbar controllers
  * Disposition: `compliant` for accessible-name coverage. Lack of `aria-controls` linking to `#ftbDropdown` needs correction.

* **Control 4**: Floating Toolbar Scout Action item.
  * Selector: `#ftbScoutAction`
  * Exact file path: `js/editor/templates/editor-floating-toolbar-template.js`
  * Visual purpose: Trigger Scout save action
  * Current accessible name: `aria-label="Scout로 순간 저장"` from markup.
  * Role: `menuitem`
  * State semantics: None
  * Keyboard behavior: Handles click
  * Focus behavior evidence: Standard focus outline
  * Ownership: Editor toolbar controllers
  * Disposition: `compliant`

* **Control 5**: Floating Toolbar Delete Action item.
  * Selector: `#ftbDeleteAction`
  * Exact file path: `js/editor/templates/editor-floating-toolbar-template.js`
  * Visual purpose: Delete current node
  * Current accessible name: `aria-label="순간 삭제"` from markup.
  * Role: `menuitem`
  * State semantics: None
  * Keyboard behavior: Delete/Backspace shortcut
  * Focus behavior evidence: Standard focus outline
  * Ownership: Editor toolbar controllers
  * Disposition: `compliant`

* **Control 6**: Floating Toolbar Share Action item.
  * Selector: `#ftbShareAction`
  * Exact file path: `js/editor/templates/editor-floating-toolbar-template.js`
  * Visual purpose: Copy node link
  * Current accessible name: `aria-label="링크 복사"` from markup.
  * Role: `menuitem`
  * State semantics: None
  * Keyboard behavior: Handles click
  * Focus behavior evidence: Standard focus outline
  * Ownership: Editor toolbar controllers
  * Disposition: `compliant`

* **Control 7**: Floating Toolbar Focus Action item.
  * Selector: `#ftbFocusAction`
  * Exact file path: `js/editor/templates/editor-floating-toolbar-template.js`
  * Visual purpose: Focus view on selected node
  * Current accessible name: `aria-label="선택한 순간 보기"` from markup.
  * Role: `menuitem`
  * State semantics: None
  * Keyboard behavior: Handles click
  * Focus behavior evidence: Standard focus outline
  * Ownership: Editor toolbar controllers
  * Disposition: `compliant`

## Viewer
* **Needs runtime/browser verification**:
  * Audio toggle button: Candidate selector `#btnAudioToggle`. Must be verified at runtime to ensure dynamic DOM mount logic.
  * Viewer Close Button: Candidate selector `.viewer-close-btn`.

## Authentication and shared overlays
* **Control 1**: Email Auth Modal Close Button.
  * Selector: `#email-auth-close`
  * Exact file path: `pages/login.html`
  * Visual purpose: Dismiss email login dialog
  * Current accessible name: `aria-label="모달 닫기"` from markup.
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Standard click handler
  * Focus behavior evidence: Standard focus outline
  * Ownership: Auth shared overlay
  * Disposition: `compliant`

* **Needs runtime/browser verification**:
  * Shared header mobile overlay close: Candidate selector `.shared-header-mobile-close`.

## Representative mobile surfaces
* **Needs runtime/browser verification**:
  * Drawer collapse handlebar button: Candidate selector `.drawer-handle-bar`.

## Findings by disposition
* **compliant**: `#previewMobileClose`, `#createTreeModalCloseBtn`, `#myTreesHubClose`, `#zoomInCanvasBtn`, `#zoomOutCanvasBtn`, `#ftbMoreBtn`, `#ftbScoutAction`, `#ftbDeleteAction`, `#ftbShareAction`, `#ftbFocusAction`, `#email-auth-close`.
* **remediation-needed (structural improvements)**: `#zoomOutCanvasBtn` (state alert missing), `#zoomInCanvasBtn` (state alert missing), `#ftbMoreBtn` (`aria-controls` missing), `#createTreeModalCloseBtn` (focus restoration missing).

## Protected and delegated ownership
* #3073 provides completed toolbar-accessibility evidence only.
* New icon-control remediation identified by this audit remains owned by #3121 unless it falls under a protected boundary.
* First-moment activation guidance is outside this audit and remains under #2977 / #2965.
* **Contrast and Semantics**: Image accessibility and visual contrast are delegated to #3006.
* **Mobile Shell and Canvas**: Mobile touch handling and canvas bounds are delegated to #3072.
* **Protected Audits**: Issues #2972, #2976, #2960, and #2856 are strictly protected and no-touch boundaries.

## Ranked remediation candidates
1. **Candidate 1: Canvas Zoom Controls (`#zoomOutCanvasBtn` / `#zoomInCanvasBtn`)**
   * Selector: `#zoomOutCanvasBtn` / `#zoomInCanvasBtn`
   * Exact file path: `js/editor/templates/editor-canvas-topbar-template.js` & `js/viewer/public-viewer-canvas-topbar-template.js`
   * Current evidence: Has localized `aria-label="축소"` and `aria-label="확대"` attributes, but lacks explicit dynamic live region announcements or screen-reader instructions when zoom limits (max/min zoom) are reached.
   * Specific minimal remediation: Update `aria-disabled` state dynamically when limits are hit, and trigger live region readouts.
   * Focused contract test requirement: Test script should assert `#zoomOutCanvasBtn` and `#zoomInCanvasBtn` exist in templates.
   * Protected/delegated boundary: No protected/delegated boundary violated; not under #2972, #2976, #2960, #2856, #3073, #3006, #3072, #2977, or #2965.

2. **Candidate 2: Floating Toolbar More Button (`#ftbMoreBtn`)**
   * Selector: `#ftbMoreBtn`
   * Exact file path: `js/editor/templates/editor-floating-toolbar-template.js`
   * Current evidence: Has `aria-expanded="false"`, `aria-haspopup="true"` and `aria-label="더 보기"`, but lacks `aria-controls="ftbDropdown"` to establish menu parent-child ownership, and does not automatically focus the first menu item when expanded.
   * Specific minimal remediation: Add `aria-controls="ftbDropdown"` to the markup and update dropdown focus management to place focus on `#ftbScoutAction` on expand.
   * Focused contract test requirement: Test script should assert `#ftbMoreBtn` exists in floating toolbar template.
   * Protected/delegated boundary: No protected/delegated boundary violated; not under #2972, #2976, #2960, #2856, #3073, #3006, #3072, #2977, or #2965.

3. **Candidate 3: Create Tree Modal Close Button (`#createTreeModalCloseBtn`)**
   * Selector: `#createTreeModalCloseBtn`
   * Exact file path: `pages/my-trees.html`
   * Current evidence: Has `aria-label="닫기"`, but when the modal is closed by this button, visual focus is lost rather than returned to the initiating trigger element (`#createTreeBtn` or `#headerCreateTreeBtn`), causing screen readers to reset focus to the top of the document.
   * Specific minimal remediation: Add focus restoration logic in modal hide handler to return focus to the active trigger.
   * Focused contract test requirement: Test script should assert `#createTreeModalCloseBtn` exists in `pages/my-trees.html`.
   * Protected/delegated boundary: No protected/delegated boundary violated; not under #2972, #2976, #2960, #2856, #3073, #3006, #3072, #2977, or #2965.

## Regression coverage requirements
* **Visual Representation Rules**: Decorative icons inside button controls must have `aria-hidden="true"`.
* **Accessible Name Verification**: Test scripts must verify that interactive icon-only elements have non-empty accessible name attributes (`aria-label` or `aria-labelledby`).
* **Semantic States Verification**: Controls that expand or toggle must reflect state updates in their accessibility attributes.

## Explicit non-goals
* No HTML, JavaScript, CSS, API, data-model, schema, migration, deployment, Scout, or authentication-policy change in this audit slice.
* No bulk aria-label edit without route-local evidence and focused regression coverage.

## References
* Refs #3121
* Refs #3073
* Refs #3006
* Refs #3072
* Refs #2977
* Refs #2965
* Refs #2972
* Refs #2976
* Refs #2960
* Refs #2856
* Refs #1882
