# Local Model Workflow

## 목적

이 문서는 프로젝트 공통 로컬 실행 규칙을 정리합니다.

## 공통 로컬 실행 원칙

- worktree 사용
- main 직접 수정 금지
- 브랜치 기반 작업
- 검증 수행 및 구분 보고

## 작업 시작 전 브랜치 확정 절차

로컬 실행 모델은 CTO 지시문에 브랜치명 예시가 있더라도 이를 확정값으로 간주하지 않습니다. 병렬 모델이 동시에 작업할 수 있으므로, 실제 브랜치명은 로컬 모델이 최신 원격 상태를 확인한 뒤 확정합니다.

작업 시작 전 반드시 아래 절차를 수행합니다.

1. `git fetch origin --prune`
2. `git checkout main`
3. `git pull origin main`
4. `gh pr list --state open --limit 100` 또는 동등한 PR 조회
5. `git branch -r`로 원격 브랜치 충돌 확인
6. 작업 성격에 맞는 고유 브랜치명 확정
7. 확정한 브랜치명을 첫 보고에 포함

브랜치명 충돌이 있으면 작업을 중단하지 말고 고유 suffix를 붙여 새 브랜치를 선택합니다.

예:

- `cleanup/editor-presentation-inline-styles-v2`
- `refactor/editor-css-split-entrypoint-20260427`
- `docs/runtime-guardrails-followup-v1`

단, 기존 브랜치 재사용, force push, PR source branch 갱신은 CTO가 명시적으로 승인한 경우에만 수행합니다.

## 로컬 검증의 위치

로컬 모델은 코드 수정, 구문 확인, 정적 레이아웃 참고, diff 확인, 테스트 실행에 유용합니다.

다만 LoveBud는 Cloudflare Pages Functions, same-origin `/api/*`, Modal upstream, Firebase authentication/session state에 의존합니다.

따라서 로컬 정적 서버는 모든 UI의 최종 검증 환경이 아닙니다.

### PR 병합 전 UI 검증 우선순위

1. Cloudflare Pages PR Preview URL
2. 이미 확보한 테스트/프리뷰 페이지 URL
3. 로컬 서버 — 정적 레이아웃 참고용 fallback

### 로컬 서버 단독 최종 판정 금지

아래 화면/흐름은 로컬 정적 서버만으로 최종 PASS/BLOCKER를 판단하지 않습니다.

- Browse / Search 페이지
- Editor 페이지
- My Trees 페이지
- Auth-gated 페이지
- `/api/*`를 호출하는 모든 페이지
- Cloudflare Pages Functions에 의존하는 페이지
- Modal upstream에 의존하는 페이지
- Firebase authentication 또는 session state에 의존하는 페이지

이런 화면에서 로컬 서버로 “불러오기 실패”가 나오면 즉시 제품 회귀로 단정하지 않습니다. Cloudflare Preview 또는 준비된 테스트/프리뷰 URL에서 Network, Console, `/api` status를 확인해야 합니다.

### Production 검증의 위치

`https://lovebud.pages.dev/`는 PR 병합 전 source of truth가 아닙니다. production 도메인은 현재 `main`을 반영합니다.

Production 검증은 PR이 `main`에 병합되고 배포된 뒤 최종 확인으로 수행합니다.

## 보고 기준

로컬 모델은 검증 결과를 보고할 때 아래를 구분합니다.

- Cloudflare Preview 검증
- 테스트/프리뷰 URL 검증
- production 검증
- 로컬 정적 레이아웃 참고
- 코드 분석 또는 추정

로컬 검증만 수행한 경우에는 “최종 검증 완료”라고 쓰지 않고, “로컬 기준”, “정적 레이아웃 참고”, “추정”으로 표시합니다.

## 관련 문서

- [REPORTING_CHAIN.md](./REPORTING_CHAIN.md)
- [PROJECT_OPERATING_MODEL.md](./PROJECT_OPERATING_MODEL.md)
- [VERIFICATION_AND_EVIDENCE.md](./VERIFICATION_AND_EVIDENCE.md)
