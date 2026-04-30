# Modal Firebase Secret Rotation Runbook

## Purpose

This runbook documents owner, cadence, verification, and evidence expectations for the Modal `FIREBASE_SERVICE_ACCOUNT_JSON` secret tracked under Issue #266.

This is a docs-only security runbook. It does not inspect, print, rotate, replace, create, delete, or otherwise modify any Modal secret, Firebase service account, Google Cloud credential, runtime configuration, workflow, package file, or application code.

Issue #266 remains open until the broader Firebase Console and deployment secret posture verification is completed or explicitly tracked elsewhere by CTO decision.

Refs #266

## Secret owner roles

### Modal secret owner

Responsible for the Modal-side secret posture:

- Confirming whether the Modal secret exists by status only.
- Owning or coordinating Modal secret rotation.
- Confirming who can read, modify, deploy, or otherwise administer the Modal secret.
- Defining the approved rotation cadence.
- Approving any non-sensitive rotation metadata that may be recorded.
- Ensuring no service-account JSON or credential material is copied into issues, PRs, logs, screenshots, or repository files.

### Firebase/GCP service account owner

Responsible for the Firebase and Google Cloud source credential posture:

- Owning the service account tied to the Modal secret.
- Confirming whether the service account is still required by the active Modal runtime.
- Confirming the account has the least privileges needed for Firebase Admin behavior.
- Creating or approving replacement service-account credentials when a rotation is explicitly approved.
- Revoking old credentials after a separately approved rotation.
- Confirming rotation completion by status only.

### Repository security reviewer

Responsible for repository-side documentation and evidence review:

- Reviewing this runbook and any status report for forbidden evidence.
- Confirming changed files remain documentation-only.
- Confirming no runtime, Modal, Firebase, workflow, package, or config files are modified.
- Confirming issue references use non-completing wording unless CTO explicitly approves closure.
- Confirming PR #7 and prototype/reference/demo/variant paths are untouched.

## Verification checklist

Use this checklist to verify owner and cadence posture without exposing secret values.

| Check | Required evidence | Forbidden evidence |
|---|---|---|
| Secret existence status | `EXISTS`, `MISSING`, or `UNKNOWN` | Secret value, JSON body, screenshots showing values |
| Modal secret owner assignment | Owner role or accountable team/person approved for disclosure | Private access tokens, account credentials, personal credential data |
| Firebase/GCP service account owner assignment | Owner role or accountable team/person approved for disclosure | Service-account JSON, private key material, raw IAM credential exports |
| Repository security reviewer assignment | Reviewer role or GitHub handle if already public/approved | Private contact data or credential-bearing notes |
| Access control posture | High-level status such as `LEAST_PRIVILEGE_REVIEWED`, `NEEDS_REVIEW`, or `BLOCKED_BY_OWNER_ACCESS` | Full member export if it exposes sensitive identifiers beyond owner-approved scope |
| Rotation cadence | Cadence label such as quarterly, semiannual, annual, incident-driven, or owner-defined date interval | Credential values or generated key material |
| Last rotation metadata | Only if owner-approved: date, status label, and non-sensitive tracking link | Any key ID, service-account JSON field, private key, client email, token, cookie, or session value |

Verification must be performed by an authorized owner. A repository reviewer may document status labels but must not request or receive raw secret material.

## Forbidden evidence

Do not include any of the following in repository files, PR bodies, issue comments, chat reports, logs, screenshots, artifacts, or CI output:

- Service account JSON content.
- `private_key` field or its value.
- `client_email` field or its value.
- Any token, cookie, session value, OAuth credential, refresh token, ID token, or access token.
- Partial credential values, including prefixes, suffixes, checksums, fragments, redacted previews, or last characters.
- Modal secret value or screenshots exposing a secret editor/viewer.
- Firebase/GCP credential export files.
- Local environment files containing credential material.
- Browser storage or request headers containing Auth/session material.

Allowed evidence is limited to status labels, owner/cadence assignments, approved non-sensitive dates, and follow-up links.

## Outcomes

Use one of these outcomes when reporting the status of the Modal Firebase secret rotation owner/cadence gap.

| Outcome | Meaning | Follow-up |
|---|---|---|
| `VERIFIED_OWNER_AND_CADENCE` | Modal secret owner, Firebase/GCP service account owner, repository reviewer, access posture, and rotation cadence are documented by status only | Keep #266 open unless all other #266 gaps are resolved or separately tracked |
| `NEEDS_ROTATION` | The owner determines the secret should be rotated or the cadence requires immediate rotation | Open or use a separate approved rotation task; do not rotate in a docs PR |
| `NEEDS_OWNER_ASSIGNMENT` | Modal secret owner, Firebase/GCP service account owner, repository security reviewer, or cadence owner is missing or unclear | Assign owner before verification can be complete |
| `BLOCKED_BY_OWNER_ACCESS` | The verifier lacks access or owner confirmation needed to verify status | Escalate to CTO or authorized owner without requesting secret values |

## Rotation change process

Actual secret rotation requires a separate approval path. This runbook does not authorize rotation.

A future rotation task must follow these rules:

1. Obtain explicit CTO or designated security-owner approval before changing any Modal or Firebase/GCP credential.
2. Prepare the replacement credential only in approved owner-controlled tooling.
3. Update Modal secret material only through authorized Modal secret management paths.
4. Do not place credential values in issue comments, PR bodies, commit messages, logs, screenshots, CI artifacts, local reports, or repository files.
5. Coordinate runtime deployment or restart needs with the Modal secret owner.
6. Verify active runtime behavior by status only after the rotation.
7. Revoke old Firebase/GCP credential material after the new secret is confirmed operational, if the owner-approved process requires revocation.
8. Record only non-sensitive metadata: date, owner role, status outcome, related issue/PR, and whether secret values were exposed (`NO`).

## Relationship to Issue #266

Issue #266 tracks broader Firebase Console and deployment secret posture verification. This runbook covers only the remaining Modal `FIREBASE_SERVICE_ACCOUNT_JSON` secret rotation owner/cadence gap identified after the prior docs-only posture work.

Related merged documentation:

- PR #441 added the Firebase Console and secret posture verification checklist.
- PR #443 tracked remaining #266 operational posture gaps and identified secret rotation owner/cadence documentation as a remaining gap.

This runbook does not close #266. It should be cited from future #266 status reports as the owner/cadence process for the Modal Firebase service-account secret.

## Report template

Use this template when reporting verification status:

```text
Modal Firebase secret rotation status
secret existence status:        EXISTS | MISSING | UNKNOWN
Modal secret owner:             VERIFIED | NEEDS_OWNER_ASSIGNMENT | BLOCKED_BY_OWNER_ACCESS
Firebase/GCP owner:             VERIFIED | NEEDS_OWNER_ASSIGNMENT | BLOCKED_BY_OWNER_ACCESS
repository security reviewer:   VERIFIED | NEEDS_OWNER_ASSIGNMENT
access control posture:         REVIEWED | NEEDS_REVIEW | BLOCKED_BY_OWNER_ACCESS
rotation cadence:               VERIFIED | NEEDS_CADENCE | BLOCKED_BY_OWNER_ACCESS
last rotation metadata:         RECORDED_NON_SENSITIVE | NOT_RECORDED | OWNER_NOT_APPROVED
secret values exposed:          NO
outcome:                        VERIFIED_OWNER_AND_CADENCE | NEEDS_ROTATION | NEEDS_OWNER_ASSIGNMENT | BLOCKED_BY_OWNER_ACCESS
```

If a field cannot be verified without exposing secret material, mark it blocked and escalate to the owner instead of requesting the value.

## Non-goals

- No Modal secret lookup by value.
- No Modal secret print/export.
- No Modal secret creation, update, deletion, or rotation.
- No Firebase/GCP service-account key creation, export, revocation, or IAM change.
- No runtime/client/backend code change.
- No package or dependency change.
- No GitHub Actions workflow change.
- No Firebase config file change.
- No PR #7/prototype/reference/demo/variant change.
