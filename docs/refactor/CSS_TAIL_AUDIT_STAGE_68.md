# CSS Tail Audit and Hold Decision (Stage 68)

This document maps out the remaining CSS files under **Issue #1505** and records the hold decision for `css/page-transitions.css`.

---

## 1. Hold Decision: `css/page-transitions.css`

- **Line Count**: 91 lines (92 lines with EOF newline)
- **Primary Responsibility**: Shared page entry transitions and scroll reveal styles.
- **Decision**: **HOLD (Do Not Split)**
- **Rationales**:
  1. **Oversized Threshold**: At 91 lines, it is far below the 500-line threshold for oversized candidates.
  2. **Single Responsibility**: The file has a highly cohesive and isolated single responsibility (handling common page transition & reveal animation mechanics).
  3. **Complexity Overhead**: Arbitrarily splitting this file into sub-components would introduce unnecessary `@import` overhead and parcellate simple animations, leading to higher maintenance costs without structural benefit.

---

## 2. Remaining CSS Candidates Audit (Oversized & Page-Specific)

A tail audit of the repository's CSS modules reveals the following page-specific and global CSS files:

### Oversized Candidates (> 500 lines)
1. **`css/global/global-header.css`** (678 lines) - Header layout & styling.
2. **`css/visitor-viewer/visitor-viewer-panel.css`** (676 lines) - Guestbook viewer panel.
3. **`css/search/search-preview-sidebar.css`** (591 lines) - Search preview panel.
4. **`css/search/search-tree-card.css`** (586 lines) - Search result cards.
5. **`css/global.css`** (556 lines) - Global tokens and layouts (Frozen/Low Priority).
6. **`css/viewer/public-tree-viewer.css`** (507 lines) - Public tree viewer route page-specific styles.
7. **`css/my-trees/my-trees-preview-hub.css`** (504 lines) - My Trees dashboard preview panel.

### Medium-Large Candidates (150 ~ 500 lines)
8. **`css/intro/intro-how-to.css`** (460 lines) - Intro instructions section.
9. **`css/editor/editor-canvas-toolbar.css`** (447 lines) - Editor workspace toolbar.
10. **`css/editor/editor-memory-form.css`** (442 lines) - Editor detail form input.
11. **`css/search/search-responsive.css`** (417 lines) - Search grid media queries.

---

## 3. Recommended Next Candidates for Stage 69

Following the page-specific low-risk prioritization guideline:

1. **Candidate 1: `css/viewer/public-tree-viewer.css`** (507 lines)
   - **Reason**: Page-specific style for public tree viewer page. Isolated from active editing routes, high split payoff (> 500 lines).
2. **Candidate 2: `css/my-trees/my-trees-preview-hub.css`** (504 lines)
   - **Reason**: Dashboard preview panel. High payoff, low impact on authentication or checkout logic.
3. **Candidate 3: `css/visitor-viewer/visitor-viewer-panel.css`** (676 lines)
   - **Reason**: Guestbook viewer panel. High payoff but holds visual interactions with guestbook rendering.
