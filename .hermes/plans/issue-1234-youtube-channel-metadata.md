# YouTube Channel Metadata — Implementation Plan

> Issue: #1234
> Status: Design/Plan (docs-only)
> No runtime changes, no DB migration, no backend/API/schema/Auth/DB changes.

---

## 1. Current Memory Data Flow

### 1.1 Create Memory Pipeline

```
Frontend (buildMemoryPayload)  →  CF API proxy (memories.js)  →  Modal backend (create_owner_memory)  →  DB
```

| Layer | File | Key Details |
|-------|------|-------------|
| **Frontend payload** | `js/editor/editor-memory-form-payload.js` | `buildMemoryPayload()` returns: `treeId, title, memo, timestamp, sourceUrl, sourceType, emotionTags, parentId, thumbnail, artist, source, visibility` — **no channel fields** |
| **Frontend preview** | `js/editor/editor-memory-form-preview.js` | Preview update on URL paste — no channel extraction |
| **CF API POST** | `functions/api/memories.js` | `onRequestPost` — body pass-through only, no field transformation |
| **Modal create** | `modal_compute/owner_writes.py` L49-100 | `create_owner_memory()` — SQL INSERT with **hardcoded column list** (12 columns + id + timestamps), **no channel columns** |
| **Modal create INSERT** | Same file L65-75 | Columns: `id, tree_id, parent_id, title, memo, artist, source, source_url, source_type, thumbnail, emotion_tags, timestamp, visibility` |
| **Modal create RETURNING** | Same file L72-74 | Same columns RETURNING |

### 1.2 Update Memory Pipeline

```
Frontend  →  CF API proxy (memories/[id].js)  →  Modal backend (update_owner_memory)  →  DB
```

| Layer | File | Key Details |
|-------|------|-------------|
| **CF API PUT** | `functions/api/memories/[id].js` | `onRequestPut` — body pass-through |
| **Modal update** | `modal_compute/owner_writes.py` L222-293 | Dynamic SET clause per field — easy to add channel blocks. RETURNING has hardcoded columns. |

### 1.3 Read Memory Pipeline

```
DB  →  Modal read  →  CF API (passthrough)  →  JS normalize  →  Detail panel
```

| Layer | File | Key Details |
|-------|------|-------------|
| **Modal query (owner)** | `modal_compute/owner_reads.py` L63-92 | `fetch_owner_memories()` — SELECT has **hardcoded 15 columns** |
| **Modal query (public)** | `modal_compute/public_reads.py` L114-143 | `fetch_public_memories()` — same hardcoded SELECT |
| **Modal query (public single)** | `modal_compute/public_reads.py` L146-168 | `fetch_public_memory()` — same |
| **Modal query (fork source)** | `modal_compute/owner_writes.py` L380-388 | `fetch_source_memories_query` — SELECT has hardcoded columns |
| **Python normalize** | `modal_compute/validation.py` L73-90 | `normalize_memory_row()` → `{id, treeId, parentId, title, memo, artist, source, sourceUrl, sourceType, thumbnail, emotionTags, timestamp, visibility, createdAt, updatedAt}` — **no channel fields** |
| **JS normalize (canonical)** | `js/utils/normalize.js` L24-52 | `normalizeMemory()` → flat camelCase — **no channel fields** |
| **JS normalize (editor)** | `js/editor/editor-data-loader.js` L7-40 | Fallback normalize — same shape, no channel fields |
| **Detail panel** | `js/editor/editor-detail-ui.js` | `updateDetailPanel()` renders title, thumbnail, date, tags, memo — **no channel source link** |
| **Search preview** | `js/search/search-preview-renderer.js` | Renders memory source info — no channel display |
| **Search cards** | `js/search/search-card-renderer.js` | Tree card rendering — no channel info |

### 1.4 API Pass-through Summary

All 6 CF API write endpoints use `readBoundedWriteBody` (body-size guard) then forward the JSON body as-is to Modal:

| Endpoint | Method | File | Pass-through |
|----------|--------|------|-------------|
| `/api/trees` | POST | `trees.js` | ✅ Body forwarded as-is |
| `/api/trees/:id` | PUT | `trees/[id].js` | ✅ Body forwarded as-is |
| `/api/memories` | POST | `memories.js` | ✅ Body forwarded as-is |
| `/api/memories/:id` | PUT | `memories/[id].js` | ✅ Body forwarded as-is |
| `/api/*` (fork) | POST | `[[path]].js` | ✅ Catch-all forwarding (body-size guard + fork guard) |

**Key insight:** CF API proxy requires **zero changes** for channel metadata — new fields in the JSON body are automatically forwarded to Modal.

### 1.5 Fork Flow (`[[path]].js`)

- `functions/api/[[path]].js` — catch-all route with body-size guard and fork guard
- POST to `/api/trees/:treeId/fork` reaches this handler, which forwards to Modal's `fork_public_tree()`
- Fork's SELECT and INSERT queries have hardcoded column lists — need channel column additions

---

## 2. Required Fields

| Field | DB Column | Type | JS Field | Example | Optional |
|-------|-----------|------|----------|---------|----------|
| Channel ID | `channel_id` | `VARCHAR(100)` | `channelId` | `@woowayoung` or `UC...` | ✅ Yes |
| Channel Name | `channel_name` | `VARCHAR(200)` | `channelName` | `우아한형제들` | ✅ Yes |
| Channel URL | `channel_url` | `VARCHAR(1000)` | `channelUrl` | `https://youtube.com/@woowayoung` | ✅ Yes |

### Null/default semantics
- All three fields: nullable with default `NULL`
- `NULL` means "not yet extracted" or "not applicable"
- Normalize output: `channelId: null`, `channelName: null`, `channelUrl: null` when DB is `NULL`
- Existing memories without channel fields → all three are `null` → display nothing

---

## 3. Storage Strategy

### 3.1 DB Schema Change (future, Phase 1)

```sql
ALTER TABLE memories
  ADD COLUMN channel_id   VARCHAR(100) DEFAULT NULL,
  ADD COLUMN channel_name VARCHAR(200) DEFAULT NULL,
  ADD COLUMN channel_url  VARCHAR(1000) DEFAULT NULL;
```

### 3.2 Field Mapping Convention

| DB column | Python (normalize_memory_row) | JS (normalizeMemory) |
|-----------|-------------------------------|---------------------|
| `channel_id` | `channelId` | `channelId` |
| `channel_name` | `channelName` | `channelName` |
| `channel_url` | `channelUrl` | `channelUrl` |

All three follow existing pattern: DB `snake_case` → Python/JS `camelCase`, with JS `normalizeMemory` also accepting `channel_id` as transitional fallback.

### 3.3 Error/Edge Cases

- **missing fields**: NULL allowed, detail panel shows nothing
- **unparseable YouTube URL**: channel fields remain NULL, no error
- **non-YouTube source**: channel fields remain NULL, no error
- **partial data** (has channelId but no channelName): safe to render with channelId display
- **very long channelName**: capped at 200 chars by `validate_optional_string`

---

## 4. Extraction Strategy

### 4.1 YouTube URL Analysis

Given a YouTube URL, what can we always extract?

| URL Format | Can Extract Channel? | Notes |
|------------|---------------------|-------|
| `https://youtu.be/{videoId}` | ❌ No | Short URL has no channel info |
| `https://www.youtube.com/watch?v={videoId}` | ❌ No | Normal watch URL has no channel in path |
| `https://www.youtube.com/embed/{videoId}` | ❌ No | Embed URL has no channel info |
| `https://www.youtube.com/@channelName` | ✅ Channel name | Direct channel URL |
| `https://www.youtube.com/@channelName/video` | ✅ Channel name | Channel video URL |
| `https://www.youtube.com/channel/UC...` | ✅ Channel ID | Legacy channel URL |
| `https://m.youtube.com/watch?v=...` | ❌ No | Mobile URL, no channel info |

**Key finding: Regular YouTube watch/embed URLs do NOT contain channel information.** You cannot extract channelName or channelUrl from a standard `youtu.be/xxx` or `youtube.com/watch?v=xxx` or `youtube.com/embed/xxx` URL.

### 4.2 Extraction Options

#### Option A: oEmbed API (recommended for Phase 1 backend)

YouTube's oEmbed endpoint returns `author_name` (channel name) and `author_url` (channel URL):

```
GET https://www.youtube.com/oembed?url={VIDEO_URL}&format=json
```

Response:
```json
{
  "title": "...",
  "author_name": "우아한형제들",
  "author_url": "https://www.youtube.com/@woowayoung"
}
```

- ✅ Returns channelName and channelUrl from any YouTube URL
- ✅ No API key required
- ⚠️ No channelId returned (would need YouTube Data API for that)
- ⚠️ Rate-limited but generous for per-memory usage

#### Option B: YouTube Data API v3

```
GET https://www.googleapis.com/youtube/v3/videos?part=snippet&id={VIDEO_ID}&key={API_KEY}
```

- ✅ Returns channelId, channelName, channelUrl
- ✅ Canonical source
- ❌ Requires API key
- ❌ Quota cost per request

#### Option C: Frontend-only extraction (limited)

- From `youtube.com/@channelName` URLs: extract from URL path
- From standard `watch?v=xxx` URLs: **cannot extract** without network call
- ❌ Cannot handle most common YouTube URL formats
- ❌ Cross-origin restrictions for YouTube metadata APIs from browser

### 4.3 Recommendation

**Phase 1:** Use oEmbed API in the **Modal backend** (not frontend). When a memory is created/updated with `sourceType=youtube` and the channel fields are not already provided:

1. Modal backend calls `https://www.youtube.com/oembed?url={sourceUrl}&format=json`
2. Extracts `author_name` → `channelName`, `author_url` → `channelUrl`
3. Stores in DB alongside other memory fields
4. If oEmbed fails or timeout → fields remain NULL, no error thrown

**Rationale:**
- Frontend cannot reliably extract channel from most YouTube URLs
- oEmbed requires no API key and has no quota for basic usage
- Backend extraction keeps frontend simple
- If user provides channel fields explicitly in payload, skip oEmbed call (override)

### 4.4 Partial URL Parsing (frontend fallback)

Even with backend extraction, the frontend can do lightweight parsing for instant preview:

```javascript
function extractFromYouTubeUrl(url) {
  // Match @channelName patterns: youtube.com/@ChannelName or youtube.com/@ChannelName/video/...
  const atMatch = url.match(/youtube\.com\/@([A-Za-z0-9_-]+)/);
  if (atMatch) {
    return {
      channelName: atMatch[1],
      channelUrl: `https://www.youtube.com/@${atMatch[1]}`
    };
  }
  // Match /channel/UC... patterns
  const channelMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (channelMatch) {
    return {
      channelId: channelMatch[1],
      channelUrl: `https://www.youtube.com/channel/${channelMatch[1]}`
    };
  }
  return null;
}
```

This can be used in the preview panel for instant display, with the Modal backend providing the authoritative data.

---

## 5. Phased Implementation Plan

### Phase 1: Schema + Backend Optional Pass-through
**Files changed:** Modal Python (5 files), test contracts (1 file)

| File | Change |
|------|--------|
| `modal_compute/validation.py` | `normalize_memory_row()` — add `channelId`, `channelName`, `channelUrl` fields |
| `modal_compute/owner_writes.py` | `create_owner_memory()` — add channel columns to INSERT + RETURNING SQL |
| `modal_compute/owner_writes.py` | `update_owner_memory()` — add channel field handling + RETURNING columns |
| `modal_compute/owner_writes.py` | `fork_public_tree()` — add channel to SELECT + INSERT SQL |
| `modal_compute/owner_reads.py` | `fetch_owner_memories()` — add channel columns to SELECT |
| `modal_compute/public_reads.py` | `fetch_public_memories()`, `fetch_public_memory()` — add channel to SELECT |
| DB migration script | `ALTER TABLE memories ADD COLUMN ...` (3 columns) |

**Verification:**
- `npm run test` — update contract tests for new fields
- `npm run lint` (Python)
- Modal endpoint smoke test

### Phase 2: Frontend Payload + Normalize
**Files changed:** JS (4 files)

| File | Change |
|------|--------|
| `js/utils/normalize.js` | `normalizeMemory()` — add `channelId`, `channelName`, `channelUrl` with fallback to `channel_id` etc. |
| `js/editor/editor-data-loader.js` | `createNormalizeMemory()` fallback — add same channel fields |
| `js/editor/editor-memory-form-payload.js` | `buildMemoryPayload()` — add channel fields if extractable from URL |
| `js/search/search-data-adapter.js` | Ensure channel fields pass through |

**Verification:**
- `npm run test`
- `npm run lint`
- `npm run build`

### Phase 3: Detail Panel Display
**Files changed:** JS (3 files), CSS (maybe 1)

| File | Change |
|------|--------|
| `js/editor/editor-detail-ui.js` | `updateDetailPanel()` — add "from @ChannelName" link in thumbnail overlay or info section |
| `js/editor/editor-i18n-refresh.js` | Add i18n key for channel source text |
| `css/editor/*.css` | Optional styling for channel badge/link |

**Smoke test:**
- Create memory with YouTube URL → channel info shown in detail panel
- Edit memory URL → channel info updates
- Existing memory without channel data → no channel link shown

### Phase 4: Backfill / Future Channel Entity (out of scope)
- No backfill of existing memories
- Future: `/api/channels` endpoints, subscription model, browse-by-channel

---

## 6. Risk Checklist

| Risk | Mitigation |
|------|------------|
| ❓ Existing memories without channel fields break | ✅ Not — `NULL` default, optional display gate |
| ❓ Missing channel fields in payload cause 400 | ✅ Not — `validate_optional_string` handles `None` gracefully |
| ❓ Unparseable YouTube URL throws error | ✅ Not — oEmbed failure silently returns NULL fields |
| ❓ oEmbed rate limit reached | ✅ Degrade gracefully — channel fields remain NULL |
| ❓ Channel data leaks in console logs | ✅ Sanitize — only channelName/URL, no secrets |
| ❓ Fork copies channel fields correctly | ✅ Add to fork SELECT + INSERT |
| ❓ Body-size guard regression (PR #1207) | ✅ No change to CF API proxy files |
| ❓ Channel field sent to non-YouTube memory | ✅ Filter on frontend + backend — stored as NULL for non-YouTube |

---

## 7. Test Plan

### 7.1 Unit/Contract Tests

| Test | File |
|------|------|
| `normalize_memory_row` returns channel fields | `tests/contracts/test_*.py` or JS test |
| `normalizeMemory` handles null/undefined channel fields | JS test |
| Channel fields passthrough in API body | `tests/api-contract-transitional.test.js` |
| Memory CRUD with channel fields | `tests/contracts/test_*.py` |

### 7.2 API Smoke

| Test | Endpoint |
|------|----------|
| POST memory with channel fields → stored | `/api/memories` |
| GET memory with channel fields → returned | `/api/memories?treeId=...` |
| PUT memory update channel fields → updated | `/api/memories/:id` |
| POST memory without channel fields → OK (NULL) | `/api/memories` |
| Existing memory without channel → loads fine | `/api/memories/:id` |

### 7.3 Editor Create/Update Smoke

| Step | Expected |
|------|----------|
| Paste YouTube URL → preview shows channel name | Channel extracted |
| Create memory → detail panel shows "from @ChannelName" | Link present |
| Edit URL to different channel → channel info updates | Updated |
| Edit title/memo (no URL change) → channel info preserved | No regression |

### 7.4 Existing Memories Smoke

| Step | Expected |
|------|----------|
| Load tree with old memories → no channel display error | No console errors |
| Select old memory → detail panel shows no channel link | No JS errors |
| Edit old memory save → channel fields remain NULL | No unintended mutation |

---

## Files Summary (Complete Inventory)

### Backend — Must Change (Phase 1)

| # | File | Scope | Change Type |
|---|------|-------|-------------|
| 1 | `modal_compute/validation.py` | `normalize_memory_row()` — add channelId/Name/Url | Add fields |
| 2 | `modal_compute/owner_writes.py` | `create_owner_memory()` — INSERT + RETURNING | Add columns |
| 3 | `modal_compute/owner_writes.py` | `update_owner_memory()` — SET + RETURNING | Add fields + columns |
| 4 | `modal_compute/owner_writes.py` | `fork_public_tree()` — SELECT + INSERT | Add columns |
| 5 | `modal_compute/owner_reads.py` | `fetch_owner_memories()` — SELECT | Add columns |
| 6 | `modal_compute/public_reads.py` | `fetch_public_memories()`, `fetch_public_memory()` — SELECT | Add columns |
| 7 | `js/utils/normalize.js` | `normalizeMemory()` — add channel fallback fields | Add fields |
| 8 | `js/editor/editor-data-loader.js` | `createNormalizeMemory()` — add same fallback | Add fields |
| 9 | DB migration script | `ALTER TABLE memories` | Add 3 columns |

### Frontend — Must Change (Phase 2)

| # | File | Change |
|---|------|--------|
| 10 | `js/editor/editor-memory-form-payload.js` | `buildMediaSource()` / `buildMemoryPayload()` — extract and include channel fields |
| 11 | `js/editor/editor-memory-form-preview.js` | `update()` — show channel info in preview when URL pasted |

### Frontend — Must Change (Phase 3)

| # | File | Change |
|---|------|--------|
| 12 | `js/editor/editor-detail-ui.js` | `updateDetailPanel()` — add "from @ChannelName" link |
| 13 | `js/editor/editor-dom-selectors.js` | Add channel display element selectors |
| 14 | `js/editor/editor-shell-helpers.js` | Add channel display helper |
| 15 | `js/editor/editor-i18n-refresh.js` | Add channel-related text bindings |
| 16 | `css/editor/*.css` | Styling for channel badge/link (optional) |

### No Change Needed

| # | File | Reason |
|---|------|--------|
| ✅ | `functions/api/memories.js` | Body pass-through — forwards channel fields automatically |
| ✅ | `functions/api/memories/[id].js` | Same |
| ✅ | `functions/api/trees.js` | Same |
| ✅ | `functions/api/trees/[id].js` | Same |
| ✅ | `functions/api/[[path]].js` | Catch-all fork handler — body pass-through |
| ✅ | All search preview/card/renderer files | Tree-level display, not memory-level |
| ✅ | `js/search/search-preview-renderer.js` | Same |
| ✅ | `js/search/search-card-renderer.js` | Same |
| ✅ | `js/my-trees/my-trees-preview-hub.js` | Same |
| ✅ | `js/detail/detail-loader.js` | Uses `normalizeMemory` — channel auto-included |

---

## Recommended First PR

- **Title:** `docs(channel): plan YouTube channel metadata rollout`
- **Branch:** `docs/issue-1234-youtube-channel-metadata-plan`
- **Content:** This document only
- **Tests/Lint/Build:** Not required (docs-only PR)
- **Body:** `Refs #1234` (no close keyword)

## Next Steps (after this PR merges)

1. CTO approves Phase 1 scope
2. Create `feat/issue-1234-phase1-schema-backend` PR — DB migration + Modal backend changes
3. After Phase 1 merges, create `feat/issue-1234-phase2-frontend-payload` PR
4. Finally `feat/issue-1234-phase3-detail-panel` PR
