# Member Personas and Synthetic Actor Strategy

Refs #846
Refs #849
Refs #851
Refs #838
Refs #681

## Purpose

LoveBud journey verification should use realistic member personas and explicit synthetic account rules. The goal is to make QA more product-centered without blurring the boundary between real users, test users, and AI/model activity.

This document defines:

- reusable member personas for journey-based verification;
- a three-track strategy for development testing, general behavior testing, and explicit AI model activity;
- safe account labels and credential-location metadata;
- initial long-lived account set guidance;
- lost credential and disposable signup account handling;
- fixed-slot versus production boundaries.

This document does not create accounts, store credentials, change Auth behavior, or implement any AI feature.

## Relationship to the member journey QA suite

The journey QA suite defines what paths to verify. This document defines who is performing those paths and why.

Recommended operating model:

```text
persona -> journey -> PR/issue verification -> safe report
```

Runtime-sensitive QA prompts should name at least one persona and one journey track.

Example:

```text
Run Persona B against PR #___ on fixed slot test4 using MY_TREES_RETURNING_USER_JOURNEY and EDITOR_MOMENT_EDITING_JOURNEY.
```

## Persona set

### Persona A — First-time fan memory creator

```text
Persona ID: PERSONA_A_FIRST_TIME_CREATOR
Display name: First-time fan memory creator
Starting state: new or clean-session user
Device/viewport: desktop plus mobile 375px when onboarding is in scope
Auth state: logged out at start
Data state: no owned LoveTree required
Primary goal: understand LoveBud and create the first LoveTree / first moment
Secondary goal: confirm saved content appears after account/session transition
Likely confusion: login vs signup, first-create entry point, whether save succeeded
Required journeys: AUTH_SIGNUP_LOGIN_JOURNEY, FIRST_TREE_CREATION_JOURNEY, MOBILE_375_FULL_JOURNEY
Safe test data rule: use generic QA memory content only
Expected report labels: SIGNUP_SUCCESS, FIRST_CREATE_ENTRY_PRESENT, FIRST_MOMENT_SAVE_SUCCESS, PERSISTENCE_CONFIRMED
```

### Persona B — Returning private scrapbook owner

```text
Persona ID: PERSONA_B_RETURNING_OWNER
Display name: Returning private scrapbook owner
Starting state: existing approved test account
Device/viewport: desktop plus mobile when UI-sensitive
Auth state: logged out or logged in depending on scenario
Data state: at least one saved owned LoveTree
Primary goal: return to My Trees and continue editing
Secondary goal: confirm saved content remains coherent after refresh/logout/login
Likely confusion: protected route gating, My Trees card action, Editor selected moment identity
Required journeys: AUTH_SIGNUP_LOGIN_JOURNEY smoke, MY_TREES_RETURNING_USER_JOURNEY, EDITOR_MOMENT_EDITING_JOURNEY, LOGOUT_AND_PROTECTED_ROUTE_JOURNEY
Safe test data rule: do not print owned tree or memory identifiers
Expected report labels: OWNED_TREE_CARD_PRESENT, PRIMARY_OPEN_ACTION_WORKS, EDITOR_LOADED, NODE_SELECTION_WORKS, PERSISTENCE_CONFIRMED
```

### Persona C — Public viewer / fan visitor

```text
Persona ID: PERSONA_C_PUBLIC_VIEWER
Display name: Public viewer / fan visitor
Starting state: logged-out or clean visitor session
Device/viewport: desktop plus mobile 375px when public viewer is in scope
Auth state: logged out unless explicit authenticated-viewer behavior is scoped
Data state: public/read-only test tree available
Primary goal: open and understand a public LoveTree without editing it
Secondary goal: inspect a moment node/detail if implemented
Likely confusion: tree viewer vs 감상/detail route, owner controls, empty public state
Required journeys: PUBLIC_VIEWER_READONLY_JOURNEY, MOBILE_375_FULL_JOURNEY, ERROR_RECOVERY_JOURNEY
Safe test data rule: public-safe content only; no private identifiers in report
Expected report labels: PUBLIC_VIEWER_OPENED, PUBLIC_CONTENT_PRESENT, READONLY_PANEL_PRESENT, OWNER_CONTROLS_HIDDEN, PRIVATE_BOUNDARY_PRESERVED
```

### Persona D — Mobile-only casual user

```text
Persona ID: PERSONA_D_MOBILE_CASUAL
Display name: Mobile-only casual user
Starting state: mobile visitor or approved mobile test account
Device/viewport: 375px baseline; 390/393px or 430px smoke when required
Auth state: varies by journey
Data state: none for onboarding; existing data for returning smoke
Primary goal: complete key actions without horizontal overflow or hidden controls
Secondary goal: verify header/menu, forms, cards, panels, and bottom sheets remain usable
Likely confusion: mobile menu, crowded CTAs, Editor canvas controls, detail panel stacking
Required journeys: MOBILE_375_FULL_JOURNEY, AUTH_SIGNUP_LOGIN_JOURNEY smoke, FIRST_TREE_CREATION_JOURNEY smoke, MY_TREES_RETURNING_USER_JOURNEY smoke
Safe test data rule: screenshots must be reviewed for restricted values before posting
Expected report labels: NO_HORIZONTAL_OVERFLOW, MOBILE_HEADER_USABLE, FORM_USABLE, MOBILE_BASELINE_PASS, MODERN_MOBILE_SMOKE_PASS
```

### Persona E — Confused or interrupted user

```text
Persona ID: PERSONA_E_INTERRUPTED_USER
Display name: Confused or interrupted user
Starting state: any state likely to be interrupted
Device/viewport: desktop or mobile depending on PR risk
Auth state: pending, logged out, or logged in depending on scenario
Data state: may be empty, loading, degraded, or partially saved
Primary goal: recover from reload, cancel, back, close, failure, or degraded state
Secondary goal: confirm private content is not shown during Auth-pending or logged-out states
Likely confusion: stuck loading, ambiguous empty state, failed save, failed copy/import, login surprise
Required journeys: ERROR_RECOVERY_JOURNEY, LOGOUT_AND_PROTECTED_ROUTE_JOURNEY, AUTH_SIGNUP_LOGIN_JOURNEY smoke, EDITOR_MOMENT_EDITING_JOURNEY smoke
Safe test data rule: use safe status labels only; do not print payloads
Expected report labels: LOADING_STATE_CLEAR, EMPTY_STATE_CLEAR, DEGRADED_STATE_CLEAR, BACK_NAVIGATION_RECOVERS, PROTECTED_ROUTE_BLOCKED
```

## Three account and actor tracks

### Track 1 — DEVELOPMENT_TESTING

Purpose:

```text
developer/runtime QA
signup/login verification
fixed-slot browser testing
Auth/My Trees/Editor/Public Viewer regression checks
```

Rules:

- fixed slot first;
- production only with explicit approval;
- account can be synthetic/test-only;
- account may create, edit, or delete test data only when scoped;
- account must not be treated as real community engagement;
- account must not appear in normal user rankings by default;
- credentials must never be posted in GitHub issues, PRs, comments, docs, screenshots, or logs.

### Track 2 — USER_BEHAVIOR_TESTING

Purpose:

```text
simulate realistic user behavior
observe onboarding confusion
exercise first tree creation
exercise returning user My Trees + Editor flows
capture screenshots and UX findings
```

Rules:

- use a selected persona as the testing lens;
- use fixed slot for signup or data mutation;
- report behavior and confusion, not fake engagement;
- do not present the account as a real public fan;
- account activity is QA evidence, not community activation.

### Track 3 — AI_MODEL_ACTIVITY

Purpose:

```text
AI Guide / Instructor / Fan-memory assistant
user-facing AI DM support
AI-created sample content where clearly labeled
AI usage rankings and topic trends
paid AI guidance features later
```

Rules:

- activity must be clearly disclosed as AI;
- AI must not pretend to be a real fan or normal user;
- AI may answer user questions by request;
- AI may have AI-only rankings such as most asked AI guide;
- topic analytics may exist for AI guide questions or product help themes;
- AI must not generate fake likes, fake popularity, fake comments, or fake community engagement;
- AI sample content must be labeled as AI, sample, or official guide content.

Allowed labels:

```text
AI Guide
AI 기록 코치
AI 입덕 도우미
LoveBud AI Sample
AI-generated sample tree
```

## Initial account set

Start with a small long-lived account set. Do not create many durable accounts until cleanup and custody practices are stable.

```text
DEVELOPMENT_TESTING
- QA_DEV_001
- QA_DEV_002
- QA_ADMIN_001

USER_BEHAVIOR_TESTING
- QA_PERSONA_A_001
- QA_PERSONA_B_001
- QA_PERSONA_C_001
- QA_PERSONA_D_001
- QA_PERSONA_E_001

AI_MODEL_ACTIVITY
- AI_GUIDE_001
- AI_GUIDE_002
- AI_SAMPLE_001
```

Expected starting size: 10-11 long-lived accounts.

## Credential source of truth

Use an approved password manager or encrypted QA credential handoff as the credential source of truth. GitHub stores only labels and credential keys, never values.

Current acceptable free password-manager candidates for a one-person CTO-managed first pass:

- Bitwarden Free: official Bitwarden docs describe the free individual plan as including unlimited storage for logins/notes/cards/identities and access on any device.
- Proton Pass Free: official Proton pricing/support pages describe unlimited logins and unlimited devices for the free plan.

Either option may be selected by CTO preference. The selected tool should be documented by label only:

```text
credential_location_label: APPROVED_PASSWORD_MANAGER
custodian: CTO_MANAGED
```

Do not store actual values in this repository.

## Password manager entry format

Suggested entry title:

```text
LoveBud / QA / QA_PERSONA_A_001
```

Suggested notes:

```text
credential_key: accounts.personaA001
track: USER_BEHAVIOR_TESTING
persona: PERSONA_A_FIRST_TIME_CREATOR
environment: fixed_slot
custodian: CTO_MANAGED
```

The notes may include safe labels. They must not be pasted into GitHub if they contain actual credentials or private provider identifiers.

## GitHub-safe account inventory row

GitHub/docs/issues may contain only safe metadata.

```text
Account label: QA_PERSONA_A_001
Track: USER_BEHAVIOR_TESTING
Sensitivity class: STANDARD_QA_REUSABLE
Persona or AI role: PERSONA_A_FIRST_TIME_CREATOR
Environment: fixed_slot
Credential key: accounts.personaA001
Credential location label: APPROVED_PASSWORD_MANAGER
Custodian: CTO_MANAGED
Status: ACTIVE / RETIRED / UNKNOWN_CREDENTIALS / ORPHANED_TEST_ACCOUNT
Cleanup status: DONE / NOT_REQUIRED / NOT_AVAILABLE
Secret values exposed: NO
```

Forbidden in GitHub/docs/issues/comments/screenshots:

```text
actual email
password
confirmPassword
token
session
cookie
header
private UID
private user ID
private tree ID
private memory ID
raw auth payload
DB row value
```

## Disposable signup account rule

Do not create many long-lived signup accounts.

Use disposable accounts only when testing signup or clean onboarding.

Example labels:

```text
QA_SIGNUP_DISPOSABLE_YYYYMMDD_001
QA_SIGNUP_DISPOSABLE_YYYYMMDD_002
```

Disposable account rules:

- use fixed slot unless production signup is explicitly approved;
- record only safe metadata;
- retire or mark orphaned if cleanup is unavailable;
- do not turn disposable accounts into long-lived public activity accounts.

## Lost or unknown credential handling

If an executor created an account but did not preserve reusable credentials safely:

```text
status: UNKNOWN_CREDENTIALS
cleanup_status: NOT_AVAILABLE
```

or, if the account cannot be reused or cleaned up safely:

```text
status: ORPHANED_TEST_ACCOUNT
cleanup_status: NOT_AVAILABLE
```

Do not attempt to recover or print secrets through logs. Prefer creating a new controlled test account and recording its credential location label safely.

## Fixed slot and production boundaries

### Fixed slot first

Required for:

- signup;
- private data creation;
- Editor save/edit flows;
- My Trees protected data verification;
- Auth regression checks;
- public/private boundary checks tied to a PR;
- synthetic actor setup or activity verification.

### Production smoke only

Production default:

- no destructive tests;
- no repeated throwaway account creation;
- no private data mutation;
- no fake public engagement;
- public page/access smoke only unless explicitly approved.

## PR checklist integration

Runtime-sensitive PR prompts should include:

```text
Persona:
Journey track:
Account track:
Credential source label:
Fixed slot:
Expected head SHA:
Production allowed: YES/NO
Synthetic actor activity: YES/NO
AI activity disclosed: YES/NO/NOT_APPLICABLE
```

Docs-only PRs do not require browser persona execution.

## Acceptance mapping

| Issue | Coverage in this document |
| --- | --- |
| #846 | Personas A-E, persona fields, persona-to-journey operating model |
| #849 | Three-track synthetic actor strategy, AI activity boundary, lost credential handling |
| #851 | Initial account set, password manager source, GitHub-safe inventory, disposable signup policy |

## Current disposition

This document satisfies the planning/documentation layer for #846, #849, and #851. Those issues should remain open until the policy is accepted, linked from active QA prompts/checklists, and applied by at least one runtime-sensitive verification run.
