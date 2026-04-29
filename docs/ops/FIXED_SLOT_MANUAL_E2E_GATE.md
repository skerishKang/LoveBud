# Fixed Slot Manual E2E Gate

> **This document is a manual gate runbook.**
> It is NOT a CI workflow implementation.
> It defines how to safely use fixed test slots for manual E2E smoke verification
> while automated Cloudflare Pages-based E2E smoke is not yet in place.

---

## 1. Purpose

This runbook implements the **manual gate phase** of Issue #136:
_CI gap: define Cloudflare Pages based E2E smoke replacement._

After PR #108 removed Netlify-dev-based E2E smoke, the repository has a CI coverage gap:

- Netlify dev E2E smoke: **removed** (correct direction).
- Cloudflare Pages + Modal: **official verification direction**.
- Automated Cloudflare Pages E2E smoke: **not yet implemented**.

Until automated E2E smoke is available, this runbook defines the **manual gate** using fixed test slots (`test1`–`test10`).

> **This is NOT a reintroduction of Netlify dev.**
> Netlify remains a legacy artifact / removal candidate and must not be used as a verification target.

---

## 2. Fixed Slot Scope

### Permitted Slots

The current fixed slot pool is `test1` through `test10`.

| Slot | Cloudflare Pages Branch | Status |
|------|------------------------|--------|
| test1 | `test/slot-1` | Available for assignment when no active assignment exists |
| test2 | `test/slot-2` | Available for assignment when no active assignment exists |
| test3 | `test/slot-3` | Available for assignment when no active assignment exists |
| test4 | `test/slot-4` | Available for assignment when no active assignment exists |
| test5 | `test/slot-5` | Available for assignment when no active assignment exists |
| test6 | `test/slot-6` | Available for assignment when no active assignment exists |
| test7 | `test/slot-7` | Available for assignment when no active assignment exists |
| test8 | `test/slot-8` | Available for assignment when no active assignment exists |
| test9 | `test/slot-9` | Available for assignment when no active assignment exists |
| test10 | `test/slot-10` | Available for assignment when no active assignment exists |

### Slot Assignment Rules

- **One slot = one PR at a time.** A slot may not be shared across multiple PRs simultaneously.
- **No unilateral use.** A slot must be explicitly assigned before verification begins.
- **No active slot overwrite.** Do not overwrite, reset, redeploy, or repoint a slot that has an active assignment.
- **No arbitrary URL use.** Using a slot URL without a recorded assignment is prohibited.
- Slot assignment is tracked in the [Assignment Record](#4-assignment-record) below and in the PR-specific `Browser verification entrypoint` comment.

### New Browser Verification Assignment Procedure

When assigning a new browser verification slot:

1. Check the current assignment status for `test1` through `test10`.
2. Select the first slot with no active assignment.
3. Record the assignment before verification begins.
4. Deploy or point the selected slot only after assignment is recorded and the task explicitly allows slot update.
5. Confirm SHA provenance before reporting final PASS.

If every slot is occupied:

1. Report the occupied list to the CTO.
2. Include each occupied slot, PR number, branch, head SHA, and release condition when available.
3. Do not overwrite any occupied slot.
4. Wait for the CTO or slot custodian to decide which slot can be released.

---

## 3. SHA Provenance

Before reporting any E2E result against a fixed slot, the verifier **must** confirm SHA alignment.

### SHA Check Procedure

```text
1. Identify the slot's current branch head SHA:
   - Check the Cloudflare Pages deployment dashboard, OR
   - Check the slot branch tip: git log test/slot-N --oneline -1

2. Identify the PR head SHA:
   - GitHub PR page → head commit SHA, OR
   - git log <pr-branch> --oneline -1

3. Compare:
   - slot branch SHA == PR head SHA → SHA aligned → proceed
   - slot branch SHA != PR head SHA → SHA MISMATCH → BLOCKED
```

### SHA Mismatch Rules

- **SHA mismatch = final PASS prohibited.**
- If the slot branch is stale (reflects a different PR or an older commit), report: `final status: BLOCKED — slot SHA mismatch`.
- Slot branch update requires explicit approval from the slot custodian. Do NOT update the slot branch unilaterally.

---

## 4. Assignment Record

Record all slot assignments here. Update this table when a slot is assigned or released.

| PR # | Branch | Head SHA | Slot | Assigned URL | Assigned by | Assignment time | Release condition |
|------|--------|----------|------|--------------|-------------|-----------------|-------------------|
| — | — | — | — | — | — | — | — |

> **Instructions:**
> - Fill one row per active assignment.
> - `Release condition`: e.g., `PR merged`, `PR closed`, `manual release by custodian`.
> - After release, move the row to an archive section below or delete it.
> - Do NOT record credential values, passwords, or session tokens in this table.

### Archive (Released Assignments)

| PR # | Branch | Head SHA | Slot | Assigned URL | Assigned by | Assignment time | Released |
|------|--------|----------|------|--------------|-------------|-----------------|----------|
| — | — | — | — | — | — | — | — |

---

## 5. Evidence Format

Every manual E2E gate result must be reported using this evidence format.

```text
URL:                   <full Cloudflare Pages URL for the slot>
Page path:             <e.g., /, /search.html, /intro.html>
Viewport:              <e.g., 1280x800, 390x844 (mobile)>
Browser/tool:          <e.g., Chrome 124 manual, Playwright headless>
Console fatal:         NONE | <description of fatal error>
Network/API blocker:   NONE | <description of blocked request>
Horizontal overflow:   NONE | <description>
Final status:          PASS | PARTIAL | BLOCKED | FAIL
```

### Final Status Definitions

| Status | Meaning |
|--------|---------|
| `PASS` | All targeted pages loaded correctly; no fatal console errors; no API blockers for the page classification; no horizontal overflow |
| `PARTIAL` | Some pages pass, some have non-critical issues; explicitly documented |
| `BLOCKED` | Verification could not be completed (SHA mismatch, slot unavailable, credential missing, etc.) |
| `FAIL` | Targeted pages have fatal errors or critical regressions |

---

## 6. Page Classification

Pages are classified by their runtime dependency. Use this classification to determine
which pages are valid for a given slot/environment.

| Page | Classification | Notes |
|------|---------------|-------|
| `/` | static-only | Valid for all slot environments |
| `/intro.html` | static-only | Valid for all slot environments |
| `/search.html` | API-dependent | Requires Modal browse API to be reachable |
| `/detail.html` | API-dependent | Requires known public fixture; validate before use |
| `/my-trees.html` | Auth/session-dependent | Requires valid QA credential; see `QA_CREDENTIALS.md` |
| `/editor.html` | Auth/session-dependent | Requires valid QA credential |
| `/settings.html` | Auth/session-dependent | Requires valid QA credential |
| login/logout flow | Auth/session-dependent | Requires valid QA credential |
| Browse/Summary API | Modal-upstream-dependent | PASS only valid when Modal upstream is reachable |

### Classification Rules

- **static-only**: May report `PASS` from a fixed slot without credentials or API.
- **API-dependent**: Report `BLOCKED` if Modal upstream is down; do not report `FAIL` for upstream outage.
- **Auth/session-dependent**: Credential source must be declared in evidence (`persistent bundle | temporary handoff | pre-existing local file`). See `QA_CREDENTIALS.md`.
- **Modal-upstream-dependent**: Report `BLOCKED` if Modal upstream is unreachable; this is not a regression in the frontend.

---

## 7. Restrictions

### Final PASS Prohibitions

| Condition | Rule |
|-----------|------|
| Local static server (`python -m http.server`, `npx serve`, etc.) | ❌ NOT final PASS for Browse/Search/Auth/API/data-loaded pages |
| Production URL (`lovebud.pages.dev`) pre-merge | ❌ NOT final PASS; production must not be used as pre-merge verification target |
| Stale slot (slot SHA ≠ PR head SHA) | ❌ NOT final PASS |
| Slot with no assignment record | ❌ NOT final PASS |
| Occupied slot overwritten without release decision | ❌ NOT final PASS |

### Output Prohibitions

- **No secret/credential/cookie/session values** in evidence reports, PR comments, or issue comments.
- Credential source must be declared as a category (`persistent bundle | temporary handoff | pre-existing local file`), never as a value.
- No ZIP password, no auth token values, no session cookie values.

### Scope Prohibitions

- **No changes to PR #7**, prototype, reference, demo, or variant files.
- **No workflow changes** (`.github/workflows/*`) in this PR or as part of this manual gate phase.
- **No Playwright/test runner changes** in this PR.
- **No package changes** (`package.json`, `package-lock.json`, etc.).
- **No runtime/code changes**.

---

## 8. Relationship to Automation

This document defines the **manual gate only**.

| Phase | Status | Description |
|-------|--------|-------------|
| Manual gate (this doc) | ✅ Active | Fixed slot assignment + SHA provenance + evidence format |
| Semi-automated supplied URL smoke | 🔲 Future | A future PR may add a workflow that accepts a supplied Cloudflare Pages URL and runs headless smoke checks |
| Automated Cloudflare Pages E2E smoke | 🔲 Future | Full CI integration once preview URL mechanics are confirmed reliable (Issue #136) |

> **No workflow, package, test runner, or runtime changes are included in this PR.**
> The automation phases are tracked under Issue #136 and must be implemented in separate PRs.

---

## 9. Smoke Target List

Based on Issue #136 suggested minimal smoke targets:

### Static / Public-first Candidates (current manual gate scope)

| Page | Classification | Slot valid? |
|------|---------------|-------------|
| `/` | static-only | ✅ Yes |
| `/intro.html` | static-only | ✅ Yes |
| `/search.html` | API-dependent | ✅ Yes (with Modal upstream check) |
| `/detail.html` | API-dependent | ✅ Yes (with known public fixture only) |

### Runtime / Auth Candidates (manual or later-phase)

| Page | Classification | Slot valid? |
|------|---------------|-------------|
| `/my-trees.html` | Auth/session-dependent | ✅ Yes (with valid QA credential) |
| `/editor.html` | Auth/session-dependent | ✅ Yes (with valid QA credential) |
| `/settings.html` | Auth/session-dependent | ✅ Yes (with valid QA credential) |
| Login/logout flow | Auth/session-dependent | ✅ Yes (with valid QA credential) |

---

## 10. Related Documents

- [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md) — fixed test slot 운영 기준
- [BROWSER_VERIFICATION_URL_POLICY.md](BROWSER_VERIFICATION_URL_POLICY.md) — URL provenance 및 PR Preview 기준
- [QA_CREDENTIALS.md](QA_CREDENTIALS.md) — QA credential 복원 워크플로우
- [LOCAL_BROWSER_VERIFICATION_STARTUP.md](LOCAL_BROWSER_VERIFICATION_STARTUP.md) — 브라우저 검증 시작 전 공통 preflight
- [KNOWN_CI_E2E_BLOCKERS.md](KNOWN_CI_E2E_BLOCKERS.md) — 반복 CI/E2E blocker 원인 분리
- Issue [#136](https://github.com/skerishKang/LoveBud/issues/136) — CI gap: Cloudflare Pages E2E smoke replacement
