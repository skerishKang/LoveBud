-- Migration: Add group_name and keywords columns to trees table
-- 
-- This adds tree-level owner metadata columns for groupName and keywords.
-- Existing trees: group_name defaults to NULL, keywords defaults to '{}' (empty array).
-- 
-- Column contract:
--   group_name TEXT        → nullable, trim before insert, max 80 chars
--   keywords   TEXT[]      → NOT NULL DEFAULT '{}' (PostgreSQL array), validated per keyword: trim, deduped,
--                            order-preserved, max 5 items, each max 24 chars
--
-- Changes:
--   - group_name: nullable text column
--   - keywords: text[] NOT NULL DEFAULT '{}'
--   - Index on keywords for future search/listing
--
-- Refs #3111, #3087, #3086
-- NOT #2960, #2856, #3070, #3072, #2972, #2976

BEGIN;

-- Idempotent: add columns if they don't exist
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

-- Idempotent index creation
CREATE INDEX IF NOT EXISTS idx_trees_keywords ON trees USING GIN (keywords);

COMMIT;