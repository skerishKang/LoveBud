# 병렬 Worktree / 에이전트 운영 정책

상태: Active operating policy  
적용 범위: LoveBud 로컬/웹 에이전트 작업, 구현 작업, 검증 작업, PR 통합 흐름

---

## 1. 목적

LoveBud는 여러 AI 모델과 실행자가 병렬로 작업합니다. 브랜치만 나누면 충분하지 않습니다. 같은 로컬 작업 폴더를 공유하면 checkout, reset, 미커밋 변경, 생성 파일, 의존성 설치, cleanup 명령 때문에 서로의 작업이 섞일 수 있습니다.

따라서 LoveBud 병렬 작업은 아래 원칙을 따릅니다.

```text
작업 1개 = 브랜치 1개 = worktree 1개 = PR 1개
검증 1개 = 검증 전용 worktree 1개 또는 읽기 전용 PR 검토 1개
통합 = GitHub PR을 통한 main 순차 merge
```

전용 worktree는 고정하지만, 실제 작업 브랜치명은 CTO가 매번 지정하지 않아도 됩니다. 에이전트는 자기 전용 worktree에서 작업 성격에 맞는 새 브랜치명을 정하고, 반드시 최신 `origin/main` 기준으로 분기한 뒤 branch name / base SHA / clean 상태를 보고합니다.

---

## 2. GitHub 저장소 기준

GitHub 저장소는 하나만 사용합니다.

```text
skerishKang/LoveBud
```

별도 저장소를 여러 개 만들지 않습니다. 병렬 작업은 단일 저장소 안에서 브랜치, PR, 로컬 worktree로 분리합니다.

---

## 3. 로컬 폴더 기준

권장 구조:

```text
G:\Ddrive\BatangD\task\workdiary\
  LoveBud\                    # control repo / main 기준 폴더
  LoveBud-wt-codex\            # Codex 구현 worktree
  LoveBud-wt-gemini\           # Gemini 구현 worktree
  LoveBud-wt-windsurf1\        # Windsurf1 구현 worktree
  LoveBud-wt-windsurf2\        # Windsurf2 구현 worktree
  LoveBud-vfy-*\               # 선택: 검증 전용 worktree
```

`LoveBud` 원본 폴더는 control repo입니다. feature 작업, 실험, 코드 수정에 사용하지 않습니다.

`LoveBud`에서 허용되는 작업:

```text
git fetch origin
git reset --hard origin/main
git worktree list
git worktree add ...
git worktree remove ...
```

`LoveBud`에서 금지되는 작업:

```text
코드 수정
커밋
기능 브랜치 작업
PR 구현
수동 실험
의존성 변경
```

---

## 4. Worktree 생성

control repo인 `LoveBud`에서 실행합니다.

```powershell
cd G:\Ddrive\BatangD\task\workdiary\LoveBud
git fetch origin

git worktree add -b work/codex G:\Ddrive\BatangD\task\workdiary\LoveBud-wt-codex origin/main
git worktree add -b work/gemini G:\Ddrive\BatangD\task\workdiary\LoveBud-wt-gemini origin/main
git worktree add -b work/windsurf1 G:\Ddrive\BatangD\task\workdiary\LoveBud-wt-windsurf1 origin/main
git worktree add -b work/windsurf2 G:\Ddrive\BatangD\task\workdiary\LoveBud-wt-windsurf2 origin/main
```

생성 전 control repo는 반드시 clean 상태여야 합니다.

```powershell
git status --short
git clean -fdn
```

tracked 변경 또는 미정리 untracked directory가 있으면 worktree 생성을 중단하고 보고합니다.

---

## 5. 에이전트별 전용 폴더

각 모델은 자신에게 배정된 worktree만 사용합니다.

```text
Codex:     G:\Ddrive\BatangD\task\workdiary\LoveBud-wt-codex
Gemini:    G:\Ddrive\BatangD\task\workdiary\LoveBud-wt-gemini
Windsurf1: G:\Ddrive\BatangD\task\workdiary\LoveBud-wt-windsurf1
Windsurf2: G:\Ddrive\BatangD\task\workdiary\LoveBud-wt-windsurf2
```

금지:

```text
다른 모델 worktree 접근
LoveBud control repo 접근
다른 모델 변경 파일 수정
```

---

## 6. 작업 브랜치 생성

처음 만든 `work/codex`, `work/gemini`, `work/windsurf1`, `work/windsurf2`는 에이전트별 슬롯 브랜치입니다.

실제 작업을 배정받으면 에이전트는 자기 전용 worktree에서 작업 성격에 맞는 새 브랜치명을 직접 정합니다. CTO가 브랜치명을 매번 지정할 필요는 없습니다.

필수 조건:

```text
최신 origin/main 기준으로 새 브랜치 생성
main에서 직접 작업 금지
기존 작업 브랜치 재사용 금지
branch name / base SHA / git status --short 결과를 시작 보고에 포함
```

예시:

```powershell
git fetch origin
git checkout -B refactor/search-orchestrator-modules origin/main
git status --short
git rev-parse HEAD
```

위 브랜치명은 예시입니다. 에이전트는 작업 성격에 맞게 `fix/*`, `refactor/*`, `docs/*`, `tests/*`, `chore/*`, `investigate/*` 중 적절한 prefix를 선택합니다.

---

## 7. 구현 에이전트 규칙

구현 에이전트는 지정된 worktree와 허용 파일 범위 안에서만 수정합니다.

작업 시작 필수 명령:

```powershell
git status --short
git branch --show-current
git rev-parse --short HEAD
git fetch origin
git checkout -B <agent-chosen-task-branch> origin/main
git status --short
git rev-parse HEAD
```

즉시 중단 조건:

```text
예상하지 못한 수정 파일이 있음
현재 경로가 지정 worktree가 아님
금지 파일이 이미 수정되어 있음
민감값이 노출될 위험이 있음
origin/main 기준 새 작업 브랜치가 아님
```

---

## 8. 검증 에이전트 규칙

검증 에이전트는 구현 에이전트보다 더 엄격합니다. 기본값은 읽기 전용입니다.

금지:

```text
코드 수정
파일 삭제
커밋
push
PR 생성/수정
merge
의존성 설치
lockfile 변경
민감값 출력
```

허용:

```text
git fetch
검증 대상 PR branch checkout
git status
git diff
git diff --name-only
git diff --stat
npm test
npm run lint
npm run build
npm run verify, 단 의존성이 이미 있을 때만
지정된 preview/production/browser smoke
민감값을 출력하지 않는 grep/rg scan
```

검증 결과 라벨:

```text
PASS
PARTIAL
FAIL
BLOCKED
DEPLOYMENT GATED
```

---

## 9. PR 흐름

구현 흐름:

```text
1. 전용 worktree 배정
2. 에이전트가 작업 성격에 맞는 새 브랜치 생성
3. branch name / base SHA / clean 상태 시작 보고
4. 로컬 수정
5. 로컬 검증
6. diff/stat/status 보고
7. CTO 승인 후 push
8. PR 생성
9. 검증 모델 검토
10. CTO merge 판단
```

통합은 GitHub PR로만 합니다.

잘못된 방식:

```text
LoveBud-wt-codex 파일을 LoveBud에 직접 복사
```

올바른 방식:

```text
LoveBud-wt-codex → branch push → PR → main merge
```

---

## 10. Merge 순서

병렬 개발은 허용하지만 merge는 순차로 진행합니다.

한 PR이 merge된 후 다른 작업 브랜치는 최신 main을 반영해야 합니다.

```powershell
git fetch origin
git rebase origin/main
```

또는 GitHub에서 branch update 후 검증을 다시 실행합니다.

권장 merge 원칙:

```text
작고 위험 낮은 PR 먼저
runtime-sensitive PR은 rebase 후 merge
Search/Auth/API PR은 더 엄격하게 검증
Netlify actual deletion은 readiness check 후 별도 승인 PR에서만 수행
```

---

## 11. Control repo clean 정책

PR merge 후 control repo를 최신 main으로 맞춥니다.

```powershell
cd G:\Ddrive\BatangD\task\workdiary\LoveBud
git fetch origin
git checkout main
git reset --hard origin/main
git status --short
git clean -fdn
```

`git status --short`가 clean이어도 `git clean -fdn`에 untracked directory가 남아 있으면 control repo를 완전 clean으로 보지 않습니다. cleanup 전에는 dry-run을 먼저 확인합니다.

주의:

```text
LoveBud_DO_NOT_DELETE_Git_Metadata 삭제 금지
.git / .git/worktrees 삭제 금지
기존 worktree 폴더 삭제 금지
로컬 민감 파일 내용 출력 금지
```

---

## 12. 민감값 취급

로컬 전용 secret, env, token, cookie, session, password, DB URL, API key 등은 절대 출력하지 않습니다.

허용 보고:

```text
secret-like file exists: yes/no
env key referenced: yes/no
value printed: false
```

민감값이 한 번이라도 노출되면 해당 보고서는 무효이며 rotation이 필요합니다.

---

## 13. Fixed test slot 정책

Cloudflare fixed test slot은 PR 단위로 배정합니다.

```text
test1
test2
test3
test4
test5
```

명시 배정 없이 fixed test slot에 배포하지 않습니다. 한 slot은 검증 완료 전까지 하나의 PR에만 사용합니다.

---

## 14. 범위 혼합 금지

명시 승인 없이 서로 다른 성격의 작업을 섞지 않습니다.

금지 예시:

```text
Search refactor와 Auth 변경 혼합
Detail refactor와 Netlify 삭제 혼합
CSS polish와 backend/API 변경 혼합
문서 정리와 runtime code 변경 혼합
Netlify blocker 제거 PR에서 netlify.toml 또는 netlify/** 삭제
```

---

## 15. 보고 형식

구현 보고에는 아래를 포함합니다.

```text
assigned worktree path
agent-chosen branch
base SHA
changed files
added files
deleted files
forbidden files touched: yes/no
PR #7/prototype touched: yes/no
tests run
tests failed/skipped
browser smoke status
secrets printed: true/false
final judgment: PASS / PARTIAL / FAIL
PR link
```

검증 보고에는 아래를 포함합니다.

```text
target PR
target head SHA
expected head SHA matched: yes/no
changed files
scope result
test result
grep/security result
browser smoke result if applicable
secrets printed: false
final judgment: PASS / PARTIAL / FAIL / BLOCKED
```

---

## 16. 에이전트 프롬프트 헤더

모든 로컬/웹 에이전트 작업 지시 앞에는 아래 요약을 붙입니다.

```text
지정된 worktree/path만 사용하십시오.
LoveBud control repo에 접근하지 마십시오.
다른 에이전트 worktree에 접근하지 마십시오.
main을 직접 수정하거나 push하지 마십시오.
최신 origin/main 기준으로 작업 성격에 맞는 새 브랜치를 직접 만드십시오.
branch name / base SHA / clean 상태를 시작 보고에 포함하십시오.
CTO 승인 전 push/PR 생성 금지.
merge 금지.
민감값 출력 금지.
예상하지 못한 파일이 수정되어 있으면 즉시 중단하십시오.
```

---

## 17. 한 줄 요약

```text
작업 1개 = 브랜치 1개 = worktree 1개 = PR 1개
검증 1개 = 검증 worktree 1개 또는 읽기 전용 PR 검토 1개
작업 브랜치명 = 에이전트가 작업 성격에 맞게 직접 생성
main 통합 = GitHub PR only
LoveBud control repo = clean main baseline only
```
