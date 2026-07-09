# LoveBud Tree-Level Comment Surface Contract

> **Issue:** #3372
> **Status:** Source-only contract/audit slice — documentation and contract tests only
> **Parent track:** #3188 tree-level social (whole-tree surface)
> **Sibling surface:** #3356 whole-tree social client surface contract (likes + comments overview)
> **Moment boundary reference only:** #3075
> **Runtime track boundary:** #3370 tree-like runtime behavior (unchanged by this slice)
> **Always Refs only:** #1882

---

## 1. Purpose and posture

This document defines the **tree-level comment surface contract** as a focused contract/audit slice under #3188. It is the whole-tree comments half of tree-level social, separate from the already-live moment-level comments of #3075.

It answers:

1. Where whole-tree comment affordances may later attach on client surfaces.
2. What client state machine the tree comment surface must support.
3. What API dependency shapes the tree comment surface may later rely on.
4. What must stay blocked, including #3370 tree-like runtime behavior and any new mutation activation.

### 1.1 What this document is

- A product/client surface contract for **tree-scoped** comments (`target_kind = 'tree'`, `target_id = <tree UUID>`).
- An inventory of current client surfaces relevant to future tree comment placement.
- A state and API dependency contract for later UI/client adapter work.

### 1.2 What this document is not

- Not UI implementation.
- Not CSS or layout change.
- Not client adapter or API call implementation.
- Not runtime/server behavior change. **#3370 tree-like runtime behavior is explicitly out of scope and unchanged.**
- Not DB migration or DB apply.
- Not production smoke, fixture use, tree writer activation, or production visual confirmation.
- Not a change to active Browse / My Trees / Editor / Scout / Hermes behavior.
- Not a change to moment-level #3075 behavior except as an explicit scope boundary.

**Activation posture:** whole-tree comment UI and client adapters remain **blocked**. This contract alone does **not** authorize client activation, runtime change, or DB change.

---

## 2. Scope separation: tree-level comments vs selected-moment comments (#3075)

| Scope | Target key | Product meaning | Client ownership |
|---|---|---|---|
| **Tree-level comments** (this contract) | `treeId` only | Discussion about the full public LoveTree, its overall feeling and curation | Future tree-level comment surfaces only |
| **Selected-moment comments** (#3075) | `(treeId, memoryId)` | Comment on one selected moment/node | Existing moment comment panel / composer under #3075 |

### 2.1 Hard separation rules

- Tree-level comment controls must never reuse moment DOM IDs, moment client adapters, or moment API paths as if they were tree-scoped.
- Selected-moment #3075 surfaces remain the sole home for moment-level comments.
- Tree-level and moment-level comment counts must never be merged into one ambiguous number on the same control without an explicit product decision.
- Future tree comment UI must preserve the product language of **트리 전체 댓글** vs **이 순간 댓글**.
- The tree comment composer must not be mounted inside the selected-moment comment composer, and vice versa.

### 2.2 #3075 boundary (reference only)

Moment-level comments are documented and partially live under #3075:

- public moment comment read panel
- authenticated moment comment composer path
- selected-moment detail panel placement

This contract **must not** modify, rewire, or extend those paths. It may only reference them as the non-tree boundary.

---

## 3. Current client/source surface inventory

Evidence baseline aligns with `docs/product/lovebud-tree-social-client-surface-contract.md` (#3356) and current `main` after #3370.

### 3.1 Tree Workspace / public tree display

| Surface | Current role for tree comments | Notes |
|---|---|---|
| Public tree read surface — tree identity / header band | No active whole-tree comment control | Future candidate host for open-tree-comments entry |
| Tree Workspace right hub — tree-scope section (not moment card) | No active tree comment panel | Future candidate host for whole-tree comments panel |
| Tree Workspace view mode detail panel | Selected-moment social only | Moment comment card/composer live under moment scope (#3075 boundary) |
| Editor left/sidebar tree meta | Owner tree identity, visibility, moment count | Not a public comment write surface |
| Viewer local placeholders (`treeComments`, `open-tree-comments`) | Dead/local-only hooks | No production client adapter; must not be treated as activated runtime |
| `js/visitor-viewer/*` prototype | Prototype-only tree social dock/panel | Not production entry; not wired to production API |

### 3.2 Browse / My Trees card affordances

| Surface | Current role | Notes |
|---|---|---|
| Browse/Search tree cards | Read-only metric display when payload provides `commentCount` | Values come from tree payload fields; not from a dedicated tree comment client adapter |
| My Trees cards / selected-tree hub | Owner management + read-only metric display when present | Owner hub is not the first write surface for whole-tree comments |
| Share/result surfaces | May surface count aliases for share copy | Display-only; no mutation |

### 3.3 Authenticated owner vs visitor vs guest (current)

| Actor | Whole-tree comments today | Moment comments today (boundary only) |
|---|---|---|
| Guest / signed-out | No tree comment write UI; read-only public list if feature ready | Public moment read + guest note; no write |
| Authenticated visitor | No production tree comment client surface | Moment comment write paths may be available when auth-confirmed and eligible |
| Authenticated owner | Same as visitor for public comment response; owner moderation remains future | Owner sees owner edit surfaces separately from public comments |

### 3.4 Server-side tree comment path (client still blocked)

The authenticated tree-like route exists server-side after #3370, but:

- there is **no production client adapter** for tree comments
- tree comment routes and adapters are **not present** and remain later work
- this contract **must not** activate any route, and must not change #3370 runtime behavior
- tree comment reads/writes remain gated behind dedicated runtime hardening and authenticated verification issues

---

## 4. Future tree-level comment surface affordance inventory

This section names **allowed future placement candidates**. It does not implement them.

### 4.1 Primary future surfaces (preferred)

| Candidate surface | Future role | Priority direction |
|---|---|---|
| **Public tree read surface — tree identity / header band** | `open tree comments` entry that opens the whole-tree comment panel | Primary for visitors |
| **Public tree read surface — tree metadata / summary strip** | Read-only `commentCount` when authoritative data exists | Primary for guests and visitors |
| **Tree Workspace right hub — tree-scope section (not moment card)** | Whole-tree comments panel host when tree scope is selected | Primary for in-workspace discussion |
| **Tree Workspace header secondary actions** | Optional open-comments control when header remains calm | Allowed if density permits |

### 4.2 Secondary / deferred surfaces

| Candidate surface | Future role | Constraint |
|---|---|---|
| Browse/My Trees cards or result surfaces | Optional compact **read-only** `commentCount` already partially present | Prefer counts-only; avoid composer on dense discovery cards in first activation |
| My Trees selected-tree hub | Owner-facing read summary of whole-tree comments | No requirement to put composer here first |
| Prototype visitor-viewer dock | Reference only | Must not be reactivated as production without a dedicated implementation issue |

### 4.3 Actor presentation matrix (future)

| Actor | Tree comment list | Tree comment composer |
|---|---|---|
| **Guest / signed-out** | Read-only when public tree + feature ready; otherwise hidden | Disabled / not mounted; optional quiet sign-in note |
| **Authenticated eligible visitor** | Read-only load + empty/error states | Eligible when public tree and write path verified |
| **Authenticated owner on public tree** | Same read list | Same composer eligibility; owner moderation controls are **future separate contract** |
| **Any actor on private/draft/non-public tree** | Hidden/blocked | Hidden/blocked |

### 4.4 Placement anti-patterns

Future UI work must not:

- place the tree comment composer inside the selected-moment comment composer
- place the moment comment composer under a tree-level comments heading
- put write controls on Browse cards in the first activation slice without a separate product decision
- treat dead viewer placeholders as already-shipped product behavior
- invent `commentCount` when the summary payload is missing
- present a tree comment control that silently does nothing (no inert controls)

---

## 5. Client state contract for future tree-level comments

All states below are **contractual requirements for later client implementation**. They are not implemented by this slice.

### 5.1 Shared session / eligibility states

| State id | Meaning | Client requirement |
|---|---|---|
| `loading` | Auth or tree comment summary not yet resolved | Show non-committing loading affordance; no mutation; no fabricated counts |
| `signed_out_guest_read_only` | No confirmed auth session | Public read only; no unauthenticated mutation calls; composer disabled/not mounted; optional quiet sign-in note |
| `authenticated_eligible_actor` | Confirmed auth + public tree + feature gates pass | Mutation affordances may enable only after server hardening + verification activation is approved |
| `private_draft_non_public_blocked` | Tree is private, draft, missing, or not publicly comment-eligible | Hide or block whole-tree comment surface; no existence leak via distinct private error copy when product policy requires `not found` equivalence |

### 5.2 Whole-tree comment list states

| State id | Meaning | Client requirement |
|---|---|---|
| `comments_loading` | List fetch in progress | Loading region; no empty success copy yet; clear loading affordance |
| `comments_empty` | Public tree, feature ready, authoritative empty list | Gentle empty state; not an error; real "no comments yet" copy |
| `comments_ready` | Authoritative comment page loaded | Render safe public comment DTO fields only |
| `comments_error` | Load failed | Safe error copy + retry affordance if appropriate; distinguish from empty |
| `comments_feature_not_ready` | Backend/read contract not product-ready | Explicit not-ready or quiet non-list treatment — must not look like a successful empty list if comments are not actually loading |

### 5.3 Whole-tree comment composer states

| State id | Meaning | Client requirement |
|---|---|---|
| `composer_disabled_guest` | Guest or auth unknown | No submit path; no 401 mutation loops; control not mounted as submittable |
| `composer_disabled_feature_blocked` | Server hardening/write path not activated | Composer remains disabled/not mounted |
| `composer_eligible` | Auth confirmed + public tree + write path verified | Composer enabled; requires explicit user submit |
| `composer_submit_pending` | Create in flight with stable `Idempotency-Key` | Disable double submit; preserve key for replay |
| `composer_submit_failure` | Create failed | Keep draft text if product allows; safe error copy; no raw backend dump |
| `composer_validation_error` | Blank/invalid body before submit | Inline safe validation copy; no request sent |

### 5.4 No inert controls rule

Every tree comment affordance rendered to a user must be in one of:

- a real, interactive control with a clear loading/success/error lifecycle, or
- a plainly read-only element (count text, disabled state with explanation, or sign-in note)

A tree comment control must **never** visually resemble an interactive control while silently doing nothing.

### 5.5 Count truthfulness rules

- **No fabricated counts.** Never invent `commentCount` for visual balance.
- **Real zero vs unavailable:**
  - authoritative `0` → may show `0`
  - unavailable / not loaded / feature not ready → hide metric or show non-numeric loading/unavailable treatment, never fake zero as success
- Optimistic/derived counts must reconcile to the authoritative safe DTO after settle.

### 5.6 Auth and noise rules

- **No unauthenticated mutation calls.** Guest UI must not POST tree comments.
- Auth-unknown must behave as guest read-only for mutations.
- Client must not thrash private endpoints in a way that creates noisy 401 loops for guests.

---

## 6. API dependency expectations (no calls implemented)

This section defines what a future client adapter may depend on. It does **not** implement adapters, routes, or fetches, and does not change #3370.

### 6.1 Read summary endpoint — expected safe shape

Logical future whole-tree comment summary (public or auth-enriched) should expose only safe fields such as:

```text
treeCommentSummary:
- treeId: string (UUID)           # identity only; not shown as raw UI chrome
- commentCount: integer >= 0      # authoritative aggregate when present
- commentsFeatureReady: boolean   # explicit readiness if needed
```

Public guest reads must not require mutation auth and must not return private account fields, raw DB rows, tokens, audit rows, or internal exception text.

If the tree is not public/comment-eligible, the client must treat the outcome as **hidden/blocked** rather than rendering a private tree comment panel.

### 6.2 List endpoint — expected safe DTO shape

Expected public-safe tree comment list item:

```text
treeCommentListItem:
- id: string
- targetScope: "tree"
- body: string
- createdAt: string
- authorDisplayLabel: string | anonymous-safe label
```

### 6.3 Mutation endpoint — expected safe DTO shape

Future whole-tree comment create (only if/when a separate write contract lands) should return a public-safe comment DTO, for example:

```text
treeCommentMutationResult:
- id: string
- targetScope: "tree"
- body: string
- createdAt: string
- authorDisplayLabel: string | anonymous-safe label
```

### 6.4 Mutation transport expectations (client-side)

When later implemented, client mutations must:

1. require confirmed authenticated session before POST
2. send a client-generated stable `Idempotency-Key` per intentional user action
3. treat same-key responses as authoritative replay-safe results
4. never display the idempotency key, Authorization material, tokens, UIDs, raw payloads, or stack traces in UI/ARIA
5. reconcile UI from safe DTO fields only

### 6.5 Error mapping expectations

| Backend/safe category (illustrative) | UI mapping |
|---|---|
| Unauthenticated | Keep guest read-only; optional sign-in note; no raw 401 body |
| Not public / not found | Hidden or blocked comment surface |
| Idempotency key invalid/reused | Safe retry/guidance; no raw code dump |
| Rate limited / write unavailable | Safe retry later message |
| Validation failure | Field-level safe copy when possible |
| Unknown failure | Generic safe failure + rollback for composer |

**No raw backend errors in UI.** Map to product-safe messages only.

### 6.6 What the client must not call yet

Until an explicit activation issue lands after dedicated tree-comment runtime hardening + verification:

- no production client adapter for tree comment create/list
- no speculative pre-auth private comment fetches from guest shells
- no use of moment adapters (`createComment`, public moment readers) as tree-level substitutes
- no change to #3370 tree-like runtime behavior

---

## 7. Accessibility, focus, and live-status expectations (later UI)

These are requirements for a later UI implementation PR, not present visual work.

### 7.1 Control semantics

- `open tree comments` control must be a real button with accessible name that includes whole-tree scope (e.g. tree comments, not selected-moment comments).
- Comment list items need sufficient text alternative; author labels must be safe display labels, not raw IDs.
- Composer fields need associated labels and disabled-state announcements.

### 7.2 Live status

- Pending comment operations should update a polite live region with short safe status (e.g. saving / saved / failed).
- Failure rollback must move or restore focus predictably without trapping keyboard users.
- Loading and empty comment regions must be announced without implying write success.

### 7.3 Focus

- Opening a tree comments panel should move focus into the panel heading or first focusable control.
- Closing should restore focus to the invoking control.
- Disabled composer must not appear focusable as if submittable.

### 7.4 Safe text

Accessible names, live regions, and error text must never include raw IDs, tokens, stack traces, Authorization headers, API base URLs, dashboard URLs, DB rows, or private payload fragments.

---

## 8. Activation gates (client remains blocked)

Client/UI activation of whole-tree comments requires **all** of the following to be explicitly complete and approved in later issues:

1. Migration A + Gate A complete (done on track).
2. Migration B + Gate B complete (done on track).
3. Server/runtime hardening boundary for tree targets (#3355 and its implementation children), extended to tree comments.
4. Authenticated runtime verification for tree comments with safe replay/idempotency/visibility behavior.
5. Dedicated client adapter issue for tree comments.
6. Dedicated UI implementation issue(s) that follow this surface contract.
7. Controlled non-production verification before any production visual confirmation.

**This #3372 contract satisfies none of steps 3–7 by itself.** #3370 tree-like runtime behavior is unchanged.

---

## 9. Explicit non-goals

This document and its companion contract test:

- do **not** implement UI, CSS, or layout
- do **not** implement client adapters or API calls
- do **not** change runtime/server behavior, including #3370 tree-like runtime behavior
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

- `docs/product/lovebud-tree-social-client-surface-contract.md` — whole-tree social client surface overview (#3356)
- `docs/product/lovebud-tree-target-runtime-hardening-boundary.md` — tree-target runtime hardening boundary (#3355)
- `docs/product/lovebud-tree-level-social-boundary-audit.md` — current tree social surface inventory
- `docs/product/TREE_LEVEL_COMMENTS_READ_CONTRACT.md` — tree comment read contract planning
- `docs/product/TREE_MOMENT_SOCIAL_MODEL.md` — tree vs moment product model
- `docs/product/lovebud-moment-social-write-readiness-contract.md` — moment write readiness (#3075 gate)
- `docs/product/lovebud-tree-workspace-moment-social-actionability-audit.md` — moment actionability audit

---

## 11. Companion test

Focused source-level contract coverage lives in:

`tests/contracts/tree-comment-surface-contract.test.cjs`

The test asserts document structure, tree vs moment (#3075) separation, #3370 runtime-unchanged boundary, actor/state inventory, API dependency expectations, accessibility expectations, no-inert-controls rule, safe-error/no-raw-output rule, activation blocking, and forbidden-boundary language. It does not exercise network, browser, DB, or production runtime.
