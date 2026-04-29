# QA Credentials - Persistent Encrypted Bundle Workflow

## Overview

This document describes the workflow for managing QA test credentials using a persistent encrypted bundle. This approach allows local verifiers to restore credentials across multiple clones/worktrees without storing plaintext credentials in the repository.

## Architecture

### Components

1. **Encrypted Bundle**: Stored in repository (password-protected ZIP)
2. **Local Restore Target**: `.local/test-accounts.json` (gitignored)
3. **QA Account Slots**: 10 total slots
   - `qa-user-01` ~ `qa-user-08` (8 user slots)
   - `qa-admin-01` ~ `qa-admin-02` (2 admin slots)

### Security Model

- **Repository**: Contains only encrypted bundle
- **Local Runtime**: Uses decrypted `.local/test-accounts.json`
- **No Plaintext**: Credentials never committed in plain text
- **Bundle Password**: Never documented in repository

## Workflow

### For Computer 2 (Local Verifier)

#### Initial Setup

1. Obtain encrypted bundle from Computer 1
2. Extract bundle locally using provided password
3. Copy extracted credentials to `.local/test-accounts.json`
4. Verify file format matches `.local/test-accounts.example.json`

#### Multi-Clone/Worktree Setup

For each new clone or worktree:

```bash
# In each repository clone/worktree
mkdir -p .local
# Copy restored credentials from your master location
cp /path/to/your/restored/test-accounts.json .local/
```

#### Usage Pattern

- Single restore operation per machine
- Multiple repositories can share same credentials
- Credentials persist across worktree operations
- No repeated bundle extraction needed

### For Computer 1 (Bundle Custodian)

#### Bundle Creation

1. Prepare credentials file with all 10 slots
2. Create password-protected ZIP bundle
3. Store bundle in repository (committed)
4. Distribute bundle password through secure channel

#### Bundle Structure

```
qa-credential-bundle.zip
  test-accounts.json
    qa-user-01: {email, password, displayName}
    qa-user-02: {email, password, displayName}
    ...
    qa-user-08: {email, password, displayName}
    qa-admin-01: {email, password, displayName}
    qa-admin-02: {email, password, displayName}
```

#### Update Procedure

When credentials need rotation:

1. Update local credentials file
2. Create new encrypted bundle
3. Commit new bundle to repository
4. Notify Computer 2 of new bundle availability
5. Distribute new password securely

## File Locations

### Repository Structure

```
docs/ops/QA_CREDENTIALS.md          # This documentation
.local/test-accounts.json          # Runtime credentials (gitignored)
.local/test-accounts.example.json  # Example format (committed)
[qa-credential-bundle.zip]         # Encrypted bundle (location TBD)
```

### Git Configuration

`.gitignore` ensures runtime credentials are never committed:

```
.local/test-accounts.json
```

## Verification Checklist

### Bundle Integrity

- [ ] Bundle contains all 10 QA slots
- [ ] Bundle is password-protected
- [ ] Bundle file is committed to repository
- [ ] No plaintext credentials in repository

### Local Setup

- [ ] `.local/test-accounts.json` exists
- [ ] File format matches example structure
- [ ] All QA slots are populated
- [ ] Credentials are valid for testing

### Multi-Repository Usage

- [ ] Credentials copied to all required clones/worktrees
- [ ] Each repository can read credentials independently
- [ ] No repeated bundle extraction needed

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

## Troubleshooting

### Common Issues

1. **Missing `.local/test-accounts.json`**
   - Extract bundle again
   - Verify bundle password
   - Check file permissions

2. **Invalid credential format**
   - Compare with `.local/test-accounts.example.json`
   - Verify JSON structure
   - Check for missing required fields

3. **Bundle extraction fails**
   - Verify bundle file integrity
   - Check bundle password
   - Re-download bundle if corrupted

### Recovery Procedures

If credentials are lost or corrupted:

1. Contact Computer 1 (bundle custodian)
2. Request fresh bundle extraction
3. Follow initial setup procedure
4. Verify all QA slots work correctly

## Reporting

When using this workflow in reports:

- **credential source**: encrypted bundle restored to `.local/test-accounts.json`
- **account slots count**: 10
- **secret values exposed**: NO

## Related Documents

- [LOCAL_BROWSER_VERIFICATION_STARTUP.md](LOCAL_BROWSER_VERIFICATION_STARTUP.md)
- [GITHUB_AUTH_TOKEN_USAGE.md](GITHUB_AUTH_TOKEN_USAGE.md)
- [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md)
