# Proposal DDL artifacts

This directory holds **proposal-only** SQL design artifacts.

- Nothing here is part of the canonical migration stream (`db/migrations/`).
- Nothing here may be executed against any database by this repository alone.
- Canonical adoption requires a separate approved slice registered in
  `db/migration-provenance/canonical-migrations.json` with an immutable id and
  byte-exact checksum.

Current artifact:

- `4006-canonical-users-auth-identity-proposal.sql` — Issue #4006 CANONICAL
  `users` / `app_account` / `app_auth_identity` DDL proposal. Classification:
  `PROPOSAL_ONLY_DOCUMENT_ARTIFACT`.

Refs #4006. Refs #1882 — Keep OPEN.
