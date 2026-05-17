-- Migration: Add optional YouTube channel fields to memories table
--
-- Phase 1A of Issue #1234 — YouTube channel metadata
--
-- This migration adds three optional columns to the memories table:
--   channel_id    VARCHAR(100)  — YouTube channel ID (e.g. @woowayoung or UC...)
--   channel_name  VARCHAR(200)  — Human-readable channel name (e.g. "우아한형제들")
--   channel_url   VARCHAR(1000) — Full channel URL (e.g. https://youtube.com/@woowayoung)
--
-- All columns are optional (DEFAULT NULL), so existing records are unaffected.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/migration-add-channel-fields.sql

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS channel_id   VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS channel_name VARCHAR(200) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS channel_url  VARCHAR(1000) DEFAULT NULL;
