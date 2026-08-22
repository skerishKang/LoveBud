# CANONICAL Slice #4006 — Adoption Baseline Packet

Track: #4006 · Parent: #4004 — Keep OPEN · Unblocks: #4157 fork write-gate re-activation
Status: READ_ONLY_EVIDENCE_PACKET — zero mutation performed or authorized by this document alone
Packet date: 2026-08-22 (UTC)
Baseline verified fresh: `origin/main` = `04bf3fd1cdffbf8f5b3a977be5561160c35a0fe5` (#4166 squash)
Registered slice: `20260822054500_canonical-users-auth-identity`
  checksum `sha256:fb05785492bb0f0414a0d85d2e08743dc95d0a4136b073dac2254b3926d03151`

## 0. Preflight report

```text
PARENT_4004_READ = YES (fresh this session)
LOVETREE_152_READ = YES (fresh earlier this task chain; no shared-platform mutation involved here)
AUTH_4006_READ = YES
DATA_4005_READ_IF_RELEVANT = YES
CURRENT_REMOTE_FRESH = YES (origin/main 04bf3fd1cdff… re-fetched at session start)
CURRENT_PROVIDER_IDENTITY_FRESH = YES (live read-only probes executed this session; see section 2)
RESOURCE_CLASS = CANONICAL_PRODUCT_AUTHORITY (READ_ONLY inspection only)
SECOND_CANONICAL_WRITER_CREATED = NO
SECOND_PRODUCT_AUTHORITY_CREATED = NO
TEST_RESOURCE_PROMOTED_TO_PRODUCT = NO
PRODUCTION_SCHEMA_MUTATION = NONE
EXECUTION_PERFORMED = NO
ARCHITECTURE_CONSISTENCY_GATE = PASS
```

## 1. Method and hygiene

All live access was READ ONLY: every query ran inside an explicit `BEGIN READ ONLY … ROLLBACK` transaction. Existence checks used system-catalog joins (`pg_class` × `pg_namespace`) because the readonly role intentionally has no `USAGE` on schema `public` (Neon hardening). No user-data rows were selected, dumped, or transmitted anywhere. Credentials were copied once into a private ext4 path with mode 600, used in-process, and destroyed immediately after the run (`~/secrets-4006` removed). No secret values were printed, committed, or embedded in this packet.

## 2. Fresh production state probe (deliverable A + B)

Probe timestamp: 2026-08-22, two sessions against `neondb`:

```json
[
  {
    "probe": "readonly_role_catalog_only",
    "current_user": "lb_ro_709d5f3e68f774d2",
    "current_database": "neondb",
    "server_version_num": 170011,
    "exists": {
      "users": false,
      "app_account": false,
      "app_auth_identity": false,
      "auth_audit_log": false,
      "app_authenticated_owner_resolution": false
    }
  },
  {
    "probe": "owner_role_identity_only",
    "current_user": "lb_product_rw_a3f8c2d1",
    "current_database": "neondb",
    "server_version_num": 170011,
    "exists": { "users": false, "app_account": false, "app_auth_identity": false, "auth_audit_log": false }
  }
]
```

Findings:

```text
USERS_TABLE_STATE            = ABSENT (consistent with the #4164 deferral evidence;
                               CREATE-path of the slice is the live path, and the
                               ADD COLUMN IF NOT EXISTS step becomes a same-txn no-op)
NEW_OBJECTS_PREEXISTING      = NONE (app_account / app_auth_identity / auth_audit_log /
                               app_authenticated_owner_resolution all absent ->
                               manifest expected_preconditions hold verbatim)
SERVER_VERSION               = PG 17.11 (server_version_num 170011) — inside the
                               boundary-contract window [170000, 180000)
PROVIDER_IDENTITY_FRESH      = YES
IDENTITY_CORRECTION          = the current Product writer credential resolves to
                               lb_product_rw_a3f8c2d1 @ neondb — NOT neondb_owner as
                               narrated in older handoffs. Both probed identities are
                               live and mapped; execution-plan role language below uses
                               the freshly observed identity.
PHASE_B_COLLECTOR_STATUS     = COLLECTION_FAIL_PARTIAL_OR_UNKNOWN (session attempted, outcome
                               JSON captured verbatim). The sanctioned Phase-B collection
                               CLI connected but did not complete; per its sanitized-output
                               design no internals are exposed. Consequence: the canonical
                               runner-activation path is NOT yet green, and GO judgment for
                               DDL must not rely on it this cycle.
```

## 3. Execution plan (deliverable C)

Vehicle: one-time mutation slice following the #4157 pattern — the exact registered file bytes, single transaction, executed once, only after an explicit CTO/owner GO that references this packet.

### 3.1 Gate sequence

```text
G0  This packet merged (Draft PR reviewed by CTO).
G1  CTO issues explicit EXECUTION_GO naming expected head + checksum.
G2  Pre-execution verification block passes at T0 (see 3.2).
G3  Single execution by an owner-class session (freshly observed identity
    lb_product_rw_a3f8c2d1 @ neondb) using psql -v ON_ERROR_STOP=1 -1 -f
    db/migrations/20260822054500_canonical-users-auth-identity.sql
    (-1 = single transaction; matches transaction_mode REQUIRED).
G4  Post-execution probe re-run: all five targets exist; repeat of section 2
    queries recorded on the tracking issue.
G5  Only afterwards: #4157-pattern Tree Fork write-gate re-activation PR.
```

The canonical runner protocol remains the long-term vehicle and stays preferred; it is simply not yet activatable while Phase-B collection is red (section 2). If Phase-B is repaired before G1, the runner path supersedes 3.1/G3 automatically.

### 3.2 T0 pre-execution verification block (all must PASS, else ABORT)

```text
V1  git fetch origin && rev-parse origin/main == <head named in G1>
V2  sha256sum(db/migrations/20260822054500_canonical-users-auth-identity.sql)
      == fb05785492bb0f0414a0d85d2e08743dc95d0a4136b073dac2254b3926d03151
V3  main CI_GREEN including verify-static required check
V4  existence re-probe: app_account still ABSENT (precondition), users still ABSENT
    (if users became PRESENT meanwhile -> switch to additive-only review before GO)
V5  session identity check: SELECT current_user == lb_product_rw_a3f8c2d1
    and current_database == neondb, inside the same READ ONLY pre-check
V6  execution happens from a clean worktree whose tree equals V1 head
    (no /mnt/g checkout as source; polluted root untouched)
```

### 3.3 Fail-closed abort conditions

Any one aborts before or during execution, zero partial commits (single transaction):

```text
F1  checksum mismatch vs manifest entry
F2  HEAD mismatch vs G1-named commit
F3  precondition violation (app_account already exists; or unexpected
    required-non-null unknown column appears in an existing users table)
F4  connection/session identity differs from V5 expectation
F5  any statement error under ON_ERROR_STOP (transaction rolls back whole slice)
F6  CI on main not green at T0
F7  missing explicit G1 EXECUTION_GO reference
```

### 3.4 Rollback statement set (post-success reversal, reverse order)

```sql
DROP VIEW IF EXISTS public.app_authenticated_owner_resolution;
DROP INDEX IF EXISTS public.users_one_active_account_binding;
ALTER TABLE public.users DROP COLUMN IF EXISTS account_id;
DROP TABLE IF EXISTS public.auth_audit_log;
DROP TABLE IF EXISTS public.app_auth_identity;
DROP TABLE IF EXISTS public.app_account;
-- users itself was created by this slice (probe proves absence today); if any
-- Product rows accumulated between G3 and rollback, keep users minus account_id
-- and record the deviation on the tracking issue instead of dropping data.
```

## 4. Deliverable D note

This document carries the standard preflight block (section 0) in the #4006/#4157 form. Evidence artifacts referenced: probe JSON (section 2), bounded collector outcome (section 2, PHASE_B_COLLECTOR_STATUS).

## 5. G3 EXECUTION RECORD + G4 POST-PROBE (2026-08-22, added post-GO)

Authorization: G1 EXECUTION_GO @ #4006 issuecomment-5379078679 (expected head `8fd6f70ff030f61771ce79ce01e5844b792c158c`, checksum binding, actor constraint: app writer role FORBIDDEN for DDL).

### 5.1 Gate verification at T0

```text
V1 PASS  origin/main == 8fd6f70ff030f61771ce79ce01e5844b792c158c (re-fetched; no drift)
V2 PASS  sha256(slice bytes) == fb05785492bb0f0414a0d85d2e08743dc95d0a4136b073dac2254b3926d03151
         (verified on Windows worktree AND re-verified on ext4 execution copy)
V3 PASS  main CI green at G1 head (16 check runs, zero non-passing)
V4 PASS  pre-execution probe: users/app_account/app_auth_identity/auth_audit_log/view all ABSENT
V5 PASS  migration credential identity = neondb_owner @ neondb
         (DATABASE_URL from .secrets/lovebud-runtime.env resolves to OWNER_CLASS per
         lovebud-production-role-mapping.json; NOT the app writer role)
V6 PASS  clean worktree branch feat/4006-execution-g3-kilo1 cut from origin/main;
         /mnt/g never used as execution source
```

### 5.2 G3 transaction record

```json
{
  "g3": "EXECUTED",
  "execution_actor": "neondb_owner",
  "database": "neondb",
  "transaction": "COMMITTED_SINGLE",
  "statement_batches": 9,
  "started_utc": "2026-08-22T08:09:53.985Z",
  "ended_utc": "2026-08-22T08:09:55.580Z",
  "checksum_verified": "fb05785492bb0f0414a0d85d2e08743dc95d0a4136b073dac2254b3926d03151"
}
```

Exact registered file bytes sent verbatim inside one explicit BEGIN…COMMIT (transaction_mode REQUIRED honored). One-time principle honored: single run, no re-run attempted. No gate variable touched (LB_TREE_FORK_WRITE_RUNTIME unchanged — G5 is a separate authorization). App writer role (`LOVE_PLATFORM_WRITE_DATABASE_URL` → `lb_product_rw_a3f8c2d1`) was NOT used for DDL per the CTO actor constraint.

### 5.3 G4 post-probe evidence

Executed under the dedicated READ ONLY role after commit:

```json
{
  "probe": "g4_post_execution",
  "at_utc": "2026-08-22T08:10:27.556Z",
  "objects_present": [
    "app_account:r",
    "app_auth_identity:r",
    "app_authenticated_owner_resolution:v",
    "auth_audit_log:r",
    "users:r"
  ],
  "users_account_id": { "present": true, "attnotnull": false },
  "indexes_present": [
    "app_auth_identity_one_active_firebase_per_account",
    "app_auth_identity_one_active_neon_per_account",
    "users_one_active_account_binding"
  ],
  "new_table_row_counts_estimate": {
    "app_account": 0,
    "app_auth_identity": 0,
    "auth_audit_log": 0,
    "users": 0
  }
}
```

Data-row invariance: the committed statement set is pure additive DDL (CREATE IF NOT EXISTS ×4 + ADD COLUMN IF NOT EXISTS + 3 indexes + view); all four new tables hold zero rows and no pre-existing table was written. Fork-parity invariant intact: `users.account_id` present and NULLABLE (`attnotnull=false`), so the #4157/#4164 schema-capability bootstrap sees no unknown required-non-null column.

Credentials used once from private ext4 copies (mode 600) and destroyed immediately after the run; no secret values printed or committed.

Refs #4006.
Refs #4004 — Keep OPEN.
Refs #4157. Refs #1882 — Keep OPEN.
