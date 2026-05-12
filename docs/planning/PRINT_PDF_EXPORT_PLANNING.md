# Print/PDF Export for LoveTree Keepsake — Planning (Refs #958)

## Core Idea
Allow visitors to create a keepsake-quality print/PDF of a public LoveTree's structure and moments using browser-native Print to PDF.

## Scope (First Slice)
- **Print-friendly CSS** — hide interactive panels (comments, like buttons), show tree structure and moments
- **Browser Print to PDF** — native browser export, no custom backend
- **Public-safe only** — no owner IDs, raw memory IDs, private fields

## Priority
Lower than link/image share features. Keepsake/delight feature for engaged users.

## UX Design

### Print Trigger
- "인쇄/PDF 저장" button in Public Viewer tree page
- Uses `window.print()`
- Print-only CSS stylesheet

### Print Layout
- **Header**: Tree title, creator name, date
- **Tree overview**: Branch structure shown as indented list or simplified visual
- **Moments**: Each moment shown with:
  - Title and branch label
  - Caption/memo text
  - Timestamp
  - Emotion tags (if applicable)
  - **No** video embeds (static poster image or placeholder)
- **Footer**: "Created with LoveBud" branding, page numbers

### CSS Strategy
- `@media print` rules in a dedicated print stylesheet
- Hide: navigation, buttons, comments, like buttons, share buttons, interactive elements
- Show: tree title, moment cards, captions, metadata
- Ensure text is dark on white for readability

## Technical Considerations

### Challenges
- Video embeds → static placeholders in print
- Dynamic tree layout (canvas/zoom) → fixed linear layout
- Dark mode colors → ensure print contrast
- Long trees → page break management

### Implementation Phases

**Phase 1: Basic Print CSS (MVP)**
- `@media print` rules in `css/visitor-viewer/visitor-viewer-print.css`
- Hide interactive elements, show structured content
- Test with browser Print to PDF

**Phase 2: Print Button**
- Add "인쇄" button to Public Viewer
- Invoke `window.print()` with print-specific styles

**Phase 3: Polish**
- Custom page headers/footers
- Cover page with tree thumbnail
- Page break control for large trees

## Blockers
- Product decision: priority relative to other features
- UX decision: what to include/exclude in print output

---
*Planning document v1 — Refs #958*
