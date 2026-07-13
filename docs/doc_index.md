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

> **Agent-governance authority:** The canonical source of truth for agent / development / browser blocker and approval judgments is `docs/ops/MVP_AGENT_GOVERNANCE.md` (owner-approved #3442 comment `4947327550`). The browser/slot verification docs referenced below are evidence-depth guidance; where any of them classifies an MVP-de-escalated item (one-task-per-branch, draft-by-default, fixed-slot absence, missing entrypoint comment, dirty worktree, CTO-assigned URL, routine merge, production/localhost as pre-merge proof) as an automatic blocker, that is **not** repo-wide automatic-blocker authority and is superseded by `MVP_AGENT_GOVERNANCE.md`.

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
- `./ops/TREE_LIKE_RUNTIME_VERIFICATION_RUNBOOK.md`
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
- [lovebud-tree-layout-sync-contract.md](./product/lovebud-tree-layout-sync-contract.md) - #3056 Draft-first hub layout save and Neon checkpoint contract
- [lovebud-appreciation-order-contract.md](./product/lovebud-appreciation-order-contract.md) - #3061 Owner-controlled appreciation-order contract and guided path
- [lovebud-tree-experience-separation-boundaries.md](./product/lovebud-tree-experience-separation-boundaries.md) - #3054 Relationship map, appreciation order, hub layout, Scout suggestions separation boundaries
- [lovebud-first-tree-journey.md](./product/lovebud-first-tree-journey.md) - #2977 First-tree journey and automatic hub fallback design
- [lovebud-remaining-product-issues-status.md](./product/lovebud-remaining-product-issues-status.md) - #3086/#2980/#2863 Oversized module refactoring, emotion-flow defer, shared editing roles status
- [lovebud-scout-link-based-fan-assistant-mvp.md](./product/lovebud-scout-link-based-fan-assistant-mvp.md) - #1882 Scout link-based fan assistant MVP product definition
- [lovebud-scout-link-source-safety-boundary.md](./product/lovebud-scout-link-source-safety-boundary.md) - #3364/#1882 Scout MVP link-source safety boundary: allowed/disallowed sources, content handling, storage, attribution, implementation gates
- [lovebud-scout-manual-link-to-memory-flow-contract.md](./product/lovebud-scout-manual-link-to-memory-flow-contract.md) - #3373/#1882/#3365/#3364 Scout MVP manual link-to-memory draft flow contract: states, visible fields, blocked states, edit-before-save, #3365 inheritance
- [lovebud-scout-save-to-memory-payload-contract.md](./product/lovebud-scout-save-to-memory-payload-contract.md) - #3379/#1882/#3375/#3365/#3364/#3188/#3075 Scout MVP save-to-memory payload contract: payload shape, generated-vs-reviewed, required/optional/forbidden fields, source preservation, no raw/private, #3365/#3375 inheritance
- [lovebud-scout-manual-review-ui-readiness-audit.md](./product/lovebud-scout-manual-review-ui-readiness-audit.md) - #3383/#1882/#3379/#3380/#3373/#3375/#3364/#3365/#3188/#3075 Scout MVP manual review UI readiness audit: future states, edit-before-save/no-auto-save, attribution, full-content prohibition, accessibility, handoff gates, #3365/#3375/#3379 inheritance
- [lovebud-scout-reviewed-payload-route-intake-contract.md](./product/lovebud-scout-reviewed-payload-route-intake-contract.md) - #3386/#1882/#3383/#3384/#3379/#3380/#3373/#3375/#3364/#3365/#3188/#3075 Scout MVP reviewed payload route intake contract: reviewed-only acceptance, required/optional/forbidden fields, safe error taxonomy, idempotency, storage handoff, #3365/#3375/#3379/#3383 inheritance
- [lovebud-scout-reviewed-payload-route-readiness-audit.md](./product/lovebud-scout-reviewed-payload-route-readiness-audit.md) - #3389/#1882/#3386/#3387/#3383/#3384/#3379/#3380/#3375/#3365/#3188/#3075 Scout MVP reviewed payload route readiness audit: route location candidates, existing shell/stub/client/adapter reuse, #3386 intake inheritance, auth/storage/idempotency prerequisites, non-prod plan, #3365/#3375/#3379/#3383/#3386 inheritance
- [lovebud-scout-save-memory-storage-handoff-boundary-audit.md](./product/lovebud-scout-save-memory-storage-handoff-boundary-audit.md) - #3397/#1882/#3391/#3395/#3389/#3390/#3386/#3387/#3379/#3380/#3375/#3365/#3188/#3075 Scout MVP save-memory storage handoff boundary audit: current memory/storage conventions, future storage writer/helper candidates, treeId/draft-only UNRESOLVED posture, reviewed->write transformation, allowed/forbidden storage fields, idempotency/duplicate prevention, auth/ownership/tree-selection prerequisites, safe audit logging, safe error taxonomy, future child split, #3365/#3375/#3379/#3386/#3395 inheritance
- [lovebud-scout-save-memory-storage-writer-contract.md](./product/lovebud-scout-save-memory-storage-writer-contract.md) - #3402/#1882/#3397/#3399/#3391/#3395/#3389/#3390/#3386/#3387/#3379/#3380/#3375/#3365/#3188/#3075 Scout MVP save-memory storage writer contract: writer/helper path + export candidate, input/output DTO, owner identity from auth context (no client id), treeId/ownership UNRESOLVED/draft-only posture, allowed/forbidden defense-in-depth fields, idempotency/duplicate prevention, safe audit logging, safe error/result taxonomy, 4 implementation gates, #3365/#3375/#3379/#3386/#3395/#3397/#3399 inheritance
- [lovebud-scout-save-memory-target-tree-selection-contract.md](./product/lovebud-scout-save-memory-target-tree-selection-contract.md) - #3406/#1882/#3402/#3403/#3397/#3399/#3386/#3387/#3379/#3380/#3375/#3365/#3188/#3075 Scout MVP save-memory target tree selection contract: selection options (explicit treeId / draft-only holding), final resolution UNRESOLVED/deferred, reviewed-payload vs server-resolved context split, auth-derived owner identity (no client id), ownership validation (no cross-user), safe failure states, safe output posture, future persistReviewedScoutMemoryDraft handoff, 5 implementation gates, #3365/#3375/#3379/#3386/#3397/#3399/#3402 inheritance
- [lovebud-scout-save-memory-target-tree-ui-selection-contract.md](./product/lovebud-scout-save-memory-target-tree-ui-selection-contract.md) - #3409/#1882/#3407/#3406/#3402/#3403/#3397/#3399/#3386/#3387/#3379/#3380/#3375/#3365/#3188/#3075 Scout MVP save-memory target tree UI selection integration contract: existing LoveTree selection/listing affordance audit, target-tree selection placement on reviewed save surface, selected tree label/name, empty/missing/unavailable/invalid-stale/server-failure states, accessibility expectations (keyboard reachable/clear label/focus return/aria-live), client payload envelope (reviewed-only + treeId target-selection field + no client-supplied owner id), #3407 unresolved/deferred posture bridge, future route/intake handoff, safe copy/errors, 6 implementation gates, #3365/#3375/#3379/#3386/#3387/#3395/#3397/#3399/#3402/#3407 inheritance
- [lovebud-scout-auth-verifier-unblock-path.md](./product/lovebud-scout-auth-verifier-unblock-path.md) - #2660 Scout staging auth verifier unblock path definition
- [lovebud-scout-namu-lookup-harness-contract.md](./product/lovebud-scout-namu-lookup-harness-contract.md) - #3155 Scout namuwiki-style public lookup skill/harness design
- [lovebud-scout-staging-api-key-smoke-report.md](./product/lovebud-scout-staging-api-key-smoke-report.md) - #2636 Scout staging API-key smoke test report
- [UI_COPY_DIET_GUIDE.md](./product/UI_COPY_DIET_GUIDE.md) - UI 카피 다이어트 운영 기준
- [MVP_SCOPE.md](./product/MVP_SCOPE.md) - MVP 범위
- [USER_FLOW.md](./product/USER_FLOW.md) - 사용자 흐름
- [DATA_NAMING_RULE.md](./product/DATA_NAMING_RULE.md) - 데이터 명명 규칙
- [READONLY_SHARE_SCOPE.md](./product/READONLY_SHARE_SCOPE.md) - 읽기 전용 공유 범위
- [lovebud-tree-comment-storage-schema-boundary-audit.md](./product/lovebud-tree-comment-storage-schema-boundary-audit.md) - #3382/#3388 tree-level comment storage schema boundary audit (source-only, no migration)
- [lovebud-tree-comments-legacy-schema-reconciliation-runbook.md](./product/lovebud-tree-comments-legacy-schema-reconciliation-runbook.md) - #3423/#3418 legacy `tree_comments` reconciliation runbook (in-place ALTER, fail-closed, no destructive ops, rollback script prepared)
- [scripts/migration-reconcile-tree-comments-legacy-schema.sql](./scripts/migration-reconcile-tree-comments-legacy-schema.sql) - #3423 legacy `tree_comments` → canonical reconcile migration (static-only, not applied)
- [scripts/rollback-tree-comments-legacy-reconcile.sql](./scripts/rollback-tree-comments-legacy-reconcile.sql) - #3423 rollback to exact legacy 8-column schema (explicit approval only, zero-row guard)
- [tests/contracts/migration-tree-comments-legacy-reconcile-contract.test.cjs](./tests/contracts/migration-tree-comments-legacy-reconcile-contract.test.cjs) - #3423 reconcile migration contract test
- [tests/contracts/rollback-tree-comments-legacy-reconcile-contract.test.cjs](./tests/contracts/rollback-tree-comments-legacy-reconcile-contract.test.cjs) - #3423 rollback script contract test

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
   - [FRONTEND_SPLIT_PROGRESS_1505.md](./refactor/FRONTEND_SPLIT_PROGRESS_1505.md) - Issue #1505 frontend split 전체 진행 상태 및 차기 후보
   - [EDITOR_CANVAS_PREFLIGHT_AUDIT_1505.md](./refactor/EDITOR_CANVAS_PREFLIGHT_AUDIT_1505.md) - js/editor/editor-canvas.js 모듈 분리 preflight audit
   - [LAYOUT_MODE_TRANSITION_PREFLIGHT_AUDIT_1505.md](./refactor/LAYOUT_MODE_TRANSITION_PREFLIGHT_AUDIT_1505.md) - js/editor/editor-canvas.js 레이아웃 모드 전환 모듈 분리 preflight audit
   - [PUBLIC_VIEWER_SHELL_SPLIT_AUDIT.md](./engineering/PUBLIC_VIEWER_SHELL_SPLIT_AUDIT.md) - #2686 public viewer shell responsibility map, global namespace inventory, DOM ownership, low-risk split candidates, one-file-at-a-time follow-up plan
   - [AUTH_FLOW_OWNERSHIP_AUDIT.md](./engineering/AUTH_FLOW_OWNERSHIP_AUDIT.md) - #2712 auth entrypoints by page, Firebase init/listener ownership, cached-session lifecycle, protected-route lifecycle, login-page lifecycle, duplicated responsibilities, staged refactor plan
   - [global-namespace-bridges-audit-report.md](./audit/global-namespace-bridges-audit-report.md) - #3120 Global namespace bridges (window.*) audit report by boundary
   - [lovebud-changeability-production-parity-audit.md](./engineering/lovebud-changeability-production-parity-audit.md) - #3425 read-only architecture audit foundation: schema drift, test-layer gaps, deployment revision gaps, CSS scoping risks, legacy retention, domain boundaries, change-risk model, child-issue candidates (no rewrite, no production mutation)
  - [LEGACY_COMPATIBILITY_REGISTRY.md](./engineering/LEGACY_COMPATIBILITY_REGISTRY.md) - #3427 legacy/transitional artifact inventory, evidence, owner, exit conditions, verification, recovery
  - [TEST_LAYER_CLASSIFICATION.md](./engineering/TEST_LAYER_CLASSIFICATION.md) - #3429 default-CI Node test evidence-layer classification: vocabulary, reporter/contract, SOURCE_STATIC vs EXECUTED_FAKE vs real-local distinction, default CI vs supplemental separation

## security 문서군

보안 관련 문서는 `docs/security/` 아래에 정리됩니다.

- [FIREBASE_CLIENT_CONFIG_POLICY.md](./security/FIREBASE_CLIENT_CONFIG_POLICY.md) - Firebase 클라이언트 설정 노출 정책 및 보안 모델
- [FIREBASE_DEPLOYMENT_SECRET_POSTURE_RUNBOOK.md](./security/FIREBASE_DEPLOYMENT_SECRET_POSTURE_RUNBOOK.md) - Firebase Console, Google Cloud, Modal, Cloudflare, legacy deployment secret posture 검증 런북
- [FIRESTORE_RULES_HARDENING_PLAN.md](./security/FIRESTORE_RULES_HARDENING_PLAN.md) - Firestore owner/visibility/comment rule hardening staged plan and deployment gate

## ops 문서군

운영 문서는 `docs/ops/` 아래에 정리됩니다.

- **index**: [ops_index.md](./ops/ops_index.md)
- [OPERATIONS.md](./ops/OPERATIONS.md) - 현재 운영 전략 및 인프라 우선순위
- [SOURCE_OF_TRUTH_HYGIENE_DISPOSITION.md](./ops/SOURCE_OF_TRUTH_HYGIENE_DISPOSITION.md) - #425 docs source-of-truth hierarchy, stale-doc classification, update routing, archive and index maintenance rules
- [GLOBAL_CSS_BROWSER_SMOKE_CHECKLIST.md](./ops/GLOBAL_CSS_BROWSER_SMOKE_CHECKLIST.md) - #512 global CSS desktop/mobile smoke matrix, PASS/NOT_VERIFIED/BLOCKED reporting, fixed-slot requirements
- [NETLIFY_LEGACY_ARTIFACT_AUDIT.md](./ops/NETLIFY_LEGACY_ARTIFACT_AUDIT.md) - Netlify legacy artifact / removal candidate 감사 기준 및 현황. `netlify/functions/*`, `netlify.toml` removal audit 진행 상태
- [PARALLEL_WORKTREE_AGENT_POLICY.md](./ops/PARALLEL_WORKTREE_AGENT_POLICY.md) - 병렬 모델, worktree, 검증 모델, PR 통합 운영 기준
- [LOCAL_BROWSER_VERIFICATION_STARTUP.md](./ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md) - 로컬/브라우저 검증 시작 전 공통 preflight, URL provenance, evidence, PR checklist 기준
- [AGENT_STARTUP_VERIFICATION_RULES.md](./ops/AGENT_STARTUP_VERIFICATION_RULES.md) - Agent startup checklist, fixed-slot verification, dirty worktree stop, token-safe reporting 기준
- [BROWSER_VERIFICATION_URL_POLICY.md](./ops/BROWSER_VERIFICATION_URL_POLICY.md) - 브라우저 smoke URL provenance, PR Preview, Branch Preview, fixed test slot 검증 기준
- [TEST_PREVIEW_SLOTS.md](./ops/TEST_PREVIEW_SLOTS.md) - 고정 테스트 Preview 슬롯 운영 기준
- [MODAL_RUNTIME_DIAGNOSTICS_WORKFLOW.md](./ops/MODAL_RUNTIME_DIAGNOSTICS_WORKFLOW.md) - Cloudflare and Modal runtime diagnostics workflow, request ID correlation, redaction-safe report templates
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
- [AGENT_OPERATION_GUARDRAILS.md](./project/AGENT_OPERATION_GUARDRAILS.md) - 파일 inspection과 secret 노출의 경계, fixed-slot browser verification, test account handling, 병렬 프롬프트 중복 방지, 범위 밖 입력 확인, implementation handoff 기준
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
- [FRONTEND_ROADMAP.md](./plans/FRONTEND_ROADMAP.md) *(corrupted legacy, see #898)*
- [ROADMAP.md](./plans/ROADMAP.md)

## archive 문서군

보관 문서는 `docs/archive/` 아래에 정리됩니다.

- **index**: [archive_index.md](./archive/archive_index.md)

## conversation 문서군

대화 기록 문서는 `docs/conversation/` 아래에 정리됩니다.

- [conversation/full/full_index.md](./conversation/full/full_index.md) - 전체 대화 기록
- [conversation/summary/summary_index.md](./conversation/summary/summary_index.md) - 요약 기록
