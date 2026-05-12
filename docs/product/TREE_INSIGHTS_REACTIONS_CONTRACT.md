# Tree Insights & Selected Moment Reactions — Product/UX Contract

**Issues:** #1046, #1047  
**Status:** Contract / Planning  
**Last updated:** 2026-05-12  

---

## 1. Current state audit

### Reactions/comments/likes
- Public viewer has a **Like** toggle on the tree (client-side only, `state.likedTree` + `is-liked` CSS class)
- No comment system exists yet
- No sharing metrics exist
- No tree-level reaction aggregation exists
- No moment-level reaction data exists

### Editor detail panel (right panel)
- Shows selected moment info: title, hint, thumbnail, date, tags, memo
- New action hierarchy added (#1035 / PR #1096): 감상하기, 이어가기, 수정, 가지 만들기 (disabled)
- **No reaction summary** of any kind

### Editor sidebar (left sidebar)
- Tree title, visibility pill, moment count, flow summary, selection hint
- **No reaction/insights data**

---

## 2. Product decision: separate tree-level and moment-level reactions

Two distinct surfaces:

### Tree-level → Tree Insights page
Dedicated owner-facing page for analytics and management.

### Moment-level → Editor detail panel
Lightweight reaction summary next to the selected moment.

**They must NOT be combined into the Editor sidebar.**

---

## 3. Tree Insights — page definition (#1046)

### Route

```
/pages/tree-insights.html?treeId=<id>
```

Must be an authenticated route (owner-only). Non-owners get redirected.

### Page label

```
트리 인사이트
```

### Sections

#### 3.1 Tree-level overview

```
┌─────────────────────────────────────┐
│ 트리 인사이트                        │
│ [트리 제목]                [공개 보기]│
├─────────────────────────────────────┤
│ 좋아요      댓글      공유           │
│  12          5         3            │
├─────────────────────────────────────┤
│ 공개 상태: 공개   |   생성: 2026-05-01│
└─────────────────────────────────────┘
```

Elements:
- Tree title (link to Editor)
- Public viewer link
- Total likes, total comments, total shares (from aggregated data)
- Visibility status
- Created/updated dates
- Share link

#### 3.2 Moment-level summary

```
┌─────────────────────────────────────┐
│ 순간별 반응                           │
│                                      │
│ [모먼트1 제목]    ♥ 8   💬 3   ↗ 1   │
│ [모먼트2 제목]    ♥ 5   💬 1   ↗ 0   │
│ [모먼트3 제목]    ♥ 2   💬 0   ↗ 0   │
│ ...                                  │
│                                      │
│ [+ 반응 없는 순간 보기]               │
└─────────────────────────────────────┘
```

Elements:
- List of all moments with reaction counts
- Sort by: most reactions, newest, oldest
- Filter: moments with no reactions (editing opportunity)
- Click moment → navigate to Editor with that moment selected

#### 3.3 Comments management

```
┌─────────────────────────────────────┐
│ 댓글 관리                             │
│                                      │
│ ⚠ 2개의 댓글이 승인 대기 중           │
│                                      │
│ [댓글1] ... [승인] [삭제]            │
│ [댓글2] ... [승인] [삭제]            │
│ ...                                  │
└─────────────────────────────────────┘
```

Elements:
- Tree-level comments
- Moment-level comments (grouped by moment)
- Moderation actions: approve, delete
- Moderation is **deferred** (first-slice: read-only view)

#### 3.4 Editing checks

```
┌─────────────────────────────────────┐
│ 트리 건강                             │
│                                      │
│ ✅ 모든 순간에 제목이 있어요           │
│ ⚠ 2개의 순간에 메모가 없어요          │
│ ✅ 3개의 순간에 미디어가 있어요        │
└─────────────────────────────────────┘
```

Elements:
- Missing memo alerts
- Default title alerts
- Missing media/thumbnail alerts
- Empty moment detection

---

## 4. Selected moment reaction placement (#1047)

### Location

In the Editor right detail panel, **below the moment info card** and **above the save status card**.

### Visual design

```
┌─────────────────────────────┐
│ 반응                          │
│ ♥ 8 · 💬 3 · ↗ 1            │
│ [이 순간 댓글 보기]  [공유]   │
└─────────────────────────────┘
```

### States

| State | Display |
|-------|---------|
| **Has reactions** | Show counts + action buttons |
| **No reactions yet** | Quiet empty state: "아직 반응이 없어요" with subtle icon |
| **Owner viewing own tree** | Show metrics + moderation entrypoint |
| **No metrics API available** | Hide section entirely (no broken UI) |

### Empty state copy

```
반응
아직 반응이 없어요
[이 순간 공유하기]
```

### Do not
- Show fake/placeholder metrics
- Show reaction section when data is unavailable
- Link to Tree Insights from inside reaction section (Tree Insights link belongs in sidebar)

---

## 5. First-slice scope (this PR)

This PR is a **docs/contract-only** PR. No runtime changes.

**In scope:**
- This document
- Tree Insights page definition
- Selected moment reaction placement
- Separation of tree-level vs moment-level reactions

**Out of scope (future PRs):**
- Tree Insights route/page implementation
- Reaction/comment/share API integration
- Comment moderation UI
- Selected moment reaction UI in editor detail panel
- Editor sidebar analytics (never: belongs in Tree Insights)
- Backend/schema changes

---

## 6. Implementation roadmap

| Item | Priority | Depends on |
|------|----------|------------|
| Reaction/like/comment API contract | High | Product decision |
| Tree Insights page route + auth guard | High | API contract |
| Tree Insights tree-level overview | High | API |
| Tree Insights moment-level summary | Medium | API |
| Selected moment reaction UI in Editor | Medium | API, #1035 |
| Comment moderation | Low | API |
| Editing checks | Low | None |
| Comment management | Low | API |
| Moment drill-down in Insights | Low | API |

---

## 7. Safety notes

- No backend/API/schema changes
- No Editor runtime mutation behavior changed
- No Public Viewer rendering changed
- No fake/placeholder metrics will be displayed
- Tree Insights and Editor sidebar remain separate surfaces
