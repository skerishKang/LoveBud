# LoveBud Runbook (운영 매뉴얼)

## 1. 프로젝트 주요 정보

- 공식 서비스 URL: `https://lovebud.vercel.app/`
- 운영 우선순위: `Modal > Vercel > Netlify`
- Modal 앱: `lovebud-browse-snapshot`
- Netlify 역할: legacy write / fallback

## 2. 현재 운영 구조

### Entry
- 브라우저 진입점은 Vercel입니다.
- 정적 자산과 `/api/*` 상대 경로는 `lovebud.vercel.app` 기준으로 동작합니다.

### Primary Read
- browse summary는 Vercel `api/community/trees.js`가 `MODAL_BASE_URL` 기준 Modal을 먼저 호출합니다.
- Modal live endpoint:
  - `GET /modal/health`
  - `GET /modal/browse/latest?limit=3`

### Fallback / Legacy
- Modal browse summary 실패 시 Netlify `/community/trees`로 fallback 합니다.
- browse preview hydrate(`/api/community/memories`)와 catch-all `/api/*`는 아직 Netlify upstream을 사용합니다.

## 3. 배포 절차

### Vercel
- main 브랜치 반영 시 자동 배포
- 역할: 프런트 + same-origin API entry
- 주요 파일:
  - `vercel.json`
  - `api/community/trees.js`
  - `api/community/memories.js`
  - `api/[...path].js`

### Modal
- 코드 위치: `modal_compute/app.py`
- 배포 명령: `modal deploy modal_compute/app.py`
- 확인 대상:
  - Modal Dashboard
  - `modal app logs lovebud-browse-snapshot`
  - `/modal/health`
  - `/modal/browse/latest?limit=3`

### Netlify
- 역할: legacy backend / fallback 유지
- 주서비스 주소가 아니라 보조 계층으로 취급

## 4. 장애 대응

### browse summary가 느리거나 비어 보일 때
확인 순서:
1. `MODAL_BASE_URL`가 Vercel에 설정되어 있는지 확인
2. Modal `/modal/health` 200 확인
3. Modal `/modal/browse/latest?limit=3` 응답 shape 확인
4. Modal 실패 시 Netlify fallback 응답 확인
5. Vercel function logs 확인

### `/api/community/trees?view=summary` 실패
확인 순서:
1. Vercel env의 `MODAL_BASE_URL`
2. Vercel env의 `NETLIFY_API_BASE_URL`
3. Modal live 상태
4. Netlify `/community/trees` 상태
5. Vercel logs / Netlify logs

### `/api/community/memories` 실패
확인 순서:
1. `NETLIFY_API_BASE_URL` 설정 확인
2. Netlify `/community/memories` 상태 확인
3. Vercel logs 확인

### catch-all `/api/*` 실패
확인 순서:
1. `LOVEBUD_UPSTREAM_API_BASE` 설정 확인
2. 설정이 없으면 기본값 `https://lovebud.netlify.app/api` 기준으로 동작하는지 확인
3. Netlify upstream 상태 확인

## 5. 운영 환경 변수 체크리스트

### Vercel 필수
- `MODAL_BASE_URL`
- `NETLIFY_API_BASE_URL`
- `LOVEBUD_UPSTREAM_API_BASE`

### Modal 필수
- `DATABASE_URL` (Modal secret `lovebud-db`)

### Modal 선택
- `CORS_ALLOWED_ORIGINS`

### Firebase 운영 체크
- Firebase Authentication Authorized Domains에 아래가 들어 있는지 확인
  - `lovebud.vercel.app`
  - `lovebud.netlify.app`
  - `localhost`
  - `127.0.0.1`

## 6. 운영 점검 루틴

배포 후 아래 순서로 확인합니다.

1. `https://lovebud.vercel.app/` 로드
2. `https://lovebud.vercel.app/search.html` 로드
3. `/api/community/trees?view=summary&sort=latest&limit=3` 응답 확인
4. Modal `/modal/health` 응답 확인
5. Modal `/modal/browse/latest?limit=3` 응답 확인
6. Modal 차단 시 Netlify fallback이 계속 browse를 살리는지 확인
7. `https://lovebud.vercel.app/login.html`에서 Firebase 도메인 오류가 없는지 확인

## 7. 운영 원칙 한 줄 요약

- 공식 주소는 Vercel
- browse summary의 1순위는 Modal
- Netlify는 fallback / legacy
