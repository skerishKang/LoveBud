# LoveBud Motion System Foundation

## 1. Purpose and non-goals

*   **Purpose**: This document provides an inventory of current motion behaviors across LoveBud surfaces and establishes a foundation for a future reduced-motion token contract.
*   **Non-goals**: This work does not include actual CSS migration, global token replacement, or animation redesign. The current production visual behavior is preserved.

## 2. Inventory method

*   **Scope**: Browse, My Trees, Editor, detail / modal / panel / toolbar.
*   **Inventory Criteria**: Only CSS `transition`, `animation`, `transform`, `opacity` based motion behaviors found in the source code have been included.
*   **Verification**: Behaviors were identified via file-level grep for motion keywords. Uncertain behaviors are marked as "not observed in current audit".

## 3. Current motion inventory

| Surface | File / selector | Current behavior | Motion class | User purpose | Reduced-motion expectation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Browse | `js/search/search-card-renderer.js` | `animation: fadeIn` | feedback | reveal | Opacity fade-in allowed |
| Browse | `js/search/search-card-renderer.js` | `animation: searchSkeletonPulse` | feedback | loading | Disable/Simplify |
| Browse | `css/editor/editor-mode-selection.css` | `.editor-rename-modal-btn` transition | hover | feedback | Simplify/Instant |
| My Trees | `js/my-trees/my-trees-ui.js` | card opacity transition | feedback | reveal | Opacity fade-in allowed |
| Editor | `css/editor/editor-canvas.css` | `.branch-line` transition (stroke/opacity) | hierarchy-change | state feedback | Simplify/Instant |
| Editor | `css/editor/editor-canvas.css` | `.edge-disconnect-btn` hover scale (1.15) | hover | feedback | Simplify/Instant |
| Editor | `css/editor/editor-canvas.css` | `.branch-port-handle::before` hover scale (1.4) | hover | feedback | Simplify/Instant |
| Editor | `css/editor/editor-canvas.css` | `.memory-node.focus-animate` pulse | feedback | focus reveal | Simplify/Instant |
| Editor | `css/editor/editor-canvas.css` | `.editor-canvas-empty-guide` fadeIn | feedback | reveal | Opacity fade-in allowed |
| Shared | `js/shared-header.js` | `animation: spin` | feedback | loading | Remove/Disable |
| Editor | `css/page-transitions.css` | `.page-transition-enter` (opacity/transform) | page-transition | navigation | Opacity-only or instant |
| Editor | `css/page-transitions.css` | `.reveal-up` (opacity/transform) | feedback | reveal | Opacity fade-in allowed |
| Detail | `js/editor/editor-detail-ui.js` | opacity (not observed in active runtime) | hierarchy-change | reveal | N/A |

## 4. Proposed token contract

*   **duration-fast**: `0.1s` - For small state changes.
*   **duration-standard**: `0.2s` - For general interactions.
*   **duration-slow**: `0.3s` - For larger transitions or modal reveals.
*   **easing-standard**: `ease-in-out` - General purpose.
*   **easing-emphasized**: `cubic-bezier(0.4, 0, 0.2, 1)` - For more dynamic transitions.
*   **easing-exit**: `ease-out` - For exits.

*Current status*: These tokens are proposals for future use. No immediate adoption to prevent unintended visual regression.

## 5. prefers-reduced-motion policy

| Motion class | Policy |
| :--- | :--- |
| feedback | Opacity change allowed; avoid complex transform/scale. |
| hover | Simplify to opacity/color change; disable transform. |
| hierarchy-change | Limit distance of movement. |
| modal-panel | Use opacity-only fade; avoid slide-in. |
| page-transition | Instant transition or opacity-only fade. |
| canvas-interaction | Preserve focus/zoom semantics (out of scope). |
| decorative | Completely disable. |

## 6. First migration candidates

1.  **Shared Header Spin** (`js/shared-header.js`): Low risk (purely decorative animation). Observability: visual loading indicator.
2.  **Browse Skeleton Pulse** (`js/search/search-card-renderer.js`): Low risk, easy to verify (loading state). Observability: search results appearance.
3.  **Editor Modal Button** (`css/editor/editor-mode-selection.css`): Low risk, small scope. Observability: button state change on hover.

## 7. Migration guardrails

*   No repository-wide replace.
*   No unused token addition.
*   Preserve canvas pan/zoom, focus, and page transition semantics.
*   Preserve production visual rhythm.
*   One migration PR per motion class.
*   Requires product-owner visual acceptance.

## 8. Follow-up sequence

1.  Token definition PR.
2.  First narrow migration PR.
3.  Reduced-motion browser QA.
4.  Cross-surface adoption review.
