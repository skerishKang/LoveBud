# Branch Cleanup Plan After PR #58

이 문서는 LoveBud의 PR #49~#58 병합 이후 남은 branch 정리 후보와 보존 후보를 분류합니다.

중요: 이 문서는 cleanup plan입니다. 실제 branch 삭제, PR close, force push, merge를 수행하지 않습니다. 실제 삭제는 CTO의 명시 승인 이후 별도 작업으로만 진행합니다.

---

## 1. 기준

작성 기준 시점:

- PR #58 merge 이후
- `main` HEAD 기준: `7e221b8829500c26a7542481bea1585d916fb14a`

확인 범위:

- PR #49 ~ PR #58 상태와 head branch
- PR #7 prototype branch 보존 상태
- `test1`, `slot/test1`, `main` 보존 branch 상태

---

## 2. 완료 PR branch cleanup 후보

아래 branch는 연결된 PR이 `closed / merged` 상태인 cleanup 후보입니다. 단, 이 문서 작성 단계에서는 삭제하지 않습니다.

| PR | Title | Head branch | PR 상태 | Branch 확인 결과 | Cleanup 분류 |
| --- | --- | --- | --- | --- | --- |
| #49 | `ui(layout): align landing browse rails` | `ui/layout-container-spacing-unification` | closed / merged | branch 존재 확인 | cleanup 후보 |
| #50 | `docs(project): clarify UI verification environment rules` | `docs/ui-verification-environment-rules` | closed / merged | branch 존재 확인 | cleanup 후보 |
| #51 | `ui(style): align typography accent hierarchy` | `ui/typography-accent-unification` | closed / merged | branch 존재 확인 | cleanup 후보 |
| #52 | `docs(ops): clarify test preview slot branch rules` | `docs/test-preview-slot-branch-rules` | closed / merged | branch 존재 확인 | cleanup 후보 |
| #53 | `chore: ignore local generated artifacts` | `chore/ignore-local-generated-artifacts` | closed / merged | branch 미검색 / 자동 삭제 또는 이미 삭제된 상태로 기록 | cleanup 불필요 가능 |
| #54 | `docs(project): update task status after PR49 and PR50` | `docs/update-task-status-after-pr49-pr50` | closed / merged | branch 존재 확인 | cleanup 후보 |
| #55 | `docs(design): preserve prototype reference folders` | `docs/prototype-reference-preservation-policy` | closed / merged | branch 존재 확인 | cleanup 후보 |
| #56 | `docs(ops): document known CI and E2E blockers` | `docs/known-ci-e2e-blockers` | closed / merged | branch 존재 확인 | cleanup 후보 |
| #57 | `docs(design): add UI polish roadmap after PR51` | `docs/ui-polish-roadmap-after-pr51` | closed / merged | branch 존재 확인 | cleanup 후보 |
| #58 | `docs(project): add verification warning catalog` | `docs/verification-warning-catalog` | closed / merged | branch 존재 확인 | cleanup 후보 |

### PR #53 note

PR #53의 head branch `chore/ignore-local-generated-artifacts`는 branch search에서 확인되지 않았습니다. 따라서 자동 삭제되었거나 이미 삭제된 상태로 기록합니다. 삭제 작업은 수행하지 않았습니다.

---

## 3. 보존 branch

아래 branch는 cleanup 대상이 아닙니다. 임의 삭제, force push, PR close를 금지합니다.

| Branch | 상태 / 용도 | 보존 사유 | 처리 |
| --- | --- | --- | --- |
| `experiment/gpt-svg-tree-prototype` | PR #7 head branch / open / draft | CTO-directed prototype. `pages/gpt-svg-tree/` reference prototype 보존 대상 | close 금지, branch 삭제 금지 |
| `test1` | Cloudflare test preview branch | `test1.lovebud.pages.dev` 기본 업데이트 대상 | 삭제 금지 |
| `slot/test1` | test slot 관련 branch | 기본 업데이트 대상은 아니지만 현재 존재 확인됨. 별도 판단 전 임의 삭제 금지 | 삭제 금지 |
| `main` | default branch | production 기준 branch | 삭제 금지, force 금지, 직접 push 금지 |

추가 확인:

- `archive/test1-pr36-contaminated-20260425`도 `test1` 검색 결과에 나타났습니다. 이 문서의 필수 보존 목록은 아니지만, archive 성격 branch이므로 별도 CTO 판단 없이 임의 삭제하지 않습니다.

---

## 4. 삭제 전 조건

branch 삭제 전 반드시 아래 조건을 모두 확인합니다.

1. 연결된 PR이 `merged / closed` 상태인지 확인합니다.
2. 해당 branch가 다른 open PR의 head branch가 아닌지 확인합니다.
3. 해당 branch가 test slot branch가 아닌지 확인합니다.
4. 해당 branch가 prototype/reference branch가 아닌지 확인합니다.
5. 해당 branch가 `main` 또는 운영 기준 branch가 아닌지 확인합니다.
6. GitHub branch search 또는 repository branch list 기준으로 현재 존재 여부를 재확인합니다.
7. CTO의 명시적인 branch 삭제 승인을 받습니다.
8. 삭제 대상 branch 목록을 삭제 직전 보고에 다시 적습니다.

---

## 5. 금지 사항

아래 행위는 이 cleanup plan 작성 범위에서 금지됩니다.

- 실제 branch 삭제 금지
- PR close 금지
- PR #7 close 금지
- PR #7 branch 삭제 금지
- `test1` 삭제 금지
- `slot/test1` 임의 삭제 금지
- `main` 삭제 또는 force push 금지
- force push 금지
- 코드, CSS, HTML, JS 수정 금지
- runtime/API/CI workflow/package/lockfile 수정 금지
- cleanup 후보 branch에 추가 commit 금지

---

## 6. 권장 cleanup 실행 순서

실제 cleanup 승인 후에는 아래 순서로 진행합니다.

1. 최신 `main` 상태 확인
2. cleanup 후보 branch가 여전히 존재하는지 재확인
3. 각 branch가 open PR head가 아닌지 재확인
4. 보존 branch 목록과 교차 확인
5. CTO 승인 목록과 1:1 대조
6. 승인된 branch만 삭제
7. 삭제 결과를 branch별로 보고

권장 보고 형식:

```text
Branch cleanup result:
- deleted:
  - ...
- preserved:
  - ...
- skipped:
  - branch: ...
    reason: ...
```

---

## 7. 현재 결론

현재 cleanup 후보:

- `ui/layout-container-spacing-unification`
- `docs/ui-verification-environment-rules`
- `ui/typography-accent-unification`
- `docs/test-preview-slot-branch-rules`
- `docs/update-task-status-after-pr49-pr50`
- `docs/prototype-reference-preservation-policy`
- `docs/known-ci-e2e-blockers`
- `docs/ui-polish-roadmap-after-pr51`
- `docs/verification-warning-catalog`

현재 cleanup 불필요 가능:

- `chore/ignore-local-generated-artifacts` — branch 미검색 / 자동 삭제 또는 이미 삭제된 상태로 기록

현재 보존:

- `experiment/gpt-svg-tree-prototype`
- `test1`
- `slot/test1`
- `main`
- `archive/test1-pr36-contaminated-20260425` — archive branch로 별도 판단 전 임의 삭제 금지

실제 삭제 수행 여부:

- 수행하지 않음
