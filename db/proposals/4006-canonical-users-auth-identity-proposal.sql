-- ============================================================================
-- PROPOSAL ONLY - DO NOT EXECUTE
-- ============================================================================
--
-- Issue #4006 - CANONICAL users / app_account / app_auth_identity DDL proposal
-- Parent: #4004 (shared Love platform authority)
-- Unblocks: #4157 Tree Fork write-gate re-activation (users-table design)
-- Pattern precedent: #4153/#4155 read cutovers, #4157 write gates
--
-- RESOURCE_CLASS   = PROPOSAL_ONLY_DOCUMENT_ARTIFACT
-- EXECUTION        = FORBIDDEN by this file alone.
--                    Adoption requires: CTO review -> owner approval ->
--                    separately approved canonical migration slice following
--                    db/migration-provenance/canonical-migrations.json rules
--                    (immutable id, byte-exact sha256 checksum,
--                    structured approval_reference).
-- CANONICAL STREAM = This file is intentionally OUTSIDE db/migrations/.
--                    The canonical stream is inactive (ADOPTION_REQUIRED) and
--                    this proposal must never be retro-declared applied.
-- MUTATION SCOPE   = ADDITIVE only. Zero DROP, zero destructive operation,
--                    zero data rewrite, zero ownership rewrite.
--
-- Refs #4006.
-- Refs #4004 - Keep OPEN.
-- Refs #4157.
-- Refs #1882 - Keep OPEN.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Section A: app_account - stable Product account identity (#4006 target model)
-- ----------------------------------------------------------------------------
-- Business ownership anchors here, never to a provider subject directly.
-- Provider subject IDs are migration inputs, not permanent business identity.

CREATE TABLE IF NOT EXISTS public.app_account (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status                 text NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'disabled', 'merged')),
    merged_into_account_id uuid NULL REFERENCES public.app_account(id),
    display_name           text NULL,
    created_at             timestamptz NOT NULL DEFAULT NOW(),
    updated_at             timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.app_account IS
    '#4006 stable Product account identity. One row per Product account across
LoveBud + LoveTree. Ownership resolves through this table, never directly
through provider subjects.';

COMMENT ON COLUMN public.app_account.merged_into_account_id IS
    'Set only by an explicit operator merge flow; a merged account keeps its
row for audit and never reuses another provider binding.';

-- ----------------------------------------------------------------------------
-- Section B: app_auth_identity - verified provider identities per account
-- ----------------------------------------------------------------------------
-- Rows are created ONLY after cryptographic verification succeeds
-- (verification-before-mapping invariant, bridge doc section 5).
-- email is metadata only and MUST NOT appear as a linking key.

CREATE TABLE IF NOT EXISTS public.app_auth_identity (
    identity_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          uuid NOT NULL REFERENCES public.app_account(id),
    provider            text NOT NULL CHECK (provider IN ('firebase', 'neon')),
    provider_subject    text NOT NULL,
    status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'revoked')),
    verification_method text NOT NULL,
    email_normalized    text NULL,
    linked_at           timestamptz NOT NULL DEFAULT NOW(),
    unlinked_at         timestamptz NULL,
    created_at          timestamptz NOT NULL DEFAULT NOW(),
    updated_at          timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT app_auth_identity_provider_subject_unique
        UNIQUE (provider, provider_subject)
);

COMMENT ON COLUMN public.app_auth_identity.email_normalized IS
    'Display/recovery UX metadata only. Never a linking or ownership key.
No unique constraint may ever reference this column.';

COMMENT ON COLUMN public.app_auth_identity.verification_method IS
    'Bounded vocabulary of proven verification paths (for example
id_token_jwks). A NULL or unknown method must fail closed at runtime.';

-- At most ONE active identity per provider per account. Mirrors the bridge
-- document section 7 fail-closed rule against ambiguous owner projection.
CREATE UNIQUE INDEX IF NOT EXISTS app_auth_identity_one_active_firebase_per_account
    ON public.app_auth_identity (account_id)
    WHERE provider = 'firebase' AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS app_auth_identity_one_active_neon_per_account
    ON public.app_auth_identity (account_id)
    WHERE provider = 'neon' AND status = 'active';

-- ----------------------------------------------------------------------------
-- Section C: users - canonical legacy-owner anchor (fork-bootstrap compatible)
-- ----------------------------------------------------------------------------
-- Contract source: functions/_shared/tree-fork-direct-neon.js
--   * handled columns today: id, email, created_at, updated_at
--   * INSERT INTO users (id[, email][, created_at][, updated_at])
--     ON CONFLICT (id) DO UPDATE/DO NOTHING
--   * fail-closed invariant: any column that is NOT NULL without a default
--     and outside the handled set makes the fork gate abort with
--     users-schema-unavailable.
--
-- INVARIANT (binding for every future evolution of public.users):
--   While direct write gates rely on schema-capability bootstrap
--   (#4157/#4164), no new column may be added to public.users as NOT NULL
--   without a default. New capability columns enter as nullable first and
--   tighten only through a separately approved cutover slice.

-- Path 1: users table absent in the target database (current deployed state
-- confirmed by the #4164 deferral evidence). Create it complete.
CREATE TABLE IF NOT EXISTS public.users (
    id         text PRIMARY KEY,
    email      text NOT NULL DEFAULT '',
    account_id uuid NULL REFERENCES public.app_account(id),
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Path 2: users table already present in some lineage. Additive-only shape:
--   ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_id uuid NULL
--       REFERENCES public.app_account(id);
-- (Never add required-non-null columns; see the invariant above.)

-- One legacy-owner row binds to at most one stable account. Keeps the
-- compatibility resolution view single-valued.
CREATE UNIQUE INDEX IF NOT EXISTS users_one_active_account_binding
    ON public.users (account_id)
    WHERE account_id IS NOT NULL;

COMMENT ON COLUMN public.users.id IS
    'Legacy Product owner subject compatibility key (Firebase UID era).
Transitional only: business ownership converges on app_account.id via
account_id. Do not mint synthetic Firebase-shaped values into this column.';

COMMENT ON COLUMN public.users.account_id IS
    'Nullable during staged backfill. Backfill and any NOT NULL tightening are
separate approved migrations (bridge phases F).';

-- ----------------------------------------------------------------------------
-- Section D: compatibility resolution view (prototype parity, bridge doc 6)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.app_authenticated_owner_resolution AS
SELECT i.provider,
       i.provider_subject,
       a.id                AS account_id,
       u.id                AS legacy_owner_id
FROM public.app_auth_identity i
JOIN public.app_account a
    ON a.id = i.account_id AND a.status = 'active'
LEFT JOIN public.users u
    ON u.account_id = a.id
WHERE i.status = 'active';

COMMENT ON VIEW public.app_authenticated_owner_resolution IS
    'PROPOSAL_ONLY prototype compatibility boundary. Not a Production schema
authority until adopted. Fail-closed cases (unknown subject, revoked
identity, disabled/merged account, missing legacy projection) resolve to
zero rows and callers must deny.';

-- ----------------------------------------------------------------------------
-- Section E: auth_audit_log - auditable linking (#4006 requirement C)
-- ----------------------------------------------------------------------------
-- Append-only intent. No FK on purpose: audit rows survive identity/account
-- lifecycle changes. details must NEVER contain emails, tokens, hashes,
-- secrets, or private payloads (privacy guardrail, AGENTS.md).

CREATE TABLE IF NOT EXISTS public.auth_audit_log (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at       timestamptz NOT NULL DEFAULT NOW(),
    action            text NOT NULL CHECK (action IN (
                          'link_created',
                          'link_revoked',
                          'account_disabled',
                          'account_merged',
                          'recovery_used'
                      )),
    actor_class       text NOT NULL DEFAULT 'system'
                      CHECK (actor_class IN ('system', 'operator', 'user')),
    account_id        uuid NULL,
    identity_provider text NULL CHECK (identity_provider IN ('firebase', 'neon')),
    request_id        text NULL,
    details           jsonb NULL
);

COMMENT ON TABLE public.auth_audit_log IS
    'Every successful identity mutation writes exactly one row transactionally
with the mutation. Failed attempts write nothing here (runtime log only).';

-- ----------------------------------------------------------------------------
-- Section F: least-privilege alignment with the #4157 writer matrix
-- ----------------------------------------------------------------------------
-- Guidance only; actual role DDL belongs to the separately approved gate
-- slice and follows the #4157 one-time-mutation pattern.
--
--   writer role (LOVE_PLATFORM_WRITE_DATABASE_URL):
--     SELECT/INSERT/UPDATE on public.users            (fork bootstrap parity)
--     NO DELETE anywhere, NO DDL, no sequences needed
--     app_account / app_auth_identity / auth_audit_log are OUT of writer
--     scope in this proposal. Identity mapping runs under the service/owner
--     context. If fork bootstrap later moves to app_account creation, that
--     is a NEW matrix extension PR under the #4157 pattern, never silent.
--
--   rollback: DROP VIEW ... ; DROP TABLE reverse order (audit, identities,
--   users additions via DROP COLUMN account_id when adopted additively,
--   app_account). No data rewrite exists to undo because none is performed.
--
-- End of proposal.
