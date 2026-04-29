# Browser Verification Agent Entrypoint

> **Status:** operational entrypoint  
> **Scope:** browser/Auth/data-loaded verification only  
> **Primary reader:** new agent/new session assigned to browser verification

This document is the browser verification entrypoint that should be linked from `AGENTS.md`.

A new browser verification agent should be able to read this document, the target PR, and the PR-specific browser verification entrypoint comment, then run the verification without reconstructing context from prior chat.

---

## 1. Core rule

Browser verification is not a guessing task.

The verifier must not invent or infer:

- test slot URL
- Cloudflare Preview URL
- production URL applicability
- credential location
- account values
- ready/merge authority

If a required value is missing, the result is `BLOCKED`, not guessed.

---

## 2. Required starting order

For browser/Auth/data-loaded verification, read in this order:

1. `AGENTS.md`
2. This document: `docs/ops/AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md`
3. The target PR body
4. The PR comment titled or clearly marked `Browser verification entrypoint`
5. Relevant URL policy docs only if the entrypoint references them:
   - `docs/ops/BROWSER_VERIFICATION_URL_POLICY.md`
   - `docs/ops/TEST_PREVIEW_SLOTS.md`
   - `docs/ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md`
6. Credential policy docs only if the page is Auth-gated:
   - `docs/ops/QA_CREDENTIALS.md`

Do not scan unrelated docs unless a blocker requires it.

---

## 3. PR-specific entrypoint comment is required

Every Auth/API/data-loaded browser verification PR should have a PR comment with this information:

```text
Browser verification entrypoint

PR: #<number>
Assigned URL: <Cloudflare PR Preview or fixed test slot>
URL provenance: <who assigned it and why it is valid>
Page(s): <page paths>
Credential source state: <not needed | .local/test-accounts.json exists | restored from temporary handoff | restored from persistent bundle>
Account type: <Internal QA User | Internal QA Admin | not needed>
Final PASS allowed from local server: NO for Auth/API/data-loaded pages
Ready transition allowed: <YES/NO>
Merge allowed: NO unless explicitly CTO-approved
```

If this comment is missing for an Auth/API/data-loaded page, report:

```text
Final status: BLOCKED — missing Browser verification entrypoint comment
```

---

## 4. URL rules

### Valid final PASS URLs

Use only one of these for final browser PASS:

1. CTO-assigned Cloudflare Pages PR Preview URL
2. CTO-assigned fixed test slot, for example:
   - `https://test1.lovebud.pages.dev`
   - `https://test2.lovebud.pages.dev`
   - `https://test3.lovebud.pages.dev`
   - `https://test4.lovebud.pages.dev`
   - `https://test5.lovebud.pages.dev`
   - `https://test6.lovebud.pages.dev`
3. Production URL only after the PR is merged and deployed

### Invalid final PASS URLs

Do not use these as final PASS for Auth/API/data-loaded pages:

- local static server
- guessed Cloudflare URL
- production URL before merge
- stale test slot with unknown branch/SHA
- any URL whose provenance is not documented

Local server may be recorded as partial smoke only.

---

## 5. Credential prerequisite for Auth-gated pages

For Auth-gated pages, the verifier must confirm the credential source state before testing.

Allowed credential source states:

- `not needed`
- `pre-existing local .local/test-accounts.json`
- `restored from temporary handoff`
- `restored from persistent encrypted bundle`

For `.local/test-accounts.json`, verify:

```text
file exists: YES
JSON valid: YES
account slots count: 10
git tracked: NO
secret values exposed: NO
```

Never print or report:

- password values
- token values
- cookie/session values
- credential file contents
- ZIP password
- account secrets

Report only the credential source state and account type used.

---

## 6. Standard verification checks

For any Auth/API/data-loaded page, include these checks:

1. Assigned URL loads
2. URL provenance recorded
3. Login succeeds if required
4. Target page loads after login
5. Loading state behaves normally
6. Expected empty/content/error state appears
7. Main changed UI behavior works
8. Console has no fatal error
9. Network has no new API blocker
10. No obvious horizontal overflow
11. Credential values were not exposed

For My Trees verification, also check:

- `/pages/my-trees.html` loads after login
- loading/empty/content/error state renders
- manage summary visible/hidden behavior works
- classList/CSS-state display behavior is stable

---

## 7. Automatic vs manual browser verification

Automation is preferred only when it is stable.

If automation fails because of tool/session/driver issues, the verifier may switch to manual browser verification on the assigned Cloudflare/test-slot URL.

Manual verification must still report:

- URL
- URL provenance
- account type used
- exact checked states
- console fatal error status
- network blocker status
- horizontal overflow status

Do not mark an automation-tool failure as app failure unless the app behavior itself is confirmed broken.

---

## 8. Report format

Use this report format for browser verification:

```text
1. computer/model
2. PR number
3. branch
4. verification URL
5. URL provenance
6. credential source state
7. account type used
8. local server used: YES/NO
9. final PASS environment: Cloudflare PR Preview / fixed test slot / production-after-merge
10. target page initial load result
11. loading/empty/content/error state result
12. changed UI behavior result
13. console fatal error: YES/NO
14. network/API blocker: YES/NO
15. horizontal overflow: YES/NO
16. secret values exposed: NO
17. PR body checklist updated: YES/NO
18. ready transition: YES/NO
19. merge performed: NO unless explicitly CTO-approved
20. issue close status: NO unless explicitly CTO-approved
21. Final status: PASS / PARTIAL / BLOCKED / FAIL
```

---

## 9. Ready and merge authority

Browser verifiers do not infer ready or merge authority.

- Ready transition requires explicit task instruction.
- Merge requires explicit CTO merge approval.
- Issues remain open unless explicit close approval is given.
- PR #7 and prototype/reference/demo/variant paths are never modified or closed during verification.

---

## 10. Blocker taxonomy

Use these final statuses consistently:

### PASS
All required checks passed on valid final PASS environment.

### PARTIAL
Some checks passed, but at least one required final PASS condition is missing.

Examples:
- local-only smoke passed but test slot not checked
- login worked but content state was not verified

### BLOCKED
Verification cannot proceed because prerequisite information or access is missing.

Examples:
- no assigned URL
- missing Browser verification entrypoint comment
- missing credential source
- credential file absent
- test slot branch/SHA provenance unknown

### FAIL
The app behavior itself failed on a valid final PASS environment.

Examples:
- login fails with valid QA credential
- page fatal blank
- target JS fatal error
- required UI state no longer renders

---

## 11. PR-specific entrypoint template

Use this template as a PR comment before assigning a new browser verifier:

```markdown
## Browser verification entrypoint

PR: #<number>  
Branch: `<branch>`  
Assigned URL: `<url>`  
URL provenance: `<Cloudflare PR Preview / fixed test slot assignment / production after merge>`  
Target pages:
- `<path>`

Credential source state:
- `<not needed | pre-existing local .local/test-accounts.json | restored from temporary handoff | restored from persistent encrypted bundle>`

Account type:
- `<Internal QA User | Internal QA Admin | not needed>`

Final PASS rules:
- Local static server final PASS: NO for Auth/API/data-loaded pages.
- Use only the assigned URL above.

Checks:
- [ ] login succeeds if required
- [ ] target page loads
- [ ] loading/empty/content/error state renders
- [ ] changed UI behavior works
- [ ] no fatal console error
- [ ] no network/API blocker
- [ ] no horizontal overflow
- [ ] secret values exposed: NO

Restrictions:
- Do not modify files.
- Do not mark ready unless explicitly instructed.
- Do not merge.
- Do not close issues.
- Do not touch PR #7 or prototype/reference/demo/variant paths.
```

---

## 12. Minimal My Trees example

For a My Trees PR such as PR #350, the entrypoint should specify:

```text
Page: /pages/my-trees.html
Credential source state: pre-existing local .local/test-accounts.json or restored from handoff/bundle
Account type: Internal QA User
Final PASS URL: assigned fixed test slot or Cloudflare PR Preview
Local server final PASS: NO
```

Checks:

- login succeeds
- My Trees page loads after login
- loading/empty/content/error state appears
- manage summary visible/hidden behavior works
- classList display state behavior is stable
- console fatal error is absent
- network/API blocker is absent
- horizontal overflow is absent
