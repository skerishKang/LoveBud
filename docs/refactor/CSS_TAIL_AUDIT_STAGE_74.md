# CSS Tail Audit & Global Split Planning (Stage 74)

Refs #1505

This document outlines the decisions regarding the remaining CSS tail files and the planning for the eventual splitting of the global CSS files, following the successful split of `search-tree-card.css` in PR #1584.

## PR #1584 Merge Commit
- **SHA**: `b812e1564700d11c7590d9841f3e9c5225ab11a3`

## Remaining Large CSS Files (Top 5)
Following the completion of Stage 73, the largest remaining CSS files are:
1. `css/global/global-header.css`: 678 lines
2. `css/global.css`: 556 lines
3. `css/intro/intro-how-to.css`: 460 lines
4. `css/editor/editor-canvas-toolbar.css`: 447 lines
5. `css/editor/editor-memory-form.css`: 442 lines
...
- `css/search/search-responsive.css`: 417 lines

## Search CSS Structure Completion & `search-responsive.css` Decision

### Status of Search CSS
The major components of the Search interface have been successfully structurally separated into distinct, responsibility-based files via their respective manifests:
- `search-preview-sidebar.css` (Stage 72): Split into layout, header, states, metadata, media, flow, actions, and responsive modules.
- `search-tree-card.css` (Stage 73): Split into layout, media, preview, fallback, content, metadata, and actions modules.

### Decision on `search-responsive.css` (417 lines)
**Decision**: HOLD (Do not split).

**Rationale**:
1. **Size Threshold**: At 417 lines, it is comfortably below the 500-line threshold established for mandatory splitting in this refactoring effort.
2. **Cohesion**: It holds a single, unified responsibility: managing the responsive design overrides across the search page interface. Splitting it by component (e.g., responsive cards vs. responsive sidebar) would fragment the media queries and potentially increase the cognitive overhead when making global responsive adjustments to the search view.
3. **Import Overhead**: Further splitting would introduce unnecessary import overhead for minimal organizational gain, directly contradicting the goal of reducing complexity.

With this hold decision, the structural reorganization of the specific Search CSS modules is considered complete.

## Global CSS Split Planning (`global.css` & `global-header.css`)

### Current State
- `css/global.css` (556 lines)
- `css/global/global-header.css` (678 lines)

These files dictate the foundational styling, typography, variable definitions, and the universally applied navigation header. They are imported by almost every HTML page in the project.

### Why Hold in Stage 74?
They are intentionally not split in this stage due to the **extreme blast radius**. Any error in splitting, cascading order, or missing imports will instantly break the layout of the entire application.

### Recommended Strategy for Future Splitting

1. **Prerequisites & Auditing**:
   - Map exactly which HTML files load `global.css` and in what order relative to page-specific CSS.
   - Audit `global.css` for truly global rules vs. rules that accidentally leaked from specific pages (e.g., a specific button style only used on the login page).

2. **`global.css` Split Candidates**:
   - `variables.css` (CSS Custom Properties/Tokens - ideally extracted first and placed at the very top of the cascade).
   - `reset.css` or `normalize.css` (Base element resets).
   - `typography.css` (Fonts, headings, paragraphs).
   - `utilities.css` (Helper classes).
   - `components.css` (Truly global components like standard buttons or inputs, if not already handled by a design system).

3. **`global-header.css` Split Candidates**:
   - `header-layout.css`
   - `header-navigation.css`
   - `header-user-menu.css`
   - `header-responsive.css`

4. **Execution Plan**:
   - Execute the split in a dedicated, isolated Stage (e.g., Stage 75 or later).
   - **Crucial**: The split must initially maintain the exact same cascade order by creating a `global.css` manifest that imports the new split files in the correct sequence.
   - Comprehensive cross-page visual regression testing is mandatory.

## Next Candidate (Stage 75)
Given the decision to hold on `search-responsive.css` and plan for the complex global files, the next logical targets are the remaining page-specific files approaching the 500-line threshold.

**Proposed Stage 75 Candidate**: `css/intro/intro-how-to.css` (460 lines) or begin the `global.css` split strategy outlined above, depending on priority. However, prioritizing `css/editor/editor-canvas-toolbar.css` (447 lines) or `css/editor/editor-memory-form.css` (442 lines) might yield higher value as they govern complex interaction surfaces.
