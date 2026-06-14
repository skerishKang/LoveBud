# LoveBud Memory Atlas Strictest Visibility Fix Note

Issue: #2494

Follow-up to #2492 and PR #2493.

The read-only Memory Atlas projection helper deduplicates derived nodes. Shared derived nodes can collect evidence from multiple memories. If any contributing memory is private or non-public, the shared node must not remain public.

Locked rule:

- a derived node or deduped edge is public only when all contributing evidence is public;
- if any contributing evidence is private or non-public, the derived structure is private.

This is a narrow privacy hardening slice.

Non-goals:

- No DB migration.
- No production schema change.
- No persistence.
- No editor UI change.
- No Browse/Search change.
- No Scout/provider work.
- No relationship persistence.
