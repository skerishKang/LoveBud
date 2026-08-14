# LoveTree Private YouTube → 5K Cross-Repository Acceptance Plan

**Issue:** #4031  
**Parent Epic:** #4024  
**Product parent:** #3897 — Keep OPEN  
**Platform authority:** #4004  
**Planning authorities:** #4025, #4026, #4027, #4028, #4029  
**UI architecture consumer:** `skerishKang/lovetree-limone#172`  
**AI track:** #4030 — non-blocking  
**Status:** Pre-implementation QA/acceptance authority. No Production bulk mutation authorized.  
**Baseline at creation:** LoveBud `ba7d470385f8bf21471cb8d5eeb9a4846df7232d`; `lovetree-limone` `5a96861f5bbbdf65fbadeab614d50fd300db69a7`.  
**Last updated:** 2026-08-14

---

## 1. Purpose

This is the single end-to-end acceptance checklist for the product flow:

```text
app account
→ connect YouTube account
→ discover private/account-owned playlist
→ choose playlist
→ asynchronous snapshot import
→ one private-first LoveTree
→ ordered Moments
→ large ordered read
→ new LoveTree editor/view
→ owner curation
→ publication preflight
→ explicit LoveTree publish
```

The original YouTube playlist remains unchanged.

This plan must be usable for three controlled scale gates:

```text
A = 300 Moments
B = 1,000 Moments
C = 5,000 Moments
```

---

## 2. Global PASS rule

A gate is PASS only when all required layers agree on the same canonical facts.

At minimum:

```text
expected source occurrence count
= enumerated occurrence count (or explicitly normalized provider outcome)
= terminal import item count
= canonical persisted Moment count for the imported snapshot
= canonical provenance occurrence count
= owner ordered-read covered count
```

Any unexplained mismatch is:

```text
HOLD / FAIL
```

not “mostly successful.”

No silent truncation.

---

## 3. Evidence safety

Evidence may record:

```text
repo + exact commit SHA
environment label
sanitized fixture label
scale gate
job state
counts
latency/payload/performance measurements
PASS / FAIL / HOLD / BLOCKED
```

Do not record in shared evidence:

- OAuth access/refresh token;
- authorization code;
- API/client secret;
- raw private playlist URL/ID/title;
- real user identity;
- private Moment memo/content;
- raw DB connection string;
- raw provider response body.

Use controlled synthetic/test playlists for load gates unless an explicit owner-controlled private fixture is approved and kept out of logs/screenshots.

---

## 4. Environment/provenance gate

Before any acceptance run record:

```text
LoveBud exact SHA
lovetree-limone exact SHA
shared API exact SHA/deployment ID
DB branch/environment
provider OAuth project/environment label
worker/executor version
feature scale gate
```

STOP if exact runtime provenance cannot be established.

Do not infer that Preview/Production uses the latest `main` merely because GitHub merged it.

---

## 5. Gate fixture design

Each scale fixture must contain deterministic occurrences sufficient to test:

- unique videos;
- at least one duplicate-video occurrence at a different source position;
- known source order;
- normal public embeddable items;
- if safely controllable, at least one unlisted test item for publication-review path;
- a simulated/controlled unavailable item path where provider policy allows safe testing;
- recognizable sentinels near beginning/middle/end;
- deterministic expected count.

Do not depend on third-party videos staying permanently available for core completeness tests. Use controlled fixtures or mocked provider contract tests for failure categories, and use live provider checks only where needed.

---

## 6. Authorization acceptance — #4025

### A1 — connection start

PASS:

- unauthenticated actor cannot start provider connection;
- authenticated actor gets one bounded authorization start response;
- state is high entropy, short-lived, server-bound;
- no application token/user ID/secret appears in OAuth URL.

### A2 — callback state

PASS:

- valid state accepted once;
- guessed state rejected;
- expired state rejected;
- replayed state rejected;
- callback binds provider connection to the actor captured at start;
- actor identity cannot be switched by callback query/body.

### A3 — scope

PASS:

```text
granted required scope includes youtube.readonly
write scopes requested = 0
```

### A4 — credential secrecy

PASS:

- OAuth client secret server-only;
- refresh token encrypted at rest;
- access/refresh token absent from normal API response/log/evidence;
- disconnect makes credential unusable.

### A5 — private playlist discovery

PASS:

- authorized account can list owned playlists, including a controlled private playlist;
- revoked/missing scope fails closed with reauthorization state;
- discovery pagination does not assume <= 50 playlists.

---

## 7. Domain/mapping acceptance — #4026

For fixture source positions:

```text
0 ... N-1
```

PASS:

- one returned source occurrence creates one Moment representation by default;
- duplicate video at positions X/Y creates two Moment occurrences;
- `videoId` is not the uniqueness authority;
- source occurrence provenance exists for each imported occurrence;
- original source position survives later user reorder;
- canonical `sort_order` is deterministic;
- playlist adjacency creates semantic Connections = 0;
- unavailable/partial occurrence follows explicit state policy rather than disappearing silently.

### Mapping proof

For beginning/middle/end sentinels verify:

```text
source occurrence
→ provenance record
→ canonical Moment ID
→ canonical sort_order
```

without exposing raw private provider IDs in published evidence.

---

## 8. Async job acceptance — #4027

### J1 — acceptance truth

Submit returns quickly with:

```text
202 / queued
```

and does not claim completion.

### J2 — request idempotency

Same key + same request:

```text
same job
same target Tree
no duplicate Moments
```

Same key + different request:

```text
explicit conflict
```

### J3 — item replay

Replay one provider page/chunk.

PASS:

```text
additional duplicate Moments = 0
```

### J4 — executor crash after commit

Force/simulate executor interruption after a committed chunk but before the next checkpoint/operation.

PASS:

- resumed job does not duplicate committed occurrences;
- final count/order exact.

### J5 — executor crash before commit

PASS:

- uncommitted chunk can retry;
- final count/order exact;
- no orphaned half-provenance.

### J6 — cancellation

PASS:

- cancel request becomes durable;
- executor stops at bounded safe boundary;
- partial Tree remains private/staged;
- no public/Browse eligibility;
- status is cancelled, not completed.

### J7 — auth expiry/revocation

PASS:

- expiring access token refreshes through authority;
- revoked refresh credential does not retry forever;
- job becomes truthful failed/partial/reauth-required state.

### J8 — counter reconciliation

PASS:

```text
processed = succeeded + failed
```

and provider enumeration reaches a terminal end condition.

Unexplained provider-count discrepancy cannot be `completed`.

---

## 9. Ordered read acceptance — #4028

### R1 — shell

PASS:

- owner shell count equals canonical owner-visible count;
- public shell count equals public projection only;
- sequence version present.

### R2 — full traversal by windows

Using default/max bounded windows, concatenate the complete sequence.

PASS:

```text
total returned unique Moment IDs = expected count
duplicates = 0
gaps = 0
order violations = 0
final cursor/end state truthful
```

### R3 — direct jump

Jump to sentinel positions near:

```text
1
N/2
N-1
```

PASS:

- correct order neighborhood returned;
- no deep OFFSET dependency required by contract.

### R4 — stale cursor

Fetch cursor, then reorder/insert/delete.

PASS:

```text
old cursor → TREE_SEQUENCE_CHANGED / explicit conflict
```

not a silently mixed sequence.

### R5 — privacy

Public windows expose:

```text
private playlist provenance = 0
unauthorized private Moment data = 0
```

---

## 10. Large UI acceptance — `lovetree-limone#172`

The Tree may contain 5K Moments while mounted heavy UI remains bounded.

At each scale record:

```text
time to usable shell
initial network bytes
window fetch bytes
mounted full-detail Moment/card count
active iframe/player count
memory trend
selection latency
direct-jump latency
scroll/pan/zoom responsiveness where applicable
console/page errors
```

### Required viewport matrix

```text
1280×800
390×844
320×720 where the view claims support
```

### Functional PASS

- first usable UI does not wait for all 5K full Moment objects;
- search/direct jump reaches deep Moment positions;
- selection survives window eviction/remount;
- only selected/authorized media becomes active according to media authority;
- no 5K simultaneous iframe/video decode requirement;
- semantic zoom changes information density/meaning where used;
- canonical Connections and derived clusters remain distinct;
- keyboard/focus alternative exists for canvas/graph-only interactions;
- reduced motion supported;
- horizontal overflow 0;
- console/page errors 0.

### Performance threshold process

Do not invent universal FPS/latency numbers without baseline hardware/network context.

Before Gate A implementation is marked complete, #172 must freeze a controlled benchmark profile and numeric budgets for:

```text
usable shell
selection/jump latency
heavy mounted surfaces
memory ceiling/trend
network window size
```

Gate B/C must meet those frozen budgets or receive an explicit reviewed budget revision with evidence.

---

## 11. Publication acceptance — #4029

### P1 — source playlist unchanged

Record before/after provider privacy state for the controlled source.

PASS:

```text
source playlist visibility mutation by LoveBud = 0
```

### P2 — private-first

PASS:

```text
import completed
AND
Tree still not public until explicit publish
```

### P3 — media classification

Controlled category contract tests cover:

- public + embeddable;
- public + non-embeddable;
- unlisted;
- private/unavailable;
- unknown/provider failure.

### P4 — unlisted

PASS:

- public publication requires explicit owner review/decision;
- client cannot silently mark it approved without server decision state.

### P5 — private/unavailable

PASS:

- public-playable claim = 0;
- private-only provider metadata absent from public projection.

### P6 — stale preflight

Preflight → mutate Tree sequence → publish.

PASS:

```text
stale preflight rejected
```

### P7 — final public reread

After controlled publish:

- public shell/window counts reflect only public projection;
- private source playlist identity absent;
- owner private snapshot remains intact.

---

## 12. AI non-blocking acceptance — #4030

The import E2E gate does **not** require AI.

PASS is valid with:

```text
AI enrichment jobs = 0
AI candidate Connections = 0
```

If AI is enabled in a later test:

- suggested relationship styling/state differs from canonical Connection;
- AI candidate does not mutate `sort_order`;
- AI candidate does not publish content;
- rejected/dismissed candidate does not become canonical;
- accepted user action is the canonical transition.

---

## 13. Gate A — 300 Moments

Required before 300 becomes an enabled product ceiling:

- authorization matrix PASS;
- exact mapping/order/provenance PASS;
- idempotent async job PASS;
- crash/restart/cancel PASS;
- complete ordered read PASS;
- desktop/mobile large UI baseline budgets frozen and PASS;
- publication privacy matrix PASS;
- cleanup/retry behavior PASS.

A 300 PASS is architecture proof, not evidence that 5K is safe.

---

## 14. Gate B — 1,000 Moments

Everything from Gate A plus:

- >= 20 provider pages where fixture/provider layout supports it, or equivalent pagination stress;
- bounded executor memory verified;
- multiple restart/checkpoint boundaries;
- full window traversal exact;
- deep jump/search proven beyond first several windows;
- #160/#172 semantic-zoom/large-view behavior measured;
- no material UI regression against frozen budgets;
- preflight batching proven without one-provider-call-per-Moment.

---

## 15. Gate C — 5,000 Moments

Everything from A/B plus:

- complete ~100-page provider enumeration path or provider-equivalent controlled simulation;
- full canonical count/order/provenance reconciliation;
- executor survives process loss/reclaim at scale;
- retry/cancel remains bounded;
- no single HTTP request or DB transaction spans the entire import;
- ordered read traverses all 5K with no gap/duplicate;
- deep jump near 4,999 works;
- editor does not mount 5K heavyweight surfaces;
- publication preflight uses batched unique-media checks;
- final public/private projections remain leak-safe;
- operational quota/resource estimates recorded;
- rollback/feature-disable switch documented.

Gate C Production enablement requires an explicit release decision after evidence review.

---

## 16. Cleanup after test runs

Controlled fixture cleanup must be explicit.

Record:

- job state before cleanup;
- target Tree fixture label;
- whether test used isolated DB branch/Preview;
- deletion/cleanup action;
- post-cleanup count or environment reset evidence.

No real user private playlist/data cleanup should be performed through ad hoc SQL.

Production cleanup requires normal product/admin authority and explicit approval.

---

## 17. Failure classification

Use:

```text
PASS
FAIL
HOLD
BLOCKED
```

Examples:

- functional defect → FAIL;
- implementation not yet available → BLOCKED;
- provider/environment prevents a required live proof while contracts pass → HOLD;
- exact evidence complete → PASS.

Do not convert HOLD/BLOCKED into PASS because adjacent tests succeeded.

---

## 18. Cross-repository release checklist

Before any scale-ceiling increase:

- [ ] LoveBud exact implementation PR(s) merged and exact current main known
- [ ] `lovetree-limone` exact UI implementation PR(s) merged and exact current main known
- [ ] shared API deployment exact revision known
- [ ] DB migration exact revision/branch known
- [ ] OAuth configuration environment verified without exposing secrets
- [ ] controlled fixture created
- [ ] backend gate PASS
- [ ] UI gate PASS
- [ ] publication/privacy gate PASS
- [ ] cleanup PASS
- [ ] rollback/disable path known
- [ ] owner/CTO release decision recorded

---

## 19. Stop conditions

STOP immediately when:

- exact deployed revision unknown;
- counts disagree;
- an API silently caps/truncates;
- provider-page replay duplicates Moments;
- source position/order cannot be reconciled;
- actor boundary fails;
- token/private source data appears in logs;
- incomplete Tree becomes public/searchable;
- public read leaks private playlist provenance;
- 5K UI requires 5K heavyweight media surfaces;
- publication can bypass current server preflight;
- Production mutation is needed without explicit approval.

---

## 20. Planning verdict

```text
CROSS_REPO_E2E_PLAN = DEFINED
SCALE_GATES = 300 → 1000 → 5000
COUNT_ORDER_IDEMPOTENCY = HARD GATES
PRIVATE_SOURCE_VISIBILITY_MUTATION = ZERO
IMPORT_TO_PUBLIC_AUTOMATION = ZERO
AI_REQUIRED_FOR_IMPORT = NO
PRODUCTION_5K_TEST_WITHOUT_APPROVAL = PROHIBITED
IMPLEMENTATION = NOT_YET PERFORMED
```
