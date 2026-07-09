-- Migration B: Generic social target compatibility cutover
--
-- Relaxes legacy moment-only NOT NULL constraints so future tree writers can
-- leave moment-target fields unset, makes the generic (target_kind, target_id)
-- pair authoritative, and updates compatibility triggers to:
--   - keep legacy-only moment writers working without runtime changes
--   - permit target_kind = 'tree' with null legacy memory fields
--   - reject partial pairs, unknown kinds, memory mismatches, and tree IDs
--     stored in legacy moment fields
--
-- Refs #3352
-- Refs #3264
-- Refs #3262
-- Refs #3260
-- Refs #3188
-- Refs #3075
-- Refs #1882
--
-- This is Migration B as defined by Issue #3260 / product contract
-- docs/product/lovebud-generic-social-write-target-contract.md.
--
-- ============================================================================
-- Design decisions
-- ============================================================================
--
-- 1. Legacy columns target_memory_id / memory_id remain present and readable.
--    Only their NOT NULL constraint is relaxed. They are not renamed or dropped.
--
-- 2. Generic columns target_kind / target_id become NOT NULL after preflight
--    confirms every existing row already has a complete pair (Gate A).
--
-- 3. Compatibility triggers still auto-fill target_kind = 'memory' and
--    target_id from the legacy memory field when both generic fields are
--    absent (unchanged moment writer path).
--
-- 4. Tree rows use only generic fields. Triggers reject any attempt to store a
--    tree target in the legacy memory columns.
--
-- 5. Memory generic/legacy mismatches are rejected when legacy is present.
--
-- 6. Rerunnable: DROP NOT NULL / SET NOT NULL are guarded by information_schema
--    nullability checks. Functions use CREATE OR REPLACE. New CHECKs are
--    guarded with IF NOT EXISTS.
--
-- Deploy order:
--   1. Confirm Verification Gate A is complete (#3264).
--   2. Apply this migration under separate CTO approval.
--   3. Run aggregate-only verification queries from the Migration B runbook.
--   4. Do NOT deploy tree-like runtime hardening in this migration task.
--
-- Rollback:
--   Additive/compatibility-oriented. Schema rollback (re-tightening NOT NULL,
--   dropping new CHECKs, reverting trigger bodies) requires separate approval
--   and is not automatic. Roll back any runtime that depends on tree generic
--   targets first.
-- ============================================================================

BEGIN;

-- ── 1. Prerequisite: Migration A schema present ────────────────────────────

DO $$
DECLARE
    idempotency_tbl regclass;
    audit_tbl regclass;
    has_idem_kind BOOLEAN;
    has_idem_id BOOLEAN;
    has_audit_kind BOOLEAN;
    has_audit_id BOOLEAN;
    has_idem_trig BOOLEAN;
    has_audit_trig BOOLEAN;
BEGIN
    idempotency_tbl := to_regclass('public.social_idempotency');
    audit_tbl := to_regclass('public.social_audit_log');

    IF idempotency_tbl IS NULL THEN
        RAISE EXCEPTION 'Prerequisite table public.social_idempotency not found. Migration B requires Migration A (#3262) and moment social hardening (#3177).';
    END IF;

    IF audit_tbl IS NULL THEN
        RAISE EXCEPTION 'Prerequisite table public.social_audit_log not found. Migration B requires Migration A (#3262) and moment social hardening (#3177).';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'social_idempotency' AND column_name = 'target_kind'
    ) INTO has_idem_kind;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'social_idempotency' AND column_name = 'target_id'
    ) INTO has_idem_id;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'social_audit_log' AND column_name = 'target_kind'
    ) INTO has_audit_kind;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'social_audit_log' AND column_name = 'target_id'
    ) INTO has_audit_id;

    IF NOT (has_idem_kind AND has_idem_id AND has_audit_kind AND has_audit_id) THEN
        RAISE EXCEPTION 'Migration A generic columns missing. Apply scripts/migration-add-generic-social-targets.sql before Migration B.';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE NOT tgisinternal
          AND tgname = 'trg_social_idempotency_sync_generic_target'
          AND tgrelid = 'social_idempotency'::regclass
    ) INTO has_idem_trig;
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE NOT tgisinternal
          AND tgname = 'trg_social_audit_log_sync_generic_target'
          AND tgrelid = 'social_audit_log'::regclass
    ) INTO has_audit_trig;

    IF NOT (has_idem_trig AND has_audit_trig) THEN
        RAISE EXCEPTION 'Migration A compatibility triggers missing. Apply scripts/migration-add-generic-social-targets.sql before Migration B.';
    END IF;
END $$;

-- ── 2. Preflight: every existing row has a complete authoritative generic pair ─

DO $$
DECLARE
    null_pair BIGINT;
    partial_pair BIGINT;
    memory_mismatch BIGINT;
    tree_legacy_set BIGINT;
    unknown_kind BIGINT;
BEGIN
    -- social_idempotency
    SELECT COUNT(*) INTO null_pair
    FROM social_idempotency
    WHERE target_kind IS NULL OR target_id IS NULL;

    SELECT COUNT(*) INTO partial_pair
    FROM social_idempotency
    WHERE (target_kind IS NULL AND target_id IS NOT NULL)
       OR (target_kind IS NOT NULL AND target_id IS NULL);

    SELECT COUNT(*) INTO memory_mismatch
    FROM social_idempotency
    WHERE target_kind = 'memory'
      AND target_memory_id IS NOT NULL
      AND target_id IS DISTINCT FROM target_memory_id;

    SELECT COUNT(*) INTO tree_legacy_set
    FROM social_idempotency
    WHERE target_kind = 'tree'
      AND target_memory_id IS NOT NULL;

    SELECT COUNT(*) INTO unknown_kind
    FROM social_idempotency
    WHERE target_kind IS NOT NULL
      AND target_kind NOT IN ('memory', 'tree');

    IF null_pair > 0 THEN
        RAISE EXCEPTION 'social_idempotency: % row(s) lack a complete generic pair; Gate A incomplete', null_pair;
    END IF;
    IF partial_pair > 0 THEN
        RAISE EXCEPTION 'social_idempotency: % row(s) have a partial generic pair', partial_pair;
    END IF;
    IF memory_mismatch > 0 THEN
        RAISE EXCEPTION 'social_idempotency: % row(s) have memory generic/legacy mismatch', memory_mismatch;
    END IF;
    IF tree_legacy_set > 0 THEN
        RAISE EXCEPTION 'social_idempotency: % tree row(s) incorrectly populate target_memory_id', tree_legacy_set;
    END IF;
    IF unknown_kind > 0 THEN
        RAISE EXCEPTION 'social_idempotency: % row(s) have unknown target_kind', unknown_kind;
    END IF;

    -- social_audit_log
    SELECT COUNT(*) INTO null_pair
    FROM social_audit_log
    WHERE target_kind IS NULL OR target_id IS NULL;

    SELECT COUNT(*) INTO partial_pair
    FROM social_audit_log
    WHERE (target_kind IS NULL AND target_id IS NOT NULL)
       OR (target_kind IS NOT NULL AND target_id IS NULL);

    SELECT COUNT(*) INTO memory_mismatch
    FROM social_audit_log
    WHERE target_kind = 'memory'
      AND memory_id IS NOT NULL
      AND target_id IS DISTINCT FROM memory_id;

    SELECT COUNT(*) INTO tree_legacy_set
    FROM social_audit_log
    WHERE target_kind = 'tree'
      AND memory_id IS NOT NULL;

    SELECT COUNT(*) INTO unknown_kind
    FROM social_audit_log
    WHERE target_kind IS NOT NULL
      AND target_kind NOT IN ('memory', 'tree');

    IF null_pair > 0 THEN
        RAISE EXCEPTION 'social_audit_log: % row(s) lack a complete generic pair; Gate A incomplete', null_pair;
    END IF;
    IF partial_pair > 0 THEN
        RAISE EXCEPTION 'social_audit_log: % row(s) have a partial generic pair', partial_pair;
    END IF;
    IF memory_mismatch > 0 THEN
        RAISE EXCEPTION 'social_audit_log: % row(s) have memory generic/legacy mismatch', memory_mismatch;
    END IF;
    IF tree_legacy_set > 0 THEN
        RAISE EXCEPTION 'social_audit_log: % tree row(s) incorrectly populate memory_id', tree_legacy_set;
    END IF;
    IF unknown_kind > 0 THEN
        RAISE EXCEPTION 'social_audit_log: % row(s) have unknown target_kind', unknown_kind;
    END IF;
END $$;

-- ── 3. Relax legacy moment-only NOT NULL (columns preserved and readable) ───

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'social_idempotency'
          AND column_name = 'target_memory_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE social_idempotency
            ALTER COLUMN target_memory_id DROP NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'social_audit_log'
          AND column_name = 'memory_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE social_audit_log
            ALTER COLUMN memory_id DROP NOT NULL;
    END IF;
END $$;

-- ── 4. Make generic target pair authoritative (NOT NULL) ────────────────────

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'social_idempotency'
          AND column_name = 'target_kind'
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE social_idempotency
            ALTER COLUMN target_kind SET NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'social_idempotency'
          AND column_name = 'target_id'
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE social_idempotency
            ALTER COLUMN target_id SET NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'social_audit_log'
          AND column_name = 'target_kind'
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE social_audit_log
            ALTER COLUMN target_kind SET NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'social_audit_log'
          AND column_name = 'target_id'
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE social_audit_log
            ALTER COLUMN target_id SET NOT NULL;
    END IF;
END $$;

-- ── 5. Compatibility CHECKs for memory match and tree/legacy isolation ─────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_idempotency_memory_legacy_match_check'
          AND conrelid = 'social_idempotency'::regclass
    ) THEN
        ALTER TABLE social_idempotency
            ADD CONSTRAINT social_idempotency_memory_legacy_match_check
            CHECK (
                target_kind IS DISTINCT FROM 'memory'
                OR target_memory_id IS NULL
                OR target_id = target_memory_id
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_idempotency_tree_legacy_null_check'
          AND conrelid = 'social_idempotency'::regclass
    ) THEN
        ALTER TABLE social_idempotency
            ADD CONSTRAINT social_idempotency_tree_legacy_null_check
            CHECK (
                target_kind IS DISTINCT FROM 'tree'
                OR target_memory_id IS NULL
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_audit_log_memory_legacy_match_check'
          AND conrelid = 'social_audit_log'::regclass
    ) THEN
        ALTER TABLE social_audit_log
            ADD CONSTRAINT social_audit_log_memory_legacy_match_check
            CHECK (
                target_kind IS DISTINCT FROM 'memory'
                OR memory_id IS NULL
                OR target_id = memory_id
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_audit_log_tree_legacy_null_check'
          AND conrelid = 'social_audit_log'::regclass
    ) THEN
        ALTER TABLE social_audit_log
            ADD CONSTRAINT social_audit_log_tree_legacy_null_check
            CHECK (
                target_kind IS DISTINCT FROM 'tree'
                OR memory_id IS NULL
            );
    END IF;
END $$;

-- ── 6. Replace compatibility trigger functions for Migration B cutover ──────
--
-- CREATE OR REPLACE updates the function body. Existing Migration A triggers
-- keep their names and continue to invoke these functions. No DROP TRIGGER.

CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Case 1: both generic fields absent → legacy-only moment writer path
    IF NEW.target_kind IS NULL AND NEW.target_id IS NULL THEN
        IF NEW.target_memory_id IS NULL THEN
            RAISE EXCEPTION 'Legacy-only social_idempotency write requires target_memory_id, or provide a complete generic target pair'
                USING ERRCODE = 'P0001';
        END IF;
        NEW.target_kind := 'memory';
        NEW.target_id := NEW.target_memory_id;
        RETURN NEW;
    END IF;

    -- Case 2: partial generic pair → reject
    IF (NEW.target_kind IS NULL AND NEW.target_id IS NOT NULL)
       OR (NEW.target_kind IS NOT NULL AND NEW.target_id IS NULL) THEN
        RAISE EXCEPTION 'Partial generic target pair: both target_kind and target_id must be set or both null'
            USING ERRCODE = 'P0001';
    END IF;

    -- Case 3: complete generic pair
    IF NEW.target_kind = 'memory' THEN
        IF NEW.target_memory_id IS NOT NULL
           AND NEW.target_id IS DISTINCT FROM NEW.target_memory_id THEN
            RAISE EXCEPTION 'Generic target_id does not match legacy target_memory_id for memory target'
                USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.target_kind = 'tree' THEN
        IF NEW.target_memory_id IS NOT NULL THEN
            RAISE EXCEPTION 'Tree targets must not populate legacy target_memory_id'
                USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Unknown target_kind %; only memory and tree are permitted',
        NEW.target_kind
        USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Case 1: both generic fields absent → legacy-only moment writer path
    IF NEW.target_kind IS NULL AND NEW.target_id IS NULL THEN
        IF NEW.memory_id IS NULL THEN
            RAISE EXCEPTION 'Legacy-only social_audit_log write requires memory_id, or provide a complete generic target pair'
                USING ERRCODE = 'P0001';
        END IF;
        NEW.target_kind := 'memory';
        NEW.target_id := NEW.memory_id;
        RETURN NEW;
    END IF;

    -- Case 2: partial generic pair → reject
    IF (NEW.target_kind IS NULL AND NEW.target_id IS NOT NULL)
       OR (NEW.target_kind IS NOT NULL AND NEW.target_id IS NULL) THEN
        RAISE EXCEPTION 'Partial generic target pair: both target_kind and target_id must be set or both null'
            USING ERRCODE = 'P0001';
    END IF;

    -- Case 3: complete generic pair
    IF NEW.target_kind = 'memory' THEN
        IF NEW.memory_id IS NOT NULL
           AND NEW.target_id IS DISTINCT FROM NEW.memory_id THEN
            RAISE EXCEPTION 'Generic target_id does not match legacy memory_id for memory target'
                USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.target_kind = 'tree' THEN
        IF NEW.memory_id IS NOT NULL THEN
            RAISE EXCEPTION 'Tree targets must not populate legacy memory_id'
                USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Unknown target_kind %; only memory and tree are permitted',
        NEW.target_kind
        USING ERRCODE = 'P0001';
END;
$$;

-- Ensure triggers still exist (guarded; no DROP TRIGGER). Migration A creates
-- them; this block only repairs a missing trigger after A was partially applied.

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

-- ── 7. Verification queries (aggregate-only, safe) ─────────────────────────
--
-- Run after apply (see docs/ops/generic-social-targets-migration-b-runbook.md).
--
-- === Legacy nullability ===
-- SELECT table_name, column_name, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND (
--     (table_name = 'social_idempotency' AND column_name IN ('target_memory_id', 'target_kind', 'target_id'))
--     OR (table_name = 'social_audit_log' AND column_name IN ('memory_id', 'target_kind', 'target_id'))
--   )
-- ORDER BY table_name, column_name;
--
-- === Generic pair integrity ===
-- SELECT
--     'social_idempotency' AS table_name,
--     COUNT(*) FILTER (WHERE target_kind IS NULL OR target_id IS NULL) AS null_pair,
--     COUNT(*) FILTER (
--       WHERE (target_kind IS NULL AND target_id IS NOT NULL)
--          OR (target_kind IS NOT NULL AND target_id IS NULL)
--     ) AS partial_pair
-- FROM social_idempotency
-- UNION ALL
-- SELECT
--     'social_audit_log',
--     COUNT(*) FILTER (WHERE target_kind IS NULL OR target_id IS NULL),
--     COUNT(*) FILTER (
--       WHERE (target_kind IS NULL AND target_id IS NOT NULL)
--          OR (target_kind IS NOT NULL AND target_id IS NULL)
--     )
-- FROM social_audit_log;
--
-- === Memory mismatch (legacy present only) ===
-- SELECT COUNT(*)::int AS mismatch_count
-- FROM social_idempotency
-- WHERE target_kind = 'memory'
--   AND target_memory_id IS NOT NULL
--   AND target_id IS DISTINCT FROM target_memory_id;
-- SELECT COUNT(*)::int AS mismatch_count
-- FROM social_audit_log
-- WHERE target_kind = 'memory'
--   AND memory_id IS NOT NULL
--   AND target_id IS DISTINCT FROM memory_id;
--
-- === Tree rows must not populate legacy memory fields ===
-- SELECT COUNT(*)::int AS tree_legacy_populated
-- FROM social_idempotency
-- WHERE target_kind = 'tree' AND target_memory_id IS NOT NULL;
-- SELECT COUNT(*)::int AS tree_legacy_populated
-- FROM social_audit_log
-- WHERE target_kind = 'tree' AND memory_id IS NOT NULL;
--
-- === Kind distribution ===
-- SELECT target_kind, COUNT(*)::int AS row_count
-- FROM social_idempotency
-- GROUP BY target_kind
-- ORDER BY target_kind;
-- SELECT target_kind, COUNT(*)::int AS row_count
-- FROM social_audit_log
-- GROUP BY target_kind
-- ORDER BY target_kind;
--
-- === Trigger presence ===
-- SELECT tgname AS trigger_name, tgrelid::regclass AS table_name
-- FROM pg_trigger
-- WHERE tgname IN (
--   'trg_social_idempotency_sync_generic_target',
--   'trg_social_audit_log_sync_generic_target'
-- );
