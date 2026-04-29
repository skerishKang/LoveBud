# LoveBud 문서 인덱스

이 문서는 LoveBud 프로젝트의 문서 구조와 읽기 순서를 정리한 최상위 인덱스입니다.

실서비스 프론트 주소는 `https://lovebud.pages.dev/` 이며, 현재 운영 기준 인프라 우선순위는 **Cloudflare Pages Entry + Modal Runtime > Vercel > Netlify** 입니다.

중요:
- 브라우저는 가능하면 **same-origin `/api`** 만 사용합니다.
- 공식 사용자-facing 주소는 `pages.dev` 기준으로 설명합니다.
- active runtime entry: Cloudflare Pages (same-origin `/api/*` router + 정적 프런트)
- active backend target: Modal (browse summary, private/community read/write compute)
- Vercel은 upstream / secondary entry / 전이기 보조 계층입니다.
- Netlify는 legacy artifact / removal candidate입니다. active production fallback이 아닙니다.
- `PRODUCT_IDENTITY / BRAND_EXPERIENCE / UI_DESIGN_SYSTEM` 은 제품/브랜드/UI 판단의 source of truth 입니다.
- prototype/reference/demo/variant 폴더는 repo hygiene에서 자동 cleanup 대상으로 분류하지 않습니다.
- `pages/gpt-v2/`, `css/gpt-v2/`, `assets/gpt-v2/`, `pages/gemini-v2/`, `css/gemini-v2/`, `pages/gemini-v3/`, `css/gemini-v3/`, `pages/v2/`, `css/v2/`, `pages/kimi-v2/`, `assets/css/kimi-v2/`, `assets/js/kimi-v2/`, `hotspot-prototype/`, `scrapbook-demo/`, `quiet/`, `pages/gpt-svg-tree/` 및 PR #7 관련 prototype은 보존합니다.
- prototype/reference/demo/variant의 canonical inventory는 `docs/reference/PROTOTYPE_INDEX.md`입니다.
- 신규 tree의 정책상 기본 visibility는 `public`입니다.
- private storage는 Plus entitlement가 필요합니다.
- memory visibility가 생략되면 parent tree visibility를 상속합니다.
- explicit memory visibility는 backend policy가 허용하는 범위에서만 상속값을 override할 수 있습니다.
- private tree 아래 explicit public memory는 저장될 수 있습니다.
- stored memory visibility 와 anonymous public exposure 는 다른 개념입니다.
- anonymous public read 는 `memory.visibility = public` 과 `parent tree.visibility = public` 을 모두 요구합니다.
- public visibility 와 Browse/Search eligibility 는 다른 개념입니다.
- Browse/Search introduction 은 `publicMomentCount >= 3` 이 필요합니다.
- Browse/Search introduction, community memories list, public memory detail read 는 parent tree visibility guard 를 함께 확인해야 합니다.
- owner/private read 는 private access policy 에 따라 private tree 아래 public/private memory 를 조회할 수 있습니다.

---

## 먼저 읽기

새 작업을 시작할 때 권장 순서는 아래와 같습니다.

1. `../AGENTS.md`
2. `./doc_index.md`
3. `./ops/PARALLEL_WORKTREE_AGENT_POLICY.md`
4. `./product/PRODUCT_IDENTITY.md`
5. `./product/BRAND_EXPERIENCE.md`
6. `./design/UI_DESIGN_SYSTEM.md`
7. 요청 범위에 맞는 문서군 인덱스

Visibility, private storage, anonymous public exposure, Browse/Search eligibility 판단이 필요하면 아래를 추가로 읽습니다.

- `./product/PUBLICATION_AND_PRIVACY_UX_POLICY.md`
- `./engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`

Prototype/reference/demo/variant 폴더 정리, 보존, repo hygiene 판단이 필요하면 아래를 추가로 읽습니다.

- `./design/PROTOTYPE_REFERENCE_POLICY.md`
- `./reference/PROTOTYPE_INDEX.md` - reference only: prototype / variant / demo / reference 경로 목록과 active production route 아님을 명시한 canonical inventory

UI polish 단계 분리, PR3/PR4/PR5 범위 판단이 필요하면 아래를 추가로 읽습니다.

- `./design/UI_POLISH_ROADMAP.md`

PR3 button / badge / chip tone 기준 판단이 필요하면 아래를 추가로 읽습니다.

- `./design/BUTTON_BADGE_CHIP_BASELINE.md`

운영/배포/브라우저 검증 판단이 필요하면 아래를 추가로 읽습니다.

- `./ops/OPERATIONS.md`
- `./ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md`
- `./ops/NETLIFY_LEGACY_ARTIFACT_AUDIT.md`
- `./ops/PARALLEL_WORKTREE_AGENT_POLICY.md`
- `./ops/BROWSER_VERIFICATION_URL_POLICY.md`
- `./ops/TEST_PREVIEW_SLOTS.md`
- `./ops/KNOWN_CI_E2E_BLOCKERS.md`
- `./ops/BRANCH_CLEANUP_PLAN.md`
- `./migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
- `./engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`
- `./engineering/REVIEW_GUARDRAILS.md`

검증 warning / blocker 분류가 필요하면 아래를 추가로 읽습니다.

- `./project/VERIFICATION_WARNING_CATALOG.md`

---

## product 문서군

제품 관련 문서는 `docs/product/` 아래에 정리됩니다.

- **index**: [product_index.md](./product/product_index.md)
- [PRODUCT_BRIEF.md](./product/PRODUCT_BRIEF.md) - 현재 실행 기준 제품 개요
- [PRODUCT_IDENTITY.md](./product/PRODUCT_IDENTITY.md) - 제품 정체성 source of truth 및 public-first 감상 공간 원칙
- [BRAND_EXPERIENCE.md](./product/BRAND_EXPERIENCE.md) - 브랜드 감성 / UX 표현 원칙 source of truth
- [PUBLICATION_AND_PRIVACY_UX_POLICY.md](./product/PUBLICATION_AND_PRIVACY_UX_POLICY.md) - public-first visibility, Plus private storage, memory visibility inheritance, anonymous public exposure, Browse/Search eligibility 정책
- [UI_COPY_DIET_GUIDE.md](./product/UI_COPY_DIET_GUIDE.md) - UI 카피 다이어트 운영 기준
- [MVP_SCOPE.md](./product/MVP_SCOPE.md) - MVP 범위
- [USER_FLOW.md](./product/USER_FLOW.md) - 사용자 흐름
- [DATA_NAMING_RULE.md](./product/DATA_NAMING_RULE.md) - 데이터 명명 규칙
- [READONLY_SHARE_SCOPE.md](./product/READONLY_SHARE_SCOPE.md) - 읽기 전용 공유 범위

## design 문서군

디자인 문서는 `docs/design/` 아래에 정리됩니다.

- **index**: [design_index.md](./design/design_index.md)
- [UI_DESIGN_SYSTEM.md](./design/UI_DESIGN_SYSTEM.md) - UI 구조 / 감정 위계 / 컴포넌트 규칙 source of truth
- [UI_POLISH_ROADMAP.md](./design/UI_POLISH_ROADMAP.md) - PR #49, #51, #62, #63, #66, #67, #69, #70 이후 public UI polish와 Search 후속 작업 범위 분리 기준
- [BUTTON_BADGE_CHIP_BASELINE.md](./design/BUTTON_BADGE_CHIP_BASELINE.md) - button / badge / chip tone 통일 기준
- [PRIMARY_COLOR_TOKEN_CLEANUP_PLAN.md](./design/PRIMARY_COLOR_TOKEN_CLEANUP_PLAN.md) - `rgba(144, 73, 81, X)` 반복을 `--primary-rgb` token 기반으로 단계 정리하기 위한 계획
- [PROTOTYPE_REFERENCE_POLICY.md](./design/PROTOTYPE_REFERENCE_POLICY.md) - prototype/reference/demo/variant 폴더 보존 정책
- [PAGE_TRANSITION_REVEAL_COVERAGE.md](./ux/PAGE_TRANSITION_REVEAL_COVERAGE.md) - 페이지 전환 및 reveal 효과 커버리지 맵
- [prompts/image-generation-prompts.md](./design/prompts/image-generation-prompts.md) - 이미지 생성 프롬프트 모음
- [prompts/home-hero-slide-prompts.txt](./design/prompts/home-hero-slide-prompts.txt) - 홈 히어로 슬라이드 프롬프트
- [stitch_image_to_website/DESIGN.md](./design/stitch_image_to_website/DESIGN.md) - Stitch image-to-website reference design note. 현재 active UI polish source of truth는 아님

## reference 문서군

Reference 문서는 `docs/reference/` 아래에 정리됩니다.

- [PROTOTYPE_INDEX.md](./reference/PROTOTYPE_INDEX.md) - reference only: prototype / variant / demo / reference 경로 목록과 운영 편입 금지 기준

## engineering 문서군

엔지니어링 문서는 `docs/engineering/` 아래에 정리됩니다.

- **index**: [engineering_index.md](./engineering/engineering_index.md)
- [API_CONTRACT.md](./engineering/API_CONTRACT.md) - flat camelCase API 계약
- [BROWSE_FILTER_VS_PUBLICATION_GUARD.md](./engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md) - stored visibility, anonymous public exposure, Browse/Search eligibility, Browse display filter 개념 분리
- [CSS_ARCHITECTURE.md](./engineering/CSS_ARCHITECTURE.md) - CSS import hub, split ownership, import order, visual verification 기준
- [CODE_ARCHITECTURE.md](./engineering/CODE_ARCHITECTURE.md) - module size, thin entrypoint, browser-global split, large file refactor safety policy
- [SCRIPT_LOAD_ORDER.md](./engineering/SCRIPT_LOAD_ORDER.md) - pages/*.html script load order runtime contract, Auth/Login dependency order, reorder checklist
- [SEARCH_RUNTIME_CONTRACT.md](./engineering/SEARCH_RUNTIME_CONTRACT.md) - Search/Browse runtime script order, globals, forbidden changes, smoke checklist
- [AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md](./engineering/AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md) - Auth/Login active provider transition 단계, file ownership, 금지 조합, fixed test slot 검증 기준
- [SUPABASE_FREE_POC_PLAN.md](./engineering/SUPABASE_FREE_POC_PLAN.md) - Supabase Free PoC 기반 장기 backend 구조 단순화 검증 계획
- [REVIEW_GUARDRAILS.md](./engineering/REVIEW_GUARDRAILS.md) - 반복 false positive 방지 규칙
- [RECENT_REFACTORING.md](./engineering/RECENT_REFACTORING.md) - 최근 리팩터링 기록

## security 문서군

보안 관련 문서는 `docs/security/` 아래에 정리됩니다.

- [FIREBASE_CLIENT_CONFIG_POLICY.md](./security/FIREBASE_CLIENT_CONFIG_POLICY.md) - Firebase 클라이언트 설정 노출 정책 및 보안 모델

## ops 문서군

운영 문서는 `docs/ops/` 아래에 정리됩니다.

- **index**: [ops_index.md](./ops/ops_index.md)
- [OPERATIONS.md](./ops/OPERATIONS.md) - 현재 운영 전략 및 인프라 우선순위
- [NETLIFY_LEGACY_ARTIFACT_AUDIT.md](./ops/NETLIFY_LEGACY_ARTIFACT_AUDIT.md) - Netlify legacy artifact / removal candidate 감사 기준 및 현황. `netlify/functions/*`, `netlify.toml` removal audit 진행 상태
- [PARALLEL_WORKTREE_AGENT_POLICY.md](./ops/PARALLEL_WORKTREE_AGENT_POLICY.md) - 병렬 모델, worktree, 검증 모델, PR 통합 운영 기준
- [LOCAL_BROWSER_VERIFICATION_STARTUP.md](./ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md) - 로컬/브라우저 검증 시작 전 공통 preflight, URL provenance, evidence, PR checklist 기준
- [BROWSER_VERIFICATION_URL_POLICY.md](./ops/BROWSER_VERIFICATION_URL_POLICY.md) - 브라우저 smoke URL provenance, PR Preview, Branch Preview, fixed test slot 검증 기준
- [TEST_PREVIEW_SLOTS.md](./ops/TEST_PREVIEW_SLOTS.md) - 고정 테스트 Preview 슬롯 운영 기준
- [DEPLOY_CHECKLIST.md](./ops/DEPLOY_CHECKLIST.md) - 배포 체크리스트
- [RUNBOOK.md](./ops/RUNBOOK.md) - 운영 / 장애 대응 런북
- [DOC_WORKFLOW.md](./ops/DOC_WORKFLOW.md) - 문서 작업 흐름
- [SKILL_REGISTRY.md](./ops/SKILL_REGISTRY.md) - 스킬 레지스트리
- [AI_REQUEST_PATTERNS.md](./ops/AI_REQUEST_PATTERNS.md) - 요청 패턴 해석
- [KNOWN_CI_E2E_BLOCKERS.md](./ops/KNOWN_CI_E2E_BLOCKERS.md) - 반복 CI/E2E blocker 원인 분리 및 exception merge 판단 기준
- [BRANCH_CLEANUP_PLAN.md](./ops/BRANCH_CLEANUP_PLAN.md) - PR #49~#58 이후 merged/stale branch cleanup 후보와 보존 branch 분류 기준
- [EDITOR_ARCHITECTURE.md](./ops/EDITOR_ARCHITECTURE.md) - editor 구조 설명

## project 문서군

프로젝트 운영 문서는 `docs/project/` 아래에 정리됩니다.

- **index**: [project_index.md](./project/project_index.md)
- [REPORTING_CHAIN.md](./project/REPORTING_CHAIN.md) - 3TF 구조, TF별 Lead, 실행 모델, 보고선
- [PROJECT_OPERATING_MODEL.md](./project/PROJECT_OPERATING_MODEL.md) - 역할, 책임, 승인권, 세션 시작 프로토콜
- [BRANCHING_AND_REVIEW.md](./project/BRANCHING_AND_REVIEW.md) - main 우선 확인, 브랜치 작업, 리뷰/검증/완료 보고 원칙
- [LOCAL_MODEL_WORKFLOW.md](./project/LOCAL_MODEL_WORKFLOW.md) - 로컬 실행 모델 작업 기준
- [TASK_STATUS.md](./project/TASK_STATUS.md) - 작업 상태 추적 문서
- [VERIFICATION_AND_EVIDENCE.md](./project/VERIFICATION_AND_EVIDENCE.md) - 검증 및 증빙 기준
- [VERIFICATION_WARNING_CATALOG.md](./project/VERIFICATION_WARNING_CATALOG.md) - UI/production/test preview 검증 warning과 blocker 분류 기준

## migration 문서군

마이그레이션 관련 문서는 `docs/migration/` 아래에 정리됩니다.

- [VERCEL_MODAL_MIGRATION_RUNBOOK.md](./migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md) - Cloudflare Pages / Modal 전환 현황과 남은 과제

## pages 문서군

페이지별 문서는 `docs/pages/` 아래에 정리됩니다.

- [pages_index.md](./pages/pages_index.md)

## backend 문서군

백엔드 관련 문서는 `docs/backend/` 아래에 정리됩니다.

- **index**: [backend_index.md](./backend/backend_index.md)
- [backend.md](./backend/backend.md) - 백엔드 개요
- [DATA_MODEL_DRAFT.md](./backend/DATA_MODEL_DRAFT.md) - 데이터 모델 초안

## reports 문서군

분석/개선 보고서는 `docs/reports/` 아래에 정리됩니다.

- **index**: [reports_index.md](./reports/reports_index.md)
- [UI_COPY_IMPROVEMENT_REPORT.md](./reports/UI_COPY_IMPROVEMENT_REPORT.md)
- [UX-Improvement.md](./reports/UX-Improvement.md)
- [DOCS_REORG_PLAN.md](./reports/DOCS_REORG_PLAN.md)
- [RELEASE_NOTE_20260410_AI_AND_DB.md](./reports/RELEASE_NOTE_20260410_AI_AND_DB.md)

## plans 문서군

실행 계획은 `docs/plans/` 아래에 정리됩니다.

- **index**: [plans_index.md](./plans/plans_index.md)
- [FRONTEND_ROADMAP.md](./plans/FRONTEND_ROADMAP.md)
- [ROADMAP.md](./plans/ROADMAP.md)

## archive 문서군

보관 문서는 `docs/archive/` 아래에 정리됩니다.

- **index**: [archive_index.md](./archive/archive_index.md)

## conversation 문서군

대화 기록 문서는 `docs/conversation/` 아래에 정리됩니다.

- [conversation/full/full_index.md](./conversation/full/full_index.md) - 전체 대화 기록
- [conversation/summary/summary_index.md](./conversation/summary/summary_index.md) - 요약 기록
