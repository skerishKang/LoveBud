-- Migration: Repair trees schema for production compatibility (Issue #3435)
--
-- Refs #3435
-- Refs #3433
-- Refs #3425
-- Refs #1882
--
-- Service-restoration foothold. This is NOT legacy metadata recovery.
-- Legacy damaged rows remain NULL-metadata distinguishable.
-- Orphan dependent rows (memories, likes, comments, etc.) are preserved
-- and NOT modified.
--
-- Purpose:
--   Remove GET /api/trees 500 caused by TREE_SCHEMA_DRIFT.
--   Restore compatibility for new tree writes via the deployed runtime.
--   Existing orphan trees and dependent rows remain unchanged.
--
-- What this migration does:
--   Adds exactly 7 nullable columns (when absent) to public.trees:
--     owner_id    TEXT        NULL
--     title       TEXT        NULL
--     visibility  TEXT        NULL
--     group_name  TEXT        NULL
--     keywords    TEXT[]      NULL
--     created_at  TIMESTAMPTZ NULL
--     updated_at  TIMESTAMPTZ NULL
--
--   Validates preconditions and postconditions. Aborts on any mismatch.
--   Does not backfill, assign defaults, create indexes, or set constraints.
--
-- Explicitly prohibited (RAISE EXCEPTION if attempted):
--   INSERT, UPDATE, DELETE, DROP, TRUNCATE, RENAME
--   ALTER COLUMN TYPE, SET NOT NULL, DEFAULT, FK, CHECK, INDEX, TRIGGER
--   UUID conversion, synthetic value assignment
--   Dependent table mutation, orphan row creation/modification
--
-- Apply under separate post-merge approval only.
-- Use the approved existing secret-bound operator mechanism.
-- DATABASE_URL must NOT appear in command arguments, shell history, or logs.

BEGIN;

-- ========== BOUNDED TIMEOUTS ==========
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ========== PRECONDITIONS ==========

-- public.trees must exist and be an ordinary table
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'trees'
          AND c.relkind = 'r'
    ) THEN
        RAISE EXCEPTION 'PRECONDITION_FAILED: public.trees is not an ordinary table';
    END IF;
END $$;

-- id column must exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'id'
    ) THEN
        RAISE EXCEPTION 'PRECONDITION_FAILED: public.trees.id does not exist';
    END IF;
END $$;

-- id must be TEXT-compatible (text, varchar, or char)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'id'
          AND data_type IN ('text', 'character varying', 'character')
    ) THEN
        RAISE EXCEPTION 'PRECONDITION_FAILED: public.trees.id is not TEXT compatible';
    END IF;
END $$;

-- id must be NOT NULL
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'id'
          AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION 'PRECONDITION_FAILED: public.trees.id is nullable';
    END IF;
END $$;

-- id must be the sole primary key column
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_index i ON i.indrelid = c.oid
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
          AND a.attnum = ANY(i.indkey)
          AND a.attisdropped = FALSE
        WHERE n.nspname = 'public' AND c.relname = 'trees'
          AND i.indisprimary
          AND i.indnatts = 1
          AND a.attname = 'id'
    ) THEN
        RAISE EXCEPTION 'PRECONDITION_FAILED: public.trees.id is not the sole primary key column';
    END IF;
END $$;

-- ========== TYPE COMPATIBILITY CHECKS ==========

-- If any target column already exists with an incompatible type,
-- abort the entire migration. Do not ALTER TYPE.

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'owner_id'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'owner_id'
              AND udt_schema = 'pg_catalog' AND udt_name = 'text'
              AND is_nullable = 'YES'
              AND column_default IS NULL
        ) THEN
            RAISE EXCEPTION 'TYPE_MISMATCH: public.trees.owner_id must be pg_catalog.text, nullable, no-dflt';
        END IF;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'title'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'title'
              AND udt_schema = 'pg_catalog' AND udt_name = 'text'
              AND is_nullable = 'YES'
              AND column_default IS NULL
        ) THEN
            RAISE EXCEPTION 'TYPE_MISMATCH: public.trees.title must be pg_catalog.text, nullable, no-dflt';
        END IF;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'visibility'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'visibility'
              AND udt_schema = 'pg_catalog' AND udt_name = 'text'
              AND is_nullable = 'YES'
              AND column_default IS NULL
        ) THEN
            RAISE EXCEPTION 'TYPE_MISMATCH: public.trees.visibility must be pg_catalog.text, nullable, no-dflt';
        END IF;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'group_name'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'group_name'
              AND udt_schema = 'pg_catalog' AND udt_name = 'text'
              AND is_nullable = 'YES'
              AND column_default IS NULL
        ) THEN
            RAISE EXCEPTION 'TYPE_MISMATCH: public.trees.group_name must be pg_catalog.text, nullable, no-dflt';
        END IF;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'keywords'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'keywords'
              AND data_type = 'ARRAY'
              AND udt_schema = 'pg_catalog' AND udt_name = '_text'
              AND is_nullable = 'YES'
              AND column_default IS NULL
        ) THEN
            RAISE EXCEPTION 'TYPE_MISMATCH: public.trees.keywords must be pg_catalog._text (TEXT[]), nullable, no-dflt';
        END IF;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'created_at'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'created_at'
              AND data_type = 'timestamp with time zone'
              AND udt_schema = 'pg_catalog' AND udt_name = 'timestamptz'
              AND is_nullable = 'YES'
              AND column_default IS NULL
        ) THEN
            RAISE EXCEPTION 'TYPE_MISMATCH: public.trees.created_at must be pg_catalog.timestamptz, nullable, no-dflt';
        END IF;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'updated_at'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'updated_at'
              AND data_type = 'timestamp with time zone'
              AND udt_schema = 'pg_catalog' AND udt_name = 'timestamptz'
              AND is_nullable = 'YES'
              AND column_default IS NULL
        ) THEN
            RAISE EXCEPTION 'TYPE_MISMATCH: public.trees.updated_at must be pg_catalog.timestamptz, nullable, no-dflt';
        END IF;
    END IF;
END $$;

-- ========== ADDITIVE COLUMNS ==========

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE public.trees ADD COLUMN owner_id TEXT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'title'
    ) THEN
        ALTER TABLE public.trees ADD COLUMN title TEXT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'visibility'
    ) THEN
        ALTER TABLE public.trees ADD COLUMN visibility TEXT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'group_name'
    ) THEN
        ALTER TABLE public.trees ADD COLUMN group_name TEXT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'keywords'
    ) THEN
        ALTER TABLE public.trees ADD COLUMN keywords TEXT[];
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.trees ADD COLUMN created_at TIMESTAMPTZ;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.trees ADD COLUMN updated_at TIMESTAMPTZ;
    END IF;
END $$;

-- ========== POSTCONDITIONS ==========

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'owner_id'
          AND udt_schema = 'pg_catalog' AND udt_name = 'text'
          AND is_nullable = 'YES'
          AND column_default IS NULL
    ) THEN
        RAISE EXCEPTION 'POSTCONDITION_FAILED: public.trees.owner_id must be pg_catalog.text, nullable, no-dflt';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'title'
          AND udt_schema = 'pg_catalog' AND udt_name = 'text'
          AND is_nullable = 'YES'
          AND column_default IS NULL
    ) THEN
        RAISE EXCEPTION 'POSTCONDITION_FAILED: public.trees.title must be pg_catalog.text, nullable, no-dflt';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'visibility'
          AND udt_schema = 'pg_catalog' AND udt_name = 'text'
          AND is_nullable = 'YES'
          AND column_default IS NULL
    ) THEN
        RAISE EXCEPTION 'POSTCONDITION_FAILED: public.trees.visibility must be pg_catalog.text, nullable, no-dflt';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'group_name'
          AND udt_schema = 'pg_catalog' AND udt_name = 'text'
          AND is_nullable = 'YES'
          AND column_default IS NULL
    ) THEN
        RAISE EXCEPTION 'POSTCONDITION_FAILED: public.trees.group_name must be pg_catalog.text, nullable, no-dflt';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'keywords'
          AND data_type = 'ARRAY'
          AND udt_schema = 'pg_catalog' AND udt_name = '_text'
          AND is_nullable = 'YES'
          AND column_default IS NULL
    ) THEN
        RAISE EXCEPTION 'POSTCONDITION_FAILED: public.trees.keywords must be pg_catalog._text (TEXT[]), nullable, no-dflt';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'created_at'
          AND data_type = 'timestamp with time zone'
          AND udt_schema = 'pg_catalog' AND udt_name = 'timestamptz'
          AND is_nullable = 'YES'
          AND column_default IS NULL
    ) THEN
        RAISE EXCEPTION 'POSTCONDITION_FAILED: public.trees.created_at must be pg_catalog.timestamptz, nullable, no-dflt';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trees' AND column_name = 'updated_at'
          AND data_type = 'timestamp with time zone'
          AND udt_schema = 'pg_catalog' AND udt_name = 'timestamptz'
          AND is_nullable = 'YES'
          AND column_default IS NULL
    ) THEN
        RAISE EXCEPTION 'POSTCONDITION_FAILED: public.trees.updated_at must be pg_catalog.timestamptz, nullable, no-dflt';
    END IF;
END $$;

COMMIT;
