# LoveBud Operations Strategy (운영 전략)

## 1. 기반 인프라 계층 및 우선순위 (Infrastructure Priority)

LoveBud 프로젝트는 안정성과 확장성을 위해 아래와 같이 인프라 계층의 역할과 우선순위를 정의합니다.

> **Hierarchy: Modal > Vercel > Netlify**

| 계층 | 역할 명칭 | 상세 책임 범위 | 비고 |
| :--- | :--- | :--- | :--- |
| **Modal** | **Compute Layer** | AI 분석, 영상 요약, Read-Heavy 브라우즈 데이터 공급, 복합 쿼리 처리 | 최우선 데이터 공급원 |
| **Vercel** | **Entry Layer** | 정적 자산(Frontend) 배포, 사용자 진입점, Same-Origin API 라우팅 (Vercel Functions) | 실서비스 대표 주소 |
| **Netlify** | **Legacy/Fallback** | 기존 서버리스 함수(Lambda) 유지, 데이터 쓰기 및 레거시 API 백업 | 인프라 전이 기간 중 백업 |

---

## 2. 실서비스 운영 정보
- **공식 서비스 주소**: [https://lovebud.vercel.app/](https://lovebud.vercel.app/)
- **Vercel 프로젝트**: lovebud
- **Modal 앱**: lovebud-browse-snapshot
- **Netlify (Fallback용)**: lovebud.netlify.app

---

## 3. API 아키텍처 (Same-Origin Proxy)

현재 LoveBud는 보안과 호환성을 위해 Vercel의 **Same-Origin API 라우팅** 방식을 채택하고 있습니다.

- **클라이언트 호출**: /api/community/trees?view=summary 형태의 상대 경로 사용.
- **Vercel 라우팅 (api/ 폴더)**: 
    - api/community/trees.js가 요청을 수신.
    - **Modal 우선 호출**: view=summary일 경우 Modal 서버(/modal/browse/latest)를 먼저 호출하여 고성능 데이터 반환.
    - **Netlify Fallback**: Modal 실패 시 또는 일반 요청 시 Netlify API 호스트로 요청을 전달(Proxy).

---

## 4. 환경 변수 관리 (Environment Variables)

### 핵심 변수 (Core Env)
- MODAL_BASE_URL: Modal 서버 주소.
- NETLIFY_API_BASE_URL: Netlify Functions API 주소 (Backend).
- DATABASE_URL: Neon Postgres 연결 문자열 (Modal/Netlify 공유).

### 관리 원칙
1. **Modal Secret**: DB 연동 및 무거운 연산용 비밀값은 Modal Secret(lovebud-db)에서 관리.
2. **Vercel Env**: 프런트엔드 도메인 인증 및 상위 API 라우팅용 변수 관리.
3. **Netlify Env**: 레거시 DB 연동 변수 유지.

---

## 5. 관리자 운영 (Admin Operations)

### URL 체크리스트
- 메인: https://lovebud.vercel.app/
- 검색/브라우즈 (Modal 가속): https://lovebud.vercel.app/search.html (view=summary 쿼리 기반)
- 에디터: https://lovebud.vercel.app/editor.html
- 로그인: https://lovebud.vercel.app/login.html