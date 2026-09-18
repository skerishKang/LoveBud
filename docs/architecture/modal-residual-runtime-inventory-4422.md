# LoveBud residual Modal runtime inventory — #4422

**Parent:** #4000  
**Phase:** 5A source/config inventory  
**Reconciled through current main:** `316fc35f38c7809b3289f0db45f19480997c562a`  
**Status:** current-main reconciliation after #4423/#4424 Production-live cutovers; Phase 5B runtime attribution remains partial for inconclusive residual routes.

This document records which current same-origin LoveBud routes can still reach Modal after the Direct-Neon cutovers. It deliberately distinguishes **route-level gate status** from **request-class behavior**. A route marked `PRODUCTION_LIVE` in the Direct-Neon readiness matrix may still send a subset of requests to Modal when the source contract deliberately defers them before any Direct-Neon database work.

No Production route, database, provider, secret, Modal configuration, or deployment is changed by this document.

## Classification vocabulary

| Classification | Meaning |
|---|---|
| `DIRECT_NEON_ACTIVE_MODAL_FALLBACK_ONLY` | Production gate selects Direct-Neon for this exact method/request class; Modal source remains only as rollback/default fallback. |
| `ACTIVE_MODAL_GENERAL_READ` | Current source has a first-party Product caller and the request is still handled by Modal as a general read. |
| `ACTIVE_MODAL_GENERAL_WRITE` | Current source still routes this write class to Modal as ordinary Product persistence/business logic. |
| `ENTITLEMENT_BOUND_MODAL_WRITE` | The write intentionally stays on Modal because Plus/private-storage entitlement remains Modal-owned. |
| `ACTIVE_MODAL_SPECIALIZED_COMPUTE` | Current Product route intentionally uses Modal for provider/Python-heavy specialized compute. |
| `KEEP_MODAL_BY_DESIGN` | Current architecture explicitly retains this route on Modal. |
| `INCONCLUSIVE_NEEDS_RUNTIME_EVIDENCE` | Source route remains, but current first-party caller was not proven; runtime usage evidence is required before retirement. |
| `OPERATIONS_ONLY` | Operational endpoint rather than Product CRUD/read-model traffic. |

## 1. General-read migrations completed since the original inventory

The five general-read request classes that were source-proven active at the original Phase 5A baseline no longer require Modal in Production:

| Browser route | Production status | Rollback posture |
|---|---|---|
| `GET /api/memories/:memoryId/reactions` | `DIRECT_NEON_PRODUCTION_LIVE` (#4423) | Modal source retained as gate fallback |
| `GET /api/memories/:memoryId/comments` | `DIRECT_NEON_PRODUCTION_LIVE` (#4423) | Modal source retained as gate fallback |
| `GET /api/trees/:treeId/memories/:memoryId/reactions` | `DIRECT_NEON_PRODUCTION_LIVE` (#4423) | Modal source retained as gate fallback |
| `GET /api/trees/:treeId/memories/:memoryId/comments` | `DIRECT_NEON_PRODUCTION_LIVE` (#4423) | Modal source retained as gate fallback |
| `GET /api/private/trees/:treeId/capability` | `DIRECT_NEON_PRODUCTION_LIVE` (#4424) | Modal source retained as gate fallback |

The corresponding Modal endpoints remain source-visible for rollback/default behavior, but they are no longer classified as active general-read dependencies at current Production gate state. #4423 is technically complete; #4424 is closed and complete.

## 2. Request-class splits still intentionally using Modal for private storage

The current Direct-Neon write gates are not complete route replacements.

### Tree Create

`POST /api/trees`

- omitted visibility -> Direct-Neon public create;
- explicit `visibility: "public"` -> Direct-Neon;
- explicit `visibility: "private"` -> the Direct-Neon helper returns `null` before DB acquisition and the route falls through to Modal;
- reason: Plus/private-storage entitlement remains owned by the Modal path.

Classification:

- public slice: `DIRECT_NEON_ACTIVE_MODAL_FALLBACK_ONLY`;
- private slice: `ENTITLEMENT_BOUND_MODAL_WRITE`.

### Memory Create

`POST /api/memories`

- exact explicit `visibility: "public"` -> Direct-Neon;
- omitted/null visibility -> Modal, because parent Tree inheritance may resolve private;
- explicit private -> Modal;
- other non-public values stay on the existing Modal parity/validation path.

Classification:

- explicit-public slice: `DIRECT_NEON_ACTIVE_MODAL_FALLBACK_ONLY`;
- omitted/private entitlement-sensitive slice: `ENTITLEMENT_BOUND_MODAL_WRITE`.

### Tree Update

`PUT /api/trees/:id`

- ordinary non-private updates use the live Direct-Neon gate;
- explicit update to `visibility: "private"` intentionally defers to Modal before direct DB work.

Classification:

- non-private slice: `DIRECT_NEON_ACTIVE_MODAL_FALLBACK_ONLY`;
- private-visibility slice: `ENTITLEMENT_BOUND_MODAL_WRITE`.

### Memory Update

`PUT /api/memories/:id`

- ordinary non-private updates use the live Direct-Neon gate;
- explicit `visibility: "private"` defers to Modal before direct DB work.

Classification:

- non-private slice: `DIRECT_NEON_ACTIVE_MODAL_FALLBACK_ONLY`;
- private-visibility slice: `ENTITLEMENT_BOUND_MODAL_WRITE`.

Current first-party UI continues to expose private visibility transitions. Examples include `js/my-trees/my-trees-actions.js` and `js/editor/editor-tree-helpers.js`, which toggle Tree visibility through the canonical API. Therefore these private-write paths cannot be treated as dead fallback code.

The entitlement-convergence work needed before Modal contraction is tracked in #4425.

## 3. Source-present routes requiring runtime usage evidence

| Browser route | Edge source | Modal endpoint | Source observation | Classification |
|---|---|---|---|---|
| `GET /api/trees/:treeId/likes` | `functions/api/trees/[tree_id]/likes.js` | `GET /modal/private/trees/{tree_id}/likes` | POST Like has a current first-party caller; no current first-party GET caller was found in source search | `INCONCLUSIVE_NEEDS_RUNTIME_EVIDENCE` |
| `DELETE /api/comments/:commentId` | `functions/api/comments/[id].js` | `DELETE /modal/private/comments/{comment_id}` | edge route remains; no current first-party JS caller was found in source search | `INCONCLUSIVE_NEEDS_RUNTIME_EVIDENCE` |

Neither route may be deleted from source based on caller search alone. #4422 Phase 5B runtime attribution is the required next evidence.

## 4. Explicit Modal retention

### Appreciation-order GET

`GET /api/trees/:id/appreciation-order`

The Direct-Neon readiness matrix explicitly marks this read `KEEP_MODAL_BY_DESIGN`. The corresponding POST write is already Direct-Neon, but the GET read remains Modal-owned by current architecture.

Classification: `KEEP_MODAL_BY_DESIGN`.

No migration or removal is authorized solely by #4422.

### YouTube playlist preview

`POST /api/import/youtube/playlist/preview`

The edge route is a bounded same-origin proxy to `/modal/private/import/youtube/playlist/preview`, and `js/api/import-youtube-playlist-preview.js` is a current first-party caller. The Modal implementation uses provider/Python-heavy logic and is aligned with #4000's intended specialized-compute role.

Provisional classification: `ACTIVE_MODAL_SPECIALIZED_COMPUTE`.

This route should be retained unless a separate design proves that specialized compute is no longer required.

### Modal health

`GET /modal/health`

Classification: `OPERATIONS_ONLY`.

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

The mere presence of those Python routes does **not** prove active Production Modal traffic. For many of them, current Production edge gates select Direct-Neon, leaving the Modal endpoint as fallback/rollback source only. Phase 5B must attribute actual usage before any endpoint removal.

## 6. Current contraction blockers

At current main:

- `MODAL_BASE_URL` removal is **not ready**;
- `min_containers` reduction is **not ready**;
- full general-CRUD removal from Modal is **not proven**;
- Modal app source deletion is **not authorized**.

Current state and blocking work:

1. #4423 — **technical implementation complete**; all four Memory social GET request classes are Direct-Neon Production live.
2. #4424 — **closed / complete**; private Tree capability GET is Direct-Neon Production live.
3. #4425 — **primary active blocker**; move Plus/private-storage entitlement boundary out of Modal and migrate the four entitlement-bound private write request classes:
   - private Tree create;
   - Tree visibility public → private;
   - private/inherited-private Memory create;
   - Memory visibility public → private.
4. #4422 Phase 5B — Tree Likes GET and generic Comment DELETE remain `INCONCLUSIVE_NEEDS_RUNTIME_EVIDENCE`; retirement is not authorized.
5. Appreciation-order GET remains `KEEP_MODAL_BY_DESIGN`.
6. YouTube playlist preview remains `ACTIVE_MODAL_SPECIALIZED_COMPUTE`.
7. Retain explicit specialized compute / design-retained routes until separately reconsidered.

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
