# Database External Logical-Backup Architecture Decision

> **Direct issue:** #3826 (original R2 architecture decision)
> **Provider-target decision:** #3894 — replace R2 with a no-auto-charge encrypted backup
> target (Google Drive selected). Keep OPEN.
> **Parent:** #3460 (Keep OPEN)
> **Predecessor:** #3825 closed `not planned` after the provider-native path proved unavailable under the authorized plan boundary.
> **Hard governance:** `docs/ops/MVP_AGENT_GOVERNANCE.md`

Refs #3826
Refs #3894
Refs #3825
Refs #3460 — Keep OPEN.
Refs #3458 — Keep OPEN.
Refs #3435 — Keep OPEN.
Refs #1882 — Keep OPEN.

## 1. Decision status

**`EXTERNAL_LOGICAL_BACKUP_ARCHITECTURE_SELECTED`**

The provider-native Layer A path selected in
`DATABASE_RECOVERY_CONFIGURATION_REMEDIATION_DECISION.md` cannot be completed under the
currently authorized provider plan boundary. The failed execution changed no provider state
and performed no database, SQL, branch, restore, or repository mutation.

The recovery policy already defines the fallback: when the history window cannot provide the
selected daily tier, LoveBud requires an external logical-backup mechanism. This decision
selects that mechanism without authorizing provisioning, deployment, database access, dump
execution, object upload, or restore.

## 2. Fixed evidence and constraints

Merged repository authority:

- `DATABASE_SNAPSHOT_RETENTION_RESTORE_DRILL_POLICY.md` selects a general user-data RPO of
  no more than 24 hours and requires external logical backup when the provider history window
  cannot satisfy the daily tier.
- Weekly checkpoints must be retained for at least four weeks.
- Monthly checkpoints must be retained for at least three months.
- Backup artifacts, credentials, database URLs, raw data, and private identifiers must never
  be stored in the repository or CI logs.
- Production restore is never automatic and remains separately approval-bounded.

Sanitized provider execution evidence:

```text
Production target attribution: VERIFIED_UNIQUE
Production root branch attribution: VERIFIED
history target unavailable under current authorized boundary
provider state changed: NO
provider scheduled cadence: NOT_ATTEMPTED
```

Current official provider documentation is consistent with the execution result: the free
plan exposes only a short instant-restore history window, while automated scheduled snapshots
are a paid-plan capability. No paid-plan or recurring-billing change is authorized here.

## 3. Selected architecture

```text
scheduler and execution runtime:
separate Modal scheduled backup function

Production database credential boundary:
existing Modal `lovebud-db` secret only

external retained storage:
private Google Drive folder on the user-designated Drive account (reuse authorized; no new account)

object API:
Google Drive API v3 over TLS (resumable upload, files.get/copy/list/delete)

logical backup format:
PostgreSQL custom-format dump with compression

confidentiality:
client-side authenticated encryption before upload
+ TLS in transit
(Drive receives encrypted artifacts only; no plaintext dump is ever uploaded)

auth boundary:
one-time OAuth 2.0 user consent + offline refresh token;
Modal exchanges refresh authority for short-lived access tokens

retention implementation:
daily / weekly / monthly Drive files (copies of the same encrypted artifact)
+ bounded tier-scoped cleanup that never deletes the newest valid daily point
```

This architecture is classified **`EXTERNAL_BACKUP_ARCHITECTURE_SELECTED`** and
**`IMPLEMENTATION_REQUIRED`**.

The Google Drive primary path was selected in #3894 (comment 5349825662, 2026-08-20):

```text
PRIMARY_IMPLEMENTATION_PATH = MODAL_PLUS_GOOGLE_DRIVE

DEFERRED_FALLBACKS =
- MODAL_PLUS_R2
- MODAL_PLUS_ORACLE_OBJECT_STORAGE
- MODAL_PLUS_BACKBLAZE_B2
```

The former R2 storage adapter surface (`boto3`, `_s3_client`, `put_object`, `head_object`,
`copy_object`, `delete_object`, and the `lovebud-recovery-r2` symbolic secret) has been
replaced by a Google Drive adapter (`modal_compute/recovery_drive_storage.py`) under the
`lovebud-recovery-drive` symbolic secret. The deferred fallbacks are retained for a later
post-Drive comparison; they are NOT runtime failover targets — Drive failure never falls
back to R2, Oracle Object Storage, or Backblaze B2.

Actual Google account, OAuth client, refresh-token, Drive folder, Modal secret, and
scheduled-function deployment states remain unverified:

```text
EXTERNAL_STORAGE_UNPROVISIONED
SECRET_BOUNDARY_UNPROVISIONED
```

Those states do not block the architecture decision. They block runtime activation until a
separately approved provisioning and deployment child completes.

## 4. Why Modal is the execution boundary

The active Production backend already reaches the database from Modal and receives the
Production database URL through the existing `lovebud-db` Modal secret. Running the backup
inside a separate Modal scheduled function therefore preserves the established credential
boundary.

The implementation must not:

- copy the database URL into GitHub Actions, Cloudflare Pages, repository files, CI variables,
  artifacts, logs, or issue comments;
- add backup behavior to the public FastAPI request path;
- reuse the web application's continuously warm container as the backup scheduler;
- expose a public HTTP route that triggers a Production backup;
- permit a browser, client, or unauthenticated caller to invoke the backup function.

The backup function must be a separate, non-HTTP Modal function with its own image,
dependencies, timeout, ephemeral disk allowance, secret list, and schedule declaration.

## 5. Why private Google Drive is selected

Google Drive on the user-designated Drive account is selected as the retained-object
target (#3894). The account is REUSED; authorization does not create, authorize a new
subscription for, or bill the account. Selection rationale:

- the user-designated account provides existing storage subject to its current quota;
- buying additional Google storage requires a separate Google One subscription decision
  and must not be required by the backup runtime;
- when the account reaches its storage limit, new Drive uploads fail rather than silently
  expanding storage (fail closed, no usage-based automatic billing);
- one encrypted backup upload per day is far below normal Drive API request limits;
- the retained artifact remains outside the Neon provider boundary;
- no payment method is required merely because retained data or operations exceed the
  existing quota allowance.

The product-owner hard boundary (#3894) is:

```text
payment method required: NOT ACCEPTABLE
usage-based automatic billing: NOT ACCEPTABLE
silent upgrade to paid storage: NOT ACCEPTABLE
free quota exhaustion: FAIL CLOSED
```

The implementation must check current storage usage before upload and fail closed before an
internal 0.90 hard ceiling is crossed, leaving at least 10% provider quota reserved. This
decision does not assert that a Google account, OAuth client, or Drive folder already
exists. If account provisioning later proves unavailable, the implementation must stop with
`EXTERNAL_STORAGE_UNPROVISIONED`; it must not silently substitute GitHub artifacts, a public
Drive folder, repository storage, or local operator disk.

## 6. Secret and least-privilege boundary

The implementation requires two secret classes in addition to the existing database secret:

```text
Drive OAuth credential:
OAuth client id + offline refresh token (and client secret when required by the
selected client type),
scoped to drive.file on the user-designated backup account

backup encryption key:
separate authenticated-encryption key, stored only in secret storage
```

The OAuth credential and encryption key must not be the same secret value. Neither may be
printed, returned, included in exceptions, persisted in temporary metadata, or recorded in
GitHub. ChatGPT Google Drive connector credentials are NOT runtime credentials and MUST NOT
be reused or exported.

The Drive OAuth credential must allow only the minimum operations required for:

- exchange the offline refresh token for a short-lived access token;
- `about.get` for storage-quota preflight;
- `files.create` (resumable) to upload encrypted backup artifacts;
- `files.get` to verify an uploaded artifact;
- `files.copy` to promote a verified artifact between retention tiers;
- `files.list` only inside the app-owned backup scope for retention inventory;
- `files.delete` only for positively-identified app-owned expired encrypted artifacts.

Generic Drive browsing, arbitrary file listing/deletion, public sharing, permission
mutation, account-wide access, restore/download in the normal backup path, and
broadening to a full Drive scope are not part of the runtime credential.

## 7. Backup production and encryption pipeline

A valid run follows this exact order:

```text
1. confirm required secrets are present without printing values;
2. create an ephemeral private working directory;
3. run one read-consistent PostgreSQL custom-format logical dump;
4. verify the dump process completed successfully and produced a non-empty artifact;
5. encrypt the completed dump using authenticated encryption;
6. remove the plaintext dump before upload begins;
7. upload the encrypted object to an incomplete/staging key;
8. verify the uploaded encrypted object's presence and expected opaque size class;
9. atomically promote/copy the verified object to the daily valid prefix;
10. promote/copy the same encrypted object to weekly and/or monthly prefixes when the run
    falls on the corresponding retention boundary;
11. remove the incomplete/staging object;
12. remove all ephemeral local material in a finally/cleanup path;
13. emit sanitized status only.
```

The database must be dumped once per successful run. Weekly and monthly retention are object
promotions of the same verified encrypted dump, not additional Production dumps.

The implementation must use a PostgreSQL client version compatible with the Production
server. Version mismatch must fail closed before upload.

No backup artifact is valid until dump, encryption, upload, and post-upload verification all
succeed.

## 8. Retention tiers

The source implementation must preserve at least the merged policy targets with operational
margin:

| Prefix | Minimum creation cadence | Minimum retention target | Purpose |
|---|---:|---:|---|
| `daily/` | one successful point per 24-hour window | 8 days | General user-data RPO and recent operational recovery |
| `weekly/` | one promoted point per week | 5 weeks | Latent-error recovery beyond the daily set |
| `monthly/` | one promoted point per month | 4 months | Longer-term retained checkpoint |
| `incomplete/` | temporary only | shortest practical expiry | Failed/interrupted upload cleanup; never a valid point |

Lifecycle expiry may occur asynchronously. The implementation must therefore avoid treating
an expiry rule as proof that the required valid objects exist. Freshness and retained-tier
verification must inspect the valid prefixes separately.

The implementation must not encode exact Production identifiers in object keys. Object keys
may include execution date/time components required for ordering, but those keys are private
runtime data and must never be copied into repository evidence or logs.

## 9. Integrity and validity states

Fixed runtime states:

```text
BACKUP_POINT_VALID
BACKUP_POINT_STALE
BACKUP_POINT_MISSING
BACKUP_UPLOAD_INCOMPLETE
BACKUP_INTEGRITY_UNVERIFIED
EXTERNAL_STORAGE_UNPROVISIONED
SECRET_BOUNDARY_UNPROVISIONED
```

A backup is `BACKUP_POINT_VALID` only when all are true:

- Production target class was confirmed without exposing identifiers;
- logical dump completed with success status;
- plaintext artifact was non-empty;
- authenticated encryption completed;
- plaintext cleanup completed;
- encrypted upload completed;
- post-upload object verification completed;
- the object exists under a valid retention prefix, not only `incomplete/`;
- the sanitized age bucket is within the applicable tier;
- no secret or private identifier was emitted.

`BACKUP_INTEGRITY_UNVERIFIED` is fail-closed. A checksum, authentication tag, opaque size, or
object metadata value used internally for verification must not be recorded in GitHub.

## 10. Failure and partial-success behavior

On any dump, encryption, upload, promotion, verification, or cleanup failure:

- do not classify the run as a recovery point;
- do not create a valid-prefix object from an unverified upload;
- delete or expire incomplete objects where safely possible;
- remove plaintext and encrypted temporary local files;
- do not retry indefinitely;
- do not perform a database restore, branch reset, or compensating Production mutation;
- emit only a fixed sanitized failure state;
- preserve an earlier valid recovery point;
- allow the future alert layer to detect a missing or stale newest valid point.

If the daily promotion succeeds but a weekly or monthly promotion fails, the daily point may
remain valid, while the affected longer tier is reported separately as missing or
unverified. The implementation must not delete the valid daily object in an attempt to make
the entire run appear atomic.

## 11. Scheduling and observability

The source implementation must define one daily scheduled Modal execution. Exact clock time
is operational configuration and must not be written into GitHub evidence.

Runtime output must contain only fixed fields such as:

```text
run outcome
recovery-point state
daily tier state
weekly tier state
monthly tier state
age bucket
cleanup state
```

It must not contain:

```text
database URL or host
provider account/project/branch identifiers
Google account, OAuth client id/secret, refresh token, Drive folder id,
file id, object key, or token
exact timestamp
raw command
raw stderr containing connection details
backup contents
exact byte size
checksum, HMAC, digest, tag, or fingerprint
secret/config path
```

The next alert/gate child will consume only sanitized state, not object credentials or raw
storage listings.

## 12. Restore boundary

This architecture creates retained logical backups only. It does not authorize or implement:

- automatic restore;
- Production in-place restore;
- database branch reset;
- selective row repair;
- schema migration;
- restore-to-isolated-copy execution.

The future isolated-copy drill must decrypt and restore into a separately approved isolated
environment, verify schema and relational invariants, and perform zero mutation against the
original Production database.

Production restore remains **`NOT_AUTHORIZED`**.

## 13. Next implementation child

The next child should implement source code and tests only, without live provisioning or
activation. Expected scope should be limited to:

```text
new dedicated Modal backup module
new backup policy/state module
new source-static and focused unit tests
minimal dependency/image declaration required by the backup function
operator documentation for required secret names as symbolic names only
CI registry/classification updates required by repository conventions
```

The implementation child must not:

- create the Google account, OAuth client, or Drive folder;
- create OAuth credentials, refresh tokens, or encryption keys;
- write Modal secret values;
- deploy or activate the schedule;
- connect to Production;
- execute `pg_dump` against Production;
- upload an actual backup;
- run a restore;
- change the public API or product UI;
- provision R2, Oracle Object Storage, or Backblaze B2.

After source implementation and CI approval, a separately authorized provisioning/activation
step may reuse the designated Google account, OAuth client, app-owned Drive folder,
least-privilege credential, encryption key, Modal secrets, and scheduled deployment. Only
the provider/storage operations that the Web CTO cannot perform with available tools should
be delegated to Local.

## 14. Closure impact

#3460 remains OPEN. It is not closure-eligible until all of the following exist and are
verified:

- an active daily recovery-point mechanism;
- weekly and monthly retained checkpoints at policy minimums;
- stale/missing recovery-point alerting;
- a pre-change recovery gate;
- at least one successful isolated-copy restore drill within cadence.

This source-only decision changes no live provider, storage, database, schedule, secret, or
deployment state.

## 15. Privacy self-audit

This document contains no provider account/project/branch/snapshot identifier, database URL,
host, database name, region, credential, token, secret value, raw provider response, OAuth
client secret, refresh token, Drive folder id, file id, object key, exact Production
timestamp, exact private retention value, exact object size, checksum, HMAC, digest,
fingerprint, local credential path, or backup content. Only symbolic secret names
(`lovebud-db`, `lovebud-recovery-drive`, `lovebud-recovery-encryption`) and symbolic
environment-name patterns appear; their values never appear.
