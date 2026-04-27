# LoveBud API 응답 계약

> **버전:** 1.5  
> **최종 갱신:** 2026-04-27  
> **관련 커밋:** `0230475`, `bb9741b`, `bb9e663`, `10b3d9d`

---

## 0. Runtime source of truth

Current production/test slot API runtime is:

```text
Cloudflare Pages same-origin /api/*
→ Cloudflare Pages Functions under functions/api/*
→ Modal
```

Production / test1 / test2 / test3 route matrix observation:

- `/api/trees`: `x-lovebud-upstream: modal`
- `/api/memories`: `x-lovebud-upstream: modal`
- `modal-function-call-id` exists
- `server: cloudflare`
- `cf-cache-status: DYNAMIC`
- No Netlify Functions invocation evidence was observed

`netlify/functions/*` is a legacy artifact only. It is not the current production backend for `lovebud.pages.dev`. Do not implement new backend policy in `netlify/functions/*` unless CTO explicitly reactivates Netlify runtime.

PR #38 was closed because it targeted legacy `netlify/functions/*` rather than the active Cloudflare/Modal runtime.

Archive is not performed by this documentation update. Archive requires tests/docs reference transition first.

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

Active runtime contract source:

- Cloudflare Pages Functions under `functions/api/*`
- Modal `/modal/*` endpoints

Legacy reference only:

- `netlify/functions/_lib/serializers.js:serializeMemory`

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

### 3.1 현재 active runtime 계약

Current active runtime is Cloudflare Pages Functions → Modal.

Current production behavior must be verified against that active route, not `netlify/functions/*`.

Current document baseline:

- `POST /api/trees` and `GET /api/trees` route through `functions/api/trees.js` to Modal `/modal/private/trees`.
- `POST /api/memories` and `GET /api/memories` route through `functions/api/memories.js` to Modal `/modal/private/memories`.
- `netlify/functions/*` may still contain older private-first code, but it is not authoritative for `lovebud.pages.dev` production/test slots.

Current main runtime state:

- My Trees create payload explicitly sends `visibility: 'public'`.
- Modal create tree path defaults omitted visibility to `public`.
- Modal private tree/memory create and private visibility update paths call the private storage entitlement guard.
- Public read paths retain parent tree visibility guards.
- Public visibility remains separate from Browse/Search eligibility.

### 3.2 목표 정책 계약

CTO 결정 기준 목표 정책은 **public-first + Plus private**입니다.

- 신규 tree는 public-first 정책입니다.
- 기존 private tree는 자동 public 전환하지 않고 grandfathered private으로 유지합니다.
- private 생성/전환은 Plus entitlement guard 대상입니다.
- `public visibility`와 `browse 노출 조건`은 분리합니다.
- Cloudflare Pages Functions와 Modal create/toggle 정책은 반드시 동기화합니다.
- `netlify/functions/*`에는 신규 backend 정책을 구현하지 않습니다. Netlify runtime 재활성화가 명시 승인된 경우만 예외입니다.

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

### 3.4 create tree runtime 계약

현재 active path:

```text
/api/trees
→ functions/api/trees.js
→ Modal /modal/private/trees
```

Request target:

```typescript
interface CreateTreeRequestTarget {
  title?: string;
  visibility?: 'public' | 'private';
}
```

현재 main runtime 상태:

- visibility 생략 시 신규 tree는 `public`으로 생성합니다.
- My Trees 생성 payload는 `visibility: 'public'`을 명시합니다.
- `visibility: 'private'` 생성은 Plus entitlement guard 대상입니다.
- 현재 Modal 구현은 private visibility 요청에 대해 Firestore user profile 기반 entitlement guard를 호출합니다.
- canonical entitlement field는 `users/{uid}.privateStorageEnabled`입니다.
- 현재 구현은 compatibility 목적으로 `plan`, `plus`, `entitlements.privateStorage`도 확인하지만, 장기 API 계약으로 고정할지는 별도 결정이 필요합니다.

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

### 3.6 implemented guard / contract-needed: entitlement error contract

Modal main에는 private storage entitlement guard가 구현되어 있습니다.

Contract-needed 후보:

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

아직 고정하지 말 것:

- 최종 status code
- 최종 error body shape
- frontend toast/i18n mapping
- compatibility entitlement fields의 장기 지원 여부
- grandfathered private 예외 처리

---

## 4. Browse 전용 계약

### 4.1 Browse Summary Contract

**Endpoint**
- `GET /api/community/trees?view=summary&sort=latest&limit=3`

**Active route**
- Cloudflare Pages `functions/api/[[path]].js`
- Modal `/modal/browse/latest`

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
- public-first create 이후에도 browse summary는 `browseEligible` 조건을 통과한 public tree만 반환해야 합니다.
- visibility가 public이어도 memory/quality 조건이 부족하면 summary에서 제외될 수 있습니다.

### 4.2 Preview Hydration Contract

**Endpoint**
- `GET /api/community/memories?treeId=<treeId>`

**Active route**
- Cloudflare Pages `functions/api/[[path]].js`
- Modal `/modal/community/memories`

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

- frontend-only Plus lock으로 정책 완료를 선언하지 않습니다.
- public visibility를 browse 노출과 같은 의미로 표시하지 않습니다.
- Plus-required HTTP status/body shape를 확정 전제하고 UI 처리를 고정하지 않습니다.

---

## 7. 백엔드 원칙

### 7.1 직렬화기 사용 의무

모든 API 응답은 active Cloudflare/Modal runtime에서 flat camelCase contract를 유지해야 합니다.

### 7.2 visibility guard 원칙

- create tree 정책은 Cloudflare Pages Functions와 Modal에서 동기화해야 합니다.
- private 생성/전환 guard는 active backend에서 강제해야 합니다.
- canonical entitlement field는 `users/{uid}.privateStorageEnabled`입니다.
- compatibility entitlement fields의 장기 지원 여부는 별도 contract-needed 항목입니다.
- 기존 private tree grandfathering을 고려해야 합니다.
- browse display filter는 public visibility와 별도로 유지합니다.
- `netlify/functions/*`에 신규 visibility/private-storage 정책을 구현하지 않습니다.

---

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `functions/api/trees.js` | active `/api/trees` Cloudflare route-specific handler |
| `functions/api/memories.js` | active `/api/memories` Cloudflare route-specific handler |
| `functions/api/trees/[id].js` | active tree detail Cloudflare handler where applicable |
| `functions/api/[[path]].js` | active Cloudflare catch-all handler for recognized read/community routes |
| `modal_compute/app.py` | active Modal API/backend target |
| `js/my-trees/my-trees-actions.js` | My Trees create payload source |
| `js/utils/normalize.js` | 프론트 정규화 유틸 |
| `js/api/public-tree-adapter.js` | browse summary/hydrate adapter |
| `netlify/functions/*` | legacy artifact only, not current production backend |

---

## 9. 장기 TODO

### 9.1 public-first runtime drift watch

- Cloudflare/Modal create tree public-first 상태 유지
- API 계약 테스트 추가
- existing private tree 자동 public 전환 금지 유지

### 9.2 Plus private entitlement

- final entitlement source of truth 확정
- compatibility entitlement fields 장기 지원 여부 결정
- Plus-required status/body contract 확정
- frontend 안내와 API error 처리 동기화

### 9.3 browse 노출 조건 고정

- public visibility와 browseEligible 분리
- public memory 3개 이상 조건 유지 여부 최종 확인
- snapshot 계약에 browseEligibility metadata 포함 여부 검토

### 9.4 Netlify legacy transition

- tests/docs reference transition
- `netlify.toml` treatment decision
- archive decision after CTO approval

---

## 10. 위반 시 대응

| 위반 유형 | 대응 |
|-----------|------|
| 새 코드에 `{id, data}` 접근 | PR reject |
| active API 응답에 flat camelCase 계약 미준수 | PR reject |
| Cloudflare와 Modal visibility 정책 불일치 | PR reject |
| Plus private을 frontend-only로 잠금 | PR reject |
| 기존 private tree 자동 public 전환 | PR reject |
| public visibility를 browse 노출로 설명 | 정책 위반으로 수정 |
| Plus-required HTTP status/body shape를 독단 확정 | contract-needed로 되돌림 |
| 신규 backend policy를 `netlify/functions/*`에 구현 | PR reject unless Netlify runtime is explicitly reactivated |

---

**문서 유지보수:** API 응답 구조 또는 visibility 정책 변경 시 이 문서를 반드시 갱신할 것
