# LoveBud Motion System Foundation

## 1. Purpose and non-goals

*   **Purpose**: This document provides an inventory of current motion behaviors across LoveBud surfaces and establishes a foundation for a future reduced-motion token contract.
*   **Non-goals**: This work does not include actual CSS migration, global token replacement, or animation redesign. The current production visual behavior is preserved.

## 2. Inventory method

*   **Scope**: Browse, My Trees, Editor, detail / modal / panel / toolbar.
*   **Keywords used**: `transition`, `animation`, `transform`, `opacity`, `keyframes`, `prefers-reduced-motion`.

## 3. Current motion inventory

| Surface | File / selector | Current behavior | Motion class | User purpose | Reduced-motion expectation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Browse | `js/search/search-card-renderer.js` | Fade-in on load | feedback | reveal | Opacity change is acceptable |
| Browse | `js/search/search-card-renderer.js` | Pulse animation | feedback | loading state | Disable/Simplify |
| My Trees | `js/my-trees/my-trees-ui.js` | Opacity fade on load | feedback | reveal | Opacity change is acceptable |
| Editor | `css/editor/editor-mode-selection.css` | Transition on hover/active | hover | state feedback | Minimize/Disable |
| Editor | `js/page-transitions.js` | Page transitions | page-transition | navigation | Opacity-only or instant |
| Shared | `js/shared-header.js` | Infinite spin | feedback | loading | Remove/Disable |

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

1.  **Shared Header Spin** (`js/shared-header.js`): Low risk (purely decorative). Observability: visual loading indicator.
2.  **Browse Card Fade-in** (`js/search/search-card-renderer.js`): Low risk, easy to verify. Observability: search results appearance.
3.  **Editor Selection Hover** (`css/editor/editor-mode-selection.css`): Low risk, high interaction frequency. Observability: editor node selection feedback.

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
