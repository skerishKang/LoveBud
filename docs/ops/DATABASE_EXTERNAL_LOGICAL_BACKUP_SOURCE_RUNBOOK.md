# External Logical Backup Source Runbook

> **Direct issue:** #4137 — source-only Modal→Google Drive encrypted backup adapter (child of #3894).
> **Provider-decision parent:** #3894 — replace R2 with a no-auto-charge encrypted backup target. Keep OPEN.
> **Grandparent:** #3460 (Keep OPEN).
> **Predecessor completed source:** #3828 / PR #3830 (Modal→R2 pipeline, R2 surface now replaced).
> **Architecture decision:** `docs/ops/DATABASE_EXTERNAL_LOGICAL_BACKUP_ARCHITECTURE_DECISION.md`.
> **Implementation scope:** source code + deterministic contract tests only. Nothing here
> provisions storage, creates credentials or encryption keys, deploys a Modal app, activates
> a schedule, connects to a database, runs `pg_dump`, uploads an object, or restores data.

Refs #4137
Refs #3894
Refs #3460 — Keep OPEN.
Refs #3828
Refs #1882 — Keep OPEN.

## 1. Symbolic configuration names

The pipeline is bound only through the following symbolic Modal secret names. No value from
these secrets is ever recorded, logged, or committed.

```text
lovebud-db
lovebud-recovery-drive
lovebud-recovery-encryption
```

`lovebud-recovery-drive` replaced the former `lovebud-recovery-r2` symbolic secret when the
product-owner selected the Modal + Google Drive primary path (#3894 comment 5349825662). The
Drive secret may contain only the minimum OAuth / user-authorization material required for the
dedicated backup account:

```text
OAuth client id
OAuth client secret (when required by the selected client type)
offline refresh token
app-owned Drive backup root identity (when required)
```

ChatGPT Google Drive connector credentials are NOT runtime credentials and MUST NOT be reused
or exported. No account identifier, folder id, file id, refresh token, client secret, database
URL, host, exact schedule clock time, or exact Production timestamp appears in this runbook or
in the implementation status output.

## 2. Source-only status states

The implementation module reports only fixed sanitized statuses. The runbook distinguishes:

```text
SOURCE_IMPLEMENTED
DRIVE_UNPROVISIONED
SECRETS_UNPROVISIONED
SCHEDULE_NOT_DEPLOYED
NO_BACKUP_EXECUTED
PRODUCTION_RESTORE_NOT_AUTHORIZED
```

`SOURCE_IMPLEMENTED` is the current state: the pipeline source and deterministic contract
tests exist for the Google Drive adapter. `DRIVE_UNPROVISIONED`, `SECRETS_UNPROVISIONED`, and
`SCHEDULE_NOT_DEPLOYED` remain true until a separately authorized provisioning/deployment child
completes. `NO_BACKUP_EXECUTED` is true until the first scheduled run succeeds. Production
restore is `PRODUCTION_RESTORE_NOT_AUTHORIZED` at all times in this source-only phase.

## 3. Module layout

```text
modal_compute/recovery_backup_policy.py
    pure, deterministic, provider-neutral status/policy helpers + Drive quota
    classifier (no Modal/requests/boto3/cryptography/psycopg/env/network side effects
    at import or run)

modal_compute/recovery_drive_storage.py
    Drive auth / token refresh / quota preflight / upload / verify / copy / list /
    bounded delete adapter (Drive API v3 + offline OAuth refresh-token boundary).
    All live operations only inside explicitly called functions during a run.

modal_compute/recovery_backup_app.py
    separate Modal app `lovebud-recovery-backup`; one scheduled non-HTTP function
    per 24-hour period; all live operations inside the scheduled function body.
    Orchestrates dump / encryption / plaintext cleanup / Drive upload / promotion /
    retention cleanup and returns a sanitized status.
```

The public FastAPI app (`modal_compute/app.py`) never imports any of these modules.

## 4. Pipeline summary (single scheduled run)

1. symbolic secret presence check;
2. private ephemeral working directory;
3. compressed PostgreSQL custom-format logical dump (`pg_dump --format=custom
   --compress` with no owner/privilege restoration dependency, bounded timeout);
4. non-empty dump verification;
5. streaming authenticated encryption with a per-object random nonce (authentication
   tag stored inside the object);
6. plaintext dump deletion before upload;
7. Drive quota preflight (total account usage vs. internal 0.90 hard ceiling) —
   insufficient or missing quota fail closed with zero upload;
8. resumable encrypted artifact upload to the app-owned backup root;
9. `files.get` metadata verification (exists, not trashed, expected encrypted byte
   length, expected bounded app metadata, app-owned location);
10. daily promotion (`files.copy`) from the same encrypted artifact;
11. independent weekly/monthly promotion from the same encrypted object (never a
    second Production dump);
12. staging artifact deletion;
13. bounded, tier-scoped retention cleanup that never deletes the newest valid daily
    point;
14. `finally` cleanup of the ephemeral directory;
15. sanitized status returned from `recovery_backup_policy`.

One Production dump occurs at most once per execution. Incomplete uploads are never treated
as valid. Only idempotent provider operations are retried, and only a bounded number of
times; `pg_dump` is never retried unboundedly. Drive failure never falls back to R2, Oracle
Object Storage, or Backblaze B2 — those are deferred architectural alternatives, not runtime
failover targets.

### Backup runtime client authority

- backup runtime client authority: **PostgreSQL 17.4**
- the source image is pinned to `postgres:17.4-bookworm`, which provides a `pg_dump`
  client with major version 17
- this source-only child does **not** build or deploy the image and no `pg_dump` was
  executed
- future deployment must verify the deployed client (major 17) before the first live
  backup runs

### Google Auth architecture

```text
Google Drive API v3
+
one-time OAuth 2.0 user consent (offline)
+
offline refresh token stored in Modal secret
+
Modal exchanges refresh authority for short-lived access tokens
```

Preferred scope: `https://www.googleapis.com/auth/drive.file`.

The scheduled Modal job never automates browser login, never stores a Google password, and
never performs interactive OAuth. If `drive.file` cannot satisfy the exact app-owned folder
model, the implementation stops for the Web CTO rather than broadening to a full Drive scope.

No real OAuth request is made in source tests.

## 5. Drive object privacy

Drive receives ENCRYPTED files only. The plaintext dump is never uploaded. Artifact identity
is opaque. The Drive filename and metadata never contain:

```text
DB hostname
DB URL
database name
user identity
owner identity
Tree/Memory ids
credentials
tokens
Product content
```

Allowed bounded metadata only:

```text
LBBA format version
encrypted-postgresql-dump content kind
retention tier
app-owned operational identity (run key)
```

No public or shared Drive permissions are created.

## 6. Quota fail-closed policy

The provider quota is inspected before upload using the total account usage / provider storage
limit (not only Drive-file usage).

```text
INTERNAL_CEILING_RATIO = 0.90
effective internal ceiling = floor(provider_storage_limit * 0.90)
```

At least 10% provider quota remains reserved. Before `files.create`:

```text
current_total_usage + encrypted_artifact_size <= effective_internal_ceiling
```

Otherwise: NO upload. Missing, unparseable, unbounded, or inconsistent quota responses fail
closed (EXHAUSTED). Exact quota byte values are never emitted to logs or status.

Required sanitized states:

```text
DRIVE_STORAGE_WITHIN_LIMIT
DRIVE_STORAGE_NEAR_LIMIT
DRIVE_STORAGE_EXHAUSTED
DRIVE_AUTH_UNAVAILABLE
DRIVE_UPLOAD_UNVERIFIED
```

## 7. Retention semantics

```text
staging -> verified -> daily -> optional weekly -> optional monthly -> staging cleanup
```

One Production dump per scheduled run. Weekly/monthly copies derive from the SAME encrypted
backup artifact (never a second `pg_dump`). Retention list/delete is bounded, app-owned only,
tier-scoped, and deterministic. The newest valid daily point is never deleted merely to
satisfy cleanup.

## 8. Operational non-actions (this child)

```text
no Google OAuth client creation
no Google OAuth consent
no refresh-token creation
no Google Drive folder creation
no Drive upload / list / delete against a real account
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
no R2 / Oracle / Backblaze B2 provisioning
```

## 9. Runtime provisioning prerequisites (future, separately authorized)

Before any scheduled run can execute, a separate provisioning/deployment child must:

1. create the dedicated free Google account with no Google One subscription and no payment
   method added for storage expansion;
2. create the OAuth client, complete the one-time user consent, obtain the offline refresh
   token, and create the app-owned Drive backup root folder;
3. provision the Drive OAuth material under the `lovebud-recovery-drive` symbolic secret;
4. provision the backup encryption key under the `lovebud-recovery-encryption` symbolic
   secret;
5. deploy the `lovebud-recovery-backup` Modal app and activate its 24-hour schedule.

Until then the implementation remains source-only with
`DRIVE_UNPROVISIONED` / `SECRETS_UNPROVISIONED` / `SCHEDULE_NOT_DEPLOYED` /
`NO_BACKUP_EXECUTED` reported.
