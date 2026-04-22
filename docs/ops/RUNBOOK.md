# LoveBud Runbook (운영 매뉴얼)

## 1. 프로젝트 주요 정보

- 공식 서비스 URL: `https://lovebud.pages.dev/`
- 운영 우선순위: `Modal > Cloudflare Pages > Vercel > Netlify`
- Modal 앱: `lovebud-browse-snapshot`
- Vercel 역할: upstream / secondary entry
- Netlify 역할: legacy write / fallback

## 2. 현재 운영 구조

### Entry
- 브라우저 진입점은 Cloudflare Pages입니다.
- 정적 자산과 `/api/*` 상대 경로는 `lovebud.pages.dev` 기준으로 동작합니다.

### Primary Read
- browse summary는 Cloudflare Pages `functions/api/[[path]].js`가 `MODAL_BASE_URL` 기준 Modal을 먼저 호출합니다.
- Modal live endpoint:
  - `GET /modal/health`
  - `GET /modal/browse/latest?limit=3`

### Fallback / Legacy
- Modal read 실패 시 Cloudflare Pages가 Vercel upstream으로 fallback 합니다.
- catch-all `/api/*`의 기본 upstream origin은 현재 Vercel입니다.
- Netlify는 여전히 legacy / fallback 계층으로 남아 있습니다.

## 3. 배포 절차

### Cloudflare Pages
- 공식 프런트 + same-origin API entry
- 주요 파일:
  - `functions/api/[[path]].js`
  - `pages/*.html`

### Modal
- 코드 위치: `modal_compute/app.py`
- 배포 명령: `modal deploy modal_compute/app.py`
- 확인 대상:
  - Modal Dashboard
  - `modal app logs lovebud-browse-snapshot`
  - `/modal/health`
  - `/modal/browse/latest?limit=3`

### Vercel
- 역할: upstream / secondary entry 유지
- 공식 사용자-facing 주소가 아니라 보조 계층으로 취급

### Netlify
- 역할: legacy backend / fallback 유지
- 주서비스 주소가 아니라 보조 계층으로 취급

## 4. 장애 대응

### browse summary가 느리거나 비어 보일 때
확인 순서:
1. `MODAL_BASE_URL`가 Cloudflare Pages에 설정되어 있는지 확인
2. Modal `/modal/health` 200 확인
3. Modal `/modal/browse/latest?limit=3` 응답 shape 확인
4. Modal 실패 시 Vercel fallback 응답 확인
5. Pages function logs 확인

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

- 공식 주소는 Cloudflare Pages (`pages.dev`)
- browse summary의 1순위는 Modal
- Cloudflare Pages가 same-origin entry
- Vercel은 upstream / secondary entry
- Netlify는 fallback / legacy
