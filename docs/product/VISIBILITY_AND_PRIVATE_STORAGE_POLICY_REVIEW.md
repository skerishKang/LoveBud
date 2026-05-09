# Visibility and Private Storage Policy Review

작성 기준: GitHub `main` commit `b78bf17ded7882b95c3cf18f7d8b2af953c169dc`  
작업 유형: 문서/설계 only  
코드 수정: 없음

---

## 1. 현재 문서 정책

`docs/product/PUBLICATION_AND_PRIVACY_UX_POLICY.md`는 현재 `private-first` 정책을 전제로 한다.

- 새 트리는 처음부터 `public`으로 생성하지 않는다.
- 공개 전환은 공개 순간 3개 이상이 된 뒤 가능해야 한다.
- 생성 단계에서는 public/private 선택 부담을 주지 않는다.
- 기본 흐름은 `둘러보기에 소개될 트리로 키우기`이다.
- 프라이빗 보관은 향후 Plus 또는 유료 혜택 가능성만 언급한다.
- 생성 payload는 항상 `visibility: private`으로 보내는 것이 현재 UX와 backend 정책에 맞는다고 설명한다.

결론: 현재 문서상 새 트리는 `private` 시작이다.

---

## 2. 현재 코드 동작

### My Trees 생성

검토 파일:

- `pages/my-trees.html`
- `js/my-trees/my-trees-actions.js`
- `js/i18n/i18n-my-trees.js`

현재 생성 모달은 공개/비공개 라디오가 아니라 `시작 목표` 카드 중심이다.

`js/my-trees/my-trees-actions.js` 기준 동작:

- submit 결과는 `{ title: nextTitle, visibility: 'private' }`이다.
- `getDefaultVisibility()`는 테스트 공개 모드가 있어도 `private`을 반환한다.
- `createNewTree()`는 `window.apiClient.createTree({ title: modalResult.title, visibility: 'private' })`를 호출한다.
- fallback demo tree도 `visibility: 'private'`이다.

결론: 현재 코드상 createTree payload는 `private`으로 고정되어 있다.

### Settings

검토 파일:

- `pages/settings.html`
- `js/settings.js`
- `js/i18n/i18n-shared.js`

현재 Settings는 기본 공개 범위 라디오를 제공하지 않는다.

- 중심 카드는 `둘러보기 소개`이다.
- `좋아하는 순간을 3개 이상 남기면 이 트리를 둘러보기에 소개할 수 있어요`라고 설명한다.
- `프라이빗 보관`은 `Plus에서 준비 중`인 보조 카드다.
- `DEFAULT_SETTINGS.defaultVisibility = 'private'`는 남아 있지만 실제 설정 UI로 노출되지는 않는다.

### Editor

검토 파일:

- `pages/editor.html`
- `js/editor.js`
- `js/editor/*`
- `js/i18n/i18n-editor.js`

현재 Editor는 트리 visibility를 상태 badge와 버튼으로 표시한다.

- `sidebarTreeVisibility` 초기 markup은 `비공개 러브트리` / `is-private`이다.
- `sidebarVisibilityToggleBtn`은 public/private 전환 버튼이다.
- `updateTreeVisibility(nextVisibility)`는 `window.apiClient.updateTree(treeId, { visibility: nextVisibility })`를 호출한다.
- 현재 Plus 권한에 따른 private 전환 잠금은 없다.
- 현재 `비공개` badge는 유료 상태가 아니라 서버 visibility 상태를 뜻한다.

주의:

- `js/editor/editor-tree-helpers.js`와 `js/editor.js` fallback 일부는 visibility가 없을 때 `public`으로 보정한다.
- 정상 API 응답에는 visibility가 있으므로 현재 정책 판단의 핵심은 아니다.

### Netlify Functions API

검토 파일:

- `netlify/functions/trees.js`
- `netlify/functions/tree-detail.js`

`/api/trees` POST:

- `body.visibility`는 `validateVisibility(body.visibility, 'private')`로 처리된다.
- visibility가 `public`이면 409를 반환한다.
- 생성은 private-first만 허용된다.

`/api/trees/:treeId` PUT:

- owner 검증 후 visibility patch를 허용한다.
- private → public 전환 시 공개 memory 3개 이상 조건을 확인한다.
- public → private 전환에는 Plus 권한 검증이 없다.

### Modal backend

검토 파일:

- `modal_compute/app.py`
- `docs/ops/MODAL_BROWSE_RUNTIME.md`

Public browse 계열:

- `/modal/browse/latest`는 `trees.visibility = 'public'`이고 공개 memory 3개 이상인 tree만 반환한다.
- `/modal/browse/growing`은 `trees.visibility = 'public'`이고 공개 memory 1~2개인 tree를 반환한다.
- public detail/memory endpoint는 public tree 또는 public memory만 반환한다.

Private owner 계열:

- `/modal/private/trees` GET은 인증 사용자의 owner tree 목록을 반환한다.
- `/modal/private/trees` POST는 `create_owner_tree()`를 호출한다.
- `create_owner_tree()`는 visibility default를 `private`으로 두고, `public` 생성 요청이면 409를 반환한다.
- `/modal/private/memories` POST는 memory visibility default를 `private`으로 둔다.

결론: Modal도 Netlify와 같이 `private-first` 생성 정책이다.

---

## 3. 사용자 요구 정책

사용자 방향:

> 기본 공개, 비공개는 유료 사용자 기능

제품 정책으로 해석하면 다음과 같다.

- 새 트리 기본 visibility는 `public`이어야 한다.
- 무료 사용자는 public tree가 기본이다.
- private tree 생성 또는 private 전환은 Plus 기능으로 분리한다.
- `public visibility`와 `browse 노출`은 분리해야 한다.
- public tree라도 공개 memory 3개 미만이면 browse에는 노출하지 않는 정책을 유지할 수 있다.

---

## 4. 충돌 지점

1. 문서 충돌: 현재 문서는 `새 트리는 처음부터 public으로 생성하지 않는다`고 명시한다.
2. 생성 UX 충돌: 현재 생성 모달은 private 생성 전제를 숨기고 `둘러보기 소개 준비`로 설명한다.
3. API 충돌: Netlify `/api/trees`와 Modal `/modal/private/trees`는 public 생성 요청을 409로 차단한다.
4. 기존 데이터 충돌: 기존 private tree를 자동 public으로 바꾸면 사용자 기대와 충돌할 수 있다.
5. Plus 권한 충돌: 현재 free/plus plan source of truth와 backend entitlement 검증이 없다.
6. Editor 의미 충돌: 현재 `비공개` badge는 단순 visibility 상태지만, B안에서는 Plus private storage 의미를 갖게 된다.

---

## 5. 변경 영향 파일 목록

### 제품/정책 문서

- `docs/product/PUBLICATION_AND_PRIVACY_UX_POLICY.md`
- `docs/product/VISIBILITY_AND_PRIVATE_STORAGE_POLICY_REVIEW.md`
- `docs/engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`
- `docs/engineering/API_CONTRACT.md`
- `docs/backend/backend.md`
- `docs/ops/MODAL_BROWSE_RUNTIME.md`

### My Trees

- `pages/my-trees.html`
- `js/my-trees/my-trees-actions.js`
- `js/my-trees/my-trees-ui.js`
- `js/my-trees/my-trees-data.js`
- `js/my-trees.js`
- `js/i18n/i18n-my-trees.js`

영향:

- createTree payload 기본값
- 생성 모달 문구
- private Plus 잠금 UX
- card visibility badge 의미
- 공개/비공개 전환 메뉴 노출 여부

### Settings

- `pages/settings.html`
- `js/settings.js`
- `js/i18n/i18n-shared.js`

영향:

- 기본 공개 범위 설정 부활 여부
- Plus private storage 안내 문구
- `defaultVisibility` 설정의 존치/폐기/재정의

### Editor

- `pages/editor.html`
- `js/editor.js`
- `js/editor/editor-detail-ui.js`
- `js/editor/editor-tree-helpers.js`
- `js/editor/editor-data-loader.js`
- `js/editor/editor-data-loader-fallbacks.js`
- `js/editor/editor-i18n-refresh.js`
- `js/i18n/i18n-editor.js`

영향:

- `비공개 러브트리` badge 의미 변경
- public-first 상태 표시
- public publish CTA 위치
- private 전환 Plus lock 처리
- API error 처리

### API / Backend

- `netlify/functions/trees.js`
- `netlify/functions/tree-detail.js`
- `netlify/functions/memories.js`
- `netlify/functions/memory-detail.js`
- `netlify/functions/community-trees.js`
- `netlify/functions/_lib/doc-store.js`
- `netlify/functions/_lib/serializers.js`
- `modal_compute/app.py`
- `modal_compute/browse_latest.py`가 별도 유지되는 경우 해당 파일
- user plan 저장소 또는 관련 migration

영향:

- public 생성 guard 제거 여부
- browse display filter 유지 여부
- private access guard 유지/강화
- free/plus 권한 검증
- 기존 private tree grandfathering

---

## 6. 정책 선택지 A/B/C

### A안: 현재 유지, private-first

정의:

- 새 트리는 항상 private으로 생성한다.
- 공개 순간 3개 이상이 되면 public 전환 가능하다.
- Plus private storage는 준비 중 안내 수준으로 둔다.

장점:

- 현재 문서, frontend, Netlify API, Modal이 일치한다.
- production 데이터 변경이 없다.
- privacy risk가 낮다.

단점:

- 사용자 방향인 `기본 공개, 비공개 유료`와 맞지 않는다.
- 무료 사용자의 기본 경험이 private으로 학습된다.

### B안: public-first + Plus private

정의:

- 새 트리는 기본 public으로 생성한다.
- 무료 사용자는 private tree 생성/전환이 제한된다.
- private storage는 Plus 기능으로 잠근다.
- browse 노출은 public tree + 공개 memory 조건으로 별도 관리한다.

장점:

- 사용자 방향과 가장 직접적으로 일치한다.
- 공개 러브트리 생태계와 browse 성장에 유리하다.
- private storage의 유료 가치가 명확하다.

단점:

- 현재 문서와 코드 충돌이 가장 크다.
- backend 권한 검증이 없으면 정책이 완성되지 않는다.
- 기존 private tree 처리 정책이 필요하다.
- `공개 = 즉시 둘러보기 노출` 오해를 막아야 한다.

### C안: private draft → public publish

정의:

- 새 트리는 현재처럼 private draft로 시작한다.
- 단, 문구는 `비공개 보관`이 아니라 `공개 준비 전 초안`에 가깝게 재해석한다.
- 공개 순간 3개 이상 후 public publish 가능하다.
- Plus private storage는 별도 장기 기능으로 둔다.

장점:

- 현재 코드와 가장 적게 충돌한다.
- privacy risk가 낮다.
- public publish guard와 browse filter를 유지할 수 있다.

단점:

- 사용자 방향인 `기본 공개`와 완전히 일치하지 않는다.
- private storage 유료화 메시지가 약하다.

---

## 7. 추천안

추천안: 단계적 B안 전환. 단, 즉시 전체 적용은 보류한다.

이유:

- 사용자 방향은 B안이 가장 정확하다.
- 그러나 현재 구현은 문서, frontend, Netlify API, Modal 모두 `private-first`로 정렬되어 있다.
- Plus 권한 source of truth가 없으므로 private lock을 frontend만으로 처리하면 정책 완성도가 낮다.
- 기존 private tree 자동 public 전환은 사용자 신뢰 리스크가 크다.
- public visibility와 browse 노출 조건을 분리해야 한다.

권장 원칙:

- 기존 private tree는 자동 변경하지 않고 grandfathered private으로 유지한다.
- 새 tree부터 public-first로 전환한다.
- private 생성/전환은 Plus entitlement source가 확정된 뒤 backend에서 검증한다.
- 결제/권한 로직이 준비되기 전에는 Plus 문구를 `준비 중` 또는 `사용 가능 예정` 수준으로 제한한다.

---

## 8. 단계별 전환 계획

### Phase 0. CTO 정책 승인

승인 필요:

1. A/B/C 중 정책 선택
2. 새 트리 기본값 public 전환 여부
3. 기존 private tree grandfathering 여부
4. private storage Plus 잠금 시점
5. Plus 권한 source of truth
6. public tree와 browse 노출의 분리 명칭

### Phase 1. 정책 문서 개정

대상:

- `docs/product/PUBLICATION_AND_PRIVACY_UX_POLICY.md`
- `docs/engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`
- `docs/engineering/API_CONTRACT.md`
- `docs/backend/backend.md`
- `docs/ops/MODAL_BROWSE_RUNTIME.md`

내용:

- `private-first` 현행 문구를 legacy 또는 draft-first 섹션으로 이동
- `public visibility`와 `browse 소개 가능` 분리
- `private storage = Plus 기능` 정책 정의
- 기존 private tree grandfathering 명시

### Phase 2. Frontend UX 전환

대상:

- My Trees 생성 모달
- Editor sidebar visibility badge/action
- Settings private storage card
- i18n key

권장 UX:

- 새 트리 생성 모달은 `기본 공개로 시작`을 조용히 표시한다.
- `비공개로 시작`은 Plus 잠금 카드로 표시한다.
- 무료 사용자가 private을 선택하면 `비공개 보관은 Plus에서 사용할 수 있어요` 안내를 표시한다.
- Editor badge는 `공개 러브트리`, `둘러보기 준비 중`, `둘러보기 소개 가능`, `비공개 보관`을 분리한다.
- 공개/비공개 전환 버튼은 Editor sidebar 설정 패널 또는 My Trees card overflow에 둔다.

### Phase 3. Backend/API 전환

대상:

- Netlify `/api/trees`
- Netlify `/api/trees/:treeId`
- Modal `/modal/private/trees`
- plan/entitlement 검증 유틸

필요 변경:

- 새 tree public 생성 허용
- private 생성/전환 시 Plus entitlement 확인
- 기존 private tree owner 접근 유지
- free user가 기존 private tree를 public으로 바꾸는 것은 허용 가능
- free user가 public tree를 private으로 바꾸는 것은 Plus required로 차단
- API error contract 정의

### Phase 4. 데이터 전환

권장:

- production 기존 private tree는 자동 public 전환하지 않는다.
- 기존 private tree는 grandfathered private으로 유지한다.
- 새 정책 적용 이후 생성되는 tree부터 public-first를 적용한다.
- 필요하면 사용자가 직접 public 전환하도록 유도한다.

---

## 9. backend/API 변경 필요 여부

B안 기준으로는 backend/API 변경이 필수다.

이유:

- 현재 `/api/trees`는 public 생성 요청을 409로 차단한다.
- 현재 Modal `create_owner_tree()`도 public 생성 요청을 409로 차단한다.
- 현재 private 전환에 Plus 권한 검증이 없다.
- 현재 사용자 plan source of truth가 없다.
- frontend만 잠그면 API 정책과 실제 권한 정책이 분리된다.

A안 또는 C안을 선택하면 즉시 backend/API 변경은 필요 없다.

---

## 10. CTO 승인 필요 사항

1. 정책 방향: A안 / B안 / C안 중 선택
2. 새 트리 기본 visibility 변경 여부
3. 기존 private tree grandfathering 여부
4. private storage의 Plus 잠금 시점
5. free/plus entitlement source of truth
6. private 생성/전환 API 차단 방식
7. `public`과 `browse 소개 가능`의 사용자-facing 명칭
8. Settings에서 기본 공개 범위 설정을 다시 살릴지 여부
9. Editor의 `비공개` badge 의미 재정의 여부
10. Modal backend를 Netlify API와 동시에 바꿀지 여부

---

## 11. 확인 질문별 답변 요약

1. 현재 문서상 새 트리는 `private` 시작이다.
2. 현재 코드상 createTree payload는 `visibility: 'private'`로 고정되어 있다.
3. 기본 공개 / 유료 비공개로 바꾸면 My Trees, Settings, Editor, i18n, Netlify API, Modal, API/운영 문서가 영향 받는다.
4. 기존 private tree는 자동 변경하지 않고 grandfathered private으로 유지하는 것을 권장한다.
5. 무료 사용자가 비공개를 선택하면 `비공개 보관은 Plus에서 사용할 수 있어요` 안내를 보여준다.
6. 공개 전환 버튼은 Editor sidebar 설정 패널 또는 My Trees card overflow가 적절하다.
7. B안 채택 시 비공개 전환은 Plus 기능으로 잠가야 한다.
8. Settings의 기본 공개 범위 설정은 부활 가능하지만, 우선순위는 낮다. 정책 안내와 Plus private storage 설명에 집중하는 편이 단순하다.
9. Editor의 `비공개` badge는 현재 visibility 상태 의미다. B안 이후에는 Plus private storage 또는 grandfathered private 상태로 재정의해야 한다.
10. private storage가 유료 기능이면 backend에서 free/plus 권한 검증이 필요하다.
