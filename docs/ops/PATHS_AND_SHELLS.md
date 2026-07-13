# 경로 및 셸 운영 메모

**Status: CURRENT SOURCE OF TRUTH** for LoveBud local path/shell execution.

| Field | Value |
|--------|--------|
| Default OS | Windows |
| Default shell | PowerShell 7 (`pwsh.exe`) |
| WSL | explicit exception only (not default, not automatic fallback) |

이 문서는 LoveBud 프로젝트의 **경로 처리와 셸 명령 실행**에 대한 현재 운영 기준이다.
repository-wide 요약은 root `AGENTS.md`의 **Current local execution environment**를 본다.

---

## 현재 실행 기본값

- LoveBud 로컬 작업의 기본 OS는 **Windows**다.
- 기본 shell은 **PowerShell 7** (`pwsh.exe`)다. Windows PowerShell 5.1은 필요 시 명시적 fallback만 허용한다.
- 명령은 **Windows 경로**와 **Windows-native executable**을 사용한다.
- 문서, 프롬프트, 운영 메모, agent 지시는 WSL 특정 맥락이 필요하지 않은 한 Windows 경로를 사용한다.
- 한 workstation의 절대 경로를 모든 환경에 강제하지 않는다. 작업 시작 시 **실제 worktree path**를 확인한다.
  - 예 (컴1 참고 경로, 강제값 아님): `G:\Ddrive\BatangD\task\workdiary\LoveBud`

### PowerShell preflight (권장)

```powershell
Get-Location
$PSVersionTable.PSVersion
Get-Command git
Get-Command node
Get-Command npm
Get-Command gh
```

DB 운영이 필요한 경우에만:

```powershell
Get-Command psql.exe -ErrorAction Stop
Get-Command pg_dump.exe -ErrorAction Stop
```

`psql.exe` 또는 `pg_dump.exe`가 없으면 **WSL로 전환하지 말고 중단·보고**한다.

---

## 셸 확인 및 혼합 금지

에이전트는 **현재 실제 실행 셸을 먼저 확인하고, 그 셸 문법만 사용**한다.

- PowerShell / CMD / bash 문법을 한 작업 안에서 섞지 않는다.
- tool identity(`Codex`, `Kilo`, Hermes 등)만으로 WSL/bash를 추론하지 않는다.
- 다른 모델에게 운영 작업을 시킬 때는 프롬프트 첫 줄에 shell을 고정한다.
  - 권장: `Windows PowerShell 7 (pwsh) 기준으로만 실행`
  - 예외 승인 시: `WSL bash 기준으로만 실행` (명시 승인 문구 필요)

### 환경변수 표기

| 셸 | 환경변수 표기 |
|-----|-------------|
| PowerShell | `$env:USERPROFILE`, `$env:LOCALAPPDATA` |
| CMD | `%USERPROFILE%` |
| bash (explicit WSL only) | `$HOME`, `$USER` |

---

## WSL 정책 (fail-closed)

- WSL은 **현재 task 또는 operator가 명시적으로 승인한 경우**에만 사용한다.
- `wsl.exe`, `/mnt/*`, Linux `git`/`node`/`npm`/`gh`/`psql`/`pg_dump`, `umask`, `mktemp`는 **implicit fallback이 아니다**.
- 필수 Windows-native 도구가 없으면 중단한다. WSL로 자동 우회하지 않는다.
- historical WSL 문서·감사 기록은 이 문서의 현재 기본값을 override하지 않는다.
  - 역사 참고: `docs/ops/REMOTE_ACCESS_AND_WSL.md` (HISTORICAL_AUDIT / SUPERSEDED)

---

## 한글/공백 경로 처리

이 프로젝트 경로에는 한글과 공백이 포함될 수 있다.

1. 셸 명령에서는 경로를 따옴표로 감싼다.
2. `git -C`, `rg`, `node`, `npm` 등 경로 인자를 받는 명령도 quoted path를 사용한다.
3. 가능하면 먼저 worktree root로 이동한 뒤 상대경로를 사용한다.
4. 자동화 프롬프트에는 "경로에 한글/공백이 있으면 quoting 필수"를 함께 적는다.

경로 문제로 명령이 한 번 실패했다고 해서 파일/도구가 없다고 단정하지 말고, quoting과 **실제 OS/shell**을 먼저 재확인한다.

---

## 작업 사본 구분 (참고)

경로는 workstation마다 다를 수 있다. 아래는 과거 운영에서 쓰인 **참고 라벨**이다.

### 컴1 작업 사본 (참고)

- Windows: `G:\Ddrive\BatangD\task\workdiary\LoveBud`
- 사용 예: Windsurf 및 일반 Windows agent

### 컴2 작업 사본 (참고)

- Windows: `G:\다른 컴퓨터\내 컴퓨터\LoveBud`

### 원칙

- 두 경로는 같은 프로젝트 이름을 가지더라도 서로 다른 작업 사본일 수 있다.
- 결과 보고 시 어느 Windows worktree 기준으로 확인했는지 분명히 밝힌다.
- 다른 작업 사본에서 생성된 결과는 현재 경로 상태와 다를 수 있다.

---

## Historical / explicitly authorized WSL reference

> **Warning:** 이 섹션은 **과거 환경 기록**이며 **현재 WSL 사용을 승인하지 않는다**.
> 현재 실행 authority는 `AGENTS.md`와 본 문서 상단의 Windows-native 기본값이다.
> WSL 사용은 task/operator 명시 승인이 있을 때만 허용된다.

### 과거 WSL 경로 예시 (historical)

- 윈도우: `G:\Ddrive\BatangD\task\workdiary\LoveBud`
- 과거 WSL: `/mnt/g/Ddrive/BatangD/task/workdiary/LoveBud`

### 과거 WSL 마운트 / 네트워크 공유 (historical)

- WSL에서는 로컬 Windows 드라이브가 보통 `/mnt/<drive-letter>` 아래에 마운트될 수 있었다.
- 예: `G:\다른 컴퓨터\내 컴퓨터\LoveBud` → `/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud`
- UNC 공유 예 (과거): `\\PADIEM-COMMAND-\내pcG` → `/mnt/padiem_g`
- 컴1 과거 WSL 접근 경로 예: `/mnt/padiem_g/Ddrive/BatangD/task/workdiary/LoveBud`

과거 참고 명령 (explicit authorization 없이 실행하지 말 것):

```bash
mkdir -p /mnt/padiem_g
mount -t drvfs '\\PADIEM-COMMAND-\내pcG' /mnt/padiem_g
```

### 과거 문구 (superseded)

다음 문구는 **더 이상 현재 기본값이 아니다** (기록 목적):

- “Codex는 기본적으로 WSL/bash 기준으로 작업합니다”
- “실제 셸 실행은 WSL quoted path 사용”
- “Codex만 WSL/Linux 경로를 사용할 수 있습니다”를 현재 기본 실행 경로로 해석하는 것

---

## SSH/Git 작업 주의

SSH/Git/파일 복사 작업은 셸 혼동이 잦으므로, 명령 예시를 줄 때도 **셸 종류를 먼저 명시**한다.
Windows 기본 작업에서는 PowerShell 문법을 사용한다.
