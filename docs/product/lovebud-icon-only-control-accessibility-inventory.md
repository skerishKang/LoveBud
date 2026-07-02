# LoveBud Icon-Only Control Accessibility Inventory

## Status and scope
* **Status**: Proposed/Planning Contract. No active code modifications have been made to UI templates, styles, event listeners, or schemas in this planning slice.
* **Scope**: This is a static evidence inventory, not a completed route-wide browser accessibility certification. Runtime/browser verification remains mandatory before treating any unresolved lead as a defect or implementing a focus change.

## Verification metrics
* Static inventory entries with verified markup evidence: 11
* Focus/interaction remediation candidates: 3
* Needs runtime/browser verification leads: 7

## Findings by disposition

### Static name/semantic compliance verified
- `#previewMobileClose`
- `#createTreeModalCloseBtn`
- `#myTreesHubClose`
- `#zoomInCanvasBtn`
- `#zoomOutCanvasBtn`
- `#ftbMoreBtn`
- `#ftbScoutAction`
- `#ftbDeleteAction`
- `#ftbShareAction`
- `#ftbFocusAction`
- `#email-auth-close`

### Focus or interaction remediation candidates
* **`#ftbMoreBtn`**
  - Selector: `#ftbMoreBtn`
  - Route/surface: Editor floating toolbar
  - Evidence details: Static markup verifies `aria-expanded`, `aria-haspopup`, and `aria-label`. `aria-controls="ftbDropdown"` is absent. Dropdown open behavior must be checked against the actual helper before any focus-management implementation. First-item focus movement requires targeted source/runtime verification before implementation.
  - Static name/semantic evidence: verified.
  - Interaction/focus remediation: pending route-specific source and browser verification.
  - Keyboard/focus evidence: static semantic markup verified; runtime/browser verification remains required for actual activation path and visible focus treatment.

* **`#myTreesHubClose`**
  - Selector: `#myTreesHubClose`
  - Route/surface: My Trees Hub overlay drawer
  - Evidence details: Static markup verifies the close button name. Current sheet close code restores scroll state. Opener focus restoration was not found in the audited close path; confirm close and Escape paths in browser before implementing.
  - Static name/semantic evidence: verified.
  - Interaction/focus remediation: pending route-specific source and browser verification.
  - Keyboard/focus evidence: static semantic markup verified; runtime/browser verification remains required for actual activation path and visible focus treatment.

* **`#previewMobileClose`**
  - Selector: `#previewMobileClose`
  - Route/surface: Browse / Search route preview overlay
  - Evidence details: Static markup verifies `aria-label="감상 닫기"`. Current close flow clears selection and restores scroll state. Opener focus restoration must be verified for button-close, overlay-close, and Escape paths before implementation.
  - Static name/semantic evidence: verified.
  - Interaction/focus remediation: pending route-specific source and browser verification.
  - Keyboard/focus evidence: static semantic markup verified; runtime/browser verification remains required for actual activation path and visible focus treatment.

### Needs runtime/browser verification
1. **`#settingsBtn`**
   - Selector: `#settingsBtn`
   - Route/surface: Shared header component
   - Why static evidence is insufficient: The control trigger is generated dynamically inside global layout headers and contains no static HTML attribute definition.
   - Required browser verification:
     - determine whether the rendered element is interactive or decorative;
     - inspect its computed accessible name, role, and state semantics;
     - verify keyboard activation only when the control is intended to be keyboard-operable;
     - observe focus behavior after its actual close/toggle/action path;
     - record the route-specific result before classifying any defect.
   - Note: Do not classify as missing-name or broken-focus until verified.

2. **`.btn-preview-share` / `.share-copy-trigger`**
   - Selector: `.btn-preview-share` / `.share-copy-trigger`
   - Route/surface: Search preview detail surface
   - Why static evidence is insufficient: Shares different visual class contexts based on responsive viewport wrappers.
   - Required browser verification:
     - determine whether the rendered element is interactive or decorative;
     - inspect its computed accessible name, role, and state semantics;
     - verify keyboard activation only when the control is intended to be keyboard-operable;
     - observe focus behavior after its actual close/toggle/action path;
     - record the route-specific result before classifying any defect.
   - Note: Do not classify as missing-name or broken-focus until verified.

3. **`.tree-card-actions-trigger`**
   - Selector: `.tree-card-actions-trigger`
   - Route/surface: My Trees list surface
   - Why static evidence is insufficient: Renders inline as dynamically mapped item triggers.
   - Required browser verification:
     - determine whether the rendered element is interactive or decorative;
     - inspect its computed accessible name, role, and state semantics;
     - verify keyboard activation only when the control is intended to be keyboard-operable;
     - observe focus behavior after its actual close/toggle/action path;
     - record the route-specific result before classifying any defect.
   - Note: Do not classify as missing-name or broken-focus until verified.

4. **`#btnAudioToggle`**
   - Selector: `#btnAudioToggle`
   - Route/surface: Viewer canvas controller panel
   - Why static evidence is insufficient: Background audio plays asynchronously, making focus state tracking route-sensitive.
   - Required browser verification:
     - determine whether the rendered element is interactive or decorative;
     - inspect its computed accessible name, role, and state semantics;
     - verify keyboard activation only when the control is intended to be keyboard-operable;
     - observe focus behavior after its actual close/toggle/action path;
     - record the route-specific result before classifying any defect.
   - Note: Do not classify as missing-name or broken-focus until verified.

5. **`.viewer-close-btn`**
   - Selector: `.viewer-close-btn`
   - Route/surface: Public viewer canvas overlays
   - Why static evidence is insufficient: Overlaid directly on canvas rendering viewport where focus target tracking is dynamic.
   - Required browser verification:
     - determine whether the rendered element is interactive or decorative;
     - inspect its computed accessible name, role, and state semantics;
     - verify keyboard activation only when the control is intended to be keyboard-operable;
     - observe focus behavior after its actual close/toggle/action path;
     - record the route-specific result before classifying any defect.
   - Note: Do not classify as missing-name or broken-focus until verified.

6. **`.shared-header-mobile-close`**
   - Selector: `.shared-header-mobile-close`
   - Route/surface: Mobile menu drawer panel
   - Why static evidence is insufficient: Generated inside dynamic mobile templates with no static markup layout definitions.
   - Required browser verification:
     - determine whether the rendered element is interactive or decorative;
     - inspect its computed accessible name, role, and state semantics;
     - verify keyboard activation only when the control is intended to be keyboard-operable;
     - observe focus behavior after its actual close/toggle/action path;
     - record the route-specific result before classifying any defect.
   - Note: Do not classify as missing-name or broken-focus until verified.

7. **`.drawer-handle-bar`**
   - Selector: `.drawer-handle-bar`
   - Route/surface: Bottom details overlay drawer
   - Why static evidence is insufficient: Drag handle behaves as pointer-movement surface rather than standard interactive button.
   - Required browser verification:
     - determine whether the rendered element is interactive or decorative;
     - inspect its computed accessible name, role, and state semantics;
     - verify keyboard activation only when the control is intended to be keyboard-operable;
     - observe focus behavior after its actual close/toggle/action path;
     - record the route-specific result before classifying any defect.
   - Note: Do not classify as missing-name or broken-focus until verified.

## Verified static inventory details

1. **Selector**: `#previewMobileClose`
   - Exact markup/template source: `pages/search.html`
   - Route/surface: Browse / Search route preview overlay
   - Verified accessible-name/state evidence: `aria-label="감상 닫기"`
   - Native or explicit semantic role: button (implicit native `<button>` semantics)
   - Evidence tier: Tier 1 (Static markup file)

2. **Selector**: `#createTreeModalCloseBtn`
   - Exact markup/template source: `pages/my-trees.html`
   - Route/surface: My Trees create tree modal
   - Verified accessible-name/state evidence: `aria-label="닫기"`
   - Native or explicit semantic role: button (implicit native `<button>` semantics)
   - Evidence tier: Tier 1 (Static markup file)

3. **Selector**: `#myTreesHubClose`
   - Exact markup/template source: `pages/my-trees.html`
   - Route/surface: My Trees Hub overlay drawer
   - Verified accessible-name/state evidence: `aria-label="닫기"`
   - Native or explicit semantic role: button (implicit native `<button>` semantics)
   - Evidence tier: Tier 1 (Static markup file)

4. **Selector**: `#zoomInCanvasBtn`
   - Exact markup/template source: `js/editor/templates/editor-canvas-topbar-template.js`
   - Route/surface: Editor canvas topbar menu
   - Verified accessible-name/state evidence: `aria-label="확대"`
   - Native or explicit semantic role: button (implicit native `<button>` semantics)
   - Evidence tier: Tier 2 (Static template script)

5. **Selector**: `#zoomOutCanvasBtn`
   - Exact markup/template source: `js/editor/templates/editor-canvas-topbar-template.js`
   - Route/surface: Editor canvas topbar menu
   - Verified accessible-name/state evidence: `aria-label="축소"`
   - Native or explicit semantic role: button (implicit native `<button>` semantics)
   - Evidence tier: Tier 2 (Static template script)

6. **Selector**: `#ftbMoreBtn`
   - Exact markup/template source: `js/editor/templates/editor-floating-toolbar-template.js`
   - Route/surface: Editor floating toolbar
   - Verified accessible-name/state evidence: `aria-label="더 보기"`, `aria-expanded="false"`, `aria-haspopup="true"`
   - Native or explicit semantic role: button (implicit native `<button>` semantics)
   - Evidence tier: Tier 2 (Static template script)

7. **Selector**: `#ftbScoutAction`
   - Exact markup/template source: `js/editor/templates/editor-floating-toolbar-template.js`
   - Route/surface: Editor floating toolbar dropdown
   - Verified accessible-name/state evidence: `aria-label="Scout로 순간 저장"`
   - Native or explicit semantic role: menuitem (explicit `role="menuitem"` attribute)
   - Evidence tier: Tier 2 (Static template script)

8. **Selector**: `#ftbDeleteAction`
   - Exact markup/template source: `js/editor/templates/editor-floating-toolbar-template.js`
   - Route/surface: Editor floating toolbar dropdown
   - Verified accessible-name/state evidence: `aria-label="순간 삭제"`
   - Native or explicit semantic role: menuitem (explicit `role="menuitem"` attribute)
   - Evidence tier: Tier 2 (Static template script)

9. **Selector**: `#ftbShareAction`
   - Exact markup/template source: `js/editor/templates/editor-floating-toolbar-template.js`
   - Route/surface: Editor floating toolbar dropdown
   - Verified accessible-name/state evidence: `aria-label="링크 복사"`
   - Native or explicit semantic role: menuitem (explicit `role="menuitem"` attribute)
   - Evidence tier: Tier 2 (Static template script)

10. **Selector**: `#ftbFocusAction`
    - Exact markup/template source: `js/editor/templates/editor-floating-toolbar-template.js`
    - Route/surface: Editor floating toolbar dropdown
    - Verified accessible-name/state evidence: `aria-label="선택한 순간 보기"`
    - Native or explicit semantic role: menuitem (explicit `role="menuitem"` attribute)
    - Evidence tier: Tier 2 (Static template script)

11. **Selector**: `#email-auth-close`
    - Exact markup/template source: `pages/login.html` / `pages/signup.html`
    - Route/surface: Auth login and signup modals
    - Verified accessible-name/state evidence: `aria-label="모달 닫기"`
    - Native or explicit semantic role: button (implicit native `<button>` semantics)
    - Evidence tier: Tier 1 (Static markup file)

## Non-goals and boundaries
* No UI, API, database, Cloudflare Pages, Firebase config, dynamic-copy, or media-playback script modification is authorized.
* Audit focuses exclusively on interactive control accessibility tags.

## Protected boundaries
* #3072 — mobile/touch shell policy
* #2960 — protected detail-panel composition
* #2972 — shared media-playback boundary
* #2976 — dynamic-copy centralization boundary
* #3121 — icon-only controls audit
* #1882 — parent product issue

## References
* Refs #3121
* Refs #3072
* Refs #2960
* Refs #2972
* Refs #2976
* Refs #1882
