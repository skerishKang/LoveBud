-- Migration: canonical users / app_account / app_auth_identity foundation
--
-- Refs #4006
-- Refs #4004 - Keep OPEN
-- Refs #4157
-- Refs #4164
-- Refs #1882 - Keep OPEN
--
-- Additive-only slice adopted from the PROPOSAL_ONLY design artifact
-- db/proposals/4006-canonical-users-auth-identity-proposal.sql after CTO
-- review and owner adoption decision recorded on #4006.
--
-- Layer model (#4006):
--   verified (provider, subject) -> app_account.id (stable Product identity)
--                                -> public.users legacy-owner projection
--
-- Every statement is additive and re-runnable in shape: CREATE ... IF NOT
-- EXISTS plus ADD COLUMN IF NOT EXISTS. No DROP, no DELETE, no data rewrite,
-- no ownership rewrite. Existing rows are never touched.
--
-- users parity invariant (#4157/#4164): the fork owner-user bootstrap handles
-- exactly id/email/created_at/updated_at and fails closed on any unknown
-- NOT-NULL-without-default column. account_id enters as NULLABLE only.

CREATE TABLE IF NOT EXISTS public.app_account (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status                 text NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'disabled', 'merged')),
    merged_into_account_id uuid REFERENCES public.app_account(id),
    display_name           text,
    created_at             timestamptz NOT NULL DEFAULT NOW(),
    updated_at             timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_auth_identity (
    identity_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          uuid NOT NULL REFERENCES public.app_account(id),
    provider            text NOT NULL CHECK (provider IN ('firebase', 'neon')),
    provider_subject    text NOT NULL,
    status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'revoked')),
    verification_method text NOT NULL,
    email_normalized    text,
    linked_at           timestamptz NOT NULL DEFAULT NOW(),
    unlinked_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT NOW(),
    updated_at          timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT app_auth_identity_provider_subject_unique
        UNIQUE (provider, provider_subject)
);

-- At most ONE active identity per provider per account: ambiguity is
-- unrepresentable at the schema layer (bridge contract section 7).
CREATE UNIQUE INDEX IF NOT EXISTS app_auth_identity_one_active_firebase_per_account
    ON public.app_auth_identity (account_id)
    WHERE provider = 'firebase' AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS app_auth_identity_one_active_neon_per_account
    ON public.app_auth_identity (account_id)
    WHERE provider = 'neon' AND status = 'active';

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
    account_id        uuid,
    identity_provider text CHECK (identity_provider IN ('firebase', 'neon')),
    request_id        text,
    details           jsonb
);

-- Legacy-owner compatibility anchor. Created complete when absent; when a
-- pre-existing lineage already carries this table the IF NOT EXISTS form is a
-- no-op and only the nullable account_id column is added below.
CREATE TABLE IF NOT EXISTS public.users (
    id         text PRIMARY KEY,
    email      text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.app_account(id);

CREATE UNIQUE INDEX IF NOT EXISTS users_one_active_account_binding
    ON public.users (account_id)
    WHERE account_id IS NOT NULL;

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
