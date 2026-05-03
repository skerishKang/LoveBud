# Firebase Console and deployment secret posture runbook

**Status:** External-console verification guide  
**Owner:** CTO / Ops / Security  
**Related issue:** #266

This runbook defines how LoveBud should verify Firebase Console, Google Cloud, Modal, Cloudflare, and legacy deployment-secret posture without exposing secret values or treating repository source review as sufficient proof.

Issue #124 established that committed source does not contain an obvious hardcoded Firebase service-account credential, and later security planning covered Firestore Rules hardening. This document covers the remaining external-console and deployment-secret checks from #266.

---

## 1. Scope

In scope:

- Firebase Authorized Domains review;
- Firebase API key restriction posture review;
- Firestore Rules deployment posture check;
- Storage Rules active/inactive posture check;
- Modal Firebase Admin/service-account secret presence check;
- legacy Netlify Firebase service-account environment posture check;
- Cloudflare/Vercel/Netlify deployment-secret inventory status labels;
- owner and rotation cadence documentation.

Out of scope:

- printing, pasting, or summarizing secret values;
- committing service-account JSON;
- changing runtime code;
- changing Firestore Rules from this runbook alone;
- production mutation;
- reactivating Netlify runtime;
- PR #7 or prototype/reference/demo/variant changes.

---

## 2. Safe reporting rules

Reports must use presence and posture labels only.

Allowed labels:

```text
PRESENT / MISSING / NOT_APPLICABLE / NOT_CHECKED
RESTRICTED / UNRESTRICTED / UNKNOWN
EXPECTED / UNEXPECTED / NEEDS_REVIEW
ACTIVE / LEGACY_ONLY / DISABLED / UNKNOWN
ROTATION_OWNER_PRESENT / ROTATION_OWNER_MISSING
SECRET_VALUE_EXPOSED: NO
```

Forbidden in reports, screenshots, PRs, issue comments, commits, or chat:

- Firebase service-account JSON values;
- private keys;
- API keys beyond public-by-design Firebase Web config names;
- OAuth client secrets;
- Cloudflare API tokens;
- Modal secrets;
- Vercel/Netlify environment variable values;
- cookies, sessions, tokens, passwords, DB URLs;
- project-private account identifiers when not required for safe status reporting.

If a restricted value is exposed, stop the task and report `SECURITY_INCIDENT_SECRET_EXPOSURE` without repeating the value.

---

## 3. Firebase Authorized Domains checklist

Verify in Firebase Console:

- Authorized domains contain intended LoveBud production domain(s).
- Authorized domains contain intended Cloudflare Pages domains.
- Local development domains are limited to expected localhost/dev entries.
- Unexpected staging, legacy, or abandoned domains are flagged for review.
- Production domain ownership and active routing are still valid.

Report format:

```text
Firebase Authorized Domains:
- intended production domains: PRESENT / MISSING / NOT_CHECKED
- intended Cloudflare Pages domains: PRESENT / MISSING / NOT_CHECKED
- local dev domains: EXPECTED / UNEXPECTED / NOT_CHECKED
- unexpected domains: PRESENT / ABSENT / NOT_CHECKED
- action required: YES / NO / UNKNOWN
```

Do not paste the full domain list if it includes private or internal hostnames. Use category labels and count-only summaries when needed.

---

## 4. Firebase API key restrictions checklist

Firebase Web API keys are public-by-design browser initialization values, but their Google Cloud restriction posture still needs review.

Verify in Google Cloud Console or Firebase-linked API credential settings:

- API key restrictions are configured where appropriate.
- Allowed APIs are limited to intended Firebase services where possible.
- Application restrictions match the intended web domains.
- Legacy unrestricted keys are flagged.
- Rotation owner and review cadence are documented.

Report format:

```text
Firebase API key restrictions:
- key inventory checked: YES / NO
- application restrictions: RESTRICTED / UNRESTRICTED / UNKNOWN
- API restrictions: RESTRICTED / UNRESTRICTED / UNKNOWN
- legacy unrestricted key present: YES / NO / UNKNOWN
- rotation owner: ROTATION_OWNER_PRESENT / ROTATION_OWNER_MISSING
- action required: YES / NO / UNKNOWN
```

Do not print key values, prefixes, suffixes, or screenshots showing key values.

---

## 5. Firestore Rules posture checklist

This checklist does not replace the Firestore Rules hardening plan. It verifies current external-console posture.

Verify:

- active Firestore Rules are known and attributable to an approved deployment path;
- public/private tree read boundaries are reviewed against the current policy;
- owner write boundaries are reviewed;
- comments read/write boundaries are reviewed;
- any repository-tracked rules source is identified, or absence is reported as a source-of-truth gap;
- deployment and rollback procedures are known.

Report format:

```text
Firestore Rules posture:
- active rules reviewed: YES / NO
- repository source of truth: PRESENT / MISSING / UNKNOWN
- private tree read boundary: ENFORCED / NOT_ENFORCED / UNKNOWN
- owner write boundary: ENFORCED / NOT_ENFORCED / UNKNOWN
- comments visibility inheritance: ENFORCED / NOT_ENFORCED / UNKNOWN
- rollback path known: YES / NO / UNKNOWN
- action required: YES / NO / UNKNOWN
```

Do not paste full rules if they include environment-specific private identifiers. Link to repository-tracked rules only if they exist and are safe.

---

## 6. Storage Rules posture checklist

Verify whether Firebase Storage is active for LoveBud.

If inactive:

```text
Firebase Storage usage: INACTIVE
Storage Rules review: NOT_APPLICABLE
```

If active:

- identify allowed read paths by category only;
- identify write paths by category only;
- verify authenticated/owner/admin boundaries;
- verify upload size/content-type constraints where applicable;
- verify no public write rule exists unintentionally.

Report format:

```text
Firebase Storage posture:
- usage: ACTIVE / INACTIVE / UNKNOWN
- rules reviewed: YES / NO / NOT_APPLICABLE
- public read paths: EXPECTED / UNEXPECTED / UNKNOWN
- public write paths: ABSENT / PRESENT / UNKNOWN
- owner/admin write boundary: ENFORCED / NOT_ENFORCED / UNKNOWN
- action required: YES / NO / UNKNOWN
```

---

## 7. Modal Firebase Admin secret posture

LoveBud's active backend target is Modal. Firebase Admin/service-account credentials should be environment-secret based, not committed.

Verify through approved Modal secret inspection paths only:

- required Modal secret name is present;
- secret owner/rotation owner is documented;
- secret value is not printed;
- deployment environment using the secret is the intended active runtime;
- stale or duplicate Firebase Admin secrets are flagged by name/status only.

Report format:

```text
Modal Firebase Admin posture:
- required secret presence: PRESENT / MISSING / NOT_CHECKED
- active runtime binding: EXPECTED / UNEXPECTED / UNKNOWN
- rotation owner: ROTATION_OWNER_PRESENT / ROTATION_OWNER_MISSING
- duplicate/stale secret names: PRESENT / ABSENT / UNKNOWN
- secret value exposed: NO
- action required: YES / NO / UNKNOWN
```

Do not use commands that dump full environment variables.

---

## 8. Legacy Netlify secret posture

Netlify is a legacy artifact / removal candidate, not the active production fallback. Its Firebase service-account environment posture should be documented as legacy-only, disabled, absent, or needing removal.

Verify:

- whether legacy Netlify environment variables still exist;
- whether any Netlify deploy/runtime is active for LoveBud;
- whether Firebase service-account secrets exist in Netlify;
- whether those secrets are disabled, removed, or documented as legacy-only.

Report format:

```text
Legacy Netlify Firebase secret posture:
- Netlify runtime role: LEGACY_ONLY / ACTIVE / UNKNOWN
- Firebase service-account env present: PRESENT / MISSING / NOT_CHECKED
- legacy-only documentation: PRESENT / MISSING / NOT_APPLICABLE
- removal candidate: YES / NO / UNKNOWN
- secret value exposed: NO
- action required: YES / NO / UNKNOWN
```

Do not reactivate Netlify while performing this review.

---

## 9. Deployment secret inventory summary

Use this summary table after external-console checks.

```text
[Deployment secret posture summary]
Firebase Authorized Domains: PASS / NEEDS_REVIEW / NOT_CHECKED
Firebase API key restrictions: PASS / NEEDS_REVIEW / NOT_CHECKED
Firestore Rules posture: PASS / NEEDS_REVIEW / NOT_CHECKED
Storage Rules posture: PASS / NEEDS_REVIEW / NOT_APPLICABLE / NOT_CHECKED
Modal Firebase Admin secret: PASS / NEEDS_REVIEW / NOT_CHECKED
Legacy Netlify Firebase secret: PASS / NEEDS_REVIEW / NOT_APPLICABLE / NOT_CHECKED
Rotation owner documented: YES / NO / PARTIAL
Secret value exposed: NO
Production mutation performed: NO
Runtime code changed: NO
Recommended next step: NO_ACTION / CONSOLE_HARDENING / RULES_PR / SECRET_ROTATION / LEGACY_SECRET_REMOVAL / ADDITIONAL_AUDIT
```

---

## 10. Completion boundary for #266

This runbook is a documentation prerequisite, not final proof that #266 is complete.

#266 still requires an actual external-console posture review using the safe labels above. After that review, follow-up work may include:

- Firebase Console domain cleanup;
- Google Cloud API key restriction hardening;
- repository-tracked Firestore Rules source-of-truth work;
- Storage Rules hardening or inactive confirmation;
- Modal secret rotation/ownership documentation;
- legacy Netlify secret removal or legacy-only documentation.

Any provider-console mutation, rule deployment, or secret rotation requires explicit CTO approval before execution.
