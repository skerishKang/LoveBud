# LoveBud 환경변수 의존성 맵

> 목적: 현재 운영 구조에서 어떤 환경변수가 어느 계층에 필요한지 빠르게 추적하기 위한 문서

## 0. 현재 운영 기준

- 공식 서비스 주소: `https://lovebud.pages.dev/`
- 운영 기준: `Cloudflare Pages Entry + Modal Active Runtime > Vercel Transitional Fallback > Netlify Legacy Artifact`
- Cloudflare Pages는 공식 사용자-facing production / preview entry입니다.
- Cloudflare Pages same-origin `/api/*`가 브라우저 API entry입니다.
- Modal은 active compute/runtime 우선 경로입니다.
- browse summary는 Modal을 먼저 보고, 실패 시 Vercel fallback으로 내려갈 수 있습니다.
- preview hydrate(`api/community/memories`)도 Modal을 먼저 시도하고, 필요 시 Vercel fallback으로 내려갈 수 있습니다.
- Vercel은 deprecated transitional fallback / upstream under audit입니다.
- Netlify는 legacy / fallback / artifact 성격으로 남아 있으며 주서비스 런타임으로 설명하지 않습니다.
- `netlify/functions/*`는 삭제 대상이라고 단정하지 않지만, 현재 active production backend처럼 취급하지 않습니다.

---

## 1. Cloudflare Pages 환경 변수

Cloudflare Pages는 공식 사용자-facing entry, 정적 프런트, same-origin `/api/*` entry 역할을 합니다.

### MODAL_BASE_URL

**직접 의존 파일**
- `functions/api/[[path]].js`

**용도**
- browse summary 요청에서 Modal `/modal/browse/latest`를 1순위로 호출
- preview hydrate 및 private/community read 경로를 Modal에 우선 전달

**누락 시 증상**
- Modal 우선 경로를 사용하지 못함
- 주요 read 경로가 Vercel fallback 중심으로만 동작할 수 있음
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
- 다만 운영자가 fallback upstream을 명시적으로 제어하지 못함

---

## 2. Modal 환경 변수 / secret

Modal은 browse summary와 read-heavy aggregation의 active compute/runtime 우선 계층입니다.

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
- Cloudflare Pages 경로는 Vercel fallback 중심으로 내려갈 수 있음

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

Vercel은 deprecated transitional fallback / upstream under audit입니다.

운영자가 확인할 수 있는 대표 항목:
- fallback 대상 라우팅 상태
- secondary entry 헬스 체크

주의:
- Vercel은 공식 사용자-facing production entry로 설명하지 않습니다.
- production 검증 기준은 Cloudflare Pages production / preview입니다.

### Netlify

Netlify는 **legacy artifact**입니다. 현재 active production runtime이 아니며, local 또는 CI harness에서만 참고용으로 사용됩니다. CTO 승인 없이 삭제/이동/재활성화 금지.

### DATABASE_URL / NETLIFY_DATABASE_URL / POSTGRES_URL

**직접 의존 범위**
- `netlify/functions/_lib/db.js`
- 그 위의 doc-store / community / trees / memories 계열 함수

**용도**
- legacy CRUD
- 일부 legacy fallback read 또는 CI/local harness 경로

**누락 시 증상**
- Netlify dev 또는 legacy function 경로 실패 가능
- CI/E2E smoke에서 `netlify dev`가 이 변수 없이 실행되면 `/community/trees` 503 같은 local runtime failure가 발생할 수 있음

**운영 해석**
- CI/E2E에서 Netlify dev가 쓰인다는 사실은 production active runtime이 Netlify라는 뜻이 아닙니다.
- `netlify/functions/*`는 현재 Cloudflare Pages production backend가 아닙니다.
- Netlify 관련 환경변수 누락은 production Cloudflare/Modal runtime truth와 분리해 원인 분석합니다.

### FIREBASE_SERVICE_ACCOUNT_JSON

**직접 의존 범위**
- Netlify auth-required function 계열

**용도**
- 레거시 쓰기/권한 확인 경로

**누락 시 증상**
- 인증 필요한 legacy API 실패 가능

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
1. Cloudflare Pages production / preview URL에서 재현되는지 확인
2. `MODAL_BASE_URL`
3. Modal `/modal/health`
4. Modal `/modal/browse/latest?limit=3`
5. Pages 로그
6. Vercel fallback 동작 여부

### `/api/community/memories`만 실패한다
우선 확인:
1. Cloudflare Pages production / preview URL에서 재현되는지 확인
2. `MODAL_BASE_URL`
3. Modal community/memories 상태
4. Vercel fallback 상태
5. Pages 로그

### catch-all `/api/*`만 실패한다
우선 확인:
1. `LOVEBUD_UPSTREAM_ORIGIN`
2. Vercel upstream 상태
3. Pages 로그

### CI/E2E local Netlify dev만 실패한다
우선 확인:
1. 해당 failure가 GitHub Actions local harness인지 확인
2. `NETLIFY_DATABASE_URL` / `DATABASE_URL` 누락 여부 확인
3. production Cloudflare Pages URL에서 같은 failure가 재현되는지 분리 확인
4. PR 변경 범위가 package/workflow/test/runtime인지 확인

---

## 6. 운영 원칙 한 줄 정리

- **Cloudflare Pages**: 공식 사용자-facing production / preview entry + same-origin API entry
- **Modal**: active compute/runtime 우선 경로
- **Vercel**: deprecated transitional fallback / upstream under audit
- **Netlify**: legacy artifact. `netlify/functions/*`는 현재 active production backend가 아니며, local/CI harness only unless explicitly reactivated by CTO.
