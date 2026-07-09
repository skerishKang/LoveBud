-- Migration: Add tree_comments table for whole-tree (tree-level) comments
--
-- Refs #3388
-- Refs #3188
-- Refs #3382
-- Refs #3385
-- Refs #3075
-- Refs #1882
--
-- This migration adds a dedicated, tree-target comment storage table. It is
-- strictly separate from the moment-level `comments` table (memory-target),
-- which is intentionally NOT modified. Tree comments use target_kind = 'tree'
-- and target_id = tree_id so they integrate with the existing generic
-- social_idempotency / social_audit_log model without touching moment rows.
--
-- This is a schema foundation only. No writer, route, reader, client adapter,
-- or UI is implemented by this migration. Apply under separate approval.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/migration-add-tree-comments.sql

CREATE TABLE IF NOT EXISTS tree_comments (
    id UUID PRIMARY KEY,
    tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    owner_id VARCHAR(128) NOT NULL,
    body TEXT NOT NULL,
    -- Generic social target pair (mirrors social_idempotency / social_audit_log).
    -- Constrained to the tree scope so a future writer can reuse the existing
    -- idempotency/audit infrastructure with target_kind = 'tree', target_id = treeId.
    target_kind VARCHAR(16) NOT NULL DEFAULT 'tree'
        CHECK (target_kind = 'tree'),
    target_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Defensive invariant: a tree comment's generic target_id must equal its tree_id
-- (or be null pending writer population). Moment/legacy fields are intentionally absent.
ALTER TABLE tree_comments
    ADD CONSTRAINT IF NOT EXISTS tree_comments_target_id_matches_tree_id
    CHECK (target_id IS NULL OR target_id = tree_id);

CREATE INDEX IF NOT EXISTS idx_tree_comments_tree_id ON tree_comments(tree_id);
CREATE INDEX IF NOT EXISTS idx_tree_comments_owner_id ON tree_comments(owner_id);
CREATE INDEX IF NOT EXISTS idx_tree_comments_created_at ON tree_comments(created_at);
