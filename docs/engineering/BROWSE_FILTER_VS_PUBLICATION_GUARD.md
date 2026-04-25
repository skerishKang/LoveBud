# Browse Display Filter vs. Publication Guard

LoveBud의 공개 정책은 **visibility/access policy**와 **Browse/Search introduction eligibility**를 분리해 관리합니다.

이 문서는 아래 개념을 혼동하지 않기 위해 작성합니다.

- **Visibility / Access Policy**: tree 또는 memory가 public/private 중 어떤 공개 상태를 갖는지, 누가 읽을 수 있는지, private storage가 Plus entitlement를 요구하는지 결정하는 server-side hard policy
- **Browse/Search Introduction Eligibility**: 이미 public인 tree 중 무엇을 Browse/Search 화면에서 소개할 수 있는지 결정하는 read-path eligibility policy
- **Browse Display Filter**: eligible tree를 어떤 정렬, summary, quality 기준으로 보여줄지 정하는 read-path display filter

핵심 원칙:

```text
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

### 1.3 Memory visibility inheritance

Memory visibility가 payload에서 생략되면 parent tree visibility를 상속합니다.

```text
parent tree visibility = public
memory visibility omitted
=> effective memory visibility = public
```

```text
parent tree visibility = private
memory visibility omitted
=> effective memory visibility = private
```

명시적 memory visibility는 backend policy가 허용하는 경우에만 상속값을 override할 수 있습니다. 이 override는 parent tree access policy 또는 Plus private storage guard를 우회하지 못합니다.

### 1.4 Browse/Search introduction requires publicMomentCount >= 3

Browse/Search 소개 조건은 visibility 저장 조건과 다릅니다.

Browse/Search introduction의 canonical minimum condition:

```text
parent tree visibility === 'public'
AND publicMomentCount >= 3
AND browse/search display guard passes
```

따라서 public tree라도 `publicMomentCount < 3`이면 직접 공개 접근은 가능할 수 있지만 Browse/Search 소개 대상은 아닙니다.

### 1.5 Private parent tree remains a browse/search blocker

private tree 아래에 public memory가 가능한 정책/구현이 있더라도, child memory visibility만으로 Browse/Search 노출을 허용하지 않습니다.

Browse/Search 노출은 반드시 함께 확인합니다.

```text
parent tree visibility
AND publicMomentCount
AND browse/search guard
```

parent tree가 private이면 public child memory가 있더라도 Browse/Search introduction 대상이 아닙니다.

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
- memory effective visibility 결정
- private tree/storage Plus entitlement 검증
- public/private read access 검증
- existing private tree grandfathering 처리

정책 기준:

- 신규 tree는 public default
- private storage는 Plus entitlement 필요
- memory visibility omitted 시 parent tree visibility 상속
- explicit memory visibility override는 backend policy가 허용한 경우에만 가능
- 기존 private tree는 자동 public 전환하지 않음

Visibility / Access Policy가 하지 않는 것:

- Browse/Search에 소개할 카드 개수 또는 정렬 결정
- public tree가 충분히 자랐는지 판단
- Browse/Search summary quality 보정

---

## 4. Browse/Search Introduction Eligibility

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

---

## 5. Browse Display Filter

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

---

## 6. Correct examples

### Example A: public tree, 2 public moments

```text
tree.visibility = public
publicMomentCount = 2
```

결과:

```text
public read 가능 후보
Browse/Search introduction 불가
```

### Example B: public tree, 3 public moments

```text
tree.visibility = public
publicMomentCount = 3
```

결과:

```text
public read 가능 후보
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
parent tree가 private이므로 Browse/Search introduction 불가
```

child memory visibility만으로 parent tree browse/search eligibility를 만들 수 없습니다.

### Example D: memory visibility omitted

```text
tree.visibility = public
memory visibility omitted
```

결과:

```text
memory effective visibility = public
```

```text
tree.visibility = private
memory visibility omitted
```

결과:

```text
memory effective visibility = private
```

---

## 7. Documentation guardrails

금지할 설명:

- "public tree는 항상 Browse/Search에 노출된다"
- "3개 이상 공개 순간은 public 전환 조건이다"
- "publicMomentCount는 visibility guard다"
- "private tree 아래 public memory가 있으면 browse에 소개할 수 있다"
- "memory visibility 생략은 항상 public이다"
- "private storage는 frontend UI lock만으로 충분하다"
- "브라우저가 Netlify API를 직접 호출한다"

정확한 설명:

- 신규 tree의 정책상 기본 visibility는 public이다.
- private storage는 Plus entitlement가 필요하다.
- memory visibility 생략 시 parent tree visibility를 상속한다.
- explicit memory visibility override는 backend policy가 허용할 때만 가능하다.
- public visibility와 Browse/Search introduction eligibility는 별개다.
- Browse/Search introduction은 `publicMomentCount >= 3`이 필요하다.
- private parent tree는 public child memory가 있어도 Browse/Search introduction 대상이 아니다.
- 브라우저는 same-origin `/api/*`를 호출한다.

---

## 8. One-line summary

```text
Visibility decides who can access a tree or memory; Browse/Search eligibility decides whether a public tree is mature enough to be introduced.
```
