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
  * `#settingsBtn` (Home settings trigger / settings menu toggle)

## Browse and Search
* **Control 1**: Mobile Preview Close Button.
  * Selector: `#previewMobileClose`
  * Exact file path: `pages/search.html`
  * Visual purpose: Close mobile preview bottom drawer/sheet
  * Current accessible name: `aria-label="감상 닫기"` from markup.
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Standard click handler
  * Focus behavior evidence: Restores scroll via `js/search/search-mobile-preview-sheet.js` but lacks opener/selected card focus restoration.
  * Ownership: Browse page controllers
  * Disposition: `compliant` for accessible-name coverage. Focus restoration candidate.

## My Trees
* **Control 1**: Modal Close Button in Create Tree Modal.
  * Selector: `#createTreeModalCloseBtn`
  * Exact file path: `pages/my-trees.html`
  * Visual purpose: Close the tree creation modal
  * Current accessible name: `aria-label="닫기"` from markup.
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Standard click handler
  * Focus behavior evidence: Focus restoration is handled in `js/my-trees/my-trees-actions.js` where `modal.lastFocusedEl = document.activeElement` is saved on open and `restoreTarget.focus()` is called on close before `aria-hidden` is applied.
  * Ownership: My Trees page controllers
  * Disposition: `compliant`

* **Control 2**: Modal Close Button in My Trees Hub Panel.
  * Selector: `#myTreesHubClose`
  * Exact file path: `pages/my-trees.html`
  * Visual purpose: Close mobile/desktop preview hub sidebar
  * Current accessible name: `aria-label="닫기"` from markup.
  * Role: `button`
  * State semantics: None
  * Keyboard behavior: Click handler bound to close sheet
  * Focus behavior evidence: `js/my-trees/my-trees-mobile-preview-sheet.js` closeMobilePreview resets state, but lacks trigger focus restoration.
  * Ownership: My Trees page controllers
  * Disposition: `compliant` for accessible-name coverage. Focus restoration candidate.

## Editor
* **Control 1**: Canvas zoom in button.
  * Selector: `#zoomInCanvasBtn`
  * Exact file path: `js/editor/templates/editor-canvas-topbar-template.js`
  * Visual purpose: Zoom in canvas view
  * Current accessible name: `aria-label="확대"` from markup.
  * Role: `button`
  * State semantics: Dynamic text updating on the sibling `#zoomIndicator` which has `aria-live="polite"` defined in the markup.
  * Keyboard behavior: standard click updates zoom
  * Focus behavior evidence: `updateZoomIndicator()` in `js/editor/editor-canvas-viewport-controls.js` updates current percentage.
  * Ownership: Canvas toolbar / Editor toolbar
  * Disposition: `compliant`

* **Control 2**: Canvas zoom out button.
  * Selector: `#zoomOutCanvasBtn`
  * Exact file path: `js/editor/templates/editor-canvas-topbar-template.js`
  * Visual purpose: Zoom out canvas view
  * Current accessible name: `aria-label="축소"` from markup.
  * Role: `button`
  * State semantics: Dynamic text updating on the sibling `#zoomIndicator` which has `aria-live="polite"` defined in the markup.
  * Keyboard behavior: standard click updates zoom
  * Focus behavior evidence: `updateZoomIndicator()` in `js/editor/editor-canvas-viewport-controls.js` updates current percentage.
  * Ownership: Canvas toolbar / Editor toolbar
  * Disposition: `compliant`

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
  * Disposition: `compliant` for accessible-name coverage. Needs `aria-controls="ftbDropdown"` linkage and focus shift to first item.

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
  * `#btnAudioToggle` (Viewer background music toggle control)
  * `.viewer-close-btn` (Viewer close control)

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

## Representative mobile surfaces
* **Needs runtime/browser verification**:
  * `.shared-header-mobile-close` (Shared mobile header overlay close menu button)
  * `.drawer-handle-bar` (Mobile preview drawer sheet collapse drag handle)

## Findings by disposition
* **compliant**:
  * `#previewMobileClose` (Search/Browse preview dismiss)
  * `#createTreeModalCloseBtn` (My Trees creation modal close trigger)
  * `#myTreesHubClose` (My Trees hub preview dismiss trigger)
  * `#zoomInCanvasBtn` (Editor canvas zoom-in trigger)
  * `#zoomOutCanvasBtn` (Editor canvas zoom-out trigger)
  * `#ftbMoreBtn` (Editor floating toolbar overflow trigger)
  * `#ftbScoutAction` (Editor floating toolbar scout action menu item)
  * `#ftbDeleteAction` (Editor floating toolbar delete node menu item)
  * `#ftbShareAction` (Editor floating toolbar copy link menu item)
  * `#ftbFocusAction` (Editor floating toolbar focus node menu item)
  * `#email-auth-close` (Auth email close modal button)
* **Needs runtime/browser verification**:
  * `#settingsBtn` (Home settings toggle button)
  * `.btn-preview-share` / `.share-copy-trigger` (Search/Browse copy links button)
  * `.tree-card-actions-trigger` (My Trees card action dropdown menu button)
  * `#btnAudioToggle` (Viewer volume/music toggle button)
  * `.viewer-close-btn` (Viewer close player button)
  * `.shared-header-mobile-close` (Mobile menu dismiss button)
  * `.drawer-handle-bar` (Mobile preview drawer drag handlebar)

* **Verified active controls count**: 11
* **Needs runtime/browser verification count**: 7

## Protected and delegated ownership
* #3073 provides completed toolbar-accessibility evidence only.
* New icon-control remediation identified by this audit remains owned by #3121 unless it falls under a protected boundary.
* First-moment activation guidance is outside this audit and remains under #2977 / #2965.
* **Contrast and Semantics**: Image accessibility and visual contrast are delegated to #3006.
* **Mobile Shell and Canvas**: Mobile touch handling and canvas bounds are delegated to #3072.
* **Protected Audits**: Issues #2972, #2976, #2960, and #2856 are strictly protected and no-touch boundaries.

## Ranked remediation candidates
1. **Candidate 1: Floating Toolbar More Button (`#ftbMoreBtn`)**
   * Selector: `#ftbMoreBtn`
   * Exact file path: `js/editor/templates/editor-floating-toolbar-template.js`
   * Exact current code evidence:
     * Has `aria-expanded="false"`, `aria-haspopup="true"` and `aria-label="더 보기"`, but lacks `aria-controls="ftbDropdown"` to establish menu parent-child ownership.
     * In `js/editor/editor-floating-toolbar-dropdown.js`, `showDropdown()` only updates expanded/visibility attributes and position, with no focus movement to the first item.
   * Minimal remediation:
     * Add `aria-controls="ftbDropdown"` to the markup.
     * Shift focus to first enabled menuitem on dropdown open.
     * Verify trigger focus restoration rules on close.
   * Focused contract requirement: Assert `#ftbMoreBtn` exists in floating toolbar template.
   * Protected/delegated boundary: No protected/delegated boundary violated; not under #2972, #2976, #2960, #2856, #3073, #3006, #3072, #2977, or #2965.

2. **Candidate 2: My Trees Hub Close Focus Restoration (`#myTreesHubClose`)**
   * Selector: `#myTreesHubClose`
   * Exact file path: `pages/my-trees.html`
   * Exact current code evidence:
     * In `js/my-trees/my-trees-mobile-preview-sheet.js`, `closeMobilePreview() -> setMobilePreviewOpen(false)` handles state transition, and `hideSheetOverlay()` only restores scroll, without saving or restoring focus to the initiating tree card/trigger element.
   * Minimal remediation:
     * Save preview-open trigger tree card element.
     * Restore focus to it on close and Escape keydown paths.
     * Distinguish close and Escape focus paths in the focused contract.
   * Focused contract requirement: Assert `#myTreesHubClose` exists in `pages/my-trees.html`.
   * Protected/delegated boundary: Route-local preview scope; separate from Editor canvas/mobile shell (#3072). No protected boundary violated.

3. **Candidate 3: Search Mobile Preview Close Focus Restoration (`#previewMobileClose`)**
   * Selector: `#previewMobileClose`
   * Exact file path: `pages/search.html`
   * Exact current code evidence:
     * `aria-label="감상 닫기"` exists in markup, but button click calls `ui.clearSelectedPreview()`. Close/hide sheet logic in `js/search/search-mobile-preview-sheet.js` only restores scroll without saving or restoring focus to the selected tree card.
   * Minimal remediation:
     * Save selected tree card / preview-open trigger.
     * Restore focus to it on close, overlay-click, and Escape paths.
     * Keep existing `aria-label="감상 닫기"`.
   * Focused contract requirement: Assert `#previewMobileClose` exists in `pages/search.html`.
   * Protected/delegated boundary: Focus restoration candidate (not missing name). No protected boundary violated.

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
