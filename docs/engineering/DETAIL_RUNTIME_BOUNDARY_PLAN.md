# Detail Runtime Boundary Plan

**Status:** Active staged-refactor boundary  
**Owner:** CTO / Engineering Lead  
**Related issue:** #661  
**Depends on:** #656 large-file audit

This document defines the staged boundary plan for reducing `js/detail.js` responsibility without changing Detail page behavior.

The Detail page is runtime-sensitive because it combines route parsing, API loading, public/private visibility expectations, media rendering, connected moments, loading/error states, and user-facing actions. Refactor PRs must preserve behavior and must not treat static checks as final proof.

---

## 1. Boundary principle

The first Detail refactor PRs should extract one responsibility at a time while preserving the classic browser script contract used by the current page.

Do not combine fetch orchestration, render markup changes, route behavior, action handling, loading/error states, and media behavior in one PR. A safe split leaves the page entrypoint responsible for orchestration while moving isolated helpers behind browser-global or page-local boundaries.

---

## 2. Responsibility buckets

| Bucket | Examples | First safe action |
| --- | --- | --- |
| Route/input parsing | URL parameters, selected memory/tree target | Document and test before changing |
| Data loading | current memory, tree context, connected moments | Extract only after response assumptions are known |
| Render helpers | title, memo, media, connected moments, metadata | Extract one render area at a time |
| Media rendering | YouTube/source embed, thumbnail fallback | Do not mix with data-loading changes |
| Loading state | skeleton, placeholder, staged load messaging | Keep behavior equivalent unless issue explicitly targets loading UX |
| Error/degraded state | missing memory, API failure, media failure | Extract mapping only after current behavior is documented |
| Action handlers | copy/share/open/edit-related actions | Extract separately from data/render helpers |
| Cache/state bridge | cached tree/memory handoff | Preserve key names and fallback order |

---

## 3. Preserved contracts

These must remain equivalent unless a separate approved PR changes product behavior:

```text
route parameter contract
API endpoint usage
response field assumptions
current memory render behavior
tree context render behavior
connected moments render behavior
media/thumbnail fallback behavior
loading and error state availability
action button wiring
back/navigation behavior
public/private field exposure
console fatal error posture
```

Reports must not include tree IDs, memory IDs, owner IDs, copied tree IDs, raw API payloads, DB rows, tokens, sessions, cookies, credentials, passwords, private keys, or DB URLs.

Use safe status labels only:

```text
ROUTE_TARGET_PRESENT: YES/NO
MEMORY_DATA_LOADED: PRESENT/MISSING
TREE_CONTEXT_LOADED: PRESENT/MISSING
CONNECTED_MOMENTS_LOADED: PRESENT/MISSING
MEDIA_RENDERED: PASS/FAIL/NOT_VERIFIED
ACTION_WIRED: PASS/FAIL/NOT_VERIFIED
PRIVATE_PAYLOAD_EXPOSURE: NO/YES
```

---

## 4. Recommended implementation sequence

### PR A — Detail runtime inventory or contract tests

Goal:
- Record current route inputs, API calls, render areas, actions, and safe observations.

Allowed:
- docs-only inventory or focused contract tests;
- no behavior change.

### PR B — loading/error helper extraction

Allowed:
- extract loading/error state helpers if they are pure and behavior-equivalent;
- preserve visible copy and timing unless a separate issue targets loading UX.

Forbidden:
- no API endpoint changes;
- no route parsing changes;
- no media/render redesign.

### PR C — data loading helper extraction

Allowed:
- extract current memory/tree/connected-moment loading helpers;
- preserve fallback and error behavior.

Forbidden:
- no response-shape change;
- no Auth/API behavior change;
- no cache key change.

### PR D — render helper extraction

Allowed:
- extract one render area at a time, such as current memory metadata or connected moments;
- preserve markup semantics and user-facing content.

Forbidden:
- no broad page redesign;
- no visual hierarchy change unless a separate issue authorizes it.

### PR E — action handler extraction

Allowed:
- extract copy/share/open action binding into focused helpers;
- preserve click behavior and failure states.

Forbidden:
- no new social/share feature implementation;
- no Browse/Search/My Trees/Editor coupling.

---

## 5. Forbidden combinations

Do not combine Detail runtime boundary work with:

- Editor refactors;
- Search/Browse card or hub changes;
- My Trees changes;
- Auth provider/session changes;
- backend/API contract changes;
- package/workflow changes;
- PR #7 or prototype/reference/demo/variant changes;
- broad visual redesign;
- full read-only viewer implementation.

---

## 6. Detail runtime contract gate

Every implementation PR touching `js/detail.js` should include this matrix:

```text
[Detail Runtime Contract Gate]
Route/input parsing changed: YES/NO
API endpoint usage changed: YES/NO
Response shape assumptions changed: YES/NO
Render markup changed: YES/NO
Media behavior changed: YES/NO
Loading/error behavior changed: YES/NO
Action wiring changed: YES/NO
Cache/state key changed: YES/NO
Browser smoke: PASS/PARTIAL/BLOCKED/NOT_RUN
Console fatal errors: NONE/PRESENT/NOT_RUN
Network fatal errors: NONE/PRESENT/NOT_RUN
Private payload exposure: NO
Secret exposure: NO
Final judgment: PASS/PARTIAL/BLOCKED/FAIL
```

If any behavior changes intentionally, the PR is not a behavior-equivalent refactor and must be rescoped or tied to the relevant product/bug issue.

---

## 7. Required verification

Static checks:

```text
git diff --check
node --check changed JS files
npm test
npm run verify
```

Runtime checks for implementation PRs:

```text
Detail route opens: PASS/FAIL
Route target resolves safely: PASS/FAIL
Current memory state renders: PASS/FAIL
Tree context renders or degrades safely: PASS/FAIL
Connected moments render or degrade safely: PASS/FAIL
Media/thumbnail render or degrade safely: PASS/FAIL
Action buttons remain wired: PASS/FAIL/NOT_APPLICABLE
Back/navigation behavior remains usable: PASS/FAIL
Desktop smoke: PASS/FAIL
Mobile 375px smoke: PASS/FAIL
Console fatal errors: NONE/PRESENT
Network fatal errors: NONE/PRESENT
Private payload exposure: NO
Secret exposure: NO
```

Runtime-sensitive Detail work requires a valid Cloudflare Preview or fixed test slot with deployed SHA confirmation. Local-only PASS is not sufficient.

---

## 8. Batch verification handling

Docs-only boundary PRs may be accumulated in a batch. Runtime code PRs may also be drafted in a batch only if they are independent and not high-risk. Detail runtime PRs that affect loading, media, route parsing, or action behavior should usually be verified immediately or grouped only with non-overlapping Detail PRs.

Use this status language for draft runtime PRs awaiting verification:

```text
Status: DRAFT_IMPLEMENTED / DETAIL_RUNTIME_VERIFICATION_NOT_STARTED
Static checks: PASS or NOT_RUN
Browser verification: NOT_STARTED
Merge candidate: NO
```

---

## 9. First implementation recommendation

The safest first code PR after this boundary note is one of:

1. Add a Detail runtime inventory/contract test that records script dependencies and key globals.
2. Extract pure loading/error state helpers without changing copy or behavior.
3. Extract one small render helper after documenting expected input and output.

Do not start with route changes, API behavior, or media embed behavior.

---

## 10. Closure criteria for #661

Issue #661 should remain open until one or more narrow implementation PRs reduce `js/detail.js` responsibility while preserving behavior and recording required static plus runtime validation evidence.

A docs-only boundary PR can make implementation safer, but it does not complete the refactor by itself.
