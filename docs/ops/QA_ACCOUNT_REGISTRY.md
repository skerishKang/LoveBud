# QA and AI Actor Account Registry

> **Purpose:** Public-safe inventory of all reusable QA and AI actor accounts registered in the approved password manager.
> **Status:** ✅ All accounts registered (v1)
> **Password Manager:** Bitwarden Free (recommended) / Proton Pass Free
> **Custodian:** CTO_MANAGED
> **Refs:** Issue #873, SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md

---

## Account Inventory

### Track 1: DEVELOPMENT_TESTING

Accounts for developer/runtime QA, signup/login verification, and fixed-slot browser testing.

| # | Account Label | Credential Key | Persona / Role | Environment | Slot | Status | Created For | Sensitivity |
|---|--------------|----------------|----------------|-------------|------|--------|-------------|-------------|
| 1 | `QA_DEV_001` | `accounts.dev001` | Developer testing | fixed_slot | test5 | ACTIVE | Issue #840 suite | STANDARD_QA_REUSABLE |
| 2 | `QA_DEV_002` | `accounts.dev002` | Developer testing | fixed_slot | test5 | ACTIVE | Issue #840 suite | STANDARD_QA_REUSABLE |
| 3 | `QA_ADMIN_001` | `accounts.admin001` | Admin/management testing | fixed_slot | test5 | ACTIVE | Issue #840 suite | STANDARD_QA_REUSABLE |
| 4 | `QA_SIGNUP_DISPOSABLE_001` | `accounts.signupDisposable001` | Signup disposable | fixed_slot | test5 | ACTIVE | Issue #839 | LOW_QA_DISPOSABLE |
| 5 | `QA_SIGNUP_DISPOSABLE_20260506_001` | `accounts.signupDisposable20260506001` | Signup disposable | fixed_slot | test4 | ACTIVE | Issue #839 | LOW_QA_DISPOSABLE |

### Track 2: USER_BEHAVIOR_TESTING

Accounts for simulating realistic user behavior and QA evidence collection.

| # | Account Label | Credential Key | Persona ID | Display Name | Environment | Slot | Status | Created For | Sensitivity |
|---|--------------|----------------|------------|--------------|-------------|------|--------|-------------|-------------|
| 6 | `QA_PERSONA_A_001` | `accounts.personaA001` | PERSONA_A_FIRST_TIME_CREATOR | 새싹팬 | fixed_slot | test5 | ACTIVE | Issue #840 | STANDARD_QA_REUSABLE |
| 7 | `QA_PERSONA_B_001` | `accounts.personaB001` | PERSONA_B_RETURNING_MY_TREES | 성장팬 | fixed_slot | test5 | ACTIVE | Issue #841 | STANDARD_QA_REUSABLE |
| 8 | `QA_PERSONA_C_001` | `accounts.personaC001` | PERSONA_C_EDITOR_MOMENT_EDIT | 편집팬 | fixed_slot | test5 | ACTIVE | Issue #842 | STANDARD_QA_REUSABLE |
| 9 | `QA_PERSONA_D_001` | `accounts.personaD001` | PERSONA_D_PUBLIC_VIEWER_READ_ONLY | 관람팬 | fixed_slot | test5 | ACTIVE | Issue #843 | STANDARD_QA_REUSABLE |
| 10 | `QA_PERSONA_E_001` | `accounts.personaE001` | PERSONA_E_MOBILE_ERROR_RECOVERY | 모바일팬 | fixed_slot | test5 | ACTIVE | Issue #844 | STANDARD_QA_REUSABLE |

### Track 3: AI_MODEL_ACTIVITY

Accounts for explicit AI model activity, AI Guide features, and AI sample content.

| # | Account Label | Credential Key | AI Role | Environment | Slot | Status | Created For | Sensitivity |
|---|--------------|----------------|---------|-------------|------|--------|-------------|-------------|
| 11 | `AI_GUIDE_001` | `accounts.aiGuide001` | AI Guide / AI 기록 코치 | fixed_slot | test5 | ACTIVE | Issue #867 | STANDARD_QA_REUSABLE |
| 12 | `AI_GUIDE_002` | `accounts.aiGuide002` | AI Guide / AI 입덕 도우미 | fixed_slot | test5 | ACTIVE | Issue #867 | STANDARD_QA_REUSABLE |
| 13 | `AI_SAMPLE_001` | `accounts.aiSample001` | AI Sample / LoveBud AI Sample | fixed_slot | test5 | ACTIVE | Issue #867 | STANDARD_QA_REUSABLE |

---

## Summary

| Metric | Count |
|--------|-------|
| **Total accounts** | **13** |
| DEVELOPMENT_TESTING (reusable) | 3 |
| DEVELOPMENT_TESTING (disposable) | 2 |
| USER_BEHAVIOR_TESTING | 5 |
| AI_MODEL_ACTIVITY | 3 |
| STANDARD_QA_REUSABLE | 11 |
| LOW_QA_DISPOSABLE | 2 |
| Fixed slot: test5 | 12 |
| Fixed slot: test4 | 1 |

---

## Password Manager Registration

### Entry Format (Bitwarden / Proton Pass)

Each account is registered in the approved password manager (Bitwarden Free recommended) using the following format:

**Item name:** `LoveBud / QA / <ACCOUNT_LABEL>`

Example entries:

| Item Name | Credential Key | Track |
|-----------|---------------|-------|
| `LoveBud / QA / QA_DEV_001` | `accounts.dev001` | DEVELOPMENT_TESTING |
| `LoveBud / QA / QA_PERSONA_A_001` | `accounts.personaA001` | USER_BEHAVIOR_TESTING |
| `LoveBud / AI / AI_GUIDE_001` | `accounts.aiGuide001` | AI_MODEL_ACTIVITY |
| `LoveBud / Admin / QA_ADMIN_001` | `accounts.admin001` | DEVELOPMENT_TESTING |

**Notes field (metadata for operator reference):**

```text
credential_key: <key>
track: <TRACK>
persona: <PERSONA_ID or AI_ROLE>
environment: fixed_slot
custodian: CTO_MANAGED
sensitivity: STANDARD_QA_REUSABLE or LOW_QA_DISPOSABLE
bundle: docs/ops/qa-credential-bundle/test-accounts-encrypted.zip
```

**URI field:** `https://test5.lovebud.pages.dev` (or appropriate slot domain)

---

## Credential Storage Tiers

| Tier | Location | Purpose | Contains Secrets? |
|------|----------|---------|-------------------|
| **Tier 0** — Public-safe registry | This document, GitHub Issues, PRs | Account inventory, status tracking | ❌ No |
| **Tier 1** — Local runtime | `.local/test-accounts.json` (gitignored) | Browser login, automation | ✅ Yes |
| **Tier 2** — Encrypted backup | `docs/ops/qa-credential-bundle/test-accounts-encrypted.zip` | Cross-machine restore, password manager import | ✅ Yes (encrypted) |
| **Tier 3** — Password manager | Bitwarden Free / Proton Pass Free | Secure credential vault | ✅ Yes (encrypted) |

---

## Account Sensitivity Classes

| Class | Count | Examples | Storage | Reuse |
|-------|-------|----------|---------|-------|
| `STANDARD_QA_REUSABLE` | 11 | Personas A-E, Dev 1-2, Admin, AI Guides 1-2, AI Sample | Local + encrypted backup + password manager | Reusable |
| `LOW_QA_DISPOSABLE` | 2 | Signup disposable accounts | Local runtime + optional backup | Short-term, may retire after run |

---

## Security Rules

1. **Never** commit plaintext credentials to the repository
2. **Never** paste credential values in GitHub Issues, PRs, comments, docs, screenshots, or logs
3. **Never** print credential values in reports
4. **Never** store bundle passwords in the repository
5. **Always** distribute bundle passwords through secure channels (encrypted chat, in-person, etc.)
6. **Always** run `npm run check:auth-credentials -- --key <credential_key>` before browser auth verification
7. **Always** report only safe status labels in public

### Allowed Report Fields

- `account_label`
- `track`
- `persona_id` or `ai_role`
- `environment`
- `credential_key`
- `credential_location_label`
- `custodian`
- `status`
- `rotation_required`
- `cleanup_status`
- `last_verified_status`
- `secret values exposed: NO`

### Forbidden Report Fields

- `email`
- `password`
- `confirmPassword`
- `token`
- `session`
- `cookie`
- `private UID`
- `raw credential`
- `raw auth payload`

---

## Account Creation Report Template

Use this template when reporting account creation results:

```text
Synthetic Account Creation Report

Track: <TRACK>
Sensitivity class: <CLASS>
Account label: <LABEL>
Persona or AI role: <ROLE>
Environment: <ENV>
Credential key: <KEY>
Credential location label: APPROVED_PASSWORD_MANAGER + LOCAL_SECRET_STORE
Custodian: CTO_MANAGED
Account status: ACTIVE
Rotation required: NO
Cleanup status: NOT_REQUIRED
Production data created: NO
Secret/private data exposure: NO
Notes: <any>
```

---

## Related Documents

- [SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md](./SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md) — strategy and three-track model
- [QA_CREDENTIALS.md](./QA_CREDENTIALS.md) — credential workflow documentation
- [QA_ACCOUNT_USAGE.md](./QA_ACCOUNT_USAGE.md) — QA account usage policy (한국어)
- [qa-credential-bundle/README.md](./qa-credential-bundle/README.md) — encrypted bundle status
- [TEST_PREVIEW_SLOTS.md](./TEST_PREVIEW_SLOTS.md) — fixed test slot policy
- Issue [#873](https://github.com/skerishKang/LoveBud/issues/873) — this issue

---

| | | |
|---|---|---|
| **Created:** | 2026-05-12 | Issue #873 |
| **Updated:** | 2026-05-12 | Initial registration |
| **Custodian:** | CTO_MANAGED | Approved password manager |
