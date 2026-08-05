# LoveTree Public YouTube Playlist — Read-Only Preview Authority

**Issue:** #3906 — Keep OPEN.
**Parent:** #3897 — Keep OPEN.
**Prerequisite:** #3903 CLOSED completed; PR #3905 merged as `3fe01d6a563d60534f0c818299ebb58415ec8e64`.
**Status:** Audit / Contract — read-only source and architecture audit (authority corrected).
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
| `/api/trees` | `functions/api/trees.js`, `functions/api/trees/[id].js` | GET list / tree; forwards `Authorization` to Modal unchanged; header-presence 401 only (no token verification in Cloudflare) |
| `/api/memories` | `functions/api/memories.js`, `functions/api/memories/[id].js` | GET/POST memory |
| `/api/youtube/oembed` | `functions/api/youtube/oembed.js` | **Public, unauthenticated oEmbed seam** — host allowlist, video-ID extraction, sanitized channel URL, upstream `fetch` to `https://www.youtube.com/oembed`, bounded response |

Client API seam:

```text
js/api/base-api-fetch.js   → window.LoveTreeBaseApiFetch.apiFetch(endpoint, options)
js/api/auth-policy.js      → endpointLikelyRequiresAuth: public when endpoint starts with '/community/'
js/api/public-tree-adapter.js
js/postgres-client.js      → createTreeApi / browseApi; getTree, getMemoriesByTree etc.
```

### Authentication authority facts (current main)

The following are exact current-main facts and must not be misstated:

1. `js/api/auth-policy.js` decides **only whether the client attaches an Authorization header**. It is **not** a server token-verification authority.
2. `functions/api/trees.js` (and the memory/`[[path]]` proxy) forwards the `Authorization` header to the Modal private route **unchanged** and returns a header-presence 401 when absent. **Cloudflare does not verify the Firebase token itself.**
3. `functions/api/scout/live-auth-verifier-adapter.js` is a **mock-disabled skeleton** (`MOCK_DISABLED` default; Firebase runtime requires explicit injected `firebaseConfig` + `firebaseVerifier`, disabled-by-default). It is **not** a runtime Firebase ID token verification authority and must **not** be used as the owner-import auth authority.
4. `functions/api/youtube/oembed.js` is a **public, unauthenticated** oEmbed seam. It must **not** be reused as the owner-only import auth authority.

### The canonical owner-token verification authority

The real Firebase ID token verification authority on current main is in Modal:

```text
modal_compute/auth.py
  require_firebase_user(authorization) -> {"uid", "email", "decoded"}
```

`require_firebase_user` performs real verification:

- requires `Bearer ` scheme; 401 otherwise;
- fetches Firebase signing certificates from `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com` (cached, `max-age` honored);
- loads the PEM public key via `cryptography.x509`;
- decodes the JWT with PyJWT `RS256`, `audience=<FIREBASE_PROJECT_ID>`, `issuer=https://securetoken.google.com/<FIREBASE_PROJECT_ID>`;
- returns `{"uid", "email", "decoded"}` or raises HTTPException 401.

It is exercised by every authenticated Modal route, e.g.:

```text
modal_compute/app.py
  @web_app.get("/modal/private/trees")            -> require_firebase_user(authorization)
  @web_app.post("/modal/private/trees")           -> require_firebase_user(authorization)
  @web_app.get("/modal/private/trees/{tree_id}")  -> require_firebase_user(authorization)
```

The Modal app is mounted as `@modal.asgi_app()` (`fastapi_app` → `web_app`) with `secrets=["lovebud-db", "lovebud-firebase-admin"]`. `get_firebase_project_id()` reads `FIREBASE_PROJECT_ID` (default `relovetree`) in `modal_compute/config.py`.

**Conclusion:** the canonical owner-token verification authority exists and is real. The import preview must verify tokens in Modal via `require_firebase_user`, never in Cloudflare, never via the Scout mock-disabled verifier, never via the public oEmbed seam.

## 2. Official provider constraints (YouTube)

Facts treated as UX and architecture constraints, not hidden details (from the merged tutorial contract and current official YouTube documentation):

- `playlistItems.list` returns playlist items in playlist order (`snippet.position` is stable order metadata) and supports `maxResults` up to 50 per page.
- Pagination uses `pageToken` (request) and `nextPageToken` (response). Watch History and Watch Later are **not** retrievable through this API path.
- Playlist metadata endpoint is `playlists.list` (`snippet.title`, `snippet.channelTitle`, `contentDetails.itemCount`, `status.privacyStatus`).
- An item whose video is deleted/private/unavailable may still appear with a title like `Private video` / `Deleted video`; availability must be surfaced as an explicit preview state, never silently dropped.
- Quota: a `playlistItems.list` call costs 1 unit; a `playlists.list` call costs 1 unit. Quota errors return HTTP 403 with an error reason; the preview must fail closed and surface an error-specific recovery copy.
- Attribution: the preview must preserve source title, channel/creator, and source URL identity for each proposed Moment; source order is playback order only.

## 3. Proposed canonical path and role split

### 3.1 Canonical path (authority-corrected)

```text
browser
→ POST /api/import/youtube/playlist/preview
→ Cloudflare Pages Function gateway
→ Authorization 그대로 전달
→ Modal private preview endpoint
→ Modal의 기존 Firebase authentication authority (require_firebase_user)
→ YouTube provider adapter
→ bounded preview response
```

### 3.2 Roles

```text
Cloudflare:
same-origin gateway
bounded body (explicit small limit)
request ID (x-lovebud-request-id)
Authorization forwarding (unchanged)
timeout/upstream failure mapping
response header and body bound

Modal:
Firebase ID token verification (require_firebase_user)
authenticated actor 확인 (user["uid"])
YouTube provider 호출
pagination/normalization
quota·kill-switch 적용
bounded DTO 생성

Neon:
미사용 (0)

Tree/Memory persistence:
0
```

Cloudflare does **not** verify authentication. The document must never claim Cloudflare validates the token.

## 4. Request method, body, and privacy boundary

### 4.1 Method and transport

```text
POST /api/import/youtube/playlist/preview
Content-Type: application/json
Authorization: Bearer <Firebase ID token>
```

POST is the preview RPC transport only; it performs no write.

### 4.2 Bounded body

Exactly one of `url` or `playlistId` is required:

```json
{
  "url": "https://www.youtube.com/playlist?list=..."
}
```

or:

```json
{
  "playlistId": "PL..."
}
```

Rules:

```text
neither url nor playlistId  -> 400
both url and playlistId     -> 400
JSON body 전체: 명시된 작은 상한 (e.g. 4 KiB)
url: <= 2048
playlistId: <= 64
```

### 4.3 Privacy boundary

- The source URL and playlist ID never appear in a query string, request path, request-id, telemetry, or error response.
- No credentials, tokens, playlist titles, URLs, Moment text, or user identifiers in logs (repository logging rule).
- Preview is owner-only; private source access never makes a Tree public.

## 5. URL/host policy — single decision (first slice)

The first-slice host policy is **fixed** as follows (no “추후 결정”, “unless decided”, or “논의 필요” remains):

### 5.1 Allowed

```text
https://youtube.com/playlist?list=...
https://www.youtube.com/playlist?list=...
https://m.youtube.com/playlist?list=...
https://music.youtube.com/playlist?list=...
https://youtube.com/watch?...&list=...
https://www.youtube.com/watch?...&list=...
bare playlist ID
```

`music.youtube.com` is **allowed in the first slice**.

### 5.2 Normalization

```text
host lowercase
www./m. normalization은 검증 단계에서만 사용 (canonical host는 www.youtube.com)
list parameter만 playlist identity로 사용
v/index/t/start_radio 등은 버림
playlist ID case 유지
canonical source URL:
https://www.youtube.com/playlist?list=<playlistId>
```

### 5.3 Rejected

```text
http:
unknown host
username/password 포함 URL
port가 명시된 URL
fragment 기반 ID
list가 없는 watch URL
youtu.be URL
/embed, /shorts, /live URL
invalid playlist ID charset
```

Playlist ID charset bound: `^[0-9A-Za-z_-]{10,64}$`.

## 6. Normalized ordered preview response

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

### 6.1 Response shape (bounded, no partial, no nextPageToken)

```text
{
  "sourceCollection": {
    "provider": "youtube",
    "providerPlaylistId": "PL…",
    "sourceTitle": "…",
    "channelTitle": "…",
    "sourceUrl": "https://www.youtube.com/playlist?list=…",
    "itemCount": 420
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
      "state": "included | duplicate | unavailable | unsupported | needsReview"
    }
  ],
  "pagination": {
    "totalCount": 420,
    "returnedCount": 200,
    "truncated": true,
    "ceiling": 200
  },
  "order": "playback",       // must never imply semantic Connections
  "writes": 0
}
```

### 6.2 Item states

Each preview item uses exactly one state:

```text
included
duplicate
unavailable
unsupported
needsReview
```

`excluded` is **not** a provider-assigned state; it is the future user-selection state in the UI. The provider preview therefore does not emit `excluded`.

### 6.3 Ordering and group rules

- Playlist order is **playback order only**. The preview must **not** fabricate emotional/narrative Connections.
- `group/folder` is the bookmark-common vocabulary. The YouTube playlist preview has no real group/folder data, so the response must **not** fabricate a group field.
- Playlist adjacency never creates Connections.

## 7. Pagination and 200-item ceiling (corrected)

- Client request carries **no `pageToken`** (input is `url` or `playlistId` only).
- `pageToken` is **server-internal only**:
  - `playlists.list` — exactly 1 call;
  - `playlistItems.list` — maximum 4 pages;
  - provider `maxResults` — 50;
  - hard ceiling — **200** returned items.
- Response exposes **no `nextPageToken`**; `pagination` returns only `totalCount`, `returnedCount`, `truncated`, `ceiling`.
- `truncated: true` means the first 200 items only; it does **not** imply items 201+ are retrievable in the first slice. Items 201+ require a separately approved follow-up slice.
- User-facing copy:

```text
이 재생목록은 항목이 많아 처음 200개만 미리 보여드려요.
```

## 8. Partial-result policy (corrected)

First slice: **partial preview is forbidden.**

If any provider stage fails, the response must be:

```text
preview item 0
writes 0
sanitized error code
사용자 복구 문구
```

Fail-closed on all of:

```text
playlists.list 실패
첫 playlistItems.list 실패
두 번째 이후 page 실패
quota 403
forbidden
404/not found
invalid JSON
timeout
bounded retry 종료
```

**No previously successful page prefix is returned.** Negative control: if page 2 fails, page 1 items must not appear in the response.

## 9. Timeout and retry (single authority)

```text
전체 preview request wall-clock budget: 10초
transient network/5xx retry: 최대 1회
retry는 전체 deadline을 넘을 수 없음
400/401/403/404는 retry 0
AbortSignal 기반 취소
deadline 초과 시 fail-closed
partial preview 0
```

The deadline is the **overall** preview request budget (10 s), never “each fetch gets 10 s” (which would unboundedly extend maximum runtime).

## 10. API key, quota, and activation boundary

- The YouTube API key is **never** exposed to the browser and **never** appears in any Cloudflare-to-browser response.
- With Modal as the provider-execution owner, the provider credential lives in the **Modal secret boundary** (like `lovebud-firebase-admin`), not Cloudflare env and not the browser.
- **Implementation PR vs activation are separated:**

  - Allowed in the implementation PR:
    ```text
    provider adapter
    injected fake fetch
    disabled-by-default runtime guard
    fixture tests
    no real external request in CI
    ```
  - Required before real staging/Production activation:
    ```text
    provider credential 설정
    quota limit
    per-actor 또는 승인된 abuse limit
    kill switch
    sanitized observability
    staging verification
    ```

- This is an **activation** boundary, not an implementation blocker: the implementation PR can merge with the provider adapter + fake-fetch tests and a disabled-by-default guard; real provider credential configuration and limits gate activation only.

## 11. Security and privacy controls

- **Host allowlist:** adapter resolves only `https://www.googleapis.com/youtube/v3/{playlists,playlistItems}`; never a caller-supplied upstream URL (no arbitrary fetch).
- **Playlist ID validation:** `/^[0-9A-Za-z_-]{10,64}$/`; URL normalization keeps only the `list` parameter.
- **Bounded response:** fixed shape; per-field length bounds (title/channel ≤ 200 chars); total body capped; no raw upstream payload passthrough.
- **Privacy:** source URL/playlist ID never in query/path/request-id/telemetry/error response; owner-only; private source never makes a Tree public.
- **Quota controls:** provider API key in Modal secret only; fail-closed on 403; bounded per-route/day cap with kill switch; sanitized quota telemetry only.
- **SSRF/abuse:** no caller-supplied upstream URL; single allowlisted provider endpoint; bounded request fields; no write; no external navigation from the preview.

## 12. Beginner tutorial / UI integration point

Integration point is the merged tutorial contract `docs/product/LOVETREE_IMPORT_BEGINNER_TUTORIAL_CONTRACT.md`:

- Entry: **YouTube 재생목록 가져오기** route (two-route entry model, §4).
- Tutorial step: paste URL → validate → preview playlist title and items → show unavailable/private/deleted items explicitly → select/exclude → review proposed Tree title/visibility → **no write in the first preview slice** (§5).
- Error recovery copy from the merged contract §10 (invalid URL, private/unlisted, not found, quota, duplicate).
- Accessibility/focus requirements from merged contract §8.

## 13. Exact implementation paths (repository-accurate)

Current Modal layout on `origin/main`:

```text
modal_compute/
  app.py          (FastAPI web_app; @web_app.get/post/put/delete("/modal/private/..."))
  auth.py         (require_firebase_user — canonical Firebase verification)
  config.py       (get_firebase_project_id, env)
  db.py, validation.py, api_response_helpers.py, logging.py ...
```

Cloudflare gateway layout:

```text
functions/api/
  [[path]].js, trees.js, trees/[id].js, memories.js, memories/[id].js, youtube/oembed.js
```

Client layout:

```text
js/api/base-api-fetch.js, js/api/auth-policy.js, js/postgres-client.js
```

### 13.1 Future implementation slice files (maximum)

```text
functions/api/import/youtube/playlist/preview.js   (Cloudflare gateway, POST, Authorization forwarding)
modal_compute/youtube_playlist_preview.py          (Modal private route: require_firebase_user + provider call)
modal_compute/youtube_playlist_provider.py         (Modal YouTube provider adapter, injected-fetch seam)
js/import/youtube-playlist-preview-client.js       (browser client via apiFetch, POST JSON)
tests/... (adapter fixture tests + gateway contract tests)
```

Exact maximum file count for the backend slice: **5** (3 runtime files + 2 test files), documented per-slice before implementation. Do not arbitrarily commit paths that do not exist in the current repository layout.

### 13.2 Recommended slice separation

```text
Slice 1:
authenticated backend preview contract + provider adapter + fake-fetch tests

Slice 2:
beginner tutorial entry + preview UI + real-page browser tests
```

UI/tutorial rendering is **not** mixed into the backend implementation PR.

### 13.3 Tests

- SOURCE_STATIC contract (this file) — doc structure/authority assertions;
- adapter unit/behavior tests with fixture `fetch` (EXECUTED_FAKE): metadata parse, item ordering, duplicate classification, unavailable/unsupported, pagination, quota 403 fail-closed, timeout, fail-closed partial;
- Modal private route test: `require_firebase_user` invoked, actor uid scoping, zero write;
- gateway contract test (if added): POST only, 405 on GET/PUT/PATCH/DELETE, body XOR, Authorization forwarding, no source identity in query/response.

### 13.4 Negative controls

- arbitrary upstream URL rejected;
- playlist ID with `/`, `?`, `#`, or invalid charset rejected;
- GET/PUT/PATCH/DELETE on the preview route → 405;
- POST with neither url nor playlistId → 400;
- POST with both url and playlistId → 400;
- quota 403 → fail-closed, no partial preview fabricated;
- page 2 failure → page 1 items must not be in the response;
- deleted/private item not silently dropped (`unavailable` state);
- duplicate videoId classified as duplicate (first occurrence included);
- overall deadline exceeded → fail-closed, no fabricated empty;
- any Tree/Memory/Connection persistence invoked → test fails;
- source URL/playlist ID present in query, path, request-id, telemetry, or error response → test fails.

### 13.5 Stop conditions

- preview accepted by owner real-use trial (merged tutorial acceptance checklist);
- zero write path confirmed on the preview route;
- Modal `require_firebase_user` is the only token-verification authority for the preview;
- adapter is the only YouTube-touching module;
- no real provider request in any default-CI test;
- logging contains no titles/URLs/IDs/credentials;
- provider credential configured and limits/kill-switch verified before activation.

## 14. Verdict

```text
PUBLIC_YOUTUBE_PLAYLIST_PREVIEW_IMPLEMENTATION_READY
```

Reason: the canonical owner-token verification authority exists and is real on current main (`modal_compute/auth.py` → `require_firebase_user`, exercised by every `/modal/private/*` route in `modal_compute/app.py`). Cloudflare's role is limited to same-origin gateway + Authorization forwarding + bounded body/response. The provider credential + quota/limits are an **activation** boundary, not an authority blocker.

## 15. Hard prohibitions (non-actions)

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
