# Shared Tree Summary & Editor Sidebar — Product/UX Contract

**Issues:** #1048, #1045  
**Status:** Contract / Planning  
**Last updated:** 2026-05-12  

---

## 1. Current state audit

### Editor sidebar (pages/editor.html, lines 19–54)
Current elements:
- **Back to My Trees** link
- **LoveTree badge** (`✿ Our LoveTree` — hardcoded)
- **Tree title** + rename button (title is dynamic, updateable)
- **Visibility pill** (`비공개`/`공개` — shows current state)
- **Moment count** (`sidebarMomentCount` — raw number)
- **Flow summary** (contextual text: empty/selected/connected)
- **Selection hint** (contextual guidance text)
- **Add moment** section (add-memory card with eyebrow, intro, button)

### Browse discovery (pages/search.html / pages/intro.html)
- Tree cards show: thumbnail, title, stage badge, emotion tags
- "트리 열기" primary action
- No unified summary component

### My Trees (pages/my-trees.html)
- List/grid of owned trees
- Each card: title, visibility, moment count, edit/view actions
- No shared summary component

---

## 2. Shared Tree Summary variants

### Base contract

Each Tree Summary variant must include:

```
Tree title            → required, displayed prominently
Short caption         → optional, if available/set by owner
Representative media  → optional, thumbnail or preview
Lightweight reaction  → optional, if data available (likes/comments/shares)
Primary action        → required, context-dependent
Secondary action(s)   → optional, context-dependent
Safe empty state      → required, shown when data is absent
Mobile-safe layout    → required, responsive
```

### 2.1 Browse discovery mode (for #1048)

**Purpose**: Help the visitor decide whether to open this tree.

| Element | Behavior |
|---------|----------|
| Title | Visible, truncated if long |
| Thumbnail | From representative memory |
| Stage badge | e.g., `입덕`, `성장`, `최애` |
| Emotion tags | Up to 5 from aggregated memories |
| Primary action | `트리 열기` |
| Secondary action | `감상 허브 보기` / `미리보기` |
| Share | If available (deferred) |
| Empty state | Hide card entirely if tree has no public data |

Current approximation: search results / browse grid already show most of this.
**Gap**: No unified component — each page builds its own card.

### 2.2 My Trees owner mode (for #1048)

**Purpose**: Help the owner manage/edit/share their tree.

| Element | Behavior |
|---------|----------|
| Title | Editable (inline or via rename button) |
| Visibility | Show pill, but **do not place primary visibility toggle here** |
| Moment count | Show only if meaningful (not raw count as filler) |
| Last activity | `updatedAt` relative time |
| Primary action | `편집하기` → opens Editor |
| Secondary action | `공개 보기`, `공유하기`, `인사이트 보기` |

Current approximation: my-trees.html has some of this.
**Gap**: No consistent action set; insights link missing.

### 2.3 Editor sidebar mode (for #1045)

**Purpose**: Show the current tree's identity with lightweight actions.

| Element | Behavior |
|---------|----------|
| Title | Actual tree title, editable via rename affordance |
| Caption/badge | LoveTree badge (decorative) |
| Tree status | Lightweight (e.g., "5개의 순간", not raw number-as-filler) |
| Flow summary | Context-aware text (empty / selected / connected) |
| Primary action | Back to My Trees (navigation) |
| Secondary actions | Public viewer entrypoint, insights entrypoint |
| Visibility | **Do NOT show visibility controls/pill in sidebar** |

**Gap**: Current sidebar has visibility pill, raw moment count, and no public viewer/insights entrypoints.

---

## 3. Editor sidebar redesign proposal

### Current problems
1. **Visibility pill is misplaced** — visibility control belongs in the status/settings section, not the tree identity sidebar
2. **Raw moment count** reads as filler ("총 3개의 순간")
3. **No public viewer link** — Editor has no quick way to preview the public version
4. **No insights entrypoint** — Tree Insights is not yet built but the entrypoint should be defined
5. **Hierarchy is flat** — back link, tree info, and add-moment section are all at the same level

### Proposed structure

```
┌─────────────────────────────┐
│ ← 내 러브트리로 돌아가기      │  ← Primary navigation
├─────────────────────────────┤
│ ✿ Our LoveTree              │  ← Decorative badge (no action)
│                             │
│ [트리 제목]          [수정]  │  ← Editable title
│                             │
│ 5개의 순간으로 이어지고 있어요│  ← Context-aware summary
│                             │
│ ┌─────────────────────────┐ │
│ │ 순간 감상                │ │  ← Public viewer entrypoint
│ │ 트리 인사이트            │ │  ← Insights entrypoint (future)
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ [+ 새 순간 이어가기]        │  ← Primary action (same as current)
└─────────────────────────────┘
```

### Key changes from current
1. **Remove visibility pill** from sidebar — move to editor status/settings section
2. **Replace raw moment count** with contextual summary text (e.g., "5개의 순간으로 이어지고 있어요")
3. **Add public viewer entrypoint button**
4. **Add insights entrypoint** (placeholder until Tree Insights is built)
5. **Keep flow summary** but simplify to one line

---

## 4. First-slice scope (this PR)

This PR is a **docs/contract-only** PR. No runtime changes.

**In scope:**
- This document
- Shared Tree Summary base contract definition
- Three variant definitions (Browse, My Trees, Editor sidebar)
- Editor sidebar redesign proposal

**Out of scope (future PRs):**
- Editor sidebar HTML/CSS/JS changes
- Browse discovery unified component
- My Trees owner preview redesign
- Full My Trees insights link integration
- Reaction summary live data
- Comment/share metrics integration

---

## 5. Do not do

- Make sidebar an analytics dashboard
- Re-introduce visibility settings in sidebar
- Implement Browse/My Trees/Editor in one PR
- Backend/schema changes
- Implement Tree Insights page

---

## 6. Future work

| Item | Priority | Issue |
|------|----------|-------|
| Editor sidebar: remove visibility pill | High | #1045 |
| Editor sidebar: contextual summary instead of raw count | High | #1045 |
| Editor sidebar: public viewer entrypoint | Medium | #1045 |
| Browse unified Tree Summary component | Medium | #1048 |
| My Trees owner preview redesign | Medium | #1048 |
| Tree Insights link integration | Low | #1046 |

---

## 7. Safety notes

- No backend/API/schema changes
- No Editor runtime mutation behavior changed
- No Browse/My Trees page behavior changed
- No Public Viewer rendering changed
- Sidebar changes (when implemented) must not break existing Editor initialization flow
