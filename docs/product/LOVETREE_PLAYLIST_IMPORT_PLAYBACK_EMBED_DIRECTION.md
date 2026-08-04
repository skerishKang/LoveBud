# LoveTree Playlist Import, Continuous Playback, and Embed Direction

> Status: product direction / concept preservation  
> Related Issue: #3897  
> Runtime impact: none  
> Implementation authority: none; implementation requires separate audited child Issues and PRs  
> Product authority: subordinate to `PRODUCT_IDENTITY.md`, `BRAND_EXPERIENCE.md`, and current publication/privacy policy

## 1. Why this document exists

LoveTree has been expanding through many visual forms: tree growth, timelines, archives, maps, bookshelves, and other rich ways to experience accumulated moments.

That visual expansion is valuable, but the product also needs a practical capability that gives users an immediate reason to start, return, watch, and share.

The central product idea captured here is:

> Let a user bring an existing YouTube playlist or browser bookmark collection into LoveTree, turn the imported items into ordered Moments, continue watching them easily in one flow, and gradually transform that imported collection into a personal emotional Tree.

This document preserves the intent and focus behind Issue #3897 so the work does not later collapse into a generic importer, bookmark manager, media dashboard, or isolated iframe experiment.

## 2. The user problem

### 2.1 Existing collections are useful but emotionally empty

Users already have:

- YouTube playlists;
- browser bookmarks;
- saved links;
- community posts containing embedded videos;
- short clips divided across several posts;
- personal lists that are difficult to revisit as one continuous story.

These systems preserve links or videos, but they usually do not preserve:

- why a specific item mattered;
- which exact scene moved the user;
- what emotion was attached to it;
- how one discovery led to the next;
- which items form the user's actual path of affection or fandom;
- how the collection should be experienced as one narrative.

### 2.2 Manual Tree creation creates a cold-start burden

A blank Tree asks the user to create every Moment one by one before the product becomes rewarding.

That is conceptually pure but practically demanding.

An import flow can provide an immediate starting structure:

```text
existing playlist or bookmark collection
→ ordered imported Moments
→ usable Tree immediately
→ user adds emotions, notes, intervals, and meaningful Connections over time
```

The import is therefore not the finished product. It is the fastest path from an existing collection into the LoveTree experience.

### 2.3 Community video viewing is fragmented

On many external forums and communities, users cannot present a sequence of videos comfortably.

Typical failure patterns include:

- one embedded video per post or section;
- a two-minute clip divided into four 30-second uploads;
- repeated scrolling to reach the next item;
- no persistent previous/next control;
- no queue or visible sequence;
- no emotional or narrative explanation connecting the items.

LoveTree can improve this by providing one continuous viewing surface where a viewer finishes one Moment and naturally moves to the next.

## 3. Product thesis

LoveTree must not compete with YouTube as a video host or with the browser as a bookmark database.

The product value is the layer above those systems:

```text
YouTube or web source
→ playable evidence

LoveBud / LoveTree
→ selected Moment
→ personal meaning
→ emotion
→ order
→ narrative Connection
→ continuous appreciation experience
```

A concise distinction is:

> Import brings the material. LoveTree creates the meaning.

This extends the existing `MOMENT_TIMELINE_PLAN.md` thesis:

> YouTube saves videos. LoveBud saves the moments that moved you.

The playlist import feature does not replace Moment Timeline. It creates a faster intake path into it.

## 4. Product focus

This capability should be treated as a major practical product layer with four connected functions.

### 4.1 Import

Users can bring an existing ordered collection into LoveTree.

Initial priority:

1. public YouTube playlist URL;
2. exported browser bookmark HTML file;
3. later, explicitly authorized private YouTube playlists;
4. later, a browser extension for selected content.

### 4.2 Transform

Imported items become editable LoveTree Moments rather than remaining an inert copied list.

Users can later add:

- a personal Moment title;
- an emotional note;
- emotion tags;
- a remembered date;
- a specific start and end interval;
- a representative thumbnail;
- a meaningful Connection to another Moment;
- a new position in the viewing sequence.

### 4.3 Watch continuously

A Tree should be easy to consume as a sequence.

The primary model is one active player, not many simultaneously loaded players.

The viewer should support:

- previous and next;
- queue position;
- start from the selected Moment;
- automatic advance when permitted;
- manual continuation when browser autoplay is blocked;
- unavailable-item handling;
- optional segment playback through `startSeconds` and `endSeconds`;
- opening the full Tree context without losing the current Moment.

### 4.4 Share and embed

A public Tree can become a shareable appreciation experience.

LoveBud may provide:

- a normal public Tree URL;
- Open Graph/link preview metadata;
- a compact public player route;
- iframe or oEmbed-compatible output where the external platform permits it.

LoveBud cannot force an external forum to accept arbitrary iframe content. The product must therefore separate:

```text
LoveBud provides a safe embed capability
from
external platforms decide whether to allow it
```

A normal link-preview and full-page playback fallback is mandatory.

## 5. What the feature must not become

### 5.1 Not a generic bookmark manager

LoveTree may ingest bookmarks, but it must not reorient the whole product around folders, productivity, tab management, or administrative organization.

A bookmark is source material for a Moment. It is not the final product unit.

### 5.2 Not a playlist clone

The product should not stop at copying a YouTube playlist into another linear list.

The differentiated value begins when the user can explain:

- why this was selected;
- why it belongs here;
- how it connects to another Moment;
- which exact segment matters;
- what emotional path the sequence expresses.

### 5.3 Not a video downloader or editor

The product does not download, cut, encode, export, or rehost YouTube video files for this capability.

It stores playback instructions, source identity, ordering, and user-authored meaning.

### 5.4 Not automatic semantic fabrication

Imported adjacency must not create fake emotional or narrative Connections.

The system may preserve source order, but a LoveTree Connection should exist only when:

- the user explicitly creates it;
- the user accepts a clearly presented suggestion;
- a separately approved rule preserves an existing meaningful relationship.

A playlist's item 2 following item 1 is playback order, not proof that item 1 emotionally caused item 2.

### 5.5 Not unrestricted iframe exposure

Normal authenticated application pages must remain protected from framing and clickjacking.

Only a dedicated public embed surface may receive scoped frame permission, and it must expose public-safe data only.

## 6. Domain interpretation

### 6.1 Collection to Tree

The initial import hypothesis is:

```text
external playlist or selected bookmark collection
→ one proposed LoveTree
```

The user must be able to review and adjust the proposed Tree title, visibility, and included items before persistence.

### 6.2 Item to Moment

The initial item mapping is:

```text
one playlist item, bookmark entry, or selected media segment
→ one proposed Moment
```

The imported source metadata is evidence and attribution. The Moment remains the LoveTree product unit.

### 6.3 Order to playback sequence

Source order should become deterministic playback/order metadata.

The exact storage field or entity must be decided by the LoveBud schema audit. The implementation must not introduce a second independently writable order model when current Tree/Memory ordering can be safely extended.

### 6.4 Connection to meaning

Connections represent the user's explanation of how Moments relate.

Examples:

- “이 무대를 보고 이전 인터뷰를 다시 찾아봤다.”
- “이 장면에서 처음 관심이 생겼고, 다음 영상에서 완전히 좋아하게 됐다.”
- “힘들 때 이 노래를 듣고, 이후 이 라이브가 특별해졌다.”

A Connection is therefore not merely `nextItemId`.

## 7. The intended user journey

### 7.1 First import

```text
user pastes a public YouTube playlist URL
→ LoveBud validates and previews the playlist
→ user selects items
→ user chooses a Tree title and visibility
→ LoveBud creates one Tree and ordered Moments safely
→ user can immediately play the sequence
```

### 7.2 Gradual LoveTree transformation

```text
imported ordered collection
→ user watches again
→ marks exact favorite intervals
→ adds emotions and notes
→ creates meaningful Connections
→ chooses representative Moments
→ the collection becomes a personal emotional Tree
```

### 7.3 External sharing

```text
user publishes an eligible Tree
→ shares a normal link or supported embed
→ viewer watches Moments continuously
→ viewer may open the full Tree
→ the Tree becomes both a record and a guided appreciation path
```

## 8. Why this belongs in LoveBud

The feature crosses backend, authentication, persistence, external providers, public sharing, and deployment.

LoveBud is the authority for:

- domain and schema decisions;
- import provenance and idempotency;
- Firebase authentication and authorization;
- same-origin API contracts;
- Cloudflare Pages Functions gateway;
- Modal backend processing;
- Neon persistence and transactions;
- provider secret handling;
- quota and abuse controls;
- public embed read boundaries;
- security headers and deployment;
- operational telemetry and failure states.

The active runtime boundary remains:

```text
browser
→ same-origin /api/*
→ Cloudflare Pages Functions
→ Modal
→ Neon
```

New backend work must not be placed in legacy Vercel or Netlify artifacts.

## 9. Relationship with `lovetree-limone`

`lovetree-limone` is the current UI and visual-experience exploration source.

It may prototype or implement, through an explicit LoveBud contract:

- import entry presentation;
- playlist preview and item selection;
- Tree Play Mode visuals;
- queue, minimap, and selected-Moment interaction;
- compact embed shell;
- responsive and accessibility behavior;
- visual integration with newer Tree designs.

It must not become a second production backend authority for this feature.

The integration rule is:

```text
LoveBud defines and operates backend/auth/data/deployment contracts
→ lovetree-limone consumes those contracts for UI experiences
```

This separation allows the newer UI work to continue without duplicating authentication, database, import, or deployment logic.

## 10. Relationship with existing LoveBud documents

### `PRODUCT_IDENTITY.md`

This feature must preserve the rule that LoveTree is not a cold storage or bookmark tool. Imported links become valuable only when they support emotional recall and connected appreciation.

### `MOMENT_TIMELINE_PLAN.md`

That document defines cue-based segment capture and sequence playback. This document adds bulk intake from existing collections and a broader continuous-view/share path.

### YouTube segment player PoC documents

Existing PoC scope, runtime notes, browser verification, and test matrix remain the evidence authority for segment-player feasibility. Playlist import must reuse proven player boundaries rather than reopening settled behavior without evidence.

### Publication and privacy policy

Imported source availability and LoveTree publication are separate concerns. A public YouTube video does not automatically make the user's Tree, note, or Moment public.

The current publication/privacy source of truth controls visibility and anonymous exposure.

## 11. Functional priority

The order of development should reflect uncertainty and risk.

### Phase 0 — Current-state audit and contract decision

No runtime implementation.

Determine:

- current Tree/Memory schema and ordering behavior;
- current source/provider/external-ID support;
- import provenance requirements;
- idempotency and transaction requirements;
- provider adapter boundary;
- current player/read-model reuse;
- public embed security requirements;
- exact LoveBud/Limone integration contract.

### Phase 1 — Public YouTube playlist read-only preview

The first implementation should only:

- accept a public playlist URL or ID;
- validate it server-side;
- retrieve normalized metadata;
- handle pagination and unavailable items;
- return a safe preview;
- perform no Tree or Moment write.

This isolates provider access, normalization, quota, URL validation, and preview UX before persistence risk is introduced.

### Phase 2 — Idempotent import write

After preview is accepted:

- create one Tree and selected ordered Moments transactionally;
- prevent duplicate retry creation;
- define intentional second-import behavior;
- confirm canonical reread;
- fail safely on partial errors.

### Phase 3 — Tree Play Mode

Use one active player and a normalized ordered queue.

### Phase 4 — Public share and embed surface

Add public-safe compact playback with strict framing and visibility rules.

### Phase 5 — Bookmark HTML import

Use explicit exported HTML upload. A normal website cannot silently read browser bookmarks.

### Phase 6 — Private playlist OAuth

Add only after public import proves useful. Firebase identity and Google YouTube authorization must remain distinct.

### Phase 7 — Browser extension

Consider only after base web ingestion demonstrates sustained value.

## 12. Product success criteria

The feature is successful when it improves more than import volume.

Useful product signals include:

- users complete a first Tree faster;
- imported Trees are replayed later;
- users enrich imported items with notes, emotions, intervals, or Connections;
- viewers continue from one Moment to the next without repeated scrolling;
- shared Trees lead viewers into the full appreciation experience;
- users perceive the result as a personal path, not a copied playlist;
- import reduces blank-state abandonment without weakening product identity.

Raw counts alone are insufficient. A high number of copied links with no later meaning or replay would indicate that the product is drifting toward generic storage.

## 13. UX principles

- Make the first import easy, but do not force every user to import.
- Show a preview before writing.
- Let users exclude unwanted items.
- Preserve source order without pretending it is emotional causality.
- Keep the imported state visually calm and understandable.
- Invite enrichment gradually rather than demanding notes for every item immediately.
- Keep one clear current Moment during playback.
- Avoid loading many active media players at once.
- Ensure unavailable items do not break the whole Tree.
- Maintain a warm appreciation experience rather than a technical queue manager.
- Make mobile viewing simple; allow deeper curation on desktop.

## 14. Security, privacy, and policy boundaries

The feature must fail closed around:

- authenticated import writes;
- ownership checks;
- private playlist authorization;
- provider tokens;
- SSRF and unsafe URL handling;
- public Tree and Moment visibility intersection;
- iframe framing scope;
- private notes and internal identifiers;
- source deletion or later unavailability;
- embed revocation after unpublish;
- provider API quota exhaustion;
- log redaction.

Do not place tokens, playlist titles, source URLs, user identifiers, private notes, or provider payloads in operational logs unless a separately approved privacy-safe contract explicitly permits a sanitized field.

## 15. Open product questions

The Phase 0 audit should answer or deliberately defer:

- Does one playlist always propose one Tree, or may users import into an existing Tree?
- How should duplicate videos inside one playlist be represented?
- How should the same video imported into several Trees behave?
- Should source order remain separate from user-curated playback order?
- When a user reorders Moments, should later synchronization preserve or replace that order?
- Is the first version one-time import only, with no synchronization?
- What metadata must be retained for attribution without over-collecting provider data?
- What happens when a source video becomes private, deleted, region-blocked, or non-embeddable?
- Should a public embed expose notes, short context, or only titles by default?
- Which external platforms are realistic first integration targets?
- Is oEmbed necessary initially, or is a documented iframe plus link card enough?
- How should a user turn an imported full-video Moment into one or more segment Moments?
- Should bookmark folders become proposed Trees, visual groups, or only import filters?

## 16. Decision rule

Proceed incrementally only when each phase strengthens the LoveTree experience.

The guiding rule is:

> The feature is not complete when links are imported. It is complete when imported material becomes easy to revisit, meaningful to the owner, and understandable as a connected path to another viewer.

## 17. Non-authorization statement

This document records product intent and sequencing. It does not authorize:

- schema mutation;
- provider account or OAuth configuration;
- secret creation;
- Production or Preview deployment;
- iframe policy changes;
- browser extension permissions;
- video download, clipping, encoding, or rehosting;
- a mixed cross-repository implementation PR;
- implementation directly under Issue #3897 without bounded child Issues.

Refs #3897.
Refs #362.
Refs #1882 — Keep OPEN.
