# LoveBud Tree-Level Comment Read / List Client Integration Contract

> **Issue:** #3412
> **Status:** Source-only client integration contract — documentation and contract tests only
> **Parent track:** #3188 tree-level social (whole-tree comments surface)
> **Predecessors:** #3410 tree comment read/list API implementation (GET route + `fetch_tree_comments` reader + `app.py` registration), #3408 tree comment read/list runtime wiring, #3404 tree comment read/list route contract, #3405 tree comment read/list route contract prep, #3400 tree comment read/list boundary audit issue, #3401 tree comment read/list boundary audit, #3398 tree comment create/write path (route + writer), #3396 tree comment create route/writer helper, #3394 tree comment API/writer boundary audit, #3393 writer boundary audit, #3388/#3392 tree comment storage schema foundation, #3372 tree-level comment surface contract
> **Moment boundary reference only:** #3075
> **Always Refs only:** #1882

---

## 1. Purpose and posture

This document defines the **client integration contract** for whole-tree comment read/list as the next step after the #3410 backend/API read-list implementation. The dedicated `GET /api/trees/:treeId/comments` route, the `fetch_tree_comments` Modal reader, and `app.py` registration now exist (#3410/#3408). This contract fixes, in documentation and contract tests only, what the **client-side integration** must look like before any client adapter or UI implementation child.

It answers, with evidence from current `main` (`7d0d2c6`) source:

1. What is the candidate client adapter/module for tree-comment read/list?
2. What is the request contract the client must honor (`treeId`, optional `limit`, no cursor)?
3. What is the response normalization contract (bounded `comments`, safe fields, no raw account id)?
4. What are the safe client states for read/list?
5. What is the guest / public read behavior (guest read/list allowed, no 401 loop, no guest mutation)?
6. How is this strictly separated from #3075 moment comments?
7. What is the no-UI boundary for this child (no drawer / modal / Tree Workspace / CSS)?
8. What future implementation gates follow?

### 1.1 What this document is

- A client integration contract for **tree-scoped** comment read/list (`target_kind = 'tree'`, `target_id = <tree UUID>`).
- A definition of the future client adapter/module candidate, request contract, response normalization, safe client states, guest read behavior, and error mapping.
- A handoff spec for later client adapter and UI integration children.

### 1.2 What this document is not

- Not client adapter implementation. **No `fetchTreeComments(treeId)` is implemented in this PR.** No `js/social/tree-comments-client.js` is created.
- Not UI / CSS / modal / drawer implementation. **No drawer, modal, Tree Workspace surface, or CSS is added.**
- Not backend route/reader change. `GET /api/trees/:treeId/comments`, `fetch_tree_comments`, and `app.py` registration from #3410/#3408 are **unchanged in behavior by this PR**.
- Not moment-level #3075 change. The moment comment route/helper/client adapters are untouched.
- Not Scout files change.
- Not DB schema / migration change.
- Not production/staging SQL execution. Not production smoke.
- **#3370 tree-like runtime behavior and #3075 moment behavior are explicitly out of scope and unchanged.**

**Activation posture:** the client adapter surface does not exist yet. This contract alone does **not** authorize client adapter or UI implementation.

---

## 2. Client adapter / module candidate

| Candidate | Location | Reuse / note |
|---|---|---|
| Reader adapter | `js/social/tree-comments-client.js` (candidate, repository-consistent with `js/*` social clients) | new file, tree-target only; exposes `fetchTreeComments(treeId, { limit })`; not implemented in this PR |
| Export surface | `window.LoveBudTreeComments` (candidate global export) | browser-global module split, consistent with the current project loading model; not implemented in this PR |
| No moment reuse | `createComment` / `fetchComments` / `fetchPublicMomentComments` | moment-target only; must not be reused for tree comments |

The candidate client module is documented only. This PR does **not** create `js/social/tree-comments-client.js`, does **not** implement `fetchTreeComments`, and does **not** add any global export. The candidate path follows the repository browser-global module convention; should the implementation child choose a different repository-consistent path, the request/response/state contracts below still bind.

---

## 3. Request contract

| Parameter | Required | Validation / notes |
|---|---|---|
| `treeId` | yes | validated as UUID before calling; invalid → client safe state `invalid_tree_id` (no network call, or backend `400 INVALID_TREE_ID`) |
| `limit` | optional | positive integer; backend clamps to safe bounds (`1..50`, default `20`); client should send within bounds but must accept backend clamp |
| `cursor` | **none** | no cursor pagination in this contract; limit-only, matching the #3410 backend contract |

Contract rules:

- The client must call only the dedicated tree-target route `GET /api/trees/:treeId/comments`. It must **not** call `GET /api/trees/:treeId/memories/:memoryId/comments` or any moment comment route.
- The client must **not** forward `Idempotency-Key` (idempotency is a write concern only).
- The client must **not** send an Authorization header for guest/public read (public-read eligible surface). For authenticated read of an eligible public tree, an optional auth header is implementation-child behavior, but it must never trigger a guest 401 loop (see §5).
- The backend clamps `limit` to `1..50`; the client must treat the returned `comments` array as bounded and must not assume the requested `limit` equals the returned length when the backend clamps.

---

## 4. Response normalization

A bounded list of safe comment records:

```text
treeCommentList:
- comments: array<treeCommentListItem>   # bounded by backend clamp (1..50)

treeCommentListItem:
- id: string                 # comment UUID
- treeId: string (UUID)      # tree-target identity only
- body: string               # bounded, validated comment text
- createdAt: string          # ISO-8601
- updatedAt: string          # ISO-8601
- authorDisplayLabel: string # anonymous-safe public display metadata (never raw ownerId)
```

Required safe fields: `id`, `treeId`, `body`, `createdAt`, `updatedAt`, `authorDisplayLabel`. The list payload is **bounded** (never unbounded) and the returned records carry only safe fields:

- no raw account identifiers (`ownerId` / `owner_id` is replaced by `authorDisplayLabel`)
- no `target_kind`/`target_id` internals
- no audit rows, moderation flags, or write metadata
- no `memory_id` / moment linkage

Normalization must drop any raw account identifier if present in a malformed upstream payload, mapping it to a safe `authorDisplayLabel` only. Raw account identifiers are forbidden in the normalized client shape.

---

## 5. Guest / public read behavior

- On a **public comment-eligible tree**, guest / signed-out readers may call `GET /api/trees/:treeId/comments` and receive the bounded comment list. No login is required for read/list.
- Guests must **not** send any write/mutation/auth request for comments. They never call `POST /api/trees/:treeId/comments` and never attach an Authorization or auth credential to the read/list call.
- Read/list must **not** enter a `401` retry loop. Because the read/list surface is public-read eligible, a `401` must never be produced by the read/list path; if a `401` is ever received (transport anomaly), the client must collapse it into the `unexpected_safe_error` safe state and must **not** retry indefinitely. There is no guest→login→retry mutation path for read/list.
- Authenticated visitors and owners read the same public-read eligible surface; owner-only or authenticated-only fields are out of scope for this read/list contract.

---

## 6. Safe client states

The read/list client must expose the following discrete safe states:

- `idle` — no request issued yet
- `loading` — request in flight
- `loaded_empty` — request succeeded, `comments` is empty
- `loaded_with_comments` — request succeeded, `comments` non-empty (bounded)
- `invalid_tree_id` — `treeId` failed client-side UUID validation (no network call)
- `not_found_private_non_public` — backend collapsed missing / private / non-public tree to the same safe `404 Tree not found` (no existence leak)
- `upstream_unavailable` — backend `503 modal-unavailable`
- `upstream_timeout` — backend `504 modal-timeout`
- `unexpected_safe_error` — backend `500` / unexpected safe failure, or transport `401` anomaly (no retry loop)
- `retry` — explicit user-initiated retry only (from `upstream_unavailable` / `upstream_timeout` / `unexpected_safe_error`); never an automatic loop

All states are product-safe: no raw backend/auth/provider details, no DB rows, no token/header, no stack trace are surfaced to the UI.

---

## 7. Strict separation from #3075 moment comments

- The moment comment route `functions/api/trees/[tree_id]/memories/[memory_id]/comments.js` and writer/reader `modal_compute/comments.py` are **memory-target only** (`(treeId, memoryId)`) and must not be reused for tree comments.
- The moment client adapters `createComment` / `fetchComments` / `fetchPublicMomentComments` are **memory-target only** and must not be reused for tree comments. A future tree comment reader must be a separate `fetchTreeComments(treeId)` (tree-target naming), never a reuse of `fetchComments`.
- **No `memory_id`** appears anywhere in the tree comment read/list path.
- No moment drawer / composer behavior is added or changed by this child.
- No moment route / helper / client behavior is changed. #3075 moment-level behavior is referenced only as a boundary; it is not modified.

---

## 8. No-UI boundary

This child defines the **client contract only**:

- No drawer / modal implementation.
- No Tree Workspace surface integration.
- No CSS / layout change.
- No `fetchTreeComments` implementation or call site.
- No new public tree / Browse / My Trees / Editor / Scout surface wiring.

The client contract is the prerequisite for later UI integration children; it does not itself render or mount anything.

---

## 9. Future implementation gates

In order, dedicated later children:

1. **Client adapter implementation** — implement `js/social/tree-comments-client.js` with `fetchTreeComments(treeId, { limit })` honoring §3/§4/§5/§6; tree-target only; never reuse `fetchComments`.
2. **Read-list state tests** — unit tests for the safe client states (§6) against the #3410 backend contract, including guest read-only and no-401-loop behavior.
3. **Tree Workspace / public tree surface UI contract** — define the read-list surface (list, empty, loading, error) per #3372, no inert controls.
4. **UI integration** — mount the read/list surface on the eligible public tree surface; guest read-only.
5. **Non-prod verification** — controlled verification before any production visual confirmation.
6. **Production visual check** — only after merge/deploy and explicit user login review (not this contract).

**This #3412 contract satisfies none of steps 1–6 by itself.**

---

## 10. Explicit non-goals

This document and its companion contract test:

- do **not** implement the `fetchTreeComments` client adapter
- do **not** create `js/social/tree-comments-client.js`
- do **not** implement UI / CSS / modal / drawer
- do **not** integrate Tree Workspace or any public tree / Browse / My Trees / Editor / Scout surface
- do **not** change `functions/api/trees/[tree_id]/comments.js` runtime behavior (the #3410/`#3408` GET handler is unchanged by this PR)
- do **not** change `modal_compute/tree_comments.py` runtime behavior (the `fetch_tree_comments` reader is unchanged by this PR)
- do **not** change `modal_compute/app.py` runtime behavior (the GET tree-comments registration is unchanged by this PR)
- do **not** change tree-comment POST/create semantics
- do **not** implement moderation/deletion/notification/ranking/social sorting
- do **not** change Scout files
- do **not** change #1882 implementation behavior
- do **not** change moment-level #3075 behavior beyond referencing it as a boundary
- do **not** change DB schema / migration
- do **not** execute production/staging SQL
- do **not** run production smoke
- do **not** close #3188, #3075, or #1882
- do **not** expose raw/private values in docs, tests, examples, or reports

For #1882, references must use **`Refs #1882` only**. Never use GitHub close keywords (`Closes`, `Fixes`, or `Resolves`) with issues #3188, #3075, #1882.

---

## 11. Related documents

- `docs/product/lovebud-tree-comments-read-list-route-contract.md` — read/list route contract (#3404, #3405)
- `docs/product/lovebud-tree-comments-read-list-boundary-audit.md` — read/list boundary audit (#3401, #3400)
- `docs/product/lovebud-tree-comments-api-writer-boundary-audit.md` — writer boundary audit (#3394)
- `functions/api/trees/[tree_id]/comments.js` — #3410/#3408 GET read/list handler (source-only referenced, unchanged by this PR)
- `modal_compute/tree_comments.py` — `fetch_tree_comments` reader (#3410/#3408, unchanged by this PR)
- `modal_compute/app.py` — GET tree-comments registration (#3410/#3408, unchanged by this PR)
- `docs/product/lovebud-tree-comment-runtime-route-contract.md` — tree comment runtime route contract (#3378/#3381)
- `docs/product/lovebud-tree-comment-storage-schema-boundary-audit.md` — storage schema boundary audit (#3382/#3385)
- `scripts/migration-add-tree-comments.sql` — tree comment schema foundation (#3388/#3392)
- `modal_compute/comments.py` — moment comment writer/reader (boundary reference only, NOT reused)

---

## 12. Companion test

Focused source-level contract coverage lives in:

`tests/contracts/tree-comments-read-list-client-contract.test.cjs`

The test asserts that this document defines the client adapter/module candidate (`js/social/tree-comments-client.js`, not implemented), the request contract (`treeId` required, optional `limit` with backend `1..50` clamp, no cursor), the response normalization (bounded `comments`, safe fields `id`/`treeId`/`body`/`createdAt`/`updatedAt`/`authorDisplayLabel`, no raw account id), the safe client states (idle / loading / loaded empty / loaded with comments / invalid tree id / not found-private-non-public / upstream unavailable / upstream timeout / unexpected safe error / retry), guest/public read behavior (guest read/list allowed, no guest mutation, no 401 loop), strict #3075 moment-comment separation (no `memory_id`, no moment adapter reuse, no moment drawer/composer/route/helper/client change), the no-UI boundary (no drawer/modal/Tree Workspace/CSS), and the future implementation gates. It also verifies the current UI/client surfaces do not yet consume `GET /api/trees/:treeId/comments`, no drawer/modal/Tree Workspace integration is added, no Scout files are touched, no moment comment client/route/helper behavior is changed, the #3410 backend route/reader is unchanged by this PR, that this test does not import runtime/network/browser/DB clients, and that close/fix/resolve keywords are forbidden.
