# LoveBud DB Migration Provenance Adoption Operator Checklist

## Purpose and Non-Authority

This checklist documents what an operator must prepare before Phase B Production-readonly catalog collection can be reviewed for execution approval. It is not an execution approval document. It does not execute Phase B. It does not approve, start, or run catalog collection. It does not create credentials, validate credential values, discover actual PostgreSQL roles, write actual role mappings, connect to Production, collect catalog evidence, activate manifests, or implement ledgers or runners. No database or Production access occurs in this boundary. No migration, rollback, or collection execution occurs in this boundary. No manifest activation occurs in this boundary.

This document is a preparation and review aid. Approval gates, execution boundaries, and fail-closed checks remain in the committed source contracts listed in Repository References.

## Current Fail-Closed State

The following state is read from current main source files. Do not interpret an empty manifest as an empty production schema. Run status and evidence status are authoritative; manifest shape alone is not.

### canonical-migrations.json

- Status: ADOPTION_REQUIRED
- Migrations count: 0
- Source: `db/migration-provenance/canonical-migrations.json`

### expected-schema-manifest.json

- Status: ADOPTION_REQUIRED
- Critical objects count: 0
- Source: `db/migration-provenance/expected-schema-manifest.json`

### Production catalog collection

- Run status: COLLECTION_NOT_RUN (#3569 outcome)
- Retry status: COLLECTION_NOT_RUN_CONNECTION_BOUNDARY (#3572 outcome); subreason: DEDICATED_INPUTS_UNAVAILABLE; retry session not started

### Authoritative target-ledger evidence

- Status: NONE
- Ledger relation: not created (DDL deferred)
- Applied migration records: none

### Adoption attestation

- Status: NOT_ISSUED
- Prepared attestation draft remains UNATTESTED
- Overall gate: FAIL_CLOSED with GATE_ADOPTION_BASELINE_REQUIRED

### Manifest activation

- Status: NOT_AUTHORIZED
- ADOPTION_REQUIRED -> ACTIVE requires separate owner approval after Phase C review

## Operator Roles and Separation of Duties

The operator-readiness boundary requires at least two distinct roles. A single operator identity must not hold both roles for the same collection session.

### Credential custodian

- Provides or approves the dedicated read-only credential (OI-1)
- Ensures the credential is stored only under `.secrets/` with the dedicated key name
- Does not execute collection
- Does not write credential values into repository issues, PRs, logs, docs, or chat
- Rotates or revokes the credential if the boundary is violated or the collection window expires

### Collection executor

- Prepares the abstract role mapping (OI-2)
- Requests Phase B execution approval with the prepared packet
- Executes only after explicit Phase B approval and verified boundary preflight
- Does not create or rotate credentials
- Does not modify role mapping after approval without returning for re-review

### Owner / approver

- Reviews the Phase B approval packet
- Issues separate approvals for Phase B execution, Phase C evidence review, Phase D manifest activation, and Phase E ledger/runner/bootstrap
- None of these approvals can be delegated to an agent or implied by checklist completion

## OI-1 Dedicated Read-Only Credential Readiness

The dedicated credential must satisfy all of the following before Phase B execution review. Actual credential values must never appear in this document, repository issues, PRs, logs, chat, or screenshots.

### Required properties

- Dedicated read-only purpose: the credential is issued solely for Production catalog metadata collection under this adoption plan; shared or dual-purpose credentials are not acceptable
- Write/DDL/DML prohibition: the credential must not carry CREATE, ALTER, DROP, INSERT, UPDATE, DELETE, TRUNCATE, or any mutation privilege on any schema
- Allowed object scope: collection is restricted to the reviewed object allowlist defined in `db/migration-provenance/adoption-baseline-collection-plan-contract.json`
- TLS policy: connection must use `sslmode=require`, `verify-ca`, or `verify-full`; disabled or preferred TLS is rejected by the boundary
- PostgreSQL major version policy: server version must satisfy major-17 window (`170000 <= server_version_num < 180000`); exact CI disposable version `170004` is not required for Production-readonly mode
- Loopback rejection: Production-readonly mode rejects loopback and non-remote host targets; this is a runtime boundary enforced by the source boundary, not an operator judgment call
- Secret key and location: the boundary contract defines the dedicated key name `LOVEBUD_PRODUCTION_READONLY_DATABASE_URL`; the value must reside under the repository-local `.secrets/` directory and must not be committed
- Generic DATABASE_URL rejection: generic `DATABASE_URL`, `NETLIFY_DATABASE_URL`, `POSTGRES_URL`, and similar fallbacks are rejected; only the dedicated key is accepted
- No environment fallback: the collection child does not fall back to environment-sourced credentials; boundary mode requires the dedicated secret file input
- Caller override rejection: connection flags such as `--password`, `--host`, `--user`, `--database`, `--port`, `--objects`, and `--sql` are prohibited by the boundary

### Custodian and executor separation

- The credential custodian and collection executor must be separate identities or separate approval events
- A single operator must not prepare the secret, inject it into a runner, execute collection, and review evidence in the same session
- Evidence review must be performed by a different identity or after a time-separated approval event

### Prohibited actions

- Do not write credential values into repository issues, PR descriptions, commit messages, logs, screenshots, or documentation
- Do not create example connection URLs, even with placeholder values; committed source prohibits URI-scheme connection-string examples in this boundary
- Do not inject the credential into any runner before Phase B execution approval is granted
- Do not reuse the credential outside the approved collection window
- If the credential boundary is violated, the operator must treat the session as compromised and fail closed

### Failure behavior

- Missing or invalid secret: boundary returns PRODUCTION_CATALOG_SECRET_REQUIRED or PRODUCTION_CATALOG_SECRET_FILE_INVALID
- Generic URL fallback: boundary returns PRODUCTION_CATALOG_GENERIC_DATABASE_URL_REJECTED
- TLS or version mismatch: boundary returns PRODUCTION_CATALOG_TLS_REQUIRED or PRODUCTION_CATALOG_SERVER_VERSION_UNSUPPORTED
- Loopback target: boundary returns PRODUCTION_CATALOG_LOOPBACK_REJECTED
- Any boundary failure: collection does not proceed; evidence is not collected; no partial success is claimed

## OI-2 Abstract Role-Mapping Template

Operators must prepare an abstract role mapping before Phase B execution approval. The mapping file is a structure-only template. Actual PostgreSQL role names must never appear in this template, the repository, or collection evidence.

### Template sentinel

Use the following sentinel structure exactly. Keys must be `ROLE_PLACEHOLDER_1` through `ROLE_PLACEHOLDER_5`. Values must be the exact committed abstract role classes listed below. Do not substitute placeholder strings for actual role classes in a committed template.

```json
<!-- ROLE_MAPPING_TEMPLATE_START -->
{
  "ROLE_PLACEHOLDER_1": "PUBLIC",
  "ROLE_PLACEHOLDER_2": "APPLICATION",
  "ROLE_PLACEHOLDER_3": "AUTHENTICATED",
  "ROLE_PLACEHOLDER_4": "SERVICE",
  "ROLE_PLACEHOLDER_5": "OWNER_CLASS"
}
<!-- ROLE_MAPPING_TEMPLATE_END -->
```

### Permitted abstract role classes

Extract the exact allowed classes from `db/migration-provenance/adoption-baseline-collection-plan-contract.json` field `role_mapping_classes`. Do not guess or add classes. The committed contract currently permits:

- PUBLIC
- APPLICATION
- AUTHENTICATED
- SERVICE
- OWNER_CLASS

Each permitted class must appear exactly once in the template. Duplicate values are prohibited. Unknown values are rejected by the boundary.

### Placeholder rules

- Keys must match `ROLE_PLACEHOLDER_[0-9]+` exactly
- Values must be one of the five committed abstract role classes
- No inferred mapping, example username, application account name, or actual PostgreSQL role name may be substituted for a placeholder value
- The template is a structure example only; it is not the actual mapping file; it does not represent an approved mapping

### Prohibited content

- Actual PostgreSQL role names
- Schema-qualified role names
- Service account names
- Email-like, host-like, or credential-like values
- Connection URLs or hostnames
- Any value that resembles a secret, token, password, or certificate

## Placeholder and Redaction Rules

The following redaction rules apply to all operator-prepared materials for this adoption boundary.

- Credential values: never written, pasted, summarized, screenshotted, logged, or committed
- Abstract role mapping values: placeholders only; actual role names never leave the operator boundary
- Connection URLs: never included in any committed document or issue body, even with placeholder hostnames
- Collection evidence: only sanitized outputs listed in the contract are shared outside the operator boundary
- Raw catalog rows, object owner identities, endpoint names, and user-data values: never committed or shared
- Provider project, branch, database owner, grantee name: never included in shared evidence

## Phase B Approval Packet

The operator must prepare the following items before requesting Phase B execution approval. This checklist does not constitute approval.

### Operator inputs

1. OI-1 readiness confirmation:
   - Dedicated read-only credential exists under `.secrets/` with the dedicated key name
   - Credential satisfies TLS, version, loopback, object scope, and write-prohibition properties listed in OI-1
   - Credential custodian is identified and separate from collection executor

2. OI-2 abstract role mapping confirmation:
   - Template uses only committed abstract role classes
   - Template contains exactly five entries with distinct placeholder keys
   - Template has been reviewed but not yet injected into any runner or script

3. Reviewed plan confirmation:
   - `db/migration-provenance/adoption-baseline-collection-plan-contract.json` is the active reviewed plan
   - Object allowlist, role mapping classes, read-only proofs, and expected outputs are accepted without modification
   - Any change to the reviewed plan requires returning for re-review

### Pre-approval boundary verification

- Boundary contract source has been read: `scripts/production-readonly-catalog-boundary-core.cjs`
- Collection runner source has been read: `scripts/run-production-readonly-catalog-collection.cjs`
- Receipt builder source has been read: `scripts/phase-b-collection-receipt-core.cjs`
- Operator understands that collection runs in a single `BEGIN READ ONLY` transaction confirmed by `SHOW transaction_read_only`, ending with `ROLLBACK`
- Operator understands that no mutation SQL, no caller SQL, and no application row reads are permitted

### Approval event

- Phase B execution approval must be a distinct, explicit, time-stamped event
- Approval reference must match the contract pattern: `issue:<n>` or `decision:<slug>`
- Free-text approval statements such as "approved" are not accepted by the attestation and gate contracts
- Approval does not imply Phase C, Phase D, or Phase E approval

## Phase B Bounded Preflight

After Phase B execution approval is granted, the collection session must pass the following preflight checks. These checks are boundary-owned; operators must not bypass them.

### Secret preflight

- Dedicated secret file exists under `.secrets/`
- Secret file contains only the dedicated key `LOVEBUD_PRODUCTION_READONLY_DATABASE_URL`
- Secret value is not logged or echoed during boundary validation
- Generic `DATABASE_URL` fallback is rejected

### URL and TLS preflight

- Scheme is `postgres:` or `postgresql:`
- Host is remote and non-loopback
- TLS mode is `require`, `verify-ca`, or `verify-full`
- Disabled or preferred TLS modes are rejected

### Version preflight

- Server version satisfies major-17 window (`170000 <= server_version_num < 180000`)

### Allowlist preflight

- Collection uses only the reviewed object allowlist from the committed collection plan contract
- Caller object override is rejected
- Object kinds are limited to TABLE, VIEW, MATERIALIZED_VIEW

### Role mapping preflight

- Abstract role mapping file is present and valid
- All role classes are from the committed enum
- Unknown raw roles fail closed; raw role names are never logged

### Transaction preflight

- Collection opens `BEGIN READ ONLY`
- Transaction read-only status is confirmed before catalog queries
- Transaction ends with `ROLLBACK`; commit is not permitted for this collection mode

### Failure behavior

Any preflight failure halts collection immediately. The boundary returns one of the committed failure categories. No catalog evidence is produced. No partial success is claimed. The operator must remediate the specific failure and restart preflight.

## Permitted Collection Scope

The approved Phase B collection must operate within the following scope. Anything outside this scope is out of bounds even if the boundary preflight passes.

### Objects

- Only the 9 tables in the reviewed allowlist:
  - table:public.trees
  - table:public.memories
  - table:public.tree_comments
  - table:public.tree_likes
  - table:public.tree_social_counts
  - table:public.reactions
  - table:public.comments
  - table:public.social_idempotency
  - table:public.social_audit_log

### Metadata categories

- columns, types, nullability, defaults, primary_keys, unique_constraints, foreign_keys, indexes, triggers, row_level_security, grants, table_kind

### Database objects excluded

- application row data
- raw catalog rows
- object owner identities
- endpoint names
- functions, procedures, extensions, publications, subscriptions, or other objects not in the allowlist

### Connection behavior

- read-only transaction only
- no caller SQL
- no shell command execution
- no network calls beyond the approved single remote PostgreSQL target
- no environment variable fallback or secret discovery

## Sanitized Output and Receipt Expectations

Phase B collection produces only sanitized outputs. Raw or unsanitized outputs must not leave the operator boundary.

### Permitted outputs

- SANITIZED_CATALOG_EVIDENCE: sanitized object metadata in gate-compatible shape
- CATALOG_EVIDENCE_DIGEST: SHA-256 digest of exact sanitized evidence bytes
- INACTIVE_EXPECTED_SCHEMA_CANDIDATE: reviewable candidate; does not activate committed manifests
- COLLECTION_PLAN_DIGEST: SHA-256 digest of the reviewed plan bytes
- OBJECT_ALLOWLIST_DIGEST: SHA-256 digest of the reviewed allowlist bytes
- PREPARED_ATTESTATION_DRAFT: remains UNATTESTED until owner approval
- BOUNDED_COLLECTION_OUTCOME: bounded outcome record; no partial success claim

### Receipt requirements

- Receipt must be built by `scripts/phase-b-collection-receipt-core.cjs` or equivalent committed receipt builder
- Receipt must pass prohibited-field and sensitive-value recursive scans
- Receipt digest must be recomputed from provided artifacts; caller-supplied digests are not trusted
- Receipt must carry a brand that distinguishes genuine receipts from forged or cloned receipts

### Prohibited outputs

- raw catalog rows
- row values
- payload
- connection strings
- hostnames
- provider project or branch identifiers
- operator identity or email
- raw role names
- grantee names
- database owner names

## Stop and Failure Categories

The following failure categories are defined in `db/migration-provenance/production-readonly-catalog-boundary-contract.json` and `scripts/production-readonly-catalog-boundary-core.cjs`. Use these exact category strings in operator reports and boundary logs.

### Input and secret failures

- PRODUCTION_CATALOG_INPUT_INVALID
- PRODUCTION_CATALOG_SECRET_REQUIRED
- PRODUCTION_CATALOG_SECRET_FILE_INVALID
- PRODUCTION_CATALOG_GENERIC_DATABASE_URL_REJECTED

### URL, TLS, and version failures

- PRODUCTION_CATALOG_URL_INVALID
- PRODUCTION_CATALOG_TLS_REQUIRED
- PRODUCTION_CATALOG_LOOPBACK_REJECTED
- PRODUCTION_CATALOG_SERVER_VERSION_UNSUPPORTED

### Allowlist and role mapping failures

- PRODUCTION_CATALOG_ALLOWLIST_REQUIRED
- PRODUCTION_CATALOG_ROLE_MAPPING_REQUIRED
- PRODUCTION_CATALOG_ROLE_MAPPING_INVALID

### Boundary and policy failures

- PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED
- PRODUCTION_CATALOG_POLICY_INVALID
- PRODUCTION_CATALOG_HANDLE_INVALID

### Documentation-only category

If a stop condition is encountered that is not covered by the committed boundary categories, document it as:

DOCUMENT_CHECKLIST_CATEGORY

This marker distinguishes repository runtime enums from documentation-only observations. Do not promote documentation-only categories to runtime enums without a separate code change and approval.

## Phase C Evidence-Review Handoff

Phase C begins only after Phase B collection completes and produces bounded sanitized outputs.

### Evidence requirements

- SANITIZED_CATALOG_EVIDENCE must pass the receipt builder prohibited-field and sensitive-value scans
- CATALOG_EVIDENCE_DIGEST must match recomputed digest from the exact sanitized evidence bytes
- INACTIVE_EXPECTED_SCHEMA_CANDIDATE must be reviewable and must not claim ACTIVE status
- COLLECTION_PLAN_DIGEST and OBJECT_ALLOWLIST_DIGEST must match committed plan and allowlist digests
- No raw catalog rows, role names, connection strings, or operator identities may appear in the evidence package

### Drift classification

- MATCH: observed metadata exactly matches expected structure within the allowlist
- KNOWN_DRIFT: variance is within committed known_variance_codes and requires bounded explanation
- UNSUPPORTED_LEGACY_STATE: observed structure does not match any allowlisted object and has no approved policy path
- UNKNOWN_DRIFT: observed structure is unexpected and unexplained; this always blocks attestation

### Owner review

- Owner review is required; agent or checklist completion does not substitute for owner review
- Review must classify each variance category explicitly
- Review must produce an approval reference matching the contract pattern: `issue:<n>` or `decision:<slug>`
- Review does not automatically activate manifests; manifest activation is a separate Phase D decision

## Phase D Manifest-Activation Boundary

Manifest activation changes `db/migration-provenance/canonical-migrations.json` and `db/migration-provenance/expected-schema-manifest.json` from `ADOPTION_REQUIRED` to `ACTIVE`.

### Activation criteria

- Phase C review is complete and approved
- All variance classifications are MATCH or approved KNOWN_DRIFT with bounded known_variance_codes
- Adoption attestation evidence is strictly formed and verified
- Owner approval reference is present and contract-valid

### Activation prohibition

- Checklist completion alone does not activate manifests
- Phase B execution approval alone does not activate manifests
- Phase C review alone does not activate manifests
- Runner or ledger implementation alone does not activate manifests
- Any attempt to change manifest status without the complete approved attestation package fails closed

### Post-activation dependency

- Manifest activation unblocks ledger bootstrap migration and migration runner implementation (Phase E)
- Phase E remains separately approved

## Phase E Ledger and Runner Boundary

Phase E implements the physical ledger relation, migration runner, and canonical migration stream after Phase D activation.

### Dependency chain

- Phase D manifest activation must be complete
- Adoption attestation must be verified
- Ledger bootstrap migration must be separately approved
- Migration runner must be implemented and tested
- Clean-database reconstruction must be proven in disposable PostgreSQL before Production use

### Prohibited actions in Phase E

- Do not create the ledger relation before Phase D activation
- Do not execute the runner against Production before clean-database reconstruction is proven
- Do not apply canonical migrations without approved ledger records
- Do not bypass the deployment gate once implemented

## Rollback and Incident Posture

### Collection incident

- If the boundary fails during collection, the operator must stop immediately
- The transaction ends with ROLLBACK; commit is not permitted
- Partial success must not be claimed
- Incident must be reported with the exact boundary failure category
- Evidence must not be shared outside the operator boundary until the incident is reviewed

### Credential incident

- If the dedicated credential is exposed, the operator must treat the session as compromised
- Credential must be revoked or rotated through the provider console
- Collection must not continue with the exposed credential
- Incident must be reported independently of collection outcome

### Evidence incident

- If unsanitized evidence is discovered after collection, the operator must halt downstream processing
- Evidence must be quarantined and re-reviewed
- Attestation must not be issued until sanitization is verified

### Rollback direction

- Forward-fix is the preferred recovery direction for schema and evidence issues
- Rollback artifacts are incident-specific and may not be safe as generic down migrations
- Rollback artifact use requires its own preconditions, rehearsal evidence, and approval reference

## Operator Completion Checklist

Use this section to track preparation status. This checklist is a documentation aid; it does not constitute approval or execution.

### OI-1 readiness

- [ ] Dedicated read-only credential exists under `.secrets/` with the dedicated key name
- [ ] Credential satisfies TLS, version, loopback, object scope, and write-prohibition properties
- [ ] Credential custodian is identified and separate from collection executor
- [ ] Credential values are not present in any repository file, issue, PR, log, or documentation
- [ ] Credential rotation procedure is understood

### OI-2 readiness

- [ ] Abstract role mapping template uses only committed abstract role classes
- [ ] Template contains exactly five entries with distinct placeholder keys
- [ ] Template values are not actual PostgreSQL role names
- [ ] Template has been reviewed but not injected into any runner

### Phase B approval packet

- [ ] Reviewed plan confirmation: `db/migration-provenance/adoption-baseline-collection-plan-contract.json` is accepted without modification
- [ ] Boundary contract source has been read
- [ ] Collection runner source has been read
- [ ] Receipt builder source has been read
- [ ] Transaction behavior (`BEGIN READ ONLY`, confirm, `ROLLBACK`) is understood
- [ ] No-caller-SQL and no-mutation policy is understood

### Phase C readiness

- [ ] Owner review process is defined
- [ ] Drift classification vocabulary is understood
- [ ] Approval reference format is understood

### Phase D readiness

- [ ] Manifest activation criteria are understood
- [ ] Checklist completion is recognized as not equivalent to activation

### Phase E readiness

- [ ] Ledger bootstrap and runner dependency chain is understood
- [ ] Clean-database reconstruction is recognized as a prerequisite for Production use

## Repository References

Current main source files that define the contracts and boundaries documented in this checklist.

- `db/migration-provenance/adoption-baseline-collection-plan-contract.json`
- `db/migration-provenance/production-readonly-catalog-boundary-contract.json`
- `db/migration-provenance/adoption-attestation-contract.json`
- `db/migration-provenance/expected-schema-manifest.json`
- `db/migration-provenance/canonical-migrations.json`
- `scripts/production-readonly-catalog-boundary-core.cjs`
- `scripts/run-production-readonly-catalog-collection.cjs`
- `scripts/phase-b-collection-receipt-core.cjs`
- `scripts/adoption-baseline-collection-plan-core.cjs`
- `scripts/adoption-attestation-core.cjs`
- `docs/architecture/DB_MIGRATION_PROVENANCE_CURRENT_STATE_AUDIT.md`
- `docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md`
- `docs/architecture/DB_MIGRATION_PROVENANCE_GATE.md`

Refs #3622.
Refs #3620.
Refs #3458 — Keep #3458 OPEN.
Refs #3425 — Keep #3425 OPEN.
Refs #3435 — Keep #3435 OPEN.
Refs #3437 — Keep #3437 OPEN.
Refs #1882 — Keep #1882 OPEN.