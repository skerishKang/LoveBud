# LoveBud Engineering 문서 인덱스
이 문서는 LoveBud 워크플로우 문서의 현재 기준 및 읽기 순서를 정리합니다.

현재 운영 전제는 아래와 같습니다.

- 테스트 서비스 엔트리포인트: `https://lovebud.pages.dev/`
- 인프라 우선순위: **Modal > Cloudflare Pages > Vercel > Netlify**
- Cloudflare Pages는 공식 user-facing entry이자 same-origin `/api` router입니다.
- Modal은 active compute/runtime 우선 경로입니다.
- Vercel은 upstream / secondary / transitional fallback 계층입니다.
- Netlify는 legacy artifact / removal candidate입니다. active production fallback은 아닙니다.
- 브라우저에서 가능하면 **same-origin `/api`** 만 사용합니다.
- browse display filter와 publication guard는 다른 문제로 독립했습니다.

---

## 먼저 읽기

1. [API_CONTRACT.md](./API_CONTRACT.md) - API 응답 계약 (flat camelCase)
2. [BROWSE_FILTER_VS_PUBLICATION_GUARD.md](./BROWSE_FILTER_VS_PUBLICATION_GUARD.md) - browse filter / publication guard 구분
3. [CODE_ARCHITECTURE.md](./CODE_ARCHITECTURE.md) - module size, thin entrypoint, browser-global split, large file refactor safety policy
4. [LARGE_FILE_MODULARIZATION_CANDIDATES.md](./LARGE_FILE_MODULARIZATION_CANDIDATES.md) - #408 500+ line large-file candidate inventory, owner routing, extraction guardrails
5. [MODAL_OWNER_ROUTE_SPLIT_BOUNDARY.md](./MODAL_OWNER_ROUTE_SPLIT_BOUNDARY.md) - #423 Modal owner read/write route split boundary, implementation gates, verification requirements
6. [CORE_RUNTIME_BOUNDARY_MAP.md](./CORE_RUNTIME_BOUNDARY_MAP.md) - #428 core runtime module owner domains, runtime boundaries, verification requirements
7. [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md) - stylesheet import hub, split ownership, visual verification 기준
8. [GLOBAL_CSS_TOKEN_READINESS_AUDIT.md](./GLOBAL_CSS_TOKEN_READINESS_AUDIT.md) - #510 global CSS token and readiness selector ownership audit, future PR split, #512 verification linkage
9. [GLOBAL_FOCUS_VISIBILITY_HARDENING_AUDIT.md](./GLOBAL_FOCUS_VISIBILITY_HARDENING_AUDIT.md) - #511 global focus and visibility selector audit, affected surfaces, allowed future PR shapes, and #512 verification linkage
10. [SCRIPT_LOAD_ORDER.md](./SCRIPT_LOAD_ORDER.md) - pages/*.html script order runtime contract, Auth/Login dependency order, reorder checklist
11. [SEARCH_RUNTIME_CONTRACT.md](./SEARCH_RUNTIME_CONTRACT.md) - Search/Browse runtime script order, globals, submodule boundary
12. [AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md](./AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md) - Auth/Login active provider transition 단계, file ownership, forbidden combinations, fixed slot smoke 기준
13. [TECHNICAL_DEBT_CHECKLIST_DISPOSITION.md](./TECHNICAL_DEBT_CHECKLIST_DISPOSITION.md) - #224 technical-debt checklist disposition map
14. [CSS_HTML_CLEANUP_STATUS_MAP.md](./CSS_HTML_CLEANUP_STATUS_MAP.md) - #137 CSS/HTML cleanup backlog 상태와 잔여 작업 순서
15. [EDITOR_FALLBACK_GLOBAL_STATE_AUDIT.md](./EDITOR_FALLBACK_GLOBAL_STATE_AUDIT.md) - Editor fallback factories와 global state cleanup path 감사 계획
16. [AUTH_EDITOR_FALLBACK_CHECKLIST_MAPPING.md](./AUTH_EDITOR_FALLBACK_CHECKLIST_MAPPING.md) - #224 Auth/Editor fallback findings의 #78/#223/#225 ownership mapping
17. [STAGED_RUNTIME_CLEANUP_DISPOSITION.md](./STAGED_RUNTIME_CLEANUP_DISPOSITION.md) - #225 staged runtime cleanup items disposition map
18. [SHARED_HEADER_CONFIG_HELPER_DECISION.md](./SHARED_HEADER_CONFIG_HELPER_DECISION.md) - Shared header config/helper extraction defer 결정과 follow-up trigger
19. [REVIEW_GUARDRAILS.md](./REVIEW_GUARDRAILS.md) - 반복 false positive 방지 규칙
20. [RECENT_REFACTORING.md](./RECENT_REFACTORING.md) - 최근 리팩터링 기록
21. [EDITOR_OVERRIDES_RELOCATION_AUDIT.md](./EDITOR_OVERRIDES_RELOCATION_AUDIT.md) - css/editor/overrides.css role-based relocation 사전 audit (구현 없음, #137 종속)
22. [EDITOR_HIDDEN_COMPATIBILITY_OVERRIDE_AUDIT.md](./EDITOR_HIDDEN_COMPATIBILITY_OVERRIDE_AUDIT.md) - #516 editor hidden/compatibility selector usage audit, disposition map, and future removal/relocation gates
23. [REPOSITORY_STRUCTURE_FOLLOWUP_STATUS_MAP.md](./REPOSITORY_STRUCTURE_FOLLOWUP_STATUS_MAP.md) - Issue #223 repository structure follow-up bucket disposition, active blockers, and closure conditions
24. [PUBLIC_TREE_ADAPTER_BOUNDARY_AUDIT.md](./PUBLIC_TREE_ADAPTER_BOUNDARY_AUDIT.md) - #412 public tree adapter helper boundaries, export contract, loading-order risk, preview implications audit

---

## 핵심 문서

| 문서 | 설명 |
|------|------|
| [API_CONTRACT.md](./API_CONTRACT.md) | 프론트엔드 API가 따르는 flat camelCase 계약 |
| [BROWSE_FILTER_VS_PUBLICATION_GUARD.md](./BROWSE_FILTER_VS_PUBLICATION_GUARD.md) | browse 표시 정책과 publication guard 분리 기준 |
| [CODE_ARCHITECTURE.md](./CODE_ARCHITECTURE.md) | 파일 크기, thin entrypoint, browser-global module split, 대형 파일 리팩터링 안전 정책 |
| [LARGE_FILE_MODULARIZATION_CANDIDATES.md](./LARGE_FILE_MODULARIZATION_CANDIDATES.md) | Issue #408 large-file candidate inventory, owner-domain routing, extraction guardrails, verification requirements |
| [MODAL_OWNER_ROUTE_SPLIT_BOUNDARY.md](./MODAL_OWNER_ROUTE_SPLIT_BOUNDARY.md) | Issue #423 Modal owner read/write route split boundary, implementation gates, Cloudflare boundary, verification expectations |
| [CORE_RUNTIME_BOUNDARY_MAP.md](./CORE_RUNTIME_BOUNDARY_MAP.md) | Issue #428 core runtime module ownership, frontend/backend/runtime boundaries, namespace and verification requirements |
| [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md) | CSS import hub, split ownership, import order, visual verification 기준 |
| [GLOBAL_CSS_TOKEN_READINESS_AUDIT.md](./GLOBAL_CSS_TOKEN_READINESS_AUDIT.md) | Issue #510 global CSS token groups, readiness selector aliases, duplication candidates, future PR split, and #512 verification linkage |
| [GLOBAL_FOCUS_VISIBILITY_HARDENING_AUDIT.md](./GLOBAL_FOCUS_VISIBILITY_HARDENING_AUDIT.md) | Issue #511 global focus and visibility selector groups, affected surfaces, forbidden combinations, future narrow PR shapes, and #512 verification linkage |
| [SCRIPT_LOAD_ORDER.md](./SCRIPT_LOAD_ORDER.md) | pages/*.html script load order runtime contract, Auth/Login dependency order, reorder checklist |
| [SEARCH_RUNTIME_CONTRACT.md](./SEARCH_RUNTIME_CONTRACT.md) | Search/Browse runtime script order, globals, smoke checklist |
| [SEARCH_PREVIEW_CONTROLLER_SPLIT_AUDIT.md](./SEARCH_PREVIEW_CONTROLLER_SPLIT_AUDIT.md) | Search/Browse preview controller split 준비 audit와 종속 구현 guardrail |
| [PUBLIC_TREE_ADAPTER_BOUNDARY_AUDIT.md](./PUBLIC_TREE_ADAPTER_BOUNDARY_AUDIT.md) | #412 public tree adapter helper boundaries, export contract, loading-order risk, preview implications audit |
| [AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md](./AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md) | Auth/Login active provider transition 단계, file ownership, forbidden combinations, fixed slot smoke 기준 |
| [REPOSITORY_STRUCTURE_FOLLOWUP_STATUS_MAP.md](./REPOSITORY_STRUCTURE_FOLLOWUP_STATUS_MAP.md) | Issue #223 repository structure follow-up bucket disposition, active blockers, and closure conditions |
| [CSS_HTML_CLEANUP_STATUS_MAP.md](./CSS_HTML_CLEANUP_STATUS_MAP.md) | Issue #137 CSS/HTML cleanup backlog의 completed/in-progress/remaining bucket과 recommended sequence |
| [EDITOR_FALLBACK_GLOBAL_STATE_AUDIT.md](./EDITOR_FALLBACK_GLOBAL_STATE_AUDIT.md) | Editor fallback factories, `window.currentTreeMemories`, `window.currentTreeData`, compatibility aliases, future store migration 기준 |
| [AUTH_EDITOR_FALLBACK_CHECKLIST_MAPPING.md](./AUTH_EDITOR_FALLBACK_CHECKLIST_MAPPING.md) | Auth fallback cleanup, Editor fallback factories, and `window.currentTreeMemories/currentTreeData` ownership mapping for #224/#78/#223/#225 |
| [SHARED_HEADER_CONFIG_HELPER_DECISION.md](./SHARED_HEADER_CONFIG_HELPER_DECISION.md) | Shared header render/mobile nav/language/Auth/path helper 책임과 config/helper extraction defer 기준 |
| [EDITOR_OVERRIDES_RELOCATION_AUDIT.md](./EDITOR_OVERRIDES_RELOCATION_AUDIT.md) | `css/editor/overrides.css` role-based relocation 사전 audit (구현 없음, cascade 위험 문서, future PR split 계획 (#137 종속)) |
| [EDITOR_HIDDEN_COMPATIBILITY_OVERRIDE_AUDIT.md](./EDITOR_HIDDEN_COMPATIBILITY_OVERRIDE_AUDIT.md) | Issue #516 hidden/compatibility selector references, runtime linkage, removal/relocation disposition, and future browser verification gates |
| [SUPABASE_FREE_POC_PLAN.md](./SUPABASE_FREE_POC_PLAN.md) | Supabase Free PoC 기반 장기 backend 구조 단순화 검증 계획 |
| [REVIEW_GUARDRAILS.md](./REVIEW_GUARDRAILS.md) | 반복 false positive 방지 및 리뷰 규칙 |
| [RECENT_REFACTORING.md](./RECENT_REFACTORING.md) | 최근 코드 구조 정리 이력 |
| [UTIL_USAGE_POLICY.md](./UTIL_USAGE_POLICY.md) | 공통 유틸 사용 정책 |
| [COMMON_CODE_CANDIDATES.md](./COMMON_CODE_CANDIDATES.md) | 공통 코드 사전 후보 |
| [FIREBASE_CONFIG_GLOBAL_MIGRATION_STRATEGY.md](./FIREBASE_CONFIG_GLOBAL_MIGRATION_STRATEGY.md) | Firebase config/global migration staged strategy |
| [FIREBASE_CONFIG_CONTRACT.md](./FIREBASE_CONFIG_CONTRACT.md) | Firebase config/init global contract |
| [CTO_REPORT_20260418.md](./CTO_REPORT_20260418.md) | 특정 시점 워크플로우 요약 |

---

## 읽을 때 주의사항
- 엔지니어링 문서는 제품 철학 문서의 대체물이 아닙니다.
- 제품 / 브랜딩 / UI 판단은 먼저 아래 문서를 봅니다.
  - `../product/PRODUCT_IDENTITY.md`
  - `../product/BRAND_EXPERIENCE.md`
  - `../design/UI_DESIGN_SYSTEM.md`
- 워크플로우 문서는 현재 계약, 구조, 분리 기준, 전환 원칙을 설명하는 용도로 사용합니다.
- 런타임 / 배포 판단은 `../ops/OPERATIONS.md`와 `../migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`의 현재 기준을 우선합니다.
- 반복되는 오판 방지는 `REVIEW_GUARDRAILS.md`를 기준으로 합니다.
- 신규 코드 구조, thin entrypoint, browser-global split, 대형 파일 리팩터링 순서는 `CODE_ARCHITECTURE.md`를 기준으로 합니다.
- #408 large-file candidate 판단은 `LARGE_FILE_MODULARIZATION_CANDIDATES.md`에서 owner routing and forbidden scope를 먼저 확인합니다.
- #423 Modal owner-route split 판단은 `MODAL_OWNER_ROUTE_SPLIT_BOUNDARY.md`에서 completed public-read work, remaining owner read/write gates, and verification expectations를 먼저 확인합니다.
- core runtime owner domain, namespace contract, and verification boundary decisions start from `CORE_RUNTIME_BOUNDARY_MAP.md`.
- CSS import hub, global token/readiness selector ownership, and future readiness dedupe decisions start from `GLOBAL_CSS_TOKEN_READINESS_AUDIT.md` and `../ops/GLOBAL_CSS_BROWSER_SMOKE_CHECKLIST.md`.
- Global focus/visibility hardening decisions start from `GLOBAL_FOCUS_VISIBILITY_HARDENING_AUDIT.md` and must use `../ops/GLOBAL_CSS_BROWSER_SMOKE_CHECKLIST.md` for implementation verification.
- pages/*.html script order 변경 판단은 `SCRIPT_LOAD_ORDER.md`를 먼저 보고, Auth/Login active provider 전환은 `AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md`와 함께 봅니다.
- Auth/Login active provider 전환은 `AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md`의 phase gate와 금지 조합을 기준으로 합니다.
- CSS import hub, split ownership, visual verification 판단은 `CSS_ARCHITECTURE.md`와 `../ops/BROWSER_VERIFICATION_URL_POLICY.md`를 함께 봅니다.
- #223 repository structure follow-up closure 판단은 `REPOSITORY_STRUCTURE_FOLLOWUP_STATUS_MAP.md`에서 active blockers and closure conditions를 먼저 확인합니다.
- #224 technical-debt checklist disposition 판단은 `TECHNICAL_DEBT_CHECKLIST_DISPOSITION.md`에서 item ownership and closure blockers를 먼저 확인합니다.
- Editor fallback factory, `window.currentTreeMemories`, `window.currentTreeData`, compatibility alias 정리는 `EDITOR_FALLBACK_GLOBAL_STATE_AUDIT.md`의 audit gate를 먼저 통과해야 합니다.
- #224 Auth/Editor fallback checklist 판단은 `AUTH_EDITOR_FALLBACK_CHECKLIST_MAPPING.md`에서 #78/#223/#225 ownership mapping을 먼저 확인합니다.
- Shared header config/path helper extraction 판단은 `SHARED_HEADER_CONFIG_HELPER_DECISION.md`의 defer 조건과 follow-up trigger를 먼저 확인합니다.
- `css/editor/overrides.css` relocation 판단은 `EDITOR_OVERRIDES_RELOCATION_AUDIT.md`의 cascade risk 및 future implementation gate를 먼저 확인합니다.
- Editor hidden/compatibility selector 제거·relocation 판단은 `EDITOR_HIDDEN_COMPATIBILITY_OVERRIDE_AUDIT.md`의 usage/disposition table을 먼저 확인합니다.

---

## 작성 규칙

1. 새로운 기술 문서는 이 폴더에 생성합니다.
2. 생성 시 `docs/doc_index.md`에도 추가합니다.
3. API 계약이나 경로 전략을 바꾸면 관련 운영 문서와 함께 갱신합니다.
