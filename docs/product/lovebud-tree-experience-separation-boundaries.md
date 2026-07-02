# LoveBud Tree Experience — 4-Area Separation Boundaries

**Issue:** #3054  
**Status:** Document-Level Boundary Definition (no code changes)  
**Date:** 2026-07-02  
**Dependencies:** #3061 (appreciation order) — 완료, #3058 (hub layout API) — 완료, #3059 (save status) — 완료  

Refs #3055, #3056, #3057, #3060  
Refs #1882

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Four Areas Overview](#2-four-areas-overview)
3. [Relationship Map](#3-relationship-map)
4. [Appreciation Order](#4-appreciation-order)
5. [Hub Layout](#5-hub-layout)
6. [Scout Suggestions](#6-scout-suggestions)
7. [Separation Boundary Matrix](#7-separation-boundary-matrix)
8. [Data Flow and Interaction Rules](#8-data-flow-and-interaction-rules)
9. [Risk and Migration](#9-risk-and-migration)
10. [Guardrails for Future Implementation](#10-guardrails-for-future-implementation)

---

## 1. Purpose

현재 LoveBud Tree의 데이터는 **관계 맵(relationship map)**, **감상 순서(appreciation order)**, **허브 레이아웃(hub layout)**, **Scout 제안(Scout suggestions)**의 4가지 영역으로 구성된다. 이들은 서로 다른 저장소(DB / localStorage / AI suggestion pipeline)에 존재하며, 서로 다른 생명 주기와 소유권 규칙을 가진다.

본 문서는:

- 각 영역의 **데이터 소유권(storage owner)**과 **분리 경계(separation boundary)**를 명확히 정의한다.
- 현재 구현 상태와 향후 migration 방향을 정리한다.
- 각 영역 간 **잘못된 결합(coupling)**을 방지하기 위한 규칙을 문서화한다.
- **코드 변경 없이** 문서(document-level)로만 완료한다.

근거 문서:
- `docs/product/lovebud-tree-layout-persistence-ownership-audit.md` (#3055 audit)
- `docs/product/lovebud-appreciation-order-contract.md` (#3061 contract)
- `docs/product/lovebud-tree-layout-sync-contract.md` (#3056 cross-platform sync)
- `docs/product/lovebud-scout-mvp-boundary.md` (#1882 Scout MVP boundary)

---

## 2. Four Areas Overview

| # | 영역 | 저장소 | 현재 상태 | 정의 문서 |
|---|------|--------|-----------|----------|
| 1 | **Relationship Map** (관계 맵) | DB (Neon/PostgreSQL) | ✅ 완료 — core LoveBud 기능 | Legacy (tree node edges) |
| 2 | **Appreciation Order** (감상 순서) | DB (Neon) — `tree_appreciation_orders` | ✅ 완료 — #3061 | `lovebud-appreciation-order-contract.md` |
| 3 | **Hub Layout** (허브 레이아웃) | browser localStorage (현재) → Server (미래) | ✅ 완료 — #3058 API | #3055 audit, #3056 sync contract |
| 4 | **Scout Suggestions** (Scout 제안) | localStorage/memory (draft) → DB (saved moment) | ✅ 완료 — #1882 MVP | `lovebud-scout-mvp-boundary.md` |

---

## 3. Relationship Map

### 3.1 Identity

관계 맵(relationship map)은 LoveBud Tree의 **구조적 뼈대**이다. 각 노드(moment) 간의 부모-자식 관계(edge)를 정의하며, 트리의 branch topology를 결정한다.

### 3.2 Data Model

| 항목 | 설명 |
|------|------|
| **Storage** | DB (Neon/PostgreSQL) — `moments` 또는 `tree_edges` 테이블 |
| **Key structure** | `(tree_id, parent_moment_id, child_moment_id)` — edge tuple |
| **Payload** | 부모-자식 관계만 저장. 좌표/순서/제안 정보 없음. |
| **Cardinality** | 하나의 자식 노드는 정확히 하나의 부모를 가짐 (tree structure) |
| **Owner** | 시스템 — tree 생성 시 확정, 편집 시 변경 가능 |
| **Visibility** | tree visibility에 따라 상속 (public/private) |

### 3.3 Ownership & Lifecycle

| 측면 | 규칙 |
|------|------|
| **Create** | Tree 생성 시 root node로부터 branch가 확장될 때 DB에 기록됨 |
| **Read** | 모든 surface (editor, viewer, visitor viewer)에서 읽음 |
| **Update** | Owner가 편집 시 edge 재구성 가능 (rethread) — #2471 계약 참조 |
| **Delete** | 노드 삭제 시 cascade로 edge 삭제 |
| **Source of Truth** | **DB가 유일한 Source of Truth.** 다른 영역(localStorage, Scout)에서 관계 맵을 생성·변경하지 않음. |

### 3.4 Separation Boundary

```
관계 맵은 오직 DB에 저장되며:
- localStorage의 hub layout positions와 독립적 (visual 좌표 ≠ topology)
- appreciation order의 시퀀스와 독립적 (edge 연결 ≠ 감상 순서)
- Scout suggestion의 draft 내용과 독립적 (Scout은 관계를 생성하지 않음)
```

---

## 4. Appreciation Order

### 4.1 Identity

감상 순서(appreciation order)는 Tree Owner가 의도한 **서사적 흐름**이다. 복잡한 분기 구조 속에서 뷰어가 길을 잃지 않고 스토리라인을 따라갈 수 있도록 한다.

자세한 정의: `docs/product/lovebud-appreciation-order-contract.md` (#3061)

### 4.2 Data Model

| 항목 | 설명 |
|------|------|
| **Storage** | DB (Neon) — `tree_appreciation_orders` 테이블 (가칭) |
| **Key structure** | `tree_id` (UUID, PK) — 1:1 with tree |
| **Payload** | `ordered_ids: ["memId_1", "memId_2", ...]` — JSONB array |
| **Additional fields** | `updated_at` (Timestamp) |
| **Owner** | Tree Owner만 정의·수정·삭제 가능 |
| **Visibility** | Public viewer에서 읽힘 (owner의 의도된 가이드) |

### 4.3 Ownership & Lifecycle

| 측면 | 규칙 |
|------|------|
| **Create** | Owner가 편집기에서 순서 지정 시 DB 저장 |
| **Update** | Drag-and-drop으로 순서 변경, Partial order 지원 (일부 노드만 지정 가능) |
| **Delete** | Owner가 순서 초기화 시 DB에서 제거 → Natural Order fallback |
| **Fallback** | 명시적 순서 없음 → 노드 생성 시간(created_at) 또는 Depth-First 탐색 순서 사용 |
| **Source of Truth** | **DB가 유일한 Source of Truth.** 관계 맵과 독립적 시퀀스. |

### 4.4 Separation Boundary

```
감상 순서는 오직 DB에서 관리되며:
- 관계 맵의 edge와 독립적 (연결선이 없어도 순서상 다음 노드로 가이드 가능)
- hub layout의 visual 좌표와 독립적 (순서는 위치와 무관)
- Scout suggestion의 draft와 독립적 (Scout은 순서를 제안/변경하지 않음)
```

### 4.5 Sequence vs Topology (Core Rule from #3061)

| 원칙 | 설명 |
|------|------|
| **Sequence 우선** | 연결선 기반 탐색보다 `appreciation_order` 시퀀스를 우선하여 타겟 노드 결정 |
| **Hub node 가이드** | 8개 이상 분기 허브 노드에서 다음 순서 노드를 시각적 효과로 강조 |
| **자유 탐색 허용** | 사용자가 가이드를 무시하고 다른 노드 클릭 시, 해당 지점부터 재연결 |

---

## 5. Hub Layout

### 5.1 Identity

허브 레이아웃(hub layout)은 Tree 노드들의 **시각적 배치**이다. Owner가 drag로 배치한 좌표(free mode) 또는 자동 계산된 좌표(structured mode)를 포함한다.

### 5.2 Data Model

#### 현재 (localStorage only)

| Key | Payload | 용도 |
|-----|---------|------|
| `lovebud_tree_layout_v2_<treeId>` | `{ positions: { "<memoryId>": {x, y} }, offsetX, offsetY, scale }` | Node 좌표 + viewport 상태 |
| `lovebud_tree_layout_mode_<treeId>` | `"free"` 또는 `"structured"` | 레이아웃 모드 |

#### 미래 (Server sync — #3056, #3058)

| 필드 | 타입 | 설명 |
|------|------|------|
| `tree_id` | UUID (PK) | 트리 식별자 |
| `positions` | JSONB | `{ "<memoryId>": { "x": number, "y": number } }` |
| `layout_mode` | String | `"free"` 또는 `"structured"` |
| `updated_at` | Timestamp | 마지막 저장 일시 |

**viewport 상태 제외**: `offsetX`, `offsetY`, `scale`은 기기·브라우저 종속 → 서버 저장하지 않음.

### 5.3 Ownership & Lifecycle

| 측면 | 규칙 |
|------|------|
| **Create** | Owner가 drag하거나 structured mode 전환 시 생성 |
| **Read** | 모든 canvas surface에서 읽음 (단, hub/My Trees/Browse는 읽지 않음) |
| **Update** | drag 완료 시 persist (pointer move마다 아님), structured mode에서는 persist skip |
| **Delete** | 명시적 delete 없음 — localStorage key는 logout 시에도 잔존 |
| **Source of Truth** | **현재: browser localStorage.** 미래: server (shared snapshot)가 primary, local draft가 secondary. |

### 5.4 Hub Layout vs Viewport State (Critical Separation)

```
허브 레이아웃의 두 가지 하위 구성요소는 반드시 분리되어야 함:

┌─ Hub Layout ─────────────────────┐
│  positions (node 좌표)            │  ← 서버 저장 대상 (#3056, #3058)
│  layout_mode (free/structured)    │  ← 서버 저장 대상
├─ Viewport State (local only) ─────┤
│  offsetX, offsetY (pan 위치)       │  ← localStorage only, 서버 저장 안 함
│  scale (zoom 레벨)                │  ← localStorage only, 서버 저장 안 함
└───────────────────────────────────┘
```

### 5.5 Separation Boundary

```
허브 레이아웃은 visual 배치만 관리하며:
- 관계 맵의 topology와 독립적 (좌표 ≠ edge — 같은 관계여도 좌표는 자유롭게 변경 가능)
- appreciation order의 시퀀스와 독립적 (배치 순서 ≠ 감상 순서)
- Scout suggestion의 draft와 독립적 (Scout은 레이아웃을 생성/변경하지 않음)
```

---

## 6. Scout Suggestions

### 6.1 Identity

Scout 제안(Scout suggestions)은 AI가 생성하는 **팬 활동 보조 콘텐츠**이다. 사용자가 공개 URL을 붙여넣으면 요약·번역·감정 태그를 제안하고, 이를 LoveTree moment로 저장할 수 있다.

자세한 정의: `docs/product/lovebud-scout-mvp-boundary.md` (#1882)

### 6.2 Data Model

#### Draft (저장 전)

| 저장소 | 내용 |
|--------|------|
| localStorage / in-memory | AI-generated summary, translation, emotion tags, source URL |
| 수명 | 사용자가 저장 또는 폐기할 때까지 |

#### Saved Moment (저장 후)

| 필드 | 출처 | 설명 |
|------|------|------|
| `title` | AI 제안 + 사용자 편집 | Moment 제목 |
| `memo` | AI 제안 + 사용자 편집 | 요약 + 번역 (구조화 또는 결합) |
| `emotion_tags` | AI 제안 → 사용자 확정 | 최종 감정 태그 |
| `source_url` | 사용자 입력 | 원본 링크 |
| `generated_by` | 시스템 | `"scout-v1"` 또는 `is_ai_generated: true` |

### 6.3 Ownership & Lifecycle

| 측면 | 규칙 |
|------|------|
| **Create** | AI suggestion provider가 생성 (사용자 입력 기반) |
| **Review** | 사용자가 반드시 검토·편집 (AI 제안은 draft일 뿐) |
| **Save** | 사용자가 저장 시 기존 LoveBud API (`POST /moments`)로 전송 — 일반 moment와 동일한 저장소 |
| **Discard** | 사용자가 폐기 시 draft는 localStorage에서 삭제, DB에 흔적 없음 |
| **Source of Truth** | **Draft: localStorage. Saved moment: DB.** Scout AI는 suggestion만 제공. |

### 6.4 Separation Boundary

```
Scout 제안은 AI 보조 기능이며:
- 관계 맵을 생성·변경하지 않음 (Scout은 edge를 만들지 않음)
- appreciation order를 정의하지 않음 (Scout은 순서를 제안하지 않음)
- hub layout을 변경하지 않음 (Scout은 좌표를 건드리지 않음)
- Scout의 출력물은 일반 moment와 동일한 스키마로 저장됨
```

---

## 7. Separation Boundary Matrix

### 7.1 Storage Ownership Matrix

| 영역 | 현재 Storage | 미래 Storage | Record 단위 | Owner | Write 주체 | Read 주체 |
|------|-------------|-------------|-------------|------|-----------|----------|
| **Relationship Map** | DB (Neon) | DB (Neon) | edge (parent-child tuple) | System | Editor / Rethread | 모든 surface |
| **Appreciation Order** | DB (Neon) | DB (Neon) | tree당 1 row (ordered_ids) | Tree Owner | Owner editor | Viewer / 가이드 UI |
| **Hub Layout — positions** | localStorage | Server (Neon) + localStorage cache | tree당 1 row (JSONB) | Owner browser → Server | Drag 완료 시 persist | Canvas surface |
| **Hub Layout — viewport** | localStorage | localStorage only | tree당 1 key (offset+scale) | Device/browser | Pan/zoom/Resize 시 persist | 동일 브라우저 canvas |
| **Hub Layout — mode** | localStorage | Server + localStorage | tree당 1 key (string) | Owner → Server | Mode 전환 시 persist | Canvas surface |
| **Scout Suggestions — draft** | localStorage / memory | localStorage / memory | session-scoped draft | User session | AI provider → user review | Scout UI |
| **Scout Suggestions — saved** | DB (Neon) | DB (Neon) | moment row (standard schema) | User (Tree Owner) | User save action | 모든 surface (as moment) |

### 7.2 Visibility Matrix

| 영역 | Owner | Public viewer | Anonymous visitor | 다른 기기/브라우저 |
|------|-------|--------------|-------------------|-------------------|
| **Relationship Map** | ✅ 전체 읽기/쓰기 | ✅ 읽기 (tree public 시) | ✅ 읽기 (tree public 시) | ✅ 동일 (DB 기반) |
| **Appreciation Order** | ✅ 전체 읽기/쓰기 | ✅ 읽기 (가이드 제공) | ✅ 읽기 (가이드 제공) | ✅ 동일 (DB 기반) |
| **Hub Layout — positions (현재)** | ✅ 로컬 읽기/쓰기 | ⚠️ 같은 브라우저 시 읽힘 (위험) | ⚠️ 같은 브라우저 시 읽힘 (위험) | ❌ 없음 (기본값) |
| **Hub Layout — viewport** | ✅ 로컬 읽기/쓰기 | ⚠️ 같은 브라우저 시 읽힘 (위험) | ⚠️ 같은 브라우저 시 읽힘 (위험) | ❌ 없음 (기본값) |
| **Hub Layout — mode (현재)** | ✅ 로컬 읽기/쓰기 | ⚠️ 같은 브라우저 시 읽힘 (위험) | ⚠️ 같은 브라우저 시 읽힘 (위험) | ❌ 기본값 "free" |
| **Scout Suggestions — draft** | ✅ 로컬만 | ❌ | ❌ | ❌ |
| **Scout Suggestions — saved** | ✅ 읽기/쓰기 | ✅ (tree public, moment public 시) | ✅ (tree public, moment public 시) | ✅ 동일 (DB 기반) |

### 7.3 Separation Rules (Must-Not-Cross Boundaries)

| 규칙 | 설명 | 위반 시 영향 |
|------|------|------------|
| **RN-1** | 관계 맵은 visual 좌표를 포함하지 않는다 | coordinates가 DB edge에 저장되면 안 됨 |
| **RN-2** | 관계 맵은 감상 순서를 포함하지 않는다 | order가 edge 속성으로 저장되면 안 됨 |
| **RN-3** | 감상 순서는 visual 좌표를 포함하지 않는다 | position이 `ordered_ids`에 저장되면 안 됨 |
| **RN-4** | 감상 순서는 관계 맵을 변경하지 않는다 | order 변경이 edge를 생성/삭제하면 안 됨 |
| **RN-5** | 허브 레이아웃 positions는 관계 맵을 변경하지 않는다 | drag로 edge가 변경되면 안 됨 |
| **RN-6** | 허브 레이아웃은 appreciation order를 포함하지 않는다 | layout data에 순서 정보가 저장되면 안 됨 |
| **RN-7** | Scout suggestion은 관계 맵을 생성/변경하지 않는다 | Scout 저장이 edge를 만들면 안 됨 |
| **RN-8** | Scout suggestion은 허브 레이아웃을 변경하지 않는다 | Scout 저장이 좌표를 변경하면 안 됨 |
| **RN-9** | Scout suggestion은 appreciation order를 정의하지 않는다 | Scout 저장이 순서를 결정하면 안 됨 |
| **RN-10** | Viewport state (offset/scale)는 server sync 대상이 아니다 | viewport가 shared snapshot에 포함되면 안 됨 |

---

## 8. Data Flow and Interaction Rules

### 8.1 Read Flow Priority

각 surface가 4가지 영역 데이터를 읽는 우선순위:

```
┌─ Owner Editor ──────────────────────────────────────┐
│  1. Relationship Map (DB)     — branch topology     │
│  2. Hub Layout (localStorage) — visual positions    │
│  3. Appreciation Order (DB)   — sequence guide      │
│  4. Scout Suggestions (draft) — AI draft (if open)  │
└─────────────────────────────────────────────────────┘

┌─ Public Viewer ─────────────────────────────────────┐
│  1. Relationship Map (DB)     — branch topology     │
│  2. Hub Layout (localStorage) — ⚠️ 차단 필요 (#3057)│
│  3. Appreciation Order (DB)   — sequence guide      │
└─────────────────────────────────────────────────────┘

┌─ Visitor Viewer (SVG) ──────────────────────────────┐
│  1. Relationship Map (DB)     — branch topology     │
│     (localStorage 완전 무관, 자체 좌표 계산)         │
└─────────────────────────────────────────────────────┘

┌─ My Trees / Browse Hub ─────────────────────────────┐
│  1. Tree metadata (DB)       — title, count, preview│
│     (canvas 미사용, layout/order 무관)              │
└─────────────────────────────────────────────────────┘
```

### 8.2 Write Flow Priority

```
┌─ Owner Editor Save ─────────────────────────────────┐
│  Relationship Map:  rethread 시 DB write            │
│  Appreciation Order: sequence 편집 시 DB write      │
│  Hub Layout:         drag 완료 시 localStorage write│
│  Scout:              save 시 DB write (as moment)   │
└─────────────────────────────────────────────────────┘
```

### 8.3 Surface → Data Dependency Map

| Surface | Relationship Map | Appreciation Order | Hub Layout | Scout |
|---------|-----------------|-------------------|------------|-------|
| Owner Editor | ✅ 읽기/쓰기 | ✅ 읽기/쓰기 | ✅ 읽기/쓰기 | ✅ 읽기/쓰기 (draft) |
| Public Viewer | ✅ 읽기 | ✅ 읽기 | ⚠️ 차단 예정 (#3057) | ❌ |
| Visitor Viewer (SVG) | ✅ 읽기 (자체 계산) | ❌ | ❌ | ❌ |
| My Trees Hub | ❌ | ❌ | ❌ | ❌ |
| Browse Hub | ❌ | ❌ | ❌ | ❌ |
| Scout UI | ❌ | ❌ | ❌ | ✅ 읽기/쓰기 (draft) |

---

## 9. Risk and Migration

### 9.1 Current Risks

| # | 위험 | 영역 | 심각도 | 현재 상태 |
|---|------|------|--------|----------|
| R1 | Public viewer가 같은 브라우저에서 owner의 local draft positions/viewport를 읽음 | Hub Layout | 🔴 높음 | #3057에서 차단 예정 |
| R2 | Portrait mobile에서 monkey-patch로 mode는 structured로 고정되나 `loadStoredLayout()`이 계속 실행되어 viewport offset/scale이 유입됨 | Hub Layout | 🟡 중간 | #3057에 포함 필요 |
| R3 | 다른 기기에서 layout key 없음 → 항상 기본값(0,0,scale=1)으로 시작하여 UX 일관성 없음 | Hub Layout | 🟡 중간 | #3056 sync 도입 후 해결 |
| R4 | Hub Layout positions가 DB에 저장되지 않아 기기 간 공유 불가 | Hub Layout | 🟡 중간 | #3056, #3058에서 해결 |
| R5 | Appreciation Order가 Natural Order fallback에 명확한 기준 부재 (created_at vs depth-first) | Appreciation Order | 🟢 낮음 | #3061에 정의, 구현 시 명확화 필요 |
| R6 | Scout draft가 localStorage에 잔존하여 보안/프라이버시 문제 가능 | Scout | 🟢 낮음 | 세션 종료 시 cleanup 필요 |
| R7 | logout 시 `clearPrivateCaches`가 정의되지 않아 layout key가 그대로 잔존 | Hub Layout | 🟢 낮음 | 수동 검증 필요 (#3057) |

### 9.2 Migration Path

```
현재 상태 (2026-07-02):

  Relationship Map ─── DB (Neon) ──────── ✅ 안정적
  Appreciation Order ─ DB (Neon) ──────── ✅ 안정적 (#3061)
  Hub Layout ───────── localStorage ───── ⚠️ 현재 (R1-R4 위험)
  Scout ────────────── localStorage+DB ── ✅ 안정적 (#1882)

단계별 migration:

  Phase 1 (#3057):  Hub Layout local draft 차단 (public/read-only surface)
  Phase 2 (#3056):  Hub Layout server sync 도입 (positions + mode)
  Phase 3 (#3058):  Revisioned snapshot API (version history)
  Phase 4 (#3060):  Confirmed snapshot viewer rendering
  Phase 5:          Scout production live execution (#2522 blockers 해결 후)
```

### 9.3 Decision Matrix (Extended from #3055 Audit)

| 영역 | storage owner | visibility | migration rule | risk |
|------|-------------|-----------|---------------|------|
| **Relationship Map** | DB (Neon) | tree visibility 상속 | 변경 불필요 (이미 안정적) | ✅ 없음 |
| **Appreciation Order** | DB (Neon) | public (가이드 제공) | 변경 불필요 (이미 안정적) | ✅ 낮음 (fallback 명확화 필요) |
| **Hub Layout — positions** | localStorage → Server | owner → shared | 명시적 분리: local draft 불침범, server snapshot 별도 key | ⚠️ public viewer 유출 (#3057) |
| **Hub Layout — viewport** | localStorage only | owner browser | 서버 저장 금지 (device-specific) | ⚠️ public viewer 유출 (#3057) |
| **Hub Layout — mode** | localStorage → Server | owner → shared | positions와 함께 migration | ⚠️ 다른 기기 기본값 |
| **Scout Suggestions — draft** | localStorage/memory | user session | session 종료 시 cleanup | 🟢 낮음 |
| **Scout Suggestions — saved** | DB (Neon) | tree+moment visibility | 일반 moment schema 준수 | ✅ 낮음 |

---

## 10. Guardrails for Future Implementation

### 10.1 절대적 경계 (Absolute Boundaries)

다음 규칙은 **어떤 상황에서도 위반되지 않아야 한다:**

1. **관계 맵 ≠ visual 좌표**: DB edge tuple에는 절대 x/y 좌표를 저장하지 않는다.
2. **관계 맵 ≠ 감상 순서**: DB edge tuple에는 절대 sequence order를 저장하지 않는다.
3. **감상 순서 ≠ visual 좌표**: `ordered_ids` array에는 절대 position 정보를 포함하지 않는다.
4. **허브 레이아웃 ≠ 관계 맵**: localStorage `positions`는 오직 visual 좌표만 저장하며, edge 정보를 포함하지 않는다.
5. **Scout ≠ 관계/순서/레이아웃**: Scout suggestion은 절대 edge, order, position을 생성하지 않는다.

### 10.2 설계 원칙 (Design Principles)

6. **각 영역은 독립적 저장소를 가진다**: 동일한 DB table, localStorage key, 또는 API endpoint를 공유하지 않는다.
7. **각 영역은 독립적 생명 주기를 가진다**: 한 영역의 생성/수정/삭제가 다른 영역에 영향을 주지 않는다.
8. **Public surface는 local draft를 읽지 않는다**: `canEdit: false`면 `loadStoredLayout()`을 호출하지 않도록 #3057에서 수정한다.
9. **Viewport state는 서버에 저장하지 않는다**: `offsetX`, `offsetY`, `scale`은 localStorage에만 존재하며, server sync 대상에서 제외한다.
10. **Server snapshot 도입 시 local draft를 보존한다**: server 저장이 기존 localStorage 데이터를 삭제 또는 덮어쓰지 않는다.

### 10.3 구현 순서 (Implementation Order)

```
#3057 → Hub Layout read 차단 (public/read-only surface)
  ↓
#3056 → Hub Layout server sync (positions + mode)
  ↓
#3058 → Revisioned snapshot API
  ↓
#3060 → Confirmed snapshot viewer rendering
```

Scout live execution (#1882 real-live blockers)은 위 흐름과 독립적으로 진행 가능.

---

## References

| 문서 | 관련 이슈 | 내용 |
|------|----------|------|
| `lovebud-tree-layout-persistence-ownership-audit.md` | #3055 | Hub Layout localStorage read/write 경계 분석 |
| `lovebud-appreciation-order-contract.md` | #3061 | 감상 순서 데이터 모델 및 규칙 |
| `lovebud-tree-layout-sync-contract.md` | #3056 | Hub Layout server sync 계획 |
| `lovebud-scout-mvp-boundary.md` | #1882 | Scout MVP 범위 및 데이터 정책 |
| `lovebud-editor-arrange-rethread-product-contract.md` | #2471 | Arrange vs Rethread 경계 (관계 맵 수정 규칙) |
