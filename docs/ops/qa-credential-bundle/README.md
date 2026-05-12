# QA Credential Bundle — Status

> ## Current Status
>
> **✅ BUNDLE COMMITTED — v1**
>
> The persistent encrypted bundle has been added to this directory.
> A new verifier **can restore QA credentials** from this path using the bundle password obtained via secure channel from the CTO.

---

## Bundle File

```
docs/ops/qa-credential-bundle/test-accounts-encrypted.zip
```

| Property | Value |
|----------|-------|
| Format | Password-protected ZIP |
| Contents | `qa-test-accounts-consolidated.json` (13 accounts) |
| SHA-256 | `34dce3c1235e53e36ccbe715c164429137efa06f5b79cf0b2e503e74bff4a7a9` |
| Created | 2026-05-12 |
| Status | ✅ Committed (v1) |

---

## Bundle Commit Record

| Version | Status | Committed by | Date | Commit SHA |
|---------|--------|--------------|------|------------|
| v1 | ✅ Committed | Issue #873 agent | 2026-05-12 | <!-- SHA inserted on commit --> |

---

## Restoration Procedure

1. Pull the latest branch containing the bundle
2. Locate bundle: `docs/ops/qa-credential-bundle/test-accounts-encrypted.zip`
3. Obtain the bundle password via secure channel from the CTO / bundle custodian
4. Extract using the bundle password
5. Copy extracted `qa-test-accounts-consolidated.json` to `.local/test-accounts.json`
6. Verify format matches `.local/test-accounts.example.json` without printing values
7. Run credential preflight: `npm run check:auth-credentials -- --key accounts.personaA001`

### Multi-Clone / Worktree Setup

```bash
# In each repository clone/worktree
mkdir -p .local
# Copy restored credentials from your master restore location
cp /path/to/your/restored/test-accounts.json .local/
```

Do not print the restored file contents.

---

## Legacy Temporary Handoff

The temporary handoff (Issue #351, branch `ops/temp-qa-credential-handoff`) is **superseded** by this persistent bundle. New verifiers should use this bundle instead.

---

## Procedure Validation Result

When reporting credential restore attempts, use this format:

```
procedure validation result: PROCEDURE WORKS | PARTIALLY WORKS | BLOCKED
credential source:           persistent bundle | temporary handoff (Issue #351) | pre-existing local file
secret values exposed:       NO
bundle committed to repo:    YES | NO
```

**Expected result for verifiers with this bundle:**
```
procedure validation result: PROCEDURE WORKS
credential source:           persistent bundle
secret values exposed:       NO
bundle committed to repo:    YES
```

---

## Related

- [../QA_CREDENTIALS.md](../QA_CREDENTIALS.md) — full workflow documentation
- [../QA_ACCOUNT_REGISTRY.md](../QA_ACCOUNT_REGISTRY.md) — public-safe account inventory for password manager registration
- [../SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md](../SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md) — account strategy and three-track model
- Issue [#873](https://github.com/skerishKang/LoveBud/issues/873) — Qa account registration
