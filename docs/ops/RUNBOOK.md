# LoveBud Runbook (운영 매뉴얼)

## 1. 프로젝트 주요 정보

- 공식 서비스 URL: `https://lovebud.pages.dev/`
- 운영 기준: `Cloudflare Pages Entry + Modal Active Runtime > Vercel Transitional Fallback > Netlify Legacy Artifact`
- Cloudflare Pages 역할: 공식 사용자-facing production / preview entry, 정적 프런트, same-origin `/api/*` entry
- Modal 역할: active compute/runtime 우선 경로, browse summary 및 private/community read/write target
- Vercel 역할: deprecated transitional fallback / upstream under audit
- Netlify 역할: legacy artifact / removal candidate. `netlify/functions/*`는 현재 `lovebud.pages.dev` production backend 또는 active production fallback이 아님

## 2. 현재 운영 구조

### Entry
- 브라우저 진입점은 Cloudflare Pages입니다.
- 정적 자산과 `/api/*` 상대 경로는 `lovebud.pages.dev` 기준으로 동작합니다.
- PR Preview / branch preview 검증도 Cloudflare Pages preview URL을 기준으로 봅니다.
- Browse/Search/API 의존 화면은 로컬 정적 서버 단독 결과로 PASS 처리하지 않습니다.

### Active Runtime
- Cloudflare Pages Functions가 same-origin `/api/*` entry를 담당합니다.
- browse summary는 Cloudflare Pages `functions/api/[[path]].js`가 `MODAL_BASE_URL` 기준 Modal을 먼저 호출합니다.
- Modal live endpoint:
  - `GET /modal/health`
  - `GET /modal/browse/latest?limit=3`
- Modal은 현재 active compute/runtime 우선 경로입니다.

### Fallback / Legacy
- Modal read 실패 시 Cloudflare Pages가 Vercel upstream으로 fallback 할 수 있습니다.
- catch-all `/api/*`의 기본 fallback upstream origin은 현재 Vercel입니다.
- Netlify 관련 파일과 `netlify/functions/*`는 legacy artifact / removal candidate로 남아 있습니다.
- Netlify는 active production fallback이 아니며, 새 backend feature/policy work의 대상이 아닙니다.
- Netlify 코드는 tests/docs transition 전까지 삭제 대상이라고 단정하지 않습니다. 별도 승인 없이 이동, archive, 삭제하지 않습니다.

## 3. 배포 절차

### Cloudflare Pages
- 공식 프런트 + same-origin API entry
- 주요 파일:
  - `functions/api/[[path]].js`
  - `pages/*.html`
- production / preview 검증 기준:
  - `https://lovebud.pages.dev/`
  - Cloudflare PR Preview URL
  - Cloudflare branch preview URL
  - fixed test slot URL when auth/runtime verification requires stable domain

### Modal
- 코드 위치: `modal_compute/app.py`
- 배포 명령: `modal deploy modal_compute/app.py`
- 확인 대상:
  - Modal Dashboard
  - `modal app logs lovebud-browse-snapshot`
  - `/modal/health`
  - `/modal/browse/latest?limit=3`
- 이번 문서 기준 정리는 Modal 코드나 배포를 변경하지 않습니다.

### Vercel
- 역할: deprecated transitional fallback / upstream under audit
- 공식 사용자-facing 주소가 아니라 보조 계층으로 취급

### Netlify
- 역할: legacy artifact / removal candidate
- 주서비스 주소, active runtime, active production fallback으로 취급하지 않습니다.
- `netlify.toml`, `netlify/functions/**`, `tests/functions/**`는 tests/docs transition 전까지 남아 있을 수 있습니다.
- `netlify/functions/*`는 현재 active runtime 구현 위치로 보지 않습니다.
- Netlify runtime 재활성화, 코드 이동, 삭제, archive는 별도 CTO 승인 전 수행하지 않습니다.
- 자세한 기준은 [NETLIFY_LEGACY_ARTIFACT_AUDIT.md](NETLIFY_LEGACY_ARTIFACT_AUDIT.md)를 따릅니다.

## 4. 장애 대응

### browse summary가 느리거나 비어 보일 때
확인 순서:
1. Cloudflare Pages preview / production URL에서 재현되는지 확인
2. `MODAL_BASE_URL`가 Cloudflare Pages에 설정되어 있는지 확인
3. Modal `/modal/health` 200 확인
4. Modal `/modal/browse/latest?limit=3` 응답 shape 확인
5. Modal 실패 시 Vercel fallback 응답 확인
6. Pages function logs 확인

### `/api/community/trees?view=summary` 실패
확인 순서:
1. Pages env의 `MODAL_BASE_URL`
2. Pages env의 `LOVEBUD_UPSTREAM_ORIGIN`
3. Modal live 상태
4. Vercel upstream 상태
5. Pages logs

### `/api/community/memories` 실패
확인 순서:
1. `MODAL_BASE_URL` 설정 확인
2. Modal community/memories 응답 확인
3. Vercel fallback 상태 확인
4. Pages logs 확인

### catch-all `/api/*` 실패
확인 순서:
1. `LOVEBUD_UPSTREAM_ORIGIN` 설정 확인
2. 설정이 없으면 기본값 `https://lovebud.vercel.app` 기준으로 동작하는지 확인
3. Vercel upstream 상태 확인

### CI/E2E에서 Netlify dev가 실패할 때
해석 기준:
1. CI/E2E smoke workflow가 `netlify dev`를 사용할 수 있습니다.
2. 이 경로는 CI 로컬 실행 harness이며, production active runtime 또는 active production fallback이 Netlify라는 뜻이 아닙니다.
3. Netlify dev의 `DATABASE_URL` / `NETLIFY_DATABASE_URL` 누락으로 발생하는 503은 production Cloudflare/Modal runtime truth와 분리해서 봅니다.
4. CI/E2E blocker를 이유로 `netlify/functions/*`를 active runtime처럼 수정하지 않습니다.
5. Netlify-targeting tests는 Cloudflare/Modal parity 확인 후 별도 migration/delete 승인 대상입니다.

### Fixed test slot access failure
해석 기준:
1. `test1.lovebud.pages.dev` 같은 fixed slot URL 접근 불가 또는 DNS 실패는 code/UI failure로 단정하지 않습니다.
2. slot URL 접근 실패, Cloudflare deploy failure, Firebase/Auth/domain failure, actual page runtime failure를 분리해 보고합니다.
3. fixed slot이 열리지만 target SHA 반영이 불명확하면 PARTIAL로 보고합니다.
4. Browser verifier가 실제 화면에 접근하지 못한 경우 Web/GitHub metadata 확인만으로 UI PASS를 선언하지 않습니다.
5. slot branch update/push는 Local/Ops executor만 수행합니다.
6. evidence에는 screenshot, console, network log의 token/password/cookie/private content 원문을 남기지 않습니다.
7. 세부 역할, PR Preview vs fixed slot decision rules, PARTIAL/BLOCKED 판정, evidence hygiene, release/restore 기준은 [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md)를 따릅니다.

## 5. 운영 환경 변수 체크리스트

### Cloudflare Pages 필수
- `MODAL_BASE_URL`
- `LOVEBUD_UPSTREAM_ORIGIN`

### Modal 필수
- `DATABASE_URL` (Modal secret `lovebud-db`)

### Modal 선택
- `CORS_ALLOWED_ORIGINS`

### Firebase 운영 체크
- Firebase Authentication Authorized Domains에 아래가 들어 있는지 확인
  - `lovebud.pages.dev`
  - `lovebud.vercel.app`
  - `lovebud.netlify.app`
  - `localhost`
  - `127.0.0.1`

## 6. 운영 점검 루틴

배포 후 아래 순서로 확인합니다.

1. `https://lovebud.pages.dev/` 로드
2. `https://lovebud.pages.dev/search.html` 로드
3. `/api/community/trees?view=summary&sort=latest&limit=3` 응답 확인
4. `/api/community/memories?treeId=<id>` 응답 확인
5. Modal `/modal/health` 응답 확인
6. Modal `/modal/browse/latest?limit=3` 응답 확인
7. Modal 차단 시 Vercel fallback이 browse를 계속 살리는지 확인
8. `https://lovebud.pages.dev/login.html`에서 Firebase 도메인 오류가 없는지 확인

## 7. 운영 원칙 한 줄 요약

- 공식 주소와 사용자-facing 검증 기준은 Cloudflare Pages (`pages.dev`)
- browse summary와 API compute의 1순위는 Modal
- Cloudflare Pages가 same-origin `/api/*` entry
- Vercel은 deprecated transitional fallback / upstream under audit
- Netlify는 legacy artifact / removal candidate이며, active production fallback이 아니고 `netlify/functions/*`는 현재 active production backend가 아님
- Netlify 제거는 Cloudflare/Modal route parity, Netlify-targeting test migration/deletion, CI import 제거, production/test slot route matrix 확인, active Netlify deploy target 미사용 확인 후 별도 승인으로만 진행합니다.
- fixed test slot 검증의 역할/판정/evidence 기준은 `docs/ops/TEST_PREVIEW_SLOTS.md`가 canonical입니다
