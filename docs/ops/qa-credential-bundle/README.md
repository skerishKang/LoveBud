# QA Credential Bundle — Retired Public Git Channel

Refs #4545
Refs #873

This directory is a **tombstone**. It is retained so the historical record stays
accurate and so nobody re-creates the retired channel by accident.

```text
STATUS=RETIRED_PUBLIC_GIT_CREDENTIAL_CHANNEL

NO_CREDENTIAL_MATERIAL_TRACKED_HERE

APPROVED_CURRENT_SOURCE=
approved private shared credential store / custodian-controlled shared secret store
(current implementation: Google Drive-backed operator share; public-safe inventory: ../QA_ACCOUNT_REGISTRY.md)

HISTORICAL_NOTE=
an encrypted bundle of reusable QA/AI account credentials was previously
committed at docs/ops/qa-credential-bundle/test-accounts-encrypted.zip
(Issue #873, 2026-05-12). The archive password was never committed.

HISTORICAL_GIT_COPY=NONAUTHORITATIVE

ROTATION_STATUS=ROTATION_REQUIRED
rotation and retirement of the affected accounts are separately authorized
operations and were NOT executed by the removal of this channel

DO_NOT=
- restore reusable credentials from Git history, old commits, tags, or forks
- extract the historical archive for verification or convenience
- recommit any credential bundle, encrypted or plaintext, to this repository
- treat any surviving historical copy as a current credential source
```

## Why this channel was retired

Issue #4545 — the repository is public. Distributing an encrypted archive of
reusable QA/AI account credentials through public Git publishes that archive to
every clone, fork, and mirror even when the archive itself is encrypted. The
distribution channel, not the archive encryption, was the defect.

Removing the tracked archive from the current tip reduces future exposure. It
does **not** and cannot remove copies that already exist in history:

```text
HISTORICAL_BLOB_EXISTS_POSSIBLY=YES
CREDENTIAL_ROTATION_REQUIRED=YES
```

This document asserts nothing about whether any historical archive was ever
opened, whether any password was ever guessed, guessed correctly, leaked, or
compromised, or whether any account was ever accessed. Those questions are not
answered here and are not answered by this change.

## Current credential model

```text
Tier 0 — Public-safe metadata (this repository)
         account labels, credential keys, persona/role, environment, status,
         sensitivity class, custodian labels. No credential values.

Tier 1 — Local runtime file
         .local/test-accounts.json  (gitignored, runtime convenience only,
         NOT a source of truth)

Tier 2 — Approved private shared credential custody
         Google Drive-backed operator share or equivalent approved custodian-controlled shared store.
         This is the canonical recovery location; password managers are optional secondary custody.
```

Never commit plaintext `.local/test-accounts.json`. Never commit any credential
archive. `.gitignore` blocks `docs/ops/qa-credential-bundle/*.zip`, `*.age`, and
`*.json` so that this README stays trackable while credential artifacts do not.

## Rotation

Rotation of the accounts referenced by the historical bundle is custodian and
provider work under separate authority. Do not perform rotation by committing an
updated bundle, and do not rotate as part of a documentation change.

See [Issue #4545](https://github.com/skerishKang/LoveBud/issues/4545) for the
remaining rotation/retirement work.

## Regression guard

`tests/contracts/qa-credential-public-git-boundary-4545.test.cjs` fails closed if
any credential archive is tracked under this directory, or if any documentation
re-introduces this directory as a current restore source or allowed secret
location.

## Related

- [../QA_CREDENTIALS.md](../QA_CREDENTIALS.md) — current credential workflow
- [../QA_CREDENTIALS.txt](../QA_CREDENTIALS.txt) — 한국어 mirror
- [../QA_ACCOUNT_REGISTRY.md](../QA_ACCOUNT_REGISTRY.md) — public-safe account inventory
- [../SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md](../SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md) — account strategy and storage tiers
- Issue [#873](https://github.com/skerishKang/LoveBud/issues/873) — QA account registration
- Issue [#4545](https://github.com/skerishKang/LoveBud/issues/4545) — removal of reusable QA credential material from public Git distribution
