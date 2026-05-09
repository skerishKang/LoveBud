# 경로 및 셸 운영 메모

이 문서는 LoveBud 프로젝트의 경로 처리와 셸 명령 실행에 대한 상세 운영 메모입니다.

## 경로 기본 원칙

- 다른 모델에게 지시를 쓸 때는 기본적으로 윈도우 경로를 사용합니다.
- Codex는 내부적으로 WSL 경로를 사용할 수 있습니다.
- 문서, 프롬프트, 운영 메모에서는 WSL 특정 맥락이 필요하지 않은 한 `G:\...` 경로를 선호합니다.

예시:
- 윈도우: `G:\Ddrive\BatangD\task\workdiary\LoveBud`
- Codex WSL: `/mnt/g/Ddrive/BatangD/task/workdiary/LoveBud`

---

## WSL 마운트 / 네트워크 공유

### Windows 드라이브 마운트
- WSL에서는 로컬 Windows 드라이브가 보통 `/mnt/<drive-letter>` 아래에 자동 마운트됩니다.
- 예: `G:\다른 컴퓨터\내 컴퓨터\LoveBud` -> `/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud`

### 네트워크 공유 (UNC) 마운트
- 네트워크 공유(UNC)는 자동으로 보이지 않을 수 있습니다.
- Codex는 필요 시 UNC 공유를 직접 WSL에 마운트해서 다른 작업 사본을 확인할 수 있습니다.

#### 실제 확인된 컴1 공유 예시
- UNC: `\\PADIEM-COMMAND-\내pcG`
- WSL 마운트 지점: `/mnt/padiem_g`
- 컴1 작업 사본 실제 접근 경로: `/mnt/padiem_g/Ddrive/BatangD/task/workdiary/LoveBud`

#### 참고 명령
```bash
mkdir -p /mnt/padiem_g
mount -t drvfs '\\PADIEM-COMMAND-\내pcG' /mnt/padiem_g
```

#### 양쪽 사본 동시 접근
Codex는 현재 세션에서 다음 두 작업 사본 모두를 직접 열 수 있을 수 있습니다:
- 컴2: `/mnt/g/다른 컴퓨터/내 컴퓨터/loveBud`
- 컴1: `/mnt/padiem_g/Ddrive/BatangD/task/workdiary/LoveBud`

**주의**: 네트워크 공유 마운트는 세션/환경에 따라 사라질 수 있으므로 새 세션에서는 다시 확인해야 합니다.

---

## 한글/공백 경로 처리

이 프로젝트 경로에는 한글과 공백이 포함되어 있습니다.
- 예: `G:\다른 컴퓨터\내 컴퓨터\LoveBud`
- WSL: `/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud`

### 처리 원칙
1. **셸 명령에서는 항상 전체 경로를 큰따옴표로 감쌉니다**.
   - 예: `cd "/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud"`
2. `git -C`, `sed`, `rg`, `node`, `npm` 등 경로 인자를 받는 명령도 **항상 quoted path**를 사용합니다.
   - 예: `git -C "/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud" status`
3. 가능하면 매 명령마다 긴 경로를 반복하지 말고, 먼저 작업 디렉터리로 이동한 뒤 상대경로를 사용합니다.
   - 예: `cd "/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud" && rg -n "pattern" js pages`
4. Windows 경로를 직접 쓰는 대신, Codex/WSL에서는 가능하면 `/mnt/...` 경로로 변환해서 사용합니다.
5. 자동화 스크립트/에이전트 프롬프트에는 "경로에 한글/공백이 있으므로 quoting 필수"를 함께 적습니다.

### 경로 문제 발생 시
- 경로 문제로 명령이 한 번 실패했다고 해서 파일/도구가 없는 것으로 단정하지 말고, 먼저 quoting/WSL 경로 변환 문제를 재확인하세요.

### 실무 팁
- 긴 명령보다 `workdir` 또는 `git -C "..."` 사용 우선
- 파일 링크/문서 지시에는 Windows 경로를 쓰되, 실제 셸 실행은 WSL quoted path 사용
- 새 스크립트를 만들 때는 repo root 기준 상대경로를 기본으로 작성

---

## 셸/명령 문법 규칙

### 셸 확인
에이전트는 **현재 실제 실행 셸을 먼저 확인하고, 그 셸 문법만 사용**합니다.
- bash / PowerShell / CMD 문법을 한 작업 안에서 섞지 않습니다.
- Codex는 기본적으로 WSL/bash 기준으로 작업합니다.

### 셸 지정
다른 모델에게 운영 작업을 시킬 때는 프롬프트 첫 줄에 반드시 아래 중 하나를 고정해서 적습니다.
- `Windows PowerShell 기준으로만 실행`
- `Windows CMD 기준으로만 실행`
- `WSL bash 기준으로만 실행`

### 환경변수 표기
| 셸 | 환경변수 표기 |
|-----|-------------|
| bash | `$HOME`, `$USER` |
| PowerShell | `$env:USERPROFILE` |
| CMD | `%USERPROFILE%` |

### SSH/Git 작업 주의
SSH/Git/파일 복사 작업은 셸 혼동이 잦으므로, 명령 예시를 줄 때도 셸 종류를 먼저 명시합니다.

---

## 작업 사본 구분

### 컴2 작업 사본
- Windows: `G:\다른 컴퓨터\내 컴퓨터\LoveBud`
- WSL: `/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud`
- 사용: Codex, OpenCode 계열 에이전트

### 컴1 작업 사본
- Windows: `G:\Ddrive\BatangD\task\workdiary\LoveBud`
- WSL (UNC 마운트): `/mnt/padiem_g/Ddrive/BatangD/task/workdiary/LoveBud`
- 사용: Windsurf

### 경로로 사본 판별
- 경로가 `/mnt/g/다른 컴퓨터/내 컴퓨터/loveBud` 또는 `G:\다른 컴퓨터\내 컴퓨터\LoveBud` → **컴2**
- 경로가 `G:\Ddrive\BatangD\task\workdiary\LoveBud` → **컴1**
- 경로가 `/mnt/padiem_g/...` → **컴1**

### OS/실행 환경
- **Codex만 WSL/Linux 경로를 사용할 수 있습니다**
- Windsurf 및 기타 일반 에이전트는 보통 Windows 경로 기준으로 작업합니다

### 중요한 원칙
- 두 경로는 같은 프로젝트 이름을 가지더라도 서로 다른 작업 사본일 수 있습니다.
- 에이전트는 결과 보고 시 어느 경로 기준으로 확인했는지 분명히 밝혀야 합니다.
- 다른 작업 사본에서 생성된 결과는 현재 경로 상태와 다를 수 있습니다.