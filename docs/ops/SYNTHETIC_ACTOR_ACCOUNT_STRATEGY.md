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

## Credential and account reuse policy

### Problem

Models or executors have created accounts during browser verification but did not preserve reusable credentials. As a result, accounts cannot be reused and the project risks accumulating orphaned test accounts.

### Policy

- Never store passwords in GitHub issues, PRs, comments, docs, screenshots, or logs.
- Store only safe labels and metadata in GitHub reports.
- Store actual credentials only in an approved local secret store or encrypted QA credential handoff.
- If credentials are lost, mark the account as `UNKNOWN_CREDENTIALS` or `ORPHANED_TEST_ACCOUNT` by safe label only.
- Do not attempt to recover or print secrets through logs.
- Prefer creating a new controlled test account and recording its credential location safely.

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
credential_location_label
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
```

Use `ORPHANED_TEST_ACCOUNT` when an account was created but credentials were not preserved and safe cleanup is not available.

## Account creation report template

Use this template after any account-creation verification.

```text
Synthetic Account Creation Report

Track:
Account label:
Persona or AI role:
Environment:
Created for PR:
Created for Issue:
Credential location label:
Account status:
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
- persona_id
- ai_role
- disclosure_label
- visibility
- environment
- allowed_actions
- ranking_policy
- status
```

Do not store plaintext credentials in this table.
