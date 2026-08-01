# Database Recovery Production Target Attribution

> **Parent:** Issue #3460 (Keep OPEN).
> **This child:** Issue #3812 — attribute the active Modal Production database to one Neon project boundary without disclosure.
> **Completed prerequisite:** Issue #3807 / PR #3808 — sanitized read-only Neon recovery capability audit (merged; verdict `PROVIDER_CAPABILITY_UNVERIFIED` because the Production target could not be attributed).
> **Source policy:** `docs/ops/DATABASE_SNAPSHOT_RETENTION_RESTORE_DRILL_POLICY.md`.
> **Provider capability audit:** `docs/ops/DATABASE_RECOVERY_PROVIDER_CAPABILITY_AUDIT.md`.
> **Hard governance:** `docs/ops/MVP_AGENT_GOVERNANCE.md`.

Refs #3812
Refs #3807 — completed.
Refs #3460 — Keep OPEN.
Refs #3458 — Keep OPEN.
Refs #3435 — Keep OPEN.
Refs #1882 — Keep OPEN.

## 1. Scope and explicit non-actions

This child verifies only whether the active Modal `lovebud-db` `DATABASE_URL` endpoint
identity maps to exactly one currently accessible Neon project boundary, using an
in-memory, blinded comparison that never records or prints the value. It does **not**
perform or authorize:

- any PostgreSQL connection, socket open, handshake, or SQL execution (including
  connectivity, introspection, or health queries);
- any `POST` / `PUT` / `PATCH` / `DELETE` provider call;
- snapshot creation or deletion, schedule creation or modification, retention change,
  branch creation/change/deletion, endpoint start or suspend, restore, restore preview,
  or finalize-restore;
- `modal deploy`, `modal serve`, persistent App/Function deployment, web endpoint,
  schedule, queue, volume, or secret creation/update;
- any Production, provider, or Cloudflare mutation;
- inspection of secrets, credentials, connection strings, or environment values outside the
  bounded in-memory comparison;
- any schema/table/row inspection, migration decision, or binding change (#3458 / #3435
  territory);
- recording of the `DATABASE_URL` value, connection string, endpoint identity, any
  project, branch, or endpoint identifier, any account or organization identifier, or any
  derived value that could identify a resource.

Nothing in this document changes any provider configuration or grants recovery execution
authority.

## 2. Authority baseline

Repository authority (`REPOSITORY_CONFIRMED`):

- Cloudflare Pages is the official user-facing entry.
- Modal is the active compute/runtime priority path.
- The Modal secret alias is `lovebud-db`, injecting `DATABASE_URL`; the source binding is
  `modal.Secret.from_name("lovebud-db")`.

The exact starting `origin/main` for this child was the PR #3808 merge commit. The actual
remote state was verified at session start, and the latest `origin/main` was used.

## 3. Sanitized comparison method

- **Neon GET-only boundary:** the already-configured authenticated Neon GET boundary was
  used only for provider metadata retrieval. Raw responses were handled in process memory
  and were not persisted.
- **Blinded candidate material:** endpoint identities were normalized in process memory
  into session-bounded blinded comparison material using one-time random comparison
  material. Only blinded material was prepared; no raw endpoint identity was passed onward.
- **Modal boundary:** an existing authenticated Modal operator boundary was available. One
  disposable ephemeral Modal run injected the existing `lovebud-db` secret by name, read
  only `DATABASE_URL` from the injected environment, parsed only the endpoint identity in
  process memory, and performed a constant-time equality comparison against the blinded
  candidate material.
- **Output:** the run returned exactly one enum value. No secret value, endpoint identity,
  identifier, object count, or traceback containing private material was printed or
  recorded.
- **Ephemerality:** the disposable script and all comparison material were deleted after
  the run. No persistent App, Function, secret, volume, queue, schedule, or endpoint was
  created.

## 4. Production target attribution result

| Item | Value |
|---|---|
| Modal active binding source-confirmed | `YES` |
| Modal authenticated boundary available | `YES` |
| Neon authenticated GET boundary available | `YES` |
| safe in-memory comparison completed | `YES` |
| Production target attribution | `VERIFIED_UNIQUE` |
| Production root branch attribution | `UNKNOWN` |
| raw response persisted | `NO` |
| private identifier recorded | `NO` |
| provider mutation count | `0` |
| DB connection count | `0` |
| SQL execution count | `0` |

The active Modal `lovebud-db` `DATABASE_URL` endpoint identity matched exactly one
currently accessible Neon project boundary during this comparison session. Uniqueness is
expressed by the enum alone; no identifier, value, or count is recorded here.

## 5. Consequences for recovery verification

Because the result is `VERIFIED_UNIQUE`:

- This child performs no further provider action.
- Provider configuration inspection: `PENDING_SEPARATE_CHILD`.
- Snapshot configuration: `NOT_AUTHORIZED`.
- Restore drill: `NOT_AUTHORIZED`.

No project identifier is persisted for later workers. Future provider children must repeat
the same private in-memory attribution gate during their own session before any
project-scoped action.

## 6. Dependency boundary with #3458 and #3435

- #3458 retains exclusive ownership of the migration ledger, schema manifests, catalog
  drift, migration provenance, and deploy preconditions.
- #3435 retains ownership of database/table identity, schema drift, dependency preflight,
  and eventual schema reconciliation.

This child verified only which Neon project boundary backs the active Modal secret. No
schema inspection, SQL, row access, migration decision, or environment-binding correction
was authorized or performed.

## 7. Smallest next #3460 child

The smallest next child is a **separately approved, sanitized provider configuration
inspection** of the attributed project boundary: it must re-run the same private in-memory
attribution gate during its own session, then record only sanitized restore-window,
schedule, and retention state using the recovery policy vocabulary. Snapshot configuration
and the isolated-copy restore drill remain separate later approvals.

## 8. Privacy self-audit

- No secret value, connection string, endpoint identity, project/branch/endpoint
  identifier, account/organization identifier, credential, raw provider response, exact
  object count, exact time, or Modal log containing private material appears in this
  document or in this PR.
- The fixed repository-known aliases `lovebud-db` and `DATABASE_URL` appear only as
  source-level configuration identifiers; their values were never inspected outside the
  bounded in-memory comparison process or recorded.
- Only statuses, enums, and the policy vocabulary are recorded.
- All disposable comparison material and scripts were deleted after the session; no raw
  provider response or private artifact remains.
- Manual semantic review (English and Korean) confirms that no project/account/organization
  name, endpoint, branch, object count, or exact time is disclosed.
