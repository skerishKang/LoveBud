# Local Browser Verification Startup

**Status:** Active startup runbook  
**Owner:** CTO / Ops Lead  
**Scope:** Local browser verification, browser smoke, PR Preview checks, fixed test slot checks, and local-only visual checks

---

## 1. Purpose

This document is the startup contract for any LoveBud local/browser verifier.

Use it before starting browser verification work, regardless of whether the executor is a local browser, Playwright/MCP browser runner, manual browser verifier, or local ops verifier.

This document defines common preflight, URL provenance, smoke scope, evidence rules, PR checklist rules, and reporting standards. Task-specific PR number, issue number, branch name, head SHA, preview URL, fixed slot assignment, and merge instruction must be supplied separately by the CTO or responsible lead.

This document intentionally does not contain task-specific PR numbers, branch SHAs, current fixed-slot occupancy, merge commands, or one-off status notes.

---

## 2. Required companion documents

Read these together when the task involves browser or local verification:

- [BROWSER_VERIFICATION_URL_POLICY.md](BROWSER_VERIFICATION_URL_POLICY.md) — URL provenance rules for PR Preview, Branch Preview, fixed slots, production, and local verification.
- [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md) — fixed test slot ownership, Local/Ops role boundaries, evidence hygiene, slot update and restore procedures.
- [PR_CHECKLIST.md](PR_CHECKLIST.md) — PR readiness and verification checklist.
- [RUNBOOK.md](RUNBOOK.md) — operational recovery and incident handling.
- [../engineering/CSS_ARCHITECTURE.md](../engineering/CSS_ARCHITECTURE.md) — CSS import hub, split ownership, and visual verification guidance for stylesheet changes.

When a task-specific instruction conflicts with these documents, follow the task-specific instruction only if it is explicit and narrower. Do not infer exceptions.

---

## 3. Startup rules

A local/browser verifier must start with these rules:

- Do not modify code unless the task explicitly assigns implementation work.
- Do not push to `main`.
- Do not merge.
- Do not close issues.
- Do not delete branches.
- Do not force push except for a CTO-assigned fixed test slot update that explicitly allows `--force-with-lease`.
- Do not use guessed preview URLs.
- Do not use another PR's preview URL.
- Do not use a fixed test slot unless CTO assigns that slot to the current PR/task.
- Do not mutate production data.
- Do not expose tokens, cookies, passwords, Authorization headers, raw Firebase credentials, or private content in evidence.
- Do not modify PR #7 or prototype/reference/demo/variant paths.

If a local working tree is dirty before the task begins, stop and report `BLOCKED`. Do not run restore/reset/stash/clean unless the CTO explicitly approves that recovery operation.

---

## 4. Git preflight

Unless the task says otherwise, run the following before verification:

```bash
git fetch origin
git checkout <assigned-branch>
git status --short
git rev-parse HEAD
```

If a target SHA is provided, verify it:

```bash
git rev-parse HEAD
# must match the CTO-provided expected head SHA
```

For diff verification:

```bash
git diff --check origin/main...HEAD
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
```

For CSS extraction or import hub work, additionally check the relevant import hub and moved selector/module boundaries. Use task-specific file paths.

If `git diff --check` fails, report the exact failure and do not mark the PR ready until corrected by an authorized implementation executor.

---

## 5. URL source rules

Browser verification is valid only when the URL source is valid.

Allowed URL sources:

1. A URL explicitly provided by CTO in the task prompt.
2. A current PR Preview URL copied from the current PR's actual GitHub/Cloudflare deployment status.
3. A fixed test slot explicitly assigned by CTO to the current PR/task.
4. `localhost` only when the task allows local verification or when the result is clearly reported as `LOCAL_ONLY`.

Forbidden URL sources:

- guessed branch-preview URL;
- previous PR preview URL;
- closed or superseded PR preview URL;
- preview URL from another PR;
- unassigned fixed test slot;
- production URL unless CTO requests production verification;
- any URL whose provenance is unclear.

Localhost verification is useful for early visual smoke, but it is not final PASS for Browse/Search/API/Auth/data-loaded flows unless the task explicitly accepts local-only verification.

---

## 6. Verification target selection

Use the narrowest target that satisfies the task.

| Work type | Preferred target | Notes |
| --- | --- | --- |
| Static public visual smoke | Current PR Preview or CTO-provided URL | Localhost may be `LOCAL_ONLY`. |
| CSS split/import verification | Current PR Preview or local + current PR Preview | Check stylesheet network status and page rendering. |
| Browse/Search with data load | CTO-assigned fixed slot or approved Cloudflare Preview | Local static server alone is not final PASS. |
| Login/Auth/protected page | CTO-assigned fixed slot | Do not final-PASS from arbitrary PR Preview. |
| API/runtime route smoke | CTO-assigned fixed slot or production-equivalent preview | Record endpoint status and response class. |
| Docs-only PR | GitHub metadata usually sufficient | Browser verification not required unless docs rendering is in scope. |

---

## 7. Browser smoke baseline

Unless the task narrows the scope, browser smoke should check:

- page renders without fatal blank state;
- expected state appears;
- no horizontal overflow;
- no fatal console error;
- no new network blocker;
- required CSS files load with 2xx or equivalent successful status;
- desktop viewport and mobile viewport if requested;
- reduced-motion behavior if motion/reveal is touched;
- no unauthorized data mutation.

For CSS split/import work, include:

- import added to the correct hub;
- moved selectors present in the new module;
- moved selectors removed from the old file;
- no missing CSS import or 404;
- relevant page state still renders correctly;
- visual smoke for the page owning the stylesheet.

For empty/error/loading states, verify the state requested by the task. If a state is difficult to force safely, report it as `not verified`, not PASS.

---

## 8. Console and network rules

Console evidence:

- Record new fatal errors as blockers.
- Distinguish known warnings from new blockers.
- Do not classify browser extension noise as app failure unless isolated.
- Include source file and line number when available.

Network evidence:

- Record method, endpoint/path, status, and high-level response class.
- For CSS split work, confirm new stylesheet requests do not 404.
- Do not include raw Authorization headers, cookies, tokens, Firebase credentials, or full private payloads.
- Report `NO MUTATIONS` unless the task explicitly approved disposable test data mutation.

---

## 9. Evidence hygiene

Evidence must be useful, minimal, and safe to share.

Required evidence fields:

```text
- URL used:
- URL type: local / PR Preview / Branch Preview / fixed test slot / production
- URL source: CTO-provided / GitHub-Cloudflare confirmed / fixed slot assigned / local
- PR number matched to URL: yes/no/not applicable
- Viewport(s):
- Target branch:
- Target SHA:
- Console result:
- Network result:
- UI result:
- Data mutation: NO MUTATIONS / approved disposable mutation
- Missing checks:
- Final judgment: PASS / PARTIAL / BLOCKED / FAIL / LOCAL_ONLY
```

Redact:

- email addresses when not necessary;
- account names;
- private tree titles or memories;
- tokens, cookies, passwords, Authorization headers, Firebase credentials;
- unrelated browser tabs and password manager UI.

---

## 10. PR body checklist update rules

Only update a PR verification checklist after the verification actually ran.

Allowed:

- Mark `git diff --check` as complete only after it passes.
- Mark changed-file scope as complete only after `git diff --name-only origin/main...HEAD` or GitHub compare confirms it.
- Mark browser smoke as complete only after rendered browser verification ran on an allowed URL source.
- Mark local browser smoke as local only when it used `localhost`.

Forbidden:

- Do not mark browser smoke PASS from GitHub metadata alone.
- Do not mark Cloudflare Preview smoke PASS from preview URL existence alone.
- Do not mark Auth/API/data-loaded flows PASS from local static server alone.
- Do not mark unresolved or unforced states as verified.

Use precise labels:

- `PASS` — required observations completed, no blocker found.
- `PARTIAL` — some required observations completed, others missing.
- `BLOCKED` — verification could not proceed.
- `FAIL` — observed behavior violates expected result.
- `LOCAL_ONLY` — local browser check completed but production-equivalent verification remains pending.

---

## 11. Ready, merge, and issue state rules

- Draft to ready transition requires CTO instruction or explicit task authorization.
- Merge requires CTO approval and expected head SHA confirmation.
- Issue close requires explicit instruction and correct close keyword hygiene.
- Use `Refs #<issue>` unless the task explicitly authorizes `Fixes`, `Closes`, or `Resolves`.
- Do not close parent tracking issues when only one phase or one backlog item is complete.

---

## 12. Local browser procedure template

Use this generic flow when local browser verification is allowed:

```bash
git fetch origin
git checkout <assigned-branch>
git status --short
git rev-parse HEAD
git diff --check origin/main...HEAD
git diff --name-only origin/main...HEAD
python -m http.server 8080
```

Open the task-specified page, for example:

```text
http://localhost:8080/pages/search.html
```

Then verify the task-specific UI states, console, network, and overflow.

Report local results as `LOCAL_ONLY` unless the task explicitly says local verification is sufficient.

---

## 13. Browser verification report template

```text
[Browser Verification Report]
1. Computer/model:
2. Branch:
3. HEAD SHA:
4. URL used:
5. URL type:
6. URL source:
7. PR number matched to URL:
8. CTO-assigned fixed slot:
9. Viewports checked:
10. Static checks:
11. UI state checks:
12. CSS/network checks:
13. Console result:
14. Network/API result:
15. Horizontal overflow:
16. Data mutation:
17. PR body updated:
18. Issue close 여부:
19. Merge 여부:
20. Missing checks:
21. Final judgment: PASS / PARTIAL / BLOCKED / FAIL / LOCAL_ONLY
```

---

## 14. One-line rule

```text
Start every browser/local verification by confirming branch, SHA, diff scope, URL provenance, and evidence rules; never turn guessed URLs, local-only checks, or GitHub metadata into final browser PASS.
```
