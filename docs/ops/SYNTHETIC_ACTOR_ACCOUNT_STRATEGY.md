# Synthetic Actor Account Strategy

Refs #849
Refs #838
Refs #846

## Purpose

This document defines a simple three-track strategy for LoveBud accounts and AI/synthetic actors.

The goal is to support three concrete needs without overcomplicating day-to-day operations:

```text
1. Development/testing-capable accounts
2. General user behavior testing
3. Explicit AI model activity as a product feature
```

The tracks can share infrastructure, account registry patterns, and safe reporting formats. They must not share the same public behavior rules.

## Track 1 — Development testing accounts

Purpose:

```text
developer/runtime QA
signup/login verification
fixed slot browser testing
Auth/My Trees/Editor/Public Viewer regression checks
```

Rules:

- fixed slot first;
- production only with explicit approval;
- account can be synthetic/test-only;
- may create/edit/delete test data when scoped;
- must not be treated as real community engagement;
- must not appear in normal user rankings by default;
- credentials must never be posted in GitHub issues, PRs, comments, docs, screenshots, or logs.

Required public-safe account metadata:

```text
account_label: QA_DEV_ACCOUNT_###
track: DEVELOPMENT_TESTING
environment: fixed_slot / production_smoke_only
credential_location_label: local_secret_store / approved_QA_handoff / unknown
status: active / retired / unknown / orphaned
cleanup_status: done / not_required / not_available
```

## Track 2 — General user behavior testing

Purpose:

```text
simulate realistic user behavior
observe onboarding confusion
exercise first tree creation
exercise returning user My Trees + Editor flows
capture screenshots and UX findings
```

Rules:

- use selected persona as a testing lens;
- use fixed slot for signup/data mutation;
- report behavior and confusion, not fake engagement;
- do not present the account as a real public fan;
- account activity is for QA evidence, not community activation.

Examples:

```text
new fan creates first tree
returning user edits existing tree
mobile user signs in and opens My Trees
confused user reloads/cancels/backs out
```

Required public-safe account metadata:

```text
account_label: QA_PERSONA_A_###
track: USER_BEHAVIOR_TESTING
persona_id: PERSONA_A_FIRST_TIME_CREATOR / PERSONA_B_RETURNING_OWNER / etc.
environment: fixed_slot
created_for_pr:
created_for_issue:
credential_location_label:
cleanup_status:
```

## Track 3 — Explicit AI model activity

Purpose:

```text
AI Guide / Instructor / fan-memory assistant
user-facing AI DM support
AI-created sample content where clearly labeled
AI usage rankings and topic trends
paid AI guidance features later
```

Rules:

- must be clearly disclosed as AI;
- must not pretend to be a real fan or normal user;
- may answer user questions by request;
- may have AI-only rankings such as most asked AI guide;
- may have topic analytics such as group questions or feature questions;
- must not generate fake likes, fake popularity, or fake community engagement;
- AI sample content must be labeled as AI/sample/official guide content.

Allowed public labels:

```text
AI Guide
AI 기록 코치
AI 입덕 도우미
LoveBud AI Sample
AI-generated sample tree
```

Disallowed behavior:

```text
AI pretending to be a real fan
AI liking normal user content to inflate activity
AI comments presented as human community reaction
AI sample content mixed into real-user ranking without disclosure
AI-created engagement counted as real user popularity
```

Required public-safe account metadata:

```text
account_label: AI_GUIDE_###
track: AI_MODEL_ACTIVITY
disclosure_label: AI Guide / AI Sample
visibility: user_facing_ai / sample_only / internal
ranking_policy: ai_guide_only / sample_only / excluded_from_user_rankings
allowed_actions: dm_answer / sample_tree_create / analytics_aggregate
```

## Account storage tiers

Local-only storage is not sufficient once accounts are reused across multiple agents, devices, and verification runs. Use a three-tier storage model.

### Tier 0 — Public-safe registry

Purpose:

```text
coordination only
safe status reporting
PR/Issue references
account inventory without secrets
```

Allowed location:

```text
GitHub docs
GitHub issues
PR comments
QA reports
```

Allowed fields:

```text
account_label
track
persona_id_or_ai_role
environment
credential_key
credential_location_label
status
custodian
rotation_required
cleanup_status
last_verified_status
```

Forbidden fields:

```text
email
password
confirmPassword
token
session
cookie
private UID
raw credential
raw auth payload
```

### Tier 1 — Local runtime credential file

Purpose:

```text
actual browser login runtime
local automation
fixed-slot verification
```

Allowed location:

```text
.local/test-accounts.json
```

Rules:

- must be gitignored;
- values must never be printed;
- selected key may be referenced, such as `accounts.personaA001`;
- local preflight must report only safe status;
- models should not read the file contents.

### Tier 2 — Encrypted shared backup / restore source

Purpose:

```text
restore credentials across machines
avoid orphaned long-lived QA accounts
support account rotation
support custodian handoff
```

Allowed target locations:

```text
docs/ops/qa-credential-bundle/test-accounts-encrypted.zip
docs/ops/qa-credential-bundle/test-accounts.json.age
approved password manager export/import controlled by custodian
```

Rules:

- encrypted bundle only;
- plaintext credential file must not be committed;
- bundle password must not be documented in repository;
- restore procedure must report only existence/status;
- production-grade or AI Guide credentials should prefer approved password manager or CTO-managed secret storage over ad-hoc local files.

## Account sensitivity classes

Not every account has the same risk. Assign a class before creating or storing credentials.

| Class | Examples | Storage requirement | Reuse policy | Rotation policy |
|------|----------|---------------------|--------------|-----------------|
| `LOW_QA_DISPOSABLE` | signup disposable, one-off onboarding check | local runtime + optional encrypted backup | short-term only | may retire after run |
| `STANDARD_QA_REUSABLE` | persona A/B/C/D/E, fixed-slot user | local runtime + encrypted backup | reusable | rotate on schedule or when leaked/lost |
| `PRIVILEGED_QA` | admin/moderation/test admin | password manager or CTO-managed secret + encrypted backup metadata | tightly controlled | rotate more frequently |
| `AI_GUIDE_PRODUCT` | user-facing AI guide account | product-managed secret storage / password manager | long-lived | rotation + audit required |
| `AI_SAMPLE_CREATOR` | labeled sample content creator | password manager or product-managed | reusable with disclosure | rotate on schedule |

## Custody model

Every reusable account should have a custodian label. The custodian is responsible for maintaining credential location, status, and rotation metadata without exposing values.

Allowed custodian labels:

```text
CTO_MANAGED
LOCAL_VERIFIER_MANAGED
OPS_BUNDLE_CUSTODIAN
PRODUCT_AI_CUSTODIAN
UNKNOWN_CUSTODIAN
```

Required rule:

```text
If custodian is UNKNOWN_CUSTODIAN and credentials are not recoverable from encrypted backup, mark account status as ORPHANED_TEST_ACCOUNT.
```

## Account inventory template

Use this as a public-safe inventory row. It may appear in docs or reports because it contains no credential values.

```text
Account label:
Track:
Sensitivity class:
Persona or AI role:
Environment:
Credential key:
Credential location label:
Custodian:
Status:
Rotation required: YES / NO
Cleanup status:
Last verified status:
Secret values exposed: NO
```

Example:

```text
Account label: QA_PERSONA_A_001
Track: USER_BEHAVIOR_TESTING
Sensitivity class: STANDARD_QA_REUSABLE
Persona or AI role: PERSONA_A_FIRST_TIME_CREATOR
Environment: fixed_slot
Credential key: accounts.personaA001
Credential location label: ENCRYPTED_QA_HANDOFF + LOCAL_SECRET_STORE
Custodian: OPS_BUNDLE_CUSTODIAN
Status: ACTIVE
Rotation required: NO
Cleanup status: NOT_REQUIRED
Last verified status: CREDENTIAL_PREFLIGHT_PASS
Secret values exposed: NO
```

## Credential and account reuse policy

### Problem

Models or executors have created accounts during browser verification but did not preserve reusable credentials. As a result, accounts cannot be reused and the project risks accumulating orphaned test accounts.

### Policy

- Reuse managed QA accounts when credentials are safely stored.
- Create disposable accounts only when signup, clean onboarding, or account-isolation behavior is under test.
- Never store passwords in GitHub issues, PRs, comments, docs, screenshots, or logs.
- Store only safe labels and metadata in GitHub reports.
- Store actual credentials only in an approved local secret store, encrypted QA credential handoff, approved password manager, or CTO-managed secret store.
- If credentials are lost, mark the account as `UNKNOWN_CREDENTIALS` or `ORPHANED_TEST_ACCOUNT` by safe label only.
- Do not attempt to recover or print secrets through logs.
- For reusable accounts, record credential location label and custodian label at creation time.

Safe public metadata:

```text
account_label
track
persona_id_or_ai_role
environment
created_for_pr
created_for_issue
created_at
status
credential_key
credential_location_label
custodian
cleanup_status
```

Forbidden in reports:

```text
password
session
cookie
token
private key
raw credential
private user ID
DB row
raw payload
```

## Credential location labels

Use labels that describe where credentials are stored without revealing values.

Allowed labels:

```text
LOCAL_SECRET_STORE
ENCRYPTED_QA_HANDOFF
APPROVED_PASSWORD_MANAGER
CTO_MANAGED_SECRET
PRODUCT_MANAGED_SECRET
UNKNOWN_CREDENTIALS
```

Do not include real paths if the path itself exposes private user information. Path-only references may be used only when already approved by ops security policy.

## Account status values

```text
ACTIVE
RETIRED
UNKNOWN_CREDENTIALS
ORPHANED_TEST_ACCOUNT
CLEANUP_NOT_AVAILABLE
ROTATION_REQUIRED
```

Use `ORPHANED_TEST_ACCOUNT` when an account was created but credentials were not preserved and safe cleanup is not available.

## Account creation report template

Use this template after any account-creation verification.

```text
Synthetic Account Creation Report

Track:
Sensitivity class:
Account label:
Persona or AI role:
Environment:
Credential key:
Credential location label:
Custodian:
Account status:
Rotation required: YES / NO
Cleanup status:
Production data created: YES / NO
Secret/private data exposure: NO / PRESENT
Notes:
```

## Three-track decision table

| Need | Track | Public visibility | Credential handling | Ranking/engagement policy |
|------|-------|-------------------|---------------------|----------------------------|
| Check signup/login and protected routes | Development testing | Internal only | Secret store / QA handoff | Excluded |
| Simulate a new or returning fan behavior | General user behavior testing | Internal QA evidence only by default | Secret store / QA handoff | Excluded |
| Provide an AI guide users can ask questions | Explicit AI model activity | User-facing as AI | Product auth/AI system credentials, not public | AI-guide ranking only |
| Publish AI sample content | Explicit AI model activity | User-facing with AI/sample label | Product-managed | Sample-only / excluded from real user ranking |
| Generate likes or popularity | None | Disallowed | N/A | Disallowed |

## Implementation guidance

If this later becomes a database-backed system, prefer a neutral synthetic actor model:

```text
synthetic_actors
- actor_id
- track
- sensitivity_class
- persona_id
- ai_role
- disclosure_label
- visibility
- environment
- credential_key
- credential_location_label
- custodian
- allowed_actions
- ranking_policy
- status
- rotation_required
```

Do not store plaintext credentials in this table.
