-- Migration: Add reactions and comments tables for moment-level interactions
--
-- Refs #1237
--
-- This migration adds two new tables:
--   reactions  — emoji/type reactions on memories (like, love, laugh, etc.)
--   comments   — text comments on memories
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/migration-add-reactions-comments.sql

CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY,
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    owner_id VARCHAR(128) NOT NULL,
    type VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reactions_memory_id ON reactions(memory_id);
CREATE INDEX IF NOT EXISTS idx_reactions_owner_id ON reactions(owner_id);

-- Ensure unique reaction per user per memory per type (toggle semantics)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_memory_owner_type ON reactions(memory_id, owner_id, type);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY,
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    owner_id VARCHAR(128) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_memory_id ON comments(memory_id);
CREATE INDEX IF NOT EXISTS idx_comments_owner_id ON comments(owner_id);
