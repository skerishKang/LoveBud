# Cloudflare Preview Provenance Runbook

> **Disposition:** `NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT` for agent-governance blocker/approval interpretations.
> Canonical agent-governance authority: `docs/ops/MVP_AGENT_GOVERNANCE.md` (owner-approved #3442 comment `4947327550`).
> This Issue #668 runbook's CTO-assigned-fixed-slot gate and production/localhost-as-pre-merge-proof ban are retained only within the URL-provenance context named here and are **not** repo-wide automatic-blocker authority. Under canonical policy, production, PR preview, localhost, and fixed slot are allowed by default and fixed-slot absence / CTO-assigned URL are advisory, not blockers. SHA-provenance reporting guidance is preserved.

**Status:** Active ops runbook  
**Owner:** CTO / Ops Lead  
**Related issue:** #668

This runbook defines how operators should identify valid Cloudflare Preview URLs and fixed test slot URLs for LoveBud browser verification.

The goal is to prevent browser reports from using guessed branch-name URLs, stale preview URLs, malformed/truncated preview URLs, production `/pull/<number>` paths, or fixed slots whose deployed SHA does not match the target PR.

---

## 1. Core rule

A browser verification URL is valid only when the operator can prove where it came from and what commit it serves.

Allowed provenance:

```text
CTO-provided URL
GitHub PR check/deployment URL tied to the current PR
Cloudflare deployment metadata tied to the current PR/ref
CTO-assigned fixed test slot with deployed SHA confirmation
```

Forbidden provenance:

```text
branch-name URL guessed by the operator
truncated or ellipsized URL copied from UI text
preview URL from another PR
closed or superseded PR preview URL
production URL used as pre-merge PR proof
fixed slot with unknown or mismatched SHA
```

---

## 2. URL classes

### 2.1 PR Preview URL

A PR Preview URL is acceptable only when GitHub or Cloudflare metadata ties the URL to the current PR and head SHA.

Required report fields:

```text
URL type: PR Preview
URL source: GitHub PR check / Cloudflare deployment metadata / CTO-provided
PR number matched: YES
PR head SHA:
Deployed SHA:
SHA match: YES/NO
```

### 2.2 Branch Preview URL

A Branch Preview URL is acceptable only when metadata confirms the branch and deployed SHA. Do not derive it from the branch name.

Required report fields:

```text
URL type: Branch Preview
URL source: Cloudflare deployment metadata / CTO-provided
Branch matched: YES
Branch name:
Expected SHA:
Deployed SHA:
SHA match: YES/NO
Guessed URL used: NO
```

### 2.3 Deployment ID URL

A deployment-specific URL can be useful for static/public smoke only if the deployment metadata proves the SHA. It is not a fixed slot.

Required report fields:

```text
URL type: Deployment ID URL
Deployment metadata available: YES
Expected SHA:
Deployed SHA:
SHA match: YES/NO
Fixed slot: NO
```

### 2.4 Fixed test slot URL

A fixed test slot is acceptable only when CTO assigns it to the target PR/ref and the deployed SHA or marker evidence matches.

Required report fields:

```text
URL type: fixed test slot
Slot name: test1/test2/test3/test4/test5/test6/test7/test8/test9/test10
Slot URL:
Assigned by CTO: YES
Expected SHA:
Deployed SHA:
SHA match: YES/NO
Fresh asset or marker check: PASS/FAIL/NOT_RUN
```

---

## 3. How to handle malformed or truncated URLs

Do not repair truncated UI text by guessing the missing suffix.

If a Cloudflare Pages comment, UI chip, or screenshot shows an ellipsized URL, report:

```text
PREVIEW_URL_MALFORMED_OR_TRUNCATED
Browser verification: BLOCKED
Guessed URL used: NO
```

Then use one of these paths:

1. open the full link target from the GitHub check/deployment details;
2. ask a browser-capable executor to copy the link href, not the visible text;
3. use Cloudflare deployment metadata;
4. deploy to a CTO-assigned fixed test slot.

---

## 4. Fixed slot binding inventory

For a fixed slot verification, record this inventory before opening the browser:

```text
[Fixed Slot Binding]
Slot:
Slot URL:
Target PR:
Target branch:
Expected PR head SHA:
Current slot branch/ref:
Deployed SHA:
SHA match: YES/NO
Cloudflare deployment status: SUCCESS/FAILED/UNKNOWN
Fresh marker path:
Fresh marker expected text:
Fresh marker result: PASS/FAIL/NOT_RUN
Login-capable: YES/NO/NOT_REQUIRED
Browser verification allowed: YES/NO
```

If `SHA match` is not `YES`, do not run final browser verification.

---

## 5. Valid fixed slot deployment methods

Allowed methods:

```text
Deploy fixed test slot workflow
Wrangler direct deploy runbook
CTO-approved Cloudflare dashboard operation
```

For each method, the operator must still verify the served content after deployment.

A successful branch push alone is not final proof. A successful Cloudflare build alone is not final proof. Final proof requires slot URL content or metadata evidence tied to the expected SHA.

---

## 6. Browser verification separation

Slot deployment and browser verification are separate tasks.

Deployment task result examples:

```text
FIXED_SLOT_DEPLOYED
FIXED_SLOT_DEPLOY_BLOCKED
SHA_MATCH_CONFIRMED
FRESH_ASSET_PRESENT
```

Browser task result examples:

```text
BROWSER_RUNTIME_VERIFIED
BROWSER_PARTIAL
BROWSER_BLOCKED_AUTH
BROWSER_BLOCKED_NO_TEST_DATA
BROWSER_FAIL
```

Do not combine them into one unreviewable report unless CTO explicitly asks for a combined run.

---

## 7. Auth/API-dependent surfaces

The following surfaces require fixed slot or otherwise CTO-approved deployed runtime verification before final PASS:

```text
Login/Auth
My Trees
Browse/Search with API-backed selected hub or copy/import behavior
Editor
Detail when API-backed route/data behavior is under review
Modal/API-backed reads or writes
create/update/delete flows
user-specific state
```

Localhost and production are not valid pre-merge final proof for those surfaces.

---

## 8. Safe status labels

Use status labels, not private values:

```text
URL_PROVENANCE_CONFIRMED
URL_PROVENANCE_BLOCKED
SHA_MATCH_CONFIRMED
SHA_MISMATCH
FRESH_ASSET_PRESENT
FRESH_ASSET_MISSING
PREVIEW_URL_MALFORMED_OR_TRUNCATED
FIXED_SLOT_DEPLOYED
BROWSER_VERIFICATION_NOT_STARTED
BROWSER_RUNTIME_VERIFIED
BROWSER_BLOCKED
```

Never print credentials, tokens, sessions, cookies, account IDs, DB URLs, tree IDs, owner IDs, memory IDs, copied tree IDs, raw API payloads, or DB row values.

---

## 9. Report template

```text
[Cloudflare Preview / Fixed Slot Provenance Report]
1. Target PR:
2. Target branch:
3. Expected head SHA:
4. URL used:
5. URL type:
6. URL source:
7. URL guessed from branch name: NO
8. PR/branch matched to URL: YES/NO
9. Deployed SHA:
10. SHA match:
11. Fixed slot assigned by CTO: YES/NO/NOT_APPLICABLE
12. Fixed slot name:
13. Fresh marker path/text:
14. Fresh marker result:
15. Login required:
16. Browser verification allowed:
17. Secret/private ID exposure: NO
18. Final judgment: URL_PROVENANCE_CONFIRMED / URL_PROVENANCE_BLOCKED
```

---

## 10. Relationship to Issue #668

Issue #668 should remain open until the team can consistently produce verified URLs or fixed slots for active UI/runtime PRs without guessing. This runbook defines the provenance rules and reporting format, but does not itself fix Cloudflare comment publication or configure any fixed slot.
