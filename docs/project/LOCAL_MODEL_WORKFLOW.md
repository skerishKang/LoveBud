# Local Model Workflow

> **Default role:** Local Validation  
> **Role-separation source of truth:** `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`  
> **Hard-governance precedence:** `../ops/MVP_AGENT_GOVERNANCE.md`

## 목적

이 문서는 LoveBud의 Local Validation 역할이 exact PR head에서 테스트, build, browser, auth, database, provider, OS 의존 증거를 수집하는 기준을 정리합니다.

로컬 모델은 기본 production 구현자나 UI 디자이너가 아닙니다. 제품 계약과 구현은 각각 Web CTO와 별도 Web Developer가 담당합니다.

## 공통 원칙

- dedicated worktree 사용;
- `main` 직접 수정 금지;
- exact remote PR head 확인;
- 다른 작업자의 dirty/staged/untracked/stash/worktree 상태 보존;
- 명시된 검증 명령 실행;
- pristine-main failure와 branch-only failure 구분;
- browser/auth/console/network evidence 수집;
- 검증한 것과 검증하지 못한 것 분리 보고;
- secret 값 출력 금지.

## 작업 시작 절차

Local Validation은 기존 PR을 검증하는 경우가 기본입니다.

1. repository와 worktree 위치를 확인합니다.
2. `git fetch origin --prune`을 실행합니다.
3. remote PR branch와 expected head SHA를 확인합니다.
4. `git worktree list --porcelain`과 `git status --short`로 기존 상태를 확인합니다.
5. 기존 dirty worktree가 있으면 보존하고 별도 worktree를 사용합니다.
6. exact PR head에서 local validation branch/worktree를 준비합니다.
7. 첫 보고에 아래를 포함합니다.

```text
repository path
worktree path
local branch
remote branch
expected head
actual head
main/base SHA
git status --short
reset/stash/clean used: NO
```

`git reset --hard`, `git clean`, `git stash drop`, 기존 worktree/branch 삭제는 명시 승인 없이 사용하지 않습니다.

## 브랜치 규칙

기존 PR branch를 검증할 때는 새 remote branch를 만들 필요가 없습니다.

권장:

```text
remote PR branch
→ separate local validation branch/worktree at exact PR head
→ test only
```

로컬에서 승인된 correction commit을 만들어야 하는 예외 상황에는:

- 허용 파일을 명시하고;
- push 직전 remote head를 재확인하고;
- existing PR branch로 fast-forward push하며;
- force push를 사용하지 않습니다.

같은 remote branch를 두 컴퓨터가 동시에 수정하거나 push하지 않습니다.

## Local Validation의 허용 작업

### 기본 허용

- dependency installation;
- lint/typecheck/build/test;
- database/Docker/local service execution;
- Windows/PowerShell command validation;
- provider CLI execution;
- authenticated browser execution;
- responsive viewport checks;
- console/network/API inspection;
- screenshots/videos/artifacts 생성;
- local environment/key-presence 확인 without value output;
- exact patch package application;
- pristine-main comparison;
- raw failure reproduction.

### 명시 승인 시 최소 변경

- local path adjustment;
- port/environment wiring;
- OS-specific command correction;
- exact patch application;
- narrowly specified integration edit.

### 기본 금지

- product direction 결정;
- UI visual direction 발명;
- broad source rewrite;
- architecture/dependency/API/data-model expansion;
- acceptance criteria 변경;
- merge/Ready/Issue closure;
- destructive cleanup;
- secret value 출력.

Production-source fix가 필요하면 기본적으로 exact failure evidence를 Web Developer에게 반환합니다.

## 테스트와 비교

Web CTO/Web Developer handoff에 지정된 명령을 그대로 실행합니다.

각 명령에 대해 다음을 기록합니다.

```text
command
exit status
pass/fail count
relevant raw error
elapsed time when useful
```

Branch failure가 나오면 가능한 경우 동일 명령을 pristine `origin/main` 또는 별도 clean main worktree에서 비교합니다.

보고:

```text
pristine-main failures
branch failures
branch-only failures
```

`branch-only failures = 0`이라는 요약만 쓰지 말고 비교에 사용한 SHA와 명령을 함께 적습니다.

## Browser evidence

Browser tooling은 기본 허용입니다. 환경은 permission gate가 아니라 evidence level입니다.

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
```

### LOCAL_EVIDENCE

- localhost;
- static server;
- local API/backend;
- local database;
- local authenticated profile.

동적 데이터, same-origin API, Cloudflare Functions, Modal, Firebase session에 의존하는 화면은 localhost-only 결과의 한계를 명시합니다.

### PRE_MERGE_EVIDENCE

- PR Preview;
- branch preview;
- fixed slot;
- disposable environment.

Preview/fixed slot은 선택 가능한 증거이며, 부재 자체는 automatic blocker가 아닙니다.

### PRODUCTION_EVIDENCE

- merge/deploy된 exact main SHA;
- `https://lovebud.pages.dev/`의 실제 사용자 흐름;
- UI/Auth/runtime 최종 시각 판정.

현재 기본 UI 흐름은 merge-first Production verification입니다. Web CTO가 pre-merge browser evidence를 별도로 할당하지 않았다면 preview URL을 찾거나 fixed-slot deploy를 임의 수행하지 않습니다.

## Auth와 secret 처리

- approved QA credential source를 사용할 수 있습니다.
- credential 값, token, cookie, session, Authorization header를 출력하지 않습니다.
- key/file 존재 여부만 `PRESENT`, `MISSING`, `EXISTS`, `GITIGNORED`로 보고합니다.
- test account 생성/갱신은 승인된 저장 위치에만 기록합니다.
- screenshot, logs, reports, chat, Issue, PR에 secret/private payload를 포함하지 않습니다.

## Artifact hygiene

로컬 screenshot, video, logs, reports, backup, ZIP은 기본적으로 repository 밖에 저장합니다.

Repository 안에 생성된 task-specific untracked debris는 파일명을 확인한 뒤 해당 파일만 개별 삭제할 수 있습니다. `git clean`을 사용하지 않습니다.

다른 작업자의 untracked 파일은 삭제하지 않습니다.

## 실패 반환 기준

Source correction이 필요하면 아래를 Web Developer에게 반환합니다.

```text
exact tested SHA
command
full relevant error
reproduction steps
expected behavior
actual behavior
browser viewport/auth state
console/network status
files locally modified: NONE 또는 exact list
```

로컬 모델은 추정 원인을 사실처럼 단정하지 않습니다.

## 최종 보고 템플릿

```text
## Local Validation report

### Baseline
- repository/worktree:
- local branch:
- remote branch:
- expected head:
- tested head:
- main/base:
- clean/dirty before:
- reset/stash/clean used:

### Commands
- command:
- result/count:
- relevant error:

### Comparison
- pristine-main SHA:
- pristine failures:
- branch failures:
- branch-only failures:

### Browser/environment
- evidence level:
- URL/route:
- auth:
- desktop:
- mobile:
- console:
- network/API:
- database/provider/OS:
- screenshots/artifacts:

### Repository state
- git diff --check:
- git status --short:
- remaining untracked:
- source files modified locally:

### Unverified
- item:
- reason:

### Final status
LOCAL_VALIDATION_PASS / LOCAL_VALIDATION_FAIL / LOCAL_VALIDATION_PARTIAL
```

## 관련 문서

- [WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md](./WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md)
- [ROLE_SESSION_TEMPLATES.md](./ROLE_SESSION_TEMPLATES.md)
- [REPORTING_CHAIN.md](./REPORTING_CHAIN.md)
- [PROJECT_OPERATING_MODEL.md](./PROJECT_OPERATING_MODEL.md)
- [VERIFICATION_AND_EVIDENCE.md](./VERIFICATION_AND_EVIDENCE.md)
- [../ops/MVP_AGENT_GOVERNANCE.md](../ops/MVP_AGENT_GOVERNANCE.md)

Refs #3662.  
Refs #1882 — Keep OPEN.
