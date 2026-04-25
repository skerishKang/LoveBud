# LoveBud API 응답 계약

> **버전:** 1.4  
> **최종 갱신:** 2026-04-25  
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

### 2.2 Memory 목록

```typescript
type MemoryList = Memory[];
```

### 2.3 Tree 단건

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
    description?: string;
    coverImage?: string;
    nodes?: Memory[];
  };
}
```

### 2.4 Tree 목록

```typescript
type TreeList = Tree[];
```

### 2.5 Tree Detail

```typescript
interface TreeDetail extends Tree {
  payload: {
    nodes: Memory[];
  };
}
```

---

## 3. Visibility / private storage 전환 계약

### 3.1 현재 구현 계약

현재 main 구현은 아직 private-first입니다.

- `POST /api/trees`는 새 tree 생성 시 `visibility` 기본값을 `private`으로 처리합니다.
- `POST /api/trees`에 `visibility: 'public'`이 들어오면 현재 구현은 409를 반환합니다.
- `PUT /api/trees/:treeId`는 private → public 전환 시 공개 memory 3개 이상 조건을 확인합니다.
- public → private 전환에 Plus entitlement 검증은 아직 없습니다.
- Modal private tree 생성도 동일하게 private-first이며 public 생성 요청을 차단합니다.

### 3.2 목표 정책 계약

CTO 결정 기준 목표 정책은 **public-first + Plus private**입니다.

- 신규 tree는 public-first 방향으로 전환합니다.
- 기존 private tree는 자동 public 전환하지 않고 grandfathered private으로 유지합니다.
- private 생성/전환은 Plus entitlement source 확정 후 backend에서 검증합니다.
- `public visibility`와 `browse 노출 조건`은 분리합니다.
- createTree payload만 단독으로 public 변경하는 것은 금지합니다.
- Netlify와 Modal create/toggle 정책은 반드시 동기화합니다.

### 3.3 public visibility와 browse 노출 분리

`visibility: 'public'`은 접근 가능 상태입니다.

browse 노출은 별도 display/quality filter입니다.

```typescript
interface VisibilityPolicyState {
  visibility: 'public' | 'private';
  browseEligible: boolean;
  browseEligibilityReason?: 'min_public_memories_not_met' | 'private_tree' | 'quality_filter_pending' | null;
}
```

현재 browse 기본 노출 조건:

- tree visibility가 `public`
- public memory가 최소 3개 이상
- browse summary filter 통과

따라서 public tree라도 public memory가 3개 미만이면 public 접근은 가능하지만 browse summary에는 노출되지 않을 수 있습니다.

### 3.4 create tree 전환 계약

현재:

```typescript
interface CreateTreeRequestCurrent {
  title?: string;
  visibility?: 'private';
}
```

목표:

```typescript
interface CreateTreeRequestTarget {
  title?: string;
  visibility?: 'public' | 'private';
}
```

목표 정책:

- visibility 생략 시 신규 tree는 `public`으로 생성합니다.
- `visibility: 'private'` 생성은 Plus entitlement 필요 대상입니다.
- entitlement source 확정 전에는 private 생성 허용/차단을 구현하지 않습니다.
- frontend만 먼저 public payload로 바꾸지 않습니다.

### 3.5 toggle visibility 전환 계약

목표 정책:

```typescript
interface UpdateTreeVisibilityRequest {
  visibility: 'public' | 'private';
}
```

전환 규칙:

- `public -> private`: Plus entitlement 필요
- `private -> public`: grandfathered private 해제 또는 publish 성격으로 허용 후보
- `private -> public` 시 browse 노출 조건은 별도 판단
- public 전환 자체와 browse summary 노출을 같은 guard로 묶지 않습니다.

### 3.6 decision-needed: entitlement error contract

아직 미확정입니다.

후보:

```typescript
interface PlusRequiredError {
  error: true;
  code: 'PLUS_REQUIRED_PRIVATE_STORAGE';
  message: string;
}
```

HTTP status 후보:

- `403`: 현재 auth/permission 계열과 일관됨
- `402`: 의미상 결제 필요에 가깝지만 운영 관행이 불균일함

결정 필요:

- Plus entitlement source of truth
- status code
- error body shape
- grandfathered private 예외 처리

---

## 4. Browse 전용 계약

### 4.1 Browse Summary Contract

**Endpoint**
- `GET /api/community/trees?view=summary&sort=latest&limit=3`

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
- summary는 tree 목록 자체가 아니라, public tree와 public memory를 합쳐 만든 browse 카드 요약 모델입니다.
- public-first 전환 후에도 browse summary는 `browseEligible` 조건을 통과한 public tree만 반환해야 합니다.
- visibility가 public이어도 memory/quality 조건이 부족하면 summary에서 제외될 수 있습니다.

### 4.2 Preview Hydration Contract

**Endpoint**
- `GET /api/community/memories?treeId=<treeId>`

```typescript
type BrowseHydrationMemoryList = Memory[];
```

- hydrate는 public memories만 반환합니다.
- public tree라도 private memory는 browse hydrate에 포함하지 않습니다.
- private/grandfathered tree는 browse hydrate 대상이 아닙니다.

### 4.3 Future Modal Snapshot Contract

예정 endpoint 후보:

- `GET /api/community/trees/<treeId>/snapshot`
- `GET /api/community/trees?view=snapshot&treeId=<treeId>`

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

Snapshot도 browse 노출 조건을 통과한 public tree를 기본 대상으로 합니다.

---

## 5. HOT / 추천 / 좋아요 확장 계약 예정

```typescript
interface BrowseTreeSummaryExtension {
  badgeLabel?: 'HOT' | '추천' | null;
  hotScore?: number | null;
  likeCount?: number | null;
  bookmarkCount?: number | null;
  reactionCount?: number | null;
}
```

원칙:

- 확장 필드는 optional additive field로만 추가합니다.
- user-state 필드는 summary 기본 계약에 넣지 않습니다.
- `likedByMe`, `bookmarkedByMe` 등은 snapshot 또는 별도 viewer-state endpoint로 분리합니다.

---

## 6. 프론트엔드 원칙

### 6.1 절대 금지

```javascript
const title = memory.data?.title;
const treeId = memory.data?.tree_id;
```

### 6.2 필수 사용

```javascript
const title = memory.title;
const treeId = memory.treeId;
const normalized = window.LoveBudNormalize.normalizeMemory(apiResponse);
```

### 6.3 visibility 정책 관련 금지

- frontend만 createTree payload를 public으로 변경하지 않습니다.
- frontend-only Plus lock으로 정책 완료를 선언하지 않습니다.
- public visibility를 browse 노출과 같은 의미로 표시하지 않습니다.

---

## 7. 백엔드 원칙

### 7.1 직렬화기 사용 의무

모든 API 응답은 반드시 serializers를 거칩니다.

### 7.2 visibility guard 원칙

- create tree 정책은 Netlify와 Modal에서 동기화해야 합니다.
- private 생성/전환 guard는 entitlement source 확정 후 backend에서 강제해야 합니다.
- 기존 private tree grandfathering을 고려해야 합니다.
- browse display filter는 public visibility와 별도로 유지합니다.

---

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `netlify/functions/_lib/serializers.js` | API 응답 직렬화기 |
| `netlify/functions/trees.js` | create tree / list trees |
| `netlify/functions/tree-detail.js` | tree detail / visibility update |
| `netlify/functions/community-trees.js` | browse summary 서버 계약 |
| `netlify/functions/community-memories.js` | browse hydration 서버 계약 |
| `modal_compute/app.py` | Modal public/private tree 계약 |
| `js/utils/normalize.js` | 프론트 정규화 유틸 |
| `js/api/public-tree-adapter.js` | browse summary/hydrate adapter |

---

## 9. 장기 TODO

### 9.1 public-first backend 전환

- Netlify create tree public-first 전환
- Modal create tree public-first 전환
- create payload 단독 변경 금지 원칙 유지
- API 계약 테스트 추가

### 9.2 Plus private entitlement

- entitlement source of truth 확정
- plan 저장 위치 확정
- backend guard 추가
- frontend 안내와 API error 처리 동기화

### 9.3 browse 노출 조건 고정

- public visibility와 browseEligible 분리
- public memory 3개 이상 조건 유지 여부 최종 확인
- snapshot 계약에 browseEligibility metadata 포함 여부 검토

---

## 10. 위반 시 대응

| 위반 유형 | 대응 |
|-----------|------|
| 새 코드에 `{id, data}` 접근 | PR reject |
| API 응답에 직렬화기 미사용 | PR reject |
| createTree payload만 public으로 단독 변경 | PR reject |
| Netlify와 Modal visibility 정책 불일치 | PR reject |
| Plus private을 frontend-only로 잠금 | PR reject |
| 기존 private tree 자동 public 전환 | PR reject |
| public visibility를 browse 노출로 설명 | 정책 위반으로 수정 |

---

**문서 유지보수:** API 응답 구조 또는 visibility 정책 변경 시 이 문서를 반드시 갱신할 것
