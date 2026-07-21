# Tree Layout Modes — Product / UX Contract

**Issue:** #3581 (policy boundary), #3582 (long-term re-entry / login persistence)  
**Status:** Current main contract  
**Last updated:** 2026-07-21  

---

## 1. Three separate concepts

These must not be collapsed into one control:

| Concept | What it answers |
|---|---|
| Relationship map / topology | How moments connect (parent/child graph) |
| Appreciation order | Playback / path narrative order |
| Layout mode | How nodes are **placed** on the canvas (`structured` vs `free`) |

Layout mode never rewrites tree data, relationships, or moment content.

---

## 2. Layout modes

### `structured` (정리된 트리)

- Deterministic automatic placement from topology (geometry modules).
- Free-position draft is **not displayed**.
- Node drag is **disabled**.
- Canonical first-paint label: **정리된 트리** (icon `account_tree`).

### `free` (자유 배치)

- Nodes use stored positions when an owner-edit draft exists.
- Node drag is allowed **only** in authorized owner edit.
- Free positions may be persisted to owner-local draft keys only in owner edit.
- Canonical label: **자유 배치** (icon `auto_awesome`).

Internal / legacy labels must not appear in canonical UI:

```text
hierarchy, organic, 구조 보기, 유기적 보기
```

---

## 3. Surface policy matrix

| Surface | Authority | Interaction | Storage scope | Initial mode | Drag | Persist mode/positions |
|---|---|---|---|---|---|---|
| Public appreciation (`pages/view.html`) | public | view | ephemeral | **structured** | no | no |
| Owner appreciation (`pages/editor` without `mode=edit`) | owner | view | ephemeral | **structured** | no | no |
| Owner edit (`pages/editor?mode=edit`, authorized) | owner | edit | owner-local | stored valid mode or **structured** | free only | yes |
| Non-owner with edit requested | guest/public | view | ephemeral | **structured** | no | no |

### Storage keys (owner-local only)

```text
lovebud_tree_layout_v2_<treeId>      // positions, offsetX, offsetY, scale
lovebud_tree_layout_mode_<treeId>    // 'free' | 'structured'
```

Appreciation surfaces must **not** read, write, or clear these keys for presentation.

---

## 4. Owner appreciation vs owner edit

### Owner appreciation

- Always starts **structured** on ordinary entry.
- May offer a temporary layout toggle for the **current session only**.
- Temporary free display does not load owner draft coordinates as preference, does not allow drag, and must not persist mode/positions.
- Re-entry returns to structured.

### Owner edit

- Reads owner-local draft when present.
- Invalid or missing mode → structured.
- Free mode restores positions and viewport (offset/scale).
- Structured is automatic layout; free positions are preserved in storage when switching free → structured → free.
- Drag + pointer-up persist only in free.

---

## 5. In-page transitions (no full rebuild)

```text
owner appreciation → 편집하기 → owner edit
owner edit → 감상으로 돌아가기 → owner appreciation
```

| Transition | Required behavior |
|---|---|
| appreciation → edit | Re-read owner draft; restore free or structured; do not delete draft |
| edit → appreciation | Present structured; **keep** free positions and mode key in storage |
| edit free → structured → free | Free positions restore exactly |

Canvas must not be recreated with duplicate listeners or duplicate nodes on each switch.

---

## 6. Mobile

- Same surface policy as desktop: appreciation structured-first; owner edit restores stored preference.
- Free **drag** may follow current mobile interaction limits; unsupported gestures are not claimed as success.
- Horizontal document overflow must not be introduced by layout mode.

---

## 7. Sparse / linear / branched trees

- Structured layout remains deterministic for linear, branched, and sparse trees.
- Sparse trees must not crash or render an empty unusable canvas.
- Nodes and primary controls stay within canvas bounds under ordinary viewports.

---

## 8. Scope boundaries

### This contract (#3581)

- Explicit layout policy boundary (appreciation ephemeral vs owner-edit local).
- Initial mode and storage isolation.
- In-page appreciation/edit layout rebinding.
- Labels / first paint structured-first.

### #3582 same-browser persistence (locked by contract; Production not claimed here)

Local Chromium contracts lock the following **same-browser, same-owner** paths.
Evidence class is **LOCAL_EVIDENCE** until post-merge Production acceptance is recorded separately.

#### Evidence layers (do not collapse)

| Layer | What it proves | What it does not prove |
|---|---|---|
| **Component-level canvas evidence** (`tree-layout-persistence-3582-browser-contract`) | production `createEditorCanvas` storage restore, actual pointer drag, layout toggle, tree-key isolation, storage failure fallback | canonical `pages/editor.html` / `js/editor.js` boot, ordinary Editor reload, URL `mode=edit` startup |
| **Canonical Editor route evidence** (`tree-layout-persistence-3582-editor-route-contract`) | real `pages/editor.html` + `js/editor.js` startEditor path, URL `mode=edit`, same-origin exit/re-entry, `page.reload` without second goto, controlled auth/API | Production host, real Firebase login provider, cross-device/server sync |
| **Production evidence** | post-merge logged-in owner on `https://lovebud.pages.dev/` | not claimed by this PR |

#### Verified same-browser paths (LOCAL_EVIDENCE)

| Path | Component canvas | Canonical Editor route | Expected result |
|---|---|---|---|
| Actual mouse drag in owner edit free | yes | yes | positions + mode keys written to owner-local storage |
| Route exit (same-origin) → appreciation → edit | fixture sim only | **required** | appreciation structured / draft hidden; edit restores free mode + positions |
| Ordinary reload → owner edit | not accepted here | **required** (`page.reload`, no second goto) | free mode + positions restored; no duplicate canvas/nodes |
| Logout boundary → controlled same-owner bootstrap | auth boundary stub | **required** | auth cache may clear; **layout keys preserved**; edit restores free draft |
| Tree A free save → Tree B free save → re-enter each | yes | yes | treeId keys independent; no cross-tree position leak |
| free → structured → free | yes | yes | mode key may become structured then free; **position payload retained**; free restores positions |
| Storage failure (malformed / getItem throw / setItem throw) | yes | n/a (storage module) | safe structured/empty fallback; write failure does not delete existing keys |
| Mobile 375×812 | yes | yes | appreciation structured-first; owner edit restores stored mode/positions when present; no horizontal document overflow |

#### Key lifetime

```text
lovebud_tree_layout_v2_<treeId>
lovebud_tree_layout_mode_<treeId>
```

- Owner-edit free may write both keys.
- Structured mode must not overwrite the free position payload.
- Appreciation / public must not read these keys for presentation and must not clear them.
- Logout / auth cache clear must **not** delete layout draft keys.
- Keys are tree-scoped only (no UID rename / v3 migration in this contract).

#### Logout contract

Logout may clear Firebase auth prefixes, confirmed auth cache, and `isLoggedIn`.
It must not treat layout draft keys as auth cache.
`clearPrivateCaches` (if present) must not wipe `lovebud_tree_layout_*` as part of auth logout.

#### Storage failure fallback

| Input | Fallback |
|---|---|
| malformed JSON / `"null"` / getItem throw | empty positions, offset 0, scale 1 |
| invalid / missing mode | `structured` |
| non-number offset/scale | treat as 0 / 1 |
| setItem throw | keep previous value; do not claim successful save in UI |

#### Explicitly out of scope for #3582

- Server/Neon layout snapshots
- Cross-device / multi-device sync
- Revision / conflict system
- API / DB / schema / migration
- UID-based key rename (`lovebud_tree_layout_v3_<uid>_<treeId>`) or key migration
- Card UI / Browse·My Trees geometry
- Relationship topology or appreciation order redesign
- Claiming “Production complete” or “fully solved” without Production evidence

### Explicitly out of scope (shared)

- Server/Neon layout snapshots
- Cross-device sync
- Revision / conflict system
- API / DB / schema / migration
- Card UI / Browse·My Trees geometry
- Relationship topology or appreciation order redesign

---

## 9. Implementation pointer

Runtime policy module:

```text
js/editor/editor-canvas-layout-policy.js
```

Storage helpers:

```text
js/editor/editor-canvas-layout-storage.js
js/editor/editor-canvas-layout.js
```

Consumers:

```text
js/editor/editor-canvas.js   // load/persist/drag/cursor + syncInteractionLayoutMode
js/editor.js                 // initial interaction mode before first paint
```

Persistence contracts:

```text
tests/contracts/tree-layout-persistence-3582-contract.test.cjs
tests/contracts/tree-layout-persistence-3582-browser-contract.test.cjs
```

Public appreciation already uses `canEdit: false` and therefore ephemeral structured policy; labels still use structured-first static first paint.
