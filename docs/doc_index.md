# LoveBud 문서 인덱스

이 문서는 LoveBud 프로젝트의 문서 구조를 안내합니다.
루트의 `index.html`과 혼동을 줄이기 위해 문서 인덱스 파일명은 `doc_index.md`를 사용합니다.

## conversation 문서군

대화 기록 관련 문서는 `docs/conversation/` 아래에 정리됩니다.

- **full/** - 대화 전문 전체 기록
  - 각 세션의 전체 대화 내용을 보관합니다.
  - [full_index.md](./conversation/full/full_index.md)에서 목록을 확인하세요.

- **summary/** - 대화 요약본
  - 각 세션의 핵심 요약만 정리합니다.
  - [summary_index.md](./conversation/summary/summary_index.md)에서 목록을 확인하세요.

## product 문서군

제품 관련 문서는 `docs/product/` 아래에 정리됩니다.

- **index**: [product_index.md](./product/product_index.md) - 제품 문서 인덱스
- [PRODUCT_BRIEF.md](./product/PRODUCT_BRIEF.md) - 현재 실행 기준 제품 개요
- [PRODUCT_IDENTITY.md](./product/PRODUCT_IDENTITY.md) - 정체성/원칙
- [MVP_SCOPE.md](./product/MVP_SCOPE.md) - MVP 정의
- [USER_FLOW.md](./product/USER_FLOW.md) - 사용자 흐름
- [DATA_NAMING_RULE.md](./product/DATA_NAMING_RULE.md) - 데이터 명명 규칙
- [READONLY_SHARE_SCOPE.md](./product/READONLY_SHARE_SCOPE.md) - 읽기 전용 공유 범위
- **identity-source/**: [인터뷰 원본](./product/identity-source/) — 제품 정체성 인터뷰 소스 자료

## design 문서군

UI/UX 디자인 및 비주얼 프롬프트는 `docs/design/` 아래에 정리됩니다.

- **index**: [design_index.md](./design/design_index.md) - 디자인 문서 인덱스
- [prompts/image-generation-prompts.md](./design/prompts/image-generation-prompts.md) - 이미지 생성 프롬프트 모음 (12개 화면)
- [prompts/home-hero-slide-prompts.txt](./design/prompts/home-hero-slide-prompts.txt) - 홈 히어로 슬라이드 이미지 생성 프롬프트 (5장)

## pages 문서군

페이지별 문서는 `docs/pages/` 아래에 정리됩니다.

- [pages_index.md](./pages/pages_index.md) - 페이지 문서 인덱스

## reports 문서군

분석/개선 보고서는 `docs/reports/` 아래에 정리됩니다.

- **index**: [reports_index.md](./reports/reports_index.md) - 보고서 인덱스
- [UI_COPY_IMPROVEMENT_REPORT.md](./reports/UI_COPY_IMPROVEMENT_REPORT.md) - UI 카피 개선 보고서
- [UX-Improvement.md](./reports/UX-Improvement.md) - UX 개선안
- [DOCS_REORG_PLAN.md](./reports/DOCS_REORG_PLAN.md) - 문서 재구성 계획 *(루트에서 이동)*
- [RELEASE_NOTE_20260410_AI_AND_DB.md](./reports/RELEASE_NOTE_20260410_AI_AND_DB.md) - 2026-04-10 AI/DB 마이그레이션 릴리스 노트 *(ops에서 이동)*
- [notebookLM_design.txt](./reports/notebookLM_design.txt) - NotebookLM 디자인 분석 *(루트에서 이동)*

## plans 문서군

실행 계획 및 로드맵은 `docs/plans/` 아래에 정리됩니다.

- **index**: [plans_index.md](./plans/plans_index.md) - 계획 인덱스
- [FRONTEND_ROADMAP.md](./plans/FRONTEND_ROADMAP.md) - 프론트엔드 구현 로드맵 *(backend에서 이동)*
- [ROADMAP.md](./plans/ROADMAP.md) - 프로젝트 로드맵 *(product에서 이동)*

## archive 문서군

레거시/보관 문서는 `docs/archive/` 아래에 정리됩니다.

- **index**: [archive_index.md](./archive/archive_index.md) - 보관 문서 인덱스
- 하위 폴더: `analysis/`, `guides/`, `plans/`, `identity/`
- [minimax2.7_draft.txt](./archive/plans/minimax2.7_draft.txt) - Minimax 2.7 초안 *(루트에서 이동)*

## engineering 문서군

기술/엔지니어링 관련 문서는 `docs/engineering/` 아래에 정리됩니다.

- **index**: [engineering_index.md](./engineering/engineering_index.md) - 엔지니어링 문서 인덱스
- [API_CONTRACT.md](./engineering/API_CONTRACT.md) - API 응답 계약 (flat camelCase 표준)
- [RECENT_REFACTORING.md](./engineering/RECENT_REFACTORING.md) - 최근 리팩터링 기록 (2026-04)

## backend 문서군

백엔드 관련 문서는 `docs/backend/` 아래에 정리됩니다.

- **index**: [backend_index.md](./backend/backend_index.md) - 백엔드 문서군 안내
- [backend.md](./backend/backend.md) - Netlify Functions 백엔드 개요 *(루트에서 이동)*
- [DATA_MODEL_DRAFT.md](./backend/DATA_MODEL_DRAFT.md) - 데이터 모델 초안 *(product에서 이동)*

## ops 문서군

운영 관련 문서는 `docs/ops/` 아래에 정리됩니다.

- **index**: [ops_index.md](./ops/ops_index.md) - 운영 문서 인덱스
- [PATHS_AND_SHELLS.md](./ops/PATHS_AND_SHELLS.md) - 컴1/컴2 경로와 셸 기준
- [REMOTE_ACCESS_AND_WSL.md](./ops/REMOTE_ACCESS_AND_WSL.md) - 컴1 -> 컴2 SSH, WSL `G:` 마운트, Windows Codex 셸 실행 이슈
- [DOC_WORKFLOW.md](./ops/DOC_WORKFLOW.md) - 대화 → 문서 → 구현으로 이어지는 작업 흐름
- [ASSET_VERSIONING.md](./ops/ASSET_VERSIONING.md) - 정적 자산 버저닝
- [CACHE_POLICY.md](./ops/CACHE_POLICY.md) - 캐시 정책
- [DEPLOY_CHECKLIST.md](./ops/DEPLOY_CHECKLIST.md) - 배포 체크리스트
- [EDITOR_ARCHITECTURE.md](./ops/EDITOR_ARCHITECTURE.md) - 에디터 아키텍처
- [ENV_DEPENDENCY.md](./ops/ENV_DEPENDENCY.md) - 환경 변수 의존성
- [FILE_BASELINE.md](./ops/FILE_BASELINE.md) - 파일 분류 기준표
- [FLOW_A_QA_CHECKLIST.md](./ops/FLOW_A_QA_CHECKLIST.md) - Flow-A QA 체크리스트
- [GIT_SSH_SETUP.md](./ops/GIT_SSH_SETUP.md) - Git/SSH 설정
- [LOCAL_SECRETS.md](./ops/LOCAL_SECRETS.md) - 로컬 비밀값 관리
- [OPERATIONS.md](./ops/OPERATIONS.md) - 운영 가이드
- [PR_CHECKLIST.md](./ops/PR_CHECKLIST.md) - PR 체크리스트
- [QA_CREDENTIALS.txt](./ops/QA_CREDENTIALS.txt) - QA 테스트 계정
- [RUNBOOK.md](./ops/RUNBOOK.md) - 런북 (장애 대응)
- [backend.md](./ops/backend.md) - Netlify Functions 백엔드 개요 *(루트에서 이동)*
- [git_tutorial.md](./ops/git_tutorial.md) - Git 튜토리얼 *(루트에서 이동)*
- [CTO_MVP_HANDOFF.md](./ops/CTO_MVP_HANDOFF.md) - CTO 핸드오프 문서 *(product에서 이동)*
