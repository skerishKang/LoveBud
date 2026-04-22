# Browse Display Filter vs. Publication Guard

LoveBud의 browse 노출 정책은 **same-origin browse read path**와 **server-side publication guard**를 서로 다른 책임으로 분리해 관리합니다.

이 문서는 아래 두 개념을 혼동하지 않기 위해 작성합니다.

- **Browse Display Filter**: 공개된 트리 중 무엇을 browse에서 먼저, 어떤 품질 기준으로 보여줄지 정하는 read-path 품질 필터
- **Publication Guard**: 트리를 공개 상태로 만들 수 있는지, 비공개 데이터를 읽을 수 있는지 정하는 server-side 보안/정책 가드

---

## 1. 현재 browse read path (main 기준)

현재 browse 페이지의 클라이언트는 외부 호스트를 직접 호출하지 않습니다.

- `js/search.js`
  - browse 리스트는 `window.apiClient.getPublicTrees({ view: 'summary', sort: 'latest', limit: 3 })`로 로드
  - 카드 선택 후 preview hydrate는 `window.apiClient.getPublicTreePreview(tree)`로 로드
- `js/postgres-client.js`
  - browse summary list는 `/community/trees`
  - preview hydrate는 `/community/memories`
- `js/api/base-api-fetch.js`
  - 실제 fetch는 항상 `fetch(`/api${endpoint}`)` 형태의 **same-origin `/api`** 호출

즉, 브라우저 기준 browse read path는 아래와 같습니다.

### summary list
`search.js` → `window.apiClient.getPublicTrees()` → `/api/community/trees?view=summary&sort=latest&limit=3`

### preview hydrate
`search.js` → `window.apiClient.getPublicTreePreview()` → `/api/community/memories?treeId=...`

중요:
- **오래된 Netlify 직접 호출 설명은 더 이상 현재 main 설명이 아닙니다.**
- 클라이언트는 `lovebud.vercel.app` 같은 현재 origin 안에서 `/api/...`만 호출합니다.

---

## 2. Modal > Vercel > Netlify 우선순위가 browse에서 실제로 어떻게 적용되는가

계층 자체는 `Modal > Vercel > Netlify`가 맞지만, browse의 모든 read path가 동일한 우선순위를 쓰는 것은 아닙니다.

### 2.1 browse summary list (`/api/community/trees?view=summary`)
위치: `api/community/trees.js`

현재 main 구현:
1. **Vercel same-origin API**가 요청을 받음
2. `view=summary`이면 **Modal** `/modal/browse/latest`를 먼저 호출
3. Modal 데이터가 있으면 그대로 반환
4. Modal 실패 또는 빈 응답이면 **Netlify** `/community/trees?...`로 fallback

즉, summary browse list의 실제 우선순위는:

**브라우저 → Vercel `/api/community/trees` → Modal 우선 → Netlify fallback**

### 2.2 preview hydrate (`/api/community/memories`)
위치: `api/community/memories.js`

현재 main 구현:
1. **Vercel same-origin API**가 요청을 받음
2. `treeId`가 있으면 **Modal** `/modal/browse/latest`를 먼저 조회
3. 해당 treeId에 맞는 representative preview memory를 만들 수 있으면 바로 반환
4. Modal preview를 만들 수 없으면 **Netlify** `/community/memories?...`로 fallback
5. treeId preview 경로에서 upstream 오류가 나면 degraded preview(`[]`)를 반환할 수 있음

즉, preview hydrate의 현재 우선순위는:

**브라우저 → Vercel `/api/community/memories` → Modal representative preview 우선 → Netlify fallback**

중요:
- browse 전체를 한 줄로 `Modal > Vercel > Netlify`라고만 쓰면 과장될 수 있습니다.
- **summary list와 preview hydrate 모두 Modal 우선 시도를 가지지만, 방식은 다릅니다.**
- summary list는 Modal browse list를 직접 사용하고,
- preview hydrate는 Modal summary에서 representative preview를 구성한 뒤 fallback 합니다.

---

## 3. Publication Guard (보안/정책 계층)

Publication Guard는 browse 카드 품질 필터가 아니라 **server-side policy**입니다.

### 3.1 read guard
위치: `netlify/functions/tree-detail.js`

- 공개 트리는 누구나 읽을 수 있음
- 비공개 트리는 owner만 읽을 수 있음
- 비공개 트리의 memories도 owner가 아니면 읽을 수 없음

즉, visibility 자체는 server-side에서 강제됩니다.

### 3.2 write/publication guard
위치:
- `netlify/functions/trees.js` POST
- `netlify/functions/tree-detail.js` PUT

현재 main 구현:
- 새 트리를 처음부터 `public`으로 만드는 것은 차단됨
- 비공개 트리를 공개로 전환할 때는 **공개 순간(public memories) 3개 이상**이 필요함

즉, `3개 이상 공개 순간` 규칙은 browse 카드 정렬용 힌트가 아니라 **공개 전환 정책 가드**입니다.

---

## 4. Browse Display Filter (read-path 품질 계층)

Browse Display Filter는 공개 가능 여부를 결정하지 않습니다.

역할은 아래와 같습니다.

- browse에서 어떤 공개 트리를 먼저 보여줄지 결정
- summary 카드에 필요한 최소 정보만 빠르게 공급
- representative thumbnail, emotion tags, memoryCount 같은 browse summary 품질을 보정
- browse 첫 화면을 감상 허브처럼 유지

현재 main 기준 browse display filter는 아래 두 층에서 작동합니다.

1. **Modal summary browse query**
   - `view=summary` 경로에서 browse 후보를 먼저 정제
2. **Vercel adapter / client summary enrichment**
   - `api/community/trees.js`와 `js/postgres-client.js` summary adapter에서 browse 카드용 필드를 정리

중요:
- Display Filter는 **browse에 무엇을 보여줄지** 결정합니다.
- Publication Guard는 **무엇을 공개 상태로 만들 수 있는지 / 누가 읽을 수 있는지**를 결정합니다.
- 둘은 서로 대체하지 않습니다.

---

## 5. 운영/문서 작성 시 금지할 설명

아래 설명은 현재 main 기준으로 부정확합니다.

- "브라우저가 Netlify API를 직접 호출한다"
- "browse 전체가 Modal 직통 read path다"
- "3개 이상 규칙은 browse 화면 display filter일 뿐이다"
- "publication guard는 아직 없다"
- "preview hydrate는 Vercel → Netlify만 탄다"

현재 main 기준 더 정확한 설명은 아래입니다.

- browse 클라이언트는 **same-origin `/api`**만 호출한다
- summary browse list는 **Modal 우선, Netlify fallback**이다
- preview hydrate는 **Modal representative preview 우선, Netlify fallback**이다
- `3개 이상 공개 순간`은 **publication guard**이며 browse display filter와 별개다

---

## 6. 한 줄 요약

- **Browse Display Filter**: browse read-path 품질과 카드 정제를 담당하는 soft filter
- **Publication Guard**: 공개 가능 여부와 읽기 권한을 강제하는 server-side hard guard
- **same-origin browse 구조**: 브라우저는 직접 Netlify를 호출하지 않고, 항상 Vercel `/api`를 통해 읽는다
