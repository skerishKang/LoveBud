# 상세 페이지 네비게이션 표준 감사 (2026-04-20-2124)

---

## 1. 최종 판정

- **최종 판정**: **부분 통과 (PARTIAL)**
    - **네비게이션 (backButton)**: **FAIL** (핸들러 미등록 및 데이터셋 누락)
    - **Fallback UI**: **PASS** (Header 유지 및 링크 정상 작동)

---

## 2. 실행 요약

- **실행 일시**: 2026-04-20 21:24 (KST)
- **실행 환경**: `https://lovebud.netlify.app` (상용)
- **검증 도구**: DETAIL_NAVIGATION_AUDIT.md 표준 가이드 준수

---

## 3. 테스트 케이스별 결과 (Summary)

| ID | 케이스명 | 시작 URL (Context) | backUrl | 최종 결과 | 판정 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | browse 복귀 | `/pages/search.html` | `undefined` | 이동 실패 (무반응) | **FAIL** |
| **TC-02** | my-trees 복귀 | `/pages/my-trees.html` | `undefined` | 이동 실패 (무반응) | **FAIL** |
| **TC-03** | editor 복귀 | `/pages/editor.html?treeId=...` | `undefined` | 라벨 불일치 & 이동 실패 | **FAIL** |
| **TC-04** | Fallback UI | 존재하지 않는 memory id | n/a | Header 유지 & 링크 복귀 성공 | **PASS** |
| **TC-05** | API 실패 내성 | Network Tab API 차단 | n/a | 버튼 무반응 지속 | **FAIL** |
| **TC-06** | Sibling 이동 | connectedFragments 클릭 | n/a | 401 권한 에러로 렌더링 불가 | **FAIL** |

---

## 4. 증빙 사진 (Screenshots)

### 4.1. 네비게이션 실패 증빙 (URL Overlay 확인)
- [TC-01-step1-detail-loaded.png](./screenshots/TC-01-step1-detail-loaded.png): 상세 진입 후 STATUS: NO-BTN (핸들러 미동작)
- [TC-02-step1-detail-loaded.png](./screenshots/TC-02-step1-detail-loaded.png): My-Trees 맥락에서도 동일 증상
- [TC-03-step1-detail-loaded.png](./screenshots/TC-03-step1-detail-loaded.png): Editor 맥락 라벨 갱신 실패

### 4.2. Fallback UI 성공 증빙
- [TC-04-step1-fallback-visible.png](./screenshots/TC-04-step1-fallback-visible.png): 기억 부재 시 Fallback 정상 노출 및 Header 생존
- [TC-04-step2-returned-via-fallback.png](./screenshots/TC-04-step2-returned-via-fallback.png): Fallback 내 링크를 통한 Search 복귀 성공

---

## 5. 정밀 분석 및 기술 진단

1. **backButton 핸들러 미등록**: 
    - 콘솔 스니펫 확인 결과 `hasHandler: false` 및 `backUrl: undefined`가 반복 관찰됨.
    - 이는 `js/detail.js`의 `configureBackButton` 함수가 상용 환경의 비동기 실행 흐름에서 **최종적으로 실행되지 않거나, 실행 전 오류로 중단**됨을 의미함.
2. **권한 계층 문제 (TC-05/06)**:
    - 공개 트리임에도 불구하고 `getMemoriesByTree` 호출 시 401 Unauthorized가 발생하는 현상이 관찰됨. 이로 인해 Sibling 카드가 렌더링되지 않음.
3. **Fallback UI의 견고함**:
    - `.detail-layout`을 통째로 교체하는 방식이 `#shared-header` 유지에 효과적임을 실증함.

---

## 6. 블로커 및 권고 사항

- **블로커**: YES (상세 페이지에서 목록으로 돌아갈 수 있는 유일한 수단인 backButton이 상용에서 작동하지 않음)
- **권고 사항**: 
    - `configureBackButton`의 호출 위치를 `apiClient` 호출 이전으로 전진 배치(Pre-warm).
    - `window.t` (i18n) 로드 지연 시에도 기본 네비게이션은 작동하도록 폴백 로직 강화.
