-- Exact legacy pre-Migration-A social schema for Migration B empty-table rehearsal.
-- Empty tables (zero rows) with full index/constraint shape.
-- Refs #3540, #3538, #3459, #1882

CREATE TABLE public.social_idempotency (
    id              UUID PRIMARY KEY,
    actor_id        VARCHAR(128) NOT NULL,
    operation       VARCHAR(64)  NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    target_memory_id UUID NOT NULL,
    result_id       VARCHAR(128),
    result_state    VARCHAR(20)  NOT NULL DEFAULT 'pending',
    result_payload  JSONB,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_social_idempotency_actor_op_key
    ON public.social_idempotency(actor_id, operation, idempotency_key);
CREATE INDEX idx_social_idempotency_created_at ON public.social_idempotency(created_at);
CREATE INDEX idx_social_idempotency_target_memory ON public.social_idempotency(target_memory_id);

CREATE TABLE public.social_audit_log (
    id              UUID PRIMARY KEY,
    actor_id        VARCHAR(128) NOT NULL,
    memory_id       UUID NOT NULL,
    action          VARCHAR(64)  NOT NULL,
    outcome_code    VARCHAR(20)  NOT NULL,
    request_key_hash VARCHAR(64),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_audit_log_actor_id ON public.social_audit_log(actor_id);
CREATE INDEX idx_social_audit_log_memory_id ON public.social_audit_log(memory_id);
CREATE INDEX idx_social_audit_log_created_at ON public.social_audit_log(created_at);
CREATE INDEX idx_social_audit_log_action ON public.social_audit_log(action);

CREATE TABLE public.lb_unrelated_marker (
    id text NOT NULL PRIMARY KEY,
    v text NOT NULL
);
INSERT INTO public.lb_unrelated_marker (id, v) VALUES ('unrel_empty', 'keep');
