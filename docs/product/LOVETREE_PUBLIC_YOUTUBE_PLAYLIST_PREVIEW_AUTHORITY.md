# LoveTree Public YouTube Playlist Preview — Read-Only Authority

**Issue:** #3906 — [Import][YouTube][Audit] Select the public-playlist read-only preview authority
**Parent:** #3897 — Keep OPEN.
**Prerequisite:** #3903 (CLOSED completed), PR #3905 (merged).
**Product parent:** #1882 — Keep OPEN. Use only `Refs #1882`.
**Status:** Authority audit — implementation-ready contract.
**Last updated:** 2026-08-07

---

## 1. Purpose / scope

This document defines the single authority contract for a **read-only public YouTube playlist preview** — the first runtime slice of the #3897 import track. It is not an implementation. It fixes the contract so that a future child issue can implement a small, safe, bounded preview route.

Scope:

```text
public YouTube playlist URL or playlist ID
→ validation / normalization
→ ordered read-only preview
→ Tree write 0
→ Moment write 0
```

Non-scope:

```text
no YouTube API call in this audit
no route file creation
no schema/migration
no OAuth
no bookmark import
no semantic Connection creation
no video download/transcode/re-host
no Production/Preview access
```

---

## 2. Current-main authority map

Audited at `origin/main` SHA `0ca51df62f07ce9594ba3c8e516632af1c590e9c`.

### Active same-origin runtime

```text
browser → same-origin /api/* → Cloudflare Pages Functions → Modal compute → Neon
```

| Layer | Owner | Evidence |
|-------|-------|---------|
| Edge proxy | `functions/api/[[path]].js` | catch-all `/api/*` → Modal `/modal/*` |
| Tree routes | `functions/api/trees.js`, `functions/api/trees/[id].js` | `/api/trees`, `/api/trees/:id` |
| Memory routes | `functions/api/memories.js` → `functions/_shared/memory-route-proxy.js` | `/api/memories`, `/api/memories/:id` |
| YouTube oEmbed | `functions/api/youtube/oembed.js` | `/api/youtube/oembed?url=...` (channel metadata only) |
| Scout routes | `functions/api/scout/suggest.js`, `save-memory.js` | `/api/scout/suggest`, `/api/scout/save-memory` |
| Backend compute | Modal (`MODAL_BASE_URL` env) | all write + most read |
| Persistence | Neon (via Modal) | not directly accessible from edge |

### Legacy routes excluded

- Vercel: not active production.
- Netlify: legacy artifact, not active fallback.
- No `api/` directory at repo root (only `functions/api/`).

### Existing YouTube backend

`functions/api/youtube/oembed.js` — GET `/api/youtube/oembed?url=...`:
- Validates YouTube host (`youtube.com`, `youtu.be`).
- Extracts video ID.
- Calls `https://www.youtube.com/oembed` (no API key required).
- Returns `{ channelId, channelName, channelUrl }`.
- Does NOT handle playlists.
- Does NOT use YouTube Data API v3.

### Auth forwarding pattern

Cloudflare edge forwards `Authorization: Bearer <token>` header to Modal. No server-side Firebase token verification at the edge (except Scout's mock-disabled `live-auth-verifier-adapter.js`).

### Error conventions

Two conventions coexist:

| Convention | Shape | Used by |
|------------|-------|---------|
| Proxy simple | `{ error: "message" }` + status | `[[path]].js`, `trees.js`, `memories.js`, `oembed.js` |
| Scout envelope | `{ ok: false, error: { code, message } }` | `scout/suggest.js`, `scout/save-memory.js` |

The preview route should adopt the **Scout envelope** convention (`{ ok, error: { code, message } }`) because it is a new self-contained route, not a Modal proxy.

---

## 3. Existing reusable contracts

### Memory schema fields (from `js/utils/normalize.js`)

| Field | Status | Notes |
|-------|--------|-------|
| `sourceUrl` / `source_url` | EXISTING_CANONICAL | camelCase canonical; snake_case transitional fallback |
| `sourceType` / `source_type` | EXISTING_CANONICAL | default `'youtube'` |
| `thumbnail` | EXISTING_CANONICAL | URL string |
| `artist` | EXISTING_CANONICAL | channel/creator display name |
| `channelId` / `channel_id` | EXISTING_CANONICAL | YouTube channel ID |
| `channelName` / `channel_name` | EXISTING_CANONICAL | |
| `channelUrl` / `channel_url` | EXISTING_CANONICAL | |
| `title` | EXISTING_CANONICAL | |
| `memo` / `description` | EXISTING_CANONICAL | |
| `timestamp` | EXISTING_CANONICAL | display string |
| `emotionTags` | EXISTING_CANONICAL | array |
| `parentId` | EXISTING_CANONICAL | tree structure |
| `delay` | EXISTING_CANONICAL | animation delay |
| `x`, `y` | EXISTING_CANONICAL | canvas position |
| `provider` | EXISTING_PARTIAL | only in `js/utils/media.js` (`provider: 'youtube'`), not in normalized memory schema |
| `externalVideoId` / `externalId` | ABSENT | does not exist in schema |
| `source ordering` | ABSENT | no field for source playlist position |
| `import provenance` | ABSENT | no field tracking import origin |
| `start time` / `end time` | ABSENT | listed as blocker in `docs/planning/MOMENT_VIDEO_CLIP_PLAYLIST_PLANNING.md` |
| `source availability` | ABSENT | no field for video availability status |

### Existing YouTube client utilities (`js/utils/media.js`)

- `extractYouTubeId(url)` — extracts 11-char video ID from various YouTube URL forms.
- `classifyYouTubeUrl(url)` — returns `{ kind: 'video'|'channel'|'unknown', sourceType, videoId, provider }`.
- `getThumbnailUrl(videoId, quality)` — builds `https://i.ytimg.com/vi/{id}/{quality}.jpg`.
- `getEmbedUrl(videoId)` — builds embed URL.
- No playlist parsing utility exists.

### Existing oEmbed route (`functions/api/youtube/oembed.js`)

- Host validation: `youtube.com`, `youtu.be` (after stripping `www.` / `m.`).
- Video ID extraction: watch, youtu.be, embed, shorts, live paths.
- Channel URL sanitization: `@handle` and `/channel/UC...` forms.
- No playlist ID extraction.

---

## 4. Confirmed gaps

| Gap | Impact on preview |
|-----|-----------------|
| No playlist ID parser | Must be built |
| No YouTube Data API v3 integration | Must be built (server-side only) |
| No `externalVideoId` in schema | Preview response uses `videoId` from API; not persisted in preview |
| No `source ordering` field | Preview response carries `position` from API; not persisted |
| No `source availability` field | Preview response carries item-level `state`; not persisted |
| No `import provenance` field | Preview is read-only; no persistence |
| No `start time` / `end time` | Out of scope for preview; belongs to #3897 Phase 0+ |
| No API key configuration | `CONFIGURATION_REQUIRED` — see §19 |

---

## 5. Official YouTube provider constraints

Verified against official documentation (developers.google.com/youtube/v3, last updated 2026-06-01 / 2026-07-08).

### playlistItems.list

| Property | Value |
|----------|-------|
| Endpoint | `GET https://www.googleapis.com/youtube/v3/playlistItems` |
| Quota cost | 1 unit per request |
| maxResults | 0–50 (default 5) |
| Pagination | `nextPageToken` / `prevPageToken` |
| Required filter | `playlistId` or `id` |
| Useful parts | `snippet` (title, description, position, resourceId.videoId, thumbnails, channelTitle, publishedAt), `contentDetails` (videoId, startAt, endAt), `status` (privacyStatus) |
| Error: playlistNotFound (404) | playlist not found |
| Error: playlistItemsNotAccessible (403) | not authorized to retrieve playlist |
| Error: watchHistoryNotAccessible (403) | watch history not retrievable |
| Error: watchLaterNotAccessible (403) | watch later not retrievable |
| Error: playlistOperationUnsupported (400) | API does not support listing videos in the specified playlist |

### playlists.list

| Property | Value |
|----------|-------|
| Endpoint | `GET https://www.googleapis.com/youtube/v3/playlists` |
| Quota cost | 1 unit per request |
| maxResults | 0–50 (default 5) |
| Filter | `id` (playlist ID), `channelId`, or `mine` |
| Useful parts | `snippet` (title, description, channelTitle, publishedAt), `contentDetails` (itemCount), `status` (privacyStatus) |
| Error: playlistNotFound (404) | playlist not found |
| Error: playlistForbidden (403) | playlist does not support request or not authorized |

### videos.list

| Property | Value |
|----------|-------|
| Endpoint | `GET https://www.googleapis.com/youtube/v3/videos` |
| Quota cost | 1 unit per request |
| maxResults | 1–50 (default 5); note: `maxResults` not supported with `id` parameter |
| Filter | `id` (comma-separated video IDs), `chart`, or `myRating` |
| Useful parts | `snippet` (title, description, channelTitle, thumbnails, tags, categoryId), `contentDetails` (duration, definition, caption), `status` (privacyStatus, embeddable, license) |
| Error: videoNotFound (404) | video not found |

### Quota

| Property | Value |
|----------|-------|
| Default daily quota | 10,000 units (combined for all endpoints except search.insert and videos.insert) |
| search.list quota | 100 calls/day default (separate allocation) |
| videos.insert quota | 100 calls/day default (separate allocation) |
| Read operation cost | 1 unit (playlistItems.list, playlists.list, videos.list) |
| Quota extension | via Quota extension request form |

### Key API constraint: `playlistItems.list` `status` part

The `status` part of `playlistItems.list` returns `privacyStatus` for each playlist item. This is the primary signal for detecting private/removed items within a public playlist.

---

## 6. Accepted source forms and normalization

### Accepted hosts

```text
https://www.youtube.com/playlist?list=PL...
https://youtube.com/playlist?list=PL...
https://m.youtube.com/playlist?list=PL...
```

### Accepted bare playlist ID

```text
PL... (YouTube playlist ID, typically starts with PL, UU, LL, FL, RD)
```

Playlist ID shape: alphanumeric, hyphens, underscores. Typical length 18–34 characters. The parser must validate against the YouTube playlist ID pattern but must NOT assume a specific prefix — YouTube playlist IDs do not always start with `PL`.

### Normalization output

```text
{ playlistId: "PL...", source: "youtube" }
```

### Rejected source forms

| Form | Reason |
|------|--------|
| `http://` (non-HTTPS) | rejected scheme |
| `www.youtube.com/watch?v=...&list=...` | watch URL, not playlist URL — rejected (ambiguous; user should copy playlist URL) |
| `youtu.be/...?list=...` | short URL with list param — rejected (ambiguous) |
| `music.youtube.com/playlist?list=...` | YouTube Music — rejected in first slice (different content domain) |
| `file:`, `ftp:`, `javascript:`, `data:` | rejected scheme |
| arbitrary hostname | rejected host |
| empty / null / non-string | rejected |
| playlist ID with special characters | rejected |

### Normalization rules

1. Strip leading/trailing whitespace.
2. If input looks like a URL, parse with `new URL()`.
3. Require `https:` protocol.
4. Normalize host: strip `www.` prefix.
5. Accept only `youtube.com` host with `/playlist` path and `list` query param.
6. Extract `list` param value as playlist ID.
7. If input is not a URL, treat as bare playlist ID — validate shape.
8. Reject if playlist ID is empty or does not match `^[A-Za-z0-9_-]{10,80}$`.

---

## 7. Proposed same-origin route

| Property | Value |
|----------|-------|
| Method | `POST` |
| Path | `/api/import/youtube/playlist/preview` |
| Auth requirement | `AUTH_REQUIRED` (see §8) |
| Request content type | `application/json` |
| Max request size | 4 KB |
| Runtime owner | Cloudflare Pages Functions (`functions/api/import/youtube/playlist/preview.js`) |
| Provider adapter | server-side module within the route file or a sibling module under `functions/api/import/youtube/` |
| Timeout owner | Cloudflare edge (route-level `AbortController` or `Promise.race` with timeout) |
| Error normalization owner | route handler (Scout envelope convention) |

Route naming rationale: follows existing `functions/api/` convention (`/api/youtube/oembed` exists). The `import/youtube/playlist/preview` path is descriptive and does not collide with existing routes. No existing `import/` directory exists — this is a new namespace.

---

## 8. Authentication decision

**Decision: `AUTH_REQUIRED`**

Rationale:

- The tutorial entry point is the logged-in My Trees / Editor area (per #3903 merged tutorial contract §4: "YouTube 재생목록 가져오기" is a logged-in import flow).
- Anonymous access would allow quota exhaustion abuse without accountability.
- The existing same-origin API pattern forwards `Authorization: Bearer <token>` to the backend.
- The preview route does not need to verify the token at the edge (consistent with existing proxy pattern), but must require its presence.
- Future import (child issue 3 in tutorial §12) connects to Tree creation, which is owner-scoped.

The route must reject requests without an `Authorization` header with `401` and error code `UNAUTHORIZED`.

---

## 9. Request contract

```json
{
  "source": "https://www.youtube.com/playlist?list=PL..."
}
```

Alternative (bare playlist ID):

```json
{
  "playlistId": "PL..."
}
```

### Conflict rules

| Input | Behavior |
|-------|---------|
| Both `source` and `playlistId` provided | `source` takes precedence; `playlistId` is ignored |
| Only `source` provided | parse URL → extract playlist ID |
| Only `playlistId` provided | validate shape directly |
| Neither provided | `400 INVALID_PLAYLIST_SOURCE` |
| `source` is empty string | `400 INVALID_PLAYLIST_SOURCE` |
| `source` is null | `400 INVALID_PLAYLIST_SOURCE` |
| `source` is non-string | `400 INVALID_PLAYLIST_SOURCE` |
| `source` exceeds 2048 chars | `400 INVALID_PLAYLIST_SOURCE` |
| `source` is malformed URL | `400 INVALID_PLAYLIST_SOURCE` |
| `source` is unsupported host | `400 UNSUPPORTED_PLAYLIST_SOURCE` |
| `source` is non-HTTPS | `400 UNSUPPORTED_PLAYLIST_SOURCE` |
| `playlistId` is empty | `400 INVALID_PLAYLIST_SOURCE` |
| `playlistId` does not match shape | `400 INVALID_PLAYLIST_SOURCE` |
| Unknown extra fields | ignored (not rejected) |

---

## 10. Ordered preview response contract

### Success response (200)

```json
{
  "ok": true,
  "playlist": {
    "id": "PL...",
    "title": "Playlist Title",
    "channelTitle": "Channel Name",
    "itemCount": 42,
    "truncated": false
  },
  "items": [
    {
      "position": 0,
      "videoId": "dQw4w9WgXcQ",
      "title": "Video Title",
      "description": "Truncated description...",
      "channelTitle": "Channel Name",
      "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      "state": "AVAILABLE",
      "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    }
  ],
  "truncated": false,
  "totalItems": 42,
  "previewedItems": 42
}
```

### Ordering

- `items[].position` reflects the YouTube playlist order (0-indexed).
- Playlist order is **playback order only**. It must NOT create semantic LoveTree Connections.
- No `parentId`, `connectionId`, or relationship field is generated.

### Write guarantees

- Tree write: **0**
- Moment write: **0**
- No persistence of any kind.
- No `POST /api/trees`, `POST /api/memories`, or any write endpoint is called.

---

## 11. Unavailable/private/deleted item policy

### Item state model

| State | Meaning | Source |
|-------|---------|--------|
| `AVAILABLE` | Video is public and embeddable | `playlistItems.list` status.privacyStatus === `public` or `unlisted` (playlist is accessible) |
| `UNAVAILABLE` | Video is private, deleted, or region-blocked | `playlistItems.list` status.privacyStatus === `private`; or video not found in enrichment |
| `METADATA_PARTIAL` | Playlist item exists but video metadata is incomplete | `playlistItems.list` returns item but `videoId` is empty or title is "Private video" / "Deleted video" |
| `THUMBNAIL_UNAVAILABLE` | Thumbnail URL exists but image is not loadable | Determined by client-side image load failure, not server-side |
| `UNKNOWN` | State cannot be determined | Provider error, malformed response, or unexpected state |

### Policy

- `BOUNDED_PARTIAL_WITH_EXPLICIT_STATE` — unavailable items are included in the preview with their state explicitly shown. They are NOT silently dropped.
- A playlist with some unavailable items still returns `200` with the available items and explicit unavailable items.
- The tutorial contract (#3903 §5.3) requires: "each such item shown explicitly with an unavailable state label; never silently dropped from the preview."
- YouTube API returns `title: "Private video"` or `title: "Deleted video"` for such items — the preview must preserve this signal and map to the appropriate state.

### Thumbnail-unavailable policy

- `thumbnailUrl` in the response is the YouTube-provided thumbnail URL from `playlistItems.list` `snippet.thumbnails`.
- `thumbnailUrl` existence does NOT guarantee image loadability.
- The client must handle thumbnail load failure with a deterministic LoveBud placeholder, NOT by retrying alternate YouTube thumbnail hosts.
- The client must NOT chain `img.youtube.com` → `i.ytimg.com` fallback retries (this was the source of the Production 404 console errors observed in #3912 verification).
- The response includes `thumbnailUrl` as-is; the client owns the fallback rendering decision.

---

## 12. Thumbnail-unavailable policy (detailed)

Production evidence (#3912 verification):

```text
https://img.youtube.com/vi/j7Y2Z8r4Z9w/hqdefault.jpg → 404
https://i.ytimg.com/vi/j7Y2Z8r4Z9w/hqdefault.jpg → 404
https://img.youtube.com/vi/aPercr3CWH0/mqdefault.jpg → 404
https://img.youtube.com/vi/CVnE-GLpz1U/mqdefault.jpg → 404
https://img.youtube.com/vi/j7Y2Z8r4Z9w/mqdefault.jpg → 404
```

These are unavailable YouTube thumbnails for specific video IDs. The current product code (`js/utils/media.js` `getThumbnailUrl`) builds `https://i.ytimg.com/vi/{id}/{quality}.jpg` — a single canonical host. The 404s occur because the videos are deleted/private/region-blocked, not because the host is wrong.

Contract:

- The preview response provides `thumbnailUrl` from the YouTube API `snippet.thumbnails` (preferred: `medium` quality, fallback to `default`).
- If the API returns no thumbnail for an item, `thumbnailUrl` is `null` and `state` is `METADATA_PARTIAL` or `UNAVAILABLE`.
- The client must implement a single deterministic fallback: if `<img>` `onerror` fires, replace with a LoveBud placeholder. No multi-host retry chain.
- This 404 issue is NOT fixed in this audit. It is documented as a known client-side rendering concern for the future implementation child.

---

## 13. Pagination / ceiling / timeout policy

| Property | Value | Rationale |
|----------|-------|-----------|
| Provider page size | 50 (maxResults) | YouTube API maximum |
| LoveBud preview item ceiling | 50 | One page is sufficient for preview; avoids multi-page quota consumption |
| Maximum page count | 1 | Single `playlistItems.list` call with `maxResults=50` |
| Overall timeout | 15 seconds | Bounded edge response time |
| Provider request timeout | 10 seconds | YouTube API call timeout |
| `truncated` boolean | `true` if `pageInfo.totalResults > 50` | Explicit truncation signal |
| Next/further-items semantics | NOT included in preview | Preview is bounded; future import may paginate |

Rationale for ceiling of 50:

- A single API call (1 quota unit) retrieves up to 50 items.
- Additional pages each cost 1 quota unit and add latency.
- A preview of 50 items is sufficient for the tutorial flow (select/exclude items).
- If the playlist has more than 50 items, `truncated: true` signals the user that the full playlist is larger.
- The tutorial contract (#3903 §5.1) requires "preview playlist title and items" — a bounded preview satisfies this.

---

## 14. Partial-result policy

**Decision: `BOUNDED_PARTIAL_WITH_EXPLICIT_STATE`**

| Scenario | HTTP | Response |
|----------|------|----------|
| Playlist itself missing | 404 | `{ ok: false, error: { code: "PLAYLIST_NOT_FOUND", message: "..." } }` |
| Playlist private/inaccessible | 403 | `{ ok: false, error: { code: "PLAYLIST_NOT_ACCESSIBLE", message: "..." } }` |
| Playlist unsupported type (watch later, etc.) | 400 | `{ ok: false, error: { code: "PLAYLIST_UNSUPPORTED", message: "..." } }` |
| One video unavailable | 200 | Item included with `state: "UNAVAILABLE"` |
| One video metadata partial | 200 | Item included with `state: "METADATA_PARTIAL"` |
| Quota exhausted | 429 | `{ ok: false, error: { code: "PROVIDER_QUOTA_EXCEEDED", message: "..." } }` |
| Provider timeout | 504 | `{ ok: false, error: { code: "PROVIDER_TIMEOUT", message: "..." } }` |
| Provider unavailable (5xx) | 503 | `{ ok: false, error: { code: "PROVIDER_UNAVAILABLE", message: "..." } }` |
| Malformed provider response | 500 | `{ ok: false, error: { code: "INTERNAL_PREVIEW_ERROR", message: "..." } }` |

An unavailable item does NOT cause the entire preview to fail. The playlist-level failures (not found, inaccessible, unsupported) DO cause the entire preview to fail.

---

## 15. Error vocabulary

Adopted from the Scout envelope convention (`{ ok: false, error: { code, message } }`):

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_PLAYLIST_SOURCE` | 400 | Source is empty, null, non-string, malformed, or playlist ID shape invalid |
| `UNSUPPORTED_PLAYLIST_SOURCE` | 400 | URL is valid but host/path/scheme not accepted |
| `UNAUTHORIZED` | 401 | Missing Authorization header |
| `PLAYLIST_NOT_FOUND` | 404 | YouTube API returns `playlistNotFound` |
| `PLAYLIST_NOT_ACCESSIBLE` | 403 | YouTube API returns `playlistItemsNotAccessible` or `playlistForbidden` |
| `PLAYLIST_UNSUPPORTED` | 400 | YouTube API returns `playlistOperationUnsupported` (watch later, watch history) |
| `PROVIDER_QUOTA_EXCEEDED` | 429 | YouTube API returns quota exceeded error |
| `PROVIDER_TIMEOUT` | 504 | YouTube API request timed out |
| `PROVIDER_UNAVAILABLE` | 503 | YouTube API returns 5xx |
| `PREVIEW_LIMIT_REACHED` | 200 | Not an error — `truncated: true` in success response |
| `INTERNAL_PREVIEW_ERROR` | 500 | Unexpected error, malformed provider response |

Raw YouTube API error bodies and response payloads must NEVER reach the client. The route handler normalizes all provider errors into the vocabulary above.

---

## 16. Provider adapter boundary

Minimal seam (no generic plugin framework):

```text
parseYouTubePlaylistSource(input) → { playlistId } | error
fetchYouTubePlaylistMetadata(playlistId, apiKey) → { title, channelTitle, itemCount } | error
fetchYouTubePlaylistItems(playlistId, apiKey, maxResults) → { items[], nextPageToken, totalResults } | error
normalizeYouTubePlaylistPreview(playlistMeta, items) → { ok, playlist, items, truncated }
```

### Separation from import transaction

- The provider adapter fetches and normalizes YouTube data only.
- It does NOT call any LoveBud write endpoint.
- It does NOT create Trees, Moments, or Connections.
- The future import transaction (tutorial child 3) will consume the preview result and perform the write in a separate transactional step.

### videos.list necessity assessment

`playlistItems.list` with `part=snippet,contentDetails,status` provides:

- `snippet.title` — video title (may be "Private video" / "Deleted video")
- `snippet.description` — video description
- `snippet.thumbnails` — thumbnail URLs
- `snippet.channelTitle` — channel name
- `snippet.position` — playlist position
- `snippet.publishedAt` — item publish date
- `contentDetails.videoId` — the video ID
- `contentDetails.startAt` / `endAt` — clip boundaries (if set)
- `status.privacyStatus` — `public`, `private`, `unlisted`

**Decision: `videos.list` is NOT required for the first preview slice.**

Rationale:

- `playlistItems.list` with `snippet,contentDetails,status` provides sufficient metadata for preview (title, thumbnail, channel, position, availability state).
- `videos.list` would add: duration (`contentDetails.duration`), embeddability (`status.embeddable`), and canonical video metadata.
- Duration and embeddability are NOT required for the preview slice — the tutorial flow shows items for selection, not playback.
- Adding `videos.list` would cost 1 additional quota unit per batch of 50 video IDs, doubling quota consumption.
- If future implementation needs embeddability or duration, `videos.list` can be added as an optional enrichment step in a later child issue.

---

## 17. SSRF / arbitrary-fetch controls

### Design

```text
Client submits playlist URL or ID
→ LoveBud parser extracts/validates playlist identity (no network fetch of user URL)
→ server talks only to fixed official YouTube Data API endpoint
→ response normalized and returned
```

### Controls

| Control | Implementation |
|---------|---------------|
| No `fetch(userSuppliedUrl)` | The parser extracts the playlist ID from the URL string; it does NOT fetch the URL |
| Fixed API endpoint | Server fetches only `https://www.googleapis.com/youtube/v3/playlistItems` and `https://www.googleapis.com/youtube/v3/playlists` |
| No redirect following | `fetch` to YouTube API with `redirect: 'error'` or no redirect handling |
| No localhost/private IP | Not applicable — YouTube API hostname is hardcoded |
| No `file:`, `ftp:`, `data:`, `javascript:` | Rejected by URL scheme validation |
| No arbitrary hostname | Only `www.googleapis.com` is contacted |
| No HTML scraping | API returns JSON only |

### Forbidden

```text
fetch(userSuppliedUrl)
localhost
127.0.0.1
private RFC1918 IP
metadata endpoint
file:
ftp:
javascript:
data:
arbitrary redirect
arbitrary hostname
```

---

## 18. Privacy / logging / observability

### Forbidden in logs

```text
Firebase token
YouTube API key
user email
owner id
Tree id
Moment id
playlist title
video title
raw source URL
description
raw provider response
```

### Sanitized telemetry (category-based only)

```text
provider=youtube
operation=playlist_preview
result=success|not_found|inaccessible|unsupported|quota|timeout|invalid|error
item_count_bucket=0|1-10|11-25|26-50|50+
truncated=true|false
latency_bucket=<500ms|500ms-2s|2s-5s|5s+
deployment_version=<version>
```

No user content is logged. No raw URLs or titles are logged.

---

## 19. Quota and configuration boundary

### API key requirement

The YouTube Data API v3 requires an API key for all requests. The key must be:

- Server-side only (never in browser bundle).
- Never committed to the repository.
- Never logged.
- Never exposed in error messages.

### Configuration status

```text
CONFIGURATION_REQUIRED
```

The repository does not currently contain a YouTube Data API key configuration. The implementation child must:

1. Create a Google Cloud project with YouTube Data API v3 enabled.
2. Generate an API key.
3. Configure the key as a Cloudflare Pages environment variable (e.g., `YOUTUBE_DATA_API_KEY`).
4. The route reads the key from `env.YOUTUBE_DATA_API_KEY` (Cloudflare Pages Functions `context.env`).

No actual key creation, Google Cloud project change, or secret injection is performed in this audit.

### Quota budget per preview

| Call | Count | Cost |
|------|-------|------|
| `playlists.list` (playlist metadata) | 1 | 1 unit |
| `playlistItems.list` (items, 1 page) | 1 | 1 unit |
| `videos.list` | 0 | 0 units (not required) |
| **Total per preview** | 2 | **2 units** |

With 10,000 units/day default quota, this supports 5,000 previews/day.

---

## 20. Beginner tutorial / UI integration

Per #3903 merged tutorial contract:

- Entry point: logged-in My Trees or Editor area.
- Two-route entry model: "YouTube 재생목록 가져오기" and "브라우저 북마크 가져오기".
- The YouTube route flow: paste URL → validate → preview → select/exclude → review → (future) import.
- Preview is read-only: zero write.
- Tutorial teaches: where to copy playlist URL, public/unlisted/private explanation, error recovery.
- Preview vocabulary: `source collection`, `proposed Tree`, `proposed Moment`, `included/excluded`, `duplicate`, `unavailable`, `unsupported`, `needs review`.

### Recommended UI integration point

The preview route is called from a future import modal/surface in the My Trees or Editor area. This audit does NOT modify any UI file. The future implementation child will:

1. Add a client-side API wrapper (`js/api/import-youtube-playlist-preview.js` or similar).
2. Add a preview UI surface (modal or panel).
3. Wire the tutorial copy contract from #3903.

UI file changed count in this audit: **0**.

---

## 21. Future implementation file boundary

| File | Purpose | New/Modified |
|------|---------|-------------|
| `functions/api/import/youtube/playlist/preview.js` | Cloudflare Pages Function route handler | New |
| `functions/api/import/youtube/playlist/preview-provider.js` (optional sibling) | YouTube Data API adapter (parse, fetch, normalize) | New (or inline in route) |
| `js/api/import-youtube-playlist-preview.js` | Client-side API wrapper | New |
| `js/import/youtube-playlist-preview-ui.js` (or similar) | Preview UI surface | New |
| `tests/contracts/youtube-playlist-preview-route-contract.test.cjs` | Route contract test | New |
| `tests/contracts/youtube-playlist-preview-provider-contract.test.cjs` | Provider adapter contract test | New |
| `tests/contracts/youtube-playlist-preview-browser-contract.test.cjs` | Browser preview contract test | New |

Maximum runtime implementation scope: 4 new runtime files + 3 test files = 7 files.

No existing runtime files should need modification for the preview slice (the route is a new namespace, the client wrapper is new, and the UI is a new surface).

---

## 22. Negative controls

| NC | Control |
|----|---------|
| NC1 | Arbitrary `https://` host rejected — only `youtube.com` with `/playlist` path accepted |
| NC2 | `http://` and private-network source rejected — HTTPS required, no localhost/private IP |
| NC3 | Malformed playlist ID rejected before provider call — shape validation `^[A-Za-z0-9_-]{10,80}$` |
| NC4 | Playlist missing → bounded not-found state (`PLAYLIST_NOT_FOUND`, 404) |
| NC5 | Private/inaccessible playlist → bounded inaccessible state (`PLAYLIST_NOT_ACCESSIBLE`, 403) |
| NC6 | Pagination cannot exceed LoveBud ceiling — max 1 page, 50 items; `truncated` flag if more |
| NC7 | Unavailable item does not fabricate metadata — `state: "UNAVAILABLE"` with YouTube-provided title only |
| NC8 | Thumbnail absence does not produce fabricated thumbnail — `thumbnailUrl: null` or YouTube-provided URL only |
| NC9 | Playlist adjacency does not create Connection — no `parentId`, `connectionId`, or relationship field in response |
| NC10 | Preview produces Tree write 0 — no `POST /api/trees` or equivalent |
| NC11 | Preview produces Moment write 0 — no `POST /api/memories` or equivalent |
| NC12 | Raw provider error/body never reaches client — all errors normalized to vocabulary |
| NC13 | Raw user URL/title is not telemetry — only category-based metrics logged |
| NC14 | Provider secret never reaches browser — `YOUTUBE_DATA_API_KEY` is server-side `env` only |
| NC15 | Generic arbitrary URL fetch path does not exist — parser extracts ID from string, no `fetch(userUrl)` |

---

## 23. Stop conditions

The following conditions would halt implementation:

```text
active backend authority unclear
same-origin route ownership conflict
public/private playlist semantics cannot be safely distinguished
arbitrary URL fetch required (no safe parser-only path)
provider credential boundary unclear
tutorial contract and runtime contract directly conflict
two independent writable Tree models exist in current schema
```

As of this audit, **none of these stop conditions are triggered**.

---

## 24. Implementation verdict

```text
PUBLIC_YOUTUBE_PLAYLIST_PREVIEW_IMPLEMENTATION_READY
```

The source implementation can begin. The only external dependency is `CONFIGURATION_REQUIRED` (YouTube Data API key), which is an operational configuration step, not a source code blocker. The implementation child should:

1. Create the route file `functions/api/import/youtube/playlist/preview.js`.
2. Implement the parser, provider adapter, and normalizer.
3. Configure `YOUTUBE_DATA_API_KEY` as a Cloudflare Pages environment variable.
4. Add focused contract tests.
5. Add the client-side API wrapper and preview UI in a subsequent child.

```text
PUBLIC_YOUTUBE_PLAYLIST_PREVIEW_AUTHORITY_AUDIT_COMPLETE
```

---

## Keep-open references

- Keep **#3906 OPEN** (this audit does not close the issue).
- Keep **#3897 OPEN**.
- Keep **#3903 OPEN**.
- Keep **#1882 OPEN** — use only `Refs #1882`.
- No `Closes`, `Fixes`, or `Resolves` for any of the above.
