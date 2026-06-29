-- Migration: Add tree-level social counts foundation for Browse sorting
--
-- Refs #1661
--
-- This migration is the Unit A1 data-model foundation for tree-level likes.
-- It is intentionally separate from the existing memory-level reactions table.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/migration-add-tree-social-counts.sql
--
-- This script does not enable sort=likes, sort=views, Browse UI labels,
-- runtime view tracking, or broad analytics.

CREATE TABLE IF NOT EXISTS tree_likes (
    id UUID PRIMARY KEY,
    tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    owner_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- One active like per account per tree. Toggle-off semantics should set deleted_at.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tree_likes_tree_owner_active
    ON tree_likes(tree_id, owner_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tree_likes_tree_id ON tree_likes(tree_id);
CREATE INDEX IF NOT EXISTS idx_tree_likes_owner_id ON tree_likes(owner_id);
CREATE INDEX IF NOT EXISTS idx_tree_likes_created_at ON tree_likes(created_at);

CREATE TABLE IF NOT EXISTS tree_social_counts (
    tree_id TEXT PRIMARY KEY REFERENCES trees(id) ON DELETE CASCADE,
    like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
    view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tree_social_counts_like_count
    ON tree_social_counts(like_count DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tree_social_counts_view_count
    ON tree_social_counts(view_count DESC, updated_at DESC);
