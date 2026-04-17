# Remote Access And WSL

이 문서는 컴1에서 컴2로 원격 접근할 때의 SSH 설정, 컴2의 WSL 드라이브 마운트 문제, Windows Codex 셸 실행기 이슈를 기록합니다.

## 적용 대상

- 컴1: `G:\Ddrive\BatangD\task\workdiary\LoveBud`
- 컴2: `G:\다른 컴퓨터\내 컴퓨터\LoveBud`
- 컴2 OS: Windows + WSL

## 1. 컴1에서 컴2로 SSH 붙이기

### 컴2에서 확인할 기본 상태

PowerShell:

```powershell
whoami
ipconfig
Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH.Server*'
Get-Service sshd
Get-NetFirewallRule | Where-Object DisplayName -like '*OpenSSH*'
```

정상 기준:

- `OpenSSH.Server~~~~0.0.1.0` 가 `Installed`
- `sshd` 가 `Running`
- OpenSSH 관련 inbound firewall rule 이 `Enabled=True`

### 컴1에서 붙는 기본 명령

```bash
ssh user@192.168.0.101
```

처음 접속에서 호스트 키 충돌이 나면 컴1에서:

```bash
ssh-keygen -f /root/.ssh/known_hosts -R 192.168.0.101
ssh-keyscan -H 192.168.0.101 >> /root/.ssh/known_hosts
```

## 2. 관리자 계정의 공개키 인증

컴2 `user` 계정은 `BUILTIN\Administrators` 소속이었다.
이 경우 Windows OpenSSH 기본 설정상 `%USERPROFILE%\.ssh\authorized_keys` 대신
`C:\ProgramData\ssh\administrators_authorized_keys` 를 읽을 수 있다.

### 컴1 공개키를 컴2에 등록

컴2 PowerShell:

```powershell
Add-Content C:\ProgramData\ssh\administrators_authorized_keys 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINwVZBswKZVPMSRRWhs+3eM8JoHNteohn4gKJD3szJrH Padiem Command Center GitHub'
icacls C:\ProgramData\ssh\administrators_authorized_keys /inheritance:r
icacls C:\ProgramData\ssh\administrators_authorized_keys /grant Administrators:F
icacls C:\ProgramData\ssh\administrators_authorized_keys /grant SYSTEM:F
Restart-Service sshd
```

확인:

```powershell
whoami /groups
Get-Content C:\ProgramData\ssh\administrators_authorized_keys
```

### 컴1에서 키 지정 접속

```bash
ssh -i /root/.ssh/id_ed25519_github_padiem -o IdentitiesOnly=yes user@192.168.0.101 hostname
```

정상일 때 컴2 hostname 이 반환된다.

## 3. 컴2 WSL 의 `/mnt/g` 빈 폴더 문제

### 증상

- `ls /mnt` 에 `g` 는 보이는데 `ls /mnt/g` 결과가 비거나 이상함
- `mount | grep '/mnt/g'` 결과 없음
- `df -h /mnt/g` 가 WSL 루트 파일시스템으로 표시됨
- Windows `G:\` 에는 실제 폴더가 존재함

이 경우 `/mnt/g` 는 Windows `G:` 드라이브가 아니라 그냥 WSL 내부 빈 디렉터리다.

### 수동 복구

WSL:

```bash
sudo umount /mnt/g 2>/dev/null
sudo mount -t drvfs G: /mnt/g
ls -la /mnt/g
```

정상 기준:

- `다른 컴퓨터`
- `내 드라이브`

같은 Windows `G:\` 실제 폴더가 보여야 한다.

### 프로젝트 진입

```bash
cd "/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud"
pwd
```

정상 경로:

```text
/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud
```

## 4. WSL 자동 마운트 고정

컴2의 `/etc/wsl.conf` 를 아래처럼 고정했다.

```ini
[boot]
systemd=true

[interop]
appendWindowsPath=true

[automount]
enabled=true
root=/mnt/
options=metadata,umask=22,fmask=11
mountFsTab=true
```

적용 절차:

1. 열려 있는 WSL 셸을 모두 종료
2. Windows PowerShell 에서:

```powershell
wsl --shutdown
wsl
```

3. WSL 에서 확인:

```bash
ls "/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud"
```

## 5. `wsl: Failed to translate 'G:\...'` 문제

### 증상

Windows PowerShell 에서:

```powershell
cd "G:\다른 컴퓨터\내 컴퓨터\LoveBud"
wsl
```

이때 다음 오류가 날 수 있다.

```text
wsl: Failed to translate 'G:\다른 컴퓨터\내 컴퓨터\LoveBud'
```

원인:

- 현재 Windows 작업 경로를 WSL 이 Linux 경로로 자동 변환하려다 실패

### 안전한 진입 방식

Windows PowerShell:

```powershell
cd C:\
wsl
```

그다음 WSL:

```bash
cd "/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud"
```

또는 Windows PowerShell 에서 바로:

```powershell
wsl -e bash -lc 'cd "/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud" && exec bash'
```

## 6. 컴2 Windows Codex 의 `batch file arguments are invalid`

### 재현 증상

컴2 Codex 의 shell command 실행이 아래처럼 전반적으로 실패했다.

- `whoami`
- `Get-Location`
- `cmd /c cd`
- `powershell.exe -NoProfile -Command Get-Location`
- `D:\cli\pwsh.bat -Command whoami`

오류 메시지 핵심:

```text
batch file arguments are invalid
```

### 확인된 사실

- PowerShell 자체는 정상
- 사용자가 PowerShell 에서 직접 스크립트를 실행하면 정상
- `codex.cmd --version` 도 정상
- `where pwsh` 결과가 처음에는 `D:\cli\pwsh.bat` 뿐이었음

`D:\cli\pwsh.bat` 내용:

```bat
@echo off
powershell -NoProfile -ExecutionPolicy Bypass %*
```

즉 실제 `pwsh.exe` 가 아니라, 인자 전달이 불안정한 `.bat` 래퍼를 `pwsh` 대체물로 쓰고 있었다.

### 조치

컴1에서 원격으로 PowerShell 7 설치:

```powershell
winget install --id Microsoft.PowerShell --source winget --accept-source-agreements --accept-package-agreements --disable-interactivity
```

설치 후 확인:

```powershell
where.exe pwsh
pwsh -NoProfile -Command whoami
```

정상 기준:

- `C:\Program Files\PowerShell\7\pwsh.exe`
- 그 다음 순서로 `D:\cli\pwsh.bat`

즉 실제 `pwsh.exe` 가 PATH 에서 우선 잡혀야 한다.

### 후속 권장

- 컴2에서 Codex 를 완전히 종료하고 새 PowerShell 창에서 재실행
- 이후에도 동일 증상이 남으면 `D:\cli\pwsh.bat` 이름 변경 또는 제거 검토

## 7. 빠른 체크리스트

컴2에서 원격/WSL/Codex 이상이 다시 생기면 아래 순서로 본다.

1. PowerShell:

```powershell
Get-Service sshd
ipconfig
where.exe pwsh
```

2. WSL:

```bash
ls /mnt
mount | grep '/mnt/g'
ls "/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud"
```

3. WSL 경로 진입 후:

```bash
cd "/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud"
codex --help
codex
```
