# Local Auto Browser Verification Runbook

## Purpose

이 문서는 새 로컬 세션 또는 새 브라우저 검증 에이전트가 긴 대화 맥락 없이도  
**PR별 Browser verification entrypoint comment**와 **AGENTS.md**만 보고  
자동 브라우저 검증을 수행하기 위한 절차 런북입니다.

---

## 1. Required Inputs

PR별 Browser verification entrypoint comment에 반드시 포함되어야 하는 항목:

| 항목 | 설명 |
|------|------|
| `PR number` | 검증 대상 PR 번호 |
| `branch` | PR 브랜치 이름 |
| `assigned URL` | 브라우저 검증에 사용할 고정 URL |
| `URL provenance` | 해당 URL이 어떤 슬롯/SHA 기준으로 할당되었는지 |
| `target pages` | 검증 대상 페이지 경로 목록 |
| `credential source state` | 자격증명 출처 상태 (예: `pre-existing local .local/test-accounts.json`) |
| `account type` | 필요한 계정 유형 (예: `Internal QA User`) |
| `account selection rule` | 계정 선택 규칙 (예: `first active matching account type`) |
| `ready/merge authority` | ready 전환 또는 merge 권한 명시 |

---

## 2. Required Local Prerequisites

자동 브라우저 검증 시작 전 확인 항목:

- [ ] repository available (로컬 또는 GitHub 접근 가능)
- [ ] GitHub access available (PR comment 읽기 가능)
- [ ] browser automation available (자동화 도구 실행 가능)
- [ ] assigned URL reachable (네트워크 접근 가능)
- [ ] credential source state가 `.local/test-accounts.json`을 요구하는 경우에만 해당 파일 존재 확인
- [ ] credential 파일이 git untracked 상태임을 확인
- [ ] credential 값을 보고/출력하지 않음

---

## 3. Starting Order

새 세션 시작 시 아래 순서로 문서를 먼저 읽습니다:

1. `AGENTS.md` — 최우선 행동 기준
2. `docs/ops/AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md` — 공통 entrypoint 및 Auth auto-login 절차
3. 대상 PR body — 변경 범위 및 검증 요건
4. PR별 Browser verification entrypoint comment — 이번 세션에 적용할 구체적 입력값
5. 이 런북(`LOCAL_AUTO_BROWSER_VERIFICATION_RUNBOOK.md`) — 절차 전체
6. `QA_CREDENTIALS.md` (또는 `QA_CREDENTIALS.txt`) — credential source state가 요구하는 경우에만

---

## 4. PR-Specific Comment Validation

PR별 Browser verification entrypoint comment가 있는지 먼저 확인합니다.

| 조건 | 결과 |
|------|------|
| comment 자체가 없음 | **BLOCKED** — comment 없이 검증 진행 불가 |
| `assigned URL` 누락 | **BLOCKED** — URL 없이 검증 진행 불가 |
| Auth-gated 페이지인데 `account type`/`account selection rule` 누락 | **BLOCKED** — 계정 정보 없이 로그인 불가 |
| `ready/merge authority` 누락 | ready/merge 금지 — 인수 없이 추론하지 않음 |

---

## 5. Fixed Test Slot SHA/Provenance Check

assigned URL이 `https://testN.lovebud.pages.dev` 형태인 경우:

1. Cloudflare Pages 또는 GitHub에서 `testN` 브랜치의 현재 배포 SHA를 확인합니다.
2. 해당 SHA와 PR head SHA를 비교합니다.
3. 판정:

| 조건 | 결과 |
|------|------|
| SHA 일치 | 검증 진행 가능 |
| SHA 불일치 + task가 slot 업데이트를 명시적으로 허가 | slot 업데이트 후 진행 |
| SHA 불일치 + 업데이트 권한 없음 | **BLOCKED** — CTO에 보고 |

4. 최종 PASS 판정 전에 해당 SHA에 대한 Cloudflare 배포 성공 여부를 확인합니다.

---

## 6. Fixed Test Slot Allocation Policy

고정 test slot은 공유 리소스입니다. 단일 slot을 기본값처럼 hard-code하지 않습니다.

1. CTO가 명시적으로 `test6`를 지정한 경우를 제외하고 `test6`를 hard-code하지 않습니다.
2. `test1`부터 `test10`까지를 shared fixed slot pool로 취급합니다.
3. slot을 배정하기 전에 현재 slot occupancy를 확인합니다.
4. `test1` → `test10` 순서로 확인하고, active assignment가 없는 첫 번째 free slot을 우선합니다.
5. 하나의 slot은 동시에 하나의 PR에만 배정할 수 있습니다.
6. active assignment가 있는 slot은 건너뜁니다.
7. stale로 보이는 slot도 CTO 승인 없이 overwrite하지 않습니다.
8. active slot을 덮어쓰려면 명시적인 CTO 승인과 대상 slot 이름이 필요합니다.
9. 빈 slot이 없으면 occupied slot list를 보고하고 **BLOCKED**로 중단합니다.
10. 검증 완료 후에는 release recommendation을 보고합니다.

### Slot Occupancy Check

slot 배정 전 확인 순서:

1. `test1` through `test10` branch 또는 deployment 상태를 확인합니다.
2. 각 slot의 branch SHA와 배정 대상 PR head SHA를 비교합니다.
3. PR Conversation의 `Browser verification entrypoint` comment 또는 CTO assignment comment에서 active assignment가 있는지 확인합니다.
4. active assignment가 있으면 해당 slot을 skip합니다.
5. assignment가 없고 overwrite가 필요 없는 slot을 free slot 후보로 봅니다.
6. free slot이 확인되면 해당 slot을 assigned URL로 사용합니다.

### PR Comment Assignment Record

빈 slot을 찾으면 PR `Browser verification entrypoint` comment에 최소한 아래 값을 기록합니다:

- assigned slot
- assigned URL
- PR number
- PR branch
- PR head SHA
- credential source state
- account type
- account selection rule
- release condition

예시 구조:

```text
Assigned slot: testN
Assigned URL: https://testN.lovebud.pages.dev
PR: #<number>
Branch: <branch>
Head SHA: <sha>
Credential source state: <not needed | pre-existing local .local/test-accounts.json | restored from handoff/bundle>
Account type: <Internal QA User | Internal QA Admin | not needed>
Account selection rule: <first active matching account type | specific local slot label | not needed>
Release condition: releasable after verification report is accepted or CTO releases the slot
```

값은 운영 metadata만 기록합니다. credential, token, cookie, session 값은 기록하지 않습니다.

### Release Recommendation

검증 완료 보고에는 다음을 포함합니다:

- slot name
- URL
- verified PR number
- verified PR head SHA
- final status
- slot release recommendation: `release recommended` / `keep reserved` / `blocked, do not release`

slot release는 권고만 보고합니다. CTO 승인 없이 active slot branch를 덮어쓰거나 삭제하지 않습니다.

### Final PASS Environment Rule

Auth/API/data-loaded page의 final PASS는 local static server만으로 인정하지 않습니다.

- final PASS는 assigned Cloudflare PR Preview 또는 fixed test slot에서 수행합니다.
- local static server는 partial smoke로만 보고합니다.
- assigned URL이 없거나 slot provenance가 불명확하면 **BLOCKED**입니다.

---

## 7. Credential Metadata and Schema

`.local/test-accounts.json` 파일의 schema shape은 아래 두 형태 중 하나일 수 있습니다 (값 없음, placeholder 예시만):

**형태 A — top-level array:**

```json
[
  {
    "label": "<계정 식별 레이블>",
    "type": "<계정 유형 (예: Internal QA User)>",
    "active": true,
    "email": "<이메일 placeholder>",
    "password": "<비밀번호 placeholder>"
  }
]
```

**형태 B — `{ "accounts": [...] }` wrapper:**

```json
{
  "accounts": [
    {
      "label": "<계정 식별 레이블>",
      "type": "<계정 유형 (예: Internal QA User)>",
      "active": true,
      "email": "<이메일 placeholder>",
      "password": "<비밀번호 placeholder>"
    }
  ]
}
```

> 실제 파일이 어느 형태인지는 로컬에서 직접 확인합니다.  
> 어느 형태든 계정 선택 규칙 적용 방식은 동일합니다.  
> 실제 값은 로컬 파일에서만 읽습니다. 이 문서에 기재하지 않습니다.

### Account Selection Rules

| 규칙 | 설명 |
|------|------|
| `first active matching account type` | `active: true`이고 `type`이 일치하는 첫 번째 계정 사용 |
| `specific local slot label` | `label`이 정확히 일치하는 계정 사용 |
| `not needed` | 로그인 불필요 |

매칭되는 계정이 없으면 → **BLOCKED** 보고.

---

## 8. Login Automation Procedure

1. assigned URL을 브라우저로 엽니다.
2. 로그인 페이지로 redirect되면 선택된 계정의 email/password를 입력합니다.
3. Selector 전략 (우선순위 순):

| 항목 | Selector |
|------|----------|
| email input | `input[type="email"]`, `[name="email"]`, `#email` |
| password input | `input[type="password"]`, `[name="password"]`, `#password` |
| submit | `button[type="submit"]`, `#loginButton`, `[data-testid="login-submit"]` |

4. submit 후 대상 페이지 접근 확인.
5. 실패 구분:

| 상황 | 판정 | 처리 |
|------|------|------|
| selector를 찾지 못함 (DOM에 없음) | **selector/tool issue** — app FAIL로 단정하지 않음 | manual fallback 시도 또는 BLOCKED 보고 |
| selector는 있으나 automation tool이 interact 실패 | **selector/tool issue** — app FAIL로 단정하지 않음 | manual fallback 시도 또는 BLOCKED 보고 |
| selector로 submit 완료 후 로그인 실패 (앱이 reject) | **app login FAIL** | FAIL/BLOCKED 보고, credential 값 노출 금지 |

> **manual fallback은 assigned URL에서만 가능합니다.**  
> production 도메인(`https://lovebud.pages.dev/`) 또는 다른 URL로 전환하지 않습니다.  
> assigned URL 외 URL에서 manual 시도는 검증 결과로 인정되지 않습니다.

---

## 9. Standard Verification Checklist

| 항목 | 확인 |
|------|------|
| assigned URL loads | ☐ |
| login succeeds (if required) | ☐ |
| target page loads | ☐ |
| loading/empty/content/error state renders correctly | ☐ |
| changed UI behavior works as expected | ☐ |
| no fatal console error | ☐ |
| no network/API blocker | ☐ |
| no horizontal overflow | ☐ |
| credential values not reported | ☐ |

---

## 10. Standard Report Format

```
Browser Verification Report
1. computer/model:
2. PR number:
3. branch:
4. PR head SHA:
5. assigned URL:
6. slot branch/SHA before:
7. slot branch/SHA after (if updated):
8. credential source state:
9. account type:
10. account selection rule:
11. automation / manual:
12. login result:
13. target page result:
14. UI state result:
15. console errors:
16. network/API blockers:
17. horizontal overflow:
18. credential values reported: NO
19. slot release recommendation:
20. final status: PASS / PARTIAL / BLOCKED / FAIL
```

---

## 11. BLOCKED / FAIL Escalation

| 상태 | 의미 | 행동 |
|------|------|------|
| `BLOCKED` | 필수 입력 누락, SHA 불일치, 계정 없음, selector 없음, free slot 없음 | 진행 중단, CTO에 보고, 파일 수정/ready/merge 금지 |
| `FAIL` | 검증 실패 (앱 로그인 실패, 페이지 오류, console fatal 등) | 진행 중단, CTO에 보고 |
| `PARTIAL` | 일부 항목만 확인됨 | 미확인 항목 명시, CTO에 보고 |
| `PASS` | 전 항목 통과, SHA/provenance 확인 완료 | 보고 후 대기, ready/merge는 CTO 지시에 따름 |

---

## 12. Minimal Prompt Template

새 세션 또는 새 브라우저 검증 에이전트에게 줄 수 있는 최소 프롬프트:

> "PR #\<number\>의 Browser verification entrypoint comment와 AGENTS.md 기준으로 assigned URL에서 자동 브라우저 검증을 수행하세요. 파일 수정, ready 전환, merge, issue close는 하지 마세요. Auth가 필요하면 로컬 `.local/test-accounts.json`에서 comment의 account type/account selection rule에 맞는 계정만 사용하세요. test1~test10 fixed slot pool에서 active assignment가 없는 첫 번째 slot을 찾아 assigned URL로 사용하세요. active slot은 CTO 승인 없이 덮어쓰지 마세요. 빈 slot이 없으면 occupied slot list를 보고하고 BLOCKED로 중단하세요. selector 실패는 즉시 app FAIL로 단정하지 말고 manual fallback을 assigned URL에서 시도하거나 BLOCKED로 보고하세요. 결과는 runbook report format으로 보고하세요."

---

## Related

- [`AGENTS.md`](../../AGENTS.md)
- [`docs/ops/AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md`](AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md)
- [`docs/ops/BROWSER_VERIFICATION_URL_POLICY.md`](BROWSER_VERIFICATION_URL_POLICY.md)
- [`docs/ops/TEST_PREVIEW_SLOTS.md`](TEST_PREVIEW_SLOTS.md)
- [`docs/ops/ops_index.md`](ops_index.md)
