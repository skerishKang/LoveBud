# LoveBud Memory Atlas Edge Scope Consistency Fix Note

Issue: #2496

Follow-up to #2494 and PR #2495.

The projection must keep edge scope consistent with endpoint scope. When a shared derived node is narrowed because later evidence is non-public, connected edges are narrowed as well.

Locked rule:

- public nodes can have public edges only to other public nodes;
- a non-public endpoint forces the edge to non-public;
- a later node scope change propagates to existing connected edges.

This remains a read-only projection helper change.

Non-goals:

- No DB migration.
- No production schema change.
- No persistence.
- No editor UI change.
- No Browse/Search change.
- No Scout/provider work.
- No relationship persistence.
