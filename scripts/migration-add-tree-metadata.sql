-- Migration: Add group_name and keywords columns to trees table
--
-- Refs #2882 (tree owner metadata foundation)
--
-- Adds owner-authored tree metadata for future owner-only management and card display.
-- Existing trees: group_name defaults to NULL, keywords defaults to '{}'.
--
-- Columns:
--   group_name TEXT       → nullable, trim, max 80 chars
--   keywords   TEXT[]     → NOT NULL DEFAULT '{}', validated per keyword

BEGIN;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trees' AND column_name = 'group_name'
    ) THEN
        ALTER TABLE trees ADD COLUMN group_name TEXT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trees' AND column_name = 'keywords'
    ) THEN
        ALTER TABLE trees ADD COLUMN keywords TEXT[] NOT NULL DEFAULT '{}';
    END IF;
END $$;

COMMIT;