# Merge-First Production Verification Workflow

**Status:** Active canonical policy (supersedes pre-merge browser-gate requirements)
**Owner:** CTO
**Refs:** #3513

---

## 1. Purpose

This document defines the canonical merge-first Production verification workflow for LoveBud.

When Cloudflare Pages PR Preview, fixed test slot, authenticated preview, or staging-equivalent environments are **not reliably available** as a pre-merge required gate, this workflow replaces those gates with **post-merge Production verification** while keeping local tests and GitHub CI mandatory.
The workflow does **not** remove optional preview/fixed-slot procedures. They remain available as supplementary evidence when explicitly assigned and operational. Their absence, however, is **not a merge blocker**.

**Current operating mode:** Merge-first Production verification is the current default. Pre-merge Preview/fixed-slot deployment is not normally performed and is used only when explicitly assigned by CTO. This policy is the active operating mode; switching to a preview/staging-first approach in the future requires explicit owner-approved policy change first.

---

## 2. Current environment reality

The following environments are **currently not reliably available** as a required pre-merge gate:

| Environment | Status |
|---|---|
| Fixed test slot (test1-test10) | Not reliably available as a required gate |
| Authenticated PR Preview | Not reliably available as a required gate |
| Pre-merge deployed browser verification | Not reliably available as a required gate |
| Staging-equivalent authenticated verification | Not reliably available as a required gate |

When any of these environments **is** available and explicitly assigned by CTO, it may be used as optional supplementary evidence. The absence of these environments **must not** block merge.

---

## 2.1 Current operating mode (explicit)

The following statements are the **current operating mode** of LoveBud Production verification. They are normative, not aspirational.

- 기본적으로 PR Preview, fixed test slot, staging 배포를 수행하지 않는다.
- 에이전트가 preview URL을 찾거나 Wrangler slot deploy를 시도하지 않는다.
- CTO가 명시적으로 지정한 경우에만 optional supplementary evidence로 사용한다.
- local tests와 GitHub CI가 green이면 exact-head squash merge한다.
- merge 후 Cloudflare Pages가 main을 Production에 자동 반영한다.
- 별도의 수동 Production deploy 명령을 실행하는 절차가 아니다.
- 자동 반영 후 https://lovebud.pages.dev/ 에서 로그인한 실제 화면을 확인한다.
- Production 확인 실패 시 main force push/reset을 하지 않는다.
- 실패한 squash merge를 대상으로 dedicated revert PR을 생성한다.
- 이 정책은 현재 운영 모드다.
- 향후 preview/staging-first 방식으로 전환할 때는 owner 승인과 canonical policy 변경이 먼저 필요하다.

---

## 3. Standard workflow

```
로컬 구현
→ 로컬 자동 테스트
→ 정상 branch push
→ 원격 cumulative diff와 exact PR head 검토
→ GitHub CI/check 전체 성공
→ expected_head_sha 고정 squash merge
→ main의 정상 Production 배포
→ 로그인된 Production에서 실제 화면 확인
→ PASS면 child issue 종료
→ FAIL이면 해당 squash merge 전용 revert PR
```

### 3.1 Step details

1. **로컬 구현** — 컴1 implements the code changes locally.
2. **로컬 자동 테스트** — 컴1 runs local tests (npm test, npm run lint, npm run build, npm run verify, git diff --check).
3. **정상 branch push** — 컴1 pushes to the remote branch.
4. **원격 cumulative diff와 exact PR head 검토** — CTO reviews the remote diff, changed files, and exact PR head SHA.
5. **GitHub CI/check 전체 성공** — All CI checks must be green (including lint, build, test, verify, smoke, route tests, contract tests). A pending or red check blocks merge.
6. **expected_head_sha 고정 squash merge** — CTO performs a squash merge with the exact expected head SHA pinned.
7. **Cloudflare Pages가 main을 Production에 자동 반영** — Cloudflare Pages **automatically** reflects main to Production; there is no separate manual Production deploy command.
8. **로그인한 Production에서 실제 화면 확인** — After Cloudflare Pages automatically deploys main to Production, 컴1-브 performs post-merge Production verification with a logged-in real browser at https://lovebud.pages.dev/.
9. **PASS면 child issue 종료** — CTO closes the child issue.
10. **FAIL이면 dedicated revert PR** — If Production fails, CTO creates a dedicated revert PR (not a force-push rollback).

---

## 4. Mandatory pre-merge gates (remain required)

The following pre-merge gates **remain mandatory**:

| Gate | Requirement |
|---|---|
| Local tests pass | Required |
| npm run lint | Required |
| npm run build | Required |
| npm test (all Node tests) | Required |
| npm run verify | Required |
| git diff --check | Required |
| GitHub CI (lint + build + test + verify) | Required |
| Exact PR head SHA review | Required |
| Cumulative diff review | Required |
| Changed files review | Required |

---

## 5. Optional pre-merge gates (non-blocking)

The following pre-merge gates are **optional** and their absence is **not a merge blocker**:

| Gate | Status | When used |
|---|---|---|
| Fixed test slot browser verification | OPTIONAL — NOT_AVAILABLE if absent | When explicitly assigned by CTO |
| Cloudflare PR Preview browser verification | OPTIONAL — NOT_AVAILABLE if absent | When PR Preview works and is approved |
| Authenticated preview verification | OPTIONAL — NOT_AVAILABLE if absent | When explicitly assigned |
| Pre-merge browser PASS | OPTIONAL — NOT_USED if absent | When explicitly requested |
| Wrangler direct slot deploy | OPTIONAL — NOT_USED if absent | When slot deploy is requested |

Reports must record NOT_AVAILABLE or NOT_USED truthfully rather than inferring a PASS from missing evidence.

---

## 6. Post-merge Production verification (required for UI/Auth runtime)

Post-merge Production verification is the **current final confirmation step** for UI/Auth/runtime behavior.

### 6.1 Requirements

| Item | Requirement |
|---|---|
| Target | https://lovebud.pages.dev/ |
| Environment | Logged-in real browser (desktop + mobile) |
| Scope | Console, Network, Route, UI state |
| Who | 컴1-브 (browser verifier) |
| When | After Production deploy completes |
| Report | Desktop/mobile, console/network, route, UI state observations |

### 6.2 Desktop checks

- Page renders without fatal blank state.
- Expected UI state appears.
- No fatal console error.
- No new network blocker.
- No horizontal overflow.
- Required CSS/JS files load with 2xx.
- Auth state is correct (logged-in / logged-out).

### 6.3 Mobile checks (375px baseline)

- Same as desktop checks plus:
- No horizontal overflow at 375px.
- Primary CTA remains usable.
- Touch targets are not overlapping.

### 6.4 Report format

```text
[Post-Merge Production Verification Report]

PR: #<number>
Branch: <branch>
Merge SHA: <sha>
Production URL: https://lovebud.pages.dev/

Desktop:
- Initial load: PASS / FAIL / NOT_VERIFIED
- UI state: PASS / FAIL / NOT_VERIFIED
- Console: CLEAN / KNOWN_WARNINGS / NEW_BLOCKER
- Network: CLEAN / KNOWN_WARNINGS / NEW_BLOCKER
- Horizontal overflow: ABSENT / PRESENT

Mobile 375px:
- Initial load: PASS / FAIL / NOT_VERIFIED
- UI state: PASS / FAIL / NOT_VERIFIED
- Console: CLEAN / KNOWN_WARNINGS / NEW_BLOCKER
- Network: CLEAN / KNOWN_WARNINGS / NEW_BLOCKER
- Horizontal overflow: ABSENT / PRESENT

Pre-merge browser verification: NOT_AVAILABLE / NOT_USED / PASS
Fixed slot used: <slot> / NONE
Auth/login verified: YES / NO / NOT_REQUIRED
Data mutation: NO_MUTATIONS / APPROVED_DISPOSABLE_MUTATION_ONLY
Secret/token/session/cookie exposure: NONE
Final judgment: PASS / FAIL / PARTIAL / BLOCKED
```

---

## 7. Squash merge rules

### 7.1 expected_head_sha 고정

The CTO must pin the exact expected head SHA before squash merge.

```text
expected_head_sha: <exact SHA from PR head>
```

If the PR head SHA has drifted (new commits pushed after review), the CTO must re-review before merge.

### 7.2 Squash merge only

- Use squash merge. Do not rebase, do not merge commit.
- The squash commit message must reference the issue number (Refs #...).
- Do not use Fixes, Closes, or Resolves unless explicitly authorized.

---

## 8. Rollback rules (dedicated revert PR)

### 8.1 Forbidden rollback methods

| Method | Status |
|---|---|
| git push --force to main | FORBIDDEN |
| git reset --hard rollback | FORBIDDEN |
| git branch -D + force push | FORBIDDEN |
| GitHub web direct edit of main | FORBIDDEN |
| main ref manual move | FORBIDDEN |

### 8.2 Allowed rollback method

The **only** allowed rollback method is a dedicated revert PR:

1. Create a new branch from the current main.
2. Use git revert <merge-commit-sha> to create a revert commit.
3. Push and open a PR.
4. The revert PR must pass the same gates: local tests, CI, git diff --check.
5. CTO performs expected-head squash merge of the revert PR.
6. 컴1-브 re-verifies Production after revert.

```text
revert PR steps:
1. git checkout main && git pull origin main
2. git checkout -b revert/<original-branch-name>
3. git revert -m 1 <merge-commit-sha> --no-edit
4. git push -u origin revert/<original-branch-name>
5. Create PR with title "revert: <original PR title>"
6. PR body: "Refs #<issue>. Reverts <original PR title>."
7. Pass tests and CI.
8. CTO squash merge.
9. 컴1-브 verifies Production.
```

---

## 9. Issue management

### 9.1 Child issue close

When post-merge Production verification passes:

```text
Child issue: close
Close keyword: Refs (not Fixes/Closes/Resolves)
```

### 9.2 Parent issue keep open

Parent tracking issues remain open until the larger goal is complete.

```text
Parent issue: keep open
Keep keyword: Refs
```

Examples of parent issues that must stay open:
- #3475 (canonical appreciation boundary audit)
- #3075 (moment social)
- #3188 (tree social)
- #1882 (public-first policy)

---

## 10. Agent role definitions

### 10.1 CTO

| Action | Allowed |
|---|---|
| Remote main and PR head verification | Allowed |
| Cumulative diff / changed files review | Allowed |
| CI/comments/reviews/threads direct check | Allowed |
| expected-head squash merge | Allowed |
| Production pass/fail judgment | Allowed |
| Revert PR creation and management | Allowed |
| main push | Allowed (only through merge) |
| Code/document editing | Allowed (scope-dependent) |

### 10.2 컴1

| Action | Allowed |
|---|---|
| Local code and document editing | Allowed |
| Local testing | Allowed |
| Commit and push (non-main) | Allowed |
| Final execution report | Allowed |
| PR merge | NOT allowed |
| Production operation | NOT allowed |
| main push | NOT allowed |

### 10.3 컴1-브

| Action | Allowed |
|---|---|
| Post-merge Production browser verification | Allowed |
| Logged-in real browser desktop/mobile check | Allowed |
| Console/network/route report | Allowed |
| Code editing | NOT allowed |
| Commit/Push/Merge/Revert | NOT allowed |
| SKILL.md or agent skill file editing | NOT allowed (without explicit separate approval) |
| Self-improvement/skill files | NOT allowed (without explicit separate approval) |
| Repository-external agent rules | NOT allowed (without explicit separate approval) |

---

## 11. Self-improvement restriction

컴1-브 (and any agent executing browser verification) must not modify:

- SKILL.md and agent skill reference files
- Self-improvement files
- Repository-external agent rules

Without explicit, separate approval from the CTO.

---

## 12. Reference documents

| Document | Relationship |
|---|---|
| AGENTS.md | Repository-wide canonical agent guidance |
| docs/ops/TEST_PREVIEW_SLOTS.md | Fixed test slot operational standard (OPTIONAL status) |
| docs/ops/BROWSER_VERIFICATION_URL_POLICY.md | URL provenance rules (OPTIONAL status) |
| docs/ops/FIXED_SLOT_MANUAL_E2E_GATE.md | Fixed slot manual E2E gate (OPTIONAL status) |
| docs/ops/DEPLOY_CHECKLIST.md | Deployment checklist |
| docs/ops/RUNBOOK.md | Operations runbook |

---

## 13. Document version

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Active canonical policy |
| Owner | CTO |
| Last updated | 2026-07-15 |
| Refs | #3513 |
