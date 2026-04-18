-- LoveBud MVP - Migration 002: Add payload columns to trees table
-- Canonical model: trees.payload.nodes (JSONB) — memories table is legacy
-- Run this AFTER 001_initial_schema.sql against Neon PostgreSQL
--
-- Adds: name, is_public, node_count, payload (JSONB)
-- Rationale: doc-store.js assumes these columns exist.
-- title and visibility remain as-is for backward compatibility (seed data).
-- is_public BOOLEAN is kept in bidirectional sync with visibility TEXT via trigger.

-- ── 1. Add new columns ──────────────────────────────────────────────────────
ALTER TABLE trees ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE trees ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE trees ADD COLUMN IF NOT EXISTS node_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trees ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{"nodes": []}'::jsonb;

-- ── 2. Migrate existing rows ────────────────────────────────────────────────
-- title → name (backward compatibility for existing rows)
-- Only fills NULL/empty name; preserves manually updated names on re-run
UPDATE trees SET name = title WHERE name IS NULL OR name = '';

-- visibility (text 'public'/'private') → is_public (boolean)
-- Full backfill over ALL rows; no WHERE clause
UPDATE trees SET is_public = (visibility = 'public');

-- payload: fix NULLs first, then fix rows where nodes is not an array
UPDATE trees SET payload = '{"nodes": []}'::jsonb WHERE payload IS NULL;
UPDATE trees SET payload = '{"nodes": []}'::jsonb
  WHERE jsonb_typeof(payload->'nodes') IS DISTINCT FROM 'array';

-- ── 3. Bidirectional sync trigger: visibility ↔ is_public ──────────────────
-- UPDATE trees SET visibility = ...  → is_public follows
-- UPDATE trees SET is_public   = ... → visibility follows
CREATE OR REPLACE FUNCTION sync_visibility_is_public()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- visibility changed → sync is_public
    IF NEW.visibility IS DISTINCT FROM OLD.visibility THEN
      NEW.is_public = (NEW.visibility = 'public');
    END IF;
    -- is_public changed → sync visibility
    IF NEW.is_public IS DISTINCT FROM OLD.is_public THEN
      NEW.visibility = CASE WHEN NEW.is_public THEN 'public' ELSE 'private' END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_visibility_is_public ON trees;
CREATE TRIGGER trg_sync_visibility_is_public
  BEFORE UPDATE ON trees
  FOR EACH ROW EXECUTE FUNCTION sync_visibility_is_public();

-- ── 4. Verify ───────────────────────────────────────────────────────────────
-- SELECT id, title, name, visibility, is_public, node_count,
--        payload, jsonb_typeof(payload->'nodes') as nodes_type
--   FROM trees LIMIT 10;
-- Expected: all rows have is_public=true for visibility='public', name non-empty,
--           payload->nodes is a JSON array (type = 'array')