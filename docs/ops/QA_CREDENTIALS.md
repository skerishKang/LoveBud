# QA Credentials — Persistent Encrypted Bundle Workflow

> **⚠️ PROCEDURE STATUS (as of 2026-04-29)**
>
> **Persistent encrypted bundle: NOT YET COMMITTED TO REPOSITORY**
>
> The bundle file (`docs/ops/qa-credential-bundle/test-accounts-encrypted.zip`) does not yet exist in the repository.
> A new verifier **cannot restore credentials from docs alone** until the bundle is committed.
>
> **Current working method: Temporary handoff via Issue #351**
> See [Temporary Handoff Workflow](#temporary-handoff-workflow-issue-351) below.

---

## Overview

This document describes two distinct workflows for managing QA test credentials:

| Workflow | Status | Source of truth |
|---|---|---|
| **Persistent encrypted bundle** | ⛔ Bundle not yet committed | This document (future) |
| **Temporary handoff** | ✅ Currently active | Issue #351 comment |

Do not conflate these two workflows. The temporary handoff branch (`ops/temp-qa-credential-handoff`) is a transitional mechanism and will be cleaned up. It is **not** the persistent source of truth.

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

---

## Persistent Encrypted Bundle Workflow (TARGET STATE)

> **⛔ NOT ACTIVE: Bundle not yet committed.**
> This section describes the intended persistent workflow once the bundle is added.

### Bundle Location (Once Committed)

```
docs/ops/qa-credential-bundle/test-accounts-encrypted.zip
```

Alternative (age-encrypted):
```
docs/ops/qa-credential-bundle/test-accounts.json.age
```

See [`docs/ops/qa-credential-bundle/README.md`](qa-credential-bundle/README.md) for bundle commit status.

### Repository Structure (Target)

```
docs/ops/QA_CREDENTIALS.md                              # This documentation
docs/ops/qa-credential-bundle/README.md                 # Bundle status and path
docs/ops/qa-credential-bundle/test-accounts-encrypted.zip  # ← NOT YET ADDED
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
3. Extract using the bundle password (obtained via secure channel from bundle custodian)
4. Copy extracted `test-accounts.json` to `.local/test-accounts.json`
5. Verify format matches `.local/test-accounts.example.json`

#### Multi-Clone / Worktree Setup

For each new clone or worktree:

```bash
# In each repository clone/worktree
mkdir -p .local
# Copy restored credentials from your master restore location
cp /path/to/your/restored/test-accounts.json .local/
```

---

## Temporary Handoff Workflow (Issue #351)

> **✅ CURRENTLY ACTIVE — use this until persistent bundle is committed.**

### Source

- **Issue**: [#351](https://github.com/skerishKang/LoveBud/issues/351)
- **Temporary branch**: `ops/temp-qa-credential-handoff`
- **File in branch**: `test-accounts-encrypted-v2.zip` (or as documented in Issue #351)

### ⚠️ Temporary Handoff Limitations

- This branch **may be deleted** after cleanup. Do not treat it as a permanent source.
- The file in this branch is a one-time transfer artifact, not a versioned credential store.
- A new verifier cannot bootstrap solely from this branch without the Issue #351 context and the bundle password.
- **This is not the source of truth for the persistent workflow.**

### Procedure

1. Read Issue #351 for the current handoff file location and instructions
2. Obtain bundle password via secure channel
3. Extract bundle and copy to `.local/test-accounts.json`
4. Verify credentials are valid
5. Report: `credential source: temporary handoff (Issue #351)`

---

## For Computer 1 (Bundle Custodian)

### Bundle Creation (Persistent)

1. Prepare credentials file with all 10 slots
2. Create password-protected ZIP bundle
3. Commit bundle to `docs/ops/qa-credential-bundle/test-accounts-encrypted.zip`
4. Update `docs/ops/qa-credential-bundle/README.md` with commit SHA and date
5. Distribute bundle password through secure channel
6. Once persistent bundle is committed, mark Issue #351 temporary handoff as superseded

### Bundle Update Procedure

When credentials need rotation:

1. Update local credentials file
2. Create new encrypted bundle
3. Replace `docs/ops/qa-credential-bundle/test-accounts-encrypted.zip` in repo
4. Update README with new SHA and date
5. Notify Computer 2 of new bundle availability
6. Distribute new password securely

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

### Bundle Integrity (when bundle exists)

- [ ] Bundle contains all 10 QA slots
- [ ] Bundle is password-protected
- [ ] Bundle file is committed to `docs/ops/qa-credential-bundle/`
- [ ] No plaintext credentials in repository
- [ ] `docs/ops/qa-credential-bundle/README.md` reflects current bundle SHA

### Local Setup

- [ ] `.local/test-accounts.json` exists
- [ ] File format matches example structure
- [ ] All QA slots are populated
- [ ] Credentials are valid for testing

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

### Don'ts

- Never commit plaintext `.local/test-accounts.json`
- Never document bundle passwords in repository
- Never share bundle passwords in plaintext channels
- Never store bundle passwords in scripts
- Never treat `ops/temp-qa-credential-handoff` branch as a permanent source

---

## Troubleshooting

### Common Issues

1. **Missing `.local/test-accounts.json`**
   - Check if persistent bundle exists in `docs/ops/qa-credential-bundle/`
   - If not: use temporary handoff (Issue #351)
   - If yes: extract bundle and restore
   - Verify bundle password
   - Check file permissions

2. **Procedure appears to work but bundle was not used**
   - If `.local/test-accounts.json` already existed before restore attempt, that is a **pre-existing local credential**, not a docs-based restore
   - Always confirm whether the file existed before starting the procedure

3. **Invalid credential format**
   - Compare with `.local/test-accounts.example.json`
   - Verify JSON structure
   - Check for missing required fields

4. **Bundle extraction fails**
   - Verify bundle file integrity
   - Check bundle password
   - Re-download bundle from repository if corrupted

### Recovery Procedures

If credentials are lost or corrupted:

1. Check if persistent bundle exists in `docs/ops/qa-credential-bundle/`
2. If yes: extract from persistent bundle (contact custodian for password)
3. If no: use temporary handoff via Issue #351
4. Verify all QA slots work correctly

---

## Reporting Template

When reporting credential workflow results:

```
procedure validation result: PROCEDURE WORKS | PARTIALLY WORKS | BLOCKED
credential source:           persistent bundle | temporary handoff (Issue #351) | pre-existing local file
secret values exposed:       NO
bundle committed to repo:    YES | NO
verification environment:    Cloudflare PR Preview | fixed test slot | [other]
```

**Example (current state — bundle not yet committed):**
```
procedure validation result: BLOCKED
credential source:           temporary handoff (Issue #351)
secret values exposed:       NO
bundle committed to repo:    NO
verification environment:    fixed test slot
```

---

## Related Documents

- [qa-credential-bundle/README.md](qa-credential-bundle/README.md) — persistent bundle commit status
- [LOCAL_BROWSER_VERIFICATION_STARTUP.md](LOCAL_BROWSER_VERIFICATION_STARTUP.md)
- [GITHUB_AUTH_TOKEN_USAGE.md](GITHUB_AUTH_TOKEN_USAGE.md)
- [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md)
- [BROWSER_VERIFICATION_URL_POLICY.md](BROWSER_VERIFICATION_URL_POLICY.md)
- Issue [#351](https://github.com/skerishKang/LoveBud/issues/351) — temporary handoff
- Issue [#137](https://github.com/skerishKang/LoveBud/issues/137)
