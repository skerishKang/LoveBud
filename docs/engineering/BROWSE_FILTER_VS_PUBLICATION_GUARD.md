# Browse Display Filter vs. Publication Guard

LoveBud의 데이터 노출 정책은 보안과 UX 성능을 동시에 만족시키기 위해 두 계층으로 분리하여 관리합니다.

## 1. Publication Guard (보안 계층)
- **위치**: 데이터베이스(Neon) / Netlify API 서버 가드
- **정의**: 데이터의 원천적인 가시성을 결정하는 "Hard Boundary".
- **동작**:
  - visibility = 'public'인 레코드만 비로그인 사용자에게 노출.
  - visibility = 'private'인 경우 소유권(Ownership) 확인 후 차단 또는 허용.
- **목적**: 권한이 없는 사용자가 데이터에 접근하지 못하도록 보장하는 **보안(Security)** 목적.

## 2. Browse Display Filter (UX 계층)
- **위치**: Modal 가속 레이어 / Vercel API 어댑터 (api/community/trees.js)
- **정의**: 공개된 데이터 중 사용자에게 어떤 것을 우선적으로, 어떤 품질로 보여줄지 결정하는 "Soft Filtering".
- **예시 구현 (api/community/trees.js)**:
  - view=summary인 요청에 대해 Modal 가속 레이어 우선 호출.
  - Modal 반환 데이터가 없을 경우 Netlify 일반 API로 Fallback.
  - Modal은 요약 정보(Representative Thumbnail, Memory Count 등)가 포함된 정제된 데이터만 반환.
- **목적**: 검색 및 둘러보기 경험의 품질을 높이고, 정제된 데이터를 빠르게 공급하는 **성능 및 품질(Discovery & Quality)** 목적.

---

## 구현 팀 참고사항
- **데이터 보안(삭제/비공개)**: Publication Guard 레벨에서 처리해야 하며, 이는 원천 DB인 Neon에서 보장됩니다.
- **브라우즈 품질 개선**: Modal 가속 레이어의 쿼리 로직(app.py) 또는 Vercel의 디스플레이 어댑터를 수정하여 Display Filter를 조정합니다.
- **아키텍처 인지**: Vercel의 api/community/trees.js는 이 두 개념이 교차하는 지점으로, 보안 가드가 적용된 데이터를 Modal에서 먼저 가져오되 실패 시 원천 데이터를 가져오는 흐름을 유지합니다.