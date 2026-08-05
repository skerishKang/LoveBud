# LoveTree Import — Beginner-First Playlist and Bookmark Import Onboarding Contract

**Issue:** #3903 — Keep OPEN.
**Parent:** #3897 — Keep OPEN.
**Status:** Contract / Planning — Tier 1, UI class U1 (product/UX contract).
**Last updated:** 2026-08-05

---

## 1. Current-main baseline

| Item | Value |
|------|-------|
| Current main SHA | `e148cb2b3c7a0fd880da64d2db5d442717d75353` |
| Branch | `docs/import-beginner-tutorial-3897` |
| Parent issue | #3897 — Keep OPEN |
| Design input (non-authoritative) | Draft PR #3898 — do not modify |
| Existing direction doc | `docs/product/LOVETREE_PLAYLIST_IMPORT_PLAYBACK_EMBED_DIRECTION.md` (PR #3898) |

This contract is the beginner-first tutorial slice of the #3897 Phase 0 audit. It defines the smallest truthful first user journey for bringing an existing public YouTube playlist or an exported Chrome/Edge bookmark HTML file into LoveTree, and it makes the tutorial a **required part of the MVP**, not optional help text.

## 2. Product purpose and non-goals

### Purpose

```text
existing playlist / bookmarks
→ ordered proposed Moments
→ immediate viewing value
→ gradual enrichment with emotion, notes, segments, and meaningful Connections
```

The import experience must teach the **source-side action at the exact moment the user needs it**, because most users will not know:

- where to find a YouTube playlist URL;
- whether a playlist must be public;
- how to export Chrome or Edge bookmarks as HTML;
- what a bookmark HTML file contains;
- whether LoveBud will keep the uploaded file;
- what becomes a Tree versus a Moment;
- how duplicate, deleted, private, unavailable, or unsupported items are handled;
- whether playlist order automatically creates emotional Connections (it must not).

### Non-goals (explicit non-actions)

```text
no runtime import implementation
no YouTube API call
no OAuth
no bookmark file upload or parsing implementation
no browser extension
no DB/schema/API/Auth/provider change
no Production/Preview access or mutation
no screenshots committed
no modification of Draft PR #3898 branch or worktree
no Ready/merge/Issue closure by the worker
```

## 3. Official platform constraints

### Browser bookmarks (platform facts to preserve)

- A normal webpage **cannot silently read browser bookmarks**.
- Chrome supports exporting bookmarks from Bookmark Manager as an **HTML file**.
- Direct bookmark-tree access requires a browser extension declaring the `bookmarks` permission and presents a permission warning.
- The first web MVP therefore uses **explicit exported HTML upload**; an extension is later and optional.

### YouTube playlists (platform facts to preserve)

- The first MVP uses a **user-supplied public playlist URL or playlist ID without Google OAuth**.
- `playlistItems.list` returns ordered playlist items, supports up to 50 items per page, and uses pagination.
- Watch History and Watch Later are **not retrievable** through this API path.
- Private/account-owned playlist discovery belongs to a later OAuth slice using the minimum reviewed scope.

These facts are **UX constraints, not hidden implementation details**. The tutorial copy must teach them.

## 4. Two-route entry model

One first screen with two explicit routes. Do **not** combine both into one ambiguous generic uploader.

```text
YouTube 재생목록 가져오기
브라우저 북마크 가져오기
```

| Route | Source action taught | First user action |
|-------|----------------------|-------------------|
| YouTube 재생목록 가져오기 | copy playlist URL / paste / validate / preview | paste public playlist URL or ID |
| 브라우저 북마크 가져오기 | Chrome/Edge Bookmark Manager → Export bookmarks → HTML file | select or drag the HTML file |

## 5. Public YouTube playlist tutorial

### 5.1 Beginner flow (step contract)

```text
where to copy the playlist URL
public/unlisted/private explanation
paste URL
validate
preview playlist title and items
show unavailable/private/deleted items explicitly
select or exclude items
review proposed Tree title and visibility
no write in the first preview slice
```

### 5.2 Required tutorial elements

- short inline instructions **before** the input;
- expandable **“재생목록 링크는 어디서 복사하나요?”** help;
- one compact visual/screenshot placeholder specification for desktop and mobile;
- error-specific recovery copy;
- no assumption that the user knows YouTube terminology.

### 5.3 Copy contract (Korean-first, beginner tone)

| Step | Required copy meaning |
|------|----------------------|
| where to copy | “재생목록 페이지에서 주소창의 링크를 복사하세요” — no YouTube vocabulary assumed |
| public/unlisted/private | “공개 또는 ‘링크가 있는 사용자만’ 재생목록만 가져올 수 있어요. 비공개 재생목록은 나중에 계정 연결로 가져올 수 있어요” |
| paste | input placeholder with an example `https://www.youtube.com/playlist?list=...` |
| validate | inline success/error near the input; error never thrown as a raw API message |
| preview title/items | ordered preview of playlist title and items |
| unavailable/private/deleted | each such item shown explicitly with an unavailable state label; never silently dropped from the preview |
| select/exclude | per-item included/excluded toggle |
| review Tree title/visibility | proposed Tree title editable, visibility choice explicit |
| no write | preview slice performs **zero** write |

## 6. Browser bookmark export tutorial

### 6.1 Beginner flow (first Chrome/Edge desktop flow)

```text
open Bookmark Manager
choose Export bookmarks
receive an HTML file
return to LoveBud
select or drag the HTML file
local/safe parse boundary
preview folders and supported links
select or exclude items
review proposed grouping
```

### 6.2 Required tutorial explanations

- this is **not** a password/history export;
- LoveBud needs **only the bookmark HTML file**;
- the original browser bookmarks are **not changed**;
- the full file should **not be retained** after the bounded import operation unless separately approved;
- unsupported protocols and unsafe URLs are **excluded**;
- later extension access is **optional** and requires explicit permission.

### 6.3 Copy contract (Korean-first)

| Fact | Required copy meaning |
|------|----------------------|
| not password/history | “비밀번호나 방문 기록이 아니라, 즐겨찾기만 담긴 HTML 파일이에요” |
| only bookmark HTML | “북마크 HTML 파일만 선택해 주세요” |
| browser unchanged | “브라우저의 원래 북마크는 바뀌지 않아요” |
| no retention | “가져오기가 끝나면 이 파일은 보관하지 않아요” (separately-approved retention excepted) |
| unsupported excluded | “지원하지 않는 주소는 제외돼요” |
| extension optional | “나중에 브라우저 확장 프로그램으로 더 쉽게 가져올 수 있어요 (선택)” |

## 7. Normalized preview-state vocabulary

One normalized preview vocabulary shared by playlist and bookmarks:

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

Rules:

- **Playlist order is playback order only.** It must **not** fabricate emotional/narrative Connections.
- `duplicate` = same source item already present or repeated inside the source.
- `unavailable` = private/deleted/region-unavailable item.
- `unsupported` = unsupported protocol, unsafe URL, or non-playable media.
- `needs review` = item the user should confirm before write (e.g., unusual source, near-duplicate).
- A proposed Tree title/visibility is always reviewable before any write.

## 8. Desktop and mobile accessibility and focus requirements

The tutorial and preview surface must satisfy the repository accessibility conventions (`docs/accessibility/ACTIVE_PAGES_ACCESSIBILITY_COVERAGE.md`, focus-visibility hardening in `docs/engineering/GLOBAL_FOCUS_VISIBILITY_HARDENING_AUDIT.md`):

- one visible focus target at a time; visible focus indicator on every interactive control;
- modal/dialog surfaces (if used) manage focus: open → focus lands inside; close → focus returns to the trigger; Escape closes;
- keyboard-only flow completes both routes end to end (no pointer-only action);
- expandable help uses a disclosure pattern with `aria-expanded` and labelled control;
- error messages are associated with their inputs (`aria-describedby`) and announced;
- per-item included/excluded toggles are labelled with the item title and state;
- desktop and mobile share the same step/copy contract; mobile uses a scrollable sheet or bottom sheet with the same focus and disclosure rules;
- reduced-motion friendly: no essential information conveyed by animation alone;
- color is never the only signal for unavailable/unsupported/duplicate states (text label required);
- touch targets meet the repository minimum size on mobile.

## 9. Privacy, retention, and consent copy

- The import surface must state plainly what data is provided (playlist metadata/URLs, or bookmark titles/URLs) before the user proceeds.
- Public/private implications must be stated for both routes.
- The bookmark HTML file is used only for the bounded import operation and is **not retained** afterwards unless the user separately approves retention.
- No credentials, tokens, playlist titles, URLs, Moment text, or user identifiers in logs (repository logging rule).
- Imported Trees default private/draft unless an approved current contract says otherwise; private source access never makes a Tree public automatically.
- Public YouTube availability does **not** equal permission to expose private LoveBud notes.

## 10. Error and recovery matrix

| Error/state | Recovery copy (required meaning) | Recovery action |
|-------------|----------------------------------|-----------------|
| invalid/empty playlist URL | “재생목록 링크를 확인해 주세요” | re-paste; keep prior input |
| private/unlisted-not-shared playlist | “공개 또는 링크 공유 재생목록만 가져올 수 있어요” | change playlist visibility, then retry |
| playlist not found / deleted | “재생목록을 찾을 수 없어요” | check link, retry, or start a new one |
| one intentional invalid input | tutorial teaches recovery from an invalid paste without losing the rest of the flow | inline error + clear retry |
| bookmark HTML file too large / too many items | “파일이 너무 커요” | bounded limits; retry with smaller file |
| unsupported/unsafe URL inside file | “지원하지 않는 주소는 제외했어요” | preview lists excluded items; no silent drop |
| provider/API quota or transient failure | “잠시 후 다시 시도해 주세요” | fail-closed, no partial preview |
| duplicate item | “이미 있는 순간이에요” | marked duplicate; user may exclude or keep with review |

The user must always be able to **recover from one intentional invalid input** (a required tutorial-trial item) and continue the flow.

## 11. Owner real-use acceptance checklist

After a future implementation reaches Production, the owner performs the first real import manually. The implementation is **not** product-accepted merely because automated tests pass. Record technical validation and owner tutorial/usability acceptance **separately**.

Reusable acceptance checklist (each item is a yes/no owner verdict):

```text
could find the source link/file without outside help
understood what data was being provided
understood public/private implications
could recover from one intentional invalid input
could preview and exclude items
understood Tree versus Moment mapping
understood that Connections are not auto-created
could complete the flow on desktop
could understand the same tutorial on mobile
```

## 12. Ordered implementation children (maximum 3)

| Order | Child scope | Depends on | Stop condition |
|-------|-------------|-----------|----------------|
| 1 | Public YouTube playlist URL validation + read-only import preview (no Tree write, no schema change) | this contract | preview accepted by owner |
| 2 | Bookmark HTML upload with local/safe parse boundary + preview and selection (no persistence, no retention without approval) | child 1 preview contract | preview accepted by owner |
| 3 | Idempotent transactional write: one import creates one Tree + ordered Moments; provenance/order/idempotency/visibility | child 1 and 2 accepted | post-import canonical reread matches; owner tutorial acceptance checklist complete |

## 13. Explicit non-actions

```text
no automatic semantic Connections from playlist adjacency
no OAuth in the first MVP
no browser-extension permission in the first MVP
no video downloading, transcoding, clipping, or re-hosting
no bypassing YouTube ads, controls, availability, or embedding policy
no silent retention of the uploaded bookmark HTML file
no implementation in legacy Vercel/Netlify backend artifacts
no broad plugin/provider framework prematurely
no one large cross-repository implementation PR
```

---

## Keep-open references

- Keep **#3903 OPEN**.
- Keep **#3897 OPEN**.
- Keep **#1882 OPEN** — use only `Refs #1882`.
- No `Closes`, `Fixes`, or `Resolves` for any of the above.
