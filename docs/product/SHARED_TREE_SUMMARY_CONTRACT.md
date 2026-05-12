# Shared Tree Summary — Product/UX Contract

**Issue:** #1048  
**Status:** Contract / Planning  
**Last updated:** 2026-05-12  

---

## 1. Purpose

Define a shared Tree Summary / Tree Preview panel grammar that unifies how a tree is represented across Browse, My Trees, Editor, Public Viewer, and Tree Insights.

The Tree Summary is **not a full dashboard**. It is a lightweight panel whose job is to help the user understand which tree they are looking at and decide what to do next — open, edit, view, share, or inspect.

This contract is the **prerequisite** for #1046 (Tree Insights) and #1047 (selected moment reaction placement). The shared grammar must be stable before per-surface runtime implementation begins.

---

## 2. Surfaces

| Surface | Role | Summary Location |
|---------|------|-----------------|
| **Browse / discovery** | Visitor browsing public trees | Tree card in grid/list; selected tree preview panel |
| **My Trees / owner** | Owner managing their trees | Tree card in list/grid; selected tree detail panel |
| **Editor sidebar** | Owner editing a tree | Left sidebar (existing — see #1045) |
| **Public Viewer** | Visitor viewing a tree | Header / top area (existing structural elements) |
| **Tree Insights** | Owner viewing analytics | Dedicated page header (#1046) |

All surfaces must share a common base grammar. Mode differences are documented in Section 4.

---

## 3. Shared base grammar

Every Tree Summary variant must include or safely degrade the following elements:

```
┌──────────────────────────────────┐
│ [Tree title]                     │
│ [Caption / summary] (optional)   │
│ [Representative preview] (opt.)  │
│ [Reaction summary] (opt.)        │
│                                  │
│ [Primary action]                 │
│ [Secondary actions] (optional)   │
└──────────────────────────────────┘
```

### 3.1 Tree title

- **Required.** Displayed prominently.
- Actual tree title when available.
- Safe fallback when title is missing or empty: use a generic label (e.g., `Untitled LoveTree`). Never expose raw IDs or empty strings in UI.
- Owner surfaces may allow inline editing.

### 3.2 Caption / summary

- **Optional.** Returned only when the tree has a meaningful caption or owner-written summary.
- When absent, the caption area is hidden — no placeholder, no empty box.

### 3.3 Representative preview

- **Optional.** A compact visual preview of the tree:
  - Thumbnail from a representative memory (Browse, My Trees cards)
  - Abstracted node/leaf preview (compact views)
  - Tree-level visual token when no representative media exists
- When no representative data exists: degrade to a minimal icon or text-only layout.

### 3.4 Safe reaction summary

- **Optional. Display only when real data exists.**
- Allowed: actual likes, comments, shares counts (from verified sources).
- **Forbidden: fake metrics.** Never display fabricated numbers, placeholder counts, or hardcoded values.
- When reaction data is unavailable (not loaded, not yet implemented, API unavailable): **hide the summary entirely.** Never display `0`, `-`, or empty counters.

### 3.5 Primary action

- **Required.** Context-dependent (see Section 4).
- Must be clearly distinguishable from secondary actions.
- Must have a visible label (icon-only is not sufficient for primary).

### 3.6 Secondary actions

- **Optional.** 1–3 lightweight actions.
- May be collapsed under a "more" menu on mobile or when space is limited.

### 3.7 Safe fallback

- Every element except tree title and primary action may be absent.
- When absent, the summary must not show empty containers, broken layouts, or loading spinners that never resolve.
- An empty Tree Summary (no caption, no preview, no reactions) must still be navigable: title + primary action is the minimum viable summary.

---

## 4. Browse / discovery mode

**Purpose:** Help the visitor decide whether to open this tree.

| Element | Behavior |
|---------|----------|
| Title | Actual tree title, truncated if long |
| Caption | Optional, shown if set |
| Preview | Thumbnail from representative memory or abstracted node preview |
| Stage badge | Optional, e.g., `입덕`, `성장`, `최애` |
| Emotion tags | Optional, up to 5 from aggregated memories |
| Reaction summary | Only if real data exists. Never fake. |
| Primary action | `Open tree` → Public Viewer |
| Secondary actions | `View hub`, `Preview` |
| Share | If available (deferred) |
| Empty state | Hide card entirely if tree has no public-facing data |

**Restrictions:**
- Browse mode must **never show owner-only data**.
- No edit/manage/delete affordances.
- No raw identifiers, private fields, or internal status visible.

---

## 5. My Trees / owner mode

**Purpose:** Help the owner manage, edit, and monitor their tree.

| Element | Behavior |
|---------|----------|
| Title | Actual tree title, editable via rename affordance |
| Caption | Optional, owner may edit |
| Preview | Same grammar, may use owner-specific preview |
| Visibility | Show pill label, but **do not place primary visibility toggle in summary** |
| Moment count | Lightweight (e.g., `5 moments`), not raw number as filler |
| Last activity | `Updated X ago` relative time |
| Reaction summary | Same safe rule: real data only |
| Primary action | `Edit` → opens Editor |
| Secondary actions | `Public view`, `Share`, `Insights` |
| Empty state | "No moments yet" + call to create first moment |

**Restrictions:**
- Owner-only summary uses safe UI representation — no raw DB rows, raw identifiers, or private payloads.
- Do not expose raw treeId/memoryId/ownerId/copiedTreeId in visible UI.

---

## 6. Mode difference table

| Aspect | Browse / discovery | My Trees / owner | Editor sidebar | Public Viewer | Tree Insights |
|--------|-------------------|-----------------|----------------|---------------|---------------|
| **User** | Visitor | Owner | Owner | Visitor | Owner |
| **Intent** | Discover and open | Manage and edit | Context during editing | Enjoy tree content | Analyze metrics |
| **Primary action** | Open tree (Public Viewer) | Edit tree (Editor) | Back to My Trees | — (consuming) | — (analytics page) |
| **Secondary actions** | View hub, Preview | Public view, Share, Insights | Public view, Insights | Like, Share | Public view, Share |
| **Title editing** | No | Yes | Yes | No | No |
| **Reaction summary** | Public-only, real data only | Owner sees real data | Not in sidebar (detail panel) | Not primary (deferred) | Full analytics |
| **Data boundary** | Public-safe only | Owner scope | Owner scope | Public-safe only | Owner scope |
| **Empty state** | Hide card | "No moments" | Context-aware text | Skeleton / loading | N/A |

---

## 7. Data contract

### Required fields (must be available for summary to render)

| Field | Source | Rule |
|-------|--------|------|
| Tree title | tree data | Actual title or safe fallback |
| Route / open action target | page state | Must resolve to a valid surface |

### Optional fields (shown only when real data exists)

| Field | Source | Rule |
|-------|--------|------|
| Caption / summary | tree metadata | Absent → hide |
| Representative moment | tree moments | Absent → degrade to icon/text |
| Public viewer link | tree visibility | Only if tree is public |
| Reaction counts | aggregated data | Only if real and available |
| Share availability | feature gate | If social share is implemented |
| Insights availability | owner check | Only for owner |

### Explicitly unavailable / unsafe

| Data | Rationale |
|------|-----------|
| **Fake likes/comments/shares** | Violates trust. Never display placeholder counts. |
| **Raw identifiers** (treeId, memoryId, ownerId, copiedTreeId) | Private internal state. Never expose in visible UI or reports. |
| **Raw DB rows / private payloads** | Never expose raw API responses, internal schema, or undocumented fields. |
| **Owner-only data in Browse mode** | Browse is a public surface. |
| **Session tokens, cookies, credentials** | Never in any surface. |

### Unavailable metrics behavior

When a metric is unavailable (not loaded, feature not implemented, API error):

- **Do not** show `0`, `-`, or any placeholder number.
- **Do not** show loading spinners that never resolve.
- **Do not** render the metric container at all — collapse or hide the entire reaction section silently.
- The surrounding layout must not break or show empty gaps.

---

## 8. Empty / degraded states

| State | Behavior |
|-------|----------|
| **No title** | Show safe fallback: generic label based on tree type (e.g., `Untitled LoveTree`). Never expose raw ID. |
| **No caption** | Hide caption area entirely. No empty box or placeholder. |
| **No representative moment** | Use abstracted icon or minimal text-only layout. |
| **No reactions** | Hide reaction section entirely. No counters or placeholders. |
| **Private tree** | Browse: hide from public listing. Owner: show with visibility pill, no public viewer link. |
| **Unavailable public link** | Hide public view action from Browse/owner if tree is private. |
| **Unavailable insights page** | Hide insights action from owner surfaces if feature not ready. |
| **Network / API unavailable** | Show last known tree title + degraded non-interactive summary. No infinite spinner. |

---

## 9. Mobile behavior

| Rule | Detail |
|------|--------|
| **Compact stacking** | Title and primary action are always visible first. Secondary elements stack below. |
| **Title and action priority** | Tree title + primary action must be immediately visible without scrolling. |
| **Secondary actions** | May wrap to next line or collapse under a "more" menu. |
| **Metrics must not crowd** | Reaction counts must not push the primary action out of view. |
| **No horizontal-only layout** | Layout must work at 375px (iPhone SE) without horizontal scrolling. |
| **Browse vs My Trees density** | Both surfaces may use the same base grammar with adjusted spacing/touch targets. |

---

## 10. Relationship to existing issues

| Issue | Relationship |
|-------|-------------|
| **#1045** — Editor sidebar first slice | Completed. Editor sidebar uses a subset of this contract. |
| **#1046** — Tree Insights page | Future. Should use shared base grammar for its header summary. |
| **#1047** — Selected moment reactions | Future. Reaction summary belongs in the Editor right detail panel, not in the Tree Summary. |
| **#1037** — Structured layout | Completed. Layout mode (organic/hierarchy) is separate from Tree Summary grammar. |
| **#1103** — Mobile structured viewer refinement | Separate follow-up. Tree Summary grammar is independent from viewer layout. |
| **#975** — Public Viewer social dock/comments polish | Share grammar surface. Tree Summary includes share action when available. |

---

## 11. Non-goals

The following are explicitly **out of scope** for this contract:

- Full Browse redesign
- Full My Trees redesign
- Tree Insights implementation
- Selected moment reaction implementation
- Backend/schema changes
- Fake metrics of any kind
- Visibility control relocation (visibility toggle belongs in dedicated settings)
- PR #7 / prototype / reference / demo / variant changes
- New component library or widget framework decision
- Persistence of layout preference across sessions

---

## 12. Acceptance criteria for future runtime PRs

A runtime PR implementing the shared Tree Summary must satisfy all of:

1. **Browse and My Trees use the same base grammar** — title, caption, preview, reaction summary, primary/secondary actions follow Section 3.
2. **Mode-specific actions are distinct** — Browse opens Public Viewer, My Trees opens Editor.
3. **Missing metrics degrade safely** — no fake numbers, no empty containers, no broken layout.
4. **No fake metrics** — zero placeholder counts, no hardcoded values.
5. **No private/raw data exposure** — raw IDs, DB rows, private payloads never appear in UI.
6. **Mobile behavior verified** — works at 375px without horizontal scroll or action crowding.
7. **Auth/API-dependent My Trees flows use fixed test slot verification** — no production data mutation during verification.

---

## 13. Verification expectations for future runtime PRs

Every runtime PR must document browser verification for at least:

- **Browse selected preview** — desktop (1280px+) and mobile (375px)
- **My Trees selected owner preview** — desktop and mobile
- **Public/private boundary** — private tree does not show public viewer link in Browse
- **Console fatal errors** — 0
- **Network blockers** — none (no 4xx/5xx that breaks core summary rendering)
- **Raw private data in reports** — none (no raw IDs, payloads, secrets)

---

## Document history

| Date | Change |
|------|--------|
| 2026-05-12 | Initial contract based on #1048 requirements |
