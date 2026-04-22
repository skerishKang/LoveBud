# LoveBud 환경변수 의존성 맵

> 목적: 현재 운영 구조(Modal > Vercel > Netlify)에서 어떤 환경변수가 어느 계층에 필요한지 빠르게 추적하기 위한 문서

## 0. 현재 운영 기준

- 공식 서비스 주소: `https://lovebud.vercel.app/`
- 운영 우선순위: `Modal > Vercel > Netlify`
- browse summary는 Modal을 먼저 보고, 실패 시 Netlify fallback으로 내려갑니다.
- preview hydrate(`api/community/memories`)도 representative preview 기준으로 Modal을 먼저 시도하고, 필요 시 Netlify fallback으로 내려갑니다.
- Netlify는 아직 남아 있지만 주서비스 런타임으로 설명하지 않습니다.

---

## 1. Vercel 환경 변수

Vercel은 정적 프런트 + same-origin `/api/*` entry 역할을 합니다.

### MODAL_BASE_URL

**직접 의존 파일**
- `api/community/trees.js`
- `api/community/memories.js`

**용도**
- browse summary 요청에서 Modal `/modal/browse/latest`를 1순위로 호출
- preview hydrate에서 representative preview 생성을 먼저 시도

**누락 시 증상**
- Modal 우선 경로를 사용하지 못함
- `/api/community/trees?view=summary`는 Netlify fallback으로만 동작
- `/api/community/memories?treeId=...`도 Modal representative preview 없이 Netlify upstream만 사용
- 기능이 완전히 멈추기보다 성능/요약 품질이 낮아질 수 있음

### NETLIFY_API_BASE_URL

**직접 의존 파일**
- `api/community/trees.js`
- `api/community/memories.js`

**용도**
- Modal 실패 시 `/community/trees` fallback upstream
- preview hydrate에서 Modal representative preview 실패 시 `/community/memories` fallback upstream

**누락 시 증상**
- `/api/community/memories` fallback 불가
- `/api/community/trees?view=summary`는 Modal 실패 시 fallback 불가
- Vercel API에서 500/502 가능

### LOVEBUD_UPSTREAM_API_BASE

**직접 의존 파일**
- `api/[...path].js`

**용도**
- catch-all `/api/*` upstream base 지정

**기본값**
- `https://lovebud.netlify.app/api`

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
- representative preview에 필요한 public read path 제공

**누락 시 증상**
- Modal browse latest 실패
- `/modal/health`는 살아 있어도 실제 browse summary 계산은 실패 가능
- Vercel browse summary / preview hydrate는 Netlify fallback 중심으로 내려감

**운영 원칙**
- Modal secret `lovebud-db`에서 주입

### CORS_ALLOWED_ORIGINS

**직접 의존 파일**
- `modal_compute/app.py`

**기본값**
- `https://lovebud.vercel.app,https://lovebud.pages.dev,https://lovebud.netlify.app`

**용도**
- Modal 직접 호출 또는 운영 점검 시 origin 허용 목록 제어

**누락 시 증상**
- 기본값으로는 현재 운영/레거시 도메인 허용
- 추가 도메인이 필요하면 명시 설정 필요

---

## 3. Netlify 환경 변수

Netlify는 현재 fallback / legacy 계층입니다.

### DATABASE_URL / NETLIFY_DATABASE_URL / POSTGRES_URL

**직접 의존 범위**
- `netlify/functions/_lib/db.js`
- 그 위의 doc-store / community / trees / memories 계열 함수

**용도**
- legacy CRUD
- community fallback read

**누락 시 증상**
- Netlify fallback 전체 실패
- Vercel catch-all `/api/*` upstream 실패 가능

### FIREBASE_SERVICE_ACCOUNT_JSON

**직접 의존 범위**
- Netlify auth-required function 계열

**용도**
- 레거시 쓰기/권한 확인 경로

**누락 시 증상**
- 인증 필요한 legacy API 실패
- 공개 browse summary 자체의 1차 read 경로는 Modal/Vercel 기준으로는 부분 생존 가능

---

## 4. Firebase 운영 의존성

코드 env와 별개로 운영 콘솔에서 반드시 확인해야 하는 항목:

- Authorized Domains
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
4. Vercel logs
5. Netlify fallback 동작 여부

### `/api/community/memories`만 실패한다
우선 확인:
1. `MODAL_BASE_URL`
2. representative preview 생성 가능 여부
3. `NETLIFY_API_BASE_URL`
4. Netlify `/community/memories`
5. Vercel logs

### catch-all `/api/*`만 실패한다
우선 확인:
1. `LOVEBUD_UPSTREAM_API_BASE`
2. Netlify upstream 상태
3. Vercel logs

---

## 6. 운영 원칙 한 줄 정리

- **Modal**: browse summary / representative preview 1순위
- **Vercel**: 공식 진입점 + same-origin API entry
- **Netlify**: fallback / legacy
