# LoveBud Tree-Level Social Client Surface Contract

> **Issue:** #3356
> **Status:** Source-only client/UI surface contract — documentation and contract tests only
> **Parent track:** #3188 tree-level social
> **Parallel server track:** #3355 tree-target runtime hardening boundary inventory
> **Schema gates:** #3260, #3262, #3264, #3352, #3354 (Migration B + Gate B accepted)
> **Moment boundary reference only:** #3075
> **Always Refs only:** #1882

---

## 1. Purpose and posture

This document defines the **future whole-tree social client surface contract** for tree-level likes and tree-level comments after Gate B.

It answers:

1. Where whole-tree social affordances may appear later on client surfaces.
2. What client state machine each surface must support.
3. What API dependency shapes the client may later rely on.
4. What must stay blocked until server/runtime hardening and verification are complete.

### 1.1 What this document is

- A product/client surface contract for **tree-scoped** social UX.
- An inventory of current client surfaces relevant to future placement.
- A state and API dependency contract for later UI/client adapter work.

### 1.2 What this document is not

- Not UI implementation.
- Not CSS or layout change.
- Not client adapter or API call implementation.
- Not runtime/server behavior change.
- Not DB migration or DB apply.
- Not production smoke, fixture use, tree writer activation, or production visual confirmation.
- Not a change to active Browse / My Trees / Editor / Scout / Hermes behavior.
- Not a change to moment-level #3075 behavior except as an explicit scope boundary.

**Activation posture:** whole-tree social UI and client adapters remain **blocked** until server runtime hardening (#3355 track) and authenticated runtime verification are complete. This contract alone does **not** authorize client activation.

---

## 2. Scope separation: whole-tree vs selected-moment (#3075)

| Scope | Target key | Product meaning | Client ownership |
|---|---|---|---|
| **Whole-tree social** (this contract) | `treeId` only | Response to the full public LoveTree path, curation, and overall feeling | Future tree-level surfaces only |
| **Selected-moment social** (#3075) | `(treeId, memoryId)` | Response to one selected moment/node | Existing moment cards / composer / public moment read paths |

### 2.1 Hard separation rules

- Whole-tree like/comment controls must never reuse moment DOM IDs, moment client adapters, or moment API paths as if they were tree-scoped.
- Selected-moment #3075 surfaces remain the sole home for moment-level likes/comments.
- Tree-level and moment-level counts must never be merged into one ambiguous number on the same control without an explicit product decision.
- Future tree social UI must preserve the product language of **트리 전체 감상** vs **이 순간 감상**.

### 2.2 #3075 boundary (reference only)

Moment-level social is already documented and partially live under:

- public moment reaction/comment reads
- authenticated moment like toggle and comment composer paths
- selected-moment detail panel placement

This contract **must not** modify, rewire, or extend those paths. It may only reference them as the non-tree boundary.

---

## 3. Current client/source surface inventory

Evidence baseline aligns with `lovebud-tree-level-social-boundary-audit.md` and current `main` after Gate B.

### 3.1 Tree Workspace / public tree display

| Surface | Current role for tree social | Notes |
|---|---|---|
| Tree Workspace view mode (public canvas / viewer detail) | Selected-moment social only | Moment like/comment card and composer live under moment scope (#3075 boundary) |
| Tree Workspace header / top identity | Tree title, ownership, visibility-safe identity | No active whole-tree like/comment control |
| Right hub / detail panel metadata | Moment-first detail and owner actions | Tree-level social is not the primary right-hub job |
| Editor left/sidebar tree meta | Owner tree identity, visibility, moment count | Not a public social write surface |
| Viewer local placeholders (`likedTree`, `treeComments`, `toggle-like`, `open-tree-comments`) | Dead/local-only hooks | No production client adapter; must not be treated as activated runtime |
| `js/visitor-viewer/*` prototype | Prototype-only tree social dock/panel | Not production entry; not wired to production API |

### 3.2 Browse / My Trees card affordances

| Surface | Current role | Notes |
|---|---|---|
| Browse/Search tree cards | Read-only reaction metrics row (view/like/comment/share display fields when present) | Values come from tree-list/detail payload fields such as `likeCount` / `viewCount`; not from a dedicated tree social client write adapter |
| My Trees cards / selected-tree hub | Owner management + read-only social metric display when present | Owner hub is not the first write surface for whole-tree likes/comments |
| Share/result surfaces | May surface count aliases for share copy | Display-only; no mutation |

### 3.3 Authenticated owner vs visitor vs guest (current)

| Actor | Whole-tree social today | Moment social today (boundary only) |
|---|---|---|
| Guest / signed-out | Read-only counts on cards if payload provides them; no tree write UI | Public moment read + guest note; no write |
| Authenticated visitor | No production tree like/comment client surface | Moment write paths may be available when auth-confirmed and eligible |
| Authenticated owner | Same as visitor for public social response; owner moderation remains future | Owner sees owner edit surfaces separately from public social |

### 3.4 Server-side tree like path (client still blocked)

An authenticated tree-like route exists server-side (`/api/trees/:treeId/likes` → Modal tree likes), but:

- there is **no production client adapter** calling it
- idempotency / audit / hardening remain server-track concerns (#3355)
- this client contract **must not** activate that route

Tree-level comment routes and adapters are **not present** and remain later work.

---

## 4. Future whole-tree social affordance inventory

This section names **allowed future placement candidates**. It does not implement them.

### 4.1 Primary future surfaces (preferred)

| Candidate surface | Future role | Priority direction |
|---|---|---|
| **Public tree read surface — tree identity / header band** | Compact whole-tree like summary + open tree comments entry | Primary for visitors |
| **Public tree read surface — tree metadata / summary strip** | Read-only like/comment counts when authoritative data exists | Primary for guests and visitors |
| **Tree Workspace right hub — tree-scope section (not moment card)** | Whole-tree comments panel host when tree scope is selected | Primary for in-workspace discussion |
| **Tree Workspace header secondary actions** | Optional like control when header remains calm and not competing with primary tree navigation | Allowed if density permits |

### 4.2 Secondary / deferred surfaces

| Candidate surface | Future role | Constraint |
|---|---|---|
| Browse/My Trees cards or result surfaces | Optional compact **read-only** like/comment counts already partially present | Prefer counts-only; avoid mutation buttons on dense discovery cards in first activation |
| My Trees selected-tree hub | Owner-facing read summary of whole-tree response | No requirement to put write composer here first |
| Prototype visitor-viewer dock | Reference only | Must not be reactivated as production without a dedicated implementation issue |

### 4.3 Actor presentation matrix (future)

| Actor | Like control | Like count | Tree comments list | Tree comment composer |
|---|---|---|---|---|
| **Guest / signed-out** | Hidden or non-mutating sign-in note only | Read-only when authoritative | Read-only when public tree + feature ready | Disabled / not mounted |
| **Authenticated eligible visitor** | Enabled after server hardening + auth confirm | Read-only authoritative + optimistic pending states | Read-only load + empty/error states | Eligible when public tree and write path verified |
| **Authenticated owner on public tree** | Same as eligible visitor for personal like | Same | Same read list | Same composer eligibility; owner moderation controls are **future separate contract** |
| **Any actor on private/draft/non-public tree** | Hidden/blocked | Hidden/blocked | Hidden/blocked | Hidden/blocked |

### 4.4 Placement anti-patterns

Future UI work must not:

- place whole-tree composer inside the selected-moment reactions card
- place moment composer under a tree-level comments heading
- put write controls on Browse cards in the first activation slice without a separate product decision
- treat dead viewer placeholders as already-shipped product behavior
- invent counts when the summary payload is missing

---

## 5. Client state contract for future whole-tree social

All states below are **contractual requirements for later client implementation**. They are not implemented by this PR.

### 5.1 Shared session / eligibility states

| State id | Meaning | Client requirement |
|---|---|---|
| `loading` | Auth or tree social summary not yet resolved | Show non-committing loading affordance; no mutation; no fabricated counts |
| `signed_out_guest_read_only` | No confirmed auth session | Public read only; no unauthenticated mutation calls; composer disabled/not mounted; optional quiet sign-in note |
| `authenticated_eligible_actor` | Confirmed auth + public tree + feature gates pass | Mutation affordances may enable only after server hardening activation is approved |
| `private_draft_non_public_blocked` | Tree is private, draft, missing, or not publicly social-eligible | Hide or block whole-tree social surface; no existence leak via distinct private error copy when product policy requires `not found` equivalence |

### 5.2 Whole-tree like states

| State id | Meaning | Client requirement |
|---|---|---|
| `like_loading` | Summary not yet loaded | Neutral loading; do not show fake `0` if unavailable vs real zero is unknown |
| `like_ready_inactive` | Authoritative `active=false` | Show real `likeCount`; control idle |
| `like_ready_active` | Authoritative `active=true` | Show pressed/active semantics + real `likeCount` |
| `optimistic_like_pending` | User activated like toggle; request in flight with one stable `Idempotency-Key` | Disable duplicate intentional new keys until settle; keep pending UI; retain key for safe replay |
| `replay_duplicate_click_pending` | Extra clicks while pending or same-key replay | Do not open parallel unauthenticated calls; do not mint a new key for accidental double-click; await same pending operation / safe replay DTO |
| `like_failure_rollback` | Mutation failed or unsafe response | Roll back optimistic active/count to last authoritative snapshot; show safe user-facing error; never show raw backend errors |

### 5.3 Whole-tree comments states

| State id | Meaning | Client requirement |
|---|---|---|
| `comments_loading` | List fetch in progress | Loading region; no empty success copy yet |
| `comments_empty` | Public tree, feature ready, authoritative empty list | Gentle empty state; not an error |
| `comments_ready` | Authoritative comment page loaded | Render safe public comment DTO fields only |
| `comments_error` | Load failed | Safe error copy + retry affordance if appropriate; distinguish from empty |
| `composer_disabled_guest` | Guest or auth unknown | No submit path; no 401 mutation loops |
| `composer_disabled_feature_blocked` | Server hardening/write path not activated | Composer remains disabled/not mounted |
| `composer_eligible` | Auth confirmed + public tree + write path verified | Composer enabled; requires explicit user submit |
| `composer_submit_pending` | Create in flight with stable `Idempotency-Key` | Disable double submit; preserve key for replay |
| `composer_submit_failure` | Create failed | Keep draft text if product allows; safe error; no raw backend dump |
| `comments_feature_not_ready` | Backend/read contract not product-ready | Explicit not-ready or quiet non-list treatment — must not look like a successful empty list if comments are not actually loading |

### 5.4 Count truthfulness rules

- **No fabricated counts.** Never invent like/comment numbers for visual balance.
- **Real zero vs unavailable:**
  - authoritative `0` → may show `0`
  - unavailable / not loaded / feature not ready → hide metric or show non-numeric loading/unavailable treatment (`⋯` / hide), never fake zero as success
- Optimistic count adjustments must reconcile to the authoritative safe DTO after settle.

### 5.5 Auth and noise rules

- **No unauthenticated mutation calls.** Guest UI must not POST likes/comments.
- Auth-unknown must behave as guest read-only for mutations.
- Client must not thrash private endpoints in a way that creates noisy 401 loops for guests.

---

## 6. API dependency expectations (no calls implemented)

This section defines what a future client adapter may depend on. It does **not** implement adapters, routes, or fetches.

### 6.1 Read summary endpoint — expected safe shape

Logical future whole-tree social summary (public or auth-enriched) should expose only safe fields such as:

```text
treeSocialSummary:
- treeId: string (UUID)           # identity only; not shown as raw UI chrome
- likeCount: integer >= 0         # authoritative aggregate when present
- active: boolean | omitted       # present only for authenticated actor summary
- commentCount: integer >= 0      # optional aggregate when supported
- commentsFeatureReady: boolean   # optional explicit readiness if needed
```

Public guest reads must not require mutation auth and must not return private account fields, raw DB rows, tokens, audit rows, or internal exception text.

If the tree is not public/social-eligible, the client must treat the outcome as **hidden/blocked** rather than rendering a private tree social panel.

### 6.2 Mutation endpoint — expected safe DTO shape

Future whole-tree like toggle (after server hardening) is expected to return a minimized safe DTO, for example:

```text
treeLikeMutationResult:
- treeId: string (UUID)
- active: boolean
- likeCount: integer >= 0
```

Future whole-tree comment create (only if/when a separate write contract lands) should return a public-safe comment DTO, for example:

```text
treeCommentMutationResult:
- id: string
- targetScope: "tree"
- body: string
- createdAt: string
- authorDisplayLabel: string | anonymous-safe label
```

### 6.3 Mutation transport expectations (client-side)

When later implemented, client mutations must:

1. require confirmed authenticated session before POST
2. send a client-generated stable `Idempotency-Key` per intentional user action
3. treat same-key responses as authoritative replay-safe results
4. never display the idempotency key, Authorization material, tokens, UIDs, raw payloads, or stack traces in UI/ARIA
5. reconcile UI from safe DTO fields only

### 6.4 Error mapping expectations

| Backend/safe category (illustrative) | UI mapping |
|---|---|
| Unauthenticated | Keep guest read-only; optional sign-in note; no raw 401 body |
| Not public / not found | Hidden or blocked social surface |
| Idempotency key invalid/reused | Safe retry/guidance; no raw code dump |
| Rate limited / write unavailable | Safe retry later message |
| Validation failure | Field-level safe copy when possible |
| Unknown failure | Generic safe failure + rollback for likes |

**No raw backend errors in UI.** Map to product-safe messages only.

### 6.5 What the client must not call yet

Until an explicit activation issue lands after #3355 hardening + verification:

- no production client adapter for `POST /api/trees/:treeId/likes`
- no production tree comment create/list client adapter beyond current display-only count fields
- no speculative pre-auth private social fetches from guest shells
- no use of moment adapters (`toggleReaction`, `createComment`, public moment readers) as tree-level substitutes

---

## 7. Accessibility, focus, and live-status expectations (later UI)

These are requirements for a later UI implementation PR, not present visual work.

### 7.1 Control semantics

- Like control must be a real button (or equivalent) with accessible name that includes whole-tree scope (e.g. tree like, not selected-moment like).
- Pressed/active state must be exposed (`aria-pressed` or equivalent) when toggle semantics are used.
- Comment entry control must name tree scope distinctly from moment comments.
- Composer fields need associated labels and disabled-state announcements.

### 7.2 Live status

- Pending like/comment operations should update a polite live region with short safe status (e.g. saving / saved / failed).
- Failure rollback must move or restore focus predictably without trapping keyboard users.
- Loading and empty comment regions must be announced without implying write success.

### 7.3 Focus

- Opening a tree comments panel should move focus into the panel heading or first focusable control.
- Closing should restore focus to the invoking control.
- Disabled composer must not appear focusable as if submittable.

### 7.4 Safe text

Accessible names, live regions, and error text must never include raw IDs, tokens, stack traces, Authorization headers, or private payload fragments.

---

## 8. Activation gates (client remains blocked)

Client/UI activation of whole-tree social requires **all** of the following to be explicitly complete and approved in later issues:

1. Migration A + Gate A complete (done on track).
2. Migration B + Gate B complete (done on track).
3. Server/runtime hardening boundary inventory and implementation for tree targets (#3355 and its implementation children).
4. Authenticated runtime verification for tree like (and comments if in scope) with safe replay/idempotency/visibility behavior.
5. Dedicated client adapter issue.
6. Dedicated UI implementation issue(s) that follow this surface contract.
7. Controlled non-production verification before any production visual confirmation.

**This #3356 contract satisfies none of steps 3–7 by itself.**

---

## 9. Explicit non-goals

This document and its companion contract test:

- do **not** implement UI, CSS, or layout
- do **not** implement client adapters or API calls
- do **not** change runtime/server behavior
- do **not** apply DB migrations
- do **not** run production smoke or use fixtures
- do **not** activate tree writers
- do **not** change Browse / My Trees / Editor / Scout / Hermes active behavior
- do **not** change moment-level #3075 behavior beyond referencing it as a boundary
- do **not** close #3188, #3075, or #1882
- do **not** expose raw/private values in docs, tests, examples, or reports

For #1882, references must use **`Refs #1882` only**. Never use GitHub close keywords (`Closes`, `Fixes`, or `Resolves`) with issue 1882.

---

## 10. Related documents

- `docs/product/lovebud-tree-level-social-boundary-audit.md` — current tree social surface inventory
- `docs/product/lovebud-generic-social-write-target-contract.md` — generic target / tree-like write hardening plan
- `docs/product/TREE_MOMENT_SOCIAL_MODEL.md` — tree vs moment product model
- `docs/product/TREE_LEVEL_COMMENTS_READ_CONTRACT.md` — tree comment read contract planning
- `docs/product/PUBLIC_VIEWER_SOCIAL_PLACEHOLDER_PLAN.md` — early public viewer placement planning
- `docs/product/SELECTED_MOMENT_REACTION_PLACEMENT_CONTRACT.md` — moment placement boundary
- `docs/product/lovebud-moment-social-write-readiness-contract.md` — moment write readiness (#3075 gate)
- `docs/product/lovebud-tree-workspace-moment-social-actionability-audit.md` — moment actionability audit

---

## 11. Companion test

Focused source-level contract coverage lives in:

`tests/contracts/tree-social-client-surface-contract.test.cjs`

The test asserts document structure, state inventory, API dependency expectations, accessibility expectations, #3075 separation, activation blocking, and forbidden-boundary language. It does not exercise network, browser, DB, or production runtime.
