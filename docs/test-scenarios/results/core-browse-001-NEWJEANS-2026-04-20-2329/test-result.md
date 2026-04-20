# Core Browse Audit: 뉴진스 (NewJeans) - 2026-04-20

---

## 1. 최종 판정

- **최종 판정**: **FAIL**
- **한 줄 요약**: **뉴진스 관련 콘텐츠 검색 불가 및 상세 페이지 네비게이션(backButton) 작동 불능.**

---

## 2. 실행 정보

- **실행 일시**: 2026-04-20 23:29 (KST)
- **실행 환경**: `https://lovebud.netlify.app`
- **테스트 그룹**: 뉴진스 (NewJeans)
- **검증 케이스**: `core-browse-001`

---

## 3. 항목별 상세 결과

| 구분 | 단계 | 결과 | 비고 |
| :--- | :--- | :--- | :--- |
| **Search** | "뉴진스" 검색 | **실패** | "조건에 맞는 공개 트리가 없네요" 노출됨 |
| **Detail** | 임의 상세 페이지 진입 | **통과** | UI 레이아웃 및 본문 내용은 노출됨 |
| **Back** | backButton 클릭 | **실패** | **URL 변화 없음 (Cold Button 현상 확정)** |
| **Console** | diagnostics 실행 | **실패** | `hasHandler: false`, `backUrl: undefined` 관찰됨 |

---

## 4. 증빙 사진 (Screenshots)

- [newjeans-search-results.png](./screenshots/newjeans-search-results.png): "뉴진스" 검색 시 검색 결과 없음 확인.
- [newjeans-detail-loaded.png](./screenshots/newjeans-detail-loaded.png): 상세 페이지 진입 시 URL 오버레이 및 버튼 노출 확인.
- [newjeans-back-attempt.png](./screenshots/newjeans-back-attempt.png): 뒤로가기 버튼 클릭 후에도 동일 URL(detail) 유지 확인.

---

## 5. 정밀 분석

1. **데이터 가시성 결함**: 
    - 상용 DB에 "뉴진스" 관련 공개 트리 데이터가 없거나, 검색 인덱싱 스크립트가 누락된 것으로 판단됨.
2. **"Cold Button" 재현**: 
    - 이전의 BTS, IVE 테스트와 동일하게 `backButton`에 이벤트 리스너가 성공적으로 붙지 않는 현상이 뉴진스 케이스에서도 100% 재현됨.
    - 리스너 등록 로직이 비동기 API 데이터 로딩이나 인증 확인 과정에서 발생하는 에러에 의해 중단되는 것이 근본 원인임을 재확인.

---

## 6. 블로커 및 조치 권고

- **블로커**: YES (검색 기능 마비 및 네비게이션 단절)
- **조치 권고**: 
    - DB에 뉴진스 샘플 데이터를 추가하고 공개(Public) 태그 점검 필요.
    - `detail.js` 내 네비게이션 리스너 등록 로직을 API 로드 결과와 관계없이 최우선적으로 실행되도록 리팩터링 필요.
