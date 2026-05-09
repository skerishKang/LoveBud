# Git 튜토리얼

이 문서는 LoveBud 프로젝트에서 Git을 사용해 기본적인 작업 흐름을 익히기 위한 간단한 가이드를 제공합니다.

## 1️⃣ 기본 명령어
- `git status` – 현재 작업 트리 상태 확인
- `git add <파일>` – 변경된 파일을 스테이징 영역에 추가
- `git commit -m "커밋 메시지"` – 스테이징된 파일을 커밋
- `git push` – 로컬 커밋을 원격 저장소에 푸시

## 2️⃣ 예시 워크플로우 (LoveBud 원칙)
```bash
# 1. 파일 수정 후 현재 상태 확인
git status

# 2. 변경된 파일만 명시적으로 스테이징 (LoveBud 원칙: git add -A 금지)
git add js/my-trees.js docs/pages/my-trees.md
# 또는 관련 파일만
git add js/ docs/pages/

# 3. 의미있는 커밋 메시지와 함께 커밋
git commit -m "Add Git tutorial docs"

# 4. 원격 저장소에 푸시 (기본 브랜치가 main인 경우)
git push origin main
```

> **참고:** LoveBud 프로젝트에서는 `git add -A`와 `git add .`를 금지합니다.
> 관련 파일만 명시적으로 staging하는 것이 원칙입니다.

## 3️⃣ 팁
- **커밋 메시지는 왜(Why)와 무엇(What)을 명확히** 적어 주세요.
- 커밋 전 `git diff` 로 변경 내용을 검토하면 실수를 방지할 수 있습니다.
- 원격 브랜치가 업데이트된 경우 `git pull --rebase` 로 최신 커밋을 받아와 충돌을 최소화합니다.

## 4️⃣ 흔히 묻는 질문
- **커밋을 잘못했어요** – `git commit --amend` 로 마지막 커밋을 수정하거나, `git reset` 로 스테이징을 되돌릴 수 있습니다.
- **푸시가 거부됐어요** – 원격에 새로운 커밋이 있을 경우 `git pull --rebase` 후 다시 `git push` 합니다.

---

> **LoveBud 운영 원칙:** `git add -A`와 `git add .`를 금지합니다.
> 관련 파일만 명시적으로 staging하는 것이 원칙입니다.
> 상세: `docs/ops/PATHS_AND_SHELLS.md`
