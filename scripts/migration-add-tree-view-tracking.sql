-- Migration: Add tree-level view tracking dedup foundation for Browse sorting
--
-- Refs #1661
--
-- This migration is the Unit B1 data-model foundation for tree-level view
-- duplicate suppression. It is intentionally narrow and privacy-preserving.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/migration-add-tree-view-tracking.sql
--
-- This script does not enable runtime view counting, sort=views, sort=likes,
-- Browse UI labels, Browse viewCount payloads, or broad analytics.

CREATE TABLE IF NOT EXISTS tree_view_dedup_events (
    id UUID PRIMARY KEY,
    tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    actor_key VARCHAR(128) NOT NULL,
    actor_kind VARCHAR(32) NOT NULL CHECK (actor_kind IN ('authenticated', 'anonymous')),
    counted_window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    source VARCHAR(64) NOT NULL CHECK (source IN ('public_tree_detail', 'public_tree_card_open')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- One counted view per actor/tree/window. The runtime layer must choose a
-- rolling 24-hour window or equivalent bucket before inserting.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tree_view_dedup_tree_actor_window
    ON tree_view_dedup_events(tree_id, actor_key, counted_window_start);

CREATE INDEX IF NOT EXISTS idx_tree_view_dedup_tree_id
    ON tree_view_dedup_events(tree_id);

CREATE INDEX IF NOT EXISTS idx_tree_view_dedup_created_at
    ON tree_view_dedup_events(created_at);

CREATE INDEX IF NOT EXISTS idx_tree_view_dedup_source
    ON tree_view_dedup_events(source);

-- Privacy guardrails:
-- - actor_key must be an opaque authenticated account key or privacy-preserving
--   anonymous/session key.
-- - Do not store raw IP addresses, raw user-agent strings, full device
--   fingerprints, referrer URLs, request headers, or viewer profile data.
-- - Missing or private tree reads must not create rows here.
