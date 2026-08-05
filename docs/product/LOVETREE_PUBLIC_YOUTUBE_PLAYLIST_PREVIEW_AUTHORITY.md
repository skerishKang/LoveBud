# LoveTree Public YouTube Playlist — Read-Only Preview Authority

**Issue:** #3906 — Keep OPEN.
**Parent:** #3897 — Keep OPEN.
**Prerequisite:** #3903 CLOSED completed; PR #3905 merged as `3fe01d6a563d60534f0c818299ebb58415ec8e64`.
**Status:** Audit / Contract — read-only source and architecture audit.
**Last updated:** 2026-08-05

---

## 1. Current-main baseline and authority mapping

| Item | Value |
|------|-------|
| Current main SHA | `3fe01d6a563d60534f0c818299ebb58415ec8e64` |
| Branch | `docs/public-youtube-preview-authority-3897` |
| Parent issue | #3897 — Keep OPEN |
| Completed tutorial prerequisite | #3903 CLOSED; PR #3905 merged at main SHA `3fe01d6a5…` |
| Merged tutorial contract | `docs/product/LOVETREE_IMPORT_BEGINNER_TUTORIAL_CONTRACT.md` |
| Non-authoritative product direction | Draft PR #3898 — do not modify; review input only |

### Active same-origin API and backend route ownership

The active runtime path is:

```text
browser → same-origin /api/* → Cloudflare Pages Functions → Modal → Neon
```

Exact current same-origin route ownership on `origin/main` (`3fe01d6a5`):

| Route surface | File | Notes |
|---------------|------|-------|
| Catch-all `/api/*` | `functions/api/[[path]].js` | Memory modal/read/write proxy ownership; strips trailing slash; request-id header `x-lovebud-request-id`; `MAX_WRITE_BODY_BYTES = 128 * 1024`; `MODAL_FETCH_TIMEOUT_MS = 25000` |
| `/api/trees` | `functions/api/trees.js`, `functions/api/trees/[id].js` | GET list / tree; visibility public-read branch at `trees/[id].js` |
| `/api/memories` | `functions/api/memories.js`, `functions/api/memories/[id].js` | GET/POST memory |
| `/api/youtube/oembed` | `functions/api/youtube/oembed.js` | **Existing YouTube provider seam** — host allowlist, `extractYouTubeVideoId`, sanitize channel URL, upstream `fetch` to `https://www.youtube.com/oembed`, bounded response, no OAuth |

Client API seam:

```text
js/api/base-api-fetch.js   → window.LoveTreeBaseApiFetch.apiFetch(endpoint, options)
js/api/auth-policy.js      → endpointLikelyRequiresAuth: public when endpoint starts with '/community/'
js/api/public-tree-adapter.js
js/postgres-client.js      → createTreeApi / browseApi; getTree, getMemoriesByTree etc.
```

**Key existing authority facts:**

- `endpointLikelyRequiresAuth(endpoint)` returns `false` only for endpoints starting with `/community/`. Any new **read-only public preview route must be explicitly placed under a public-safe prefix** or explicitly marked public in the route handler, otherwise `apiFetch` will attach the auth path and expect a session.
- `functions/api/youtube/oembed.js` already demonstrates the correct YouTube pattern: strict HTTPS host allowlist (`youtube.com`, `youtu.be`), URL length cap (`MAX_INPUT_URL_LENGTH = 2048`), video-ID regex `/^[0-9A-Za-z_-]{11}$/`, sanitized channel URL, bounded upstream fetch, and empty-payload fallback without leaking upstream errors.
- `js/postgres-client.js` uses `BaseApiFetch.apiFetch(...)` for every tree/memory call; the preview route does **not** touch trees/memories (write 0).

## 2. Official provider constraints (YouTube)

Facts treated as UX and architecture constraints, not hidden details (from the merged tutorial contract and current official YouTube documentation):

- `playlistItems.list` returns playlist items in playlist order (`snippet.position` is stable order metadata) and supports `maxResults` up to 50 per page.
- Pagination uses `pageToken` (request) and `nextPageToken` (response). Watch History and Watch Later are **not** retrievable through this API path.
- Playlist metadata endpoint is `playlists.list` (`snippet.title`, `snippet.channelTitle`, `contentDetails.itemCount`, `status.privacyStatus`).
- An item whose video is deleted/private/unavailable may still appear with a title like `Private video` / `Deleted video`; availability must be surfaced as an explicit preview state, never silently dropped.
- Quota: a `playlistItems.list` call costs 1 unit; a `playlists.list` call costs 1 unit. Quota errors return HTTP 403 with an error reason; the preview must fail closed and surface an error-specific recovery copy.
- Attribution: the preview must preserve source title, channel/creator, and source URL identity for each proposed Moment; source order is playback order only.

## 3. Proposed same-origin preview route and active runtime owner

### 3.1 Route

```text
GET /api/import/youtube/playlist/preview
```

- **Active runtime owner:** Cloudflare Pages Functions (`functions/api/import/youtube/playlist/preview.js`), which calls the provider adapter and returns a bounded JSON preview. No Modal, no Neon, no OAuth, no write.
- **Public-read posture:** preview is owner-only authenticated read in the first slice (matches import preview and write routes requiring authenticated ownership). It is **not** a public embed route.
- **Route ownership decision:** a new `functions/api/import/` prefix keeps preview authority separate from tree/memory routes; do **not** overload `/api/trees` or `/api/memories`.

### 3.2 Bounded request fields

| Field | Type | Bound |
|-------|------|-------|
| `url` | string | optional; ≤ 2048 chars; must parse as `https:` on an allowed YouTube host |
| `playlistId` | string | optional; accepted forms below; ≤ 64 chars |
| `pageToken` | string | optional; opaque, returned by provider; ≤ 512 chars |

At least one of `url` or `playlistId` is required.

### 3.3 Accepted playlist URL/ID forms

- `https://www.youtube.com/playlist?list=PL…` (host: `youtube.com` after `www.`/`m.` normalization)
- `https://youtube.com/playlist?list=PL…`
- `https://music.youtube.com/playlist?list=PL…` (allowed only if explicitly accepted; default first slice: reject unless decided)
- bare playlist ID `PL…` / `UU…` / `OLAK5uy_…` (validated by charset/length, not by YouTube)
- Rejected: non-`https`, unknown host, `youtu.be` (video-only host), watch URLs with `list=` handled only when the playlist identity is extracted from `list` param.

Playlist ID charset contract: `^[0-9A-Za-z_-]{10,64}$` (no `/`, `?`, `#`). Normalization is deterministic: strip query noise, keep only `list`, drop `v`/`index`/`start_radio`/`t`, lowercase host, keep original playlist ID case.

## 4. Normalized ordered preview response

Response uses the **merged tutorial vocabulary** (`docs/product/LOVETREE_IMPORT_BEGINNER_TUTORIAL_CONTRACT.md` §7):

```text
source collection
proposed Tree
group/folder
proposed Moment
included / excluded
duplicate
unavailable
unsupported
needs review
```

### 4.1 Response shape (bounded)

```text
{
  "sourceCollection": {
    "provider": "youtube",
    "providerPlaylistId": "PL…",
    "sourceTitle": "…",
    "channelTitle": "…",
    "sourceUrl": "https://www.youtube.com/playlist?list=…",
    "itemCount": 120
  },
  "proposedTree": {
    "title": "…",            // derived, editable later
    "visibility": "private"  // first-slice default (per parent #3897 private-first default)
  },
  "items": [                 // ordered, playback order only
    {
      "position": 1,
      "videoId": "…",
      "sourceTitle": "…",
      "channelTitle": "…",
      "sourceUrl": "https://www.youtube.com/watch?v=…",
      "thumbnail": "https://i.ytimg.com/vi/…/hqdefault.jpg",
      "state": "included | excluded | duplicate | unavailable | unsupported | needsReview"
    }
  ],
  "pagination": {
    "nextPageToken": "… | null",
    "totalCount": 120,
    "returnedCount": 50,
    "truncated": false
  },
  "order": "playback",       // must never imply semantic Connections
  "writes": 0
}
```

### 4.2 Ordering rule

Playlist order is **playback order only**. The preview must **not** fabricate emotional/narrative Connections. Any later Connections are user-added after import.

## 5. Pagination, item ceiling, timeout, truncation, retry, partial-result policy

- `maxResults`: 50 per provider page (YouTube max).
- **Item ceiling:** first slice caps total fetched items at **200** (4 pages). When `totalCount > ceiling`, response returns `truncated: true` with the first 200 ordered items and the next page token; UI shows truncation copy and allows nothing beyond preview.
- **Timeout:** provider adapter enforces a single upstream timeout (default 10 s, matching the repo's bounded-fetch posture; oembed uses no explicit timeout today, so the new adapter must add one).
- **Retry:** one bounded retry (max 2 attempts total) for transient network failures only; no retry on HTTP 403 quota/forbidden or 404.
- **Partial results:** if a page fails after prior pages succeeded, return the successful prefix with `partial: true` and a `needsReview`/error summary; never return a fabricated empty preview.
- **Unavailable items:** surfaced as `state: "unavailable"` with the item's position preserved; never silently dropped.
- **Duplicates:** a repeated `videoId` within the playlist is `state: "duplicate"` on subsequent occurrences; the first occurrence remains `included`.

## 6. Minimum YouTube-specific provider adapter seam

Keep the provider fetch/normalize adapter separate from the canonical preview response (per #3897 provider abstraction rule — minimum seam, no broad plugin framework).

```text
functions/api/_shared/youtube-playlist-provider.js  (or functions/api/_shared/)
  - buildPlaylistApiUrl(playlistId, pageToken, apiKey)
  - parsePlaylistMetadata(payload)   -> sourceCollection fields
  - parsePlaylistItems(payload)      -> ordered items + nextPageToken
  - classifyItemState(item, seenVideoIds) -> included/duplicate/unavailable/unsupported
  - mapToPreviewItem(item)           -> bounded preview item
```

Boundary rules:

- the adapter is the **only** module allowed to touch `https://www.googleapis.com/youtube/v3/*`;
- it never receives or returns credentials; the API key lives only in the Pages Functions environment (secret boundary);
- it returns bounded, sanitized DTOs; no raw upstream payload leaves the adapter;
- the route (or a thin local/CI seam) injects the upstream `fetch` so tests never contact YouTube.

### Local / CI mock seam

- Unit/behavior tests execute the adapter with an injected fake `fetch` (local `vm` or direct function seam) returning fixture JSON for `playlists.list` and `playlistItems.list` pages, quota 403, deleted/private items, duplicates, and pagination.
- Browser contract tests (if any) route the same-origin preview endpoint to a local fixture; no real provider request.
- No `EXTERNAL_INTEGRATION` test in the default CI slice.

## 7. Host allowlist, arbitrary-fetch prevention, bounded response, privacy, logging, quota controls

- **Host allowlist:** adapter resolves only `https://www.googleapis.com/youtube/v3/{playlists,playlistItems}`; never accepts a caller-supplied upstream URL (no arbitrary fetch).
- **Playlist ID validation:** `/^[0-9A-Za-z_-]{10,64}$/`; URL normalization drops all query noise except `list`.
- **Bounded response:** preview JSON is a fixed shape; each item is truncated to bounded field lengths (title/channel ≤ 200 chars); total body is capped; no raw upstream payload passthrough.
- **Privacy:** no credentials, tokens, playlist titles, URLs, or user identifiers in logs (repository logging rule); preview is owner-only; private source access never makes a Tree public.
- **Quota controls:** provider API key in Pages Functions env only; fail-closed on HTTP 403 quota/forbidden; a bounded per-route/day cap is recorded as a required implementation control with a kill switch; sanitized quota telemetry only (no titles/URLs/IDs).
- **SSRF/abuse:** no caller-supplied upstream URL; single allowlisted provider endpoint; request fields bounded; no write; no external navigation from the preview.

## 8. Beginner tutorial / UI integration point

Integration point is the merged tutorial contract `docs/product/LOVETREE_IMPORT_BEGINNER_TUTORIAL_CONTRACT.md`:

- Entry: **YouTube 재생목록 가져오기** route (two-route entry model, §4).
- Tutorial step: paste URL → validate → preview playlist title and items → show unavailable/private/deleted items explicitly → select/exclude → review proposed Tree title/visibility → **no write in the first preview slice** (§5).
- Error recovery copy from the merged contract §10 (invalid URL, private/unlisted, not found, quota, duplicate).
- Accessibility/focus requirements from merged contract §8 (one focus target, `aria-expanded` disclosure, `aria-describedby` errors, keyboard-only completion, reduced-motion, color never the sole signal, touch targets).

The preview authority maps directly onto the tutorial's shared preview vocabulary and must render every tutorial-required state (`unavailable`, `duplicate`, `unsupported`, `needs review`, included/excluded).

## 9. Exact implementation paths, maximum scope, tests, negative controls, stop conditions

### 9.1 Implementation paths (future slice, not this audit)

```text
functions/api/import/youtube/playlist/preview.js        (route, GET)
functions/api/_shared/youtube-playlist-provider.js      (adapter seam)
js/import/youtube-playlist-preview-client.js            (browser client via apiFetch, optional in slice 1)
js/i18n/i18n-import.js                                   (tutorial/preview copy keys, Korean-first)
pages/… (import entry UI)                                (tutorial integration, U2/U3 slice)
```

### 9.2 Maximum scope

- public playlist URL/ID validation and normalization;
- read-only ordered preview with pagination (≤ 200 items) and tutorial vocabulary states;
- provider adapter with injected-fetch mock seam;
- no Tree/Moment write, no OAuth, no schema/migration, no Modal/Neon, no extension, no Production deploy in the same slice.

### 9.3 Tests

- SOURCE_STATIC contract (this file) — doc structure/authority assertions;
- adapter unit/behavior tests with fixture `fetch` (EXECUTED_FAKE): metadata parse, item ordering, duplicate classification, unavailable/unsupported, pagination token, quota 403 fail-closed, timeout, partial-result;
- browser contract test (if added) routes the preview endpoint to a fixture and asserts tutorial vocabulary rendering + accessibility (U2/U3 slice).

### 9.4 Negative controls

- arbitrary upstream URL rejected (no caller-supplied endpoint);
- playlist ID with `/`, `?`, `#`, or invalid charset rejected;
- quota 403 → fail closed, no partial preview fabricated;
- deleted/private item not silently dropped (must appear as `unavailable`);
- duplicate videoId classified as duplicate (first occurrence included);
- timeout/transient failure → bounded retry then fail-closed, never fabricated empty;
- pagination beyond ceiling → `truncated: true`, ordered prefix only;
- any write method (POST/PUT/PATCH/DELETE) on the preview route → rejected.

### 9.5 Stop conditions

- preview accepted by owner real-use trial (merged tutorial acceptance checklist);
- zero write path confirmed on the preview route;
- adapter only YouTube-touching module confirmed;
- no real provider request in any default-CI test;
- logging contains no titles/URLs/IDs/credentials.

## 10. Verdict

```text
PUBLIC_YOUTUBE_PLAYLIST_PREVIEW_IMPLEMENTATION_READY
```

Reason: current-main authority, existing `functions/api/youtube/oembed.js` YouTube seam, `js/api/base-api-fetch.js` client seam, merged tutorial vocabulary, and official YouTube constraints all resolve to one concrete read-only preview authority with a bounded adapter seam and no blocking configuration gap.

## 11. Hard prohibitions (non-actions)

This audit does **not** authorize or perform any of the following:

```text
no external provider request
no real YouTube API call
no runtime route implementation
no OAuth
no Tree/Moment write
no schema/migration
no Production/Preview access or mutation
no screenshots committed
no modification of PR #3898 branch or worktree
no PR creation, Ready/merge, or Issue closure by the worker
```

---

## Keep-open references

- Keep **#3906 OPEN**.
- Keep **#3897 OPEN**.
- Keep **#1882 OPEN** — use only `Refs #1882`.
- No `Closes`, `Fixes`, or `Resolves` for any of the above.
