# LoveBud channel records as sources for future moments

Issue: #2467

## Decision

YouTube channel/profile URLs should be modeled as **source records for future moments**, not as normal video-backed moments.

A channel record means:

```text
I found a channel I care about.
I want to remember it as a source where future LoveTree moments may come from.
```

A normal moment means:

```text
I watched this specific video and want to save the feeling as a moment.
```

## Product vocabulary

Use the Korean product frame `순간의 출처` for channel/profile URLs.

Preferred copy:

- `이 채널을 순간의 출처로 기록할까요?`
- `채널 기록하기`
- `순간의 출처로 저장하기`
- `이 채널에서 기억하고 싶은 영상을 순간으로 심어보세요.`

Avoid copy that treats a channel itself as a normal moment.

## Conceptual model

```text
Moment = a specific emotionally meaningful item the user saved
Channel source record = a remembered source/place where future moments may come from
LoveTree = the user's emotional arrangement of moments
```

A channel source record may later help explain that a video moment came from a remembered source:

```text
이 영상은 @SomeChannel에서 온 순간이에요.
```

The channel source record must not replace the LoveTree path or silently create edges between moments.

## First product placement decision

The first implementation slice should be **tree-scoped source records**, not global accounts and not canvas moment cards by default.

Initial placement:

- show channel records in a `순간의 출처` source area connected to the current LoveTree;
- do not render them as normal `.memory-node` moment cards by default;
- allow future UX to link specific video moments back to a channel source;
- keep multi-tree/global channel reuse as a later product question.

## URL patterns

The source recognizer may classify these URL shapes as YouTube channel/profile source URLs:

```text
https://www.youtube.com/@SomeChannel
https://www.youtube.com/channel/UC...
https://www.youtube.com/c/SomeChannel
https://www.youtube.com/user/SomeChannel
```

A normal video URL remains a video-backed moment candidate, not a channel source record:

```text
https://www.youtube.com/watch?v=...
https://youtu.be/...
https://www.youtube.com/shorts/...
```

## Safe fallback metadata

A frontend-only first slice may derive only safe metadata from the URL string itself.

Allowed fallback fields:

```text
sourceType = channel
sourceUrl = original normalized URL
sourceHandle = @handle or path-derived fallback when present
sourceTitle = sourceHandle fallback only, unless user edits it manually
```

First-slice prohibitions:

- no YouTube API calls;
- no channel feed reads;
- no video list imports;
- no automatic moment creation;
- no Scout/live/provider work;
- no DB/API schema changes;
- no Browse/Search changes;
- no #1661 work.

## Confirmation flow

When a recognized channel/profile URL is pasted, LoveBud should show a source-specific confirmation instead of a normal video-moment confirmation:

```text
이 채널을 순간의 출처로 기록할까요?

이 채널은 앞으로 러브트리에 심을 순간들이 나오는 곳으로 남겨둘 수 있어요.

[채널 기록하기] [취소]
```

If the user confirms, the product may create a placeholder source record. If the user cancels, no source record or moment should be created.

## Recommended implementation follow-up

Open a separate implementation issue after this decision is accepted:

```text
[UX] Support YouTube channel URLs as source records
```

Recommended implementation branch:

```bash
ux/youtube-channel-source-records
```

The implementation should start with a narrow frontend recognizer/confirmation slice and focused contracts. It should not introduce feed, provider, or persistence behavior until the storage model is explicitly designed.

## Closure criteria for #2467

#2467 can be closed when this product decision doc and its contract test are merged, because the issue accepts a documented product decision as one valid closure path.
