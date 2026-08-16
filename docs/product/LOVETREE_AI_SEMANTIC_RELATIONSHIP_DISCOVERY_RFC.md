# LoveTree AI Semantic Relationship Discovery RFC

**Related import parent:** #3897 — Keep OPEN  
**Related platform authority:** #4004  
**Companion RFC:** `docs/product/LOVETREE_PRIVATE_YOUTUBE_PLAYLIST_IMPORT_5K_RFC.md`  
**Status:** Future product/architecture RFC. Not an implementation authorization.  
**Baseline:** LoveBud `main` at `ba7d470385f8bf21471cb8d5eeb9a4846df7232d`; `lovetree-limone` design/runtime inputs inspected at `5a96861f5bbbdf65fbadeab614d50fd300db69a7`.  
**Date:** 2026-08-14

---

## 1. Product principle

LoveTree should not imitate a graph by connecting everything automatically.

The intended principle is:

> **AI finds relationships. The user decides meaning.**

For large imported Trees, especially hundreds or thousands of Moments, AI can help discover patterns that are difficult to notice manually. But an AI similarity result is not automatically a canonical LoveTree Connection.

Keep these concepts separate:

```text
source/order relationship
AI relationship candidate
user-confirmed LoveTree Connection
```

---

## 2. Why this matters for 5K Trees

A 5,000-Moment Tree creates a discovery problem, not only a rendering problem.

Without assistance, the user may have thousands of imported Moments but little reason to connect them. The product should therefore help answer questions such as:

- Which Moments are about the same topic?
- Which Moments mention the same person, place, work, event or creator?
- Which Moments form a time progression?
- Which Moments repeatedly evoke a similar feeling?
- Which Moments act as bridges between otherwise separate clusters?
- Which small groups could become a meaningful branch or path?

The result should make a large imported collection easier to understand without rewriting the user's source or silently inventing meaning.

---

## 3. Obsidian-like inspiration, without copying the wrong assumption

A graph view is useful when it visualizes real relationships. A semantic system can additionally suggest relationships that are not yet explicit.

LoveTree should adopt the useful part of that model:

```text
existing Moment content
→ semantic representation
→ related-Moment candidates / clusters
→ user review
→ selected candidates become canonical Connections
```

LoveTree should **not** adopt:

```text
AI similarity
→ automatically persist thousands of unexplained canonical Connections
```

That would create an unreadable graph, make model changes destructive, and blur the distinction between recommendation and user meaning.

---

## 4. Three relationship layers

### Layer A — deterministic source relationships

Examples:

- same imported playlist;
- source position;
- same creator/channel;
- same provider;
- same import batch;
- same explicit source tag where available.

These are provenance/metadata relationships. They do not require AI and do not automatically become LoveTree Connections.

### Layer B — AI/derived relationship candidates

Examples:

- semantic topic similarity;
- shared named entities;
- related events/works/people;
- temporal progression;
- emotional similarity or contrast;
- inferred learning progression;
- bridge candidate between clusters;
- candidate branch/group membership.

These are **derived suggestions** and can change when the model, metadata or algorithm changes.

### Layer C — canonical LoveTree Connections

A canonical Connection is part of the user's Tree meaning.

It should be created by:

- explicit user action; or
- a future explicitly approved automation mode whose behavior is visible, reversible and separately authorized.

The default product must remain human-in-the-loop.

---

## 5. Moment enrichment model

A source-faithful imported Moment may later receive derived enrichment such as:

```text
summary
topics
entities
creator/person references
time hints
emotion signals
language
semantic embedding / representation
```

These fields are derived aids, not replacements for canonical user content.

Requirements:

- raw Moment/source content remains authoritative for what the user imported or wrote;
- AI enrichment is versioned or reproducible enough to distinguish model generations;
- derived metadata can be recomputed without rewriting the original Moment;
- deleting/recomputing AI metadata must not delete user-confirmed Connections;
- private Moment enrichment remains private under the same or stronger access boundary.

This RFC does not select a specific AI vendor/model/vector database.

---

## 6. Relationship candidate contract

A candidate should be explainable and non-canonical.

Conceptual shape:

```text
candidate_id
from_moment_id
to_moment_id
candidate_type
score / rank
reason_summary
model_or_rule_version
created_at
status = suggested | accepted | dismissed | stale
```

The exact schema is not authorized here.

A candidate response should support UX such as:

```text
Moment A ───── Moment B
related because: both discuss RNN vanishing gradients
confidence/rank: high

[Connect] [Dismiss]
```

Do not expose hidden chain-of-thought or model internals as the explanation. Use short bounded evidence/category summaries.

---

## 7. Avoid O(N²) all-pairs processing

For 5,000 Moments, naïvely comparing every pair produces roughly 12.5 million unordered pairs.

The product should not synchronously evaluate and persist every possible pair.

Candidate architecture should evaluate bounded approaches such as:

- semantic/vector nearest-neighbor retrieval;
- top-K candidates per Moment;
- cluster-first retrieval then local candidate generation;
- entity/topic inverted indexes;
- temporal windows when time is relevant;
- incremental recomputation only for changed/new Moments.

The specific retrieval technology is an implementation decision. Do not introduce a vector extension/service solely because it is fashionable; benchmark it against the shared #4004 runtime/data architecture first.

Required invariant:

```text
candidate generation remains bounded as Tree size grows
```

---

## 8. Candidate types

The first design audit should distinguish at least:

### 8.1 Semantic similarity

“these Moments discuss substantially similar concepts.”

### 8.2 Shared entity

“these Moments refer to the same person, work, place, creator, event or object.”

### 8.3 Temporal relationship

“these Moments appear to belong to the same chronological period/progression.”

This must not fabricate causality merely because dates are adjacent.

### 8.4 Emotional relationship

“these Moments have similar or contrasting emotional signals.”

Do not overwrite user-entered emotions with AI classifications.

### 8.5 Learning/narrative progression candidate

“this group may form an understandable progression.”

Example:

```text
RNN basics
→ vanishing gradients
→ LSTM
→ attention
→ Transformer
```

This is a proposal for user review, not automatic canonical causality.

### 8.6 Bridge candidate

A Moment that appears to connect two otherwise separate semantic/graph clusters.

This is compatible with the `lovetree-limone` #160 view concept where Bridge Moment is explicitly a **derived view property**, not automatically a new canonical domain entity.

---

## 9. Clustering and branch suggestions

For large Trees, the most useful AI output may be groups rather than thousands of pairwise edges.

Candidate flow:

```text
5,000 Moments
→ derived clusters
→ cluster labels / summaries
→ candidate bridge Moments
→ candidate branch/path proposals
→ user accepts/rejects/edits
```

Example UI:

```text
AI / Machine Learning — 812 Moments
Music — 634
Travel — 421
Economics — 386
Film — 351
...
```

Then:

```text
Suggested branch:
"RNN → LSTM → Transformer"
23 Moments

[Review] [Create branch/Connections] [Dismiss]
```

Clusters are views/derived organization unless a separate product decision promotes a grouping into canonical Tree structure.

---

## 10. User-control rules

Default rules:

1. AI candidates do not appear as canonical Connections until accepted.
2. Dismissed candidates should not immediately reappear from the same model/version unless source data materially changed.
3. Accepted Connections survive candidate-model recomputation.
4. AI must show why a suggestion exists in bounded user-readable language.
5. Users can turn AI suggestions off for a Tree.
6. A large import can finish without waiting for AI enrichment.
7. Publication does not require AI analysis.
8. AI does not silently change Moment order, visibility or source provenance.

---

## 11. Candidate lifecycle and model changes

A derived relationship may change when:

- source Moment content changes;
- enrichment changes;
- the embedding/model version changes;
- candidate thresholds change;
- the user accepts/dismisses a relationship;
- Moments are deleted or made inaccessible.

Therefore candidate state must be separable from canonical Connection state.

Conceptual lifecycle:

```text
suggested
→ accepted → canonical Connection created/linked
→ dismissed
→ stale (input/model changed)
→ recomputed
```

Do not mutate an accepted canonical Connection merely because a future model assigns a lower similarity score.

---

## 12. Privacy and AI processing boundary

Private Trees may contain private source URLs, notes and source-derived metadata.

Before implementation, the AI authority child must define:

- which Moment fields may be sent to an external model, if any;
- whether local/self-hosted/model-provider processing is used;
- retention/training settings of any provider;
- user consent/disclosure where required;
- redaction/minimization strategy;
- derived embedding/data retention;
- deletion when a Tree/Moment/account is deleted;
- tenant/account separation;
- no private candidate leakage into public/Browse/search surfaces;
- no AI logs containing raw private Moment content by default.

The product must not assume that because a video itself is public, the user's note or the fact that it appears in a private personal collection is public.

---

## 13. Large-Tree UI integration

AI relationship discovery should work with the newer LoveTree large-Tree experiences rather than forcing all suggestions into one spaghetti graph.

Potential surfaces:

- “Related Moments” inspector for the selected Moment;
- cluster/semantic-zoom overview;
- bridge candidates in the #160-style cluster explorer;
- candidate routes/branches in the canonical Graph editor;
- a review queue for suggestions;
- minimap overlays for suggested vs confirmed relationships.

Visual distinction is required:

```text
canonical Connection
AI suggested relationship
source/order relationship
```

must not use indistinguishable edge styling or interaction semantics.

`lovetree-limone` #141 interaction primitives and #162 graph-routing work are relevant UI/runtime inputs, but they do not define the AI data authority.

---

## 14. Cross-repository ownership

### LoveBud/shared platform authority

Owns:

- AI processing authorization and privacy boundary;
- canonical Moment/Connection authority;
- derived candidate API/model;
- candidate lifecycle persistence if persistence is approved;
- job execution and operational controls;
- deletion/retention;
- provider/model secrets;
- Production deployment.

### `lovetree-limone`

Owns/prototypes:

- visual distinction between suggested and confirmed relationships;
- candidate review UX;
- cluster/semantic zoom presentation;
- branch proposal review;
- large-Tree performance and accessibility.

No UI repository may directly persist canonical Connections outside the shared API authority.

---

## 15. Work packages

Do not create one “AI connects everything” mega-issue.

Recommended future children:

1. **AI/privacy authority audit**
   - data minimization;
   - model/provider boundary;
   - retention/deletion;
   - user control.

2. **Moment enrichment contract**
   - derived summary/topic/entity/embedding/version model;
   - incremental recompute;
   - no canonical content mutation.

3. **Relationship candidate contract**
   - candidate types;
   - top-K/bounded retrieval;
   - reason/rank;
   - lifecycle.

4. **Clustering / branch suggestion contract**
   - derived groups;
   - Bridge Moment candidates;
   - branch proposal representation;
   - no automatic topology mutation.

5. **Suggested-Connection UI integration**
   - new LoveTree editor/cluster/graph views;
   - accept/dismiss;
   - visual distinction;
   - mobile/accessibility.

6. **Evaluation and quality gates**
   - precision/relevance sample review;
   - duplicate/noise rate;
   - explanation usefulness;
   - 300/1K/5K performance;
   - user-confirmation rate without optimizing for compulsive engagement.

---

## 16. Non-goals for first AI slice

- no automatic creation of thousands of canonical Connections;
- no all-pairs synchronous 5K comparison;
- no forced AI processing during playlist import;
- no AI rewrite of source order;
- no AI publication decision;
- no replacement of user-entered emotions/notes;
- no AI-generated private data in public surfaces;
- no provider/model selection in this RFC;
- no DB/vector-extension migration from this document alone;
- no Production AI processing without a separate approved privacy/security implementation issue.

---

## 17. Implementation start gate

AI runtime implementation should not begin until:

- the private-playlist/5K import architecture is stable enough to provide canonical Moment inputs;
- candidate vs canonical Connection semantics are approved;
- AI privacy/provider authority is approved;
- bounded candidate retrieval approach is selected;
- deletion/recompute/version behavior is defined;
- new LoveTree UI has a review surface that does not confuse suggestions with confirmed Connections.

The import system does **not** need to wait for this gate.

---

## 18. Acceptance criteria for this RFC phase

This planning phase is complete when:

- AI suggestions and canonical Connections are explicitly separate;
- source order is not treated as semantic causality;
- 5K-scale processing avoids naïve all-pairs persistence;
- clustering/branch suggestions are allowed as derived views/proposals;
- accepted user Connections survive model changes;
- explanations are bounded and user-readable;
- private Moment/Tree content remains behind an explicit AI privacy boundary;
- the large-Tree UI has a future integration direction;
- no runtime/schema/Production mutation occurs in this RFC PR.

---

## 19. Product statement

> LoveTree uses AI to surface relationships a person may not notice across hundreds or thousands of Moments. AI proposes; the person decides which relationships become part of the Tree.
