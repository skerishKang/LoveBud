# LoveBud 환경변수 의존성 맵

> 목적: 현재 운영 구조(Modal > Cloudflare Pages > Vercel > Netlify)에서 어떤 환경변수가 어느 계층에 필요한지 빠르게 추적하기 위한 문서

## 0. 현재 운영 기준

- 공식 서비스 주소: `https://lovebud.pages.dev/`
- 운영 우선순위: `Modal > Cloudflare Pages > Vercel > Netlify`
- browse summary는 Modal을 먼저 보고, 실패 시 Vercel fallback으로 내려갑니다.
- preview hydrate(`api/community/memories`)도 Modal을 먼저 시도하고, 필요 시 Vercel fallback으로 내려갑니다.
- Vercel은 upstream / secondary entry 계층입니다.
- Netlify는 아직 남아 있지만 주서비스 런타임으로 설명하지 않습니다.

---

## 1. Cloudflare Pages 환경 변수

Cloudflare Pages는 정적 프런트 + same-origin `/api/*` entry 역할을 합니다.

### MODAL_BASE_URL

**직접 의존 파일**
- `functions/api/[[path]].js`

**용도**
- browse summary 요청에서 Modal `/modal/browse/latest`를 1순위로 호출
- preview hydrate 및 private/community read 경로를 Modal에 우선 전달

**누락 시 증상**
- Modal 우선 경로를 사용하지 못함
- 주요 read 경로가 Vercel fallback 중심으로만 동작
- 기능이 완전히 멈추기보다 성능/요약 품질이 낮아질 수 있음

### LOVEBUD_UPSTREAM_ORIGIN

**직접 의존 파일**
- `functions/api/[[path]].js`

**용도**
- Cloudflare Pages catch-all `/api/*` fallback upstream origin 지정

**기본값**
- `https://lovebud.vercel.app`

**누락 시 증상**
- 기본값으로 동작 가능
- 다만 운영자가 upstream을 명시적으로 제어하지 못함

---

## 2. Modal 환경 변수 / secret

Modal은 browse summary와 read-heavy aggregation의 1순위 계층입니다.

### DATABASE_URL

**직접 의존 파일**
- `modal_compute/app.py`

**용도**
- Neon Postgres snapshot read
- `/modal/browse/latest` 계산
- `/modal/private/trees`, `/modal/private/memories`, `/modal/community/memories` 등 read path 제공

**누락 시 증상**
- Modal browse/latest 실패
- private/community read 일부 실패
- Cloudflare Pages 경로는 Vercel fallback 중심으로 내려감

**운영 원칙**
- Modal secret `lovebud-db`에서 주입

### CORS_ALLOWED_ORIGINS

**직접 의존 파일**
- `modal_compute/app.py`

**기본값**
- `https://lovebud.pages.dev,https://lovebud.vercel.app,https://lovebud.netlify.app`

**용도**
- Modal 직접 호출 또는 운영 점검 시 origin 허용 목록 제어

**누락 시 증상**
- 기본값으로는 현재 운영/레거시 도메인 허용
- 추가 도메인이 필요하면 명시 설정 필요

---

## 3. Vercel / Netlify 환경 변수

### Vercel

Vercel은 현재 upstream / secondary entry 계층입니다.

운영자가 확인할 수 있는 대표 항목:
- fallback 대상 라우팅 상태
- secondary entry 헬스 체크

### Netlify

Netlify는 현재 fallback / legacy 계층입니다.

### DATABASE_URL / NETLIFY_DATABASE_URL / POSTGRES_URL

**직접 의존 범위**
- `netlify/functions/_lib/db.js`
- 그 위의 doc-store / community / trees / memories 계열 함수

**용도**
- legacy CRUD
- 일부 legacy fallback read

**누락 시 증상**
- Netlify fallback 전체 실패
- 여전히 남아 있는 legacy 경로 실패 가능

### FIREBASE_SERVICE_ACCOUNT_JSON

**직접 의존 범위**
- Netlify auth-required function 계열

**용도**
- 레거시 쓰기/권한 확인 경로

**누락 시 증상**
- 인증 필요한 legacy API 실패

---

## 4. Firebase 운영 의존성

코드 env와 별개로 운영 콘솔에서 반드시 확인해야 하는 항목:

- Authorized Domains
  - `lovebud.pages.dev`
  - `lovebud.vercel.app`
  - `lovebud.netlify.app`
  - `localhost`
  - `127.0.0.1`

주의:
- Firebase 웹 config는 프런트에 공개되어도 되는 client config입니다.
- 실제 보호는 Authorized Domains, provider 설정, Rules, App Check 검토에 달려 있습니다.

---

## 5. 장애 해석 기준

### browse summary만 느리다
우선 확인:
1. `MODAL_BASE_URL`
2. Modal `/modal/health`
3. Modal `/modal/browse/latest?limit=3`
4. Pages 로그
5. Vercel fallback 동작 여부

### `/api/community/memories`만 실패한다
우선 확인:
1. `MODAL_BASE_URL`
2. Modal community/memories 상태
3. Vercel fallback 상태
4. Pages 로그

### catch-all `/api/*`만 실패한다
우선 확인:
1. `LOVEBUD_UPSTREAM_ORIGIN`
2. Vercel upstream 상태
3. Pages 로그

---

## 6. 운영 원칙 한 줄 정리

- **Modal**: browse summary / private read / community read 1순위
- **Cloudflare Pages**: 공식 진입점 + same-origin API entry
- **Vercel**: upstream / secondary entry
- **Netlify**: fallback / legacy
