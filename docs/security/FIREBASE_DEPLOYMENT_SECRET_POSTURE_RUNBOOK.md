# Firebase and Deployment Secret Posture Runbook

**Status:** Active verification runbook  
**Owner:** CTO / Security-Ops  
**Related issue:** #266  
**Follow-up from:** #124

This runbook defines how to verify Firebase Console, Google Cloud, Modal, Cloudflare, and legacy deployment secret posture without exposing restricted values.

The repository audit concluded that Firebase Web client config is public-by-design and not a server secret by itself. The remaining security posture depends on Console/runtime settings that cannot be proven from committed code alone.

---

## 1. Non-negotiable reporting rule

Never print or paste these values in reports, PR bodies, issue comments, screenshots, terminal logs, or chat:

```text
service account JSON
private key
API token
session token
cookie
authorization header
password
DB URL
Firebase Admin credential
Cloudflare token
Modal secret value
Netlify secret value
tree id
owner id
memory id
copied tree id
DB row value
```

Use presence and status labels only.

Allowed labels:

```text
PRESENT
MISSING
EXPECTED_PUBLIC_IDENTIFIER
RESTRICTED
UNRESTRICTED
UNKNOWN
ACTIVE
INACTIVE
LEGACY_ONLY
ROTATION_REQUIRED
ROTATION_NOT_REQUIRED
NOT_VERIFIED
BLOCKED_NO_CONSOLE_ACCESS
```

---

## 2. Firebase Authorized Domains

Verify in Firebase Console:

```text
Firebase Console → Authentication → Settings → Authorized domains
```

Record only domain categories and unexpected-domain count. Do not copy full private/staging domains unless they are already public project domains.

Expected categories:

- active Cloudflare Pages production domain;
- assigned fixed test slot or preview domains when intentionally allowed;
- local development domains only when still required;
- legacy Vercel/Netlify domains only if explicitly retained for transition.

Report format:

```text
[Firebase Authorized Domains]
Active production domain: PRESENT/MISSING
Cloudflare test/preview domains: PRESENT/MISSING/NOT_REQUIRED
Local dev domain: PRESENT/MISSING/NOT_REQUIRED
Legacy Vercel domain: PRESENT/MISSING/LEGACY_ONLY
Legacy Netlify domain: PRESENT/MISSING/LEGACY_ONLY
Unexpected domains count: 0/N
Private domain values exposed: NO
Judgment: PASS / REVIEW_REQUIRED / BLOCKED
```

---

## 3. Firestore Security Rules

Verify in Firebase Console or exported rules review.

The expected posture is that rules do not allow broad anonymous write access and that owner/private/public visibility boundaries remain enforced. If data is no longer read directly from the browser and active data operations are proxied through Cloudflare/Modal, document that distinction rather than assuming Firestore is irrelevant.

Report only policy status. Do not paste complete private rules if they include project-only paths or comments with restricted details.

Report format:

```text
[Firestore Rules]
Rules reviewed: YES/NO
Anonymous broad write allowed: YES/NO/UNKNOWN
Owner boundary present: YES/NO/UNKNOWN
Public visibility boundary present: YES/NO/UNKNOWN
Admin/service-account path separated: YES/NO/UNKNOWN
Restricted values exposed: NO
Judgment: PASS / REVIEW_REQUIRED / BLOCKED
```

---

## 4. Storage Security Rules

If Firebase Storage is active, verify bucket policy and browser-access rules. If Storage is inactive, record it as `INACTIVE` rather than skipping silently.

Report format:

```text
[Firebase Storage]
Storage usage: ACTIVE/INACTIVE/UNKNOWN
Rules reviewed: YES/NO/NOT_REQUIRED
Anonymous broad write allowed: YES/NO/UNKNOWN/NOT_REQUIRED
Public read policy intentional: YES/NO/UNKNOWN/NOT_REQUIRED
Restricted values exposed: NO
Judgment: PASS / REVIEW_REQUIRED / BLOCKED
```

---

## 5. Firebase API key restrictions

Firebase Web API keys are public identifiers, but Google Cloud API restrictions should still be reviewed.

Verify in Google Cloud Console:

```text
Google Cloud Console → APIs & Services → Credentials
```

Do not print API key values. Report whether key restrictions exist and whether they are scoped to expected Firebase/Identity services and allowed HTTP referrers where applicable.

Report format:

```text
[Firebase API Key Restrictions]
API key value exposed: NO
Key present in client config: EXPECTED_PUBLIC_IDENTIFIER
Application restrictions: RESTRICTED/UNRESTRICTED/UNKNOWN
API restrictions: RESTRICTED/UNRESTRICTED/UNKNOWN
Unexpected allowed services count: 0/N/UNKNOWN
Unexpected referrers count: 0/N/UNKNOWN
Judgment: PASS / REVIEW_REQUIRED / BLOCKED
```

---

## 6. Modal Firebase Admin secret

The active backend path verifies Firebase ID tokens in server-side runtime. Confirm Modal secret posture through Modal secret management, not through source code.

Required checks:

- Firebase Admin/service-account secret exists in Modal;
- secret name is documented by path/name only, not value;
- runtime uses secret through environment/secret mechanism;
- rotation owner and cadence are documented;
- no service-account JSON is committed to the repo.

Report format:

```text
[Modal Firebase Admin Secret]
Secret configured: PRESENT/MISSING/UNKNOWN
Runtime references env/secret path: YES/NO/UNKNOWN
Service account JSON committed: NO
Rotation owner documented: YES/NO
Rotation cadence documented: YES/NO
Secret value exposed: NO
Judgment: PASS / REVIEW_REQUIRED / BLOCKED
```

---

## 7. Cloudflare deployment secrets

Cloudflare Pages/GitHub Actions deployment automation may need repository or Cloudflare secrets. Verify names and presence only.

For GitHub Actions workflows, required names may include:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Presence is not enough for full validation. A workflow run must prove the token has the required scope without printing it.

Report format:

```text
[Cloudflare Deployment Secrets]
CLOUDFLARE_API_TOKEN: PRESENT/MISSING/UNKNOWN
CLOUDFLARE_ACCOUNT_ID: PRESENT/MISSING/UNKNOWN
Token value exposed: NO
Workflow deploy test: PASS/FAIL/NOT_RUN
Least-privilege scope reviewed: YES/NO/UNKNOWN
Judgment: PASS / REVIEW_REQUIRED / BLOCKED
```

---

## 8. Legacy Netlify posture

Netlify is a legacy artifact / removal candidate unless explicitly reactivated. Verify that any Netlify service-account style secret is absent, disabled, or documented as legacy-only.

Report format:

```text
[Legacy Netlify]
Runtime status: LEGACY_ONLY/ACTIVE/UNKNOWN
Firebase service-account secret: ABSENT/PRESENT/UNKNOWN
If present, disabled or legacy-only: YES/NO/UNKNOWN
Secret value exposed: NO
Judgment: PASS / REVIEW_REQUIRED / BLOCKED
```

---

## 9. Rotation and ownership

For each active secret class, record owner and rotation cadence without exposing values.

Report format:

```text
[Rotation Ownership]
Firebase Admin secret owner: DOCUMENTED/MISSING
Firebase Admin rotation cadence: DOCUMENTED/MISSING
Cloudflare deploy token owner: DOCUMENTED/MISSING
Cloudflare deploy token rotation cadence: DOCUMENTED/MISSING
Emergency revocation path: DOCUMENTED/MISSING
Secret values exposed: NO
Judgment: PASS / REVIEW_REQUIRED / BLOCKED
```

---

## 10. Final posture report template

Use this final summary for #266 updates:

```text
[Firebase and Deployment Secret Posture Report]
1. Firebase Authorized Domains: PASS / REVIEW_REQUIRED / BLOCKED
2. Firestore Rules: PASS / REVIEW_REQUIRED / BLOCKED
3. Storage Rules: PASS / REVIEW_REQUIRED / BLOCKED / NOT_REQUIRED
4. Firebase API Key Restrictions: PASS / REVIEW_REQUIRED / BLOCKED
5. Modal Firebase Admin Secret: PASS / REVIEW_REQUIRED / BLOCKED
6. Cloudflare Deployment Secrets: PASS / REVIEW_REQUIRED / BLOCKED
7. Legacy Netlify Secret Posture: PASS / REVIEW_REQUIRED / BLOCKED
8. Rotation Ownership: PASS / REVIEW_REQUIRED / BLOCKED
9. Secret values exposed: NO
10. Restricted private IDs exposed: NO
11. Final judgment: PASS / PARTIAL / BLOCKED
```

---

## 11. Closure criteria for #266

Issue #266 should remain open until the external-console/runtime checks are actually completed. A docs-only PR can define the runbook, but it does not prove the external posture.

The issue can be considered closure-ready only when:

- Firebase Authorized Domains are reviewed;
- Firestore and Storage posture are reviewed or explicitly marked inactive/not required;
- API key restrictions are reviewed;
- Modal Firebase Admin secret posture is verified by name/presence only;
- Cloudflare deployment secret posture is verified by name/presence only;
- legacy Netlify secret posture is classified;
- rotation ownership is documented;
- no restricted values are exposed.
