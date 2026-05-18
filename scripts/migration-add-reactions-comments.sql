-- Migration: Add memories, reactions, and comments tables for moment-level interactions
--
-- Refs #1237
-- Refs #1286
--
-- This migration is intentionally memory-level because the current Modal backend
-- stores reactions/comments against memory IDs. Some test/runtime databases may
-- have the trees table but not the memories table yet, so this script first
-- ensures the memories table exists before creating reaction/comment FKs.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/migration-add-reactions-comments.sql

CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY,
    tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    parent_id UUID NULL REFERENCES memories(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL DEFAULT '',
    memo TEXT NOT NULL DEFAULT '',
    artist VARCHAR(100) NOT NULL DEFAULT '',
    source VARCHAR(200) NOT NULL DEFAULT '',
    source_url VARCHAR(1000) NOT NULL DEFAULT '',
    source_type VARCHAR(50) NOT NULL DEFAULT 'youtube',
    thumbnail VARCHAR(500) NOT NULL DEFAULT '',
    emotion_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    timestamp VARCHAR(100) NOT NULL DEFAULT '',
    visibility VARCHAR(20) NOT NULL DEFAULT 'public',
    channel_id VARCHAR(100),
    channel_name VARCHAR(200),
    channel_url VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_tree_id ON memories(tree_id);
CREATE INDEX IF NOT EXISTS idx_memories_parent_id ON memories(parent_id);
CREATE INDEX IF NOT EXISTS idx_memories_visibility ON memories(visibility);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);

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
