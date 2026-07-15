-- Exact damaged public.trees fixture for disposable CI PostgreSQL only.
-- id TEXT NOT NULL sole PK; seven foothold columns ABSENT.
-- Synthetic rows + dependent/unrelated sentinels for preservation only.
-- No Production dump, no real account identifiers.

CREATE TABLE public.trees (
  id text NOT NULL PRIMARY KEY
);

INSERT INTO public.trees (id) VALUES
  ('tree_syn_a'),
  ('tree_syn_b');

-- Synthetic dependent sentinel (not mutated by foothold migration).
CREATE TABLE public.lb_sentinel_dependent (
  id text NOT NULL PRIMARY KEY,
  tree_id text NOT NULL,
  body text NULL
);

INSERT INTO public.lb_sentinel_dependent (id, tree_id, body) VALUES
  ('dep_syn_1', 'tree_syn_a', 'sentinel-body');

-- Unrelated relation fingerprint sentinel.
CREATE TABLE public.lb_unrelated_marker (
  id text NOT NULL PRIMARY KEY,
  v text NOT NULL
);

INSERT INTO public.lb_unrelated_marker (id, v) VALUES
  ('unrel_1', 'keep');
