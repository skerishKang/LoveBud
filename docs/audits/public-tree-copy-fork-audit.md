# Public Tree Copy/Fork Audit

**Status:** Draft audit  
**Owner:** CTO  
**Date:** 2026-04-26  
**Scope:** docs-only design audit; no implementation

---

## 1. Purpose

This audit defines a safe implementation path for copying or forking a public LoveTree into the current user's private/editable workspace.

This document does not implement tree copy, fork, import, API routes, database writes, or UI buttons.

---

## 2. Current observed paths

### 2.1 Browser API client

`js/postgres-client.js` exposes browser-side API methods through `window.apiClient`.

Relevant private tree methods:

- `getTrees()` -> `GET /api/trees`
- `getTree(treeId)` -> `GET /api/trees/:treeId`
- `createTree(payload)` -> `POST /api/trees`
- `updateTree(treeId, payload)` -> `PUT /api/trees/:treeId`
- `deleteTree(treeId)` -> `DELETE /api/trees/:treeId`

Relevant private memory methods:

- `getMemory(memoryId)` -> `GET /api/memories/:memoryId`
- `getMemoriesByTree(treeId)` -> `GET /api/memories?treeId=<treeId>`
- `createMemory(payload)` -> `POST /api/memories`
- `updateMemory(memoryId, payload)` -> `PUT /api/memories/:memoryId`
- `deleteMemory(memoryId)` -> `DELETE /api/memories/:memoryId`

Relevant public browse methods:

- `getPublicTrees(options)` -> `GET /api/community/trees?...`
- `getPublicTreePreview(tree)` -> public memories hydration through `/api/community/memories?treeId=<treeId>`

### 2.2 Active runtime route shape

The current browser contract is same-origin `/api/*`.

Current active route shape is:

```text
Cloudflare Pages same-origin /api/*
→ Cloudflare Pages Functions under functions/api/*
→ Modal
```

`functions/api/[[path]].js` currently handles recognized GET/community/private read routes through Modal and returns 405 for recognized Modal-owned non-GET routes handled by the catch-all. Write implementation must not be added casually to this catch-all without route-specific contract review.

### 2.3 API contract baseline

The current documented response contract uses flat camelCase models.

Tree baseline fields include:

- `id`
- `ownerId`
- `title`
- `visibility`
- `createdAt`
- `updatedAt`
- `nodeCount`
- `payload`

Memory baseline fields include:

- `id`
- `treeId`
- `parentId`
- `title`
- `memo`
- `artist`
- `source`
- `sourceUrl`
- `sourceType`
- `thumbnail`
- `emotionTags`
- `timestamp`
- `visibility`
- `createdAt`
- `updatedAt`

---

## 3. Product semantics

Recommended product language:

- Korean: `내 러브트리로 가져오기`
- English: `Copy to my LoveTrees`

Avoid using only `fork` in user-facing Korean UI. `Fork` is useful internally because it implies lineage, but non-technical users are more likely to understand copy/import language.

---

## 4. Recommended implementation model

### 4.1 Preferred first implementation

Implement a backend-owned copy endpoint rather than composing many frontend create calls.

Candidate endpoint:

```text
POST /api/trees/:treeId/copy
```

Candidate request:

```json
{
  "source": "public-tree-preview",
  "targetVisibility": "private"
}
```

Candidate response:

```json
{
  "id": "new_tree_id",
  "sourceTreeId": "original_public_tree_id",
  "title": "Copied tree title",
  "visibility": "private",
  "copiedMemoryCount": 0,
  "createdAt": "..."
}
```

Initial version may copy tree metadata only and defer memory copy if backend write complexity is high. If memories are copied in v1, the copy operation must preserve order and safe public fields only.

### 4.2 Why backend-owned copy is safer

A backend-owned endpoint can:

- verify the viewer is logged in
- verify source tree is public or otherwise copyable
- avoid trusting frontend owner fields
- prevent duplicate copy spam with idempotency guard
- copy allowed public memory fields consistently
- record lineage safely

Frontend-composed copy through `createTree()` and repeated `createMemory()` calls is possible but riskier because partial failures can leave half-copied trees.

---

## 5. Lineage fields

Recommended internal lineage fields:

```text
sourceTreeId
copiedFromTreeId
copyType
copiedAt
```

Recommended MVP minimum:

- `sourceTreeId`: original public tree id
- `copyType`: `public_copy`

Use only one canonical field in the database/API contract if possible. `sourceTreeId` is clearer for future imports, while `forkedFromTreeId` is clearer for Git-like semantics. Product copy language suggests `sourceTreeId`.

---

## 6. Auth and logged-out handling

Logged-out user flow:

1. User clicks `내 러브트리로 가져오기`.
2. UI routes to login with redirect back to the source tree/search state.
3. After login, user returns and can retry copy.

Do not create anonymous local-only copies as the first implementation. They would complicate ownership, conflict resolution, and data persistence.

---

## 7. Duplicate click and idempotency

Minimum frontend guard:

- disable button while request is in flight
- show progress label
- prevent double click in the same UI session

Recommended backend guard:

- optional idempotency key per source tree and user
- or check if the same user recently copied the same source tree

Without backend guard, network retry can create duplicate copied trees.

---

## 8. Public/private field safety

When copying from public browse data, do not copy hidden/private fields.

Safe candidate fields:

- tree title
- public description or theme fields if present
- public representative thumbnail/source metadata
- public memories only
- public memory text/media metadata that is already visible

Do not copy:

- original owner id as new owner id
- private memories
- private payload fields
- analytics/viewer state
- moderation/internal flags unless explicitly designed

---

## 9. Recommended PR split

### PR A — docs-only design audit

This document. No code changes.

### PR B — backend/API contract

- Add endpoint contract to `docs/engineering/API_CONTRACT.md`.
- Add contract tests first if local environment is stable.
- Do not add Search UI in this PR.

### PR C — backend implementation

- Implement `POST /api/trees/:treeId/copy` in the active Cloudflare/Modal path.
- Verify auth, source visibility, owner assignment, and duplicate guard.

### PR D — API client wrapper

- Add `copyPublicTree(treeId)` or similar to `js/postgres-client.js`.
- Keep response contract flat camelCase.

### PR E — UI integration

- Add `내 러브트리로 가져오기` button to Search Preview or detail surface.
- This must happen after PR #85 link-copy behavior is stable.
- Include logged-out redirect behavior.

### PR F — fixed-slot browser verification

- Verify logged-in copy flow on a CTO-assigned fixed slot.
- Verify copied tree appears in My Trees.
- Verify copied tree can be opened in editor.
- Verify no private source data leaks.

---

## 10. PR #85 interaction

PR #85 added a Search Preview link-copy action. Copy/Fork UI must not reuse or overload that button.

Future Search Preview actions should be visually separated:

- `감상 링크 복사`: share/view link action
- `내 러브트리로 가져오기`: authenticated copy/import action

Do not add copy/fork behavior inside the existing share-link handler.

---

## 11. Open questions

1. Should copied trees default to private or public?
2. Should memory copy happen in v1 or should v1 copy tree metadata only?
3. Should the product call this copy, import, remix, or fork?
4. Should duplicate copies be allowed if user intentionally copies again?
5. Should source owner attribution be displayed in copied tree metadata?
6. Should copied public memories keep original timestamps or receive new timestamps?

---

## 12. Explicit non-changes

- No API route changes.
- No Modal changes.
- No Cloudflare route changes.
- No database/schema changes.
- No Search Preview UI changes.
- No tree copy/fork/import implementation.
- No branch or slot updates.
