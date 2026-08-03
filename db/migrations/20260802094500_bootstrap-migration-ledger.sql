-- Migration: Bootstrap the schema_migration_ledger table (canonical bootstrap migration)
--
-- Refs #3846
-- Refs #3458
-- Refs #3425
-- Refs #3435
-- Refs #1882
--
-- This bootstrap migration introduces the canonical schema_migration_ledger
-- relation that records applied canonical migrations. It is the first entry in
-- the canonical migration stream (db/migration-provenance/canonical-migrations.json).
--
-- The ledger contract (db/migration-provenance/ledger-contract.json) fixes the
-- relation name and the seven-field record shape. This migration creates that
-- relation with the exact columns, types, and constraints required by the
-- ledger read/append adapter (scripts/migration-postgres-ledger-adapter-core.cjs):
--
--   - Seven required columns matching POSTGRES_MIGRATION_LEDGER_FIELDS exactly.
--   - Applied_at as TIMESTAMPTZ with UTC normalization on read.
--   - migration_id with a UNIQUE constraint supporting ON CONFLICT (migration_id)
--     DO NOTHING for idempotent appends.
--   - transaction_outcome CHECK constraint matching READ_TRANSACTION_OUTCOMES.
--   - No prohibited fields (operator_email, operator_user_id, credential,
--     connection_string, raw_catalog_payload).
--
-- This migration is LOW risk and non-destructive: it only creates a new table.
-- No Production mutation is authorized by this rehearsal; the table is applied
-- only on disposable PostgreSQL 17.4 loopback databases via the clean bootstrap
-- orchestrator (scripts/migration-clean-bootstrap-orchestrator-core.cjs).
--
-- Usage (disposable CI only):
--   psql "$LB_TEST_PG*" -f db/migrations/20260802094500_bootstrap-migration-ledger.sql

CREATE TABLE IF NOT EXISTS schema_migration_ledger (
    migration_id         TEXT NOT NULL,
    content_checksum      TEXT NOT NULL,
    applied_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    runner_version        TEXT NOT NULL,
    environment_class     TEXT NOT NULL,
    deployed_commit       TEXT NOT NULL,
    transaction_outcome   TEXT NOT NULL,
    CONSTRAINT schema_migration_ledger_pkey PRIMARY KEY (migration_id),
    CONSTRAINT schema_migration_ledger_transaction_outcome_ck
        CHECK (transaction_outcome IN ('COMMITTED', 'ROLLED_BACK', 'PARTIAL', 'UNKNOWN'))
);
