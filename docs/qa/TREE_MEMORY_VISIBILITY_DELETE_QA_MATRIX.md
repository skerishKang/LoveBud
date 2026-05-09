# Tree / Memory / Visibility / Delete QA Matrix

작성 기준: `main` commit `0ea7e18856f851daca25dd1101ab52f36cb85c2f`  
작업 유형: 문서 / 정책 / QA matrix only  
코드 수정: 없음

---

## 0. 전제

PR #32는 public-first + Plus private 방향을 문서상 정렬한 정책 PR이다.

현재 production 동작은 여전히 private-first다.

아직 구현되지 않은 항목:

- createTree public-first payload 전환
- private 생성/전환 Plus entitlement guard
- 결제/권한 판정 API
- Modal entitlement 검증
- 기존 private tree grandfathered 표시 UI
- public visibility / browse listing 실제 UX 분리 구현

따라서 이 문서는 코드 수정 전 QA와 정책 판단을 위한 기준 문서다.

---

## 1. 현재 구현 근거 요약

### 1.1 Tree API

관련 파일:

- `netlify/functions/trees.js`
- `netlify/functions/tree-detail.js`
- `netlify/functions/_lib/doc-store.js`
- `netlify/sql/001_initial_schema.sql`

현재 동작:

- `POST /api/trees`는 인증 필수다.
- create tree 기본 visibility는 `private`이다.
- `POST /api/trees`에서 `visibility: public` 요청은 409로 차단된다.
- `GET /api/trees`는 인증 사용자의 tree 목록을 반환한다.
- `GET /api/trees/:treeId`는 public tree는 접근 가능, private tree는 owner만 접근 가능하다.
- `PUT /api/trees/:treeId`는 owner만 title/visibility를 수정할 수 있다.
- private → public 전환은 public memory 3개 이상일 때만 허용된다.
- public → private 전환은 현재 Plus 권한 검증 없이 owner에게 허용된다.
- `DELETE /api/trees/:treeId`는 owner만 삭제 가능하다.

### 1.2 Memory API

관련 파일:

- `netlify/functions/memories.js`
- `netlify/functions/memory-detail.js`
- `netlify/functions/community-memories.js`
- `netlify/functions/_lib/doc-store.js`
- `netlify/sql/001_initial_schema.sql`

현재 동작:

- `POST /api/memories`는 인증 필수이며 target tree owner만 생성 가능하다.
- memory 기본 visibility는 `private`이다.
- `GET /api/memories`는 인증 사용자의 own tree memories만 반환한다.
- `GET /api/memories/:memoryId`는 public memory는 anonymous도 접근 가능하고 private memory는 owner만 접근 가능하다.
- `PATCH/PUT /api/memories/:memoryId`는 owner만 수정 가능하다.
- `DELETE /api/memories/:memoryId`는 owner만 삭제 가능하다.
- `GET /api/community/memories`는 public memories만 반환한다.

### 1.3 Delete / FK 정책

DB schema 기준:

- `memories.tree_id`는 `trees(id) ON DELETE CASCADE`이다.
- tree 삭제 시 해당 tree의 memories는 DB에서 함께 삭제된다.
- `memories.parent_id`는 `memories(id) ON DELETE SET NULL`이다.
- memory 삭제 시 child memory는 삭제되지 않고 `parent_id`가 null로 풀린다.

주의:

- hard delete 구조다.
- soft delete 필드는 현재 없다.
- tree delete 후 browse/detail/my-trees 잔여 표시 여부는 QA에서 검증해야 한다.

---

## 2. Tree 정책

### 2.1 신규 tree 기본 visibility

현재 구현:

- `private-first`
- create payload와 backend default 모두 private 기준

목표 정책:

- public-first로 전환 예정
- 단, createTree payload만 단독으로 public 변경 금지
- Netlify / Modal / frontend / entitlement 정책 동기화 후 별도 구현

### 2.2 기존 private tree grandfathering

확정:

- 기존 private tree는 자동 public 전환하지 않는다.
- grandfathered private으로 유지한다.
- production 데이터 visibility 일괄 변경 금지

QA 기준:

- 기존 private tree는 owner에게 보여야 한다.
- non-owner 또는 anonymous는 접근 불가여야 한다.
- browse에는 노출되면 안 된다.

### 2.3 public tree direct detail 접근 정책

현재 구현 기준:

- public tree는 direct detail API에서 접근 가능하다.
- owner가 아닌 사용자는 public memories만 받는다.
- owner는 해당 tree의 모든 memories를 받는다.

QA 기준:

- anonymous 또는 non-owner가 public tree detail에 접근하면 public memories만 보여야 한다.
- private memories가 섞이면 정책 위반이다.

### 2.4 browse 노출 조건

현재 구현:

- `/api/community/trees?view=summary`는 Modal 우선, fallback 시 Netlify summary logic 사용
- summary는 public tree 중 public memory 3개 이상인 tree만 반환한다.
- default community trees path는 public tree 목록을 반환할 수 있으므로 browse UI가 어떤 endpoint/view를 쓰는지 별도 확인 필요

목표 정책:

- public visibility와 browse listing은 분리한다.
- public tree라도 browse 조건 미달이면 browse summary에는 노출되지 않는다.

### 2.5 private tree owner-only 접근 정책

현재 구현:

- private tree detail은 owner만 접근 가능
- non-owner/anonymous는 403
- 없는 tree는 404

QA 기준:

- 존재하는 private tree에 anonymous/non-owner 접근 → 403
- 존재하지 않는 tree 접근 → 404
- owner 접근 → 200

### 2.6 deleted tree 접근 결과

현재 구현 후보:

- deleteTree는 hard delete
- 삭제 후 getTree 결과가 null이면 tree-detail GET은 404

QA 기준:

- 삭제 직후 `/api/trees/:treeId` → 404
- `/api/trees` 목록에서 사라져야 함
- browse summary에서 사라져야 함
- child memories는 cascade 삭제되어 직접 조회도 404가 되어야 함

---

## 3. Memory 정책

### 3.1 tree visibility와 memory visibility 관계

현재 구현:

- tree visibility와 memory visibility는 별도 필드다.
- public tree 안에도 private memory가 있을 수 있다.
- private tree 안에도 public memory가 technically 가능하지만 browse/detail 노출은 tree visibility와 endpoint 정책에 따라 제한된다.

정책 기준:

- public tree direct detail에서 non-owner에게는 public memory만 노출한다.
- owner editor/my tree flow에서는 private/public memories 모두 접근 가능하다.
- public memory가 있어도 tree가 private이면 browse tree summary 대상이 아니다.

### 3.2 public tree 안의 memory 노출 기준

- owner: 모든 memories 표시
- non-owner/anonymous: public memories만 표시
- browse hydrate: public memories만 표시

QA 기준:

- public tree에 private memory를 추가한 뒤 anonymous detail/hydrate에서 private memory가 빠지는지 확인

### 3.3 root memory / child memory 처리

현재 구조:

- root memory는 `parent_id IS NULL`로 표현된다.
- child memory는 `parent_id = <memoryId>`로 연결된다.
- API는 parentId를 null 또는 UUID로 받을 수 있다.

QA 기준:

- root memory 생성 후 parentId가 null인지 확인
- child memory 생성 후 parentId가 유지되는지 확인
- parent memory 삭제 후 child memory의 parentId가 null로 풀리는지 확인

### 3.4 공개 memory 3개 조건의 의미

현재 구현:

- tree private → public 전환 guard에서 `getPublicMemoryCount(treeId)`가 3 이상이어야 한다.
- browse summary fallback에서도 public memory count 3개 이상 조건을 사용한다.
- Modal browse latest도 public memory 3개 이상 조건을 사용한다.

정책상 미확정:

- public-first 전환 후에도 public 전환 자체에 3-public-memory guard를 유지할지
- 또는 3개 조건은 browse listing guard로만 남길지

권장 QA 분리:

- `visibility transition guard` 테스트
- `browse listing guard` 테스트

두 테스트를 같은 것으로 취급하지 않는다.

### 3.5 editor와 detail에서 memory 표시 차이

현재 기대:

- Editor: owner 작업 공간이므로 해당 tree의 모든 memories 표시
- Detail/public view: non-owner/anonymous는 public memories만 표시
- Browse hydrate: public memories만 표시

QA 기준:

- owner editor에서 private memory가 보이는지
- anonymous detail에서 private memory가 숨겨지는지
- browse hydrate에서 private memory가 빠지는지

### 3.6 parent-child 구조 보존 기준

- create/update 시 parentId가 UUID 또는 null로 저장되어야 한다.
- parent 삭제 시 child는 삭제되지 않고 root-level처럼 parentId null이 된다.
- tree 삭제 시 전체 memories가 cascade 삭제된다.

---

## 4. Visibility 변경 정책

### 4.1 private → public 조건

현재 구현:

- owner only
- public memory count 3개 이상 필요
- 미충족 시 409

목표 정책:

- public-first 전환 후 private → public은 grandfathered private 해제 또는 publish 성격
- 3개 조건은 browse listing guard로만 이동할지 CTO 결정 필요

### 4.2 public → private 조건

현재 구현:

- owner only
- Plus entitlement 검증 없음

목표 정책:

- Plus entitlement 필요
- entitlement source 확정 전 구현 보류

### 4.3 Plus entitlement source 미확정

미확정 항목:

- plan source of truth
- plan storage/provider
- free/Plus 판정 API
- 403 vs 402
- error code/body
- Modal entitlement verification boundary

### 4.4 public visibility와 browse listing 분리

확정:

- public visibility는 접근 가능 상태
- browse listing은 display/quality 조건
- public tree가 곧 browse 노출을 의미하지 않는다.

### 4.5 public 전환 guard와 browse 노출 guard 분리 여부

현재 구현:

- private → public guard와 browse summary guard가 모두 public memory 3개 조건을 사용한다.

목표 정책상 결정 필요:

- 3개 조건을 public 전환 자체에 계속 둘지
- public 전환은 허용하고, browse listing에만 3개 조건을 둘지

---

## 5. Delete 정책

### 5.1 tree 삭제 시 memories 처리

현재 구현:

- hard delete
- DB FK `ON DELETE CASCADE`
- tree 삭제 시 memories도 함께 삭제

QA 기준:

- 삭제 후 tree detail 404
- 삭제 후 memory detail 404
- my-trees 목록에서 제거
- browse summary/hydrate에서 제거

### 5.2 memory 삭제 시 child memory 처리

현재 구현:

- hard delete
- DB FK `parent_id ON DELETE SET NULL`
- child memory는 유지되고 parentId만 null이 된다.

QA 기준:

- parent 삭제 후 child memory가 남아 있는지 확인
- child parentId가 null로 바뀌는지 확인
- editor canvas에서 orphan/root-level 표시가 깨지지 않는지 별도 frontend QA 필요

### 5.3 hard delete / soft delete 여부

현재 구현:

- hard delete only
- deleted_at, archived_at, is_deleted 필드 없음

정책상 결정 필요:

- 장기적으로 soft delete가 필요한지
- QA 데이터 정리를 hard delete로 유지할지

### 5.4 삭제 후 my-trees / browse / detail 결과

- my-trees: 삭제된 tree가 목록에서 사라져야 함
- browse: public tree였다면 browse summary에서 사라져야 함
- detail: 삭제된 tree/memory 직접 접근은 404
- editor: 삭제된 treeId로 접근하면 not found/error state

### 5.5 QA tree 삭제 후 잔여 데이터 검증

권장:

- QA용 tree title prefix 사용: `[QA] visibility-delete <timestamp>`
- QA 종료 시 tree delete API 호출
- 삭제 후 `/api/trees` 목록 확인
- 삭제 전 저장한 memoryId 직접 조회 404 확인
- browse summary에서 title/id 미노출 확인

### 5.6 삭제 실패 시 보고 기준

삭제 실패는 다음 기준으로 보고한다.

- API status
- request user / owner 여부
- target treeId / memoryId
- expected delete behavior
- observed remaining rows or UI artifacts
- cleanup 가능 여부
- production data 영향 여부

---

## 6. QA Matrix

| # | 기능 | 현재 구현 파일 | 호출 API | 주요 payload | 기대 동작 | 실제 확인 필요 사항 | 정책 충돌 여부 | 수정 필요 후보 | production QA 가능 여부 | 테스트 데이터 정리 방법 | 완료/미완료 판단 기준 |
|---|------|----------------|----------|--------------|-----------|----------------------|----------------|----------------|--------------------------|-------------------------|------------------------|
| 1 | Create tree | `pages/my-trees.html`, `js/my-trees/my-trees-actions.js`, `netlify/functions/trees.js`, `doc-store.js` | `POST /api/trees` | `{ title, visibility: 'private' }` 현재 기준 | 인증 사용자만 생성. 현재는 private 생성. public 요청은 409 | 생성된 tree visibility가 private인지. public payload가 409인지. Modal path와 불일치 없는지 | 목표 정책은 public-first라 현재 구현과 의도 정책이 다름 | public-first 전환 시 frontend/backend/Modal 동시 수정 | 가능. QA prefix title 사용 | QA 종료 시 Delete QA tree 수행 | tree 생성 201, `/api/trees` 목록 노출, visibility 확인 |
| 2 | Read tree | `netlify/functions/tree-detail.js`, `doc-store.js`, `serializers.js` | `GET /api/trees/:treeId` | path `treeId` | public tree는 접근 가능, private tree는 owner-only, missing은 404 | owner/non-owner/anonymous별 200/403/404 확인. public tree의 private memory 숨김 확인 | public-first 후에도 owner/private access 정책 유지 필요 | 403/404 정책 명문화, public detail UI QA | 가능. 단 계정 2개 또는 anonymous 필요 | QA tree 삭제 | expected status와 returned memories scope 일치 |
| 3 | Update tree title | `netlify/functions/tree-detail.js`, `doc-store.js` | `PUT /api/trees/:treeId` | `{ title }` | owner만 title 수정. non-owner는 403. missing은 404 | title trim/empty fallback, updatedAt 반영, my-trees/editor 반영 | 정책 충돌 낮음 | empty title 처리 UX/API 명확화 후보 | 가능 | QA tree 삭제 | owner update 200, non-owner 403, title 반영 |
| 4 | Toggle visibility | `js/editor.js`, `js/my-trees/my-trees-actions.js`, `netlify/functions/tree-detail.js` | `PUT /api/trees/:treeId` | `{ visibility: 'public' }` 또는 `{ visibility: 'private' }` | 현재 private→public은 public memory 3개 이상 필요. public→private은 owner 허용 | 0/1/2 public memories에서 409, 3개에서 200. public→private이 현재 허용되는지 확인 | 목표 정책은 public→private Plus 필요. public 전환 guard 위치 미확정 | entitlement guard, 3-memory guard 재배치, badge copy | 가능하나 공개 노출 주의. QA title 사용 | QA tree 삭제 | status와 visibility 최종값 일치, browse 노출과 구분 확인 |
| 5 | Create memory | `js/editor.js`, `netlify/functions/memories.js`, `doc-store.js` | `POST /api/memories` | `{ treeId, parentId?, title, memo, visibility }` | owner만 생성. 기본 visibility private. parentId null/UUID 허용 | root/child 생성, visibility default, target tree ownership 검증 | public-first 후 memory default visibility 정책 결정 필요 | memory default public/private 재검토, editor UX copy | 가능 | QA tree 삭제로 cascade cleanup | memory 201, treeId/parentId/visibility 저장 확인 |
| 6 | Read memories | `netlify/functions/memories.js`, `memory-detail.js`, `community-memories.js` | `GET /api/memories?treeId=...`, `GET /api/memories/:id`, `GET /api/community/memories?treeId=...` | query/path | owner list는 own memories. public memory direct read는 anonymous 가능. community는 public only | owner/private/public/anonymous별 visibility filter 확인 | tree visibility와 memory visibility 관계가 UX에 복잡함 | public detail/browse adapter QA 강화 | 가능 | QA tree 삭제 | private memory가 public endpoint에 나오지 않음 |
| 7 | Update memory | `netlify/functions/memory-detail.js`, `doc-store.js` | `PATCH /api/memories/:memoryId` | allowed fields: title, memo, visibility, parentId 등 | owner만 수정. visibility/parentId 수정 허용 | parentId 변경, visibility 변경, invalid field ignored 여부, non-owner 403 | Plus private 정책 도입 시 memory private 전환도 잠글지 미확정 | memory-level entitlement 정책 필요 | 가능 | QA tree 삭제 | allowed field만 반영, owner-only 유지 |
| 8 | Delete memory | `netlify/functions/memory-detail.js`, `doc-store.js`, schema FK | `DELETE /api/memories/:memoryId` | path `memoryId` | owner만 hard delete. child memory는 parentId null로 유지 | parent 삭제 후 child 유지/parentId null. deleted memory direct read 404 | soft delete 필요 여부 미확정 | orphan/root UI QA, soft delete 검토 | 가능 | QA tree 삭제 | DELETE 204, deleted read 404, child 유지 확인 |
| 9 | Delete QA tree | `netlify/functions/tree-detail.js`, `doc-store.js`, schema FK | `DELETE /api/trees/:treeId` | path `treeId` | owner만 hard delete. memories cascade delete | my-trees 제거, tree detail 404, memory detail 404, browse 제거 | production QA cleanup의 핵심 | QA cleanup script/checklist 후보 | 가능하나 반드시 QA prefix 사용 | 이 기능 자체가 cleanup | tree/memory/browse 잔여 없음 |

---

## 7. Production QA 운영 원칙

### 7.1 QA 데이터 네이밍

권장 title:

```text
[QA] tree-memory-visibility-delete <YYYYMMDD-HHmm>
```

Memory title prefix:

```text
[QA] root public 1
[QA] child private 1
```

### 7.2 QA 최소 데이터 세트

권장 tree 1개:

- root memory 1개 public
- child memory 1개 public
- child memory 1개 private
- 추가 public memory 2개

목적:

- public memory 3개 조건 검증
- private memory 숨김 검증
- parent-child 삭제 검증
- tree delete cascade 검증

### 7.3 Production QA 가능 조건

가능:

- QA prefix tree를 생성하고 바로 삭제하는 제한적 검증
- owner 계정 기준 create/read/update/delete
- anonymous public read 검증

주의:

- public 전환 후 browse에 일시 노출될 수 있으므로 QA title prefix 필수
- 삭제 실패 시 추가 수동 정리 필요
- 실제 팬 콘텐츠와 혼동되는 제목 금지

---

## 8. 완료 / 미완료 기준

### 완료 기준

- 9개 기능별 expected behavior가 현재 구현 기준으로 검증 가능하다.
- public-first 목표 정책과 현재 private-first 구현의 차이가 표시되어 있다.
- Delete cleanup 경로가 명확하다.
- QA tree 삭제 후 tree/memory/browse 잔여 데이터가 없다.
- public visibility와 browse listing이 별도 검증 항목으로 분리되어 있다.

### 미완료 기준

- createTree payload만 public으로 바꾸는 제안이 남아 있다.
- private tree grandfathering이 빠져 있다.
- public 전환 guard와 browse listing guard가 혼동되어 있다.
- delete 후 child memory / cascade behavior가 검증되지 않았다.
- Plus entitlement 미확정 항목이 구현 완료처럼 서술되어 있다.

---

## 9. CTO decision-needed

1. public-first 전환 후 create tree default visibility 확정 시점
2. memory default visibility도 public-first로 맞출지 여부
3. private tree와 private memory 모두 Plus entitlement 대상인지 여부
4. public 전환 자체에 public memory 3개 guard를 유지할지 여부
5. 3개 조건을 browse listing guard로만 둘지 여부
6. Plus entitlement source of truth
7. 403 vs 402 status
8. error code/body shape
9. soft delete 도입 여부
10. grandfathered private tree의 UI 표시 방식
11. Modal entitlement verification boundary

---

## 10. 이후 작업 분리안

### Frontend PR 후보

- My Trees create modal public-first copy/IA
- Editor visibility badge 상태 분리
- public visibility vs browse listing 안내
- delete QA / confirm copy 보강
- Plus private 안내 UX

### Backend PR 후보

- public-first create tree API 전환
- toggle visibility entitlement guard
- memory visibility entitlement guard 여부 반영
- 3-memory guard 위치 재정의
- API error contract 추가

### Modal PR 후보

- Modal create tree policy 동기화
- Modal private endpoint entitlement boundary 정의
- browse latest/growing filter 유지 확인

### QA PR 후보

- production QA checklist 문서화
- API smoke script 또는 manual checklist 추가
- QA cleanup procedure 추가

---

## 11. 코드 수정 착수 가능 여부

현재 단계에서는 코드 수정 착수 불가다.

이 문서는 QA/policy matrix이며, 실제 public-first 구현 전 다음 결정이 필요하다.

- entitlement source
- create/toggle visibility API 정책
- public transition guard와 browse listing guard 분리 방식
- delete/soft delete 정책
- frontend UX copy와 status model

코드 수정은 CTO가 이 matrix를 승인한 뒤 frontend/backend/Modal로 분리한다.
