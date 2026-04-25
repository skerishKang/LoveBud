# LoveBud 문서 인덱스

이 문서는 LoveBud 프로젝트의 문서 구조와 읽기 순서를 정리한 최상위 인덱스입니다.

실서비스 프론트 주소는 `https://lovebud.pages.dev/` 이며, 현재 운영 기준 인프라 우선순위는 **Modal > Cloudflare Pages > Vercel > Netlify** 입니다.

중요:
- 브라우저는 가능하면 **same-origin `/api`** 만 사용합니다.
- 공식 사용자-facing 주소는 `pages.dev` 기준으로 설명합니다.
- Vercel은 upstream / secondary entry / 전이기 보조 계층입니다.
- Netlify는 주경로가 아니라 fallback 또는 단계적 제거 대상입니다.
- `PRODUCT_IDENTITY / BRAND_EXPERIENCE / UI_DESIGN_SYSTEM` 은 제품/브랜드/UI 판단의 source of truth 입니다.
- browse display filter 와 publication guard 는 다른 개념입니다.

---

## 먼저 읽기

새 작업을 시작할 때 권장 순서는 아래와 같습니다.

1. `../AGENTS.md`
2. `./doc_index.md`
3. `./product/PRODUCT_IDENTITY.md`
4. `./product/BRAND_EXPERIENCE.md`
5. `./design/UI_DESIGN_SYSTEM.md`
6. 요청 범위에 맞는 문서군 인덱스

운영/배포 판단이 필요하면 아래를 추가로 읽습니다.

- `./ops/OPERATIONS.md`
- `./migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
- `./engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`
- `./engineering/REVIEW_GUARDRAILS.md`

---

## product 문서군

제품 관련 문서는 `docs/product/` 아래에 정리됩니다.

- **index**: [product_index.md](./product/product_index.md)
- [PRODUCT_BRIEF.md](./product/PRODUCT_BRIEF.md) - 현재 실행 기준 제품 개요
- [PRODUCT_IDENTITY.md](./product/PRODUCT_IDENTITY.md) - 제품 정체성 source of truth
- [BRAND_EXPERIENCE.md](./product/BRAND_EXPERIENCE.md) - 브랜드 감성 / UX 표현 원칙 source of truth
- [PUBLICATION_AND_PRIVACY_UX_POLICY.md](./product/PUBLICATION_AND_PRIVACY_UX_POLICY.md) - 공개/비공개/둘러보기 소개 UX 정책
- [UI_COPY_DIET_GUIDE.md](./product/UI_COPY_DIET_GUIDE.md) - UI 카피 다이어트 운영 기준
- [MVP_SCOPE.md](./product/MVP_SCOPE.md) - MVP 범위
- [USER_FLOW.md](./product/USER_FLOW.md) - 사용자 흐름
- [DATA_NAMING_RULE.md](./product/DATA_NAMING_RULE.md) - 데이터 명명 규칙
- [READONLY_SHARE_SCOPE.md](./product/READONLY_SHARE_SCOPE.md) - 읽기 전용 공유 범위

## design 문서군

디자인 문서는 `docs/design/` 아래에 정리됩니다.

- **index**: [design_index.md](./design/design_index.md)
- [UI_DESIGN_SYSTEM.md](./design/UI_DESIGN_SYSTEM.md) - UI 구조 / 감정 위계 / 컴포넌트 규칙 source of truth
- [prompts/image-generation-prompts.md](./design/prompts/image-generation-prompts.md) - 이미지 생성 프롬프트 모음
- [prompts/home-hero-slide-prompts.txt](./design/prompts/home-hero-slide-prompts.txt) - 홈 히어로 슬라이드 프롬프트

## engineering 문서군

엔지니어링 문서는 `docs/engineering/` 아래에 정리됩니다.

- **index**: [engineering_index.md](./engineering/engineering_index.md)
- [API_CONTRACT.md](./engineering/API_CONTRACT.md) - flat camelCase API 계약
- [BROWSE_FILTER_VS_PUBLICATION_GUARD.md](./engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md) - browse filter / publication guard 개념 분리
- [SUPABASE_FREE_POC_PLAN.md](./engineering/SUPABASE_FREE_POC_PLAN.md) - Supabase Free PoC 기반 장기 backend 구조 단순화 검증 계획
- [REVIEW_GUARDRAILS.md](./engineering/REVIEW_GUARDRAILS.md) - 반복 false positive 방지 규칙
- [RECENT_REFACTORING.md](./engineering/RECENT_REFACTORING.md) - 최근 리팩터링 기록

## ops 문서군

운영 문서는 `docs/ops/` 아래에 정리됩니다.

- **index**: [ops_index.md](./ops/ops_index.md)
- [OPERATIONS.md](./ops/OPERATIONS.md) - 현재 운영 전략 및 인프라 우선순위
- [DEPLOY_CHECKLIST.md](./ops/DEPLOY_CHECKLIST.md) - 배포 체크리스트
- [RUNBOOK.md](./ops/RUNBOOK.md) - 운영 / 장애 대응 런북
- [DOC_WORKFLOW.md](./ops/DOC_WORKFLOW.md) - 문서 작업 흐름
- [SKILL_REGISTRY.md](./ops/SKILL_REGISTRY.md) - 스킬 레지스트리
- [AI_REQUEST_PATTERNS.md](./ops/AI_REQUEST_PATTERNS.md) - 요청 패턴 해석
- [TEST_PREVIEW_SLOTS.md](./ops/TEST_PREVIEW_SLOTS.md) - 고정 테스트 Preview 슬롯 운영 기준
- [EDITOR_ARCHITECTURE.md](./ops/EDITOR_ARCHITECTURE.md) - editor 구조 설명

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
