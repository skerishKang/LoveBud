# SSH 키 설정 가이드 (GitHub 로그인 없이 커밋/푸시)

> HTTPS 매번 로그인하기 귀찮으니까 SSH 키로 설정합시다.

---

## 🎯 목표

**설정 전**: HTTPS로 커밋/푸시할 때마다 GitHub 아이디/비번 입력  
**설정 후**: SSH 키로 자동 인증, 로그인 필요 없음

---

## ⚡ 빠른 설정 (3분 완료)

### 1. SSH 키 생성

```powershell
# PowerShell에서 실행
ssh-keygen -t ed25519 -C "your-email@example.com"
```

**입력값**:
- 파일 저장 위치: `Enter` (기본값: `~/.ssh/id_ed25519`)
- 비밀번호: `Enter` (비워두기 = 비밀번호 없음)

---

### 2. SSH 키 확인

```powershell
# 공개키 내용 확인
cat ~/.ssh/id_ed25519.pub
```

**출력 예시**:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDIhz2GK/XCUj4i6Q5yQJNL1MXMY0RxzPV2QrBqfHrDq your-email@example.com
```

---

### 3. GitHub에 SSH 키 등록

1. GitHub 로그인 → 우측 상단 프로필 → **Settings**
2. 좌측 메뉴 → **SSH and GPG keys**
3. **New SSH key** 버튼 클릭
4. 제목: `Windsurf Local` (아무거나)
5. Key: 위에서 복사한 `ssh-ed25519` 내용 붙여넣기
6. **Add SSH key** 클릭

---

### 4. Git 저장소 URL 변경

```powershell
# 현재 저장소에서만 적용
cd G:\Ddrive\BatangD\task\workdiary\LoveBud

# 원격 URL 확인
git remote -v
# origin  https://github.com/skerishKang/LoveBud.git (fetch)
# origin  https://github.com/skerishKang/LoveBud.git (push)

# SSH URL로 변경
git remote set-url origin git@github.com:skerishKang/LoveBud.git

# 변경 확인
git remote -v
# origin  git@github.com:skerishKang/LoveBud.git (fetch)
# origin  git@github.com:skerishKang/LoveBud.git (push)
```

---

### 5. 테스트

```powershell
# SSH 연결 테스트
ssh -T git@github.com

# 출력
Hi skerishKang! You've successfully authenticated, but GitHub does not provide shell access.
```

**이 메시지 나오면 성공!**

---

## 🆕 새 세션에서 SSH 키 등록 (중요!)

> **문제**: 새로운 Cascade 세션에서는 SSH 에이전트가 초기화되어 키가 등록 안 됨  
> **해결**: 매 세션 시작 시 SSH 키를 에이전트에 다시 등록

### 빠른 해결 (1분)

```powershell
# 1. SSH 에이전트 실행
Start-Service ssh-agent

# 2. 키 등록
ssh-add ~/.ssh/id_ed25519

# 3. 확인
ssh-add -l

# 4. 푸시 테스트
git push origin main
```

**이제 로그인 없이 푸시됩니다!**

---

### 6. 커밋/푸시 테스트

```powershell
git add .
git commit -m "test: SSH 설정 완료"
git push origin main
```

**로그인 창 없이 바로 푸시되면 완성!**

---

## 🔧 고급 설정 (선택)

### SSH 에이전트 자동 실행 (Windows)

```powershell
# SSH 에이전트 서비스 활성화
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent

# 키 등록
ssh-add ~/.ssh/id_ed25519
```

### 여러 GitHub 계정 사용 시

```powershell
# 다른 키 생성
ssh-keygen -t ed25519 -C "work-email@company.com" -f ~/.ssh/id_ed25519_work

# GitHub에 work 키도 등록

# 저장소별로 다른 SSH 키 사용
git remote set-url origin git@github-work:company/repo.git
```

---

## ❌ 문제 해결

### Permission denied (publickey)

```powershell
# 1. SSH 에이전트 확인
Get-Service ssh-agent

# 2. 키 다시 추가
ssh-add ~/.ssh/id_ed25519

# 3. GitHub에 키 등록 확인
# Settings → SSH keys 에서 등록된 키 확인
```

### Could not resolve hostname github.com

```powershell
# SSH 재설치 (Windows 10/11)
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

---

## 📋 확인 체크리스트

- [ ] SSH 키 생성 (`~/.ssh/id_ed25519.pub` 존재)
- [ ] GitHub에 SSH 키 등록 완료
- [ ] 저장소 URL을 SSH로 변경 (`git@github.com:...`)
- [ ] SSH 연결 테스트 성공 (`ssh -T git@github.com`)
- [ ] 로그인 없이 푸시 테스트 성공

---

## 💡 팁

**한번 설정하면 영구 적용**
- Windows 재부팅해도 유지됨
- 다른 저장소도 동일한 SSH 키 사용 가능
- 새 저장소는 `git remote set-url`만 실행하면 됨

**보안**
- 개인키(`id_ed25519`)는 절대 공유하지 마세요
- 공개키(`id_ed25519.pub`)만 GitHub에 등록

---

*설정 완료 후에는 `git push`만 하면 바로 올라갑니다!*
