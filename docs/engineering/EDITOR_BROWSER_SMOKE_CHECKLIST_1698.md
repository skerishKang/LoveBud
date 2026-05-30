# Editor Browser Smoke Checklist for #1698

**Status:** Active verification checklist  
**Owner:** CTO / Engineering Lead  
**Related issue:** #1698  
**Scope:** Editor page browser/runtime smoke only

This checklist converts the current `editor-shell-helpers.js` contract coverage into a browser smoke path for the Editor page. It is intended for PR Preview, fixed test slot, or deployed SHA verification after narrow Editor orchestration changes.

The checklist is deliberately runtime-observation focused. It does not authorize code changes, API changes, Auth changes, schema changes, public viewer route changes, or canvas lifecycle changes.

---

## 1. Non-goals

Do not use this checklist to approve any of the following in the same PR:

- `js/editor/editor-canvas.js` refactor;
- `initCanvas` behavior change;
- pan, zoom, drag, selection, or canvas lifecycle change;
- Auth provider/session behavior change;
- API/backend/schema change;
- public viewer route or public canvas entrypoint change;
- HTML restructuring or CSS redesign;
- copy-only changes outside the tested Editor startup surface;
- test-only production comments, dead variables, or dynamic-method bypasses.

If one of those areas changes, the PR needs a narrower issue-specific verification path before this checklist is useful.

---

## 2. Required environment evidence

Record the exact environment before smoke testing:

```text
Repository: skerishKang/LoveBud
Issue: #1698 remains OPEN
PR number:
PR head SHA:
Base main SHA:
Preview/test URL:
Cloudflare Pages deployment SHA matches PR head: YES/NO/NOT_VERIFIED
Browser:
Viewport(s): desktop / 375px mobile
Account type: seeded test account / manual account / other safe test account
Private payload exposure: NO/YES
Secret exposure: NO/YES
```

Do not paste credentials, session tokens, cookies, owner IDs, tree IDs, memory IDs, copied tree IDs, raw API payloads, DB rows, or private user content into the report.

---

## 3. Static preflight gate

Run or cite the PR CI result for these checks before browser smoke:

```text
git diff --check: PASS/FAIL/NOT_RUN
npm run verify: PASS/FAIL/NOT_RUN
npm test: PASS/FAIL/NOT_RUN
Changed files reviewed for forbidden scope: PASS/FAIL
Runtime source changed: YES/NO
```

For docs-only PRs, browser smoke may be `NOT_RUN` when no runtime source changed. For any PR touching `js/editor.js` or Editor runtime helpers, browser smoke should be run on a deployed preview or fixed test slot.

---

## 4. Login and route gate

| Check | Expected result | Status |
| --- | --- | --- |
| Protected Editor route redirects unauthenticated users safely | Login/auth gate appears without console fatal error | PASS/FAIL/NOT_VERIFIED |
| Login succeeds with a safe test account | User reaches an authenticated state | PASS/FAIL/NOT_VERIFIED |
| `/pages/editor.html` opens after login | Editor shell loads without fatal startup exception | PASS/FAIL/NOT_VERIFIED |
| Same-origin `/api` path remains in use where visible | No unexpected cross-origin API rewrite | PASS/FAIL/NOT_VERIFIED |
| Browser console contains no fatal startup error | Warnings may be noted, fatal errors fail the smoke | PASS/FAIL/NOT_VERIFIED |

---

## 5. Editor shell startup gate

| Check | Expected result | Status |
| --- | --- | --- |
| Shell root elements are present | Main Editor shell mounts | PASS/FAIL/NOT_VERIFIED |
| Shell copy/i18n appears | Labels and empty-state text render without raw fallback keys | PASS/FAIL/NOT_VERIFIED |
| Toast fallback still works when triggered by existing UI path | Toast appears or safe fallback path remains silent without crash | PASS/FAIL/NOT_VERIFIED |
| Base path / redirect helper behavior is stable | No malformed redirect path or broken navigation loop | PASS/FAIL/NOT_VERIFIED |
| Loading state exits or safe empty state appears | User is not left in a permanent spinner | PASS/FAIL/NOT_VERIFIED |

---

## 6. Selected tree and memory handoff gate

| Check | Expected result | Status |
| --- | --- | --- |
| Tree list or selected tree state loads | Existing tree context appears, or safe empty state appears | PASS/FAIL/NOT_VERIFIED |
| Selected tree handoff is stable | No unexpected reset between page load and first render | PASS/FAIL/NOT_VERIFIED |
| Current memory selection initializes | Detail/sidebar state agrees with selected memory or safe empty state | PASS/FAIL/NOT_VERIFIED |
| Legacy browser globals remain available where required | No missing `window.*` runtime exception for existing Editor path | PASS/FAIL/NOT_VERIFIED |
| Private identifiers are not pasted into the report | Only safe PASS/FAIL labels are recorded | PASS/FAIL/NOT_VERIFIED |

---

## 7. Canvas and detail initialization gate

This section observes the existing behavior only. It must not be used to alter `editor-canvas.js`, `initCanvas`, pan/drag lifecycle, or visual rendering rules.

| Check | Expected result | Status |
| --- | --- | --- |
| Canvas initialization path runs | Canvas appears, or approved safe empty canvas state appears | PASS/FAIL/NOT_VERIFIED |
| No pan/drag lifecycle regression is observed | Existing drag/pan interaction does not throw a fatal error | PASS/FAIL/NOT_VERIFIED |
| Detail panel initializes | Current memory detail or safe empty detail state appears | PASS/FAIL/NOT_VERIFIED |
| Sidebar/status summary initializes | Existing summary/status area renders without fatal error | PASS/FAIL/NOT_VERIFIED |
| Mobile 375px layout is usable | No startup-blocking overlay or inaccessible shell state | PASS/FAIL/NOT_VERIFIED |

---

## 8. Existing action wiring smoke

Run only actions that are safe for the current test account and environment.

| Check | Expected result | Status |
| --- | --- | --- |
| Add/open interaction path is still wired where applicable | Existing UI action responds without fatal error | PASS/FAIL/NOT_APPLICABLE/NOT_VERIFIED |
| Edit/save path is still wired where applicable | Safe test edit path behaves as before | PASS/FAIL/NOT_APPLICABLE/NOT_VERIFIED |
| Cancel/back/navigation path is stable | Navigation returns to the expected Editor state | PASS/FAIL/NOT_APPLICABLE/NOT_VERIFIED |
| Error toast/degraded state path is safe where applicable | Existing error surface does not expose private payloads | PASS/FAIL/NOT_APPLICABLE/NOT_VERIFIED |

Do not create production user data solely for this checklist unless the PR already has an approved seeded-data test plan.

---

## 9. Report template

Use this short report in PR comments or issue comments:

```text
[Editor Browser Smoke - #1698]
PR:
Head SHA:
Preview/test URL:
Deployed SHA match: YES/NO/NOT_VERIFIED
Static checks: PASS/FAIL/NOT_RUN
Forbidden scope touched: NO/YES
Auth gate: PASS/FAIL/NOT_VERIFIED
Editor route startup: PASS/FAIL/NOT_VERIFIED
Shell copy/i18n: PASS/FAIL/NOT_VERIFIED
Toast fallback path: PASS/FAIL/NOT_VERIFIED
Selected tree handoff: PASS/FAIL/NOT_VERIFIED
Current memory/detail init: PASS/FAIL/NOT_VERIFIED
Canvas init or safe empty state: PASS/FAIL/NOT_VERIFIED
Pan/drag fatal error: NO/YES/NOT_VERIFIED
Action wiring smoke: PASS/PARTIAL/NOT_APPLICABLE/NOT_VERIFIED
Desktop smoke: PASS/FAIL/NOT_VERIFIED
Mobile 375px smoke: PASS/FAIL/NOT_VERIFIED
Console fatal errors: NONE/PRESENT/NOT_VERIFIED
Network fatal errors: NONE/PRESENT/NOT_VERIFIED
Private payload exposure: NO/YES
Secret exposure: NO/YES
#1698 state after comment: OPEN
Judgment: PASS/PARTIAL/BLOCKED/FAIL
```

Keep the report factual. If browser smoke is blocked by preview deployment, auth setup, or seeded-data access, mark it as `BLOCKED` or `NOT_VERIFIED` instead of inferring a pass from contract tests alone.
