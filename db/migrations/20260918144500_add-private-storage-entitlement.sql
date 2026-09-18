-- Migration: add canonical private-storage entitlement to the current Neon owner anchor
--
-- Refs #4425
-- Refs #4000
-- Refs #4006
--
-- Product policy: private Tree/Memory storage remains a paid/Plus capability.
-- Firebase remains authentication only; Firestore is not the target entitlement store.
--
-- During the legacy-owner compatibility phase, public.users.id is the verified
-- Firebase UID projection used by the active owner-write paths. Keep the
-- entitlement on that same Neon row until #4006 stable app_account mapping is
-- Product-live. The column is additive, default-false, and therefore fail-closed.
--
-- No Production execution is authorized by committing this file.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS private_storage_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.private_storage_enabled IS
    'Canonical Plus/private-storage entitlement during the legacy-owner compatibility phase; default false; migrate to stable account scope only under a separately approved #4006 slice.';
