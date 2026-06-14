# LoveBud Memory Wiki and Ontology Atlas Foundation

Issue: #2489

Related but not closed by this foundation:

- #2418 — Obsidian-style relationship graph and canvas links.
- #1882 — LoveBud Scout link-based fan assistant MVP.

## Product direction

LoveBud should evolve beyond a video-backed memory saver into an internal knowledge system where saved memories become readable wiki pages and machine-usable ontology/graph structures.

The center of the product should remain LoveBud-owned memory evidence, not external web knowledge. External knowledge can become optional future enrichment, but it is not the primary foundation for this first slice.

Positioning line:

> LoveBud is not just where videos are saved. LoveBud is where memories become knowledge.

## First foundation goal

The first foundation defines concepts and guardrails only. It does not implement storage, UI, indexing, crawling, transcript extraction, MCP runtime, or provider integration.

The long-term model is:

1. A user adds a video-backed or text-backed memory.
2. LoveBud keeps the original memory as the source of truth.
3. LoveBud can derive internal wiki-style pages from the user's own memories, trees, sources, topics, people, places, events, emotions, and time periods.
4. LoveBud can represent those derived structures as ontology/graph nodes and ontology/graph edges.
5. LoveBud AI/Scout can answer questions using internal memory evidence first.

## Concept separation

The foundation must keep these concepts separate:

- user-authored memories — saved memory title, note, text, and user choices.
- LoveBud source records — URL, video, channel/profile, manual source, or source preview information already represented inside LoveBud.
- AI-derived labels — model-suggested topics, emotions, people, places, events, time buckets, or tags.
- AI-derived relationships — model-suggested links between memories, topics, sources, events, emotions, or time periods.
- internal wiki pages — readable pages assembled from saved memories and reviewed/derived structure.
- ontology/graph nodes — machine-usable entities in the memory atlas.
- ontology/graph edges — machine-usable relationships between nodes.

User-authored memory content is the source of truth. AI-derived labels and AI-derived relationships are interpretations, not facts, until reviewed or explicitly accepted.

## Initial node vocabulary

The initial conceptual node vocabulary is deliberately small and explainable:

| Node type | Meaning |
| --- | --- |
| `memory` | A saved LoveBud moment or memory. |
| `tree` | A LoveTree or major user-facing memory collection. |
| `pack` | A grouped memory pack or future exportable memory bundle. |
| `video` | A video-backed source or video-backed moment reference. |
| `source` | URL, channel/profile, manual source record, or source preview. |
| `topic` | A subject extracted from memory content or user labels. |
| `person` | Person, creator, artist, character, family member, or named actor in a memory. |
| `place` | Physical or digital location. |
| `event` | Dated or narrative event. |
| `emotion` | User-facing feeling or affect label. |
| `time` | Date, month, era, or timeline bucket. |

The first implementation should not require all node types to be materialized. The vocabulary exists to keep later slices consistent.

## Initial edge vocabulary

The initial edge vocabulary should stay product-friendly and explainable:

| Edge type | Meaning |
| --- | --- |
| `about` | A memory or page is mainly about a topic/person/event/source. |
| `mentions` | A memory mentions a node without making it the main subject. |
| `felt_as` | A memory is associated with an emotion. |
| `happened_at` | A memory or event happened at a place. |
| `happened_in` | A memory or event happened in a time bucket. |
| `belongs_to` | A memory belongs to a tree, pack, or page group. |
| `source_of` | A source/video/source record is evidence for a memory or derived claim. |
| `related_to` | A weak, explainable relationship between nodes. |
| `same_topic_as` | Two memories or pages share a topic. |
| `same_source_as` | Two memories or pages share a source. |
| `follows_from` | A later memory follows from an earlier event, decision, or memory. |
| `contrasts_with` | Two memories express contrast, tension, or changed interpretation. |

The graph should not blindly auto-connect everything. Too many automatic links can make LoveBud feel like an expert graph editor instead of a gentle memory experience.

## Evidence/source model

Every derived wiki claim or ontology/graph relationship must be able to point back to LoveBud evidence. The evidence reference should be able to include:

- memory id
- source type
- source URL when present
- user-entered title
- user-entered note
- video metadata when already available inside LoveBud
- channel/profile metadata when already available inside LoveBud
- created_at timestamp
- updated_at timestamp
- visibility scope
- confidence
- review status

Evidence references should be stable enough for AI/Scout to explain why a page, label, or relationship exists.

Evidence references should not require external scraping, YouTube API calls, channel feed imports, transcript extraction, or live provider calls in the first foundation.

## Internal wiki model

The internal wiki is the user-readable layer on top of LoveBud memory evidence.

Possible first wiki page types:

- topic page
- person/source page
- event page
- emotion page
- time-period page
- tree/pack page

A wiki page should answer: "Which memories support this page, and how are they connected?"

The first wiki model should be internal and evidence-backed. It should not automatically publish pages, expose private memories, or treat external knowledge as the default source of truth.

## AI/Scout behavior contract

LoveBud AI/Scout should be evidence-first for this foundation.

Required behavior:

- evidence-first answers from LoveBud memory evidence.
- non-persistent by default AI-derived labels and relationships.
- review-before-save for suggested relationships and derived wiki edits.
- no hidden graph edges created silently by AI.
- distinguish user-authored memory text from model-derived interpretation.
- explicit user confirmation before any future save action.
- clear uncertainty when evidence is weak or absent.

AI may help summarize, cluster, or suggest connections, but it must not silently rewrite user memory, create irreversible relationships, or expose private content.

## Privacy and visibility guardrails

Privacy is part of the foundation, not a later add-on.

- Keep public/private visibility attached to every evidence-backed derived structure.
- Do not change public/private visibility as part of this issue.
- Do not expose private memories through internal wiki pages, graph previews, Browse, Search, Scout, or share flows.
- Derived nodes and edges inherit the strictest visibility of their evidence unless a later reviewed policy says otherwise.
- AI-derived summaries must not reveal evidence from memories the viewer cannot access.
- Public Browse/Search behavior is out of scope for the first foundation.

## Non-goals for the first slice

This first slice is docs/contracts only.

- No DB migration.
- No production schema change.
- No large graph visualization UI.
- No editor canvas behavior change.
- No Browse/Search sort or social-count work.
- No external web crawling or scraping.
- No YouTube API calls.
- No channel feed import.
- No video transcript extraction implementation.
- No MCP runtime work.
- No live provider/network integration.
- No automatic relationship persistence.
- No automatic wiki page publication.
- No public/private visibility change.
- Do not close #2418 from this issue.
- Do not close #1882 from this issue.

## Suggested later slices

1. Add a read-only memory-to-node/edge projection helper.
2. Add a non-persistent Atlas preview in the editor/detail panel.
3. Add review-before-save relationship suggestions.
4. Add internal wiki pages generated from saved LoveBud memories.
5. Connect Scout answers to internal evidence references.

## Acceptance criteria for this foundation

- The foundation defines the LoveBud Memory Wiki and Ontology Atlas concepts.
- The foundation separates user-authored memories, LoveBud source records, AI-derived labels, AI-derived relationships, internal wiki pages, ontology/graph nodes, and ontology/graph edges.
- The foundation defines the initial node and edge vocabulary.
- The foundation requires evidence references for derived claims.
- The foundation locks privacy/visibility guardrails for internal memory knowledge.
- The foundation states that external knowledge is optional future enrichment, not the primary foundation.
- The foundation keeps #2418 and #1882 open for their own scopes.
