# Fixed Slot Workflow Secret Setup

**Status:** Active ops runbook
**Owner:** CTO / Ops Lead
**Related issue:** #684
**Related workflow:** `.github/workflows/deploy-test-slot.yml`

This runbook explains the repository secret setup and safe verification process for the `Deploy fixed test slot` workflow.

The workflow exists on `main` and can be manually dispatched. A post-merge smoke run already proved that the workflow can dispatch, validate input, check out the requested SHA, run `npm run verify`, run `npm test`, and fail safely when Cloudflare deployment secrets are missing.

The remaining blocker is secret configuration, not workflow syntax.

---

## 1. Required GitHub Actions secrets

The workflow expects these repository secrets by name:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Only the names may be reported. Never print, paste, screenshot, or echo the secret values.

### 1.1 Required token capability

The token must be able to deploy to the LoveBud Cloudflare Pages project used by fixed slots.

Minimum expected capability:

```text
Cloudflare Pages deployment write access for the LoveBud Pages project
Account/project access sufficient for wrangler pages deploy
```

Prefer least privilege. Do not use a broad personal/global token if a narrower Cloudflare API token can deploy the Pages project.

---

## 2. Secret setup path

Use GitHub repository settings or GitHub CLI with value entry through a secure local environment.

Allowed reporting:

```text
CLOUDFLARE_API_TOKEN: PRESENT/MISSING
CLOUDFLARE_ACCOUNT_ID: PRESENT/MISSING
Secret value exposed: NO
```

Forbidden reporting:

```text
actual token value
partial token prefix/suffix
account id value
copied CLI command that includes a secret literal
terminal output that prints the secret
screenshot containing a secret value
```

---

## 3. First rerun after secrets are configured

After the required secrets are configured, rerun the workflow manually.

Recommended safe input:

```text
ref: main
expected_sha: <current main commit SHA>
slot: test10
marker_path: .github/workflows/deploy-test-slot.yml
marker_text: Deploy fixed test slot
```

Use the current `main` SHA at the time of the run. Do not reuse an old SHA unless the workflow is intentionally testing an old ref.

Expected successful flow:

```text
manual dispatch: YES
fixed slot validation: PASS
checked-out SHA equals expected SHA: YES
npm run verify: PASS
npm test: PASS
Cloudflare secrets configured: PRESENT
wrangler pages deploy: PASS
fixed slot URL check: PASS
marker check: PASS
production deploy performed: NO
secret values exposed: NO
```

---

## 4. Failure classification

Use these states precisely:

```text
WORKFLOW_RUNTIME_VERIFIED
PARTIAL_RUNTIME_VERIFIED / BLOCKED_BY_MISSING_CLOUDFLARE_SECRET
BLOCKED_BY_CLOUDFLARE_TOKEN_SCOPE
BLOCKED_BY_SHA_MISMATCH
BLOCKED_BY_STATIC_CHECK_FAILURE
BLOCKED_BY_TEST_FAILURE
BLOCKED_BY_DEPLOY_FAILURE
BLOCKED_BY_MARKER_MISMATCH
```

Do not call the workflow fully verified unless deploy and marker verification both run successfully.

---

## 5. Safe report template

Use this after each workflow run:

```text
[Fixed Slot Workflow Run Report]
1. Workflow:
2. Run URL:
3. Ref input:
4. Expected SHA input:
5. Checked-out SHA:
6. SHA match: YES/NO
7. Slot input:
8. Marker path/text:
9. npm run verify: PASS/FAIL/NOT_RUN
10. npm test: PASS/FAIL/NOT_RUN
11. Cloudflare secrets configured: PRESENT/MISSING
12. Deploy step: PASS/FAIL/NOT_RUN
13. Fixed slot URL:
14. Fixed slot URL check: PASS/FAIL/NOT_RUN
15. Marker check: PASS/FAIL/NOT_RUN
16. Production deploy performed: NO
17. Secret exposure: NO
18. Final judgment: WORKFLOW_RUNTIME_VERIFIED / PARTIAL / BLOCKED
```

---

## 6. Operational guardrails

- Manual dispatch only.
- Do not use the workflow to deploy production.
- Do not change production branch settings.
- Do not use the workflow for ready, merge, or issue close actions.
- Do not expose Cloudflare values, account IDs, tokens, cookies, sessions, credentials, DB URLs, tree IDs, owner IDs, memory IDs, copied tree IDs, or DB row values.
- Do not modify PR #7 or prototype/reference/demo/variant paths.
- Browser verification still remains separate after slot deployment.

---

## 7. Relationship to Issue #684

Issue #684 is not fully complete until:

- required Cloudflare secrets are configured;
- the workflow completes a real fixed slot deploy;
- the fixed slot URL check passes;
- marker verification passes;
- a safe workflow run report records the result.

The merged workflow plus this runbook establish the automation path. The remaining work is environment secret configuration and one successful deploy run.
