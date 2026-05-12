# Tree Insights — Product/UX Contract

**Issue:** #1046  
**Status:** Contract / Planning  
**Last updated:** 2026-05-12  

---

## 1. Purpose

Tree Insights is a **dedicated owner-facing page** for detailed reaction and moment management of a LoveTree. It sits between the lightweight Tree Summary (#1048) and the Editor right detail panel (#1047), providing a fuller analytical view without becoming a full-scale analytics dashboard.

**Key principle:** Tree Insights extends what the Tree Summary and Editor detail panel start. It does not replace them.

- Tree Summary (#1048): lightweight tree-level summary / entrypoint only
- Editor right detail panel (#1047): selected moment reaction summary only
- Tree Insights (#1046): owner-only detailed view for tree-level and moment-level insight review

The first implementation should be a **lightweight insights page**, not a feature-complete analytics dashboard. Scope expansion should be driven by verified reaction/comment/share API availability.

---

## 2. Surface boundary

| Surface | Role | Analytics scope |
|---------|------|-----------------|
| **Tree Summary** (#1048) | Lightweight tree-level summary / entrypoint | Tree-level preview only |
| **Editor right detail panel** (#1047) | Selected moment reaction summary | Moment-level lightweight only |
| **Tree Insights** (#1046) | Owner-only detailed insight review | Tree-level + moment-level detail |
| **Editor left sidebar** (#1045) | Editing context | No analytics |
| **Public Viewer** | Visitor/public interaction surface | No owner analytics |
| **Browse / My Trees** | Discovery / owner list | No per-tree analytics |

**Key rule:** Each surface has a distinct analytics scope. Tree Insights is the only surface that provides both tree-level and moment-level detail in a dedicated page.

---

## 3. Access / ownership boundary

| Rule | Detail |
|------|--------|
| **Owner-only** | Only the tree owner can access Tree Insights. |
| **Auth required** | User must be authenticated. |
| **Non-owner access** | Forbidden. Non-owners are redirected or shown an access-denied state. |
| **Public visitors** | Never see owner analytics. |
| **Private tree data** | Remains owner-only. |
| **Verification** | Fixed test slot required for Auth/API-dependent runtime verification. No production data mutation during verification. |

---

## 4. Information architecture

### 4.1 Page layout

```
┌─────────────────────────────────────────┐
│  ← Back to My Trees    [트리 인사이트]   │
│                                          │
│  [트리 제목]               [공개 보기]    │
│  공개 · 12 moments · Updated 3h ago     │
├─────────────────────────────────────────┤
│  Summary                                │
│  ┌──────────┬──────────┬──────────┐     │
│  │ ♡ 24     │ 💬 5     │ ↗ 3      │     │
│  │ likes    │ comments │ shares   │     │
│  └──────────┴──────────┴──────────┘     │
├─────────────────────────────────────────┤
│  Moments                                │
│  ┌──────────────────────────────────┐   │
│  │ [moment title]    ♡ 8  💬 2  ↗ 1 │   │
│  │ [date] [tag]               [편집]│   │
│  ├──────────────────────────────────┤   │
│  │ [moment title]    ♡ 12  💬 3  ↗ 2│   │
│  │ [date] [tag]               [편집]│   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 4.2 Page header

| Element | Behavior |
|---------|----------|
| Back navigation | Returns to My Trees or Editor |
| Page label | `트리 인사이트` |
| Tree title | Actual tree title, links to Editor |
| Visibility label | Shows public/private status |
| Moment count | Only if meaningful (not raw count as filler) |
| Last activity | Relative time (`Updated 3h ago`) |
| Public view link | Only if tree is public |

### 4.3 Summary area

| Metric | Behavior |
|--------|----------|
| Total likes | Real data only. Hidden if unavailable. |
| Total comments | Real data only. Hidden if unavailable. |
| Total shares | Real data only. Hidden if unavailable. |
| Total views | Optional — only if view tracking is implemented. |
| **No fake metrics** | Never display placeholder counts or hardcoded values. |

### 4.4 Moment insights list

| Element | Behavior |
|---------|----------|
| Moments | Listed by recency or reaction rank (TBD in runtime) |
| Per-moment likes/comments/shares | Real data only. Hidden if unavailable. |
| Moment title | Links to Editor with moment focus |
| Date / tag | Optional metadata |
| Edit entrypoint | Opens Editor to that moment |

### 4.5 Management affordances

| Action | Behavior |
|--------|----------|
| Edit tree | Opens Editor |
| Open public view | Only if tree is public |
| Share | If share is implemented |
| Inspect selected moment | Opens Editor with moment focus |

---

## 5. Data grammar

### Tree-level metrics

| Metric | Display rule |
|--------|-------------|
| **Total likes** | Real data only. Shown when available. |
| **Total comments** | Real data only. Shown when available. |
| **Total shares** | Real data only. Shown when available. |
| **Public views** | Optional — only if view tracking is implemented. Real data only. |
| **Moment count** | Real count. Shown when available. |

### Moment-level metrics

| Metric | Display rule |
|--------|-------------|
| **Likes** | Real data only. Per-moment. |
| **Comments** | Real data only. Per-moment. |
| **Shares** | Real data only. Per-moment. |
| **Recent comment/reaction hint** | Optional — shows latest comment preview if available. |

### Visibility / share status

| Field | Display rule |
|-------|-------------|
| Public/private badge | Always shown. |
| Public link | Shown only if tree is public. |
| Share availability | Shown only if share is implemented and available. |

### 0 vs unavailable distinction

| State | Behavior |
|-------|----------|
| **Real 0** (metric exists, value is 0) | Show `0` — indicates feature exists but no activity yet. |
| **Unavailable** (not implemented, not loaded, API error) | **Hide entirely.** Do not display `0`, `-`, or placeholder. Do not render the metric container. |

### Forbidden

- **Fake/hardcoded metrics.** Never display placeholder counts, estimated values, or fabricated numbers.
- **Raw identifiers.** Never display treeId, memoryId, momentId, ownerId, copiedTreeId in visible UI or reports.
- **Raw DB rows / private payloads.** Never display raw API responses, internal schema, undocumented fields, or private DB rows.
- **Token/cookie/session/credential/API key/private key.** Never in any surface.

---

## 6. Interaction grammar

| Action | Priority | Behavior |
|--------|----------|----------|
| Return to Editor / manage tree | Primary | Main action — back to editing |
| Public view | Secondary | Opens Public Viewer (public trees only) |
| Share | Secondary | If share is implemented |
| Open moment in Editor | Secondary | Edits selected moment |
| View comments/reactions detail | Secondary | Detail view (future — could expand inline or navigate) |

**Priority rule:** Insights provides visibility and understanding — it does not replace the Editor for destructive or creative actions. Destructive actions (delete moment, change title, bulk edit) are not primary in Insights unless separately scoped.

---

## 7. Empty / degraded states

| State | Behavior |
|-------|----------|
| **No tree selected / invalid tree ID** | Show error state with navigation back to My Trees. |
| **Tree not found** | Show 404-style message. |
| **No moments** | Show "No moments yet" message. Insight metrics are not displayed. |
| **No reaction data (feature not implemented)** | Hide all metric containers. Show informative message: "Insights will be available when reaction features are implemented." |
| **Implemented but all metrics are real 0** | Show `0` values. This is a valid state. |
| **Comments unavailable** | Do not show comment metric or entrypoint. |
| **Share data unavailable** | Do not show share metric or action. |
| **Private tree** | Owner sees own data. No public/shared metrics. |
| **Public link unavailable** | Hide public view action. |
| **Auth unavailable** | Show login prompt. Do not expose tree data. |
| **Owner permission uncertain** | Degrade to "Access denied" if ownership cannot be verified. |
| **API/network unavailable** | Show last known state. If no cached state, show degraded non-interactive message. No infinite spinner. |
| **Partial data loaded** | Show available metrics. Missing metrics degrade per unavailable rules. |
| **Deleted/missing moment** | Remove from moment list. If all moments are missing, show empty state. |

---

## 8. Data safety

| Rule | Rationale |
|------|-----------|
| **Fake metrics forbidden** | Violates trust. Every displayed metric must be real or safely hidden. |
| **Raw identifiers hidden** | treeId, memoryId, momentId, ownerId, copiedTreeId never appear in UI or reports. |
| **Raw DB rows / payloads forbidden** | Never expose raw API responses, internal schema, or undocumented fields. |
| **Token/cookie/session/credential/API key/private key forbidden** | Never in any surface. |
| **Owner-only data boundary** | Insights data must not leak into Browse/Public Viewer surfaces. |
| **Reporting safety** | Browser verification reports must not include raw IDs, private payloads, or credentials. |

---

## 9. Mobile behavior

| Rule | Detail |
|------|--------|
| **375px baseline** | Layout must work on iPhone SE width. |
| **Summary cards stack vertically** | Tree-level summary metrics stack vertically on mobile. |
| **Primary action reachable** | Back-to-Editor action must be immediately accessible. |
| **Metrics wrap/collapse** | Metric display wraps without horizontal scroll. |
| **Moment insight rows remain readable** | Compact row layout with title and key metrics. |
| **No heavy tables** | Avoid wide tables that require horizontal scrolling. Use card/list layout. |
| **No horizontal-only analytics layout** | Layout adapts to narrow viewport. |

---

## 10. Relationship to existing issues

| Issue | Relationship |
|-------|-------------|
| **#1045** — Editor sidebar first slice | Completed. Sidebar is tree context only. Not an analytics surface. |
| **#1048** — Shared Tree Summary | Completed. Tree Insights uses Tree Summary grammar as entry/header. Expands into full detail. |
| **#1047** — Selected moment reaction placement | Completed. Editor right detail panel shows selected moment summary. Insights provides fuller per-moment review. |
| **#1037** — Structured layout | Separate layout mode. No interaction with Tree Insights. |
| **#1103** — Mobile structured viewer refinement | Separate Public Viewer runtime issue. Not related to owner insights. |
| **#975** — Public Viewer social dock/comments polish | Related public interaction surface. Tree Insights is owner-only and complementary — it shows what the owner needs to know about their tree's social response. |

---

## 11. Non-goals

The following are explicitly **out of scope** for this contract:

- Runtime implementation (CSS/JS/HTML changes)
- Backend/schema changes
- Reaction API implementation
- Comment system implementation
- Comment moderation implementation
- Public Viewer social dock implementation (#975)
- Browse/My Trees redesign
- Destructive bulk management (bulk delete/edit)
- Fake metrics of any kind
- PR #7 / prototype / reference / demo / variant changes
- Visibility control relocation
- Tree Insights replacing Editor

---

## 12. Future runtime acceptance criteria

A runtime PR implementing #1046 must satisfy all of:

1. **Owner-only and auth-gated.** Non-owners are blocked. Public visitors never see owner analytics.
2. **Surface boundary preserved.** Tree Summary remains lightweight. Editor right detail panel remains selected-moment summary only.
3. **Tree-level and moment-level metrics are separated.** Distinct visual sections, not merged.
4. **Unavailable metrics degrade safely.** Not implemented → hidden. Implemented but empty → real 0.
5. **Real 0 and unavailable values are handled distinctly.** A true zero is displayed; an unavailable metric is completely hidden.
6. **No raw/private data exposure.** Raw IDs, DB rows, payloads, tokens, credentials never appear in UI or reports.
7. **Mobile 375px verified.** Layout responsive, no horizontal scroll, action reachable.
8. **Auth/API-dependent flows use fixed test slot verification.** No production data mutation.
9. **Console fatal errors** — 0.
10. **Network blockers** — none (no 4xx/5xx breaking core page rendering).

---

## Document history

| Date | Change |
|------|--------|
| 2026-05-12 | Initial contract based on #1046 requirements, building on #1048 and #1047 boundaries |
