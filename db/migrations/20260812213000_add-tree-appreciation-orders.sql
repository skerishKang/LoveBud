-- Migration: add dedicated Tree appreciation-order persistence
--
-- Refs #3982
-- Refs #3921
-- Refs #3061
-- Refs #3938
-- Refs #1882
--
-- This canonical migration creates one dedicated 1:1 appreciation-order table.
-- It does not modify trees.id, existing Tree/Memory/social rows, runtime routes,
-- or any Production/Preview database. The FK cascade applies only to rows in
-- this new child table when its parent Tree is deleted.
--
-- ordered_ids intentionally has no DEFAULT: absence of a row means there is no
-- explicit appreciation order, and writers must persist the validated sequence.

CREATE TABLE IF NOT EXISTS public.tree_appreciation_orders (
    tree_id TEXT NOT NULL,
    ordered_ids JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT tree_appreciation_orders_pkey PRIMARY KEY (tree_id),
    CONSTRAINT tree_appreciation_orders_tree_id_fkey
        FOREIGN KEY (tree_id) REFERENCES public.trees(id) ON DELETE CASCADE,
    CONSTRAINT tree_appreciation_orders_array_check
        CHECK (jsonb_typeof(ordered_ids) = 'array')
);
