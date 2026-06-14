# LoveBud source record display and persistence boundary

Issue: #2481

## Decision

`순간의 출처` source records should remain **tree-scoped source records** until a later storage/API design explicitly promotes them.

The first durable product boundary is:

```text
Source recognition = frontend helper can identify source candidates
Source display = tree-scoped source area or source card
Source persistence = deferred until an explicit schema/API plan
Moment linkage = review-before-save only, deferred from the first display slice
```

This keeps channel/profile URLs product-native without forcing them into normal LoveTree moments or relationship edges.

## Display boundary

A source record may be shown as a tree-scoped `순간의 출처` item associated with the current LoveTree.

Preferred first display model:

```text
Current LoveTree
└─ 순간의 출처
   └─ @SomeChannel / YouTube 채널 / 아직 심은 순간이 없어요
```

The first display slice should not render source records as default canvas `.memory-node` cards. Source records are not moments. They should not affect canvas edge routing, moment order, branch controls, or selected moment emphasis.

## Persistence boundary

Do not add DB/API persistence until the product explicitly decides the storage shape.

Allowed before schema/API work:

- URL-derived source candidate recognition;
- source-specific confirmation copy;
- local placeholder copy or preview state;
- product docs and contract tests.

Not allowed before schema/API work:

- persisted source records;
- new DB tables or columns;
- API payload changes for saved source records;
- account-global source libraries;
- automatic source-to-moment linkage.

## Moment linkage boundary

A source record may eventually explain where a video-backed moment came from:

```text
이 영상은 @SomeChannel에서 온 순간이에요.
```

However, linkage must be review-before-save. A channel/profile URL must not silently create a moment, create a tree edge, rethread the tree, or connect existing moments.

## Relationship to current features

### Video moments

Normal YouTube video URLs remain video-backed moment candidates.

### Channel/profile URLs

YouTube channel/profile URLs remain source-record candidates.

### Canvas

Source records should not participate in canvas moment layout by default.

### Browse/Search

No Browse/Search or social-count behavior is part of this decision.

### Scout/provider

No Scout, live AI, provider, fetch, or feed behavior is part of this decision.

## Recommended next implementation slice

After this decision is merged, the next safe implementation issue may be:

```text
[UX] Preview tree-scoped source records after channel URL confirmation
```

Recommended initial scope:

- frontend-only preview or placeholder state;
- no persistence;
- no API calls;
- no feed import;
- no canvas `.memory-node` rendering;
- focused contracts around copy and non-moment behavior.

## Non-goals

- No DB/API schema changes.
- No runtime persistence implementation.
- No YouTube API calls.
- No channel page fetches.
- No feed/video list import.
- No automatic moment creation.
- No Scout/live/provider work.
- No Browse/Search or #1661 work.
- No rethread or arrange behavior work.
- No relationship graph or Obsidian-style link work.
- No #2465 closure or deployed editor verification.

## Closure criteria for #2481

#2481 can be closed when this product decision doc and its contract test are merged.
