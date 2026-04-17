# LoveBud API 응답 계약

> **버전:** 1.0  
> **최종 갱신:** 2026-04-18  
> **관련 커밋:** `0230475`, `bb9741b`, `bb9e663`

---

## 1. 개요 (왜 `{id, data}`를 버렸는가)

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

## 3. 프론트엔드 원칙

### 3.1 절대 금지

```javascript
// ❌ 금지: {id, data} 접근
const title = memory.data?.title;
const treeId = memory.data?.tree_id;

// ❌ 금지: 믹스드 접근
const title = memory.data?.title || memory.title;
```

### 3.2 필수 사용

```javascript
// ✅ 표준: flat camelCase 직접 접근
const title = memory.title;
const treeId = memory.treeId;

// ✅ 표준: normalizeMemory 공통 유틸
const normalized = window.LoveBudNormalize.normalizeMemory(apiResponse);
```

### 3.3 snake_case 임시 보정

**원칙:** snake_case는 백엔드에서 이미 camelCase로 변환되어야 합니다.

**임시 예외:** 백엔드 직렬화기에서 아직 처리되지 않은 필드에 대해서만 `normalizeMemory`에서 보정을 허용합니다.

```javascript
// js/utils/normalize.js
function normalizeMemory(mem) {
  if (!mem || typeof mem !== 'object') return mem;
  
  // 이미 camelCase면 그대로 반환
  if (mem.treeId !== undefined) return mem;
  
  // snake_case 보정 (임시)
  return {
    ...mem,
    treeId: mem.tree_id ?? mem.treeId ?? null,
    // ... 기타 필드
  };
}
```

---

## 4. 백엔드 원칙

### 4.1 직렬화기 사용 의무

**모든 API 응답은 반드시 serializers를 거쳐야 합니다.**

```javascript
// netlify/functions/memory-detail.js
const { serializeMemory } = require('./_lib/serializers');

const existingFlat = serializeMemory(existing);
return ok(existingFlat);
```

### 4.2 허용되는 함수

- `serializeMemory(input)` - Memory 단건
- `serializeMemoryList(items)` - Memory 목록
- `serializeTree(input, options)` - Tree 단건
- `serializeTreeList(items)` - Tree 목록

### 4.3 내부 저장소와 API 응답 분리

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

## 5. 관련 파일

| 파일 | 역할 |
|------|------|
| `netlify/functions/_lib/serializers.js` | API 응답 직렬화기 |
| `js/utils/normalize.js` | 프론트 정규화 유틸 |
| `js/detail.js` | flat camelCode 사용 예시 |
| `js/editor.js` | flat camelCase 사용 예시 |
| `js/search.js` | flat camelCase 사용 예시 |

---

## 6. 장기 TODO

### 6.1 snake_case fallback 완전 제거 검토

**현재:** 직렬화기와 normalize에서 snake_case/camelCase 병행 지원
**목표:** 백엔드는 camelCase만, 프론트는 별도 변환 불필요
**검증 필요:**
- 모든 API 엔드포인트가 serializers를 거치는지
- DB에서 꺼낸 raw 데이터가 어디까지 흘러가는지

### 6.2 normalizeMemory 역할 축소

**현재:** snake_case → camelCase 보정
**목표:** 백엔드에서 완전히 처리되면 normalizeMemory는 단순 검증/기본값 처리만

---

## 7. 위반 시 대응

| 위반 유형 | 대응 |
|-----------|------|
| 새 코드에 `{id, data}` 접근 | PR reject |
| API 응답에 직렬화기 미사용 | PR reject |
| snake_case 필드 노출 | 버그로 처리, serializers 보강 |
| 프론트에서 직접 snake_case 보정 | normalize.js로 이관 후 제거 |

---

**문서 유지보수:** API 응답 구조 변경 시 이 문서를 반드시 갱신할 것
