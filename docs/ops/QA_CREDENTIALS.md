# QA Credentials — Persistent Encrypted Bundle Workflow

> **✅ PROCEDURE STATUS (as of 2026-05-12)**
>
> **Persistent encrypted bundle: COMMITTED ✅**
>
> The bundle file (`docs/ops/qa-credential-bundle/test-accounts-encrypted.zip`) exists in the repository.
> A new verifier **can restore credentials** from the bundle using the password obtained via secure channel from the CTO.
>
> **All 13 QA/AI actor accounts are registered in the approved password manager (Bitwarden Free).**
> See [QA_ACCOUNT_REGISTRY.md](QA_ACCOUNT_REGISTRY.md) for the public-safe inventory.
>
> **Current working method: Persistent encrypted bundle**
> The temporary handoff via Issue #351 is superseded.

---

## Security boundary

Models, connector sessions, PR comments, Issue comments, screenshots, docs, and central systems must not access or expose actual QA credential values.

Allowed information is limited to:

- approved local path names;
- bundle path names;
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
- printing bundle passwords;
- printing partial values, prefixes, suffixes, or last characters;
- committing plaintext `.local/test-accounts.json`;
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

This document describes two distinct workflows for managing QA test credentials:

| Workflow | Status | Source of truth |
|---------|--------|----------------|
| **Persistent encrypted bundle** | ✅ Bundle committed (v1) | docs/ops/qa-credential-bundle/ |
| **Temporary handoff** | 🔴 Superseded | Issue #351 (no longer needed) |

Do not use the temporary handoff branch (`ops/temp-qa-credential-handoff`). It may be deleted after cleanup. Use the persistent bundle at `docs/ops/qa-credential-bundle/test-accounts-encrypted.zip` instead.

---

## Architecture

### QA Account Slots

- `qa-user-01` ~ `qa-user-08` (8 user slots)
- `qa-admin-01` ~ `qa-admin-02` (2 admin slots)
- **Total: 10 slots**

### Security Model

- **Repository**: Will contain only encrypted bundle (password-protected ZIP or `.age` file)
- **Local Runtime**: Uses decrypted `.local/test-accounts.json` (gitignored)
- **No Plaintext**: Credentials never committed in plain text
- **Bundle Password**: Never documented in repository
- **Reports**: Use status only; never values

---

## Persistent Encrypted Bundle Workflow (CURRENT)

> **✅ ACTIVE: Bundle committed (v1).**
> This section describes the active persistent workflow.

### Bundle Location

```
docs/ops/qa-credential-bundle/test-accounts-encrypted.zip
```

The bundle contains a consolidated JSON file with all 13 QA and AI actor accounts. See [QA_ACCOUNT_REGISTRY.md](QA_ACCOUNT_REGISTRY.md) for the full public-safe inventory.

### Repository Structure

```
docs/ops/QA_CREDENTIALS.md                              # This documentation
docs/ops/QA_ACCOUNT_REGISTRY.md                         # Public-safe account inventory
docs/ops/qa-credential-bundle/README.md                 # Bundle status and path
docs/ops/qa-credential-bundle/test-accounts-encrypted.zip  # ✅ Committed (v1)
.local/test-accounts.json                               # Runtime credentials (gitignored)
.local/test-accounts.example.json                       # Example format (committed)
```

### For Computer 2 (Local Verifier) — Persistent Restore

**Decision tree before starting:**

```
Step 1: Does docs/ops/qa-credential-bundle/test-accounts-encrypted.zip exist in repo?
  ├─ YES → Follow persistent restore procedure below
  └─ NO  → Bundle not yet committed. Use Temporary Handoff (Issue #351) instead.

Step 2: Does .local/test-accounts.json already exist on your machine?
  ├─ YES → You have a pre-existing local credential file.
  │        This is NOT a docs-based restore success.
  │        Report: credential source = pre-existing local file
  └─ NO  → Proceed with bundle restore.
```

**Persistent restore procedure (only when bundle exists in repo):**

1. Pull latest branch containing the bundle
2. Locate bundle: `docs/ops/qa-credential-bundle/test-accounts-encrypted.zip`
3. Extract using the bundle password obtained via secure channel from bundle custodian
4. Copy extracted `test-accounts.json` to `.local/test-accounts.json`
5. Verify format matches `.local/test-accounts.example.json` without printing values

#### Multi-Clone / Worktree Setup

For each new clone or worktree:

```bash
# In each repository clone/worktree
mkdir -p .local
# Copy restored credentials from your master restore location
cp /path/to/your/restored/test-accounts.json .local/
```

Do not print the restored file contents.

---

## Temporary Handoff Workflow (Issue #351) — SUPERSEDED

> **🔴 NO LONGER ACTIVE — Use the persistent bundle instead.**

The temporary handoff workflow via Issue #351 has been superseded by the persistent encrypted bundle at `docs/ops/qa-credential-bundle/test-accounts-encrypted.zip`.

Do not use the `ops/temp-qa-credential-handoff` branch. It may be deleted during cleanup.

---

## For Computer 1 (Bundle Custodian)

### Bundle Update Procedure

When credentials need rotation:

1. Update the local consolidated credentials file
2. Create new encrypted bundle: `zip -P <new_password> docs/ops/qa-credential-bundle/test-accounts-encrypted.zip <source.json>`
3. Update `docs/ops/qa-credential-bundle/README.md` with new SHA and date
4. Update `docs/ops/QA_ACCOUNT_REGISTRY.md` if account labels or counts changed
5. Commit the updated bundle and documentation
6. Notify verifiers of new bundle availability
7. Distribute new password securely

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

### Bundle Integrity

- [x] Bundle contains all 13 QA/AI actor accounts
- [x] Bundle is password-protected
- [x] Bundle file is committed to `docs/ops/qa-credential-bundle/`
- [x] No plaintext credentials in repository
- [x] `docs/ops/qa-credential-bundle/README.md` reflects current bundle SHA
- [x] `docs/ops/QA_ACCOUNT_REGISTRY.md` documents all accounts (public-safe inventory)

### Local Setup

- [ ] `.local/test-accounts.json` exists (restore from bundle if needed)
- [ ] `.local/test-accounts.json` is gitignored
- [ ] File format matches the canonical schema without printing values
- [ ] `npm run check:auth-credentials -- --key accounts.personaA001` returns `CREDENTIAL_PREFLIGHT_PASS`
- [ ] All 13 QA slots are populated, reported only as `PRESENT`/`MISSING`
- [x] All accounts registered in approved password manager (Bitwarden Free)

### Multi-Repository Usage

- [ ] Credentials copied to all required clones/worktrees
- [ ] Each repository can read credentials independently
- [ ] No repeated bundle extraction needed

---

## Security Guidelines

### Do's

- Use strong passwords for bundle encryption
- Distribute bundle passwords through secure channels
- Rotate credentials regularly
- Verify bundle integrity after extraction
- Report only path/status information

### Don'ts

- Never commit plaintext `.local/test-accounts.json`
- Never document bundle passwords in repository
- Never share bundle passwords in plaintext channels
- Never store bundle passwords in scripts
- Never treat `ops/temp-qa-credential-handoff` branch as a permanent source
- Never print credential file contents
- Never dump all environment variables

---

## Troubleshooting

### Common Issues

1. **Missing `.local/test-accounts.json`**
   - Check if persistent bundle exists in `docs/ops/qa-credential-bundle/`
   - If not: use temporary handoff (Issue #351)
   - If yes: extract bundle and restore
   - Verify bundle password through secure channel
   - Check file permissions

2. **Procedure appears to work but bundle was not used**
   - If `.local/test-accounts.json` already existed before restore attempt, that is a **pre-existing local credential**, not a docs-based restore
   - Always confirm whether the file existed before starting the procedure

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

5. **Bundle extraction fails**
   - Verify bundle file integrity
   - Check bundle password through secure channel
   - Re-download bundle from repository if corrupted

### Recovery Procedures

If credentials are lost or corrupted:

1. Check if persistent bundle exists in `docs/ops/qa-credential-bundle/`
2. If yes: extract from persistent bundle after contacting custodian for password
3. If no: use temporary handoff via Issue #351
4. Verify all QA slots work correctly without printing values

---

## Reporting Template

When reporting credential workflow results:

```
procedure validation result: PROCEDURE WORKS | PARTIALLY WORKS | BLOCKED
credential source:           persistent bundle | temporary handoff (Issue #351) | pre-existing local file
secret values exposed:       NO
bundle committed to repo:    YES | NO
credential file:             EXISTS | MISSING
credential file gitignored:  YES | NO
verification environment:    Cloudflare PR Preview | fixed test slot | [other]
```

**Example (current state — bundle committed):**
```
procedure validation result: PROCEDURE WORKS
credential source:           persistent bundle
secret values exposed:       NO
bundle committed to repo:    YES
credential file:             EXISTS (restored from bundle) | MISSING
credential file gitignored:  YES
verification environment:    fixed test slot
```

---

## Related Documents

- [AGENTS.md](AGENTS.md)
- [AGENT_SECURITY.md](AGENT_SECURITY.md)
- [QA_ACCOUNT_REGISTRY.md](QA_ACCOUNT_REGISTRY.md) — public-safe account inventory for password manager registration
- [qa-credential-bundle/README.md](qa-credential-bundle/README.md) — persistent bundle commit status
- [LOCAL_BROWSER_VERIFICATION_STARTUP.md](LOCAL_BROWSER_VERIFICATION_STARTUP.md)
- [GITHUB_AUTH_TOKEN_USAGE.md](GITHUB_AUTH_TOKEN_USAGE.md)
- [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md)
- [BROWSER_VERIFICATION_URL_POLICY.md](BROWSER_VERIFICATION_URL_POLICY.md)
- Issue [#873](https://github.com/skerishKang/LoveBud/issues/873) — QA account registration in approved password manager
