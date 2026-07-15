-- Exact legacy tree_comments fixture for disposable CI PostgreSQL only.
-- Synthetic empty schema matching the migration preflight legacy contract.
-- No Production dump, no real row payloads.

CREATE TABLE public.users (
  id text NOT NULL PRIMARY KEY
);

CREATE TABLE public.trees (
  id text NOT NULL PRIMARY KEY
);

CREATE TABLE public.tree_comments (
  id text NOT NULL,
  tree_id text NOT NULL,
  author_id text NULL,
  author_display_name text NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NULL,
  updated_at timestamptz NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (tree_id, id),
  FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL,
  FOREIGN KEY (tree_id) REFERENCES public.trees(id) ON DELETE CASCADE
);
