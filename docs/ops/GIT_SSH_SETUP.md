# Git / SSH 푸시 운영 메모

이 문서는 LoveBud 프로젝트의 Git 및 SSH 설정에 대한 상세 운영 메모입니다.

## SSH 키 위치

### 실사용 SSH 키
실사용 SSH 키 위치는 각 컴퓨터의 기본 SSH 폴더입니다.
- Windows: `%USERPROFILE%\.ssh\`
- WSL/Linux: `~/.ssh/`

### LoveBud 내부 백업
LoveBud 내부 `.ssh-backup/`은 **공유/복구용 백업**입니다.

### 권장 운영
1. 컴1도 로컬 `.ssh` 보관
2. 컴2도 로컬 `.ssh` 보관
3. LoveBud의 `.ssh-backup/`은 별도 복구용으로 유지

즉, push는 각 컴퓨터의 로컬 `.ssh`를 기준으로 하고, 공유 폴더의 키는 필요 시 복구/복사에 사용합니다.

---

## GitHub 원격 URL

GitHub 원격 URL은 가능하면 SSH를 사용합니다.
- 권장: `git@github.com:skerishKang/LoveBud.git`

---

## 푸시 막힐 때 확인 사항

push가 막히면 세부 명령부터 시도하기보다 먼저 아래만 확인합니다.

### 확인 체크리스트
1. `remote -v` - 원격 URL 확인
2. 로컬 `.ssh` 존재 여부 확인
3. 공유 백업 폴더 `.ssh-backup/` 존재 여부 확인
4. `known_hosts` / `config` 기본 설정 여부 확인

### 세부 복구 절차
세부 복사 명령이나 일회성 복구 절차는 `AGENTS.md`에 길게 적지 말고, 필요할 때만 로컬 메모 또는 현재 세션에서 처리합니다.

---

## SSH 별칭이 작동하지 않을 때

SSH 별칭 `github.com-padiem`이 작동하지 않으면 fallback 명령을 사용합니다:

```bash
GIT_SSH_COMMAND='ssh -i /root/.ssh/id_ed25519_github_padiem -o IdentitiesOnly=yes' git push origin <branch>
```

---

## 브랜치 운영

### 메인 브랜치
- **메인 브랜치**: 작은 직접 변경 또는 사용자 명시적 승인 시에만 사용

### 피처 브랜치
- **피처 브랜치**: 그 외 대부분의 변경은 `feature/...`, `fix/...`, `docs/...`, `chore/...` 브랜치에서 진행

### 병합 전 충돌 리스크
병합 전 충돌 리스크를 충분히 검토하세요.

---

## Fossil / Git 히스토리 원칙

Fossil을 사용할 수 있다면 두 레이어를 구분하여 운영합니다:

- **Fossil**: 광범위한 로컬 복구 히스토리 (의미 있는 작업 단계마다 스냅샷)
- **Git**: GitHub용 선별된 공유 히스토리

### 표준 패턴
```bash
# 1. 로컬 스냅샷 (Fossil)
fossil status
fossil addremove
fossil commit -m "local snapshot: 작업 내용"

# 2. 공유 준비가 되면 (Git)
git status
git add <관련 파일들만>
git commit -m "feat: 공유할 변경 내용"
git push origin <branch>
```

**참고**: 이 저장소가 Fossil 체크아웃이 아니면 Fossil 단계를 건너뛰고 Git만 사용합니다.

---

## 푸시 전 확인 항목

푸시 전 반드시 확인:
- 요청한 작업이 올바르게 반영되었는지
- 불필요하거나 민감한 파일이 포함되지 않았는지
- 검증 여부가 문서화된 상태인지

### 푸시 전 사용자 확인이 필요한 경우
- 메인 브랜치(`main`)로 직접 푸시할 때 (작은 변경 제외)
- 공유 히스토리를 rewrite할 가능성이 있을 때
- 사용자가 명시적으로 확인을 요청한 경우

---

## 충돌 발생 시 처리

원격과 충돌이 발생하면 무리하게 덮어쓰지 마세요.

### 처리 절차
1. `git fetch`로 최신 상태를 가져옴
2. 충돌 내용을 확인
3. 필요시 `git pull --rebase` 또는 수동 병합 후 진행
4. 병합 후 다시 검증

---

## 안전 규칙

- 검토되지 않은 관련 없는 변경 푸시 금지
- 명���적 요청 없으면 공유 히스토리 재작성 금지
- 파괴적 git 명령어 무분별 사용 금지
- 명시적 지시 없으면 사용자의 변경 복구 금지
- 트리가 더러우면 의도한 파일을 분리하고 관련 없는 변경 무시