# LoveBud DOM XSS Sink Analysis Report

**Date:** 2026-05-25
**Scope:** 8 target files + 2 supporting files
**Security Utilities:** `/root/LoveBud/js/utils/security.js` — `LoveBudSecurity.escapeHtml()` / `LoveBudSecurity.sanitizeUrl()`

---

## Summary

| Metric | Count |
|--------|-------|
| Total sink occurrences analyzed | 63 |
| SAFE (escapeHtml/sanitizeUrl applied OR static content only) | 59 |
| **REVIEW (user content without escaping)** | **4** |
| REVIEW found in production code | 1 |
| REVIEW found in prototype/mock code | 3 |

---

## Detailed Findings

### 🔴 REVIEW Items (User Content Without Escaping)

#### 1. `/root/LoveBud/js/search/search-preview-hub-dom-patch.js` — Line 46

| Field | Value |
|-------|-------|
| **Sink Type** | `.innerHTML =` |
| **Line Content** | `copy.innerHTML = '<p class="preview-summary-line">' + summaryText + '</p>';` |
| **User Content?** | Yes — `summaryText` derived from DOM textContent (indirectly user-generated) |
| **escapeHtml Used?** | **No** |
| **Risk** | The `getSummaryText()` function (lines 24-31) extracts textContent from a cloned DOM node, which decodes HTML entities. If the original DOM contains `&lt;script&gt;`, textContent returns `<script>` which is then injected unsafely via innerHTML. This is a known DOM-based XSS pattern (entity decode → innerHTML re-injection). |

#### 2. `/root/LoveBud/js/chat-first-workspace.js` — Line 132

| Field | Value |
|-------|-------|
| **Sink Type** | `.innerHTML =` |
| **Line Content** | `item.innerHTML = '<div class="cfw-moment-dot ' + mom.type + '"></div>' + '<div><div class="cfw-moment-text">' + mom.text + '</div>' + '<div class="cfw-moment-date">' + mom.date + '</div></div>';` |
| **User Content?** | Yes — `mom.type`, `mom.text`, `mom.date` (mock data fields) |
| **escapeHtml Used?** | **No** |
| **Note** | This file is a **mock-only prototype** (v20260518-1, marked as "Mock data only — no DB/API/AI"). No production impact, but the pattern is unsafe if reused in production. |

#### 3. `/root/LoveBud/js/chat-first-workspace.js` — Line 271

| Field | Value |
|-------|-------|
| **Sink Type** | `.innerHTML =` |
| **Line Content** | `els.bottomSheetContent.innerHTML = '<div ...>' + formatDate(mom.date) + '</div>' + '<div ...>' + mom.text + '</div>' + mom.tags.map(function (t) { return '<span class="cfw-moment-tag">' + t + '</span>'; }).join('') + ...` |
| **User Content?** | Yes — `mom.date`, `mom.text`, `mom.tags` |
| **escapeHtml Used?** | **No** |
| **Note** | Same prototype file. No escaping on any of the three user-content fields. `formatDate()` only returns a safe date string, but `mom.text` and tags are raw. |

#### 4. `/root/LoveBud/js/detail/detail-video.js` — Line 57 (defense-in-depth concern)

| Field | Value |
|-------|-------|
| **Sink Type** | Template literal in `.innerHTML =` (via `buildIframeEmbedMarkup`) |
| **Line Content** | `src="${iframeSrc}"` |
| **User Content?** | Yes — `iframeSrc` traces back to `memory.sourceUrl` (user-generated) |
| **escapeHtml Used?** | **No** (but sanitizeUrl is not applied either) |
| **Risk** | `iframeSrc` is constructed from `normalizeVideoSourceUrl()` which for non-YouTube URLs returns the raw user-provided URL unchanged. Modern browsers block `javascript:` in iframe `src`, so practical XSS risk is very low. However, defense-in-depth would recommend `escapeHtml(iframeSrc)` or `sanitizeUrl()`. Classified as **SAFE** for DOM XSS (browser-blocked) but flagged for hardening. |

---

### 🟢 SAFE Items (escapeHtml/sanitizeUrl Applied or Static Content)

#### File: `/root/LoveBud/js/detail/detail-render.js`

| Line | Sink | Content Source | User Content? | Sanitized? | Notes |
|------|------|---------------|---------------|------------|-------|
| 94 | `.innerHTML =` | `buildVideoMainMarkup(memory)` | Yes (memory data) | Yes (escapeHtml in detail-video.js) | See detail-video.js analysis |
| 105 | `.innerHTML =` | `channelHtml` via `buildChannelMetaHtml(memory)` | Yes (channel) | Yes (escapeHtml on url & label, lines 73-74) | Channel URL additionally validated by `sanitizeYouTubeChannelUrl()` |
| 121 | `.innerHTML =` | `renderedTags` from `memory.emotionTags.map(t => escapeHtml(t))` | Yes (tags) | Yes (escapeHtml) | |
| 133 | `.innerHTML =` | `buildEmptyMemoMarkup()` | No (static tText) | N/A | Static translated text only |
| 142 | `.innerHTML =` | Template with `tText()` | No (static) | N/A | Static translated text only |
| 157 | `.innerHTML =` | Template with `tText()` | No (static) | N/A | Static translated text only |
| 173 | `.innerHTML =` | `''` (empty string) | No | N/A | |
| 185 | `.innerHTML =` | Template with `tText()` + `treeMomentCount` (Number) | No (static) | N/A | Number is safe |
| 215 | `.innerHTML =` | Template with `escapeHtml(treeTitle)` + `tText()` | Yes (treeTitle) | Yes (escapeHtml) | `contextMessages[sourceContext]` is static i18n |
| 257 | `.innerHTML =` | `fallbackHTML` with `tText()` + dependency-injected paths | Partial (paths) | N/A | Paths from injected dependencies |

#### File: `/root/LoveBud/js/detail/detail-video.js` (supporting detail-render.js)

| Line | Sink | Content Source | User Content? | Sanitized? | Notes |
|------|------|---------------|---------------|------------|-------|
| 6 | Template in innerHTML | `escapeHtml(kicker)` | Yes | Yes | |
| 7 | Template in innerHTML | `escapeHtml(title)` | Yes | Yes | |
| 8 | Template in innerHTML | `escapeHtml(description)` | Yes | Yes | |
| 23 | Template in innerHTML | `escapeHtml(thumbnail)`, `escapeHtml(title)` | Yes | Yes | |
| 25-27 | Template in innerHTML | `tText()`, `escapeHtml(title/caption)` | Yes | Yes | |
| 43-48 | Template in innerHTML | `tText()`, `escapeHtml(watchUrl/title)` | Yes | Yes | watchUrl from normalized video URL |
| 57-64 | Template in innerHTML | `iframeSrc` (not escaped), titles escaped | Yes | Partial | iframeSrc: see REVIEW #4 above |
| 82-83 | Template in innerHTML | `escapeHtml(watchUrl)`, `tText()` | Yes | Yes | |

#### File: `/root/LoveBud/js/viewer/public-tree-viewer.js`

| Line | Sink | Content Source | User Content? | Sanitized? | Notes |
|------|------|---------------|---------------|------------|-------|
| 205 | `.innerHTML =` | `''` (empty) | No | N/A | |
| 220 | `.innerHTML =` | Template with `escapeHtml()` on title/date/tags | Yes (memories) | Yes | All user fields escaped |
| 302 | `.innerHTML =` | Static placeholder HTML | No | N/A | |
| 328 | `.innerHTML =` | `escapeHtml(safeEmbedUrl)` + `escapeHtml(title)` | Yes | Yes | Embed URL sanitized via `sanitizeUrl()` |
| 330 | `.innerHTML =` | `escapeHtml(thumb)` + `escapeHtml(title)` | Yes | Yes | |
| 332 | `.innerHTML =` | Static no-media div | No | N/A | |
| 335 | `.innerHTML =` | Template with `escapeHtml(thumb/title)` | Yes | Yes | |
| 337 | `.innerHTML =` | Static no-media div | No | N/A | |
| 345 | `.innerHTML =` | Tags with `escapeHtml(tag)` | Yes | Yes | |
| 355 | `.innerHTML =` | Template with `escapeHtml(dateStr/location)` | Yes | Yes | |
| 367 | `.innerHTML =` | `escapeHtml(diaryContent)` then `.replace()` for `<br>` | Yes | Yes | |

#### File: `/root/LoveBud/js/search/search-preview-hub-dom-patch.js`

| Line | Sink | Content Source | User Content? | Sanitized? | Notes |
|------|------|---------------|---------------|------------|-------|
| 46 | `.innerHTML =` | `summaryText` (from DOM textContent) | **Yes** | **No** | **REVIEW** — see above |
| 72 | `insertAdjacentHTML` | `renderSocialShell()` | No (static) | N/A | Static HTML only |

#### File: `/root/LoveBud/js/search/search-preview-playable-hub-patch.js`

| Line | Sink | Content Source | User Content? | Sanitized? | Notes |
|------|------|---------------|---------------|------------|-------|
| 109 | `.innerHTML =` | `renderIframe(embedUrl, title)` with `escapeHtml(title)` | Yes | Yes (title) | iframe src from constructed YouTube URL (safe) |
| 151 | `.innerHTML =` | `escapeHtml(title)` + `count` (Number) + `escapeHtml(range)` | Yes | Yes | |
| 153 | `.innerHTML =` | `escapeHtml(title)` + `count` (Number) | Yes | Yes | |
| 158 | `insertAdjacentHTML` | `renderSocialBar(tree)` — `escapeHtml()` on all stats | Yes | Yes | |

#### File: `/root/LoveBud/js/my-trees/my-trees-preview-hub.js`

| Line | Sink | Content Source | User Content? | Sanitized? | Notes |
|------|------|---------------|---------------|------------|-------|
| 235 | `.href =` | `'editor?treeId=' + encodeURIComponent(tree.id)` | Yes (tree.id) | Yes (encodeURIComponent) | |
| 249 | `.innerHTML =` | Icon + `escapeHtml(countStr)` | Yes | Yes | |
| 272 | `.innerHTML =` | `buildFlowStages()` — `escapeHtml(label)` | Yes (memories) | Yes | |
| 280 | `insertAdjacentHTML` | `buildFlowStages()` — `escapeHtml(label)` | Yes | Yes | |
| 282 | `.innerHTML =` | `buildFlowToggle()` — static i18n | No | N/A | |
| 284 | `.innerHTML =` | `buildFlowToggle()` — static i18n | No | N/A | |
| 295 | `.innerHTML =` | `escapeHtml(titleText)` + `escapeHtml(i18nHub())` | Yes/No | Yes | |
| 309 | `.innerHTML =` | i18nHub with `escapeHtml(displayTitle)` | Yes | Yes | |
| 331 | `.href =` | `'editor?treeId=' + encodeURIComponent(tree.id)` | Yes | Yes | |
| 332-333 | `.innerHTML =` | Icon + `escapeHtml(i18nHub(...))` | No | N/A | Static i18n |
| 366-367 | `.innerHTML =` | Icon + `escapeHtml(i18nHub(...))` | No | N/A | Loading state |
| 390 | `.href =` | `'editor?treeId=' + encodeURIComponent(tree.id)` | Yes | Yes | |
| 391-392 | `.innerHTML =` | Icon + `escapeHtml(i18nHub(...))` | No | N/A | Loading state |

#### File: `/root/LoveBud/js/detail/detail-connected.js`

| Line | Sink | Content Source | User Content? | Sanitized? | Notes |
|------|------|---------------|---------------|------------|-------|
| 52 | `.innerHTML =` | Template with `tText()` | No (static) | N/A | Loading state |
| 66 | `.innerHTML =` | Template with `buildConnectedEmptyMarkup()` | No (static) | N/A | |
| 76 | `.innerHTML =` | Template with `buildTemporarilyUnavailableMarkup()` | No (static) | N/A | |
| 86 | `.innerHTML =` | `flowMoments.map()` — `escapeHtml()` on all user fields | Yes | Yes | thumbnail, title, artist, timestamp, relationLabel all escaped. `data-detail-href` uses `buildDetailHref()` with URL encoding. |
| 123 | `.innerHTML =` | Template with `buildConnectedEmptyMarkup()` | No (static) | N/A | Empty state |

#### File: `/root/LoveBud/js/viewer/viewer-shell-render.js`

| Line | Sink | Content Source | User Content? | Sanitized? | Notes |
|------|------|---------------|---------------|------------|-------|
| 18 | `.innerHTML =` | Static HTML + `escapeHtml(treeTitle/creator/metaText)` | Yes | Yes | All user values escaped |

#### File: `/root/LoveBud/js/chat-first-workspace.js` (MOCK/PROTOTYPE ONLY)

| Line | Sink | Content Source | User Content? | Sanitized? | Notes |
|------|------|---------------|---------------|------------|-------|
| 127 | `.innerHTML =` | `''` (empty) | No | N/A | |
| 132 | `.innerHTML =` | `mom.type` + `mom.text` + `mom.date` | Yes (mock) | **No** | **REVIEW** — prototype |
| 149 | `.innerHTML =` | `''` (empty) | No | N/A | |
| 162 | `.innerHTML =` | `''` (empty) | No | N/A | |
| 271 | `.innerHTML =` | `mom.date` + `mom.text` + `mom.tags` | Yes (mock) | **No** | **REVIEW** — prototype |

#### File: `/root/LoveBud/js/search/search-copy-ui.js` (additional, uses DOM XSS sinks)

| Line | Sink | Content Source | User Content? | Sanitized? | Notes |
|------|------|---------------|---------------|------------|-------|
| 127 | `insertAdjacentHTML` | `renderCopyButton(treeId)` | Yes (treeId) | Yes (`escapeHtml`) | escapeHtml applied at lines 100-101 |

---

## Patterns Found

### 1. EscapeHtml-Protected innerHTML (Majority Pattern)
Most files consistently apply `escapeHtml()` to user-generated content before inserting it via `.innerHTML =`. This is the recommended pattern and is used correctly in:
- `public-tree-viewer.js` (all 8 innerHTML assignments with user content)
- `detail-render.js` (tags, channel, tree title)
- `detail-video.js` (thumbnails, titles, watch URLs)
- `my-trees-preview-hub.js` (all user content via buildFlowStages, buildFlowToggle)
- `detail-connected.js` (thumbnails, titles, timestamps, artists)
- `viewer-shell-render.js` (tree title, creator, meta)

### 2. sanitizeUrl-Protected iframe src
- `public-tree-viewer.js` line 324-328: YouTube embed URLs are sanitized via `sanitizeUrl()` before being placed in iframe src

### 3. encodeURIComponent-Protected href
- `my-trees-preview-hub.js` lines 235, 331, 390: `tree.id` is encoded with `encodeURIComponent()` before being placed in `href` attributes

### 4. Unprotected innerHTML (REVIEW Items)
- **`search-preview-hub-dom-patch.js` line 46**: Text content extracted via `textContent()` is re-injected via `.innerHTML` without escaping, creating a potential entity-decoding XSS vector
- **`chat-first-workspace.js` lines 132, 271**: Mock/prototype code with no escaping — unsafe pattern if reused in production

---

## Recommendations

1. **Fix `search-preview-hub-dom-patch.js:46`** — Apply `escapeHtml(summaryText)` before innerHTML assignment:
   ```javascript
   copy.innerHTML = '<p class="preview-summary-line">' + escapeHtml(summaryText) + '</p>';
   ```

2. **Fix `detail-video.js:57`** — Apply `escapeHtml()` to `iframeSrc` for defense-in-depth:
   ```javascript
   src="${escapeHtml(iframeSrc)}"
   ```

3. **Mark `chat-first-workspace.js` as mock-only** — Add `/* MOCK ONLY — NOT FOR PRODUCTION */` comments at the innerHTML sinks (lines 132, 271). If this code is ever promoted to production, escapeHtml must be applied.

4. **General guidance** — All `.innerHTML = `, `.insertAdjacentHTML()`, and template literal assignments containing user-generated content should go through `LoveBudSecurity.escapeHtml()`. All URL assignments (src, href) to user-controlled values should go through `LoveBudSecurity.sanitizeUrl()`.
