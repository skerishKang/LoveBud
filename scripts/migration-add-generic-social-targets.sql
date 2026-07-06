-- Migration A: Additive generic social target preparation
--
-- Adds generic target_kind and target_id columns to social_idempotency
-- and social_audit_log, backfills existing rows, installs legacy-memory
-- compatibility triggers so unchanged moment writers produce canonical
-- generic target pairs.
--
-- Refs #3262
-- Refs #1882
--
-- This is Migration A as defined by Issue #3260. It is strictly additive
-- preparation only. No column is renamed or dropped. No NOT NULL constraint
-- is relaxed. Tree runtime deployment remains blocked until Migration B.
--
-- ============================================================================
-- Design decisions
-- ============================================================================
--
-- 1. Generic target columns target_kind and target_id are nullable.
--    Migration B owns NOT NULL relaxation and generic-writer cutover.
--
-- 2. CHECK constraints enforce:
--    - generic pair is both null or both non-null
--    - when non-null, target_kind is exactly 'memory' or 'tree'
--
-- 3. Legacy-memory compatibility triggers ensure that moment writers
--    (reactions.py, comments.py) which populate only legacy moment-target
--    fields (target_memory_id, memory_id) automatically create canonical
--    generic pairs: target_kind = 'memory', target_id from the legacy field.
--
-- 4. The trigger rejects:
--    - partial generic pairs (one null, one set)
--    - target_kind = 'tree' during Migration A
--    - target_id mismatch with legacy memory field
--
-- 5. Backfill is safe to re-run. It only fills rows where generic fields
--    are absent, checking for valid legacy memory target.
--
-- Deploy order:
--   1. Apply this migration to the database.
--   2. Run aggregate-only verification queries.
--   3. Do NOT deploy Modal/Cloudflare tree runtime at this stage.
--
-- Rollback:
--   This migration is additive. To roll back:
--   1. Roll back any runtime that depends on generic target fields first.
--   2. Separate approval required for schema rollback.
-- ============================================================================

BEGIN;

-- ── 1. Prerequisite checks ─────────────────────────────────────────────────
-- Fail atomically if the moment social hardening migration has not been applied.

DO $$
DECLARE
    idempotency_tbl regclass;
    audit_tbl regclass;
BEGIN
    idempotency_tbl := to_regclass('public.social_idempotency');
    audit_tbl := to_regclass('public.social_audit_log');

    IF idempotency_tbl IS NULL THEN
        RAISE EXCEPTION 'Prerequisite table public.social_idempotency not found. Migration A requires the moment social hardening schema (Issues #3177).';
    END IF;

    IF audit_tbl IS NULL THEN
        RAISE EXCEPTION 'Prerequisite table public.social_audit_log not found. Migration A requires the moment social hardening schema (Issues #3177).';
    END IF;
END $$;

-- ── 2. Additive generic target columns ─────────────────────────────────────

ALTER TABLE social_idempotency
    ADD COLUMN IF NOT EXISTS target_kind VARCHAR(16);

ALTER TABLE social_idempotency
    ADD COLUMN IF NOT EXISTS target_id UUID;

ALTER TABLE social_audit_log
    ADD COLUMN IF NOT EXISTS target_kind VARCHAR(16);

ALTER TABLE social_audit_log
    ADD COLUMN IF NOT EXISTS target_id UUID;

-- ── 3. Existing-row backfill ───────────────────────────────────────────────
--
-- Backfill only rows where both generic fields are currently absent.
-- Do not overwrite an existing complete generic pair.

UPDATE social_idempotency
SET target_kind = 'memory',
    target_id = target_memory_id
WHERE target_kind IS NULL
  AND target_id IS NULL;

UPDATE social_audit_log
SET target_kind = 'memory',
    target_id = memory_id
WHERE target_kind IS NULL
  AND target_id IS NULL;

-- Post-backfill validation: fail atomically if any row has an invalid state.

DO $$
DECLARE
    null_pair BIGINT;
    partial_pair BIGINT;
    non_memory BIGINT;
    mismatch BIGINT;
BEGIN
    SELECT COUNT(*) INTO null_pair
    FROM social_idempotency
    WHERE target_kind IS NULL OR target_id IS NULL;

    SELECT COUNT(*) INTO partial_pair
    FROM social_idempotency
    WHERE (target_kind IS NULL AND target_id IS NOT NULL)
       OR (target_kind IS NOT NULL AND target_id IS NULL);

    SELECT COUNT(*) INTO non_memory
    FROM social_idempotency
    WHERE target_kind IS NOT NULL AND target_kind != 'memory';

    SELECT COUNT(*) INTO mismatch
    FROM social_idempotency
    WHERE target_kind IS NOT NULL
      AND target_id IS NOT NULL
      AND target_id != target_memory_id;

    IF null_pair > 0 THEN
        RAISE EXCEPTION 'social_idempotency: % row(s) have NULL generic pair after backfill', null_pair;
    END IF;

    IF partial_pair > 0 THEN
        RAISE EXCEPTION 'social_idempotency: % row(s) have partial generic pair', partial_pair;
    END IF;

    IF non_memory > 0 THEN
        RAISE EXCEPTION 'social_idempotency: % row(s) have target_kind other than memory', non_memory;
    END IF;

    IF mismatch > 0 THEN
        RAISE EXCEPTION 'social_idempotency: % row(s) have target_id different from legacy target_memory_id', mismatch;
    END IF;

    SELECT COUNT(*) INTO null_pair
    FROM social_audit_log
    WHERE target_kind IS NULL OR target_id IS NULL;

    SELECT COUNT(*) INTO partial_pair
    FROM social_audit_log
    WHERE (target_kind IS NULL AND target_id IS NOT NULL)
       OR (target_kind IS NOT NULL AND target_id IS NULL);

    SELECT COUNT(*) INTO non_memory
    FROM social_audit_log
    WHERE target_kind IS NOT NULL AND target_kind != 'memory';

    SELECT COUNT(*) INTO mismatch
    FROM social_audit_log
    WHERE target_kind IS NOT NULL
      AND target_id IS NOT NULL
      AND target_id != memory_id;

    IF null_pair > 0 THEN
        RAISE EXCEPTION 'social_audit_log: % row(s) have NULL generic pair after backfill', null_pair;
    END IF;

    IF partial_pair > 0 THEN
        RAISE EXCEPTION 'social_audit_log: % row(s) have partial generic pair', partial_pair;
    END IF;

    IF non_memory > 0 THEN
        RAISE EXCEPTION 'social_audit_log: % row(s) have target_kind other than memory', non_memory;
    END IF;

    IF mismatch > 0 THEN
        RAISE EXCEPTION 'social_audit_log: % row(s) have target_id different from legacy memory_id', mismatch;
    END IF;
END $$;

-- ── 4. Generic-pair CHECK constraints ──────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_idempotency_generic_target_pair_check'
          AND conrelid = 'social_idempotency'::regclass
    ) THEN
        ALTER TABLE social_idempotency
            ADD CONSTRAINT social_idempotency_generic_target_pair_check
            CHECK (
                (target_kind IS NULL AND target_id IS NULL)
                OR
                (target_kind IS NOT NULL AND target_id IS NOT NULL)
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_idempotency_generic_target_kind_check'
          AND conrelid = 'social_idempotency'::regclass
    ) THEN
        ALTER TABLE social_idempotency
            ADD CONSTRAINT social_idempotency_generic_target_kind_check
            CHECK (target_kind IS NULL OR target_kind IN ('memory', 'tree'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_audit_log_generic_target_pair_check'
          AND conrelid = 'social_audit_log'::regclass
    ) THEN
        ALTER TABLE social_audit_log
            ADD CONSTRAINT social_audit_log_generic_target_pair_check
            CHECK (
                (target_kind IS NULL AND target_id IS NULL)
                OR
                (target_kind IS NOT NULL AND target_id IS NOT NULL)
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_audit_log_generic_target_kind_check'
          AND conrelid = 'social_audit_log'::regclass
    ) THEN
        ALTER TABLE social_audit_log
            ADD CONSTRAINT social_audit_log_generic_target_kind_check
            CHECK (target_kind IS NULL OR target_kind IN ('memory', 'tree'));
    END IF;
END $$;

-- ── 5. Legacy-memory compatibility triggers ───────────────────────────────
--
-- These BEFORE INSERT OR UPDATE triggers ensure that unchanged moment writers
-- (which populate only legacy memory target fields) automatically generate
-- canonical generic target pairs.
--
-- Tree writers remain blocked until Migration B (separately approved) and
-- later runtime hardening.

-- Function for social_idempotency
CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Case 1: Both generic fields absent → set from legacy memory target
    IF NEW.target_kind IS NULL AND NEW.target_id IS NULL THEN
        NEW.target_kind := 'memory';
        NEW.target_id := NEW.target_memory_id;
        RETURN NEW;
    END IF;

    -- Case 2: Exactly one generic field absent → reject partial state
    IF (NEW.target_kind IS NULL AND NEW.target_id IS NOT NULL)
       OR (NEW.target_kind IS NOT NULL AND NEW.target_id IS NULL) THEN
        RAISE EXCEPTION 'Partial generic target pair: both target_kind and target_id must be set or both null'
            USING ERRCODE = 'P0001';
    END IF;

    -- Case 3: Generic pair present but not equivalent to legacy memory target.
    -- Tree writers remain blocked until Migration B and runtime hardening.
    IF NEW.target_kind IS NOT NULL THEN
        IF NEW.target_kind != 'memory' THEN
            RAISE EXCEPTION 'target_kind % is not allowed in Migration A. Only memory targets are supported until Migration B is approved and applied.',
                NEW.target_kind
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.target_id IS DISTINCT FROM NEW.target_memory_id THEN
            RAISE EXCEPTION 'Generic target_id % does not match legacy target_memory_id %. Tree writers remain blocked until Migration B.',
                NEW.target_id, NEW.target_memory_id
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Function for social_audit_log
CREATE OR REPLACE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Case 1: Both generic fields absent → set from legacy memory target
    IF NEW.target_kind IS NULL AND NEW.target_id IS NULL THEN
        NEW.target_kind := 'memory';
        NEW.target_id := NEW.memory_id;
        RETURN NEW;
    END IF;

    -- Case 2: Exactly one generic field absent → reject partial state
    IF (NEW.target_kind IS NULL AND NEW.target_id IS NOT NULL)
       OR (NEW.target_kind IS NOT NULL AND NEW.target_id IS NULL) THEN
        RAISE EXCEPTION 'Partial generic target pair: both target_kind and target_id must be set or both null'
            USING ERRCODE = 'P0001';
    END IF;

    -- Case 3: Generic pair present but not equivalent to legacy memory target.
    -- Tree writers remain blocked until Migration B and runtime hardening.
    IF NEW.target_kind IS NOT NULL THEN
        IF NEW.target_kind != 'memory' THEN
            RAISE EXCEPTION 'target_kind % is not allowed in Migration A. Only memory targets are supported until Migration B is approved and applied.',
                NEW.target_kind
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.target_id IS DISTINCT FROM NEW.memory_id THEN
            RAISE EXCEPTION 'Generic target_id % does not match legacy memory_id %. Tree writers remain blocked until Migration B.',
                NEW.target_id, NEW.memory_id
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Create triggers with guarded existence check (no DROP TRIGGER).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_social_idempotency_sync_generic_target'
          AND tgrelid = 'social_idempotency'::regclass
    ) THEN
        CREATE TRIGGER trg_social_idempotency_sync_generic_target
            BEFORE INSERT OR UPDATE
            ON social_idempotency
            FOR EACH ROW
            EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_social_audit_log_sync_generic_target'
          AND tgrelid = 'social_audit_log'::regclass
    ) THEN
        CREATE TRIGGER trg_social_audit_log_sync_generic_target
            BEFORE INSERT OR UPDATE
            ON social_audit_log
            FOR EACH ROW
            EXECUTE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory();
    END IF;
END $$;

COMMIT;

-- ── 6. Verification queries (aggregate-only, safe) ─────────────────────────
--
-- Run these after apply to confirm Migration A state.
--
-- === Generic pair null/partial count ===
-- SELECT
--     'social_idempotency' AS table_name,
--     COUNT(*) FILTER (WHERE target_kind IS NULL OR target_id IS NULL) AS null_pair,
--     COUNT(*) FILTER (WHERE (target_kind IS NULL AND target_id IS NOT NULL) OR (target_kind IS NOT NULL AND target_id IS NULL)) AS partial_pair
-- FROM social_idempotency
-- UNION ALL
-- SELECT
--     'social_audit_log',
--     COUNT(*) FILTER (WHERE target_kind IS NULL OR target_id IS NULL),
--     COUNT(*) FILTER (WHERE (target_kind IS NULL AND target_id IS NOT NULL) OR (target_kind IS NOT NULL AND target_id IS NULL))
-- FROM social_audit_log;
--
-- === Generic kind distribution ===
-- SELECT target_kind, COUNT(*)::int AS row_count
-- FROM social_idempotency
-- GROUP BY target_kind
-- ORDER BY target_kind;
-- SELECT target_kind, COUNT(*)::int AS row_count
-- FROM social_audit_log
-- GROUP BY target_kind
-- ORDER BY target_kind;
--
-- === Generic-to-legacy mismatch count ===
-- SELECT COUNT(*)::int AS mismatch_count
-- FROM social_idempotency
-- WHERE target_kind IS NOT NULL
--   AND target_id IS NOT NULL
--   AND target_id != target_memory_id;
-- SELECT COUNT(*)::int AS mismatch_count
-- FROM social_audit_log
-- WHERE target_kind IS NOT NULL
--   AND target_id IS NOT NULL
--   AND target_id != memory_id;
--
-- === Trigger presence ===
-- SELECT tgname AS trigger_name, tgrelid::regclass AS table_name
-- FROM pg_trigger
-- WHERE tgname IN ('trg_social_idempotency_sync_generic_target', 'trg_social_audit_log_sync_generic_target');
