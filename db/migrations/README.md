# Canonical migrations

This directory is reserved for the post-adoption canonical migration stream.

- Do not copy historical `scripts/*.sql` files here.
- Every new file requires one immutable `YYYYMMDDHHMMSS_slug` entry in `../migration-provenance/canonical-migrations.json`.
- The entry checksum must match the file byte-for-byte.
- A destructive migration requires `DESTRUCTIVE` risk, a non-empty approval reference, an isolated rehearsal, and a documented forward-fix or rollback decision.
- The canonical stream remains inactive until a separately approved, read-only adoption baseline is attested.

The initial bootstrap slice intentionally contained no executable migration: existing production history must not be fabricated from repository files. The current slice now contains three catalogued migrations (`20260802094500_bootstrap-migration-ledger`, `20260812213000_add-tree-appreciation-orders`, `20260822054500_canonical-users-auth-identity`). All remain `ADOPTION_REQUIRED` in `../migration-provenance/canonical-migrations.json`; catalogue population is distinct from runner activation, and the stream stays inactive until a separately approved, read-only adoption baseline is attested. The `20260822054500_canonical-users-auth-identity` slice is the adopted design of the `db/proposals/4006-canonical-users-auth-identity-proposal.sql` proposal (Issue #4006); execution authority still flows exclusively through this canonical stream's fail-closed runner protocol.

Refs #3458

Refs #1882

Keep #1882 OPEN.
