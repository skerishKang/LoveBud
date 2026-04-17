# Git Publish

## 이 스킬을 언제 쓰이나?

- **작업 완료 후 커밋할 때**: 관련 파일만 staging
- **변경 범위 확인**: diff vs staged vs unstaged
- **push 전 검증**: remote/branch 상태 확인

## 입력으로 필요한 것

| 항목 | 필수 | 설명 |
|------|------|------|
| 변경 파일 | 필수 | staging할 파일 목록 (명시적 파일/경로) |
| 커밋 메시지 | 필수 | 한 줄 요약 |
| push 여부 | 선택 | 기본 false, 명시 시 true |

## 출력 결과

- Staged 파일 목록
- Commit 생성
- (push 시) 원격(remote)에 푸시

## 작업 흐름

### 1. 변경 파일 확인

```bash
# unstaged + staged 전체 확인
git status

# unstaged만 확인  
git diff

# staged만 확인
git diff --staged

# 최근 커밋 확인
git log --oneline -5
```

### 2. staging (관련 파일만, 정확히)

```bash
# ✅ 권장: 파일 하나
git add js/editor.js

# ✅ 권장: 특정 파일만
git add js/i18n.js netlify/functions/trees.js

# ⚠️ 경고: 폴더 전체는 변경 범위가 넓어짐
# git add js/
# git add netlify/functions/

# ❌ 금지: 전체 staging
# git add -A
# git add .
```

### 3. 커밋

```bash
git commit -m "{타입}: {한 줄 요약}"

# 타입 규칙:
# - fix: 버그 수정
# - feat: 새 기능
# - refactor: 리팩터링
# - test: 테스트
# - docs: 문서
# - chore: 기타
```

### 4. push 전 검증

```bash
# branch 상태
git status

# remote 설정
git remote -v

# 현재 branch
git branch

# origin/main 대비
git log origin/main..HEAD --oneline
```

### 5. push (명시 요청 시)

```bash
# 기본 push
git push origin <branch>

# upstream 설정 + push
git push -u origin <branch>

# ⚠️ 주의: force는 명시적 요청 시에만, --force-with-lease 사용
git push --force-with-lease
```

## 안전 규칙

- **권장 안 함**: 명시적 요청 없이 `git push --force`
- **권장 안 함**: 검토되지 않은 변경 푸시
- **필수**: staging 전 `git diff`로 변경 범위 확인
- **권장**: `git add <파일>`로 정확히 지정, 폴더 전체는 피하기
- **규칙**: commit message는 `{type}: {description}` 형식

## 자주 쓰는 명령어 모음

```bash
# 상태 + unstaged + staged 전체
git status && git diff && git diff --staged

# ✅ 권장: 특정 파일만 staging
git add js/editor.js
git add scripts/verify-core-flows.js

# 직전 커밋 확인
git log --oneline -1

# ⚠️ 주의: amend는 이미 푸시한 커밋에는 사용 금지
# git commit --amend --no-edit
```

## Templates

### commit message 패턴

```
{타입}: {한 줄 요약}

- {세부 변경 1}
- {세부 변경 2}
```

##Metadata
created: 2026-04-17
category: git