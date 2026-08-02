# External Logical Backup Source Runbook

> **Direct issue:** #3828 — source-only implementation of the external logical-backup pipeline.
> **Parent:** #3460 (Keep OPEN).
> **Architecture decision:** `docs/ops/DATABASE_EXTERNAL_LOGICAL_BACKUP_ARCHITECTURE_DECISION.md` (`EXTERNAL_LOGICAL_BACKUP_ARCHITECTURE_SELECTED`).
> **Implementation scope:** source code + deterministic contract tests only. Nothing here
> provisions storage, creates credentials or encryption keys, deploys a Modal app, activates
> a schedule, connects to a database, runs `pg_dump`, uploads an object, or restores data.

Refs #3828
Refs #3460 — Keep OPEN.
Refs #3458 — Keep OPEN.
Refs #3435 — Keep OPEN.
Refs #1882 — Keep OPEN.

## 1. Symbolic configuration names

The pipeline is bound only through the following symbolic Modal secret names. No value from
these secrets is ever recorded, logged, or committed.

```text
lovebud-db
lovebud-recovery-r2
lovebud-recovery-encryption
```

No account identifier, bucket name, endpoint, object key, credential, database URL, host,
exact schedule clock time, or exact Production timestamp appears in this runbook or in the
implementation status output.

## 2. Source-only status states

The implementation module reports only fixed sanitized statuses. The runbook distinguishes:

```text
SOURCE_IMPLEMENTED
R2_UNPROVISIONED
SECRETS_UNPROVISIONED
SCHEDULE_NOT_DEPLOYED
NO_BACKUP_EXECUTED
PRODUCTION_RESTORE_NOT_AUTHORIZED
```

`SOURCE_IMPLEMENTED` is the current state: the pipeline source and deterministic contract
tests exist. `R2_UNPROVISIONED`, `SECRETS_UNPROVISIONED`, and `SCHEDULE_NOT_DEPLOYED`
remain true until a separately authorized provisioning/deployment child completes.
`NO_BACKUP_EXECUTED` is true until the first scheduled run succeeds. Production restore is
`PRODUCTION_RESTORE_NOT_AUTHORIZED` at all times in this source-only phase.

## 3. Module layout

```text
modal_compute/recovery_backup_policy.py
    pure, deterministic, provider-neutral status/policy helpers (no Modal/boto3/
    cryptography/psycopg/env/network/filesystem side effects at import or run)

modal_compute/recovery_backup_app.py
    separate Modal app `lovebud-recovery-backup`; one scheduled non-HTTP function
    per 24-hour period; all live operations inside the scheduled function body
```

The public FastAPI app (`modal_compute/app.py`) never imports either module.

## 4. Pipeline summary (single scheduled run)

1. symbolic secret presence check;
2. private ephemeral working directory;
3. compressed PostgreSQL custom-format logical dump (`pg_dump --format=custom
   --compress` with no owner/privilege restoration dependency, bounded timeout);
4. non-empty dump verification;
5. streaming authenticated encryption with a per-object random nonce (authentication
   tag stored inside the object);
6. plaintext dump deletion before upload;
7. incomplete/staging object upload;
8. authenticated head/metadata verification;
9. daily prefix promotion;
10. conditional weekly/monthly promotion from the same encrypted object (never a second
    Production dump);
11. staging object deletion after successful promotion;
12. `finally` cleanup of the ephemeral directory;
13. sanitized status returned from `recovery_backup_policy`.

One Production dump occurs at most once per execution. Incomplete uploads are never treated
as valid. Only idempotent object operations are retried, and only a bounded number of
times; `pg_dump` is never retried unboundedly.

### Backup runtime client authority

- backup runtime client authority: **PostgreSQL 17.4**
- the source image is pinned to `postgres:17.4-bookworm`, which provides a `pg_dump`
  client with major version 17
- this source-only child does **not** build or deploy the image and no `pg_dump` was
  executed
- future deployment must verify the deployed client (major 17) before the first live
  backup runs

No Production database URL, host, provider/account/project identifier, bucket, endpoint,
credential, secret value, exact execution timestamp, or local path appears here.

## 5. Operational non-actions (this child)

```text
no R2 subscription or bucket creation
no R2 lifecycle mutation
no R2 credential/token creation
no encryption-key creation
no Modal secret creation/update
no Modal deployment
no schedule activation
no Production/Preview access
no database connection
no pg_dump execution against a live database
no object upload
no snapshot/branch/restore action
no GitHub Actions secret mutation
no product/API/UI change
```

## 6. Runtime provisioning prerequisites (future, separately authorized)

Before any scheduled run can execute, a separate provisioning/deployment child must:

1. provision the private R2 bucket and access token under the `lovebud-recovery-r2`
   symbolic secret;
2. provision the backup encryption key under the `lovebud-recovery-encryption` symbolic
   secret;
3. deploy the `lovebud-recovery-backup` Modal app and activate its 24-hour schedule.

Until then the implementation remains source-only with
`R2_UNPROVISIONED` / `SECRETS_UNPROVISIONED` / `SCHEDULE_NOT_DEPLOYED` /
`NO_BACKUP_EXECUTED` reported.
