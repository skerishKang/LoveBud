-- Migration: Harden authenticated moment social writes
--
-- Adds idempotency, rate limiting, audit logging, and comment lifecycle
-- support for authenticated reaction and comment write operations.
--
-- Refs #3177
-- Refs #3175
-- Refs #3075
-- Refs #1237
-- Refs #2544
-- Refs #2862
-- Refs #1882
--
-- This migration is additive only. It does not modify or drop existing
-- tables, columns, or indexes. Every statement uses IF NOT EXISTS or
-- ADD COLUMN IF NOT EXISTS for safe re-execution.
--
-- ============================================================================
-- Design decisions
-- ============================================================================
--
-- 1. social_idempotency
--    - Unique constraint on (actor_id, operation, idempotency_key) ensures
--      that the same actor cannot accidentally reuse a key for a different
--      target or payload.
--    - request_fingerprint is a SHA-256 hash of the normalized request body,
--      enabling mismatch detection (same key, different payload → 409).
--    - result_payload JSONB stores the final safe response DTO for replay
--      (reaction toggle result with counts). Replay reads result_payload
--      instead of re-querying the reaction/comment row.
--    - Primary key UUIDs are application-generated; no pgcrypto dependency.
--    - 현재 자동 TTL cleanup은 구현되어 있지 않다.
--      social_idempotency 및 social_rate_limits retention cleanup은
--      별도 승인된 운영 작업으로만 수행한다.
--
-- 2. social_rate_limits
--    - Fixed-window model: window_start is truncated to minute granularity.
--    - Unique constraint (actor_id, scope, COALESCE(memory_id,''), window_start)
--      enables atomic INSERT ... ON CONFLICT DO UPDATE for increment.
--    - Two scopes: 'comment:actor' (actor-wide) and 'comment:actor-memory'
--      (per-memory). The application layer queries both.
--    - Primary key UUIDs are application-generated; no pgcrypto dependency.
--
-- 3. social_audit_log
--    - Stores only safe, non-sensitive fields.
--    - NEVER stores: comment body, Firebase token, Authorization header,
--      raw exception, full request/response payload.
--    - request_key_hash is SHA-256 of the idempotency key (if any) for
--      deduplication analysis, not for content reconstruction.
--    - Primary key UUIDs are application-generated; no pgcrypto dependency.
--
-- 4. comments lifecycle
--    - Status CHECK constraint enforces only three states:
--      'visible', 'hidden' (moderated), 'deleted' (soft-delete by author).
--    - deleted_at and deleted_by record who/when for accountability.
--    - All existing rows get DEFAULT 'visible', so no backfill needed.
--    - Public and authenticated read queries filter: status = 'visible'
--      AND deleted_at IS NULL.
--
-- Backward compatibility:
--   - Every statement is additive. Dropping the migration is a no-op revert.
--   - Existing comments rows are automatically 'visible' with NULL metadata.
--   - The existing 'is_deleted' / 'is_hidden' columns (if previously added)
--     are not referenced; this migration supersedes that design.
--   - All new tables have no FK dependencies on one another, so they can be
--     created in any order.
--   - No existing index or constraint is dropped or modified.
--
-- Rollback:
--   - DROP TABLE IF EXISTS social_idempotency, social_rate_limits, social_audit_log;
--   - ALTER TABLE comments DROP COLUMN IF EXISTS status;
--   - ALTER TABLE comments DROP COLUMN IF EXISTS deleted_at;
--   - ALTER TABLE comments DROP COLUMN IF EXISTS deleted_by;
--   - Rollback application code FIRST, then schema.
--   - Rollback is safe because all changes are additive. No data loss from
--     existing rows (the new columns have defaults).
--
-- Deploy order:
--   1. Apply this migration to the database.
--   2. Capture evidence (schema diff, row counts).
--   3. Approve and deploy updated Modal backend.
--   4. Run runtime verification tests against preview/production.
--   5. The application code does NOT pass through when migration tables are
--      absent. Full deployment dependency is:
--      migration apply → schema evidence → Modal deployment approval →
--      Modal deployment → runtime verification.
-- ============================================================================

BEGIN;

-- ── 1. Idempotency table ──────────────────────────────────────────────────────
-- UUID primary key is populated by the application layer. No DEFAULT
-- gen_random_uuid() is used, avoiding any pgcrypto extension dependency.
CREATE TABLE IF NOT EXISTS social_idempotency (
    id              UUID PRIMARY KEY,
    actor_id        VARCHAR(128) NOT NULL,
    operation       VARCHAR(64)  NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,  -- SHA-256 hex of normalized body
    target_memory_id UUID NOT NULL,
    result_id       VARCHAR(128),              -- created reaction or comment ID
    result_state    VARCHAR(20)  NOT NULL DEFAULT 'pending',
    result_payload  JSONB,                     -- safe response DTO for replay
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Unique: one key per actor per operation (prevents cross-target key reuse)
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_idempotency_actor_op_key
    ON social_idempotency(actor_id, operation, idempotency_key);

-- Index for TTL cleanup queries (SELECT WHERE created_at < NOW() - INTERVAL '24 hours')
CREATE INDEX IF NOT EXISTS idx_social_idempotency_created_at
    ON social_idempotency(created_at);

-- Index for lookup by target memory (audit/debug)
CREATE INDEX IF NOT EXISTS idx_social_idempotency_target_memory
    ON social_idempotency(target_memory_id);

-- ── 2. Rate-limit bucket table ────────────────────────────────────────────────
-- UUID primary key is populated by the application layer.
CREATE TABLE IF NOT EXISTS social_rate_limits (
    id              UUID PRIMARY KEY,
    scope           VARCHAR(64)  NOT NULL,  -- 'comment:actor' or 'comment:actor-memory'
    actor_id        VARCHAR(128) NOT NULL,
    memory_id       UUID,                   -- NULL for actor-wide, set for per-memory
    window_start    TIMESTAMPTZ  NOT NULL DEFAULT date_trunc('minute', NOW()),
    request_count   INT          NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Unique constraint enables atomic INSERT ... ON CONFLICT DO UPDATE
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_rate_limits_scope_actor_memory_window
    ON social_rate_limits(scope, actor_id, COALESCE(memory_id, '00000000-0000-0000-0000-000000000000'), window_start);

-- Index for periodic cleanup (windows older than 1 hour can be deleted)
CREATE INDEX IF NOT EXISTS idx_social_rate_limits_window_start
    ON social_rate_limits(window_start);

-- ── 3. Audit log table ────────────────────────────────────────────────────────
-- UUID primary key is populated by the application layer.
CREATE TABLE IF NOT EXISTS social_audit_log (
    id              UUID PRIMARY KEY,
    actor_id        VARCHAR(128) NOT NULL,
    memory_id       UUID NOT NULL,
    action          VARCHAR(64)  NOT NULL,  -- 'reaction.toggle', 'comment.create', 'comment.soft_delete'
    outcome_code    VARCHAR(20)  NOT NULL,  -- 'success', 'rate_limited', 'idempotent_replay', 'validation_error', 'conflict'
    request_key_hash VARCHAR(64),           -- SHA-256 of idempotency key (nullable for non-idempotent requests)
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_audit_log_actor_id
    ON social_audit_log(actor_id);

CREATE INDEX IF NOT EXISTS idx_social_audit_log_memory_id
    ON social_audit_log(memory_id);

CREATE INDEX IF NOT EXISTS idx_social_audit_log_created_at
    ON social_audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_social_audit_log_action
    ON social_audit_log(action);

-- ── 4. Comment lifecycle columns ──────────────────────────────────────────────

ALTER TABLE comments
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'visible';

ALTER TABLE comments
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE comments
    ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(128);

-- Status CHECK constraint with guarded existence check
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'comments_status_check'
          AND conrelid = 'comments'::regclass
    ) THEN
        ALTER TABLE comments
            ADD CONSTRAINT comments_status_check
            CHECK (status IN ('visible', 'hidden', 'deleted'));
    END IF;
END $$;

COMMIT;
