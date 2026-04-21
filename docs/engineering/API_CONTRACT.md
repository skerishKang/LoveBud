# LoveBud API 응답 계약

> **버전:** 1.2  
> **최종 갱신:** 2026-04-22  
> **관련 커밋:** `0230475`, `bb9741b`, `bb9e663`

---

## 1. 개요

> ⚠️ **이행기(Migration) 상태 안내**
> 
> 현재 표준 응답 계약은 **flat camelCase**로 확정되었습니다.
> 다만 클라이언트 런타임에는 snake_case 및 legacy `{id, data}` 형태를 수용하는 이행기 호환용 fallback이 일부 남아 있습니다.
> 
> - 신규 API, 문서, 테스트는 flat camelCase만 정식 계약으로 간주합니다.
> - fallback 제거 전에는 관련 엔드포인트 응답 스냅샷 또는 계약 테스트를 먼저 고정해야 합니다.
> - 목표: `/community/trees`, `/community/memories` 및 주요 API가 flat camelCase만 반환하면 클라이언트 fallback 제거

### 1.1 문제 배경

이전 LoveBud는 내부 저장소(`doc-store.js`)의 `{id, data: {...}}` 구조를 그대로 API 응답으로 반환하거나, 프론트엔드에서 이를 수동으로 flat하게 변환하는 패턴을 사용했습니다.

**문제점:**
- 프론트/백엔드 응답 구조 불일치
- 프론트엔드 코드 곳곳에서 `memory.data?.title`, `tree.data?.id` 같은 불안정한 접근
- API 응답의 불확실성으로 인한 defensive coding 과잉

### 1.2 해결 방향

**표준화된 응답:** flat camelCase

```javascript
// ❌ 옛 방식 (금지)
{
  id: "mem_123",
  data: {
    title: "기억",
    tree_id: "tree_456"
  }
}

// ✅ 현재 표준
{
  id: "mem_123",
  title: "기억",
  treeId: "tree_456"
}
```

---

## 2. 현재 표준 응답 Shape

### 2.1 Memory 단건

**파일:** `netlify/functions/_lib/serializers.js:serializeMemory`

```typescript
interface Memory {
  id: string | null;
  treeId: string | null;
  parentId: string | null;
  title: string;
  memo: string;
  artist: string;
  source: string;
  sourceUrl: string;
  sourceType: 'youtube' | string;
  thumbnail: string;
  emotionTags: string[];
  timestamp: string;
  visibility: 'public' | 'private';
  createdAt: string | null;
  updatedAt: string | null;
}
```

**핵심 필드 매핑:**
- `tree_id` (snake_case) → `treeId` (camelCase)
- `parent_id` → `parentId`
- `source_url` → `sourceUrl`
- `source_type` → `sourceType`
- `emotion_tags` → `emotionTags`
- `created_at` → `createdAt`
- `updated_at` → `updatedAt`

### 2.2 Memory 목록

```typescript
type MemoryList = Memory[];
```

**직렬화:** `serializeMemoryList(items)`

### 2.3 Tree 단건

**파일:** `netlify/functions/_lib/serializers.js:serializeTree`

```typescript
interface Tree {
  id: string | null;
  ownerId: string | null;
  title: string;
  visibility: 'public' | 'private';
  createdAt: string | null;
  updatedAt: string | null;
  nodeCount: number;
  payload: {
    // 확장 필드
    description?: string;
    coverImage?: string;
    // ... 기타 payload 필드
    nodes?: Memory[]; // tree-detail용
  };
}
```

### 2.4 Tree 목록

```typescript
type TreeList = Tree[];
```

**직렬화:** `serializeTreeList(items)`

### 2.5 Tree Detail (with memories)

Tree 응답에 `payload.nodes`가 포함된 형태입니다.

```typescript
interface TreeDetail extends Tree {
  payload: {
    nodes: Memory[];
    // ... 기타 payload
  };
}
```

---

## 3. Browse 전용 계약

> 현재 browse는 **summary 목록 우선 → 선택 후 treeId 기준 preview hydrate** 구조입니다.
> 구현 기준 파일:
> - `netlify/functions/community-trees.js`
> - `netlify/functions/community-memories.js`
> - `js/search.js`
> - `js/api/public-tree-adapter.js`

### 3.1 Browse Summary Contract

**Endpoint**
- `GET /api/community/trees?view=summary&sort=latest&limit=3`

**Query params**
- `view=summary` : browse summary 응답 활성화
- `sort=latest` : 현재 구현상 최신순 정렬
- `limit=3` : 현재 browse 초기 목록 기본 개수

**Response shape**

```typescript
interface BrowseTreeSummary {
  id: string;
  title: string;
  visibility: 'public' | 'private';
  createdAt: string | null;
  updatedAt: string | null;
  representativeThumbnail: string;
  memoryCount: number;
  emotionTags: string[];
  stage: string;
  theme: string;
  timeRange: string;
}

type BrowseTreeSummaryList = BrowseTreeSummary[];
```

**현재 구현 의미**
- summary는 tree 목록 자체가 아니라, public tree와 public memory를 합쳐 만든 **browse 카드 요약 모델**입니다.
- `representativeThumbnail`, `memoryCount`, `emotionTags`, `stage`, `theme`, `timeRange`는 summary view에서 서버가 계산합니다.
- 현재 구현상 `representativeThumbnail`은 정렬된 메모리 흐름의 **첫 memory thumbnail** 우선입니다.

**Fallback rules**
- `representativeThumbnail`이 없으면 빈 문자열 허용
- `theme`가 비면 `'LoveTree'`
- `timeRange`가 비면 빈 문자열 또는 browse renderer 기본 문구 사용
- summary 응답은 browse 첫 렌더용이므로 `memories` 배열은 포함하지 않음

**Backward compatibility rule**
- 서버 정식 계약은 flat camelCase입니다.
- 다만 browse adapter는 이행기 동안 아래를 수용합니다.
  - legacy `{ data }` wrapper
  - `created_at`, `updated_at`
  - `owner_id`
  - `representative_thumbnail`
  - `memory_count`
- browse 경로 외 신규 UI는 이 fallback에 의존하지 않습니다.

### 3.2 Preview Hydration Contract

**Endpoint**
- `GET /api/community/memories?treeId=<treeId>`

**Query params**
- `treeId=<treeId>` : 선택된 browse tree id
- `limit` : 현재 browse hydrate 경로에서는 명시하지 않음. 서버 기본 상한 사용

**Response shape**

```typescript
type BrowseHydrationMemoryList = Memory[];
```

**클라이언트 hydration 결과 shape**

```typescript
interface HydratedBrowseTree extends BrowseTreeSummary {
  memories: Memory[];
  memoryCount: number;
  emotionTags: string[];
  timeRange: string;
  representativeThumbnail: string;
  theme: string;
  stage: string;
}
```

**현재 구현 의미**
- summary 목록 선택 후 `js/search.js`가 `treeId`로 public memories를 다시 조회합니다.
- `js/api/public-tree-adapter.js`가 tree summary + memory list를 합쳐 preview용 hydrated model을 만듭니다.
- 현재 preview는 **tree detail 전체 응답**가 아니라, `treeId` 기준 memories hydrate 결과를 사용합니다.

**Fallback rules**
- hydrate 실패 시 summary 목록은 유지하고 preview만 reset 가능
- preview hydrate가 실패해도 browse list는 재렌더 가능해야 함
- `memories`가 비어도 summary의 `memoryCount`, `stage`, `theme`, `representativeThumbnail` 기본값은 유지 가능
- adapter는 memory 응답에서도 이행기 snake_case / `{data}` wrapper를 임시 수용함

**Backward compatibility rule**
- browse hydrate는 camelCase-only를 목표로 하지만, adapter 내부에서만 snake_case와 wrapper fallback 허용
- `treeId`, `createdAt`, `sourceUrl`, `emotionTags`는 장기적으로 camelCase-only로 고정

### 3.3 Future Modal Snapshot Contract

> 이 계약은 **예정 상태**입니다. 현재 main에는 구현되어 있지 않습니다.
> 목적은 browse 카드 선택 시 preview hydrate 전체 memories를 계속 쓰는 대신,
> Modal에서 필요한 최소 snapshot만 별도 계약으로 고정하는 것입니다.

**예정 endpoint 방향**
- 후보 1: `GET /api/community/trees/<treeId>/snapshot`
- 후보 2: `GET /api/community/trees?view=snapshot&treeId=<treeId>`

**예정 query params**
- `treeId` 또는 path param 기반 tree 식별자
- 필요 시 `limit`, `cursor`, `include=preview|flow` 같은 확장 파라미터 추가 가능

**예정 response shape (초안)**

```typescript
interface BrowseTreeSnapshot {
  id: string;
  title: string;
  visibility: 'public' | 'private';
  createdAt: string | null;
  updatedAt: string | null;
  representativeThumbnail: string;
  memoryCount: number;
  emotionTags: string[];
  stage: string;
  theme: string;
  timeRange: string;
  previewMemory?: Memory | null;
  flowPreview?: Memory[];
}
```

**Snapshot contract 원칙**
- Modal snapshot은 **browse summary의 확장 계약**이어야지, tree detail 계약 재사용이 아닙니다.
- snapshot은 Modal 오픈에 필요한 최소 데이터만 포함합니다.
- full memory list 전체를 강제하지 않습니다.
- detail/editor 계약과 분리된 browse 전용 응답으로 유지합니다.

**Migration 방향**
1. 현재 browse summary contract 고정
2. 현재 preview hydrate contract 고정
3. Modal snapshot 응답 shape를 별도 snapshot 테스트로 고정
4. Modal 오픈 시 `/community/memories?treeId=` 직접 hydrate 대신 snapshot 우선 사용
5. 이후 필요 시 preview hydrate는 snapshot 보조 fallback으로만 축소

**Backward compatibility rule**
- snapshot 도입 전까지 현재 summary + hydrate 조합이 정식 지원 경로입니다.
- snapshot 도입 초기에도 browse adapter는 기존 summary/hydrate 경로를 fallback으로 유지해야 합니다.
- snapshot 계약이 고정되기 전에는 기존 `/community/memories?treeId=` 경로를 제거하지 않습니다.

---

## 4. 프론트엔드 원칙

### 4.1 절대 금지

```javascript
// ❌ 금지: {id, data} 접근
const title = memory.data?.title;
const treeId = memory.data?.tree_id;

// ❌ 금지: 믹스드 접근
const title = memory.data?.title || memory.title;
```

### 4.2 필수 사용

```javascript
// ✅ 표준: flat camelCase 직접 접근
const title = memory.title;
const treeId = memory.treeId;

// ✅ 표준: normalizeMemory 공통 유틸
const normalized = window.LoveBudNormalize.normalizeMemory(apiResponse);
```

### 4.3 snake_case 이행기 호환 (Migration-Only)

**원칙:** 신규 코드와 서버 응답은 flat camelCase만 사용해야 합니다.

**이행기 호환:** 클라이언트 런타임이 아직 legacy snake_case 및 `{id, data}` 형태를 수용하는 것은 이행기 기간 동안만 허용됩니다.

**제거 조건:** `/community/trees`, `/community/memories` 및 주요 API가 flat camelCase만 반환하는 것이 확인되면, `js/utils/normalize.js`와 `js/postgres-client.js`의 transitional fallback을 제거합니다.

```javascript
// js/utils/normalize.js - transitional fallback block
// Accept legacy snake_case fields during migration only.
// New code and server responses must prefer flat camelCase only.
function normalizeMemory(mem) {
  if (!mem || typeof mem !== 'object') return mem;

  return {
    id: mem.id,
    treeId: mem.treeId || mem.tree_id || null,  // TODO: remove || mem.tree_id after migration
    parentId: mem.parentId ?? mem.parent_id ?? null,  // TODO: remove ?? mem.parent_id
    // ...
  };
}
```

---

## 5. 백엔드 원칙

### 5.1 직렬화기 사용 의무

**모든 API 응답은 반드시 serializers를 거쳐야 합니다.**

```javascript
// netlify/functions/memory-detail.js
const { serializeMemory } = require('./_lib/serializers');

const existingFlat = serializeMemory(existing);
return ok(existingFlat);
```

### 5.2 허용되는 함수

- `serializeMemory(input)` - Memory 단건
- `serializeMemoryList(items)` - Memory 목록
- `serializeTree(input, options)` - Tree 단건
- `serializeTreeList(items)` - Tree 목록

### 5.3 내부 저장소와 API 응답 분리

```javascript
// 내부 저장소 (doc-store)
const internal = {
  id: "tree_123",
  data: {
    title: "My Tree",
    tree_id: "tree_123"
  }
};

// API 응답 (flat camelCase)
const response = serializeTree(internal);
// { id: "tree_123", title: "My Tree" }
```

---

## 6. 관련 파일

| 파일 | 역할 |
|------|------|
| `netlify/functions/_lib/serializers.js` | API 응답 직렬화기 |
| `js/utils/normalize.js` | 프론트 정규화 유틸 |
| `js/detail.js` | flat camelCode 사용 예시 |
| `js/editor.js` | flat camelCase 사용 예시 |
| `js/search.js` | flat camelCase 사용 예시 |
| `js/api/public-tree-adapter.js` | browse summary/hydrate 이행기 adapter |
| `netlify/functions/community-trees.js` | browse summary 서버 계약 |
| `netlify/functions/community-memories.js` | browse hydration 서버 계약 |

---

## 7. 장기 TODO

### 7.1 snake_case fallback 완전 제거 검토

**현재:** 직렬화기와 normalize에서 snake_case/camelCase 병행 지원 (이행기 호환)
**목표:** 백엔드는 camelCase만, 프론트는 별도 변환 불필요

**제거 조건 (완료 기준):**
1. `/community/trees`, `/community/memories` 엔드포인트가 flat camelCase만 반환
2. `/api/trees/*`, `/api/memories/*` 엔드포인트가 flat camelCase만 반환
3. mock-data.js, cache 저장 데이터가 flat camelCase로 정리됨
4. 관련 테스트 스냅샷이 flat camelCase 기준으로 고정됨

**제거 대상 파일 및 코드:**
- `js/utils/normalize.js`: snake_case fallback 블록
- `js/postgres-client.js`: `getPublicTrees()` 내 `{id,data}` wrapper 및 snake_case fallback
- `js/api/public-tree-adapter.js`: browse 전용 legacy fallback 블록

**목표 시점:** 위 제거 조건 충족 후 즉시 진행 (마일스톤: TBD)

### 7.2 normalizeMemory 역할 축소

**현재:** snake_case → camelCase 보정
**목표:** 백엔드에서 완전히 처리되면 normalizeMemory는 단순 검증/기본값 처리만

### 7.3 browse snapshot 계약 고정

**현재:** summary + memories hydrate 조합
**목표:** Modal open용 snapshot contract 별도 고정

**완료 기준:**
1. summary contract 문서 고정
2. preview hydration contract 문서 고정
3. snapshot response shape 테스트 추가
4. Modal snapshot 도입 후 hydrate fallback 범위 재정의

---

## 8. 위반 시 대응

| 위반 유형 | 대응 |
|-----------|------|
| 새 코드에 `{id, data}` 접근 | PR reject |
| API 응답에 직렬화기 미사용 | PR reject |
| snake_case 필드 노출 | 버그로 처리, serializers 보강 |
| 프론트에서 직접 snake_case 보정 | normalize.js로 이관 후 제거 |
| browse snapshot 없이 detail/tree payload를 Modal에 재사용 | 계약 위반으로 처리 |

---

**문서 유지보수:** API 응답 구조 변경 시 이 문서를 반드시 갱신할 것
