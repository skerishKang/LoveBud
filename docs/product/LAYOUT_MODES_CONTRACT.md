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

### Deferred to #3582 (not claimed here)

- Long-term route/reload/logout/login free-mode persistence completion.
- Any remaining edge cases after multi-session survival audits.

### Explicitly out of scope

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

Consumers:

```text
js/editor/editor-canvas.js   // load/persist/drag/cursor + syncInteractionLayoutMode
js/editor.js                 // initial interaction mode before first paint
```

Public appreciation already uses `canEdit: false` and therefore ephemeral structured policy; labels still use structured-first static first paint.
