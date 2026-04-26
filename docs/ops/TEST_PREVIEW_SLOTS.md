# Fixed Test Preview Slots

**Status:** Active  
**Owner:** CTO / Ops Lead  
**Last Updated:** 2026-04-26  
**Branch:** docs/fixed-preview-slots-10-clean

---

## 1. Purpose

Fixed Test Preview Slots provide stable Cloudflare Pages domains for verification when a PR Preview is insufficient or unsuitable. They are used to separate product/code failures from preview infrastructure, Firebase Auth domain, login redirect, API routing, or test data availability issues.

Use this document as the source of truth for:

- Browser / Web / Local role boundaries
- PR Preview vs fixed slot decision rules
- fixed slot assignment rules
- slot access failure and partial verification reporting
- evidence hygiene for screenshots, console logs, and network logs
- slot release / restore procedure

---

## 2. Fixed Test Preview Slots

| Slot | Domain | Default use |
|------|--------|-------------|
| test1 | https://test1.lovebud.pages.dev | UI PR verification |
| test2 | https://test2.lovebud.pages.dev | runtime/backend route verification |
| test3 | https://test3.lovebud.pages.dev | policy/visibility verification |
| test4 | https://test4.lovebud.pages.dev | QA CRUD disposable data verification |
| test5 | https://test5.lovebud.pages.dev | spare / fallback slot |
| test6 | https://test6.lovebud.pages.dev | temporary / exceptional verification slot |
| test7 | https://test7.lovebud.pages.dev | parallel UI/API verification |
| test8 | https://test8.lovebud.pages.dev | parallel UI/API verification |
| test9 | https://test9.lovebud.pages.dev | parallel UI/API verification |
| test10 | https://test10.lovebud.pages.dev | parallel UI/API verification |

Each slot domain is a fixed Cloudflare Pages domain. Actual assignment must be stated by the CTO or responsible Lead.

Fixed slot assignment must be explicit. Available fixed slots are `test1` through `test10`. Executors must not assume `test1` when a slot is not explicitly assigned.

---

## 3. Branch source of truth

### 3.1 Default fixed slot branches

The default fixed slot branches are `origin/test1` through `origin/test10`, subject to actual branch existence and CTO assignment.

`https://test1.lovebud.pages.dev` is operated from `origin/test1` unless CTO explicitly says otherwise. The same pattern applies to the other fixed slots:

```text
origin/test1
origin/test2
origin/test3
origin/test4
origin/test5
origin/test6
origin/test7
origin/test8
origin/test9
origin/test10
```

### 3.2 `origin/slot/*` branches are not the default

`origin/slot/test1` and similarly named `origin/slot/*` branches are not the default update targets. Do not update them unless CTO explicitly names them.

### 3.3 Required identifiers

Every fixed slot verification report must record:

- PR number or task name
- PR head branch
- PR head SHA
- target slot
- slot branch before update
- slot branch after update
- Cloudflare deploy status
- URL actually verified

Do not infer the target SHA from a local branch name.

---

## 4. Role split: Browser / Web / Local

### 4.1 Browser verifier

The Browser verifier uses a real browser, DevTools, MCP, Playwright, or equivalent browser automation to observe the rendered product.

Allowed:

- open PR Preview, branch preview, fixed slot, or production URL when assigned
- verify login gate and actual page access
- check 1440 / 1024 / 375 viewports unless the task narrows scope
- inspect console and network
- capture screenshots or short observation notes
- classify horizontal overflow, runtime warnings, and blockers

Forbidden:

- code edits
- PR merge / close / branch deletion
- Issue updates
- branch reset / push / force push
- production data mutation
- memory/tree create, edit, delete, title change, or visibility change unless explicitly approved
- recording raw token, password, cookie, Authorization header, Firebase credential, or private content

### 4.2 Web verifier / GitHub executor

The Web verifier checks GitHub metadata and repository state. If no real browser verification is performed, the report must say so.

Allowed:

- PR state, draft status, head SHA, changed files, mergeability checks
- PR body issue hygiene checks
- Issue open/closed checks
- docs-only scope checks
- Cloudflare bot comment / preview URL existence checks

Forbidden:

- claiming UI PASS from GitHub metadata alone
- modifying code/docs/issues/PRs without explicit instruction
- branch reset / force push
- treating PR Preview URL existence as rendered-page verification

### 4.3 Local / Ops slot executor

The Local/Ops executor updates slot branches from a clean clone or clean worktree.

Allowed:

- `git fetch origin`
- verify `origin/main`, PR head SHA, and current slot branch SHA
- update the approved slot branch to the approved target SHA
- use `git push --force-with-lease origin <slot-branch>`
- check Cloudflare deploy status

Forbidden:

- modifying PR head branch
- direct push or force push to `main`
- using plain `--force`
- guessing target SHA
- resetting a slot to another PR or to `main` without approval
- sharing a contaminated local worktree across unrelated implementation tasks

---

## 5. PR Preview vs fixed slot decision rules

### 5.1 PR Preview may be used only for preliminary checks

Cloudflare PR Preview URLs are useful for deployment existence checks, static page smoke checks, docs/static metadata observation, and early visual sanity checks when no auth/API/stable-domain dependency exists.

A PR Preview must not be treated as final PASS when the required user flow depends on login, Firebase Auth, OAuth redirects, API routing, stable test data, clipboard/deep-link verification for merge approval, or shared app state.

### 5.2 Use fixed slot when any are true

- The screen requires login: `editor`, `my-trees`, `settings`, or account-bound flows.
- Firebase Authorized Domain, OAuth redirect, popup, or redirect-loop risk is expected.
- PR Preview opens but cannot reach the actual authenticated page.
- API/runtime route verification needs a stable domain.
- Browse/Search verification depends on API/data load and needs stable domain behavior.
- Clipboard/deep-link verification is being used for merge approval.
- CTO explicitly assigns `test1` through `test10`.

PR Preview URLs are not sufficient for final PASS on login/auth/API/domain-sensitive UI flows. Browser/UI verification should use a CTO-assigned fixed test preview slot when stable domain behavior matters.

### 5.3 Decision matrix

| Work type | Preferred target | Notes |
|-----------|------------------|-------|
| Public static smoke check | PR Preview or assigned slot | PR Preview can be preliminary only |
| Browse/Search with API/data load | CTO-assigned fixed slot | local static server alone is not PASS |
| Clipboard/deep-link merge verification | CTO-assigned fixed slot | record copied URL and opened URL |
| Login-required UI | CTO-assigned fixed slot | PR Preview may be metadata-only if auth domain blocks access |
| Runtime/API route smoke | fixed slot or production-equivalent preview | record endpoint, status, and response class |
| Production regression after merge | production URL | only after merge + deploy complete |
| Docs-only | GitHub metadata may be enough | rendered site verification not required unless docs are served |

### 5.4 Fallback rules

- If PR Preview fails due to auth/domain issues, switch to a CTO-assigned fixed slot.
- If fixed slot also fails, classify the failure instead of blaming code by default.
- If PR Preview and fixed slot disagree, report both URL, target SHA, deploy status, and observed behavior.
- If target SHA reflection is unclear, mark PARTIAL.

---

## 6. Slot update procedure

The default flow is Local/Ops only.

```bash
git fetch origin
git rev-parse origin/main
git rev-parse origin/<pr-head-branch>
git rev-parse origin/<assigned-slot>

git checkout -B <assigned-slot> origin/<assigned-slot>
git reset --hard <approved-pr-head-sha>
git push --force-with-lease origin <assigned-slot>
```

Rules:

- `<approved-pr-head-sha>` must come from PR metadata or CTO instruction.
- Replace `<assigned-slot>` with the CTO-assigned slot branch, for example `test1` or `test7`.
- Use the assigned slot branch only.
- Use `--force-with-lease`, never plain `--force`.
- Do not modify the PR branch.
- Do not modify `main`.
- Never update `test1` by habit when CTO assigned a different slot or did not assign any fixed slot.

---

## 7. Slot access failure and partial verification

Verification judgments must separate what was observed from what was not observed.

| Situation | Judgment | Required report |
|-----------|----------|-----------------|
| Slot URL cannot be reached or DNS fails | BLOCKED | classify as slot infra/DNS blocker, not product code failure |
| Cloudflare deploy failed | BLOCKED | deploy id/status/log link if available |
| URL opens but target SHA is unclear | PARTIAL | URL, observed asset/source/network evidence, unknown SHA state |
| Login gate reached but actual page not verified | PARTIAL | auth gate confirmed; page interior not verified |
| Actual page opens but no valid test data is available | PARTIAL | no mutation; identify missing test data |
| Browser verified viewport + console + network | PASS candidate | still separate warnings from blockers |
| New console exception or API 5xx tied to PR change | BLOCKED or revision needed | include endpoint/status/viewport/screenshot reference |

Terminology:

- `PASS`: required observations completed, no blocking regression found.
- `PARTIAL`: some required observations completed, but one or more material checks were not possible.
- `BLOCKED`: verification could not proceed because of infra/auth/deploy/data access or a blocking runtime failure.
- `FAIL`: observed product behavior does not meet the expected result.

Do not turn PARTIAL into PASS without the missing observation.

---

## 8. Evidence hygiene

Evidence must be useful, minimal, and safe to share.

### 8.1 Screenshots

- Capture only the relevant viewport and state.
- Redact email, account name, tokens, private notes, private tree titles, or user content when visible.
- Label screenshots with URL, viewport, and state if they are not obvious.
- Do not include unrelated browser tabs or password managers.

### 8.2 Console logs

- Include the error/warning message, source file, line number, and timestamp when useful.
- Remove raw token, cookie, Firebase credential, Authorization header, and full private payloads.
- Separate known warnings from new blockers.
- Do not report extension noise as app failure without isolation.

### 8.3 Network logs

- Record method, endpoint path, status, and high-level response class.
- Redact `Authorization`, `Cookie`, session token, API key, and full private response body.
- HAR export is not required unless CTO asks for it.
- If mutation did not occur, state `NO MUTATIONS`.
- If mutation is required, use test4 + disposable data + explicit approval.

### 8.4 Evidence summary template

```text
[Evidence]
- URL:
- Viewport:
- Target SHA reflected: yes/no/unclear
- Screenshot: attached/not captured/redacted
- Console: clean / known warnings / new blocker
- Network: clean / known warnings / new blocker
- Auth state: not required / login gate only / actual page verified
- Data mutation: NO MUTATIONS / approved disposable mutation
```

---

## 9. Slot release / restore procedure

After verification, do not leave ownership ambiguous.

1. Report slot URL, slot branch, target SHA, deploy status, and occupying PR/task.
2. Ask CTO whether to restore the slot to `main`, leave it on the PR SHA, or hand it to the next task.
3. If restoring, use the same `--force-with-lease` rules.
4. Record the final slot branch SHA.
5. Do not reset a slot branch silently.

---

## 10. Firebase/Auth checklist

Use this only when the task requires login or auth-domain validation.

- [ ] target slot domain is in Firebase Authorized Domains
- [ ] OAuth redirect domain is compatible with target slot
- [ ] login returns to the same slot domain
- [ ] logout/login repeat does not create redirect loops
- [ ] actual page interior is reached after login, not just the login page

Slot domains to check as needed:

- `test1.lovebud.pages.dev`
- `test2.lovebud.pages.dev`
- `test3.lovebud.pages.dev`
- `test4.lovebud.pages.dev`
- `test5.lovebud.pages.dev`
- `test6.lovebud.pages.dev`
- `test7.lovebud.pages.dev`
- `test8.lovebud.pages.dev`
- `test9.lovebud.pages.dev`
- `test10.lovebud.pages.dev`

---

## 11. Cloudflare checklist

- [ ] target custom domain is connected to the Cloudflare Pages project
- [ ] DNS resolves to the Pages project
- [ ] SSL/TLS certificate is valid
- [ ] deployed branch is the expected slot branch
- [ ] deployed commit SHA is recorded or asset/source reflection is documented
- [ ] deploy status is Success/Failed/In progress
- [ ] cache issue is considered only after deploy status and SHA are checked

Cache invalidation requires CTO approval.

---

## 12. Verification report template

```text
[Slot Verification Report]
- Role: Browser / Web / Local
- Slot:
- Slot URL:
- PR / task:
- Target branch:
- Target SHA:
- Slot branch before:
- Slot branch after:
- Cloudflare deploy status:
- Target SHA reflected: yes/no/unclear
- Viewports checked:
- Auth result:
- API/network result:
- Console result:
- UI result:
- Data mutation performed: NO MUTATIONS / approved disposable mutation
- Evidence:
- Missing checks:
- Final judgment: PASS / PARTIAL / BLOCKED / FAIL
- Production verification required after merge: yes/no
- Slot release / restore decision:
```

---

## 13. Guardrails

- main direct commit/push/force-push is prohibited.
- PR branch modification is prohibited during slot verification.
- plain `--force` is prohibited.
- Fixed slot assignment must be explicit.
- Available fixed slots are `test1` through `test10`.
- PR Preview URLs are not sufficient for final PASS on login/auth/API/domain-sensitive UI flows.
- A verifier must not silently choose a slot when no slot has been assigned.
- A verifier must not claim final UI PASS from PR Preview when the CTO requested fixed slot verification.
- production data write/delete is prohibited unless separately approved.
- token/password/cookie/raw credential logging is prohibited.
- PR #7 prototype and prototype/reference/demo folders are not slot cleanup targets.
- API/backend code changes are not part of slot verification.
- Browser-only verification must not be replaced by GitHub metadata when the task requires rendered UI proof.

---

## 14. Reference docs

- [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) - deployment verification checklist
- [RUNBOOK.md](RUNBOOK.md) - operations runbook
- [PR_CHECKLIST.md](PR_CHECKLIST.md) - PR review checklist
- [../engineering/API_CONTRACT.md](../engineering/API_CONTRACT.md) - API contract
- [../product/PRODUCT_IDENTITY.md](../product/PRODUCT_IDENTITY.md) - product identity

---

Document version: 1.4  
Next review: CTO approval after next fixed-slot verification cycle
