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

## 6. Credential Metadata and Schema

`.local/test-accounts.json` 파일의 schema shape (값 없음, placeholder 예시만):

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

> 실제 값은 로컬 파일에서만 읽습니다. 이 문서에 기재하지 않습니다.

### Account Selection Rules

| 규칙 | 설명 |
|------|------|
| `first active matching account type` | `active: true`이고 `type`이 일치하는 첫 번째 계정 사용 |
| `specific local slot label` | `label`이 정확히 일치하는 계정 사용 |
| `not needed` | 로그인 불필요 |

매칭되는 계정이 없으면 → **BLOCKED** 보고.

---

## 7. Login Automation Procedure

1. assigned URL을 브라우저로 엽니다.
2. 로그인 페이지로 redirect되면 선택된 계정의 email/password를 입력합니다.
3. Selector 전략 (우선순위 순):

| 항목 | Selector |
|------|----------|
| email input | `input[type="email"]`, `[name="email"]`, `#email` |
| password input | `input[type="password"]`, `[name="password"]`, `#password` |
| submit | `button[type="submit"]`, `#loginButton`, `[data-testid="login-submit"]` |

4. submit 후 대상 페이지 접근 확인.
5. selector가 없거나 로그인 실패 시:
   - selector 없음 → **BLOCKED** 보고 또는 manual fallback
   - 로그인 실패 → **BLOCKED** 보고, credential 값 노출 금지

---

## 8. Standard Verification Checklist

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

## 9. Standard Report Format

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
19. final status: PASS / PARTIAL / BLOCKED / FAIL
```

---

## 10. BLOCKED / FAIL Escalation

| 상태 | 의미 | 행동 |
|------|------|------|
| `BLOCKED` | 필수 입력 누락, SHA 불일치, 계정 없음, selector 없음 | 진행 중단, CTO에 보고, 파일 수정/ready/merge 금지 |
| `FAIL` | 검증 실패 (로그인 실패, 페이지 오류, console fatal 등) | 진행 중단, CTO에 보고 |
| `PARTIAL` | 일부 항목만 확인됨 | 미확인 항목 명시, CTO에 보고 |
| `PASS` | 전 항목 통과, SHA/provenance 확인 완료 | 보고 후 대기, ready/merge는 CTO 지시에 따름 |

---

## 11. Minimal Prompt Template

새 세션 또는 새 브라우저 검증 에이전트에게 줄 수 있는 최소 프롬프트:

> "PR #\<number\>의 Browser verification entrypoint comment와 AGENTS.md 기준으로 assigned URL에서 자동 브라우저 검증을 수행하세요. 파일 수정, ready 전환, merge, issue close는 하지 마세요. Auth가 필요하면 로컬 `.local/test-accounts.json`에서 comment의 account type/account selection rule에 맞는 계정만 사용하세요. 결과는 runbook report format으로 보고하세요."

---

## Related

- [`AGENTS.md`](../../AGENTS.md)
- [`docs/ops/AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md`](AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md)
- [`docs/ops/BROWSER_VERIFICATION_URL_POLICY.md`](BROWSER_VERIFICATION_URL_POLICY.md)
- [`docs/ops/TEST_PREVIEW_SLOTS.md`](TEST_PREVIEW_SLOTS.md)
- [`docs/ops/ops_index.md`](ops_index.md)
