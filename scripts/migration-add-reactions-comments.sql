-- Migration: Add reactions and comments tables for tree-level interactions
--
-- Refs #1237
--
-- This migration adds two new tables:
--   reactions  — emoji/type reactions on trees (like, love, laugh, etc.)
--   comments   — text comments on trees
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/migration-add-reactions-comments.sql

CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY,
    tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    owner_id VARCHAR(128) NOT NULL,
    reaction_type VARCHAR(16) NOT NULL DEFAULT 'like',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reactions_tree_id ON reactions(tree_id);
CREATE INDEX IF NOT EXISTS idx_reactions_owner_id ON reactions(owner_id);

-- Ensure unique reaction per user per tree per type (toggle semantics)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_tree_owner_type ON reactions(tree_id, owner_id, reaction_type);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY,
    tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    owner_id VARCHAR(128) NOT NULL,
    comment_type VARCHAR(32) NOT NULL DEFAULT 'tree',
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_tree_id ON comments(tree_id);
CREATE INDEX IF NOT EXISTS idx_comments_owner_id ON comments(owner_id);
