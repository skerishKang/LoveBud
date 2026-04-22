# LoveBud Operations Strategy (운영 전략)

## 1. 운영 우선순위

LoveBud의 현재 운영 우선순위는 아래와 같습니다.

> **Hierarchy: Modal > Vercel > Netlify**

| 계층 | 역할 | 현재 책임 범위 | 상태 |
| :--- | :--- | :--- | :--- |
| **Modal** | **Primary Read / Compute Layer** | browse summary, public read aggregation, 대표 카드 계산, read-heavy snapshot 계산 | 1순위 |
| **Vercel** | **Primary Entry Layer** | 실서비스 진입점, 정적 프런트 서빙, same-origin `/api/*` 라우팅 | 1순위 |
| **Netlify** | **Legacy Write / Fallback Layer** | 기존 Functions 유지, Modal 실패 시 fallback, 일부 CRUD 원천 유지 | 보조 |

핵심 원칙:
- 실서비스 주소는 **반드시 `https://lovebud.vercel.app/`** 기준으로 본다.
- browse summary 계열은 **Modal을 먼저** 본다.
- Netlify는 남겨두되, 주경로가 아니라 **fallback / legacy write**로 본다.

---

## 2. 실서비스 운영 정보

- **공식 서비스 주소**: `https://lovebud.vercel.app/`
- **Vercel 프로젝트(운영 기준)**: `lovebud`
- **Modal 앱**: `lovebud-browse-snapshot`
- **Netlify 주소(보조/Fallback)**: `https://lovebud.netlify.app/`

주의:
- Netlify 주소는 실서비스 대표 주소가 아닙니다.
- 운영 문서에서 `lovebud.netlify.app`를 주서비스처럼 설명하지 않습니다.

---

## 3. 실제 요청 경로

### 3.1 브라우즈 summary

현재 browse summary의 주경로는 아래입니다.

1. 브라우저 → `https://lovebud.vercel.app/api/community/trees?view=summary&sort=latest&limit=3`
2. Vercel `api/community/trees.js`
3. `MODAL_BASE_URL` 기준 Modal `/modal/browse/latest?limit=3` 우선 호출
4. Modal 실패/빈 응답 시 Netlify `/community/trees` fallback

즉, browse summary의 운영 우선순위는 아래와 같습니다.

- **Modal first**
- **Netlify fallback second**

### 3.2 브라우즈 memories hydrate

현재 preview hydrate 경로는 아래입니다.

1. 브라우저 → `https://lovebud.vercel.app/api/community/memories?treeId=<id>`
2. Vercel `api/community/memories.js`
3. Netlify `/community/memories`

즉, memories hydrate는 아직 Modal 직결이 아니라 **Vercel entry + Netlify upstream** 구조입니다.

### 3.3 기타 `/api/*`

기타 `/api/*` 경로는 Vercel `api/[...path].js`가 `LOVEBUD_UPSTREAM_API_BASE`를 기준으로 upstream proxy를 수행합니다.
기본값은 `https://lovebud.netlify.app/api` 입니다.

---

## 4. 환경 변수 운영 원칙

### 4.1 Vercel

현재 Vercel 라우터가 직접 참조하는 핵심 변수:

- `MODAL_BASE_URL`
  - browse summary Modal 우선 호출용
- `NETLIFY_API_BASE_URL`
  - `/api/community/trees`, `/api/community/memories`의 Netlify upstream
- `LOVEBUD_UPSTREAM_API_BASE`
  - catch-all `/api/[...path]` upstream base

기본 원칙:
- `MODAL_BASE_URL`는 **반드시 실제 live Modal 배포 주소**를 가리켜야 한다.
- `NETLIFY_API_BASE_URL`는 trailing slash 없이 `https://lovebud.netlify.app/api` 형태를 권장한다.
- `LOVEBUD_UPSTREAM_API_BASE`를 명시하면 catch-all proxy의 upstream을 운영자가 고정할 수 있다.

### 4.2 Modal

Modal runtime 핵심 변수:

- `DATABASE_URL`
  - Modal secret `lovebud-db`에서 주입
- `CORS_ALLOWED_ORIGINS`
  - 필요 시 명시 설정
  - 기본 허용 origin에는 `https://lovebud.vercel.app`와 `https://lovebud.netlify.app` 포함

### 4.3 Netlify

Netlify는 현재 legacy/fallback 역할을 유지하므로 DB 및 인증 관련 기존 env를 유지한다.
다만 운영 설명에서는 Netlify를 **주경로**로 표현하지 않는다.

---

## 5. fallback 운영 원칙

- Modal browse summary가 실패해도 browse 전체가 멈추면 안 된다.
- 이 경우 Vercel `api/community/trees.js`가 Netlify fallback을 수행한다.
- fallback은 유지하되, 성능 및 요약 품질 기준은 Modal이 우선이다.
- 점진적 제거 대상은 “Netlify 주경로 설명”이지, fallback 자체가 아니다.

---

## 6. 단계적 제거 원칙

현재 구조는 완전 제거가 아니라 **전이기 구조**다.

정리 순서:
1. 실서비스 주소는 Vercel로 고정
2. browse summary는 Modal 우선으로 고정
3. Vercel은 same-origin entry로 유지
4. Netlify는 fallback + legacy write로 축소
5. 이후 Netlify read 경로를 점진적으로 더 줄인다

---

## 7. 운영 체크포인트

- `https://lovebud.vercel.app/`가 공식 주소로 안내되고 있는가
- browse summary 요청이 `/api/community/trees?view=summary`를 통해 나가는가
- Vercel env에 `MODAL_BASE_URL`, `NETLIFY_API_BASE_URL`, `LOVEBUD_UPSTREAM_API_BASE`가 설정되어 있는가
- Modal `/modal/health`가 정상 응답하는가
- Modal `/modal/browse/latest?limit=3`가 정상 응답하는가
- Modal 실패 시 Netlify fallback이 동작하는가

---

## 8. 관리자 운영 메모

확인용 핵심 URL:
- 메인: `https://lovebud.vercel.app/`
- 검색/브라우즈: `https://lovebud.vercel.app/search.html`
- 로그인: `https://lovebud.vercel.app/login.html`
- 에디터: `https://lovebud.vercel.app/editor.html`
- 내 트리: `https://lovebud.vercel.app/my-trees.html`
