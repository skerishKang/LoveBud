# LoveBud 상세 페이지 backButton / fallback 검증 가이드

## 1. 개요
`pages/detail.html`의 네비게이션 안정성과 Fallback UI의 레이아웃 유지력을 검증하기 위한 상용 환경 전용 QA 가이드입니다.

---

## 2. 사전 준비 및 확인 스크립트

### 사전 조건
- 테스트 환경: `https://lovebud.netlify.app`
- 필수 증빙: **주소창(URL)이 포함된 캡처**
- 실행 전: 브라우저 탭/세션 초기화 (Clean Start)

### [JS-01] 버튼 상태 확인 스크립트
```js
(() => {
  const btn = document.getElementById('backButton');
  console.log({
    currentUrl: location.href,
    exists: !!btn,
    text: btn?.textContent?.trim(),
    backUrl: btn?.dataset?.backUrl,
    hasHandler: !!btn?.__detailBackHandler
  });
})();
```

### [JS-02] UI 구조(Fallback) 확인 스크립트
```js
(() => {
  console.log({
    headerExists: !!document.getElementById('shared-header'),
    detailLayoutExists: !!document.querySelector('.detail-layout'),
    detailMainExists: !!document.querySelector('.detail-main'),
    detailContentExists: !!document.querySelector('.detail-content'),
    backButtonExists: !!document.getElementById('backButton')
  });
})();
```

---

## 3. 테스트 케이스 (Test Cases)

| ID | 케이스명 | 절차 | 기대 결과 |
| :--- | :--- | :--- | :--- |
| **TC-01** | browse 복귀 | `search.html` -> 카드 클릭 -> backButton 클릭 | `search.html`로 정상 복귀 및 URL 전환 |
| **TC-02** | my-trees 복귀 | `my-trees.html` -> detail -> backButton 클릭 | `my-trees.html`로 복귀 확인 (search 방지) |
| **TC-03** | editor 복귀 | `editor.html?treeId=X` -> detail -> backButton | `editor.html?treeId=X`로 treeId 유지 복귀 |
| **TC-04** | Fallback UI | 존재하지 않는 memory id로 직접 진입 | Fallback 노출 시에도 Header 유지 및 링크 작동 |
| **TC-05** | API 실패 내성 | Network Tab에서 API 차단 후 진입 | 데이터 로드 실패와 무관하게 backButton 작동 |
| **TC-06** | Sibling 이동 | connectedFragments 내 카드 클릭/키보드 | detail 간 이동 시 `from`/`tree` 파라미터 유지 |

---

## 4. 결과 기록 템플릿

| 케이스 | 시작 URL | dataset.backUrl | 클릭 후 URL | 판정 |
| :--- | :--- | :--- | :--- | :--- |
| TC-01 | | | | |
| TC-02 | | | | |
| TC-03 | | | | |
| TC-04 | | n/a | | |
| TC-05 | | | | |
| TC-06 | | | | |

---

## 5. 판정 및 실패 기준

### PASS 기준
- `backButton` 및 `__detailBackHandler` 존재 확인
- `dataset.backUrl`이 진입 context(`from`)와 일치
- 클릭 직후 페이지 전환 및 URL 실제 갱신 확인
- Fallback 상황에서 상단 `#shared-header` 유지 확인

### FAIL 기준
- 버튼 클릭 시 URL 고정 (이동 없음)
- 진입 context와 다른 페이지로 이동 (예: editor 진입 후 search로 복귀)
- Fallback 시 레이아웃 붕괴 또는 화이트 스크린 발생
- Sibling 이동 후 뒤로가기 시 context(from/tree) 유실
