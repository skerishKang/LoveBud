# Editor Memory Form CSS Audit & Hold Decision (Stage 77)

Refs #1505

This document outlines the findings of the audit conducted on `css/editor/editor-memory-form.css` and the subsequent decision to temporarily hold its structural split. This decision is made to prioritize runtime stability during the ongoing CSS refactoring process.

## 1. Target File
`css/editor/editor-memory-form.css`

## 2. Current Line Count
442 lines (As of Stage 76 completion).

## 3. Selector Responsibility Scope
The audit revealed that this file manages styles across a broad and highly interactive surface area of the Editor. The selectors are grouped into several interconnected responsibilities:
- **Sidebar Integration**: Styles targeting the initial "Add Memory" entry points within the editor sidebar (`.editor-add-*`).
- **Form Body**: Layout and typography for the form fields themselves (`.editor-form-*`).
- **Modal Container**: Styles governing the structural modal shell that houses the memory form (`.editor-memory-form-modal`).
- **Canvas Suppression States**: Selectors that control the visual appearance of the underlying canvas when the form modal is active (e.g., `.canvas-area.is-memory-form-open`).
- **Animation States**: CSS managing the transitional states of the form and its elements.

## 4. Keyframes Inventory
The file defines and utilizes the following keyframes, which are critical to the UX feedback loop during memory creation:
- `@keyframes skeleton-shimmer`
- `@keyframes newNodePulse`

## 5. Split Decision: HOLD
**Decision**: The structural splitting of `css/editor/editor-memory-form.css` is held for Stage 77. No CSS files will be modified in this PR.

## 6. Rationale for Hold
- **Size Threshold**: At 442 lines, the file does not exceed the mandatory 500-line threshold that necessitates immediate splitting to prevent unmanageable file sizes.
- **State Complexity**: The presence of interconnected stateful selectors (like `.is-memory-form-open` affecting `.canvas-area`) indicates a high degree of coupling with the editor's JavaScript state machine. Splitting these hastily could lead to lost styles if state toggles occur during asynchronous CSS loading or if specificity changes due to file order.
- **Animation Coupling**: The embedded keyframes are tightly bound to the interaction flow. Separating them prematurely risks timing discrepancies.

## 7. Editor Regression Risk
The risk of regression is considered **High**. The Memory Form is a primary interaction surface. Any disruption in the modal layout, field visibility, or state indicators (like the suppression of the canvas behind it) would directly impair core application functionality (memory creation).

## 8. Required Further Auditing
Before this file can be safely split, the following dependencies must be mapped comprehensively:
- **Import/Link Structure**: Confirm exactly how `editor-memory-form.css` is loaded relative to `editor.css` and `editor-canvas.css`. We must ensure that any split files maintain the exact same position in the cascade to prevent specificity regressions.
- **JavaScript State Hooks**: Identify all JavaScript runtime files that toggle the classes defined in this CSS file to ensure that no dynamic styles are inadvertently orphaned.

## 9. Next Stage Recommendation (Stage 78)
Given the hold on the Memory Form CSS, the recommended next step is to evaluate the remaining large files from the Stage 74 audit.
- **Recommendation**: Audit `css/intro/intro-how-to.css` (if not already completed, though it appears completed in Stage 75) or proceed to the next largest page-specific CSS file, such as `css/editor/editor-overrides.css` (~385 lines) or `css/visitor-viewer/visitor-viewer-shell.css` (~384 lines). The primary goal is to target non-runtime-critical styling first.

*(Note: Issue #1505 remains OPEN tracking the overarching CSS split initiative).*
