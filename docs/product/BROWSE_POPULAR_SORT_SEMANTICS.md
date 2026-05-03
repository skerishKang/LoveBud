# Browse Popular Sort Semantics

**Status:** Active product/API semantics note  
**Owner:** CTO / Product + Backend  
**Related issue:** #608

This document defines the current meaning and risk of the Browse `popular` sort option.

The important conclusion is that the current backend implementation does not measure popularity in the engagement sense. It sorts public Browse-eligible trees by public memory count, then by creation time. This is a useful completeness/activity proxy, but it is not yet a true popularity signal.

---

## 1. Current implementation finding

The public Browse route accepts `sort=popular` as an allowed value and passes it to the Modal public-read helper.

Current Modal route behavior:

```text
if sort is latest or popular:
  pass through
else:
  fallback to latest
```

Current public-read behavior:

```text
latest:
  ORDER BY tree.created_at DESC

popular:
  ORDER BY public_memory_count DESC, tree.created_at DESC
```

The query only includes public trees with at least three public memories. Therefore `popular` currently means:

```text
public Browse-eligible trees with more public memories first,
then newer trees first when public memory count ties.
```

---

## 2. Product interpretation

The current behavior should not be described as real popularity unless the product explicitly accepts memory count as the public definition of popularity.

Memory count may correlate with richer or more complete trees, but it does not prove:

- views;
- opens;
- likes/reactions;
- comments;
- shares;
- copy/import count;
- recent engagement;
- editorial curation;
- user retention or dwell time.

A user who sees `인기순` can reasonably assume other users made the tree popular. The current implementation does not have that evidence.

---

## 3. Recommended v0.1 decision

For v0.1, LoveBud should avoid overclaiming popularity.

Recommended decision:

```text
Do not present memory-count ordering as “인기순” unless UI copy or help text clearly defines it.
Prefer renaming to an honest proxy label such as “기록 많은 순” or “풍성한 순,” or hide/disable “인기순” until engagement signals exist.
```

The exact copy should be decided in a later UI/copy PR because this document is not a UI implementation PR.

---

## 4. Acceptable product states

### Option A — Rename the sort

Use a label that matches current behavior.

Candidate Korean labels:

```text
기록 많은 순
순간 많은 순
풍성한 순
```

Pros:
- honest about current implementation;
- no backend work required;
- keeps useful ordering.

Cons:
- less emotionally familiar than `인기순`;
- needs copy and screenshot verification.

### Option B — Keep `인기순` with explicit definition

Keep the label but define it in UI/help text as memory-count based.

Pros:
- smallest visible change if the team prefers current wording;
- keeps sort recognizable.

Cons:
- still risks misleading users;
- “popular” normally implies engagement from other people.

### Option C — Hide or disable popular sort

Remove or disable the visible popular option until real engagement signals exist.

Pros:
- avoids misleading ranking;
- preserves product trust.

Cons:
- removes a discoverability control;
- later reintroduction requires UI regression review.

### Option D — Implement real popularity later

Define a true score based on engagement signals.

Possible future signals:

```text
view/open count
copy/import count
share-link copy count
likes/reactions
comments
recent engagement window
editorial/curation score
```

This requires data-model, event tracking, privacy, abuse, and ranking policy work. It is out of scope for this semantics note.

---

## 5. Engineering contract

Until a real popularity score is implemented, backend and frontend work should treat current `sort=popular` as a proxy sort.

Current backend contract:

```text
sort=latest  => created_at DESC
sort=popular => public_memory_count DESC, created_at DESC
invalid sort => latest fallback
eligibility  => public tree + at least 3 public memories
```

Do not change this behavior casually. If a PR changes the backend sort formula, it must update this document or a successor semantics document.

---

## 6. Verification requirements for future implementation PRs

If a future PR changes the visible sort label, available sort options, or backend popular formula, verify:

```text
latest ordering: PASS/FAIL/NOT_VERIFIED
popular/proxy ordering: PASS/FAIL/NOT_VERIFIED
invalid sort fallback: PASS/FAIL/NOT_VERIFIED
Browse eligibility threshold remains public_memory_count >= 3: PASS/FAIL/NOT_VERIFIED
search/filter interaction with sort: PASS/FAIL/NOT_VERIFIED
URL state or selected sort state, if applicable: PASS/FAIL/NOT_VERIFIED
desktop Browse smoke: PASS/FAIL/NOT_VERIFIED
mobile 375px Browse smoke: PASS/FAIL/NOT_VERIFIED
private payload exposure: NO
secret exposure: NO
```

Runtime-sensitive UI changes require Cloudflare Preview or fixed test slot verification with deployed SHA confirmation.

---

## 7. Non-goals for this document

This document does not:

- rename the Browse UI label;
- change frontend sort controls;
- change Modal SQL;
- add engagement tracking;
- add analytics tables;
- change Browse card layout;
- change Search/Browse visual behavior;
- close #608 by itself.

---

## 8. Closure criteria for #608

Issue #608 can move toward closure when one of these decisions is implemented or explicitly accepted:

1. the visible label is renamed to match the current memory-count proxy;
2. `인기순` is hidden/disabled until real popularity exists;
3. the product explicitly accepts memory-count as the v0.1 definition and documents it in user-facing copy;
4. a real engagement-based popularity score is implemented and verified.

This document establishes the current semantics and recommended direction. It does not complete the UI/product decision by itself.
