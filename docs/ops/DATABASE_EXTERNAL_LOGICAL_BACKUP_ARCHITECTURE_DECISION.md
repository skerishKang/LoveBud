# Database External Logical-Backup Architecture Decision

> **Direct issue:** #3826
> **Parent:** #3460 (Keep OPEN)
> **Predecessor:** #3825 closed `not planned` after the provider-native path proved unavailable under the authorized plan boundary.
> **Hard governance:** `docs/ops/MVP_AGENT_GOVERNANCE.md`

Refs #3826
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
private Cloudflare R2 Standard bucket

object API:
S3-compatible authenticated API over TLS

logical backup format:
PostgreSQL custom-format dump with compression

confidentiality:
client-side authenticated encryption before upload
+ R2 encryption at rest
+ TLS in transit

retention implementation:
daily / weekly / monthly object prefixes
+ prefix-specific lifecycle expiry
```

This architecture is classified **`EXTERNAL_BACKUP_ARCHITECTURE_SELECTED`** and
**`IMPLEMENTATION_REQUIRED`**.

Actual R2 subscription state, bucket existence, access-token state, Modal secret state, and
scheduled-function deployment state remain unverified:

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

## 5. Why private Cloudflare R2 Standard is selected

Cloudflare R2 is selected as the default retained-object target because:

- the project already operates within the Cloudflare platform boundary;
- R2 provides an S3-compatible authenticated API;
- R2 Standard has no minimum object-storage duration;
- R2 supports lifecycle rules for automatic object expiration;
- R2 encrypts objects at rest and supports TLS in transit;
- the included monthly free tier is likely sufficient for an initially small compressed
  backup set, while actual usage must still be monitored;
- R2 egress is not charged, reducing restore-drill cost uncertainty;
- the bucket can remain private and does not require a public `r2.dev` endpoint.

This decision does not assert that an R2 subscription or bucket already exists. If account
provisioning later proves unavailable, the implementation must stop with
`EXTERNAL_STORAGE_UNPROVISIONED`; it must not silently substitute GitHub artifacts, a public
bucket, repository storage, or local operator disk.

## 6. Secret and least-privilege boundary

The implementation requires two secret classes in addition to the existing database secret:

```text
R2 object credential:
least-privilege access scoped to the dedicated private backup bucket

backup encryption key:
separate authenticated-encryption key, stored only in secret storage
```

The object credential and encryption key must not be the same secret value. Neither may be
printed, returned, included in exceptions, persisted in temporary metadata, or recorded in
GitHub.

The R2 credential must allow only the minimum operations required for:

- put encrypted backup objects;
- head the uploaded object for post-upload verification;
- copy/promote a verified object between retention prefixes when required;
- list only the dedicated backup prefixes for retention/freshness verification;
- delete incomplete temporary objects when cleanup is necessary.

Bucket-management, public-access configuration, unrelated bucket access, and account-wide
permissions are not part of the runtime credential.

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
R2 account, bucket, endpoint, object key, or token
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

- create the R2 subscription or bucket;
- create object credentials or encryption keys;
- write Modal secret values;
- deploy or activate the schedule;
- connect to Production;
- execute `pg_dump` against Production;
- upload an actual backup;
- run a restore;
- change the public API or product UI.

After source implementation and CI approval, a separately authorized provisioning/activation
step may create the private bucket, lifecycle rules, least-privilege credential, encryption
key, Modal secrets, and scheduled deployment. Only the provider/storage operations that the
Web CTO cannot perform with available tools should be delegated to Local.

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
host, database name, region, credential, token, secret, raw provider response, object key,
exact Production timestamp, exact private retention value, object size, checksum, HMAC,
digest, fingerprint, local credential path, or backup content.
