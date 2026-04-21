# 운영 문서 인덱스

이 폴더에는 LoveBud 프로젝트를 **안정적으로 작업하고 운영하기 위한 기준 문서**가 저장됩니다.

## 용도

이 폴더의 문서는 크게 다음 네 그룹으로 나뉩니다:

- **작업 환경 (Core)**: 경로/셸, 원격 접근, Git/SSH, 문서 작업 흐름, 운영 가이드
- **환경/보안 (Env)**: 환경 변수 의존성, 로컬 비밀값 관리
- **배포/품질 (Deploy & QA)**: 배포 체크리스트, PR 체크리스트, 런북, QA 체크리스트, 테스트 계정
- **정책/아키텍처 (Architecture)**: 정적 자산 버저닝, 캐시 정책, 파일 분류 기준, 에디터 아키텍처

## 파일 목록

### 작업 환경 (Core)

| 파일명 | 설명 |
|--------|------|
| [DOC_WORKFLOW.md](DOC_WORKFLOW.md) | 문서 작업 흐름 및 문서군 역할 정의 |
| [OPERATIONS.md](OPERATIONS.md) | 운영 가이드 (인프라 우선순위: Modal > Vercel > Netlify) |

### 배포/품질 (Deploy & QA)

| 파일명 | 설명 |
|--------|------|
| [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) | 배포 전/후 자동 검증 및 수동 체크리스트 (Vercel 도메인 포함) |
| [RUNBOOK.md](RUNBOOK.md) | 운영 및 장애 대응 런북 (Vercel, Modal 우선) |
| [../migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md](../migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md) | Vercel & Modal 전환 마이그레이션 현황 및 과제 |

### 정책/아키텍처 (Architecture)

| 파일명 | 설명 |
|--------|------|
| [../engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md](../engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md) | Browse 필터와 보안 가드 개념 분리 정책 |
| [EDITOR_ARCHITECTURE.md](EDITOR_ARCHITECTURE.md) | 에디터 컴포넌트/상태 아키텍처 개요 |
| [backend.md](../backend.md) | Netlify Functions 백엔드 개요 |