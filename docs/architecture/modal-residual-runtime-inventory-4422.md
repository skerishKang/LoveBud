# LoveBud residual Modal runtime inventory — #4422

**Parent:** #4000  
**Phase:** 5A source/config inventory  
**Reconciled against source/config baseline:** `17b207dae7c1e0ee8a8d483d366d2c28aec6abda`  
**Status:** Phase-5 closeout reconciled. #4423/#4424/#4425 are complete; generic Comment DELETE source/config integration is complete; Tree Likes GET is retained on Modal as an explicit legacy-compatibility exception because no current first-party GET caller exists. #4486 is not a #4000 closure blocker.

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
| `RETAIN_MODAL_LEGACY_COMPATIBILITY` | Route remains available for compatibility, but current first-party Product source has no caller; it is not a required active general-CRUD dependency and is not forced through migration solely for architectural neatness. |

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

## 3. Residual route closeout dispositions

The original Phase-5 inventory left Tree Likes GET and generic Comment DELETE unresolved. Current-main reconciliation now separates their final dispositions: Tree Likes GET is retained as a legacy compatibility endpoint with no current first-party GET caller, while generic Comment DELETE has completed its Direct-Neon source/config integration.

### Tree Likes GET

```text
GET /api/trees/:treeId/likes
```

Current source facts:

- #4494 / PR #4495 delivered a tested SELECT-only Direct-Neon candidate.
- The candidate remains behind `LB_TREE_LIKE_READ_RUNTIME`; the gate is intentionally **not checked in**.
- Current first-party source search proves the Viewer client calls this route with **POST only**; no production client adapter or JavaScript GET caller exists.
- Existing product architecture docs independently record zero client-side GET calls / no production client adapter for the authenticated Tree Like summary.
- Phase-5 runtime telemetry could not provide complete route-level attribution, so this is **not** a claim that every historical or external client sends zero requests.
- #4486 exhausted the safe runtime-read-role identity paths and remains unable to authorize a minimal B1 ACL attestation.

Closeout decision:

```text
SOURCE_CANDIDATE = PRESENT
FIRST_PARTY_PRODUCT_GET_CALLER = ABSENT
LB_TREE_LIKE_READ_RUNTIME = NOT_CHECKED_IN
DEFAULT_ROUTE = MODAL
CLASSIFICATION = RETAIN_MODAL_LEGACY_COMPATIBILITY
B1_DIRECT_NEON_ACTIVATION_PLANNED = NO
#4486_BLOCKS_#4000 = NO
```

The route is retained rather than deleted because complete external/legacy-client zero-traffic proof is unavailable. It is also not forced through a Production read-role/ACL migration merely to satisfy infrastructure uniformity. If a future Product requirement introduces a first-party authenticated Tree Like GET consumer, that future change must reopen a fresh route-specific migration/privilege authority.

This exception does **not** keep the general Product CRUD migration open: current first-party Product behavior does not depend on this GET route.

### Generic Comment DELETE

```text
DELETE /api/comments/:commentId
```

Current closeout state:

- #4492 added the gated Direct-Neon implementation.
- Production configuration now checks in `LB_COMMENT_DELETE_WRITE_RUNTIME=direct_neon`.
- The writer boundary is `LOVE_PLATFORM_WRITE_DATABASE_URL`.
- The required writer privilege envelope was reconciled and source/config integration completed under #4422.
- Current first-party source search still finds no Comment DELETE client caller.
- Browser-native Product functional proof was deferred behind the shared authentication migration (#4006) after the transitional Firebase QA credential path failed; that deferral is **not** a reason to keep #4000 open.

```text
SOURCE_CONFIG_INTEGRATION = COMPLETE
CHECKED_IN_GATE = direct_neon
FIRST_PARTY_PRODUCT_DELETE_CALLER = ABSENT
PRODUCT_FUNCTIONAL_PROOF = DEFERRED_AUTH_MIGRATION_DEPENDENCY
#4000_CLOSURE_BLOCKER = NO
```

The retained Modal DELETE implementation remains rollback/compatibility source. Any future auth-dependent Product proof belongs to the shared-auth migration lifecycle rather than the Modal-to-Neon architecture parent.

### Evidence posture

```text
B1 complete external zero-traffic proof = unavailable
B1 first-party GET caller = absent
B1 disposition = retain Modal legacy compatibility

B2 source/config integration = complete
B2 first-party DELETE caller = absent
B2 browser functional proof = deferred to #4006 auth migration

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

## 6. Phase-5 closeout

Current-main closeout disposition:

1. #4423 — **complete**; four Memory social GET classes are Direct-Neon Production live.
2. #4424 — **complete**; private Tree capability GET is Direct-Neon Production live.
3. #4425 — **complete**; private-storage entitlement and private Tree/Memory write classes no longer require Modal as active general CRUD.
4. #4531 — **complete**; private-storage entitlement rollback semantics were reconciled.
5. B2 generic Comment DELETE — **source/config integration complete**; auth-dependent browser proof is deferred to #4006 and is not a #4000 blocker.
6. B1 Tree Likes GET — **RETAIN_MODAL_LEGACY_COMPATIBILITY**; no current first-party GET caller, no planned Production Direct-Neon activation, and #4486 is removed from the #4000 critical path.
7. Appreciation-order GET — **KEEP_MODAL_BY_DESIGN**.
8. YouTube playlist preview — **ACTIVE_MODAL_SPECIALIZED_COMPUTE**.
9. `/modal/health` — operations-only retained endpoint.

Final architecture boundary for #4000:

```text
ACTIVE_FIRST_PARTY_GENERAL_CRUD_DEPENDENCY_ON_MODAL = NO
RETAINED_MODAL_SPECIALIZED_COMPUTE = YES
RETAINED_MODAL_DESIGN_SPECIFIC_READ = YES
RETAINED_MODAL_LEGACY_COMPATIBILITY_ENDPOINT = YES

MODAL_BASE_URL_REMOVAL = NOT_REQUIRED_FOR_#4000_CLOSE
MODAL_SOURCE_DELETION = NOT_REQUIRED_FOR_#4000_CLOSE
MIN_CONTAINERS_CHANGE = SEPARATE_OPERATIONS_DECISION

PHASE5_CONTRACTION_COMPLETE = YES
#4422_CLOSE_READY = YES
#4000_CLOSE_READY = YES
```

The parent goal is contraction of Modal from the **active first-party general CRUD critical path**, not deletion of every historical/fallback/compatibility endpoint. Retained compatibility and specialized-compute surfaces are explicit and must not be interpreted as unfinished general CRUD migration.

### Future invalidation rule

Reopen or create a fresh route-specific child only if one of these becomes true:

- first-party Product code starts consuming authenticated Tree Likes GET;
- a retained compatibility Modal endpoint becomes required by an active Product flow;
- appreciation-order is reclassified as ordinary general CRUD;
- YouTube preview no longer qualifies as specialized compute;
- a future runtime change makes Modal a required general CRUD hop again.

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
