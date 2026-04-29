# QA Credential Bundle — Status

## Current Status

> **⛔ BUNDLE NOT YET COMMITTED**

The persistent encrypted bundle has not been added to this directory.

A new verifier **cannot restore QA credentials from this path** until the bundle is committed here.

---

## Expected Bundle Path

```
docs/ops/qa-credential-bundle/test-accounts-encrypted.zip
```

Alternative (age-encrypted):
```
docs/ops/qa-credential-bundle/test-accounts.json.age
```

---

## Bundle Commit Record

| Version | Status | Committed by | Date | Commit SHA |
|---------|--------|--------------|------|------------|
| v1 | ⛔ Not committed | — | — | — |

Update this table when the bundle is first committed.

---

## Current Workaround

Until the persistent bundle is committed here, use the **temporary handoff** method:

- See Issue [#351](https://github.com/skerishKang/LoveBud/issues/351) for current handoff file location
- Temporary branch: `ops/temp-qa-credential-handoff`
- Temporary file: `test-accounts-encrypted-v2.zip` (or as documented in Issue #351)

⚠️ **The temporary handoff branch may be deleted after cleanup. Do not treat it as a permanent source.**

---

## Procedure Validation Result

When reporting credential restore attempts, use this format:

```
procedure validation result: PROCEDURE WORKS | PARTIALLY WORKS | BLOCKED
credential source:           persistent bundle | temporary handoff (Issue #351) | pre-existing local file
secret values exposed:       NO
bundle committed to repo:    YES | NO
```

**Current expected result for new verifiers:**
```
procedure validation result: BLOCKED
credential source:           temporary handoff (Issue #351)
secret values exposed:       NO
bundle committed to repo:    NO
```

---

## Related

- [../QA_CREDENTIALS.md](../QA_CREDENTIALS.md) — full workflow documentation
- [../QA_CREDENTIALS.txt](../QA_CREDENTIALS.txt) — 한국어 요약
- Issue [#351](https://github.com/skerishKang/LoveBud/issues/351) — temporary handoff
- Issue [#137](https://github.com/skerishKang/LoveBud/issues/137)
