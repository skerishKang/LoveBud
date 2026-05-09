# LoveBud 병렬 에이전트 빠른 규칙

이 문서는 `AGENTS.md`를 보완하는 병렬 작업 전용 빠른 규칙입니다. 상세 기준은 `docs/ops/PARALLEL_WORKTREE_AGENT_POLICY.md`를 따릅니다.

## 필수 원칙

```text
작업 1개 = 브랜치 1개 = worktree 1개 = PR 1개
검증 1개 = 검증 전용 worktree 1개 또는 읽기 전용 PR 검토 1개
main 통합 = GitHub PR only
LoveBud 원본 폴더 = clean main baseline only
```

## 로컬 폴더 기준

```text
G:\Ddrive\BatangD\task\workdiary\
  LoveBud\                    # control repo / main 기준 폴더, 직접 작업 금지
  LoveBud-wt-codex\            # Codex 전용
  LoveBud-wt-gemini\           # Gemini 전용
  LoveBud-wt-windsurf1\        # Windsurf1 전용
  LoveBud-wt-windsurf2\        # Windsurf2 전용
```

## 브랜치 운영

- CTO가 매번 브랜치명을 지정하지 않아도 됩니다.
- 에이전트는 자기 전용 worktree에서 작업 성격에 맞는 새 브랜치명을 직접 정합니다.
- 단, 반드시 최신 `origin/main` 기준으로 새 브랜치를 만들어야 합니다.
- `main`에서 직접 작업하지 않습니다.
- 기존 작업 브랜치를 재사용하지 않습니다.
- 시작 보고에는 branch name, base SHA, `git status --short` 결과를 포함합니다.

## 구현 에이전트 금지사항

- 지정된 worktree 밖 접근 금지
- `LoveBud` control repo에서 코드 수정 금지
- 다른 에이전트 worktree 접근 금지
- `main` 직접 수정/push 금지
- merge 금지
- CTO 승인 전 push/PR 생성 금지
- 허용 파일 외 수정 금지
- `.secrets`, `.env`, token, cookie, session, password, `DATABASE_URL` 값 출력 금지
- `netlify.toml`, `netlify/**`, `netlify/sql/**` actual deletion은 CTO의 별도 삭제 PR 승인 전 금지

## 검증 에이전트 금지사항

검증 에이전트는 기본적으로 읽기 전용입니다.

- 코드 수정 금지
- 파일 삭제 금지
- 커밋 금지
- push 금지
- PR 생성/수정 금지
- merge 금지
- `npm install` 금지
- `package-lock` 변경 금지
- secret/env/token/DB URL 출력 금지

## 시작 시 필수 확인

```powershell
git status --short
git branch --show-current
git rev-parse --short HEAD
git fetch origin
git checkout -B <agent-chosen-task-branch> origin/main
git status --short
git rev-parse HEAD
```

예상하지 못한 수정 파일이 있으면 즉시 중단하고 보고합니다.

## 통합 방식

로컬 폴더끼리 파일을 복사해서 합치지 않습니다.

```text
잘못된 방식:
LoveBud-wt-codex 파일을 LoveBud에 직접 복사

올바른 방식:
LoveBud-wt-codex → branch push → PR → main merge
```
