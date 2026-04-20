# 상용 배포 최종 상태 점검 리포트 (Sanity Check) - 2026-04-21

---

## 1. 종합 판정

- **최종 판정**: **FAIL (배포 기준본 확정 불가)**
- **이유**: 상세 페이지 네비게이션(backButton) 단절 지속 및 다수의 i18n Key 누출 발견.

---

## 2. 점검 항목 및 결과

| 점검 항목 | 상세 내용 | 결과 | 비고 |
| :--- | :--- | :--- | :--- |
| **Login 모달** | 문구 및 i18n Key 노출 여부 | **PASS** | 정상 번역 노출 |
| **Search 프리뷰** | placeholder 누수 및 i18n Key 노출 | **FAIL** | `0tree_context_moment_count_desc` 키 노출 |
| **Detail 화면** | i18n Key 직접 노출 여부 | **FAIL** | 하단 영역 i18n Key 노출 |
| **Detail 네비게이션** | backButton 단순 동작 여부 | **FAIL** | **클릭 시 URL 변화 없음 (Cold Button)** |
| **Editor 진입** | Resolver/Fallback 콘솔 에러 여부 | **PARTIAL** | Fatal 에러는 없으나 i18n 경고 다수 발생 |

---

## 3. 증빙 사진 (Screenshots)

- [final-login-check.png](./screenshots/final-login-check.png): 로그인 페이지 정상 번역 확인.
- [final-search-check.png](./screenshots/final-search-check.png): 검색 프리뷰 내 i18n Key 누출 확인.
- [final-detail-check.png](./screenshots/final-detail-check.png): 상세 페이지 backButton 무반응 및 Key 누출 확인.
- [final-editor-console.png](./screenshots/final-editor-console.png): 에디터 리다이렉트 및 콘솔 경고(Warning) 확인.

---

## 4. 기술 진단 및 블로커

1.  **네비게이션 블로커**: 상세 페이지에서 목록으로의 복귀가 불가능한 'Cold Button' 현상이 상용 환경에서 여전함. 이는 단순 UI 오류가 아닌 비동기 실행 제어 실패로 인한 **Critical 블로커**임.
2.  **i18n 누수**: `0tree_context_moment_count_desc`와 같은 시스템 키가 노출되어 서비스의 완성도가 심하게 저하됨. i18n 딕셔너리의 일관성 및 로딩 가드 부족이 원인.

---

## 5. 최종 의견

현재 `main` 브랜치는 상용 표준본으로 확정하기에 **부적합**합니다. 상기 블로커들에 대한 긴급 수정이 완료될 때까지 배포본 확정을 보류할 것을 권고합니다.
