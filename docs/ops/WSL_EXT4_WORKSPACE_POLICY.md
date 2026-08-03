# WSL ext4 작업공간 운영 정책

**Status: CURRENT SOURCE OF TRUTH** for LoveBud work that is explicitly authorized to run inside WSL.

이 문서는 WSL 사용 자체를 기본값으로 만들지 않는다. LoveBud의 기본 로컬 실행 환경은 여전히 Windows-native이며, WSL은 task 또는 operator가 명시적으로 승인한 경우에만 사용한다.

다만 WSL 사용이 승인된 작업에서는 실제 개발·검증 worktree를 Windows 드라이브 마운트 경로가 아니라 WSL 내부 ext4 파일시스템에 두어야 한다.

## 1. 적용 대상

이 정책은 다음 조건을 모두 만족하는 작업에 적용한다.

```text
현재 작업이 WSL bash 실행으로 명시 승인됨
실제 git/node/npm/test/build/browser 작업을 WSL 안에서 수행함
```

네이티브 Windows 작업자와 Windows PowerShell 작업에는 적용하지 않는다.

## 2. 허용 작업 경로

WSL 개발 worktree는 다음 계열을 사용한다.

```text
$HOME/worktrees/<task-name>
```

예:

```text
$HOME/worktrees/LoveBud-reliability-alert-delivery-3461-comp1
$HOME/worktrees/LoveBud-readonly-target-parity-3458-comp3
```

작업 시작 시 다음으로 실제 파일시스템을 확인한다.

```bash
pwd
findmnt -T . -o TARGET,SOURCE,FSTYPE,OPTIONS
df -T .
```

필수 조건:

```text
경로가 /mnt/* 아래가 아님
WSL 내부 ext4 계열 파일시스템
```

## 3. Windows 마운트 경로 금지

다음 경로는 WSL 실행 worktree로 사용하지 않는다.

```text
/mnt/c/**
/mnt/d/**
/mnt/g/**
/mnt/<other-drive>/**
```

WSL에서 위 경로에서는 다음을 실행하지 않는다.

```text
npm ci
npm install
npm test
npm run lint
npm run typecheck
npm run build
npm run db:check
Playwright 또는 브라우저 자동화
개발 서버
대량 grep/find/file generation
node_modules 생성 또는 공유
```

Windows 드라이브 마운트 경로는 다음 용도로만 사용한다.

```text
기존 저장소 보존
원본 HTML·자료 보관
ZIP·스크린샷·최종 산출물 보관
읽기 전용 비교
안전한 백업
```

## 4. 새 WSL 작업 기본 절차

새 WSL 작업은 처음부터 ext4 아래에 만든다.

```bash
mkdir -p "$HOME/worktrees"
git clone https://github.com/skerishKang/LoveBud.git "$HOME/worktrees/<task-name>"
cd "$HOME/worktrees/<task-name>"
git fetch origin --prune
```

그 다음 task authority가 지정한 exact branch/ref를 checkout한다. branch 이름이나 starting SHA를 추측하지 않는다.

Node 버전은 migration 과정에서 임의 변경하지 않는다. 다음 권위 순서로 결정한다.

```text
.nvmrc
.node-version
package.json engines
CI workflow
현재 task contract
```

## 5. 진행 중 작업 이전

진행 중인 `/mnt/*` worktree는 작업을 잃지 않도록 다음 원칙으로 이전한다.

```text
기존 worktree 삭제 금지
기존 branch/HEAD/status 기록
local-only commit 보존
git bundle --all 생성·검증
staged/unstaged binary patch 분리
untracked source 목록 검토
새 ext4 clone에서 exact 상태 복원
old/new 파일 hash 비교
새 node_modules는 npm ci로 재설치
```

전체 worktree를 무조건 rsync하지 않는다. `.git`, `node_modules`, build output, coverage, Playwright artifact, 로그와 임시 파일을 새 worktree로 복사하지 않는다.

Migration만 증명하기 위한 commit 또는 push를 만들지 않는다.

## 6. node_modules 정책

```text
node_modules 복사 금지
다른 worktree node_modules symlink 금지
worktree별 npm ci 사용
package.json/package-lock drift 0 확인
```

임시 symlink가 기존 작업 중 사용됐더라도 ext4 migration 이후에는 제거하고 새 worktree에서 독립 설치한다.

## 7. 프로세스 종료 안전

다른 worker 프로세스를 broad kill하지 않는다.

금지:

```text
pkill node
pkill npm
killall
```

현재 old worktree를 cwd로 사용하는 exact PID만 확인하고 `SIGTERM`으로 정상 종료한다.

## 8. 검증 및 이전 완료 기준

새 ext4 workspace가 ready이려면 다음을 모두 만족해야 한다.

```text
branch 동일
starting HEAD 동일
staged/unstaged/untracked source 보존
old/new content hash 동일
filesystem ext4 확인
repository-authorized Node version
npm ci 성공
package.json drift 0
package-lock drift 0
focused validation 재개 가능
기존 Windows-mounted worktree 보존
```

기존 `/mnt/*` worktree는 사용자 승인 전 자동 삭제하지 않는다.

## 9. 실행 성능 원칙

WSL ext4에서도 full gates는 기본적으로 순차 실행한다.

```text
broad grep -R 대신 git grep 또는 exact path
임의 짧은 shell timeout 금지
느린 명령을 failure로 오분류하지 않음
background full-gate 병렬 실행 금지
실제 process exit와 TAP/command completion 확인
```

## 10. 보고 marker

환경 이전 보고는 다음 marker를 사용한다.

```text
LOVEBUD_WSL_EXT4_WORKSPACE_READY
LOVEBUD_WSL_EXT4_WORKSPACE_BLOCKED
```

최종 보고에는 최소 다음을 포함한다.

```text
old path
new path
branch
old HEAD
new starting HEAD
old/new status
old/new source hashes
filesystem
Node version
npm ci
package/lock drift
old worktree preserved
implementation resumed
```

## 11. 운영 요약

```text
Windows-native task
→ Windows path + PowerShell

explicitly authorized WSL task
→ $HOME/worktrees ext4 only

/mnt/*
→ source/archive/backup only; no Node-heavy execution
```

Refs #1882 — Keep OPEN.
