# QA Credentials — Approved Non-Public Credential Store Workflow

Refs #4545
Refs #873

> **PROCEDURE STATUS (as of 2026-09-30)**
>
> **Repository credential bundle channel: RETIRED ✅**
>
> The public Git credential channel is closed. An encrypted credential bundle was
> previously committed under `docs/ops/qa-credential-bundle/`; that archive is no
> longer tracked, and it must not be restored from Git history or recommitted.
> See [qa-credential-bundle/README.md](qa-credential-bundle/README.md).
>
> **All 13 QA/AI actor accounts are registered in the approved password manager (Bitwarden Free).**
> That non-public store is the canonical credential custody.
> See [QA_ACCOUNT_REGISTRY.md](QA_ACCOUNT_REGISTRY.md) for the public-safe inventory.
>
> **Current working method: approved non-public password manager / custodian-controlled secret store.**
> `.local/test-accounts.json` is a gitignored local runtime file, not a source of
> truth. The temporary handoff via Issue #351 is superseded.
>
> **Rotation of the affected accounts is separately authorized work and has NOT been performed here.**

---

## Security boundary

Models, connector sessions, PR comments, Issue comments, screenshots, docs, and central systems must not access or expose actual QA credential values.

Allowed information is limited to:

- approved local path names;
- credential **location labels** and the retired bundle directory path as documentation only;
- whether a file exists;
- whether a local credential path is gitignored;
- whether required keys are present;
- whether verification used a Cloudflare Preview or fixed test slot.

Allowed status words include only:

- `EXISTS`
- `MISSING`
- `PRESENT`
- `GITIGNORED`
- `PASS`
- `BLOCKED`
- `REDACTED`

Forbidden:

- printing plaintext QA credentials;
- printing credential values or passwords of any kind;
- printing partial values, prefixes, suffixes, or last characters;
- committing plaintext `.local/test-accounts.json`;
- committing any credential archive (`.zip`, `.age`, or otherwise) to this repository;
- restoring credentials from Git history, old commits, tags, or forks;
- dumping environment variables;
- pasting credential file contents into chat, PRs, Issues, logs, screenshots, or reports.

Approved local checks:

```powershell
Test-Path .local/test-accounts.json
Test-Path .local/test-accounts.example.json
git check-ignore .local/test-accounts.json
npm run check:auth-credentials -- --key accounts.user
```

Do not run commands that print credential file contents, such as:

```powershell
Get-Content .local/test-accounts.json
type .local/test-accounts.json
cat .local/test-accounts.json
```

---

## Credential preflight before browser auth verification

Before any fixed-slot browser verification that depends on email/password login, run the local credential preflight from the repository root:

```bash
npm run check:auth-credentials -- --key accounts.user
```

The preflight is secret-safe. It reports only path, schema, key presence, empty/non-empty status, leading/trailing whitespace status, optional `confirmPassword` match status, and final status. It must not print email, password, token, session, cookie, UID, request payload, or private values.

Use this gate before Browser Auth Verification:

| Preflight result | Action |
|---|---|
| `CREDENTIAL_PREFLIGHT_PASS` | Browser Auth Verification may proceed. |
| `CREDENTIAL_PREFLIGHT_BLOCKED` | Fix local credential file or Firebase test user alignment before browser auth verification. |
| `CREDENTIAL_FILE_BLOCKED` | Restore or locate `.local/test-accounts.json` before browser auth verification. |

Required safe report fields:

```text
credential file absolute path: <local path only>
selected credential key: accounts.user
credential schema: OBJECT_MAP | LEGACY_ARRAY
accounts.user email: PRESENT_NONEMPTY | EMPTY | MISSING
accounts.user password: PRESENT_NONEMPTY | EMPTY | MISSING
email leading/trailing whitespace: YES | NO
password leading/trailing whitespace: YES | NO
confirmPassword: PRESENT_NONEMPTY | EMPTY | MISSING
password confirm match: YES | NO | NOT_CHECKED
credential values exposed: NO
secret exposure: NO
final status: CREDENTIAL_PREFLIGHT_PASS | CREDENTIAL_PREFLIGHT_BLOCKED | CREDENTIAL_FILE_BLOCKED
```

Do not proceed to PR behavior verification when the credential preflight is blocked. A Firebase `INVALID_LOGIN_CREDENTIALS` result after a successful fresh fixed-slot deploy should be treated as a credential/environment blocker until the preflight and Firebase user state are aligned.

---

## Canonical local credential schema

The preferred local runtime schema is an object map under `accounts`:

```json
{
  "version": "1.0",
  "accounts": {
    "user": {
      "email": "REDACTED",
      "password": "REDACTED",
      "confirmPassword": "REDACTED"
    },
    "user10": {
      "email": "REDACTED",
      "password": "REDACTED",
      "confirmPassword": "REDACTED"
    }
  }
}
```

The optional `confirmPassword` field is local-only and exists only to catch mistyped updates before browser verification. It must never be committed or printed.

Legacy array-shaped credential files may still exist temporarily:

```json
{
  "version": "1.0",
  "accounts": [
    {
      "id": "user",
      "email": "REDACTED",
      "password": "REDACTED"
    }
  ]
}
```

For new or repaired local credential files, prefer the object-map schema. Keep `accounts.user` as the default automation key. Slot-specific aliases such as `accounts.user10` may exist, but browser verification prompts must name the selected key explicitly.

---

## Overview

This document describes the current credential location model for managing QA test credentials.

| Location | Status | Contains secrets | Source of truth |
|---------|--------|------------------|-----------------|
| **Git repository** | ✅ Active, public-safe metadata only | ❌ No | Public-safe inventory, docs, status |
| **Approved non-public password manager / custodian secret store** | ✅ CURRENT credential custody | ✅ Yes | Yes — canonical |
| **Local runtime file** `.local/test-accounts.json` | ✅ Available, gitignored | ✅ Yes | No — runtime convenience only |
| **Temporary handoff** | 🔴 Superseded | — | Issue #351 (no longer needed) |
| **Repository credential bundle channel** | 🔴 RETIRED (Issue #4545) | — | No longer exists; see tombstone |

Do not use the temporary handoff branch (`ops/temp-qa-credential-handoff`).
Do not restore credentials from `docs/ops/qa-credential-bundle/` or from Git history.
Obtain current credentials from the approved non-public password manager / custodian-controlled secret store only.

---

## Architecture

### QA Account Slots

- `qa-user-01` ~ `qa-user-08` (8 user slots)
- `qa-admin-01` ~ `qa-admin-02` (2 admin slots)
- **Total: 10 slots**

### Security Model

- **Repository**: Public-safe metadata only — account labels, credential keys, persona/role, environment, status, sensitivity class, custodian labels. No credential values and no credential archives.
- **Approved Non-Public Store**: Password manager / custodian-controlled secret store holds the actual credentials.
- **Local Runtime**: Uses `.local/test-accounts.json` (gitignored, runtime only, not a source of truth)
- **No Plaintext**: Credentials never committed in plain text
- **No Archives**: No credential archive is tracked in this repository; `.gitignore` blocks the retired channel.
- **Passwords**: Never documented in the repository
- **Reports**: Use status only; never values

---

## Current Credential Location Model (CURRENT)

> **✅ ACTIVE: approved non-public credential store.**
> The repository holds public-safe metadata only. This section describes the active workflow.

### Approved Current Source

```text
approved non-public password manager / custodian-controlled secret store
```

This is the canonical credential custody. Public-safe inventory of what belongs
there — labels, credential keys, persona/role, environment, status, sensitivity
class, custodian labels — is in [QA_ACCOUNT_REGISTRY.md](QA_ACCOUNT_REGISTRY.md).

### Repository Structure

```
docs/ops/QA_CREDENTIALS.md                              # This documentation
docs/ops/QA_ACCOUNT_REGISTRY.md                         # Public-safe account inventory
docs/ops/qa-credential-bundle/README.md                 # Tombstone: retired channel (no secrets)
.local/test-accounts.json                               # Runtime credentials (gitignored, not source of truth)
.local/test-accounts.example.json                       # Example format (committed)
```

### Retired Repository Credential Channel

An encrypted bundle was previously committed at `docs/ops/qa-credential-bundle/`.
That channel is **RETIRED**. It is a tombstone only.

```text
STATUS=RETIRED_PUBLIC_GIT_CREDENTIAL_CHANNEL
NO_CREDENTIAL_MATERIAL_TRACKED_HERE
HISTORICAL_GIT_COPY=NONAUTHORITATIVE
ROTATION_STATUS=ROTATION_REQUIRED
```

Do not:

- restore reusable credentials from Git history, old commits, tags, or forks;
- extract the historical archive for verification or convenience;
- recommit any credential bundle, encrypted or plaintext.

Historical copies may still exist in clones, forks, and history:

```text
HISTORICAL_BLOB_EXISTS_POSSIBLY=YES
CREDENTIAL_ROTATION_REQUIRED=YES
```

### For Computer 2 (Local Verifier) — Local Runtime Setup

**Decision tree before starting:**

```
Step 1: Do you have access to the approved non-public password manager / secret store?
  ├─ YES → Retrieve the selected credential entry and continue.
  └─ NO  → BLOCKED. Do not fall back to Git history or any repository archive.

Step 2: Does .local/test-accounts.json already exist on your machine?
  ├─ YES → Pre-existing local runtime file. Not a docs-based restore.
  │        Report: credential source = pre-existing local file
  └─ NO  → Populate it from the approved non-public store.
```

**Local runtime setup procedure:**

1. Obtain the selected credential entry from the approved non-public password manager / custodian secret store via the approved operator channel
2. Write it to `.local/test-accounts.json`
3. Verify format matches `.local/test-accounts.example.json` without printing values
4. Run the credential preflight

#### Multi-Clone / Worktree Setup

For each new clone or worktree:

```bash
# In each repository clone/worktree
mkdir -p .local
# Populate from the approved non-public store; never from Git history.
cp /path/to/your/locally-retrieved/test-accounts.json .local/
```

Do not print the file contents.

---

## Temporary Handoff Workflow (Issue #351) — SUPERSEDED

> **🔴 NO LONGER ACTIVE.**

The temporary handoff workflow via Issue #351 is superseded. It and the retired
repository bundle channel are both non-current.

Do not use the `ops/temp-qa-credential-handoff` branch.

---

## For Computer 1 (Credential Custodian)

### Credential Custody Rules

1. The approved non-public password manager / custodian-controlled secret store holds the actual credentials.
2. This repository holds public-safe metadata only.
3. No credential archive is committed here — `.gitignore` blocks the retired channel.
4. Updating [QA_ACCOUNT_REGISTRY.md](QA_ACCOUNT_REGISTRY.md) is allowed when account labels, counts, or public-safe metadata change.

### Credential Rotation

Rotation and retirement of the QA/AI accounts are **custodian and provider work under separate authority**.

```text
ROTATION_STATUS=ROTATION_REQUIRED
ROTATION_AUTHORITY=SEPARATE / NOT_EXERCISED_BY_THIS_DOCUMENT
```

- Do not rotate credentials as part of a documentation, source, or test change.
- Do not rotate by creating and committing an updated bundle. That practice is retired.
- Do not create a new credential archive to replace the retired one.

---

## PR #350 Verification Standard

> **⚠️ Local static server is NOT a final PASS for PR #350 verification.**

| Method | Verdict |
|---|---|
| `python -m http.server` or equivalent local static server | ❌ Not final PASS |
| Cloudflare PR Preview URL | ✅ Valid |
| Fixed test slot (see `TEST_PREVIEW_SLOTS.md`) | ✅ Valid |

Final verification for PR #350 must be performed against a **fixed test slot** or **Cloudflare PR Preview** URL. Local server results are preliminary only and must not be reported as final PASS.

---

## Verification Checklist

### Credential Channel Boundary

- [x] No credential archive is tracked in this repository
- [x] `docs/ops/qa-credential-bundle/` is a non-secret tombstone
- [x] No plaintext credentials in repository
- [x] `docs/ops/qa-credential-bundle/README.md` records the retired channel and its historical note
- [x] `docs/ops/QA_ACCOUNT_REGISTRY.md` documents all accounts (public-safe inventory)
- [x] `git ls-files 'docs/ops/qa-credential-bundle/*'` returns only `README.md`

### Local Setup

- [ ] `.local/test-accounts.json` exists (populate from the approved non-public store)
- [ ] `.local/test-accounts.json` is gitignored
- [ ] File format matches the canonical schema without printing values
- [ ] `npm run check:auth-credentials -- --key accounts.personaA001` returns `CREDENTIAL_PREFLIGHT_PASS`
- [ ] All 13 QA slots are populated, reported only as `PRESENT`/`MISSING`
- [x] All accounts registered in approved password manager (Bitwarden Free)

### Multi-Repository Usage

- [ ] Credentials copied to all required clones/worktrees from the approved non-public store
- [ ] Each repository can read credentials independently
- [x] No credential archive extraction is required

---

## Security Guidelines

### Do's

- Use strong, unique passwords for every QA/AI account
- Keep credentials in the approved non-public password manager / custodian secret store
- Retrieve credentials for local runtime only through approved operator channels
- Rotate credentials under separately authorized custodian/provider work
- Report only path/status information

### Don'ts

- Never commit plaintext `.local/test-accounts.json`
- Never commit any credential archive (`.zip`, `.age`, or otherwise) to this repository
- Never restore reusable credentials from Git history, old commits, tags, or forks
- Never extract a historical credential archive for verification or convenience
- Never document credential passwords in the repository
- Never treat `ops/temp-qa-credential-handoff` as a permanent source
- Never treat any surviving historical repository copy as a current credential source
- Never print credential file contents
- Never dump all environment variables

---

## Troubleshooting

### Common Issues

1. **Missing `.local/test-accounts.json`**
   - Retrieve the selected credential entry from the approved non-public password manager / custodian secret store
   - Do not fall back to the retired `docs/ops/qa-credential-bundle/` channel or to Git history
   - If non-public store access is unavailable, report `BLOCKED`
   - Check file permissions

2. **Procedure appears to work but the local file already existed**
   - If `.local/test-accounts.json` already existed before setup, that is a **pre-existing local credential**, not a setup success
   - Always confirm whether the file existed before starting

3. **Invalid credential format or selected key**
   - Use `npm run check:auth-credentials -- --key accounts.user`
   - Verify JSON structure without printing values
   - Report only missing required keys as `MISSING`
   - Prefer the object-map schema with `accounts.user` for new or repaired local files

4. **Credential mismatch despite existing Firebase user**
   - Confirm the selected credential key is the intended key, such as `accounts.user`
   - Check that email/password are `PRESENT_NONEMPTY`
   - Check `email leading/trailing whitespace` and `password leading/trailing whitespace`
   - If `confirmPassword` exists, require `password confirm match: YES`
   - If Firebase returns `INVALID_LOGIN_CREDENTIALS`, realign the local credential and Firebase Auth user before PR behavior verification

5. **Credential retrieval from the non-public store fails**
   - Report `BLOCKED` with status only
   - Escalate to the credential custodian through the approved operator channel
   - Do not substitute a historical repository copy

### Recovery Procedures

If credentials are lost or corrupted:

1. Retrieve the affected entries from the approved non-public password manager / custodian secret store
2. If unavailable, escalate to the credential custodian; report by safe label only
3. Do not restore from the retired repository channel or from Git history
4. Verify all QA slots work correctly without printing values

---

## Reporting Template

When reporting credential workflow results:

```
procedure validation result: PROCEDURE WORKS | PARTIALLY WORKS | BLOCKED
credential source:           approved non-public store | pre-existing local file
secret values exposed:       NO
credential archive tracked:  NO
credential file:             EXISTS | MISSING
credential file gitignored:  YES | NO
verification environment:    Cloudflare PR Preview | fixed test slot | [other]
```

**Example (current state):**
```
procedure validation result: PROCEDURE WORKS
credential source:           approved non-public store
secret values exposed:       NO
credential archive tracked:  NO
credential file:             EXISTS (populated from approved non-public store) | MISSING
credential file gitignored:  YES
verification environment:    fixed test slot
```

---

## Related Documents

- [AGENTS.md](AGENTS.md)
- [AGENT_SECURITY.md](AGENT_SECURITY.md)
- [QA_ACCOUNT_REGISTRY.md](QA_ACCOUNT_REGISTRY.md) — public-safe account inventory for password manager registration
- [qa-credential-bundle/README.md](qa-credential-bundle/README.md) — retired credential channel tombstone (no secrets)
- `tests/contracts/qa-credential-public-git-boundary-4545.test.cjs` — tracked-archive ban and no-current-restore-authority guard
- [LOCAL_BROWSER_VERIFICATION_STARTUP.md](LOCAL_BROWSER_VERIFICATION_STARTUP.md)
- [GITHUB_AUTH_TOKEN_USAGE.md](GITHUB_AUTH_TOKEN_USAGE.md)
- [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md)
- [BROWSER_VERIFICATION_URL_POLICY.md](BROWSER_VERIFICATION_URL_POLICY.md)
- Issue [#873](https://github.com/skerishKang/LoveBud/issues/873) — QA account registration in approved password manager
