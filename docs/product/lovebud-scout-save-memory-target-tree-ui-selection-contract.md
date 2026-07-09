# LoveBud Scout MVP Save-Memory Target Tree UI Selection Integration Contract

## 1. Purpose

This document defines the **contract** for how the Scout reviewed save surface lets a user
**select / confirm the target LoveTree** before a save-memory reviewed payload is submitted to
the route. It is the UI/client-side companion to the server-side target tree selection contract
(#3406 / #3407): #3407 fixed the selection envelope, owner-identity source, ownership
validation, safe failure states, and the route handoff; this contract fixes the **client/UI
selection affordance** — where the picker lives, what it shows, the safe empty/missing/error
states, the accessibility contract, and the client payload envelope.

It is a contract and documentation document, not an implementation. It contains no target-tree
UI implementation, no client adapter behavior change, no route/intake runtime change, no
ownership validation helper, no storage writer, no `createMemory`, no memory insertion, no DB
schema/migration, no provider/fetcher/crawler/scraper/LLM wiring, no Firebase/auth/runtime
change, and no production smoke. The UI/selection mechanism is implemented only by later
implementation children that re-accept this contract.

This contract is a child of the parent Scout product issue (#1882) and inherits the link-source
safety boundary (#3365), the manual link-to-memory draft flow contract (#3375), the save-to-memory
payload contract (#3379 / #3380), the reviewed payload route intake contract (#3386 / #3387),
the reviewed payload route intake guard (#3395), the reviewed payload route readiness audit
(#3389 / #3390), the save-memory storage handoff boundary audit (#3397 / #3399), the save-memory
storage writer contract (#3402 / #3403), and the save-memory target tree selection contract
(#3406 / #3407). It must be read together with those documents.

## 2. Inherited boundaries

This contract is subordinate to:

- the link-source safety boundary (#3365) — source/content/storage/attribution rules
- the manual link-to-memory draft flow contract (#3375) — edit-before-save
- the save-to-memory payload contract (#3379 / #3380) — payload shape, generated-vs-reviewed, required/optional/forbidden fields
- the reviewed payload route intake contract (#3386 / #3387) — reviewed-only acceptance, required/optional/forbidden fields, safe error taxonomy, idempotency, storage handoff
- the reviewed payload route intake guard (#3395) — `FORBIDDEN_NAMES` rejection at intake
- the reviewed payload route readiness audit (#3389 / #3390) — route location, shell reuse, auth/storage/idempotency prerequisites
- the save-memory storage handoff boundary audit (#3397 / #3399) — storage allowed/forbidden fields, treeId UNRESOLVED posture, transformation, idempotency/duplicate prevention, safe audit logging, safe error taxonomy
- the save-memory storage writer contract (#3402 / #3403) — writer/helper shape, input/output DTO, ownership prerequisite, idempotency/duplicate prevention, future handoff
- the save-memory target tree selection contract (#3406 / #3407) — selection envelope, owner-identity source, ownership validation, safe failure states, route handoff

If this contract disagrees with #3365, #3375, #3379, #3383, or #3386, those documents win.

## 3. Existing LoveTree selection/listing affordance audit

This audit is source-check only (read, no behavior change). It answers: is there an already
reusable tree list / picker / My Trees / editor entrypoint that the Scout reviewed save surface
can reuse for target-tree selection?

### 3.1 Scout reviewed save surface (`js/scout/scout-draft-ui.js`)

- The reviewed save surface is the Scout draft modal + preview overlay built in
  `js/scout/scout-draft-ui.js`. It receives `treeId` as a host-supplied dependency
  (`deps.treeId`) and threads it into the draft (`draft.treeId = treeId || null`).
- There is **NO** in-modal target-tree picker, tree list, dropdown, or selection control today.
  The modal exposes source URL, excerpt, memo, emotion tags, preview, and save-only.
- `js/scout/scout-draft.js` builds the draft and a memory payload; it carries `treeId` through
  but does not surface any selection UI and does not validate ownership.

**Finding (Scout reviewed save surface):** no reusable target-tree picker is present in this
contract. The save-target selection affordance must be added here in a later implementation
child. Marked **UNRESOLVED / deferred**.

### 3.2 Browse/Search tree highlight (`js/search/*`)

- `js/search/index.js`, `js/search/search-index.js`, `js/search/search-preview-controller.js`,
  and `js/search/search-card-events.js` expose a `selectTree(tree, card)` control.
- That `selectTree` is a **browse-preview highlight** (which tree card is active / which preview
  is open), NOT a save-target selector. It is scoped to Search/Browse preview and is not wired
  to the Scout save payload.

**Finding (Browse/Search):** a tree-focus control exists, but it is a preview-highlight affordance,
not a reusable save-target picker. It is NOT a drop-in save-target selector for Scout.

### 3.3 My Trees / editor entrypoint (`pages/my-trees.html`, `pages/editor.html`, `pages/detail.html`)

- `pages/my-trees.html` lists the signed-in user's trees and is the canonical "my trees" surface.
- `pages/editor.html` is the editor entrypoint where a moment is authored against a tree.
- Neither currently exposes a standalone, importable "select a target LoveTree" component that
  the Scout reviewed save surface could embed without new UI work.

**Finding (My Trees / editor):** a user-owned tree list exists on My Trees, but no reusable
picker component/contract for embedding inside an arbitrary reviewed surface is confirmed in
this contract. Marked **UNRESOLVED / deferred**.

### 3.4 Audit conclusion

- "no reusable picker confirmed in this contract" for the Scout save-target selection role.
- This contract does NOT invent a picker. It documents the required placement and states, and
  leaves the concrete UI build to the implementation child (gate 1).
- The audit does not change any existing file; it only informs the future implementation.

## 4. Target-tree selection placement in the Scout reviewed save surface

The target-tree selection affordance is shown on the **reviewed save surface**, in this order:

1. The reviewed Scout payload is confirmed (reviewed-only fields validated, preview shown).
2. **Before** the save action is enabled/committed, the user sees a target-tree selection
   control with the currently **selected tree label/name** displayed.
3. If no tree is yet selected, the control shows the **empty / no-tree state** (e.g. "저장할
   러브트리를 선택하세요") with no implicit tree guessed.
4. The save action is **blocked or draft-only/holding** while selection is missing or unresolved
   (see §7 and #3407).

### 4.1 Selected tree label/name

- When a tree is chosen, the control displays the **selected tree's label/name** (no raw id in
  user-visible copy; the id stays an internal selection value).
- The displayed name is the tree's human-readable title, taken from the user's owned-tree list.

### 4.2 Empty / no-tree state

- When the user has zero owned trees, or none selected: the control shows a safe empty state.
- Copy: "저장할 러브트리가 없어요" / "먼저 러브트리를 만들어 주세요" (safe copy; no raw/private detail).
- Save is blocked (draft-only/holding) in this state.

### 4.3 Missing selection state

- When the user has owned trees but has not selected one: the control shows a missing-selection
  prompt and the save action remains disabled/held.
- Copy: "저장할 러브트리를 선택해 주세요".
- This is distinct from the empty state: trees exist, but none is chosen.

### 4.4 Tree list unavailable / retry state

- If the owned-tree list cannot be loaded (network/permission/transient): the control shows a
  tree-list-unavailable state with a safe retry affordance.
- Copy: "러브트리 목록을 불러오지 못했어요" + "다시 시도" (retry).
- No raw backend output, no token/cookie/session/ID leakage.
- Save is blocked while the list is unavailable.

### 4.5 Invalid / stale selected tree state

- If a previously selected tree becomes invalid/stale (deleted, soft-deleted, ownership changed,
  or no longer owned): the control shows an invalid/stale selected tree state and clears the
  selection.
- Copy: "선택한 러브트리를 사용할 수 없어요. 다른 러브트리를 선택해 주세요".
- Save is blocked until a valid owned tree is (re)selected.

### 4.6 Server-side unauthorized / ownership failure state

- After submission, if the server (future route) rejects the selection for unauthorized/ownership
  reasons (e.g. `tree_not_owned`, `tree_unavailable` from #3407): the surface shows a safe
  server-side failure state and returns the user to the selection step.
- Copy: "이 러브트리에 저장할 수 없어요" (no raw backend detail, no ownership/ID leak).
- The UI does NOT trust the client identity; the server result is authoritative.

## 5. Accessibility expectations

The target-tree selection control must meet:

- **Keyboard reachable**: focusable via Tab; operable with keyboard (Enter/Space/arrow selection
  where a listbox/combobox is used); no mouse-only path.
- **Clear label**: an associated, human-readable label (not just a placeholder); the selection
  state is announced by an accessible name.
- **Focus return**: when the picker popover/list is closed, focus returns to the trigger
  element; after a selection change, focus is managed predictably (no lost focus trap).
- **Status / live copy**: loading, error, and selection-change states are exposed via an
  `aria-live` region (polite) so screen readers announce "러브트리 목록 불러오는 중", "러브트리
  선택됨: <name>", and error copy without requiring focus changes.
- No focus trap, no raw/private value announced.

## 6. Client payload envelope

The client/UI selection step builds the reviewed+selection payload exactly as #3407 / #3386 fix:

- **Reviewed Scout payload fields stay reviewed-only**: `sourceLink`, `sourceLabel`,
  `memoryDraft`, optional bounded `summary`, `translatedSummary`, `fanContext`, `emotionTags`.
  The selection step adds NO owner/user field to this payload.
- **`treeId` is the target-selection field**: the UI supplies the selected tree's id as
  `treeId` only. It is a selection input, not an identity claim.
- **Owner/user id is NEVER sent from the client payload.** The client must not include any
  `ownerId`, `userId`, `uid`, `email`, or identity claim in the payload.
- **Client-supplied owner/user identity is forbidden.** Any identity claim in the payload is
  ignored/rejected at intake (#3386 / #3395). The server resolves owner identity from the
  verified auth context only.

## 7. #3407 unresolved posture bridge

This contract preserves the #3407 deferred posture:

- **Persistence is not enabled until a target tree is selected.** While `treeId` is unresolved,
  the route returns `persistence: 'gated'` (see #3407 §8).
- **Missing tree selection → save is blocked or draft-only/holding.** No write occurs with an
  unresolved target tree; the save sits in draft-only/holding posture (#3407 §3, #3397/#3399).
- **The UI/client does not invent or guess a tree.** It never auto-picks an arbitrary tree to
  satisfy the selection; if no explicit selection exists, it stays blocked/unresolved.
- Any repository-consistent default (e.g. last-used tree) must still resolve to an explicit owned
  `treeId` and re-run server-side ownership validation; it must not bypass the selection step.

## 8. Future route/intake handoff

The future route/intake path consumes the client selection as follows:

- The **future route receives `treeId` as a target-selection input** (not an identity input).
- The **server validates the auth-derived owner identity** from the verified auth context
  (reusing `live-auth-verifier-adapter.js`), never from the payload.
- The **server validates tree ownership**: `treeId` exists and is owned by the requester and is
  writable; cross-user save is forbidden (#3407 §6).
- **The route/intake still does not trust client identity.** A client-supplied `ownerId`/`userId`
  is ignored/rejected; the server-resolved identity wins.
- On success with a valid owned `treeId`, the selection result hands `{ treeId, ownerId, reviewed }`
  to `persistReviewedScoutMemoryDraft(...)` (writer child). On unresolved/missing selection, no
  write occurs.

## 9. Safe copy / safe errors

All client-visible copy and error states are safe (no raw backend output, no token/cookie/
session/ID leakage). Required safe states:

- **No trees available** (empty state): "저장할 러브트리가 없어요" / "먼저 러브트리를 만들어 주세요".
- **Tree list unavailable** (retry state): "러브트리 목록을 불러오지 못했어요" + "다시 시도".
- **Missing selection**: "저장할 러브트리를 선택해 주세요".
- **Invalid / stale selected tree**: "선택한 러브트리를 사용할 수 없어요. 다른 러브트리를 선택해 주세요".
- **Unauthorized / ownership failure after server validation**: "이 러브트리에 저장할 수 없어요".
- **Unresolved target selection** (draft-only/holding, no write): "아직 저장할 러브트리가 정해지지 않았어요".

Each maps to the #3407 safe failure codes (`missing_tree_selection`, `invalid_tree_id`,
`tree_not_owned`, `tree_unavailable`, `unresolved_target_selection`) and carries only a code, a
safe human-readable message, and the request id.

## 10. Explicit non-goals

- target-tree UI implementation (no picker/modal/dropdown built here)
- client adapter behavior change
- route/intake runtime behavior change
- ownership validation helper implementation
- storage writer / helper runtime implementation (no `persistReviewedScoutMemoryDraft` body)
- memory insertion / persistence flip
- DB schema / migration
- provider / fetcher / crawler / scraper / LLM wiring
- Firebase / auth / runtime changes
- Social likes / comments work (#3188 / #3075 out of scope)
- production smoke against real platforms
- real platform requests

## 11. Future implementation gates

When implementation begins later, it must be gated and reviewed in order:

1. **client/UI tree selection implementation** — add the target-tree picker to the Scout
   reviewed save surface, with the placement and safe states from §4; wire the user's owned-tree
   list; no identity claim.
2. **route/intake target-tree field acceptance and validation** — future route accepts `treeId`
   as a selection input and rejects client identity; remains `persistence: 'gated'` until owned
   `treeId` is validated.
3. **ownership validation helper** — verifies `treeId` exists and is owned by the requester.
4. **storage writer implementation** — implements `persistReviewedScoutMemoryDraft(...)`,
   consumes the validated selection context.
5. **non-prod verification** — verifies selection + writer without live platforms (fixtures, mock
   client, #3386 taxonomy assertions, ownership replay).
6. **production activation** — only after a separate, explicit production-activation approval.

Each gate must re-accept this contract and the inherited #3365 / #3375 / #3379 / #3383 / #3386 /
#3387 / #3395 / #3397 / #3399 / #3402 / #3407 boundaries before code is written.

## 12. Cross-links

- Refs #3409
- Refs #1882
- Refs #3406
- Refs #3407
- Refs #3402
- Refs #3403
- Refs #3397
- Refs #3399
- Refs #3386
- Refs #3387
- Refs #3379
- Refs #3380
- Refs #3375
- Refs #3365
- Refs #3188
- Refs #3075
