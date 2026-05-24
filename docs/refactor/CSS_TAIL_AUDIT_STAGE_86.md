# CSS Tail Audit — Stage 86

**Date:** 2026-05-24
**Main HEAD:** `75a7bf82063c226ab1c2533e8c1ab159f7f95b46`
**#1505:** OPEN
**PR #1570:** 미접촉

---

## 1. Current CSS Split Status

Total CSS: 17,311 lines across all files.

### Already Split (Stages 76-85)

| Stage | File | Before | After | Status |
|-------|------|--------|-------|--------|
| 76 | editor-canvas-toolbar.css | 447 | 7 (manifest) | ✅ Split |
| 77 | visitor-viewer-shell.css | 384 | 7 (manifest) | ✅ Split |
| 80 | editor-detail-edit.css | 256 | 8 (manifest) | ✅ Split |
| 81 | search-responsive.css | 417 | 6 (manifest) | ✅ Split |
| 82 | editor-detail-content.css | 319 | 12 (manifest) | ✅ Split |
| 83 | editor-floating-toolbar.css | 332 | 12 (manifest) | ✅ Split |
| 84 | editor-responsive.css | 219 | 5 (manifest) | ✅ Split |
| 85 | editor-status-settings.css | 205 | 8 (manifest) | ✅ Split |

---

## 2. Remaining 200+ Line CSS Candidates

### Priority 1: editor-memory-form.css (442 lines)

**Risk Level:** HIGH
**Recommendation:** HOLD — browser smoke required before split

**Reasons:**
- Editor runtime state selectors (`.canvas-area.is-memory-form-open`)
- Body prefix selectors (`.sidebar-memory-form-open .canvas-area`)
- `@keyframes` animations (2 animations: skeleton-shimmer, newNodePulse)
- `!important` usage (1 place)
- Form modal with canvas suppression behavior
- Add section with skeleton loading states
- Connected to editor canvas state management

**Required before split:**
- Browser smoke test: editor page load → form open → canvas suppression → form close
- Verify animation behavior preserved
- Verify canvas suppression state transitions preserved

### Priority 2: editor-overrides.css (385 lines)

**Risk Level:** HIGH
**Recommendation:** HOLD — cascade override risk

**Reasons:**
- Stage 79 hold decision already made
- Contains cascade overrides for multiple editor components
- Splitting could break override precedence
- Requires careful analysis of CSS specificity chains

**Status:** Continue hold. Do not split.

### Priority 3: editor-canvas.css (298 lines)

**Risk Level:** MEDIUM-HIGH
**Recommendation:** HOLD — editor canvas core

**Reasons:**
- Core editor canvas layout and behavior
- Connected to editor canvas JS runtime
- Splitting requires understanding of canvas state machine

### Priority 4: gpt-v2/common.css (370 lines)

**Risk Level:** LOW-MEDIUM
**Recommendation:** AUDIT — potential split candidate

**Reasons:**
- GPT v2 common styles
- May have clear responsibility boundaries
- Lower runtime coupling than editor files

### Priority 5: intro/hero/moments.css (316 lines)

**Risk Level:** LOW
**Recommendation:** AUDIT — potential split candidate

**Reasons:**
- Intro page hero moments
- Static content, lower runtime coupling
- May split cleanly by responsibility

---

## 3. Under 200 Lines — Over-Splitting Risk

Files under 200 lines should generally NOT be split unless:
- Clear 3+ distinct responsibilities
- Each responsibility is 50+ lines
- No shared state or cascade dependencies

**Examples of files that should NOT be split further:**
- editor-sidebar.css (169 lines) — single responsibility
- search-controls.css (204 lines) — borderline, audit first
- visitor-viewer-tree.css (294 lines) — potential candidate

---

## 4. Files Requiring Browser Smoke

| File | Lines | Smoke Required |
|------|-------|----------------|
| editor-memory-form.css | 442 | YES — form open/close, canvas suppression |
| editor-canvas.css | 298 | YES — canvas state transitions |
| editor-overrides.css | 385 | YES — cascade precedence |

---

## 5. Recommended Next Steps

### Stage 87 Options

**Option A: editor-memory-form.css split (with browser smoke)**
- Requires browser smoke test first
- If smoke passes, split by responsibility
- If smoke fails, hold with documentation

**Option B: gpt-v2/common.css audit**
- Lower risk, static styles
- May split cleanly
- No browser smoke required

**Option C: intro/hero/moments.css audit**
- Lowest risk
- Static content
- Clean split possible

**Recommended:** Option B or C for next stage. Option A requires additional verification.

---

## 6. PR #1570 Status

PR #1570 remains OPEN and untouched. This is a separate concern from CSS splitting.

---

## 7. Summary

- 8 CSS files successfully split (Stages 76-85)
- 3 high-risk files require browser smoke before split
- 2 medium-risk files need audit
- Multiple low-risk files under 200 lines should not be split
- CSS tail splitting is approaching completion
- Focus should shift to quality verification over quantity
