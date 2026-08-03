# 경로 및 셸 운영 기준

**Status: CURRENT SOURCE OF TRUTH** for LoveBud local path/shell execution.

이 문서는 LoveBud 프로젝트의 실행 환경을 **네이티브 Windows lane**과 **명시적으로 승인된 WSL lane**으로 분리한다. 두 lane은 모두 지원되지만 서로의 경로·도구·셸 문법을 섞지 않는다.

Repository-wide 요약은 root `AGENTS.md`의 **Current local execution environment**를 본다. WSL 상세 이전·복원 절차는 `docs/ops/WSL_EXT4_WORKSPACE_POLICY.md`가 최종 권위다.

---

## 1. 환경 매트릭스

| Lane | OS / shell | Active worktree | Toolchain |
|---|---|---|---|
| Native Windows | Windows + PowerShell 7 (`pwsh.exe`) | Windows-native path | Windows-native Git/Node/npm |
| Explicit WSL | WSL + bash | `$HOME/worktrees/<task>` on WSL internal ext4 | Linux Git/Node/npm |

공통 원칙:

- 작업 시작 시 실제 OS, shell, path, filesystem, branch, HEAD를 확인한다.
- Codex, Kilo, Hermes 같은 도구 이름이나 컴퓨터 번호만으로 환경을 추론하지 않는다.
- task/operator가 WSL을 명시하지 않았다면 네이티브 Windows가 기본이다.
- 한 lane에서 다른 lane으로 자동 fallback하지 않는다.
- 셸 문법을 혼합하지 않는다.

---

## 2. Native Windows lane

- 기본 shell은 PowerShell 7 (`pwsh.exe`)다.
- Windows 경로와 Windows-native executable을 사용한다.
- 필수 Windows-native 도구가 없으면 WSL로 우회하지 말고 중단·보고한다.
- 한 workstation의 절대 경로를 다른 workstation에 강제하지 않는다.

권장 preflight:

```powershell
Get-Location
$PSVersionTable.PSVersion
Get-Command git
Get-Command node
Get-Command npm
Get-Command gh

git branch --show-current
git rev-parse HEAD
git status --short
```

DB 운영이 명시적으로 승인된 경우에만:

```powershell
Get-Command psql.exe -ErrorAction Stop
Get-Command pg_dump.exe -ErrorAction Stop
```

도구가 없으면 자동으로 WSL을 사용하지 않는다.

---

## 3. Explicit WSL lane

WSL은 task 또는 operator가 명시적으로 지정한 경우에만 사용한다. 지정된 뒤에는 active development를 WSL 내부 ext4에서 수행해야 한다.

허용 active workspace:

```text
$HOME/worktrees/<task-name>
```

금지 active workspace:

```text
/mnt/c/**
/mnt/d/**
/mnt/g/**
/mnt/*
```

`/mnt/*`는 다음 용도로만 사용한다.

```text
기존 저장소와 원본 보존
원본 HTML/이미지/자료 보관
bundle/patch/ZIP 백업
스크린샷과 최종 산출물 export
안전한 복사 원본
```

다음 명령은 `/mnt/*` worktree에서 실행하지 않는다.

```text
npm ci
npm install
npm test
npm run lint
npm run typecheck
npm run build
npm run db:check
Playwright
개발 서버
대량 grep/find/copy
```

WSL preflight:

```bash
pwd
findmnt -T . -o TARGET,SOURCE,FSTYPE,OPTIONS
df -T .
node --version
npm --version
git branch --show-current
git rev-parse HEAD
git status --short
```

필수 결과:

```text
path is not /mnt/*
filesystem is WSL internal ext4 or equivalent Linux filesystem
repository-authorized Node major is active
branch/HEAD matches the task authority
```

---

## 4. Node와 dependency 정책

- 환경 이전은 Node major 변경 작업이 아니다.
- Node 권위 순서:

```text
.nvmrc
.node-version
package.json engines
CI workflow
current task contract
```

- 새 ext4 workspace에서는 자체 `npm ci`를 실행한다.
- 다른 worktree의 `node_modules`를 복사하지 않는다.
- steady-state에서 `node_modules` symlink를 공유하지 않는다.
- `npm ci`가 `package.json` 또는 `package-lock.json`을 변경하면 중단한다.

---

## 5. In-progress WSL migration

이미 `/mnt/*`에서 작업 중인 branch를 옮길 때는 작업을 초기화하거나 다시 구현하지 않는다.

필수 보존 대상:

```text
branch
HEAD
local-only commits
staged changes
unstaged changes
approved untracked source files
```

필수 복원 방식:

```text
git bundle --all
+ staged binary patch
+ unstaged binary patch
+ explicit untracked allowlist
```

전체 worktree broad `rsync`를 기본 복원 방식으로 사용하지 않는다. `.git`, `node_modules`, build output, logs, caches, screenshots, ZIP 등이 섞일 수 있고 staged/unstaged 의도가 사라진다.

이전 절차와 보고 형식은:

```text
docs/ops/WSL_EXT4_WORKSPACE_POLICY.md
```

를 따른다.

기존 mounted worktree는 새 ext4 workspace에서 다음이 확인되기 전까지 삭제하지 않는다.

```text
branch/HEAD reproduced
old/new change hashes equal
fresh npm ci succeeded
assigned work resumed
actual task commit and normal push succeeded
```

그 이후에도 자동 삭제하지 않는다. 사용자 승인 전까지 보존한다.

---

## 6. Process safety

다른 worker의 프로세스를 중단하지 않는다.

금지:

```text
pkill node
pkill npm
pkill postgres
killall
```

WSL에서는 candidate PID를 찾고 `/proc/<pid>/cwd`를 확인한 뒤 대상 worktree의 exact PID만 `TERM`으로 종료한다.

Windows에서는 `Get-Process`, command line, working path 또는 실행한 terminal/job authority로 정확한 프로세스만 종료한다.

---

## 7. 셸 혼합 금지

- PowerShell, CMD, bash 문법을 한 명령 블록에서 섞지 않는다.
- 프롬프트 첫 부분에 실행 lane을 명시한다.

권장 표현:

```text
Windows PowerShell 7 (pwsh) 기준으로만 실행
```

또는:

```text
WSL bash + $HOME/worktrees ext4 기준으로만 실행
```

환경변수 표기:

| Shell | Syntax |
|---|---|
| PowerShell | `$env:USERPROFILE`, `$env:LOCALAPPDATA` |
| CMD | `%USERPROFILE%` |
| WSL bash | `$HOME`, `$USER` |

---

## 8. 한글·공백 경로

경로에 한글이나 공백이 있을 수 있다.

1. 모든 path argument를 quote한다.
2. `git -C`, `node`, `npm`, `rg` 등의 경로도 quote한다.
3. 가능하면 먼저 worktree root로 이동한 뒤 상대경로를 사용한다.
4. 첫 실패 후 파일 부재로 단정하지 말고 shell과 quoting을 확인한다.

WSL ext4 workspace는 성능과 quoting 단순화를 위해 ASCII task slug를 권장한다.

---

## 9. 검증 실행 원칙

- full gate는 task가 병렬 실행을 명시하지 않으면 순차 실행한다.
- 정상적인 repository test에 임의의 짧은 shell timeout을 씌우지 않는다.
- 실제 TAP/test 종료와 exit code를 수집한다.
- 반복적인 broad filesystem traversal보다 exact path와 `git grep`을 사용한다.
- filesystem 이전은 DB/browser/provider/Production 권한을 확대하지 않는다.

---

## 10. 작업 사본 라벨

컴퓨터 번호는 환경 권위가 아니다. 결과 보고에는 항상 실제 값을 쓴다.

```text
computer / worker
OS
shell
worktree path
filesystem
branch
HEAD
```

예:

```text
컴1 또는 컴3가 WSL worker로 지정된 경우
→ $HOME/worktrees/... on ext4

컴4가 별도 native Windows worker인 경우
→ Windows path + PowerShell
```

한 컴퓨터의 정책을 다른 컴퓨터에 자동 적용하지 않는다.

---

## 11. One-line rule

```text
confirm actual environment
→ choose native Windows or explicit WSL-ext4 lane
→ keep active Node work off /mnt/*
→ preserve branch/HEAD/uncommitted state
→ run the repository-authorized toolchain
```

Refs #3865.
Refs #1882 — keep open.
