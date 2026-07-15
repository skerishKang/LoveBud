-- Exact legacy social schema for disposable CI PostgreSQL only.
-- Mirrors migration-harden-moment-social-writes relevant tables (pre-Migration A).
-- Synthetic rows only. No Production dumps or real identifiers.
-- Refs #3534, #3262, #3177, #1882

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

CREATE INDEX idx_social_idempotency_created_at
    ON public.social_idempotency(created_at);

CREATE INDEX idx_social_idempotency_target_memory
    ON public.social_idempotency(target_memory_id);

CREATE TABLE public.social_audit_log (
    id              UUID PRIMARY KEY,
    actor_id        VARCHAR(128) NOT NULL,
    memory_id       UUID NOT NULL,
    action          VARCHAR(64)  NOT NULL,
    outcome_code    VARCHAR(20)  NOT NULL,
    request_key_hash VARCHAR(64),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_audit_log_actor_id
    ON public.social_audit_log(actor_id);

CREATE INDEX idx_social_audit_log_memory_id
    ON public.social_audit_log(memory_id);

CREATE INDEX idx_social_audit_log_created_at
    ON public.social_audit_log(created_at);

CREATE INDEX idx_social_audit_log_action
    ON public.social_audit_log(action);

-- Synthetic rows (deterministic UUIDs; not Production identifiers).
INSERT INTO public.social_idempotency (
    id, actor_id, operation, idempotency_key, request_fingerprint,
    target_memory_id, result_id, result_state, result_payload
) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'syn_actor_a',
    'comment.create',
    'syn_idem_key_a',
    'syn_fp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    NULL,
    'pending',
    NULL
);

INSERT INTO public.social_audit_log (
    id, actor_id, memory_id, action, outcome_code, request_key_hash
) VALUES (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'syn_actor_a',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'comment.create',
    'success',
    'syn_req_hash_cccccccccccccccccccccccc'
);

-- Unrelated sentinel outside Migration A scope.
CREATE TABLE public.lb_unrelated_marker (
    id text NOT NULL PRIMARY KEY,
    v text NOT NULL
);

INSERT INTO public.lb_unrelated_marker (id, v) VALUES ('unrel_1', 'keep');
