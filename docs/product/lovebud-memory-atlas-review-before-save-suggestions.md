# Memory Atlas Review-Before-Save Suggestions Plan

Issue: #2503

This docs/contracts-only slice plans how Memory Atlas can offer relationship suggestions without saving relationships. It follows the Memory Atlas foundation and preview work while keeping #2418 and #1882 open.

Refs: #2489, #2492, #2494, #2496, #2499, #2501

Related but not closed: #2418, #1882

## Status

- Scope: docs/contracts-only planning slice
- Runtime behavior change: none
- Database/schema migration: none
- API behavior change: none
- Persistence implementation: none
- Editor UI implementation: none
- Browse/Search behavior change: none
- Scout/provider/live/AI integration: none
- Automatic relationship save: none
- Automatic wiki page publication: none
- Public graph feature: none

## Product direction

LoveBud can suggest memory relationships gently and safely.

A suggestion is not a saved relationship. A previewed relationship is not a saved relationship. Only explicit user action can turn a reviewed suggestion into future saved state.

Memory Atlas suggestions should help users notice possible connections between memories, topics, sources, emotions, time periods, and tree context. They must remain reviewable, evidence-backed, and easy to reject.

The product direction is **review-before-save**:

1. Surface a candidate relationship as a suggestion.
2. Explain why it appears using evidence references.
3. Let the user review it before any future save action.
4. Keep the current saved memory graph unchanged unless the user explicitly chooses a future save/confirm action.

## Suggestion states

| State | Meaning | Saved? |
| --- | --- | --- |
| `candidate` | A possible relationship has been identified for review. | No |
| `previewed` | The suggestion is visible to the user as preview-only. | No |
| `dismissed` | The user rejected or hid the suggestion. | No |
| `accepted` | The user chose to review or promote the suggestion. | No |
| `saved` | A future explicit save/confirm action has persisted the relationship. | Yes |

candidate, previewed, dismissed, and accepted are not equivalent to saved.

A future implementation may move from `candidate` to `previewed` to `accepted`, but it must not treat `accepted` as persisted state unless a later reviewed save action exists.

## Suggestion types

| Type | Meaning |
| --- | --- |
| `topic_match` | The source and target share a topic, theme, or subject label. |
| `source_match` | The source and target share a source record, URL/domain, creator, or channel context. |
| `emotion_match` | The source and target share an emotion label or affective interpretation. |
| `time_match` | The source and target share a date, season, era, or chronological bucket. |
| `tree_context` | The source and target appear in the same tree, branch, pack, or user-created collection context. |
| `manual_link_candidate` | A user-created or user-reviewed link candidate is available for suggestion review. |
| `contrasts_with_candidate` | Two memories appear to contrast, tension, or change an interpretation. |
| `follows_from_candidate` | One memory appears to follow from an earlier memory, event, decision, or interpretation. |

These types are suggestion types, not persisted edge types.

The final persisted edge vocabulary, if any, must be defined by a later relationship-storage slice. This issue only plans suggestion vocabulary and guardrails.

## Evidence requirements

Every relationship suggestion must include evidence references.

No suggestion should be shown as fact without evidence.

Each suggestion should include enough evidence for a future review UI to explain why it appears without exposing private data. Evidence references may include:

- source memory id
- target memory id or target node id
- supporting node id
- supporting edge id when available
- evidence id from the projection helper
- source type
- source URL when available
- user-authored title or note excerpt when safe to show
- created_at
- updated_at
- visibility scope
- confidence
- review status

Evidence references must distinguish user-authored memory content from model-derived interpretation. Weak, ambiguous, or private evidence should reduce confidence or prevent the suggestion from being shown.

## Visibility rule

Suggestions inherit the strictest visibility of supporting evidence.

A suggestion is public only when every supporting evidence item is public.

Private or non-public evidence makes the suggestion private or non-public. The public viewer must not receive a suggestion that depends on private evidence.

Visibility must be evaluated before a suggestion is shown. If any supporting evidence is unavailable to the current viewer, the suggestion must not be shown to that viewer.

## Review-before-save flow

1. Show suggestion as preview-only.
2. Explain why it appears using evidence references.
3. Label the suggestion state.
4. Let the user accept or dismiss in a future UI slice.
5. Do not save a relationship until a future explicit save/confirm action exists.
6. If dismissed, do not silently re-show without a defined policy.

The first implementation should not create persistence, hidden graph edges, or saved relationships. It should define the product contract so later UI and persistence slices can implement review before save safely.

## Suggested copy

Use copy that makes the provisional nature obvious:

- `Suggested connection`
- `Preview only — this relationship is not saved.`
- `Based on existing memory evidence.`
- `Review before saving.`
- `Accept suggestion`
- `Dismiss suggestion`

## Forbidden copy

The following copy must not be used for suggestions:

- `Saved relationship`
- `AI confirmed`
- `Published graph`
- `Public wiki link`
- `Auto-saved connection`

## AI interpretation guardrail

AI-derived suggestions must be labeled as interpretation, not fact.

Allowed framing:

- `LoveBud may suggest this connection because...`
- `This looks related based on existing memory evidence.`
- `Review before saving.`

Forbidden framing:

- `AI confirmed this relationship.`
- `This is definitely connected.`
- `This relationship has been saved.`

AI-derived suggestions are interpretation, not fact. They may help users notice possible relationships, but they must not be presented as verified truth, saved state, or publication.

## Dismissal policy placeholder

Dismissal persistence is not implemented here.

A future issue must define:

- local-only or account-level dismissal
- scope: tree, memory, pair, type, or another explicit boundary
- when a dismissed suggestion can reappear
- visibility behavior for private and public viewers
- whether dismissal should affect future suggestion generation

Until that policy exists, dismissal should be treated as a UX action only. It must not create hidden saved edges or silently alter the saved graph.

## Non-goals

This issue does **not**:

- No DB migration.
- No production schema change.
- No persistence implementation.
- No editor UI implementation.
- No Browse/Search behavior change.
- No Scout/provider/live/AI integration.
- No automatic relationship save.
- No automatic wiki page publication.
- No public graph feature.
- No hidden graph edges.
- Do not close #2418 from this issue.
- Do not close #1882 from this issue.

## Related documents

- `#2489` — Memory Wiki / Ontology Atlas foundation
- `#2492` — read-only Memory Atlas projection helper
- `#2494` — strictest visibility for shared projected nodes
- `#2496` — incident edge visibility consistency
- `#2499` — non-persistent Memory Atlas preview helper
- `#2501` — editor detail panel Memory Atlas preview
- `#2418` — Explore Obsidian-style relationship graph and canvas links
- `#1882` — LoveBud Scout link-based fan assistant MVP

## Closure recommendation

Close #2503 as completed when:

- this product note is merged;
- the contract test passes;
- the docs/contracts-only boundary is clear;
- no runtime implementation is included in this PR.

#2418 and #1882 remain open until their own scopes are completed.
