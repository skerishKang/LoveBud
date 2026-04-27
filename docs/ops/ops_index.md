# 운영 문서 인덱스

이 폴더에는 LoveBud 프로젝트를 작업하고 배포하고 운영할 때 따라야 하는 기준 문서가 정리됩니다.

현재 운영 기준은 아래와 같습니다.

- 실서비스 프론트: `https://lovebud.pages.dev/`
- 인프라 우선순위: **Modal > Cloudflare Pages > Vercel > Netlify**
- 브라우저 호출 원칙: 가능하면 **same-origin `/api`** 만 사용
- Vercel은 upstream / secondary entry / 전이기 보조 계층
- Netlify는 주경로가 아니라 fallback 또는 단계적 제거 대상

---

## 먼저 읽기

1. [OPERATIONS.md](OPERATIONS.md) - 현재 운영 전략과 계층 정의
2. [PARALLEL_WORKTREE_AGENT_POLICY.md](PARALLEL_WORKTREE_AGENT_POLICY.md) - 병렬 모델/worktree/검증 모델 운영 기준
3. [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) - 배포 전/후 체크리스트
4. [RUNBOOK.md](RUNBOOK.md) - 운영 / 장애 대응 기준
5. [MODAL_BROWSE_RUNTIME.md](MODAL_BROWSE_RUNTIME.md) - browse summary의 Modal 우선 read path 기준
6. [KNOWN_CI_E2E_BLOCKERS.md](KNOWN_CI_E2E_BLOCKERS.md) - 반복 CI/E2E blocker 원인 분리 및 exception merge 판단 기준
7. [BRANCH_CLEANUP_PLAN.md](BRANCH_CLEANUP_PLAN.md) - merged/stale branch cleanup 후보와 보존 branch 분류 기준
8. [../migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md](../migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md) - 전환 현황과 남은 과제
9. [../engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md](../engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md) - browse filter / publication guard 구분

---

## 작업 환경 (Core)

| 파일명 | 설명 |
|--------|------|
| [DOC_WORKFLOW.md](DOC_WORKFLOW.md) | 문서 작업 흐름 및 문서군 역할 정의 |
| [PARALLEL_WORKTREE_AGENT_POLICY.md](PARALLEL_WORKTREE_AGENT_POLICY.md) | 병렬 모델, worktree, 검증 모델, PR 통합 운영 기준 |
| [PATHS_AND_SHELLS.md](PATHS_AND_SHELLS.md) | 경로 / 셸 기준 |
| [REMOTE_ACCESS_AND_WSL.md](REMOTE_ACCESS_AND_WSL.md) | 원격 접근 / WSL 기준 |
| [GIT_SSH_SETUP.md](GIT_SSH_SETUP.md) | Git / SSH 설정 |
| [OPERATIONS.md](OPERATIONS.md) | 현재 운영 전략 및 인프라 우선순위 |

## 배포 / 품질 (Deploy & QA)

| 파일명 | 설명 |
|--------|------|
| [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) | 배포 전/후 검증 체크리스트 |
| [RUNBOOK.md](RUNBOOK.md) | 운영 및 장애 대응 런북 |
| [MODAL_BROWSE_RUNTIME.md](MODAL_BROWSE_RUNTIME.md) | browse summary의 Modal 우선 경로와 fallback 기준 |
| [KNOWN_CI_E2E_BLOCKERS.md](KNOWN_CI_E2E_BLOCKERS.md) | 반복 CI/E2E 실패의 원인 분리 및 exception merge 판단 기준 |
| [BRANCH_CLEANUP_PLAN.md](BRANCH_CLEANUP_PLAN.md) | PR #49~#58 이후 merged/stale branch cleanup 후보와 보존 branch 분류 기준 |
| [FLOW_A_QA_CHECKLIST.md](FLOW_A_QA_CHECKLIST.md) | QA 체크리스트 |
| [PR_CHECKLIST.md](PR_CHECKLIST.md) | PR 점검 기준 |
| [QA_CREDENTIALS.txt](QA_CREDENTIALS.txt) | QA 테스트 계정 |
| [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md) | 고정 테스트 Preview 슬롯 운영 기준 |
| [../migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md](../migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md) | Cloudflare Pages / Modal 전환 문서 |

## 정책 / 아키텍처 (Architecture)

| 파일명 | 설명 |
|--------|------|
| [EDITOR_ARCHITECTURE.md](EDITOR_ARCHITECTURE.md) | editor 구조 및 상태 설명 |
| [ASSET_VERSIONING.md](ASSET_VERSIONING.md) | 정적 자산 버저닝 |
| [CACHE_POLICY.md](CACHE_POLICY.md) | 캐시 정책 |
| [ENV_DEPENDENCY.md](ENV_DEPENDENCY.md) | 환경 변수 의존성 |
| [FILE_BASELINE.md](FILE_BASELINE.md) | 파일 분류 기준 |
| [../engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md](../engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md) | browse 표시 정책과 publication guard 구분 |

## 문서 / 스킬 운영

| 파일명 | 설명 |
|--------|------|
| [DOC_WORKFLOW.md](DOC_WORKFLOW.md) | 대화 → 문서 → 구현 흐름 |
| [SKILL_REGISTRY.md](SKILL_REGISTRY.md) | 로컬 스킬 목록 |
| [AI_REQUEST_PATTERNS.md](AI_REQUEST_PATTERNS.md) | 자연어 요청 패턴 |
