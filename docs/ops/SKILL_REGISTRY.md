# LoveBud 스킬 레지스트리

이 문서는 LoveBud 저장소에서 사용하는 로컬 스킬의 목적과 트리거를 정리합니다.

새 세션의 에이전트는 관련 요청이 들어오면 이 문서를 먼저 보고, 대응하는 `skills/*/SKILL.md`를 읽은 뒤 작업합니다.

## 사용 원칙

1. 스킬이 있는 작업은 일반 추측보다 스킬 절차를 우선합니다.
2. 스킬 설명은 이 문서에서 빠르게 찾고, 상세 절차는 각 `SKILL.md`에서 확인합니다.
3. 하나의 요청이 여러 스킬과 겹치면 먼저 기록 보존/정제 기준을 정하고, 그 다음 구현/검증/배포 순서로 진행합니다.

권장 순서:
- conversation 기록 정리
- 정제 문서 반영
- 구현 또는 수정
- 런타임 검증
- 버전/배포/커밋 정리

## 스킬 목록

### `conversation-archiver`

- 경로: `skills/conversation-archiver/SKILL.md`
- 목적: raw transcript, handoff, summary를 LoveBud conversation 문서 체계에 편입
- 대표 트리거:
  - 사용자가 `.txt`/`.md` 대화 전문 처리를 요청함
  - `docs/conversation/full/`에 임시 transcript 파일이 생김
  - 세션 종료 후 summary와 index를 정리해야 함
  - conversation 문서 제목/위치/중복을 감사해야 함
- 주요 출력:
  - `docs/conversation/full/YYYY-MM-DD-NN-짧은제목.md`
  - `docs/conversation/summary/YYYY-MM-DD-NN-짧은제목_summary.md`
  - `docs/conversation/full/full_index.md`
  - `docs/conversation/summary/summary_index.md`
- 주의:
  - 입력 파일명은 신뢰하지 않음
  - `.txt`라도 transcript면 intake 후보로 먼저 판단
  - 원문 보존이 우선, summary는 별도 문서로 생성

### `project-doc-sync`

- 경로: `skills/project-doc-sync/SKILL.md`
- 목적: 대화나 구현 결과를 `docs/` 하위 정제 문서에 반영
- 대표 트리거:
  - product/pages/backend/ops/reports/plans 문서를 최신 상태로 맞춰야 함
  - 대화에서 확정된 내용을 정제 문서에 반영해야 함
  - 폴더 구조/인덱스/문서 위치를 정리해야 함
- 주요 출력:
  - 갱신된 `docs/product/*.md`
  - 갱신된 `docs/pages/*.md`
  - 갱신된 `docs/backend/*.md`
  - 갱신된 `docs/ops/*.md`
  - 필요 시 관련 인덱스 파일
- 주의:
  - conversation 문서군은 기록용
  - 정제 문서군은 실행 기준
  - 구현과 문서가 다르면 기본적으로 현재 구현을 우선 반영

### `page-doc-writer`

- 경로: `skills/page-doc-writer/SKILL.md`
- 목적: 페이지 구현 상태와 QA 결과를 페이지 문서로 구조화
- 대표 트리거:
  - 새 페이지를 만들었음
  - 페이지 UI/상태/기능이 크게 바뀌었음
  - 브라우저 검증 결과를 `docs/pages/`에 남겨야 함
- 주요 출력:
  - `docs/pages/<page-name>.md`
  - `docs/pages/pages_index.md`
- 주의:
  - UI 설명만 쓰지 않음
  - 상태, 데이터, API 연결, 리스크까지 함께 정리

### `runtime-patch-review`

- 경로: `skills/runtime-patch-review/SKILL.md`
- 목적: 최근 패치나 handoff 결과를 최소 런타임 관점에서 검토
- 대표 트리거:
  - 다른 에이전트가 만든 패치를 리뷰해야 함
  - deploy 전후로 문법/중복/링크 깨짐을 점검해야 함
  - handoff 전에 최소 검증을 하고 싶음
- 주요 출력:
  - 문법 점검 결과
  - 중복 블록/깨진 참조/검증 메모
- 주의:
  - "리뷰" 요청을 받으면 기본적으로 이 스킬을 우선 확인
  - 결과는 findings 중심으로 정리

### `asset-version-bump`

- 경로: `skills/asset-version-bump/SKILL.md`
- 목적: JS/CSS 변경 후 HTML 참조의 `?v=` 버전을 갱신
- 대표 트리거:
  - 정적 자산을 수정했음
  - 캐시 무효화가 필요함
  - deploy 전에 최신 자산 버전이 필요함
- 주요 출력:
  - 갱신된 `?v=YYYYMMDD-N`
  - 수정된 HTML 참조
- 주의:
  - 현재 HTML에 있는 실제 버전값을 먼저 확인
  - 예시 숫자를 그대로 쓰지 않음

### `git-publish`

- 경로: `skills/git-publish/SKILL.md`
- 목적: 관련 파일만 staging하고 commit/push 범위를 정리
- 대표 트리거:
  - 작업이 끝나서 커밋을 준비해야 함
  - diff 범위를 확인하고 관련 파일만 stage 해야 함
  - push 전 상태를 점검해야 함
- 주요 출력:
  - staged 파일 목록
  - commit 결과
  - 필요 시 push 결과
- 주의:
  - 사용자가 명시하지 않은 파일을 무리하게 포함하지 않음
  - 커밋/푸시 여부는 항상 범위를 분명히 함

## 작업 유형별 빠른 매핑

| 요청 유형 | 먼저 읽을 스킬 |
|-----------|----------------|
| 대화 전문 정리 | `skills/conversation-archiver/SKILL.md` |
| summary/index 갱신 | `skills/conversation-archiver/SKILL.md` |
| 문서 최신화 | `skills/project-doc-sync/SKILL.md` |
| 페이지 문서 작성 | `skills/page-doc-writer/SKILL.md` |
| 패치 리뷰/검증 | `skills/runtime-patch-review/SKILL.md` |
| 자산 버전 갱신 | `skills/asset-version-bump/SKILL.md` |
| staging/commit/push | `skills/git-publish/SKILL.md` |

## 새 세션용 체크포인트

새 세션의 에이전트는 아래 질문으로 시작합니다.

1. 이 요청이 기록 보존 작업인가, 정제 문서 작업인가, 구현 작업인가?
2. 이미 정의된 스킬이 있는가?
3. 있다면 해당 스킬의 입력/출력/검증 절차를 읽었는가?
4. conversation 문서군과 정제 문서군의 역할을 혼동하고 있지 않은가?

특히 transcript 요청이면 아래를 먼저 확인합니다.

1. raw transcript인가?
2. 기존 `docs/conversation/full/`와 중복인가?
3. `conversation-archiver` intake 대상인가?
4. summary와 index 갱신이 필요한가?
