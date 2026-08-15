# Canonical migrations

This directory is reserved for the post-adoption canonical migration stream.

- Do not copy historical `scripts/*.sql` files here.
- Every new file requires one immutable `YYYYMMDDHHMMSS_slug` entry in `../migration-provenance/canonical-migrations.json`.
- The entry checksum must match the file byte-for-byte.
- A destructive migration requires `DESTRUCTIVE` risk, a non-empty approval reference, an isolated rehearsal, and a documented forward-fix or rollback decision.
- The canonical stream remains inactive until a separately approved, read-only adoption baseline is attested.

The initial bootstrap slice intentionally contained no executable migration: existing production history must not be fabricated from repository files. The current slice now contains two catalogued migrations (`20260802094500_bootstrap-migration-ledger`, `20260812213000_add-tree-appreciation-orders`). Both remain `ADOPTION_REQUIRED` in `../migration-provenance/canonical-migrations.json`; catalogue population is distinct from runner activation, and the stream stays inactive until a separately approved, read-only adoption baseline is attested.

Refs #3458

Refs #1882

Keep #1882 OPEN.
