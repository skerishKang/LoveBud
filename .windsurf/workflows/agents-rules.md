---
description: LoveBud 에이전트 작업 기준 및 운영 규칙
---

# LoveBud 에이전트 작업 기준

이 워크플로우는 LoveBud 저장소에서 여러 작업자와 에이전트가 같은 기준으로 판단하고 협업하기 위한 운영 기준입니다.

## 최상위 원칙

1. **현재 `main`을 먼저 읽습니다.**
2. **추정하지 않습니다.**
3. **최소 수정 원칙을 유지합니다.**
4. **요청 범위를 넘는 변경을 하지 않습니다.**
5. **문서와 코드의 source of truth를 구분합니다.**
6. **다른 에이전트와 병렬 작업 중일 수 있음을 전제로 행동합니다.**

## 세션 시작 프로토콜

새 작업을 시작할 때 기본 순서는 아래와 같습니다.

1. `AGENTS.md` (또는 이 워크플로우)
2. `docs/doc_index.md`
3. 요청 범위와 직접 관련된 문서 인덱스
4. 제품 판단이 필요하면:
   - `docs/product/PRODUCT_IDENTITY.md`
   - `docs/product/BRAND_EXPERIENCE.md`
   - `docs/design/UI_DESIGN_SYSTEM.md`
5. 운영 판단이 필요하면:
   - `docs/ops/OPERATIONS.md`
   - `docs/ops/AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md`
   - `docs/ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md`
   - `docs/ops/GITHUB_AUTH_TOKEN_USAGE.md`
   - `docs/ops/BROWSER_VERIFICATION_URL_POLICY.md`
   - `docs/ops/TEST_PREVIEW_SLOTS.md`
   - `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`

## 제품 / 브랜드 source of truth

제품과 UX 판단이 필요할 때 아래 문서를 최우선으로 봅니다.

1. `docs/product/PRODUCT_IDENTITY.md`
2. `docs/product/BRAND_EXPERIENCE.md`
3. `docs/design/UI_DESIGN_SYSTEM.md`

## 현재 서비스 / 인프라 기준

### 실서비스 주소
- `https://lovebud.pages.dev/`

### 인프라 우선순위
1. **Modal**
2. **Cloudflare Pages**
3. **Vercel**
4. **Netlify**

### UI 검증 환경 우선순위

PR 병합 전 UI 검증 우선순위는 아래와 같습니다.

1. **Cloudflare Pages PR Preview URL**
2. **해당 작업을 위해 이미 확보한 테스트/프리뷰 페이지 URL**
3. **로컬 서버** — 정적 레이아웃 참고용 fallback

아래 화면/흐름은 로컬 정적 서버 단독으로 최종 판단하지 않습니다.

- Browse / Search 페이지
- Editor 페이지
- My Trees 페이지
- Auth-gated 페이지
- `/api/*`를 호출하는 모든 페이지
- Cloudflare Pages Functions에 의존하는 페이지
- Modal upstream에 의존하는 페이지
- Firebase authentication 또는 session state에 의존하는 페이지

## Secrets / credentials 취급 규칙

**중요: 에이전트는 절대 비밀 값을 출력, 붙여넣기, 요약, 스크린샷, 로깅, 커밋, 노출하지 않습니다.**

### 허용되는 것
- 비밀 이름, 필요한 위치, 존재 여부 참조
- 필요한 비밀 파일 존재 여부 확인
- 필요한 비밀 키 존재 여부 확인 (값 출력 없이)
- 승인된 명령이나 테스트를 위해 로컬 비밀 파일을 환경에 로드
- `PRESENT`, `EXISTS`, `GITIGNORED` 등 상태만 보고

### 금지되는 것
- 원본 비밀 값 출력
- 부분 비밀 값 출력
- 자격 증명 접두사, 접미사, 마지막 문자 출력
- 비밀을 issue/PR comment, docs, chat, screenshot, log, report에 복사
- 개인 키, service account JSON, token, cookie, session 값 요약
- 비밀 파일이나 비밀 값이 포함된 생성 파일 커밋
- 비밀을 stdout/stderr로 echo하는 명령 실행
- 모든 환경 변수를 덤프하는 명령 실행

### 로컬 전용 경로
- `.secrets/`
- `.env`
- `.env.*`

이 경로들은 로컬 전용이며, 저장소에 커밋하거나 PR, issue, 문서, 로그, 스크린샷, 보고서에 값을 노출하지 않습니다.

## Secret 값이 필요한 경우 처리 방법

작업에 secret이 필요하면 에이전트는 다음 방식으로 처리합니다:

1. **로컬 환경 사용**: 사용자가 미리 로컬 환경 변수에 값을 설정해두면, 에이전트는 그 환경 변수를 사용하는 명령을 실행합니다. 에이전트는 환경 변수 값을 읽거나 출력하지 않고, 환경 변수가 설정되어 있는지 여부만 확인합니다.

2. **사용자 직접 주입**: 로컬 환경이 설정되어 있지 않으면, 에이전트는 사용자에게 "비밀 값이 필요합니다. [secret name]을 로컬 환경에 설정하거나 직접 입력해주세요"라고 요청합니다. 사용자가 직접 값을 입력하거나 설정합니다.

3. **Provider Dashboard 사용**: 배포나 외부 서비스 연동이 필요한 경우, 에이전트는 사용자에게 해당 provider dashboard (GitHub Actions Secrets, Cloudflare/Vercel/Netlify dashboard 등)에서 값을 설정하도록 안내합니다.

에이전트는 어떤 경우에도 비밀 값을 직접 읽거나 출력하지 않습니다.

## 코드 작업 원칙

- 최소 수정 원칙 유지
- 넓은 리팩터링 금지
- 요청 범위 밖 파일 수정 금지
- 코드 로직 변경이 필요하면 관련 문서 기준과 충돌하지 않는지 먼저 확인

### Module size / thin entrypoint policy

핵심 원칙:
- 신규 파일은 가능한 한 500줄 이하로 유지합니다.
- entry file은 thin entrypoint / orchestration shell로 유지합니다.
- 실제 로직은 feature별 helper/module 파일로 분리합니다.
- 한 파일에 UI, API, state, cache, validation, rendering, auth, fallback 책임을 누적하지 않습니다.

## Git Workflow

- `main` 브랜치를 직접 수정하지 않습니다.
- `main` 브랜치에 직접 푸시하지 않습니다.
- `main` 브랜치를 merge하지 않습니다.
- 한 작업은 하나의 브랜치에서 수행합니다.
- PR은 기본적으로 draft로 생성합니다.

## PR 보존

- #7 번호 또는 prototype/reference/demo/variant 라벨이 있는 PR은 보존하며 임의로 닫거나 브랜치를 삭제하지 않습니다.
- 임의의 PR preview URL을 추측하여 접근하지 않습니다.

## 한 줄 요약

LoveBud 작업은 항상 **현재 `main` 확인 → source of truth 확인 → 최소 수정 → 범위 내 검증 → 직접 수정/기존 반영 구분 보고** 순서로 진행합니다.
