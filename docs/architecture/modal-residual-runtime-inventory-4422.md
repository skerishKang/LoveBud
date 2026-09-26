# LoveBud residual Modal runtime inventory — #4422

**Parent:** #4000  
**Phase:** 5A source/config inventory  
**Reconciled against source/config baseline:** `17b207dae7c1e0ee8a8d483d366d2c28aec6abda`  
**Status:** #4423/#4424/#4425 Production-live completion reflected; residual Phase-5 uncertainty remains limited to the no-gate Tree Likes GET and generic Comment DELETE surfaces.

This document records which current same-origin LoveBud routes can still reach Modal after the Direct-Neon cutovers. It deliberately distinguishes **route-level gate status** from **request-class behavior**. A route marked `PRODUCTION_LIVE` in the Direct-Neon readiness matrix may still send a subset of requests to Modal when the source contract deliberately defers them before any Direct-Neon database work.

No Production route, database, provider, secret, Modal configuration, or deployment is changed by this document.

## Classification vocabulary

Product-route classifications (closed set):

| Classification | Meaning |
|---|---|
| `DIRECT_NEON_ACTIVE_MODAL_FALLBACK_ONLY` | Production gate selects Direct-Neon for this exact method/request class; Modal source remains only as rollback/default fallback. |
| `ACTIVE_MODAL_GENERAL_READ` | Current source has a first-party Product caller and the request is still handled by Modal as a general read. |
| `ACTIVE_MODAL_GENERAL_WRITE` | Current source still routes this write class to Modal as ordinary Product persistence/business logic. |
| `ACTIVE_MODAL_SPECIALIZED_COMPUTE` | Current Product route intentionally uses Modal for provider/Python-heavy specialized compute. |
| `KEEP_MODAL_BY_DESIGN` | Current architecture explicitly retains this route on Modal. |
| `LEGACY_OR_UNREACHABLE_MODAL_SOURCE` | The current source graph proves the route is no longer reachable; retirement may be considered separately. |
| `INCONCLUSIVE_NEEDS_RUNTIME_EVIDENCE` | Source route remains, but current first-party caller was not proven; runtime usage evidence is required before retirement. |

`GET /modal/health` is an operational endpoint, **outside the Product CRUD/read-model classification set**; it is not assigned a Product-route classification.

## 1. General-read migrations completed since the original inventory

The five general-read request classes that were source-proven active at the original Phase 5A baseline no longer require Modal in Production:

| Browser route | Production status | Rollback posture |
|---|---|---|
| `GET /api/memories/:memoryId/reactions` | `DIRECT_NEON_PRODUCTION_LIVE` (#4423) | Modal source retained as gate fallback |
| `GET /api/memories/:memoryId/comments` | `DIRECT_NEON_PRODUCTION_LIVE` (#4423) | Modal source retained as gate fallback |
| `GET /api/trees/:treeId/memories/:memoryId/reactions` | `DIRECT_NEON_PRODUCTION_LIVE` (#4423) | Modal source retained as gate fallback |
| `GET /api/trees/:treeId/memories/:memoryId/comments` | `DIRECT_NEON_PRODUCTION_LIVE` (#4423) | Modal source retained as gate fallback |
| `GET /api/private/trees/:treeId/capability` | `DIRECT_NEON_PRODUCTION_LIVE` (#4424) | Modal source retained as gate fallback |

The corresponding Modal endpoints remain source-visible for rollback/default behavior, but they are no longer classified as active general-read dependencies at current Production gate state. #4423 and #4424 are both complete.

## 2. Entitlement-bound private write migrations completed

The four request classes below previously deferred to Modal because the Plus/private-storage entitlement boundary was Modal-owned. That boundary work is now complete (#4425 closed), and all four classes are Direct-Neon Production live, with Modal retained only as the gated rollback/default fallback.

| Request class | Browser route | Production gate | Current classification |
|---|---|---|---|
| private Tree Create | `POST /api/trees` (explicit `visibility: "private"`) | `LB_TREE_PRIVATE_CREATE_WRITE_RUNTIME` | `DIRECT_NEON_ACTIVE_MODAL_FALLBACK_ONLY` |
| private Tree visibility update | `PUT /api/trees/:id` (public → `visibility: "private"`) | `LB_TREE_PRIVATE_VISIBILITY_WRITE_RUNTIME` | `DIRECT_NEON_ACTIVE_MODAL_FALLBACK_ONLY` |
| private / inherited-private Memory Create | `POST /api/memories` (private, or omitted/null visibility that may resolve private) | `LB_MEMORY_PRIVATE_CREATE_WRITE_RUNTIME` | `DIRECT_NEON_ACTIVE_MODAL_FALLBACK_ONLY` |
| private Memory visibility update | `PUT /api/memories/:id` (`visibility: "private"`) | `LB_MEMORY_PRIVATE_VISIBILITY_WRITE_RUNTIME` | `DIRECT_NEON_ACTIVE_MODAL_FALLBACK_ONLY` |

Current readiness authority for all four gates:

```text
CHECKED_IN_PRODUCTION_GATE
LIVE_GATE_VERIFIED
PRODUCTION_LIVE
disposition C
```

#4425 status: **CLOSED / COMPLETE** — entitlement blocker cleared.

Current first-party UI continues to expose private visibility transitions. Examples include `js/my-trees/my-trees-actions.js` and `js/editor/editor-tree-helpers.js`, which toggle Tree visibility through the canonical API. Those private-write paths are now served by Direct-Neon, with Modal retained as the gated fallback rather than as the active private path.

Historical note — **prior to #4425 completion** — these four classes fell through to Modal as the active private path, and the Plus/private-storage entitlement was Modal-owned. That transition state is superseded and must not be read as the current state.

## 3. Source-present routes requiring runtime usage evidence

Both residual routes below are reachable from the edge to Modal with **no runtime gate** at the source/config baseline. Neither may be deleted or migrated from source alone.

### Tree Likes GET

```text
GET /api/trees/:treeId/likes

edge =
functions/api/trees/[tree_id]/likes.js

source behavior =
onRequestGet -> proxyTreeLike -> Modal

Modal endpoint =
GET /modal/private/trees/{tree_id}/likes
```

#4494 adds a **source-only gated Direct-Neon read candidate**:

```text
helper =
functions/_shared/tree-like-read-direct-neon.js

gate =
LB_TREE_LIKE_READ_RUNTIME=direct_neon

read authority =
LOVE_PLATFORM_DATABASE_URL

required privilege envelope =
trees SELECT
tree_likes SELECT
tree_social_counts SELECT
```

The candidate preserves the observable authenticated GET contract with SELECT-only
queries: verified Firebase requester identity, exact-public Tree boundary, active
requester Like detection, and `likeCount` with missing aggregate treated as zero.
It deliberately does not reproduce Modal's incidental aggregate-row INSERT/COMMIT,
because that write is not observable in the GET response.

At the reconciled Production baseline, #4494 **does not activate this gate**.
Absent / `modal` / unknown values still route GET to Modal. POST Like remains
independently governed by `LB_TREE_LIKE_WRITE_RUNTIME`.

No current first-party GET caller was found in source search. No zero-traffic
proof exists for this route.

```text
SOURCE_CANDIDATE = PRESENT
PRODUCTION_GATE_ACTIVATION = NOT_AUTHORIZED
B1_ACL_ATTESTATION = NOT_AUTHORIZED
DEFAULT_PRODUCTION_AUTHORITY = MODAL
no caller found != dead route
```

Classification at current Production gate state:
`INCONCLUSIVE_NEEDS_RUNTIME_EVIDENCE` for retirement; Production migration
remains a separate #4422/#4486 authority lifecycle.

### Generic Comment DELETE

```text
DELETE /api/comments/:commentId

edge =
functions/api/comments/[id].js

Modal endpoint =
DELETE /modal/private/comments/{comment_id}
```

#4492 adds a **source-only gated Direct-Neon candidate**:

```text
helper =
functions/_shared/comment-delete-direct-neon.js

gate =
LB_COMMENT_DELETE_WRITE_RUNTIME=direct_neon

writer authority =
LOVE_PLATFORM_WRITE_DATABASE_URL
```

The source candidate preserves the current Modal self-delete contract: verified
Firebase actor authority, UUID validation, author-only deletion, idempotent return
for already non-visible rows, `status='deleted'` / `deleted_at` /
`deleted_by` mutation, `comment.soft_delete` audit, atomic commit, and explicit
`COMMIT_OUTCOME_UNKNOWN` with no blind retry.

At the reconciled Production baseline, #4492 **does not activate this gate**.
Absent / `modal` / unknown values still route to the existing Modal endpoint.
No current first-party DELETE caller was found in source search, but the route
remains contract-pinned by:

```text
tests/contracts/self-comment-delete-contract.test.cjs
```

Therefore the route is still **not retirement-ready**, and source-candidate
availability is not evidence that Production general Modal traffic is zero.

Current disposition:

```text
SOURCE_CANDIDATE = PRESENT
PRODUCTION_GATE_ACTIVATION = NOT_AUTHORIZED
PRODUCTION_DB_OR_ACL_MUTATION = NOT_AUTHORIZED
DEFAULT_PRODUCTION_AUTHORITY = MODAL
```

Classification at current Production gate state:
`INCONCLUSIVE_NEEDS_RUNTIME_EVIDENCE` for retirement; migration activation is a
separate #4422 authority/lifecycle.

### Evidence posture for both routes

```text
no zero-traffic proof exists for B1/B2;
retirement or migration requires a separate caller-evidence /
route-disposition preflight.

Do not generate Product traffic merely to manufacture telemetry.
```

## 4. Explicit Modal retention

### Appreciation-order GET

`GET /api/trees/:id/appreciation-order`

The Direct-Neon readiness matrix explicitly marks this read `KEEP_MODAL_BY_DESIGN`. The corresponding POST write is already Direct-Neon, but the GET read remains Modal-owned by current architecture.

Classification: `KEEP_MODAL_BY_DESIGN`.

No migration or removal is authorized solely by #4422.

### YouTube playlist preview

`POST /api/import/youtube/playlist/preview`

The edge route is a bounded same-origin proxy to `/modal/private/import/youtube/playlist/preview`; the Modal target path is fixed, the proxy uses `MODAL_BASE_URL`, and `js/api/import-youtube-playlist-preview.js` is a current first-party caller. The Modal implementation uses provider/Python-heavy logic and is aligned with #4000's intended specialized-compute role.

Current classification: `ACTIVE_MODAL_SPECIALIZED_COMPUTE`.

This route should be retained unless a separate design proves that specialized compute is no longer required.

### Modal health

`GET /modal/health`

Operational endpoint outside the Product-route classification set (`OPERATIONS_ONLY`).

Retain until the final specialized-compute runtime contract and health monitoring path are explicitly updated.

## 5. Modal app historical CRUD endpoints vs active edge routing

`modal_compute/app.py` still exposes the historical general read/write surface:

- browse latest/growing/community memories;
- public Tree/Memory detail;
- Tree view write;
- owner Tree list/create/detail/update/delete/fork;
- owner Memory list/create/detail/update/delete;
- Tree likes/comments;
- Memory reactions/comments;
- comment delete;
- appreciation order;
- hub layout;
- YouTube playlist preview;
- public social reads.

The mere presence of those Python routes does **not** prove active Production Modal traffic. For many of them, current Production edge gates select Direct-Neon, leaving the Modal endpoint as fallback/rollback source only. No zero-traffic proof exists for the residual no-gate surfaces, so a separate caller-evidence / route-disposition preflight is required before any endpoint removal.

## 6. Current contraction blockers

At source/config baseline `fc84f642efe386a69106ef02dc721f553b1fff16`:

- `MODAL_BASE_URL` removal is **not ready**;
- `min_containers` reduction is **not ready**;
- full general-CRUD removal from Modal is **not proven**;
- Modal app source deletion is **not authorized**.

Current state and blocking work:

1. #4423 — **complete**; all four Memory social GET request classes are Direct-Neon Production live.
2. #4424 — **complete**; private Tree capability GET is Direct-Neon Production live.
3. #4425 — **complete / closed**; the Plus/private-storage entitlement boundary is out of Modal, and the four entitlement-bound private write request classes are Direct-Neon Production live. The entitlement blocker is cleared.
4. The residual Phase-5 general-route problem remains two Production-Modal surfaces:
   - `GET /api/trees/:treeId/likes` — #4494 source candidate present, but Production read gate activation/B1 ACL is not authorized and the default route remains Modal-backed;
   - `DELETE /api/comments/:commentId` — #4492 source candidate present, but Production gate activation/ACL is not authorized and the default route remains Modal-backed.
   Retirement is not authorized for either.
5. Appreciation-order GET remains `KEEP_MODAL_BY_DESIGN`.
6. YouTube playlist preview remains `ACTIVE_MODAL_SPECIALIZED_COMPUTE`.
7. Retain explicit specialized compute / design-retained routes until separately reconsidered.

Disposition at this baseline:

```text
ENTITLEMENT_BLOCKER_4425 = CLEARED

GENERAL_MODAL_TRAFFIC_ZERO_BY_SOURCE = NO

MODAL_GENERAL_CRUD_SOURCE_CONTRACTION_READY = NO

MODAL_BASE_URL_REMOVAL_READY = NO

MIN_CONTAINERS_REEVALUATION_READY = NO

DEAD_ROUTE_REMOVAL_READY = NO
```

`GENERAL_MODAL_TRAFFIC_ZERO_BY_SOURCE = NO` is **not** a claim that measured runtime traffic is greater than zero. It means:

```text
current source still exposes two unconditional Modal general-route handlers,
so zero general Modal reachability is not established.
```

### Next action

```text
NEXT_PHASE =
separate B1/B2 caller-evidence and route-disposition preflight
```

Not authorized by this document:

- migration implementation;
- route deletion;
- Modal endpoint deletion;
- `MODAL_BASE_URL` removal;
- `min_containers` mutation.

## 7. Safety

This inventory is source/config evidence only.

It authorizes no:

- Product request;
- Production DB connection;
- DB/ACL mutation;
- Firebase/Firestore mutation;
- provider or secret mutation;
- Modal deploy/config change;
- `min_containers` change;
- `MODAL_BASE_URL` removal;
- Production gate activation;
- route deletion.
