-- LoveBud MVP - Initial PostgreSQL Schema
-- Run this against Neon PostgreSQL to set up the database.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Trees ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trees (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      TEXT    NOT NULL,
  title         TEXT    NOT NULL DEFAULT '나의 Lovetree',
  visibility    TEXT    NOT NULL DEFAULT 'private',  -- 'public' | 'private'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trees_owner_id ON trees (owner_id);
CREATE INDEX IF NOT EXISTS idx_trees_visibility ON trees (visibility);

-- ── Memories ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id       UUID    NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  parent_id     UUID    REFERENCES memories(id) ON DELETE SET NULL,
  title         TEXT    NOT NULL DEFAULT '',
  memo          TEXT    NOT NULL DEFAULT '',
  artist        TEXT    NOT NULL DEFAULT '',
  source        TEXT    NOT NULL DEFAULT '',
  source_url    TEXT    NOT NULL DEFAULT '',
  source_type   TEXT    NOT NULL DEFAULT 'youtube',
  thumbnail     TEXT    NOT NULL DEFAULT '',
  emotion_tags  JSONB   NOT NULL DEFAULT '[]',
  timestamp     TEXT    NOT NULL DEFAULT '',
  visibility    TEXT    NOT NULL DEFAULT 'private',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_tree_id       ON memories (tree_id);
CREATE INDEX IF NOT EXISTS idx_memories_parent_id     ON memories (parent_id);
CREATE INDEX IF NOT EXISTS idx_memories_visibility    ON memories (visibility);

-- ── Trigger: auto-update updated_at ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_trees_updated_at
  BEFORE UPDATE ON trees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();