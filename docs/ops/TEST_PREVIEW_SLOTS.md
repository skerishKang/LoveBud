# Fixed Test Preview Slots

**Status:** Active  
**Owner:** CTO / Ops Lead  
**Last Updated:** 2026-04-26  
**Branch:** docs/test-preview-slot-branch-rules

---

## 1. 목적

PR별 Cloudflare Preview URL은 Firebase Auth domain, login redirect, runtime/API 검증 과정에서 반복적인 제한이 발생할 수 있습니다. Fixed Test Preview Slots는 검증이 필요한 브랜치에 대해 고정된 도메인을 미리 할당하여, 아래 검증을 안정적으로 수행하기 위한 운영 체계입니다.

- 로그인이 필요한 화면 검증: `editor/`, `my-trees/`, `settings/` 등 인증이 필요한 페이지
- API/backend/runtime 경로 확인: `/api/*`, `/runtime/*` 경로의 smoke test
- DB read 검증: 데이터 조회 동작 검증
- UI production-like preview: 실제 프로덕션과 유사한 환경에서의 UI/UX 검증
- PR별 Preview URL 대체: Auth/domain 문제로 PR Preview가 정상 동작하지 않을 때의 대체 검증 수단

---

## 2. Fixed Test Preview Slots

| Slot | Domain | Default use |
|------|--------|-------------|
| test1 | https://test1.lovebud.pages.dev | UI PR 검증 |
| test2 | https://test2.lovebud.pages.dev | runtime/backend route 검증 |
| test3 | https://test3.lovebud.pages.dev | policy/visibility 검증 |
| test4 | https://test4.lovebud.pages.dev | QA CRUD disposable data 검증 |
| test5 | https://test5.lovebud.pages.dev | 예비/대체 슬롯 |
| test6 | https://test6.lovebud.pages.dev | 임시/예외 검증 슬롯 |

각 slot domain은 Cloudflare Pages에 연결된 고정 도메인입니다. 실제 배정은 CTO 또는 담당 Lead가 작업 지시에 명시합니다.

---

## 3. test1 branch source of truth

### 3.1 test1 기본 운영 branch

`https://test1.lovebud.pages.dev`는 기본적으로 GitHub remote branch `origin/test1`을 기준으로 운영합니다.

PR preview/test 검증에서 test1 slot을 갱신해야 할 때의 기본 업데이트 대상은 아래입니다.

```text
origin/test1
```

### 3.2 `origin/slot/test1` 사용 금지 원칙

`origin/slot/test1`은 혼선을 줄이기 위해 기본 업데이트 대상이 아닙니다.

특별한 CTO 지시 없이 아래 branch를 갱신하지 않습니다.

```text
origin/slot/test1
```

PR 검증 보고서나 실행 지시에서 `test1`이 언급되면, 별도 지시가 없는 한 `origin/test1`을 의미합니다.

### 3.3 혼선 방지 규칙

- `test1.lovebud.pages.dev` 검증 지시에는 반드시 대상 branch를 적습니다.
- 기본값은 `origin/test1`입니다.
- `origin/slot/test1`을 사용해야 하는 예외 상황은 CTO가 명시해야 합니다.
- PR #49 검증 때 발생한 `origin/test1` / `origin/slot/test1` 혼용을 반복하지 않습니다.

---

## 4. PR preview/test slot 검증 절차

test1 slot을 PR branch 검증에 사용할 때는 아래 순서를 따릅니다.

1. PR 번호와 PR head branch를 확인합니다.
2. PR head SHA를 확인하고 보고에 기록합니다.
3. `origin/test1`을 PR head SHA로 업데이트합니다.
4. Cloudflare Pages deploy 완료를 기다립니다.
5. `https://test1.lovebud.pages.dev`에서 deploy token/source 또는 화면 반영을 확인합니다.
6. 필요한 viewport를 확인합니다. 기본 UI 검증은 1440px / 1024px / 375px을 우선합니다.
7. Network/Console을 확인합니다.
8. 검증 결과와 미검증 항목을 분리해 보고합니다.
9. production 검증이 필요한 경우, PR이 `main`에 merge되고 production deploy가 끝난 뒤 별도로 수행합니다.

### 4.1 권장 실행 흐름

아래 흐름은 Local Slot Ops 또는 지정된 실행자가 수행합니다.

```bash
git fetch origin
git rev-parse origin/main
git rev-parse origin/<pr-head-branch>
git rev-parse origin/test1

# CTO가 승인한 PR head SHA로 test1을 맞춘다.
git checkout test1
git reset --hard <pr-head-sha>
git push --force-with-lease origin test1
```

`<pr-head-sha>`는 반드시 PR metadata에서 확인한 값이어야 합니다. 추정하거나 로컬 branch 이름만 믿지 않습니다.

---

## Role split: Browser / Web / Local

Fixed slot 검증은 역할별 권한과 금지선을 분리합니다.

### Browser verifier

Browser verifier는 실제 브라우저, DevTools, MCP, Playwright 등으로 화면과 런타임 상태를 확인합니다.

허용 범위:
- slot URL 접근 확인
- login gate / actual page 내부 접근 여부 확인
- viewport 확인: 기본 1440px / 1024px / 375px
- console / network 확인
- screenshot 또는 짧은 관찰 로그 작성
- UI 상태, horizontal overflow, runtime warning/blocker 분류

금지 범위:
- 코드 수정 금지
- PR 수정 / merge / close 금지
- Issue 수정 금지
- branch update / reset / push 금지
- 운영 데이터 create / edit / delete 금지
- memory 생성/수정/삭제 금지
- tree title / visibility 변경 금지
- token/password/cookie 원문 기록 금지

### Web verifier / GitHub executor

Web verifier는 GitHub PR, Issue, docs metadata를 확인합니다. 브라우저 실측을 수행하지 않는 경우 그 한계를 보고에 명시합니다.

허용 범위:
- PR 상태, draft 여부, head SHA, changed files 확인
- PR body의 issue hygiene 확인
- Issue open/closed 상태 확인
- docs-only 또는 scope guard 검증
- Cloudflare/Preview URL 존재 여부 확인

금지 범위:
- 별도 지시 없는 코드/문서 수정 금지
- 별도 지시 없는 PR close / merge 금지
- 별도 지시 없는 Issue update 금지
- branch reset / force push 금지
- browser-only 검증을 수행한 것처럼 보고 금지

### Local / Ops slot executor

Local/Ops는 clean clone 또는 clean worktree에서 slot branch를 target SHA로 맞춥니다.

허용 범위:
- `origin/test1` 현재 SHA 확인
- PR head SHA 확인
- CTO가 지정한 target SHA로 `origin/test1` 업데이트
- `git push --force-with-lease origin test1` 사용
- Cloudflare deploy 상태 확인

금지 범위:
- PR branch 수정 금지
- main 수정 / push / force push 금지
- `--force` 단독 사용 금지
- target SHA 추정 금지
- slot branch를 임의로 main 또는 다른 PR로 reset 금지

---

## PR Preview vs fixed slot decision rules

### PR Preview를 우선 사용할 수 있는 경우

- public page 변경이며 로그인 또는 Firebase Auth domain 영향을 받지 않는 경우
- 정적 UI 변경이 대부분이고 actual account state가 필요 없는 경우
- Cloudflare PR Preview URL이 정상 생성되고 target SHA 반영이 확인되는 경우

### fixed slot을 우선 사용하거나 CTO 지정 slot을 따르는 경우

- `editor`, `my-trees`, `settings`처럼 로그인 필요 화면을 검증하는 경우
- Firebase Auth domain, login redirect, popup/redirect origin 이슈가 예상되는 경우
- PR Preview가 auth domain mismatch 또는 redirect loop로 actual page 내부 검증에 실패하는 경우
- CTO가 test1/test2/test3 등 고정 slot을 명시한 경우

### fallback 판정

- PR Preview가 auth/domain 문제로 실패하면 fixed slot으로 전환합니다.
- fixed slot도 실패하면 code failure로 단정하지 않고 infra/DNS/Auth blocker로 분리합니다.
- fixed slot이 접근 가능하지만 target SHA 반영이 불명확하면 PARTIAL로 보고합니다.
- PR Preview와 fixed slot 결과가 다르면 URL, target SHA, deploy status를 함께 기록합니다.

---

## Slot access failure and partial verification

검증 판정은 확인 가능한 증거 기준으로만 작성합니다.

| 상황 | 판정 | 보고 기준 |
|------|------|-----------|
| test slot URL 접근 불가 / DNS 실패 | BLOCKED | code/UI 결과가 아니라 slot infra/DNS blocker로 분리 |
| slot URL은 접근되지만 target SHA 반영 불명확 | PARTIAL | URL, 확인한 asset/source/network 근거, 미확인 항목 기록 |
| login gate까지만 확인되고 actual page 내부 미확인 | PARTIAL | auth gate 확인과 actual UI 미검증을 분리 |
| actual page 내부 접근 가능하나 test account/test tree 여부 불명확 | PARTIAL + no mutation | 데이터 변경 없이 시각 상태만 기록 |
| viewport / console / network 모두 확인 | PASS 후보 | blocker/warning 구분 후 merge 가능 여부 별도 판단 |
| 신규 console exception 또는 API 5xx가 PR 변경과 관련됨 | 수정 요청 또는 BLOCKED | endpoint/status/screenshot/viewport 근거 포함 |

주의:
- `BLOCKED`는 PR 코드가 틀렸다는 뜻이 아닐 수 있습니다.
- `PARTIAL`은 확인된 항목과 미확인 항목을 모두 적어야 합니다.
- Browser verifier가 slot에 접근할 수 없으면 Web verifier의 GitHub metadata 확인만으로 UI PASS를 선언하지 않습니다.

---

## Slot release / restore procedure

검증 후 slot branch 처리도 별도 운영 대상입니다.

1. 검증 보고서에 slot URL, target branch, target SHA, slot branch SHA, Cloudflare deploy status를 기록합니다.
2. 검증이 끝난 뒤 slot을 main으로 돌릴지, 현재 PR SHA로 유지할지 CTO에게 확인합니다.
3. 다음 사용자에게 넘기기 전 아래를 기록합니다.
   - 현재 slot URL
   - 현재 slot branch
   - 현재 slot branch SHA
   - Cloudflare deploy status
   - 점유 중인 PR/작업명
4. 검증 실패 시 원인을 분리합니다.
   - code/UI failure
   - slot infra/DNS failure
   - Cloudflare deploy failure
   - Firebase/Auth/domain failure
   - test account/data availability failure
5. 임의로 slot branch를 reset하지 않습니다.
6. slot branch restore도 `--force-with-lease` 조건을 만족할 때만 수행합니다.

---

## Evidence hygiene: screenshots, console, network logs

검증 증거는 필요한 최소 정보만 기록합니다.

- token/password/cookie 원문 기록 금지
- screenshot에 계정명, email, token, private content, 운영 데이터가 보이면 redaction 후 공유
- console log 공유 시 auth token, Firebase credential, cookie 값 제거
- network/HAR 공유 시 request/response headers의 `Authorization`, `Cookie`, session token, API key 원문 제거
- test account 식별자는 필요한 최소 수준으로만 기록
- 운영 데이터의 tree title, private note, memory content는 원문을 장문 인용하지 않음
- mutation이 없었으면 `NO MUTATIONS`를 명시
- mutation이 필요한 검증은 test4 + disposable data + 별도 승인 기준을 사용

---

## 5. force-with-lease 사용 조건

test slot branch는 검증 대상 PR branch를 고정 도메인에 임시 배포하기 위해 강제로 이동할 수 있습니다. 다만 force update는 아래 조건을 모두 만족할 때만 허용합니다.

- CTO 또는 담당 Lead가 해당 slot 사용을 승인했습니다.
- 대상 slot이 명시되었습니다.
- 대상 remote branch가 명시되었습니다. test1 기본값은 `origin/test1`입니다.
- PR head SHA를 확인했습니다.
- 현재 slot 점유자가 없거나, 점유 해제가 확인되었습니다.
- `git push --force-with-lease`를 사용합니다.
- `--force` 단독 사용은 금지합니다.

예외 없이 `main`에는 force push하지 않습니다.

---

## 6. 브랜치 운영 금지선

### 6.1 main 직접 push 금지

`main`은 PR merge 경로로만 변경합니다.

- main 직접 commit 금지
- main 직접 push 금지
- main force push 금지
- screenshot-only 변경도 main 직접 push 금지

### 6.2 PR branch 수정 금지

test slot 검증을 위해 PR branch 자체를 수정하지 않습니다.

- PR head branch에 추가 commit 금지
- PR head branch force push 금지
- PR branch rebase 금지
- PR branch를 test slot 정리 목적으로 변경 금지

검증 slot은 PR branch를 바꾸는 도구가 아닙니다. PR branch의 특정 head SHA를 `origin/test1` 같은 slot branch에 반영하는 도구입니다.

### 6.3 production 검증 분리

Test slot 검증은 PR merge 전 검증입니다. Production 검증은 PR이 `main`에 merge되고 `https://lovebud.pages.dev/`에 배포된 뒤 별도로 수행합니다.

PR merge 전에는 production 도메인을 해당 PR branch의 source of truth로 사용하지 않습니다.

---

## 7. 사용 범위

다음 검증 작업에 Fixed Test Preview Slots를 사용합니다.

### 7.1 로그인 필요 화면

- `editor/` 편집기 페이지 인증 흐름
- `my-trees/` 내 트리 페이지
- `settings/` 설정 페이지

### 7.2 API/backend/runtime

- `/api/*` 엔드포인트 smoke test
- `/runtime/*` 경로 동작 확인
- Cloudflare Pages Functions → Modal 연동 간접 검증

### 7.3 DB read 검증

- 트리 목록 조회
- 트리 상세 조회
- 공개 범위에 따른 표시 필터링

### 7.4 UI 반응형 검증

- Desktop / Tablet / Mobile breakpoint
- Browser DevTools 기반 viewport/network 확인

### 7.5 대체 검증

- PR별 Cloudflare Preview URL이 Firebase Auth domain 문제로 정상 동작하지 않을 때
- login redirect loop 또는 domain mismatch 오류가 발생할 때

---

## 8. 사용 금지 / 제한

### 8.1 절대 금지

- production write 동작: save/edit/delete/PUT/PATCH/DELETE는 별도 승인 전 금지
- 기존 사용자 데이터 수정/삭제 금지
- token/password/cookie 원문 기록 금지
- main 직접 수정 금지
- main 직접 push 금지
- `--force` 단독 push 금지
- 임의 slot branch 생성/push 금지
- PR branch 수정 금지

### 8.2 제한적 허용

- write 테스트: test4 슬롯에서 QA disposable data로만 수행
- api write 테스트: 테스트 계획에 명시된 경우에만 수행
- cache invalidation: Cloudflare Pages 캐시 무효화는 CTO 승인 후 수행
- force-with-lease: Section 5 조건을 모두 만족할 때만 slot branch에 한정해 수행

---

## 9. 슬롯 배정 규칙

| Slot | 기본 용도 | 예시 |
|------|-----------|------|
| test1 | UI PR 검증 | PR UI 변경 사항 프리뷰 |
| test2 | runtime/backend route 검증 | `/api/health`, route winner smoke |
| test3 | policy/visibility 검증 | 공개/비공개 표시 필터 검증 |
| test4 | QA CRUD disposable data 검증 | 테스트 데이터 create/read/update/delete |
| test5 | 예비/대체 슬롯 | 긴급 대체 또는 추가 검증 |
| test6 | 임시/예외 검증 슬롯 | CTO가 지정한 단기 검증 |

실제 배정은 CTO 또는 담당 Lead가 보고서에 명시합니다. 한 slot은 한 PR 또는 한 검증 목적에만 배정합니다.

---

## 10. Firebase/Auth 체크리스트

슬롯 사용 전 필요한 범위에서 확인합니다.

### 10.1 Firebase Authorized Domains

- [ ] `test1.lovebud.pages.dev` 등록 확인
- [ ] `test2.lovebud.pages.dev` 등록 확인
- [ ] `test3.lovebud.pages.dev` 등록 확인
- [ ] `test4.lovebud.pages.dev` 등록 확인
- [ ] `test5.lovebud.pages.dev` 등록 확인
- [ ] `test6.lovebud.pages.dev` 등록 확인

### 10.2 Google Login Redirect

- [ ] Google OAuth consent screen의 Authorized redirect URIs에 대상 test slot URL 포함
- [ ] Firebase Auth popup/redirect 방식 정상 동작

### 10.3 로그인 세션 유지

- [ ] 로그인 후 redirect target이 현재 슬롯 도메인으로 유지되는지 확인
- [ ] logout → login 반복 시 cookie/session 충돌 없음
- [ ] 여러 브라우저 탭에서 동시 로그인/로그아웃 문제 없음

---

## 11. Cloudflare 체크리스트

### 11.1 도메인 연결 상태

- [ ] Cloudflare Pages 프로젝트에 대상 test slot custom domain 연결 완료
- [ ] DNS 설정이 Pages 프로젝트를 가리키는지 확인
- [ ] SSL/TLS 인증서 발급 완료

### 11.2 브랜치 바라보는 상태

- [ ] 대상 slot이 현재 어떤 git branch를 배포 중인지 확인
- [ ] test1은 기본적으로 `origin/test1`을 확인
- [ ] `origin/slot/test1`은 기본 업데이트 대상이 아님을 확인
- [ ] 배포된 commit SHA 기록

### 11.3 배포 상태

- [ ] Cloudflare Pages 배포 상태: Success/Failed
- [ ] 최신 deploy 시간 확인
- [ ] 배포 로그 확인
- [ ] test URL에서 token/source 또는 화면 반영 확인

### 11.4 캐시 무효화

- [ ] Cloudflare Pages 캐시 무효화 필요 여부 판단
- [ ] 무효화 실행은 CTO 승인 후 수행
- [ ] 무효화 후 재배포 대기

---

## 12. 검증 보고 템플릿

```text
[Slot Verification Report]
- Slot:
- Slot URL:
- Target branch:
- Target SHA:
- Slot branch updated:
- Slot branch SHA after update:
- Cloudflare deploy status:
- Token/source reflected:
- Viewports checked:
- Network result:
- Console result:
- Firebase Auth result:
- API result:
- UI result:
- Data mutation performed: yes/no
- Cleanup required: yes/no
- Production verification required after merge: yes/no
- Final judgment:
```

---

## 13. 위험 관리

### 13.1 데이터 위험

- test slot은 production-like 환경이므로 실제 운영 데이터 변경 가능성이 있습니다.
- write/delete 작업은 test4에서 disposable data로만 수행합니다.
- 테스트 데이터는 사후 삭제 또는 격리 상태를 유지합니다.

### 13.2 보안 위험

- 슬롯 도메인에서의 인증 token/cookie는 로그 기록 금지
- 테스트 계정 사용
- 외부 공유 금지

### 13.3 운영 위험

- slot 사용 후 반드시 배정 해제 또는 main 기준으로 복구 계획을 보고합니다.
- 슬롯 점유 시간 최소화
- 여러 작업자 간 충돌 방지: slot 사용 여부 공유

### 13.4 모니터링

- Cloudflare Pages 배포 실패 알림
- Firebase Auth error rate 모니터링
- slot 사용 로그 기록

---

## 14. 승인 및 보고 절차

### 14.1 slot 사용 요청

1. 검증 필요 PR, branch, 목적을 기재하여 CTO 또는 Ops Lead에게 요청
2. slot 할당 받기
3. 대상 remote branch와 target SHA를 확인
4. slot branch 갱신 권한을 확인

### 14.2 검증 수행

1. Firebase/Auth, Cloudflare 체크리스트 실행
2. 검증 보고서 작성
3. 문제 발견 시 즉시 중단 및 보고

### 14.3 사용 후 처리

1. slot branch를 main 기준으로 되돌릴지 유지할지 CTO 확인
2. 검증 보고서 완료본 제출
3. slot 해제 및 다음 사용자에게 양도

---

## 15. 금지선 요약

- 실제 Cloudflare/Firebase 설정 변경 금지. 단, CTO가 별도 승인한 경우 제외
- API/backend 코드 수정 금지
- main branch 직접 수정/push 금지
- `--force` 단독 push 금지
- PR branch 수정 금지
- 임의 slot branch 생성/push 금지
- production 데이터 write/delete 금지
- token/password/cookie 원문 기록 금지
- 슬롯 점유 시간 초과 금지

---

## 16. 참고 문서

- [OPERATIONS.md](OPERATIONS.md) - 일반 운영 원칙
- [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) - 배포 검증 체크리스트
- [RUNBOOK.md](RUNBOOK.md) - 장애 대응 실행서
- [PR_CHECKLIST.md](PR_CHECKLIST.md) - PR 점검 기준
- [../engineering/API_CONTRACT.md](../engineering/API_CONTRACT.md) - API 계약
- [../product/PRODUCT_IDENTITY.md](../product/PRODUCT_IDENTITY.md) - 제품 정체성

---

문서 버전: 1.2  
다음 리뷰: CTO 승인 후
