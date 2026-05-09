# Browse Display Filter vs. Publication Guard

LoveBud의 공개 정책은 **visibility/access policy**, **stored memory visibility**, **anonymous public exposure**, **Browse/Search introduction eligibility**를 분리해 관리합니다.

이 문서는 아래 개념을 혼동하지 않기 위해 작성합니다.

- **Stored Visibility**: tree 또는 memory row에 저장되는 visibility 값
- **Visibility / Access Policy**: 누가 tree 또는 memory를 읽을 수 있는지, private storage가 Plus entitlement를 요구하는지 결정하는 server-side hard policy
- **Anonymous Public Exposure**: 비로그인/anonymous public read path에서 실제로 외부에 노출 가능한지 결정하는 public read guard
- **Browse/Search Introduction Eligibility**: 이미 public exposure 가능한 tree 중 무엇을 Browse/Search 화면에서 소개할 수 있는지 결정하는 read-path eligibility policy
- **Browse Display Filter**: eligible tree를 어떤 정렬, summary, quality 기준으로 보여줄지 정하는 read-path display filter

핵심 원칙:

```text
stored memory visibility != anonymous public exposure
public visibility != Browse/Search eligibility
```

---

## 1. Canonical policy

### 1.1 New trees default to public

정책상 신규 tree의 기본 visibility는 `public`입니다.

단, 이 정책은 frontend payload만 단독으로 바꿔 구현하지 않습니다. create tree API, backend/runtime guard, private storage entitlement, 기존 private tree grandfathering을 함께 정렬해야 합니다.

### 1.2 Private storage requires Plus entitlement

다음 동작은 Plus entitlement가 필요합니다.

- private tree 생성
- public tree를 private으로 전환
- 신규 private memory/storage 사용

canonical entitlement field:

```text
users/{uid}.privateStorageEnabled
```

### 1.3 Memory visibility inheritance and explicit override

Memory visibility가 payload에서 생략되면 parent tree visibility를 상속합니다.

```text
parent tree visibility = public
memory visibility omitted
=> stored/effective memory visibility = public
```

```text
parent tree visibility = private
memory visibility omitted
=> stored/effective memory visibility = private
```

명시적 memory visibility는 backend policy가 허용하는 경우에만 상속값을 override할 수 있습니다. backend policy가 허용하면 private tree 아래에 explicit public memory가 저장될 수 있습니다.

그러나 stored memory visibility와 anonymous public exposure는 별개입니다.

Canonical 문구:

```text
Stored memory visibility and anonymous public exposure are separate. A memory may be stored as public under a private tree when backend policy allows it, but anonymous public read paths must require both memory.visibility = public and parent tree.visibility = public.
```

### 1.4 Anonymous public read requires parent tree public visibility

Anonymous public read path는 다음을 모두 요구해야 합니다.

```text
memory.visibility === 'public'
AND parentTree.visibility === 'public'
```

따라서 `memory.visibility = public` alone은 anonymous public read에 충분하지 않습니다.

parent tree visibility guard가 필요한 경로:

- Browse/Search introduction
- community memories list
- public memory detail read

Owner/private read path는 기존 private access policy를 따릅니다. owner는 private tree 아래 public/private memory를 조회할 수 있습니다.

### 1.5 Browse/Search introduction requires publicMomentCount >= 3

Browse/Search 소개 조건은 visibility 저장 조건과 다릅니다.

Browse/Search introduction의 canonical minimum condition:

```text
parent tree visibility === 'public'
AND publicMomentCount >= 3
AND browse/search display guard passes
```

따라서 public tree라도 `publicMomentCount < 3`이면 직접 공개 접근은 가능할 수 있지만 Browse/Search 소개 대상은 아닙니다.

---

## 2. Current browse read path

현재 browse 페이지의 클라이언트는 외부 호스트를 직접 호출하지 않습니다.

- `js/search.js`
  - browse 리스트는 `window.apiClient.getPublicTrees({ view: 'summary', sort, limit })`로 로드
  - 카드 선택 후 preview hydrate는 `window.apiClient.getPublicTreePreview(tree)`로 로드
- `js/postgres-client.js`
  - browse summary list는 `/community/trees`
  - preview hydrate는 `/community/memories`
- `js/api/base-api-fetch.js`
  - 실제 fetch는 항상 same-origin `/api/*` 형태로 호출

브라우저 기준 browse read path:

```text
search.js
→ window.apiClient.getPublicTrees()
→ /api/community/trees?view=summary&sort=...&limit=...
```

preview hydrate path:

```text
search.js
→ window.apiClient.getPublicTreePreview(tree)
→ /api/community/memories?treeId=...
```

중요:

- 브라우저가 Netlify API를 직접 호출한다고 설명하지 않습니다.
- 브라우저는 same-origin `/api/*` contract를 기준으로 동작합니다.
- Cloudflare Pages Functions / Modal / legacy fallback 여부는 runtime 계층에서 관리합니다.

---

## 3. Visibility / Access Policy

Visibility / Access Policy는 Browse card 품질 필터가 아니라 server-side policy입니다.

역할:

- tree visibility 저장값 결정
- memory stored/effective visibility 결정
- explicit memory visibility override 허용 여부 결정
- private tree/storage Plus entitlement 검증
- public/private read access 검증
- anonymous public exposure guard 적용
- existing private tree grandfathering 처리

정책 기준:

- 신규 tree는 public default
- private storage는 Plus entitlement 필요
- memory visibility omitted 시 parent tree visibility 상속
- explicit memory visibility override는 backend policy가 허용한 경우에만 가능
- explicit public memory가 private tree 아래 저장될 수 있어도 anonymous public exposure는 parent tree public 여부를 함께 확인
- 기존 private tree는 자동 public 전환하지 않음

Visibility / Access Policy가 하지 않는 것:

- Browse/Search에 소개할 카드 개수 또는 정렬 결정
- public tree가 충분히 자랐는지 판단
- Browse/Search summary quality 보정

---

## 4. Anonymous Public Exposure Guard

Anonymous Public Exposure Guard는 비로그인/anonymous public read path에서 memory 또는 tree가 외부 사용자에게 실제로 노출될 수 있는지 결정합니다.

memory anonymous public read 조건:

```text
canAnonymousReadMemory(memory, parentTree) =
  memory.visibility === 'public'
  && parentTree.visibility === 'public'
```

경로별 적용:

| 경로 | parent tree visibility guard |
|------|------------------------------|
| Browse/Search introduction | 필요 |
| community memories list | 필요 |
| public memory detail read | 필요 |

중요:

- private tree 아래 explicit public memory는 저장될 수 있습니다.
- 그러나 parent tree가 private이면 anonymous public read에서 노출하지 않습니다.
- `memory.visibility = public` alone은 anonymous public read 조건이 아닙니다.
- owner/private read는 이 guard와 별개로 기존 private access policy를 따릅니다.

---

## 5. Browse/Search Introduction Eligibility

Browse/Search Introduction Eligibility는 public tree 중 Browse/Search에서 소개할 수 있는 tree를 고릅니다.

역할:

- public tree 중 Browse/Search 소개 가능한 tree 선별
- publicMomentCount 기준 적용
- private parent tree 차단
- 감상 허브 품질 기준 유지

canonical 조건:

```text
isBrowseSearchEligible(tree) =
  tree.visibility === 'public'
  && tree.publicMomentCount >= 3
  && passesBrowseSearchGuard(tree)
```

중요:

- `publicMomentCount >= 3`은 Browse/Search introduction eligibility입니다.
- 이 기준을 public visibility 전환 guard로 재사용하지 않습니다.
- public visibility와 Browse/Search introduction은 사용자-facing copy에서도 분리합니다.
- private tree 아래 public memory가 있더라도 parent tree가 private이면 Browse/Search introduction 대상이 아닙니다.

---

## 6. Browse Display Filter

Browse Display Filter는 eligible tree를 어떻게 보여줄지 정하는 read-path 품질 계층입니다.

역할:

- Browse/Search에서 어떤 공개 tree를 먼저 보여줄지 결정
- summary card에 필요한 최소 정보만 빠르게 공급
- representative thumbnail, emotion tags, memoryCount 같은 browse summary 필드 보정
- Browse 첫 화면을 게시판/검색엔진이 아니라 감상 허브처럼 유지

Display Filter는 다음을 결정하지 않습니다.

- tree가 public/private 중 무엇인지
- private storage를 사용할 수 있는지
- private tree owner가 누구인지
- memory visibility inheritance가 어떻게 계산되는지
- anonymous public read에서 parent tree visibility를 생략해도 되는지

---

## 7. Correct examples

### Example A: public tree, 2 public moments

```text
tree.visibility = public
publicMomentCount = 2
```

결과:

```text
anonymous public read 가능 후보
Browse/Search introduction 불가
```

### Example B: public tree, 3 public moments

```text
tree.visibility = public
publicMomentCount = 3
```

결과:

```text
anonymous public read 가능 후보
Browse/Search introduction 가능 후보
```

단, display guard 또는 quality filter를 통과해야 실제 노출됩니다.

### Example C: private tree, public child memory exists

```text
tree.visibility = private
child memory visibility = public
publicMomentCount >= 3
```

결과:

```text
stored child memory visibility는 public일 수 있음
anonymous community memories list 노출 불가
anonymous public memory detail read 불가
Browse/Search introduction 불가
owner/private read 가능
```

child memory visibility만으로 anonymous public exposure 또는 parent tree browse/search eligibility를 만들 수 없습니다.

### Example D: memory visibility omitted

```text
tree.visibility = public
memory visibility omitted
```

결과:

```text
memory stored/effective visibility = public
```

```text
tree.visibility = private
memory visibility omitted
```

결과:

```text
memory stored/effective visibility = private
```

---

## 8. Documentation guardrails

금지할 설명:

- "public tree는 항상 Browse/Search에 노출된다"
- "3개 이상 공개 순간은 public 전환 조건이다"
- "publicMomentCount는 visibility guard다"
- "private tree 아래 public memory가 있으면 browse에 소개할 수 있다"
- "private tree 아래 public memory가 있으면 community memories list에 anonymous 노출할 수 있다"
- "memory.visibility = public이면 anonymous public detail read가 가능하다"
- "memory visibility 생략은 항상 public이다"
- "private storage는 frontend UI lock만으로 충분하다"
- "브라우저가 Netlify API를 직접 호출한다"

정확한 설명:

- 신규 tree의 정책상 기본 visibility는 public이다.
- private storage는 Plus entitlement가 필요하다.
- memory visibility 생략 시 parent tree visibility를 상속한다.
- explicit memory visibility override는 backend policy가 허용할 때만 가능하다.
- private tree 아래 explicit public memory는 저장될 수 있다.
- stored memory visibility와 anonymous public exposure는 별개다.
- anonymous public read는 `memory.visibility = public`과 `parent tree.visibility = public`을 모두 요구한다.
- Browse/Search introduction은 `publicMomentCount >= 3`이 필요하다.
- parent tree가 private이면 public child memory가 있어도 Browse/Search, community memories list, public memory detail read에 anonymous 노출하지 않는다.
- owner/private read는 private access policy에 따라 private tree 아래 public/private memory를 조회할 수 있다.
- 브라우저는 same-origin `/api/*`를 호출한다.

---

## 9. One-line summary

```text
Stored visibility decides what is saved; anonymous public exposure decides what public readers can see; Browse/Search eligibility decides whether a public tree is mature enough to be introduced.
```
