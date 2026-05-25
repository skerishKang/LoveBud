# CSP Report-Only Smoke Classification

**Status:** Active smoke guidance  
**Issue:** #1629  
**Scope:** Browser smoke wording and CSP Report-Only result classification

---

## 1. Purpose

This document defines how LoveBud should classify browser smoke output while the project uses a `Content-Security-Policy-Report-Only` header.

Report-only CSP findings are useful hardening signals, but they are not the same class of failure as fatal runtime errors or API failures. This distinction is important before any future move from report-only CSP to enforcing CSP.

---

## 2. Current CSP policy source

The active CSP Report-Only policy is configured in the repository root `_headers` file.

The current policy is intentionally report-only. Do not treat it as an enforcing production CSP.

---

## 3. Required smoke wording

Browser smoke reports that involve CSP must classify output into these categories:

```text
Browser smoke:
- App runtime fatal error: NONE / PRESENT
- API failure: NONE / PRESENT / BLOCKED_BY_ENVIRONMENT
- CSP report-only violations: NONE / PRESENT
- Functional blocker: NONE / PRESENT / NOT_OBSERVED_BECAUSE_REPORT_ONLY
```

When CSP report-only violations are present, list only the high-level directive/origin class. Do not print private payloads, cookies, tokens, Authorization headers, Firebase credential material, or user content.

Example:

```text
CSP report-only violations: PRESENT
- script-src report-only signal for apis.google.com
- frame-src report-only signal for relovetree.firebaseapp.com
Functional blocker: not observed because policy is report-only
```

---

## 4. Classification rules

| Signal | Classification | Merge impact |
| --- | --- | --- |
| Fatal uncaught browser exception on a changed route | PR blocker | Fix before merge. |
| App blank state caused by the PR | PR blocker | Fix before merge. |
| Same-origin `/api/*` failure caused by the PR | PR blocker | Fix before merge. |
| Modal/upstream outage unrelated to the PR | Environment blocker | Report `BLOCKED`, do not call the PR PASS. |
| CSP Report-Only violation with no broken function | Hardening signal | Record and split into a follow-up if needed. |
| CSP Report-Only violation that would break required runtime if enforced | Future enforcement blocker | Keep report-only and tune allowlist or code before enforcement. |
| Enforcing `Content-Security-Policy` violation | PR blocker | Do not merge until resolved. |
| Missing or unverified Cloudflare Preview header for `_headers` PR | Verification blocker | Do not mark final PASS until a deployed header is confirmed. |

---

## 5. Firebase Auth report-only origins

Firebase/Auth browser smoke should confirm whether these origins appear in the report-only policy after PR #1641:

```text
script-src includes https://apis.google.com
frame-src includes https://relovetree.firebaseapp.com
```

If these origins are present in the deployed `Content-Security-Policy-Report-Only` header and the page has no fatal runtime error, the prior Firebase/Auth report-only signals should be treated as addressed for this narrow slice.

Any remaining Firebase/Auth CSP report-only signal should be recorded as a new origin/directive finding and handled as a later narrow follow-up, not mixed into unrelated UI or auth refactors.

---

## 6. `upgrade-insecure-requests` handling

Browsers may report that `upgrade-insecure-requests` is ignored when delivered in a report-only policy. Treat this as a policy-design signal, not as an app runtime blocker.

Current decision:

- Do not move to enforcing CSP yet.
- Do not make a broad CSP rewrite only to address this message.
- Keep this as a tracked #1629 follow-up decision until report-only smoke is otherwise clean.

Future decision options:

1. Keep `upgrade-insecure-requests` only for a future enforcing CSP.
2. Remove it from report-only policy if it creates recurring noise.
3. Document it as accepted report-only noise until CSP enforcement planning begins.

Any change to this directive should be a tiny `_headers`-only PR with deployed-header verification.

---

## 7. Merge-readiness wording for CSP PRs

For a CSP Report-Only PR, use this reporting format:

```text
PR state:
mergeable:
head SHA:
changed files:
local validation:
CI/checks:
Cloudflare Preview URL:
CSP Report-Only header present:
Enforcing CSP present:
Expected origin/directive delta present:
Fatal runtime error:
API failure:
CSP report-only violations:
Recommendation: merge ready / hold / blocked
```

A CSP Report-Only PR can be merge-ready when:

- the diff is narrow and reviewed;
- CI/local validation passes;
- no enforcing CSP is introduced unintentionally;
- the deployed header is confirmed when the PR changes `_headers`, or the verification gap is explicitly accepted by the CTO;
- any remaining report-only violation is classified as a hardening signal rather than a functional blocker.

---

## 8. Do not do in this issue

- Do not move to enforcing CSP.
- Do not remove `style-src 'unsafe-inline'` as part of Firebase/Auth origin tuning.
- Do not narrow `connect-src https:` until runtime Network-panel origin inventory is complete.
- Do not combine CSP policy changes with UI, Auth, Search, Detail, Editor, or API refactors.
- Do not close #1629 until remaining report-only wording and policy-source decisions are explicitly reviewed.
