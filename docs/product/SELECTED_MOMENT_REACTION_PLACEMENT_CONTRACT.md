# Selected Moment Reaction Summary Placement — Product/UX Contract

**Issue:** #1047  
**Status:** Contract / Planning  
**Last updated:** 2026-05-12  

---

## 1. Purpose

Define where and how selected-moment reaction summary (likes, comments, shares) should appear inside the Editor.

The selected moment reaction summary is **not a Tree Summary, not a sidebar element, and not a full analytics dashboard**. It is a lightweight detail summary on the **Editor right detail panel** that helps the owner understand the current selected moment's social response at a glance.

This contract builds on the boundary established by #1048: tree-level summaries belong in the Tree Summary panel, moment-level reactions belong in the Editor right detail panel.

---

## 2. Surface boundary

| Surface | Role | Reaction summary |
|---------|------|-----------------|
| **Editor right detail panel** | Primary target — selected moment reaction summary | ✅ Allowed here |
| **Editor left sidebar** | Tree context only (#1045) | ❌ Moment reaction summary forbidden |
| **Tree Summary panel** | Tree-level summary only (#1048) | ❌ Moment reaction summary forbidden |
| **Tree Insights** | Full analytics/detail management (#1046) | Future scope — moment-level detail |
| **Public Viewer** | Public interaction surface | Separate contract (#975) |

**Key rule:** One surface, one responsibility. The Editor right detail panel is the sole location for selected-moment reaction summary. Do not duplicate moment reactions in the left sidebar or Tree Summary panel.

---

## 3. Placement rules

### 3.1 Position in the right detail panel

```
┌─────────────────────────────────┐
│ 현재 순간                        │
│ [moment title]                  │
│ [moment preview / thumbnail]     │
│                                 │
│ 반응                             │
│ ♡ 24 · 댓글 3 · 공유 1          │
│ [이 순간 댓글 보기] [공유]       │
│                                 │
│ 기록                             │
│ 날짜 · 태그 · 메모               │
│                                 │
│ [수정] [이어가기] [가지 만들기]  │
└─────────────────────────────────┘
```

### 3.2 Ordering rules

- Moment title/content preview → reaction summary section → detail metadata (date, tags, memo) → primary edit actions.
- Reaction summary must be **below** the moment identity (title/preview) but **before** detailed metadata.
- Primary edit actions (edit, continue, create branch) must remain the most visually prominent actions.
- Reaction summary must not push primary edit actions out of immediate view.

### 3.3 Visibility rules

- **Only when a moment is selected.** No selected moment → no reaction summary.
- **Only when reaction data exists.** No reaction data → hide the entire reaction section silently.
- **Owner-only.** The Editor is an authenticated owner surface. Reaction data shown here may include owner-level detail not available in Public Viewer.
- **Do not show** in no-selected-moment empty state.

### 3.4 Mobile behavior

- In the mobile detail panel (bottom sheet or stacked panel), reaction summary collapses to a single line or is moved below metadata.
- Must not crowd the primary edit actions on narrow viewports (375px).
- If space is critical, show only the total reaction count as a single summary, with "View details" link.

---

## 4. Data grammar

### Allowed metrics

| Metric | Display rule |
|--------|-------------|
| **Likes count** | Real data only. Shown when available. |
| **Comments count** | Real data only. Shown when available. |
| **Shares count** | Real data only. Shown when available. |
| **Recent reaction hint** | Optional — e.g., a latest comment preview or emoji reaction strip. Only if data exists. |
| **Total "reactions"** | May be collapsed into one aggregate metric if individual counts are not available. |

### Forbidden

- **Fake/hardcoded metrics.** Never display placeholder counts, estimated values, or fabricated numbers. If real data is unavailable, the metric is hidden.
- **Raw identifiers.** Never display treeId, memoryId, momentId, ownerId, copiedTreeId, or any raw database identifier in visible UI or reports.
- **Raw payloads.** Never display raw API responses, internal schema, undocumented fields, or private DB rows.

### 0 vs unavailable distinction

| State | Behavior |
|-------|----------|
| **Real 0** (metric exists but value is 0) | Show `0` — indicates feature exists but no engagement yet. |
| **Unavailable** (metric not loaded, feature not implemented, API error) | **Hide entirely.** Do not display `0`, `-`, or any placeholder. Do not display the metric container. |

This distinction is critical: a `0` indicates the feature is working but empty; a hidden metric indicates the feature is not available. They must not be conflated.

---

## 5. Interaction grammar

| Action | Behavior |
|--------|----------|
| **View reactions/comments** | Secondary action. Opens a detail view (future — could be inline expansion, modal, or Tree Insights navigation). |
| **Share** | Secondary action. Available if share is implemented for this moment/tree. |
| **Deep link to Tree Insights** | Optional future action. Links to moment-level detail in #1046 when available. |
| **Edit/delete moment** | Primary actions. Must remain visually distinct and not crowded by reaction interactions. |

**Priority order:** Primary edit actions > secondary reaction actions. Reaction interactions must not visually compete with or obscure the moment's edit/delete/manage actions.

---

## 6. Empty / degraded states

| State | Behavior |
|-------|----------|
| **No selected moment** | No reaction summary shown. Panel shows empty-state guidance. |
| **No reaction data** (feature not implemented) | Hide reaction section entirely. No empty box, no placeholder. |
| **No reaction data** (implemented but empty) | Show counts as `0` for each metric that is implemented. Hide unimplemented metrics. |
| **Comments unavailable** | Do not show comment metric or entrypoint. |
| **Share data unavailable** | Do not show share metric or action. |
| **Private tree** | Owner can still see own metrics. No public/shared data shown. |
| **API/network unavailable** | Show last known state. If no cached state, hide reaction section. No infinite spinner. |
| **Permissions unavailable** | If owner status is uncertain, degrade to no reaction data shown. |
| **Deleted/missing selected moment** | Clear reaction summary, show appropriate empty state. |

---

## 7. Data safety

| Rule | Rationale |
|------|-----------|
| **Fake likes/comments/shares forbidden** | Violates trust. Every displayed metric must be real. |
| **Raw identifiers hidden** | treeId, memoryId, momentId, ownerId, copiedTreeId must never appear in UI or reports. |
| **Raw DB rows/private payloads forbidden** | Never expose raw API responses, internal schema, or undocumented fields. |
| **Token/cookie/session/credential forbidden** | Never in any surface. |
| **Owner-only data boundary** | Data shown in Editor (owner surface) must not leak into Browse/discovery or Public Viewer surfaces. |

---

## 8. Relationship to existing issues

| Issue | Relationship |
|-------|-------------|
| **#1045** — Editor sidebar first slice | Completed. Left sidebar handles tree context only. Moment reaction summary does not belong there. |
| **#1048** — Shared Tree Summary | Completed. Tree-level summary vs moment-level reaction summary cleanly separated by this contract. |
| **#1046** — Tree Insights | Future full analytics/detail page. Moment-level reactions from this contract may be referenced there. |
| **#1037** — Structured layout | Unrelated layout mode. No interaction with reaction placement. |
| **#1103** — Mobile structured viewer refinement | Separate mobile viewer runtime issue. Does not affect Editor detail panel placement. |
| **#975** — Public Viewer social dock/comments polish | Related public interaction surface. This contract focuses on Editor owner-side placement only. |

---

## 9. Non-goals

The following are explicitly **out of scope** for this contract:

- Runtime implementation (CSS/JS/HTML changes)
- Backend/schema changes
- Tree Insights implementation (#1046)
- Comment system implementation
- Reaction API implementation
- Public Viewer social dock implementation (#975)
- Browse/My Trees redesign
- Fake metrics of any kind
- PR #7 / prototype / reference / demo / variant changes
- Visibility control relocation
- Persistence of layout preference or reaction read state

---

## 10. Future runtime acceptance criteria

A runtime PR implementing #1047 must satisfy all of:

1. **Surface boundary preserved.** Selected moment reaction summary appears only in the Editor right detail panel. Left sidebar and Tree Summary remain tree-level only.
2. **Unavailable metrics degrade safely.** Metrics not implemented or not loaded are hidden — never shown as `0`, `-`, or placeholders.
3. **Real 0 vs unavailable distinction.** Real zero counts are shown. Unavailable metrics are hidden. These two states are visually distinguishable.
4. **No raw/private data exposure.** Raw IDs, DB rows, payloads, tokens, cookies, and credentials never appear in UI or reports.
5. **Mobile 375px behavior verified.** Reaction summary does not crowd primary edit actions on narrow viewports.
6. **Auth/API-dependent flows use fixed test slot verification.** No production data mutation during verification.
7. **Console fatal errors** — 0.
8. **Network blockers** — none (no 4xx/5xx that breaks core detail panel rendering).

---

## Document history

| Date | Change |
|------|--------|
| 2026-05-12 | Initial contract based on #1047 requirements and #1048 boundary |
