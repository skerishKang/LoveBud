# LoveBud Operations Strategy (운영 전략)

## 1. 운영 우선순위

LoveBud의 현재 운영 우선순위는 아래와 같습니다.

> **Hierarchy: Modal > Cloudflare Pages > Vercel > Netlify**

| 계층 | 역할 | 현재 책임 범위 | 상태 |
| :--- | :--- | :--- | :--- |
| **Modal** | **Primary Read / Compute Layer** | browse summary, public read aggregation, 대표 카드 계산, read-heavy snapshot 계산 | 1순위 |
| **Cloudflare Pages** | **Primary Entry Layer** | 실서비스 진입점, 정적 프런트 서빙, same-origin `/api/*` 라우팅 | 1순위 |
| **Vercel** | **Secondary Upstream Layer** | upstream origin, proxy fallback, 전이기 보조 계층 | 보조 |
| **Netlify** | **Legacy Write / Fallback Layer** | 기존 Functions 유지, 일부 CRUD / legacy fallback | 보조 |

핵심 원칙:
- 실서비스 주소는 **반드시 `https://lovebud.pages.dev/`** 기준으로 본다.
- browse summary 계열은 **Modal을 먼저** 본다.
- Cloudflare Pages는 공식 사용자-facing entry 이다.
- Vercel과 Netlify는 보조 / 전이기 계층으로 본다.

---

## 2. 실서비스 운영 정보

- **공식 서비스 주소**: `https://lovebud.pages.dev/`
- **Cloudflare Pages 프로젝트(운영 기준)**: `lovebud.pages.dev`
- **Modal 앱**: `lovebud-browse-snapshot`
- **Vercel 주소(보조/Upstream)**: `https://lovebud.vercel.app/`
- **Netlify 주소(보조/Fallback)**: `https://lovebud.netlify.app/`

주의:
- Vercel과 Netlify 주소는 현재 공식 사용자-facing 대표 주소가 아닙니다.
- 운영 문서에서 `lovebud.vercel.app`, `lovebud.netlify.app`를 주서비스처럼 설명하지 않습니다.

---

## 3. 실제 요청 경로

### 3.1 브라우즈 summary

현재 browse summary의 주경로는 아래입니다.

1. 브라우저 → `https://lovebud.pages.dev/api/community/trees?view=summary&sort=latest&limit=3`
2. Cloudflare Pages `functions/api/[[path]].js`
3. `MODAL_BASE_URL` 기준 Modal `/modal/browse/latest?limit=3` 우선 호출
4. Modal 실패 시 Vercel upstream fallback
5. 필요 시 그 뒤의 legacy 계층이 보조적으로 관여 가능

즉, browse summary의 운영 우선순위는 아래와 같습니다.

- **Modal first**
- **Cloudflare Pages entry**
- **Vercel fallback second**

### 3.2 브라우즈 memories hydrate

현재 preview hydrate 경로는 아래입니다.

1. 브라우저 → `https://lovebud.pages.dev/api/community/memories?treeId=<id>`
2. Cloudflare Pages `functions/api/[[path]].js`
3. Modal `/modal/community/memories` 우선 호출
4. Modal 실패 시 Vercel upstream fallback

### 3.3 기타 `/api/*`

기타 `/api/*` 경로는 Cloudflare Pages `functions/api/[[path]].js`가 `LOVEBUD_UPSTREAM_ORIGIN`를 기준으로 upstream proxy를 수행합니다.
기본값은 `https://lovebud.vercel.app` 입니다.

---

## 4. 환경 변수 운영 원칙

### 4.1 Cloudflare Pages

현재 Cloudflare Pages 라우터가 직접 참조하는 핵심 변수:

- `MODAL_BASE_URL`
  - browse summary 및 private/community read 계열 Modal upstream
- `LOVEBUD_UPSTREAM_ORIGIN`
  - fallback upstream origin

기본 원칙:
- `MODAL_BASE_URL`는 **반드시 실제 live Modal 배포 주소**를 가리켜야 한다.
- `LOVEBUD_UPSTREAM_ORIGIN`은 현재 전이기 구조에서는 `https://lovebud.vercel.app`를 가리킬 수 있다.

### 4.2 Modal

Modal runtime 핵심 변수:

- `DATABASE_URL`
  - Modal secret `lovebud-db`에서 주입
- `CORS_ALLOWED_ORIGINS`
  - 필요 시 명시 설정
  - 기본 허용 origin에는 `https://lovebud.pages.dev`, `https://lovebud.vercel.app`, `https://lovebud.netlify.app` 포함 가능

### 4.3 Vercel / Netlify

Vercel은 현재 upstream / fallback 보조 계층입니다.
Netlify는 현재 legacy/fallback 계층입니다.
다만 운영 설명에서는 두 계층 모두 **주경로**로 표현하지 않습니다.

---

## 5. fallback 운영 원칙

- Modal browse summary가 실패해도 browse 전체가 멈추면 안 된다.
- 이 경우 Cloudflare Pages `functions/api/[[path]].js`가 Vercel upstream fallback을 수행한다.
- fallback은 유지하되, 성능 및 요약 품질 기준은 Modal이 우선이다.
- 점진적 제거 대상은 “Vercel/Netlify 주경로 설명”이지, fallback 자체가 아니다.

---

## 6. 단계적 제거 원칙

현재 구조는 완전 제거가 아니라 **전이기 구조**다.

정리 순서:
1. 실서비스 주소는 Cloudflare Pages로 고정
2. browse summary는 Modal 우선으로 고정
3. Cloudflare Pages는 same-origin entry로 유지
4. Vercel은 upstream / 보조 entry로 유지
5. Netlify는 legacy fallback / write로 축소
6. 이후 Vercel / Netlify 의존 범위를 점진적으로 더 줄인다

---

## 7. 운영 체크포인트

- `https://lovebud.pages.dev/`가 공식 주소로 안내되고 있는가
- browse summary 요청이 `/api/community/trees?view=summary`를 통해 나가는가
- preview hydrate 요청이 `/api/community/memories?treeId=...`를 통해 나가는가
- Cloudflare Pages env에 `MODAL_BASE_URL`, `LOVEBUD_UPSTREAM_ORIGIN`이 설정되어 있는가
- Modal `/modal/health`가 정상 응답하는가
- Modal `/modal/browse/latest?limit=3`가 정상 응답하는가
- Modal 실패 시 Vercel fallback이 동작하는가

---

## 8. 관리자 운영 메모

확인용 핵심 URL:
- 메인: `https://lovebud.pages.dev/`
- 검색/브라우즈: `https://lovebud.pages.dev/search.html`
- 로그인: `https://lovebud.pages.dev/login.html`
- 에디터: `https://lovebud.pages.dev/editor.html`
- 내 트리: `https://lovebud.pages.dev/my-trees.html`
