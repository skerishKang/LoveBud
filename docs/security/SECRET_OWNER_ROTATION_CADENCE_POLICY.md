# Secret Owner and Rotation Cadence Policy

Issue: #544
Parent posture issue: #266
Related docs: `FIREBASE_CONSOLE_SECRET_POSTURE_CHECKLIST.md`, `ISSUE_266_REMAINING_OPS_POSTURE_GAPS.md`, `MODAL_FIREBASE_SECRET_ROTATION_RUNBOOK.md`

This document defines category-level owner roles, rotation cadence expectations, emergency rotation handling, and evidence rules for Firebase/deployment-related secrets. It is docs-only. It does not inspect, print, rotate, create, update, delete, or otherwise modify any secret, credential, runtime configuration, workflow, package file, Firebase Console setting, Google Cloud Console setting, Modal setting, Netlify setting, or application code.

## Purpose

Issue #544 tracks the remaining #266 requirement to document responsible owner roles and rotation cadence expectations for active and legacy deployment secrets without exposing secret values.

This policy covers the documentation and verification path only. Any actual rotation, restriction change, domain change, secret deletion, or runtime configuration change requires a separately approved operational task.

## Covered secret categories

| Category | Runtime status | Owner role | Rotation cadence expectation | Evidence level |
|---|---|---|---|---|
| Modal Firebase service-account secret | Active runtime dependency when Modal Firebase Admin behavior is enabled | Modal Secret Owner and Firebase/GCP Service Account Owner | Owner-defined recurring cadence plus incident-driven rotation | Status labels only |
| Modal database/runtime secrets | Active runtime dependency when used by Modal backend | Modal Runtime Secret Owner and Runtime Owner | Owner-defined recurring cadence plus deployment/incident-driven review | Status labels only |
| Modal CORS/origin allowlist secrets or env values | Active runtime dependency if configured as secret/env | Modal Runtime Secret Owner and Web Runtime Owner | Review when domain policy changes; rotate only if value is credential-like | Status labels only |
| GitHub Actions secrets | Active only where workflows consume them | Repository Admin or GitHub Actions Secret Owner | Review on workflow ownership change; rotate on exposure, personnel, or provider policy trigger | Status labels only |
| Legacy Netlify Firebase service-account secrets | Legacy-only unless CTO reactivates Netlify runtime | Legacy Netlify Environment Owner and Security Reviewer | Prefer removal/disablement decision; rotate only if retained and still credential-bearing | Presence/status only |
| Legacy Vercel or other retired deployment secrets | Legacy-only unless CTO reactivates runtime | Legacy Deployment Owner and Security Reviewer | Prefer removal/disablement decision; rotate only if retained and still credential-bearing | Presence/status only |

## Owner responsibilities

### Modal Secret Owner

Responsible for Modal-hosted secret posture:

- Confirming whether each relevant Modal secret exists by status only.
- Confirming who can administer the secret in Modal.
- Coordinating approved rotations.
- Confirming whether runtime restart/redeploy is required after rotation.
- Recording only non-sensitive status labels and approved metadata.

### Firebase/GCP Service Account Owner

Responsible for source credential posture:

- Confirming whether Firebase/GCP service-account credentials are still required.
- Confirming least-privilege posture at category level.
- Creating or approving replacement credentials only through approved owner-controlled tooling.
- Revoking old credential material after separately approved rotation, if required.
- Confirming completion by status only.

### Modal Runtime Owner

Responsible for active backend runtime impact:

- Confirming whether a secret change affects Modal deployment, backend startup, API behavior, CORS behavior, or Firebase Admin behavior.
- Defining runtime verification requirements after an approved rotation.
- Confirming production mutation is not performed as part of a docs-only policy task.

### Repository Admin / GitHub Actions Secret Owner

Responsible for repository and workflow secrets:

- Confirming which GitHub Actions secrets are actively used.
- Confirming whether unused secrets should be removed in a separate approved task.
- Confirming workflow-level access and organization/repository secret scope by status only.
- Coordinating rotation if a workflow secret is exposed or ownership changes.

### Legacy Deployment Owner

Responsible for old deployment environments:

- Confirming whether legacy Netlify/Vercel environments still contain credential-bearing values by status only.
- Confirming whether those environments are inactive, legacy-only, or intentionally retained.
- Proposing removal, disablement, or retention through a separate approved task.
- Avoiding reactivation of legacy runtimes.

### Repository Security Reviewer

Responsible for documentation and evidence hygiene:

- Confirming reports contain no secret values, prefixes, suffixes, screenshots, raw env payloads, credential files, tokens, cookies, sessions, private keys, or private request/response bodies.
- Confirming changed files remain docs-only for policy PRs.
- Confirming PR #7 and prototype/reference/demo/variant paths are untouched.
- Confirming issue references use non-completing wording unless CTO explicitly approves closure.

## Rotation cadence policy

Rotation cadence must be owner-defined because service-provider requirements and runtime coupling can vary. Use these minimum expectations:

| Trigger | Required response |
|---|---|
| Confirmed exposure or suspected exposure | Immediate incident-driven rotation task and exposure report without secret values |
| Owner or admin access changes | Review affected secrets; rotate if owner policy requires it |
| Runtime provider migration | Review all affected secrets before and after migration |
| Domain/origin policy changes | Review CORS/origin/env values and Firebase authorized-domain/API-key restrictions |
| Workflow permission or CI provider changes | Review GitHub Actions secrets and rotate if access scope changed |
| Legacy environment retirement | Prefer removal/disablement decision over indefinite rotation |
| Periodic review | Owner-defined recurring review, recorded by status label only |

Acceptable cadence labels:

- `OWNER_DEFINED_RECURRING`
- `QUARTERLY`
- `SEMIANNUAL`
- `ANNUAL`
- `INCIDENT_DRIVEN`
- `ON_ACCESS_CHANGE`
- `LEGACY_REMOVAL_PREFERRED`
- `BLOCKED_BY_OWNER_ACCESS`

A cadence is considered documented when the owner role and cadence label are recorded without exposing credential material.

## Emergency rotation procedure

Emergency rotation is a separate operational task. A docs-only PR must not execute it.

When emergency rotation is approved:

1. Assign a rotation owner and runtime verifier.
2. Identify affected secret category by name or category only, not by value.
3. Prepare replacement credential material only in owner-controlled tooling.
4. Update provider secret storage through the approved provider console or CLI.
5. Restart/redeploy only if the runtime owner confirms it is required.
6. Verify runtime health on the approved environment.
7. Revoke old credential material if the owner-approved provider process requires revocation.
8. Record only non-sensitive metadata: date, owner role, status outcome, affected category, follow-up issue/PR, and `secret values exposed: NO` unless an incident report explicitly records exposure category without values.

If any step would require printing, pasting, uploading, or screenshotting secret material into GitHub, chat, logs, CI artifacts, or repository files, stop and report `BLOCKED_SECRET_EVIDENCE_RISK`.

## Evidence policy

Allowed report values:

- `OWNER_IDENTIFIED`
- `OWNER_NOT_VERIFIED`
- `CADENCE_DOCUMENTED`
- `CADENCE_MISSING`
- `ROTATION_NOT_REQUIRED_NOW`
- `NEEDS_ROTATION_PLAN`
- `LEGACY_ONLY`
- `PRESENCE_REVIEWED`
- `BLOCKED_BY_OWNER_ACCESS`
- `SECRET_VALUES_EXPOSED_NO`

Forbidden evidence:

- secret values;
- partial prefixes, suffixes, checksums, or last characters;
- service-account JSON content;
- private keys;
- token, session, cookie, OAuth, refresh-token, access-token, or ID-token values;
- raw env payloads;
- credential screenshots;
- browser storage or request headers containing Auth/session material;
- database URLs or connection strings;
- private request/response bodies.

## Verification template

Use this template for #544 or future secret owner/cadence reports:

```text
Secret owner and cadence verification
scope: Modal Firebase | Modal runtime | GitHub Actions | Legacy Netlify | Legacy Vercel | Other
runtime status: ACTIVE | LEGACY_ONLY | NOT_VERIFIED
owner role: OWNER_IDENTIFIED | OWNER_NOT_VERIFIED | BLOCKED_BY_OWNER_ACCESS
cadence: CADENCE_DOCUMENTED | CADENCE_MISSING | BLOCKED_BY_OWNER_ACCESS
rotation status: ROTATION_NOT_REQUIRED_NOW | NEEDS_ROTATION_PLAN | BLOCKED_BY_OWNER_ACCESS
emergency process documented: YES | NO
secret values exposed: NO
follow-up required: NO | OWNER_REVIEW | ROTATION_TASK | LEGACY_REMOVAL_DECISION
```

## Issue #544 closure criteria

Issue #544 can be closed when:

- owner roles for active and legacy secret categories are documented;
- rotation cadence expectations are documented at policy level;
- emergency rotation process is documented at policy level;
- active and legacy runtime categories are separated;
- evidence policy forbids secret values and raw credential material;
- any actual rotation/removal work remains split into separately approved operational tasks.

This policy satisfies the documentation gate only. It does not certify that every provider console has been owner-reviewed, and it does not close #266 by itself.

## Non-goals

- No secret lookup by value.
- No secret print/export.
- No secret creation, update, deletion, or rotation.
- No Firebase/GCP service-account key creation, export, revocation, or IAM change.
- No Firebase Console, Google Cloud Console, Modal, Netlify, Vercel, or GitHub Actions settings changes.
- No runtime/client/backend code change.
- No workflow/package/dependency change.
- No Firebase config file change.
- No PR #7/prototype/reference/demo/variant change.
- No PR #450 change.

Refs #544
Refs #266
