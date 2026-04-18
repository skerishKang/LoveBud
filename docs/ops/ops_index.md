# 운영 문서 인덱스

이 폴더에는 LoveBud 프로젝트를 **안정적으로 작업하고 운영하기 위한 기준 문서**가 저장됩니다.

## 용도

이 폴더의 문서는 크게 다음 네 그룹으로 나뉩니다:

- **작업 환경 (Core)**: 경로/셸, 원격 접근, Git/SSH, 문서 작업 흐름, 운영 가이드
- **환경/보안 (Env)**: 환경 변수 의존성, 로컬 비밀값 관리
- **배포/품질 (Deploy & QA)**: 배포 체크리스트, PR 체크리스트, 런북, QA 체크리스트, 테스트 계정
- **정책/아키텍처 (Architecture)**: 정적 자산 버저닝, 캐시 정책, 파일 분류 기준, 에디터 아키텍처

## 먼저 읽기 순서

이 폴더를 처음 접할 때 권장하는 읽기 순서:

1. **DOC_WORKFLOW.md** — 문서 작업 흐름과 기본 원칙 (가장 중요)
2. **PATHS_AND_SHELLS.md** — 컴1/컴2 경로 및 셸 기준 (환경 설정 필수)
3. **OPERATIONS.md** — 프로덕션 환경 및 운영 개요
4. 필요에 따라 **Git/SSH**, **로컬 비밀**, **배포/QA** 문서 읽기

## 파일 목록

### 작업 환경 (Core)

| 파일명 | 설명 |
|--------|------|
| [DOC_WORKFLOW.md](DOC_WORKFLOW.md) | 문서 작업 흐름 (대화 → 문서 → 구현) 및 문서군 역할 정의 |
| [SKILL_REGISTRY.md](SKILL_REGISTRY.md) | 로컬 스킬 목록, 트리거, 새 세션에서의 우선 사용 규칙 |
| [PATHS_AND_SHELLS.md](PATHS_AND_SHELLS.md) | 컴1/컴2 경로 판별 기준 및 셸 사용 규칙 |
| [REMOTE_ACCESS_AND_WSL.md](REMOTE_ACCESS_AND_WSL.md) | 컴1→컴2 SSH 접근 및 WSL 드라이브 마운트 설정 |
| [GIT_SSH_SETUP.md](GIT_SSH_SETUP.md) | Git SSH 키 설정 및 remote 구성 방법 |
| [git_tutorial.md](git_tutorial.md) | LoveBud 맞춤 Git 작업 튜토리얼 *(루트에서 이동)* |
| [OPERATIONS.md](OPERATIONS.md) | 운영 가이드 (프로덕션 환경, 아키텍처 개요) |

### 환경/보안 (Env)

| 파일명 | 설명 |
|--------|------|
| [ENV_DEPENDENCY.md](ENV_DEPENDENCY.md) | Netlify/로컬 환경 변수 의존성 및 필수 설정 |
| [LOCAL_SECRETS.md](LOCAL_SECRETS.md) | 로컬 비밀값 관리 방법 (.env, 테스트 계정 등) |

### 배포/품질 (Deploy & QA)

| 파일명 | 설명 |
|--------|------|
| [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) | Netlify 배포 전/후 자동 검증 및 수동 체크리스트 |
| [PR_CHECKLIST.md](PR_CHECKLIST.md) | Pull Request 작성 및 검토 체크리스트 |
| [RUNBOOK.md](RUNBOOK.md) | 장애 대응 런북 (502, DB 연결 실패 등) |
| [FLOW_A_QA_CHECKLIST.md](FLOW_A_QA_CHECKLIST.md) | Flow-A 페이지 QA 확인 사항 |
| [QA_CREDENTIALS.txt](QA_CREDENTIALS.txt) | QA 테스트 계정 위치/사용법 안내 (실제 값은 `.local/`에서 관리) |

### 정책/아키텍처 (Architecture)

| 파일명 | 설명 |
|--------|------|
| [ASSET_VERSIONING.md](ASSET_VERSIONING.md) | 정적 자산(JS/CSS) 버저닝 규칙 (?v=YYYYMMDD-N) |
| [CACHE_POLICY.md](CACHE_POLICY.md) | Netlify/Service Worker 캐시 정책 |
| [FILE_BASELINE.md](FILE_BASELINE.md) | 파일 분류 기준표 (APP_ENTRY, DOC, SCRIPT 등) |
| [EDITOR_ARCHITECTURE.md](EDITOR_ARCHITECTURE.md) | 에디터 컴포넌트/상태 아키텍처 개요 |
| [backend.md](../backend.md) | Netlify Functions 백엔드 개요 *(루트에서 이동)* |

### 기타 (참조용)

| 파일명 | 설명 |
|--------|------|
| [CTO_MVP_HANDOFF.md](CTO_MVP_HANDOFF.md) | CTO 핸드오프 및 작업자 프롬프트 팩 *(product에서 이동)* |

## 참조
- 전체 문서 인덱스: `../doc_index.md`
- 대화 기록: `../conversation/`
