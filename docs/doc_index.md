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
4. `./ops/AGENT_STARTUP_VERIFICATION_RULES.md`
5. `./project/AGENT_OPERATION_GUARDRAILS.md`
6. `./product/PRODUCT_IDENTITY.md`
7. `./product/BRAND_EXPERIENCE.md`
8. `./design/UI_DESIGN_SYSTEM.md`
9. 요청 범위에 맞는 문서군 인덱스

Visibility, private storage, anonymous public exposure, Browse/Search eligibility 판단이 필요하면 아래를 추가로 읽습니다.

- `./product/PUBLICATION_AND_PRIVACY_UX_POLICY.md`
- `./engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`

Browse sort/social count 판단이 필요하면 아래를 추가로 읽습니다.

- `./product/BROWSE_POPULAR_SORT_SEMANTICS.md`
- `./product/lovebud-browse-tree-social-counts-plan.md`
- `./product/lovebud-browse-tree-view-count-policy.md`

Prototype/reference/demo/variant 폴더 정리, 보존, repo hygiene 판단이 필요하면 아래를 추가로 읽습니다.

- `./design/PROTOTYPE_REFERENCE_POLICY.md`
- `./reference/PROTOTYPE_INDEX.md` - reference only: prototype / variant / demo / reference 경로 목록과 active production route 아님을 명시한 canonical inventory

Docs source-of-truth hygiene, stale-doc classification, archive routing 판단이 필요하면 아래를 추가로 읽습니다.

- `./ops/SOURCE_OF_TRUTH_HYGIENE_DISPOSITION.md`

UI polish 단계 분리, PR3/PR4/PR5 범위 판단이 필요하면 아래를 추가로 읽습니다.

- `./design/UI_POLISH_ROADMAP.md`

PR3 button / badge / chip tone 기준 판단이 필요하면 아래를 추가로 읽습니다.

- `./design/BUTTON_BADGE_CHIP_BASELINE.md`

운영/배포/브라우저 검증 판단이 필요하면 아래를 추가로 읽습니다.

- `./ops/OPERATIONS.md`
- `./ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md`
- `./ops/AGENT_STARTUP_VERIFICATION_RULES.md`
- `./ops/NETLIFY_LEGACY_ARTIFACT_AUDIT.md`
- `./ops/PARALLEL_WORKTREE_AGENT_POLICY.md`
- `./ops/BROWSER_VERIFICATION_URL_POLICY.md`
- `./ops/GLOBAL_CSS_BROWSER_SMOKE_CHECKLIST.md`
- `./ops/TEST_PREVIEW_SLOTS.md`
- `./ops/KNOWN_CI_E2E_BLOCKERS.md`
- `./ops/BRANCH_CLEANUP_PLAN.md`
- `./ops/MODAL_RUNTIME_DIAGNOSTICS_WORKFLOW.md`
- `./migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`

테스트 데이터(트리/순간) 생성이 필요하면 아래 워크플로우 가이드를 참고합니다.

- `../.windsurf/workflows/tree-moment-creation-guide.md` — 테스트 환경에서 러브트리와 순간 생성 방법
- `./engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`
- `./engineering/REVIEW_GUARDRAILS.md`

Global CSS token/readiness ownership 판단이 필요하면 아래를 추가로 읽습니다.

- `./engineering/GLOBAL_CSS_TOKEN_READINESS_AUDIT.md`

Global focus/visibility hardening 판단이 필요하면 아래를 추가로 읽습니다.

- `./engineering/GLOBAL_FOCUS_VISIBILITY_HARDENING_AUDIT.md`

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
- [BROWSE_POPULAR_SORT_SEMANTICS.md](./product/BROWSE_POPULAR_SORT_SEMANTICS.md) - Browse `popular` sort의 현재 memory-count proxy 의미와 v0.1 표시 정책 방향
- [lovebud-browse-tree-social-counts-plan.md](./product/lovebud-browse-tree-social-counts-plan.md) - #1661 tree-level Browse social counts foundation plan
- [lovebud-browse-tree-view-count-policy.md](./product/lovebud-browse-tree-view-count-policy.md) - #1661 Unit B tree-level view count policy
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
- [GLOBAL_CSS_TOKEN_READINESS_AUDIT.md](./engineering/GLOBAL_CSS_TOKEN_READINESS_AUDIT.md) - #510 global CSS token groups, readiness selector aliases, duplication candidates, future PR split, and #512 verification linkage
- [GLOBAL_FOCUS_VISIBILITY_HARDENING_AUDIT.md](./engineering/GLOBAL_FOCUS_VISIBILITY_HARDENING_AUDIT.md) - #511 global focus and visibility selector groups, affected surfaces, forbidden combinations, future narrow PR shapes, and #512 verification linkage
- [CODE_ARCHITECTURE.md](./engineering/CODE_ARCHITECTURE.md) - module size, thin entrypoint, browser-global split, large file refactor safety policy
- [LARGE_FILE_MODULARIZATION_CANDIDATES.md](./engineering/LARGE_FILE_MODULARIZATION_CANDIDATES.md) - #408 large-file candidate inventory, owner routing, extraction guardrails, verification requirements
- [MODAL_OWNER_ROUTE_SPLIT_BOUNDARY.md](./engineering/MODAL_OWNER_ROUTE_SPLIT_BOUNDARY.md) - #423 Modal owner read/write route split boundary, implementation gates, verification requirements
- [SCRIPT_LOAD_ORDER.md](./engineering/SCRIPT_LOAD_ORDER.md) - pages/*.html script load order runtime contract, Auth/Login dependency order, reorder checklist
- [SEARCH_RUNTIME_CONTRACT.md](./engineering/SEARCH_RUNTIME_CONTRACT.md) - Search/Browse runtime script order, globals, forbidden changes, smoke checklist
- [AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md](./engineering/AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md) - Auth/Login active provider transition 단계, file ownership, 금지 조합, fixed test slot 검증 기준
- [EDITOR_BRANCH_SLOT_INTERACTION_PLAN_653.md](./engineering/EDITOR_BRANCH_SLOT_INTERACTION_PLAN_653.md) - #653 Editor branch slot interaction plan, #655 viewport prerequisite, owner-only slot boundary, staged implementation gates
- [SUPABASE_FREE_POC_PLAN.md](./engineering/SUPABASE_FREE_POC_PLAN.md) - Supabase Free PoC 기반 장기 backend 구조 단순화 검증 계획
- [REVIEW_GUARDRAILS.md](./engineering/REVIEW_GUARDRAILS.md) - 반복 false positive 방지 규칙
- [RECENT_REFACTORING.md](./engineering/RECENT_REFACTORING.md) - 최근 코드 구조 정리 이력
 - [PUBLIC_TREE_ADAPTER_BOUNDARY_AUDIT.md](./engineering/PUBLIC_TREE_ADAPTER_BOUNDARY_AUDIT.md) - #412 public tree adapter helper boundaries, export contract, loading-order risk, preview implications audit
 - [AUTH_EDITOR_RUNTIME_INVENTORY_834.md](./engineering/AUTH_EDITOR_RUNTIME_INVENTORY_834.md) - #834 auth/editor runtime inventory, dependency mapping, naming consistency audit, decomposition candidates
 - [VIEWPORT_ORCHESTRATION_HOLD_DECISION.md](./engineering/VIEWPORT_ORCHESTRATION_HOLD_DECISION.md) - Viewport orchestration split 완료 및 constants/readableCenter hold 판단 문서
