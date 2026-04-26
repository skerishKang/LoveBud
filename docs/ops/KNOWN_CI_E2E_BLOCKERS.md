# Known CI / E2E Blockers

이 문서는 LoveBud PR 검수 과정에서 과거 반복 관찰된 CI/E2E 실패를 원인 분리하기 위한 운영 문서입니다.

중요: 이 문서는 실패 로그를 무시하자는 문서가 아닙니다. 목적은 **실패 원인이 해당 PR 변경 범위에서 발생한 신규 회귀인지, 과거에 반복 관찰된 환경/계약 blocker의 재발인지 분리**하는 것입니다.

---

## 1. Status after PR #111

PR #111 이후 stale contract tests와 i18n scan 범위 문제는 정리되었습니다.

현재 기준:

- `npm test`: expected green baseline
- `npm run verify`: expected green baseline
- `npm run ci`: expected green baseline
- 과거 `56/61` test baseline은 더 이상 현행 기준으로 사용하지 않습니다.
- 과거 `Cannot find module 'playwright'`는 Playwright dependency/setup 이슈 재발 여부를 분리하기 위한 historical triage note로만 취급합니다.

따라서 아래 항목들은 **currently expected failures**가 아니라, 재발 시 원인을 분리하기 위한 **historical recurrence triage notes**입니다.

---

## 2. Historical recurrence triage notes

### 2.1 CI `verify-static` / `Smoke test` failure

과거 반복 관찰 항목:

```text
CI: failure
job: verify-static
step: Smoke test
```

재발 시 판단:

- 모든 PR의 자동 blocker로 단정하지 않습니다.
- PR이 Search, browse, static smoke 대상, selector, route mock, test script, package dependency를 변경한 경우에는 별도 원인 분석이 필요합니다.
- PR 변경 파일과 직접 관련이 없고 현재 green baseline에서 갑자기 재발했다면, 먼저 CI 로그와 최근 main 상태를 확인합니다.

### 2.2 CI E2E Smoke / `e2e-smoke` failure

과거 반복 관찰 항목:

```text
CI E2E Smoke: failure
job: e2e-smoke
step: Run E2E smoke subset
```

재발 시 판단:

- PR 변경 범위와 직접 관련이 있는지 매번 확인합니다.
- UI/layout/docs-only PR에서 유사 실패가 재발한 경우에도, preview/test URL 실측 결과와 changed files를 함께 봅니다.
- 현재 baseline이 green인 상태에서는 같은 이름의 실패라도 자동으로 historical blocker로 면제하지 않습니다.

### 2.3 Playwright dependency/setup failure

과거 반복 관찰 항목:

```text
Cannot find module 'playwright'
```

재발 시 판단:

- 일반적으로 CI dependency/setup 문제일 수 있습니다.
- docs-only, css-only, layout-only PR에서 `package.json`, lockfile, workflow, E2E script를 변경하지 않았다면 해당 PR의 신규 회귀인지 먼저 분리합니다.
- 단, `package.json`, lockfile, workflow, Playwright 설정, E2E script를 변경한 PR에서는 해당 PR이 원인일 수 있으므로 exception 판단을 하지 않습니다.

---

## 3. These failures are not automatic blockers or automatic exemptions

위 실패가 관찰되었다고 해서 모든 PR을 자동 blocker 처리하지 않습니다.

반대로, 과거 관찰 이력이 있다는 이유만으로 자동 면제하지도 않습니다.

반드시 다음 두 가지를 구분합니다.

1. **Historical blocker recurrence**
   - 과거와 같은 유형의 실패
   - PR 변경 파일과 직접 관련 없음
   - preview/test URL 또는 관련 수동 검증에서 회귀 없음
   - 현재 main baseline과 CI 로그를 확인한 뒤 recurrence로 분류

2. **PR-caused failure**
   - PR이 실패 job과 관련된 파일을 직접 변경
   - 실패 로그가 PR diff의 selector, route, dependency, script, runtime 변경과 연결됨
   - preview/test URL에서 실제 회귀 재현

Known blocker라는 판단은 자동 면제가 아니라 원인 분리 결과입니다.

---

## 4. Required checks before exception merge

CI/E2E failure가 남아 있는 상태에서 docs-only, css-only, UI layout PR의 exception merge를 검토하려면 아래를 모두 확인합니다.

### 4.1 Changed files

확인할 것:

- 변경 파일 전체 목록
- 허용 범위 밖 파일 포함 여부
- `package.json` / lockfile / workflow / script 변경 여부
- runtime/API/backend 변경 여부

BLOCKER 후보:

```text
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
.github/workflows/*
scripts/*
js/*
functions/*
modal_compute/*
```

### 4.2 Diff scope

확인할 것:

- docs-only인지
- css-only인지
- layout-only인지
- selector/test target과 직접 연결되는 변경인지
- route/API/runtime 변경이 있는지

### 4.3 CI failure relevance

확인할 것:

- 실패 job 이름
- 실패 step 이름
- 실패 로그의 직접 원인
- PR diff와 실패 로그 사이의 연결성
- 현재 main baseline에서 같은 실패가 재현되는지

### 4.4 Preview/test URL evidence

UI/layout/css PR은 CI만으로 예외 병합을 판단하지 않습니다.

필요한 확인:

- Cloudflare PR Preview URL 또는 지정 test slot URL
- 관련 viewport 확인
- horizontal overflow 여부
- console error 여부
- API/runtime 의존 페이지의 실제 data load 여부

Browse/Search/Editor/Auth/API 의존 화면은 로컬 정적 서버 단독 결과로 최종 PASS/BLOCKER를 판단하지 않습니다.

### 4.5 Runtime/API change 여부

다음 파일 또는 영역이 바뀐 PR은 exception 기준을 높입니다.

```text
functions/*
modal_compute/*
js/api/*
js/postgres-client.js
Firebase auth/session 관련 파일
Cloudflare Pages Functions route
```

runtime/API 변경이 있으면 docs-only/css-only/layout-only exception merge 기준을 적용하지 않습니다.

---

## 5. Docs-only PR exception criteria

Docs-only PR에서 historical CI/E2E blocker가 재발할 때 exception merge 검토가 가능합니다.

필수 조건:

- changed files가 문서 파일뿐
- code/UI/runtime/package/workflow/script 파일 변경 없음
- diff가 문서 내용 변경으로 제한됨
- 실패 원인이 과거 CI/Search/E2E setup blocker와 동일하거나 관련 없음이 확인됨
- 문서 링크/상대경로/표현 수위 검토 완료
- CTO가 명시적으로 docs-only exception merge 승인

주의:

- docs-only라도 workflow, script, package, generated artifact, lockfile을 수정했다면 docs-only exception이 아닙니다.

---

## 6. CSS-only / UI layout PR exception criteria

CSS-only 또는 UI layout PR에서 historical CI/E2E blocker가 재발할 때 exception merge 검토가 가능합니다.

필수 조건:

- changed files가 승인된 CSS/HTML layout 파일에 한정
- JS/API/runtime/package/workflow/script 변경 없음
- diff scope가 width, spacing, typography, visual polish 등 승인 범위에 한정
- Preview/test URL에서 대상 화면 실측 PASS
- horizontal overflow 없음
- 관련 console error 없음
- runtime/API 의존 화면이면 data load가 정상임
- failure 로그가 PR diff와 직접 관련 없음
- CTO가 명시적으로 exception merge 승인

주의:

- Search selector, E2E script, route mock, API client, runtime path를 건드린 경우에는 layout exception 기준을 적용하지 않습니다.

---

## 7. UI runtime-dependent page rule

아래 화면은 preview/test URL 실측이 특히 중요합니다.

- Browse / Search
- Editor
- My Trees
- Auth-gated pages
- `/api/*`를 호출하는 화면
- Cloudflare Pages Functions에 의존하는 화면
- Modal upstream에 의존하는 화면
- Firebase auth/session에 의존하는 화면

이런 화면은 로컬 정적 서버만으로 final PASS를 선언하지 않습니다.

---

## 8. Reporting template

CI/E2E failure가 있는 PR을 보고할 때는 아래 형식을 사용합니다.

```text
- CI:
  - status:
  - failed job:
  - failed step:
  - log summary:

- CI E2E Smoke:
  - status:
  - failed job:
  - failed step:
  - log summary:

- Changed files:
- Diff scope:
- Runtime/API/package/workflow/script changes: yes/no
- Current main baseline: green/failing/not checked
- Preview/test URL evidence:
- Failure related to this PR: yes/no/inconclusive
- Exception merge request possible: yes/no
```

---

## 9. One-line rule

```text
Known CI/E2E blocker documentation is for recurrence triage and cause separation, not for ignoring failures.
```
