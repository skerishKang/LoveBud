# Scoped Social Counts Model

Refs #757

## Purpose

Define social count semantics for public LoveTrees at two distinct scopes:
- **Whole-tree counts**: aggregated engagement signals for a LoveTree as a single entity.
- **Selected-moment counts**: engagement signals scoped to one specific moment (memory node) within a tree.

These two scopes must never be merged into a single ambiguous count value in any display surface or reporting output.

---

## Scope Definitions

### 1. Whole-tree social counts

| Count name | Description | Display surface |
|---|---|---|
| `tree_view_count` | Number of times the tree detail page has been opened by any visitor | Tree detail header, My Trees card |
| `tree_like_count` | Number of likes placed on the tree as a whole | Tree detail header |
| `tree_share_count` | Number of share actions initiated for the tree URL | Tree detail footer |

**Semantics:**
- Whole-tree counts represent the tree as a single publishable artifact.
- They are visible on the public tree detail page when the tree is public.
- They are not visible on Browse hub cards unless the Browse popular ranking explicitly surfaces them (see Browse separation below).
- They must not be confused with moment-level engagement.

---

### 2. Selected-moment social counts

| Count name | Description | Display surface |
|---|---|---|
| `moment_view_count` | Number of times a specific moment card has been opened/expanded | Selected moment panel, moment detail overlay |
| `moment_like_count` | Number of likes placed on the specific moment | Selected moment panel action row |
| `moment_share_count` | Number of share actions initiated for the specific moment's direct link | Selected moment panel action row |

**Semantics:**
- Selected-moment counts are scoped strictly to one memory node.
- They are shown in the Browse selected hub panel and moment detail view.
- They must not roll up into whole-tree counts.
- A tree with high moment-level engagement does not automatically have high whole-tree counts, and vice versa.

---

## Separation from Browse Popular Ranking

Browse popular ranking (`/browse?sort=popular` or equivalent) is a **separate derived signal** and must not be conflated with display-level social counts.

| | Social counts | Browse popular ranking |
|---|---|---|
| **Source** | Raw per-entity event counts | Derived composite score (view decay, recency, etc.) |
| **Display** | Raw number labels (e.g. `12 likes`) | Ranked order only (no raw score shown to user) |
| **Scope** | Per tree or per moment | Per tree in Browse index |
| **Mutation** | Updated on user action | Updated on server-side batch or edge signal |
| **Overlap risk** | Counts must not feed ranking directly without explicit backend design decision | Ranking changes must not alter count display values |

**Rule:** Any change to Browse popular ranking logic must not touch social count display fields. Any change to social count display must not alter Browse ranking order.

---

## Display Semantics Rules

1. **Scope label required**: Every count display must be clearly scoped. A count labeled only "views" with no context is not acceptable.
2. **No merged totals**: A single number combining whole-tree views and moment views must not be displayed.
3. **Zero state**: A count of zero must display as `0` or be hidden — it must not be omitted in a way that implies the field does not exist.
4. **Aggregate reporting**: In ops/admin reporting, counts must use status labels (`low`, `moderate`, `high`) rather than raw values wherever private user data could be inferred from raw counts.
5. **Private trees**: Social counts for private trees must not be shown on any public surface.

---

## Follow-up Implementation Split

This document is planning-only. Implementation must be split into separately verifiable units:

| Unit | Scope | Depends on |
|---|---|---|
| **Unit A** | DB schema: add `tree_like_count`, `tree_share_count` columns to trees table | Schema migration PR |
| **Unit B** | DB schema: add `moment_like_count`, `moment_share_count` columns to memories table | Schema migration PR |
| **Unit C** | API: whole-tree count read endpoint | Unit A |
| **Unit D** | API: moment count read endpoint | Unit B |
| **Unit E** | UI: whole-tree count display on tree detail page | Unit C |
| **Unit F** | UI: selected-moment count display in Browse selected hub panel | Unit D |
| **Unit G** | API: like/share write endpoints with idempotency | Units A, B |

Each unit must be implemented and verified independently. No unit may combine whole-tree and moment scopes.

---

## Out of Scope

- Comment read/write implementation
- Browse ranking algorithm changes
- Moderation or reporting workflows
- Any runtime JS/CSS/HTML/API/Auth/backend/DB changes in this planning document
- PR #7 / prototype / reference / demo / variant paths

---

## Status

- Planning: DRAFT
- Implementation: NOT STARTED
- Related issue: #757
- Parent completed: #622
