# CANONICAL users Table DDL Proposal — #4006

Parent: #4004 — Keep OPEN
Track: #4006
Unblocks: #4157 Tree Fork write-gate re-activation (#4164 deferral)
Status: PROPOSAL_ONLY_DOCUMENT_ARTIFACT — zero execution authority
Contract date: 2026-08-22
Baseline verified fresh: `origin/main` = `14930792751cab75bb0897989a196716be6b0d19`
Proposal artifact: `db/proposals/4006-canonical-users-auth-identity-proposal.sql`

## 0. Preflight report

```text
PARENT_4004_READ = YES (fresh this session)
LOVETREE_152_READ = YES (skerishKang/lovetree-limone#152 fresh this session)
AUTH_4006_READ = YES (fresh this session)
DATA_4005_READ_IF_OWNER_MAPPING_USED = YES (fresh this session; CLOSED, evidence-only)
CURRENT_REMOTE_FRESH = YES (origin/main 14930792… re-fetched at session start)
CURRENT_PROVIDER_IDENTITY_FRESH = NA (zero provider contact in this work)
RESOURCE_CLASS = PROPOSAL_ONLY_DOCUMENT_ARTIFACT
SECOND_CANONICAL_WRITER_CREATED = NO
SECOND_PRODUCT_AUTHORITY_CREATED = NO
TEST_RESOURCE_PROMOTED_TO_PRODUCT = NO
PRODUCTION_AUTH_CUTOVER_EXPLICIT = NO
ARCHITECTURE_CONSISTENCY_GATE = PASS (documentation + local simulation only;
                                   zero provider/DB/production mutation)
```

## 1. Purpose and scope

Design the CANONICAL stable-account schema that lets the LoveBud + LoveTree shared platform move Product identity off provider subject strings, per #4006, and simultaneously satisfy the exact contract that #4157/#4164 established for the deferred Tree Fork write gate:

1. a usable `public.users` table whose shape never breaks the fork owner-user bootstrap;
2. the #4006 logical model (`app_account` + `app_auth_identity`) as the real ownership anchor.

In scope: DDL proposal document + proposal SQL artifact + prototype contract simulation. Out of scope: execution of any DDL, Production provisioning, ownership rewrite, auth cutover, merge/close actions.

## 2. Evidence base (all read fresh at baseline)

| Source | What it fixes for this design |
|---|---|
| `functions/_shared/tree-fork-direct-neon.js:274-333` | Fork bootstrap handles exactly `id`, `email`, `created_at`, `updated_at`; inserts `INSERT INTO users (...) ON CONFLICT (id)`; fails closed (`users-schema-unavailable`) on any unknown column that is NOT NULL without default. |
| #4157 least-privilege matrix | Writer role needs `SELECT/INSERT/UPDATE` on `users` (+ listed social tables). No DELETE anywhere, no DDL, no sequences. |
| #4164 (revert commit on main) | Tree Fork write gate is deferred pending users-table design — this proposal is that design input. |
| Bridge doc §4–§8 (`docs/architecture/auth-principal-compatibility-bridge-4006.md`) | Provider-neutral principal shape; verification-before-mapping invariant; existing-account compatibility mode; new Neon-only account HOLD. |
| #4005 reconciliation | The historical 36-user snapshot is non-default child-lineage evidence; current counts require fresh queries. This proposal therefore defines SHAPE, not row data, and performs no inventory claims. |
| #4006 target model | Business ownership must not stay coupled to provider subject IDs; `app_account.id` is the stable Product account id. |

## 3. Design decisions

```text
D1  app_account (uuid PK) is the single stable Product account anchor.
D2  app_auth_identity carries verified provider subjects with
    UNIQUE (provider, provider_subject) plus one-ACTIVE-identity-per-provider-
    per-account partial unique indexes (ambiguity becomes unrepresentable).
D3  public.users remains the legacy-owner compatibility anchor:
    id text PK (Firebase-UID-era subject), email NOT NULL DEFAULT '',
    created_at/updated_at defaults, account_id uuid NULL -> app_account.
    Every column stays inside the fork-handled set or is nullable/defaulted,
    so the #4157 fork bootstrap parity invariant holds verbatim.
D4  INVARIANT (binding while direct write gates rely on schema-capability
    bootstrap): no new column on public.users may be NOT NULL without a
    default. New capability enters nullable first; tightening happens only
    through separately approved cutover slices.
D5  email_normalized on identities is display/recovery metadata only and can
    never appear in any unique/linking constraint (takeover-proof by shape).
D6  auth_audit_log records every successful identity mutation exactly once,
    transactionally, append-only intent, PII-free details (no emails, tokens,
    hashes, secrets, private payloads).
D7  Writer-role scope stays EXACTLY the #4157 vocabulary (SELECT/INSERT/
    UPDATE incl. users; no DELETE; no DDL). Mapping tables are OUT of writer
    scope; if fork bootstrap later moves to app_account creation, that is a
    NEW matrix-extension slice under the #4157 pattern, never silent.
```

## 4. Why this is NOT in db/migrations

The canonical stream (`db/migrations/` + `db/migration-provenance/canonical-migrations.json`) is governed: immutable `YYYYMMDDHHMMSS_slug` ids, byte-exact sha256 checksums, structured approval references, and an inactive `ADOPTION_REQUIRED` state until a separately approved adoption baseline is attested. Registering an UNAPPROVED proposal there would misrepresent it as catalogued-and-awaiting-adoption. The proposal therefore lives in `db/proposals/` as a clearly classified non-canonical artifact, and adoption follows the sequence below.

## 5. Adoption sequence (outline; each step separately gated)

```text
1. CTO review of this proposal + mapping contract (this PR, Draft).
2. Owner approval of the users/app_account shape (DDL adoption decision).
3. Canonical slice registration: new db/migrations file + manifest entry with
   byte-exact checksum + structured approval_reference (#3846/#3982 pattern).
4. Adoption-baseline attestation per DB_MIGRATION_PROVENANCE_GATE before any
   runner activation (stream stays inactive until then).
5. Execution only via the fail-closed canonical runner protocol.
6. Backfill plan for users.account_id and any NOT NULL tightening = separate
   approved slices (bridge Phase F), never bundled here.
7. Only then: #4157-pattern Tree Fork write-gate re-activation slice.
```

## 6. Rollback posture

Pure additive shapes: view drop, table drops in reverse dependency order, or `DROP COLUMN account_id` when adopted additively onto an existing lineage. No data rewrite exists to undo because none is performed. Audit rows are retained (append-only history).

## 7. Prototype validation (nonprod, zero provider contact)

Executed locally in a clean ext4 checkout; classification EXECUTED_FAKE / SOURCE_STATIC:

```text
tests/contracts/users-ddl-proposal-4006-contract.test.cjs
  - SQL structure, additive-only guarantee, fork-parity column simulation,
    manifest-untouched proof, doc/preflight marker presence.
tests/contracts/auth-mapping-linking-contract-4006.test.cjs
  - pure in-memory linking/resolution state machine proving the mapping
    contract rules R1-R4 (see AUTH_THREE_LAYER_MAPPING_CONTRACT_4006.md),
    including fail-closed matrix, idempotency, takeover prevention,
    audit exactly-once, privacy screening, recovery path.
```

No network, no database engine, no Firebase/Neon/Auth provider, no Production resource. Results are recorded in the PR evidence block.

## 8. Open decisions reserved for CTO/owner

1. Whether `users.account_id` backfill precedes or follows fork-gate re-activation.
2. Display-name storage location (app_account vs profile table) at Phase F.
3. Exact audit retention policy (append-only forever vs bounded archival).

Refs #4006. Refs #4004 — Keep OPEN. Refs #4157. Refs #4164.
Refs #1882 — Keep OPEN.
