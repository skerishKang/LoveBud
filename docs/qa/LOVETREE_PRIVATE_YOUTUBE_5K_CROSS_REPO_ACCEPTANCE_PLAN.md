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
**Current reconciliation baseline:** LoveBud `main` `e282f610261d2562af51ce7da1506fbe3faa3c90`; `lovetree-limone` `21a39929ba6b6997ce3ad90f51c0ec0bf8f099f5`; `lovetree-limone#172` OPEN.
**Last updated:** 2026-08-16
**Blocker corrections applied:** Web CTO reviews `4943690923` (publication stale-preflight matrix), async lease-takeover, ordered-read projection consistency, OAuth reconnect, source-mutation-during-enumeration, follow-up `5301906011` (Model B publication visibility lifecycle), and #4034 review (provider credential generation × async job — J11/CG1–CG14).

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

**Cross-repository boundary:** LoveBud owns the canonical backend/data/auth/import/read/publication authority. LoveTree (`lovetree-limone`) is the consumer/UI/native product surface. #4031 does not make LoveTree a second canonical backend. Cross-repo QA validates exactly: LoveBud canonical truth → API/read contract → LoveTree consumer → visible UI behavior.

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
- raw provider account identifier;
- private Moment memo/content;
- raw DB connection string;
- raw provider response body;
- OAuth/refresh token, authorization code, API/client secret, cookie/session secret, secret bindings.

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

### A6 — reconnect / credential lifecycle (per #4032 reconnect convergence authority)

The connection authority stays singular and usable across reconnect/re-consent. PASS requires:

```text
A6a same actor + same canonical YouTube identity reconnects
    => exactly one active provider connection authority
A6b reconnect token response omits refresh_token
    => existing usable encrypted refresh credential is preserved; connection remains usable
A6c reconnect returns a new refresh_token
    => credential rotates atomically; credential_generation advances; superseded credential unusable
A6d duplicate / replayed / concurrent reconnect
    => duplicate active connection authorities = 0
A6e disconnect / revoke after reconnect
    => current + superseded credential authority for that canonical connection unusable
A6f queued/processing import bound to superseded credential generation
    => explicit current-generation resolution/rebind OR bounded fail/requeue;
       silent continuation on a stale credential generation = FORBIDDEN
```

Evidence proves canonical provider identity/connection convergence and credential-generation fencing with sanitized generation/result/category only — never raw provider account identifiers, tokens, or credential ciphertext.

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

### J9 — stale executor after lease takeover (per #4034 fencing authority)

```text
A claims generation N and begins processing
→ A is paused past lease expiry
→ B claims generation N+1
→ B performs authoritative progress
→ A resumes and attempts: item outcome / checkpoint / counter / lease renew /
  cancellation acknowledgement / terminal status mutation with generation N
```

PASS:

- A authoritative mutations = 0;
- A cannot renew or reclaim generation N;
- B remains sole authoritative writer for N+1;
- checkpoint/counter reflect only committed canonical outcomes;
- terminal/cancel state cannot be overwritten by A;
- final canonical occurrence count/order exact.

### J10 — positive fencing control

An active current-generation lease holder renews and advances normally (item progress, checkpoint, counter, renewal) with zero interference. This proves the fence rejects stale writers without blocking the current one.

Fencing requirement: every authoritative mutation checks the current server/database-controlled fencing generation/epoch inside the same authoritative transaction — a lease owner token plus expiry alone is NOT sufficient fencing.

### J11 — provider credential generation × async job acceptance (per #4034/#4025 credential-generation authority)

Provider credential generation is INDEPENDENT of executor fencing:

```text
executor_fence_epoch            !=  provider_credential_generation
(protects job-writer ownership)      (protects provider-credential authority)
```

A long-running import job must record the provider connection authority + provider credential generation under which it was admitted. Before resume, executor takeover, or provider-authorized work, the server must re-validate that admitted generation against the current canonical provider connection. Both authorities fail closed independently.

Two-authority matrix:

```text
executor current + credential current → provider work may proceed
executor current + credential stale  → provider work forbidden until server-validated rebind or bounded fail/requeue
executor stale  + credential current → authoritative job writes = 0
executor stale  + credential stale  → both fail closed
```

Deterministic acceptance cases:

```text
CG1  Admission binding — server resolves actor → canonical provider connection → current verified credential
     generation at job admission. Job carries admitted generation as authority metadata. Browser cannot mint a
     generation; arbitrary client generation is not authority. JOB_PROVIDER_GENERATION_BINDING = REQUIRED.
CG2  Current executor + current credential (fence E, generation N) → provider work may proceed.
CG3  Current executor + stale credential (fence E current, admitted N, canonical N+1)
     → provider requests using stale N = 0; server-side validation/rebind or bounded stop/fail/requeue first.
     CURRENT_EXECUTOR_DOES_NOT_AUTHORIZE_STALE_PROVIDER_CREDENTIAL.
CG4  Stale executor + current credential (fence stale E, generation current N+1)
     → authoritative job mutation = 0. CURRENT_PROVIDER_CREDENTIAL_DOES_NOT_AUTHORIZE_STALE_EXECUTOR.
CG5  Same-identity rotation — job admitted N, same canonical YouTube identity reconnects, new refresh token,
     credential rotates N → N+1. PASS: generation N credential use after rotation = 0; server validates same
     actor, same provider, same canonical identity, active canonical connection, exact current generation, then
     race-safe rebind N → N+1 allowed. No browser-supplied rebind.
CG6  Concurrent rotation during rebind — canonical N → N+1 while job tries rebind, then canonical becomes N+2.
     PASS: job must NOT settle on stale N+1. Compare-and-set / transaction / equivalent server-authoritative
     current-generation verification required. REBIND_TO_NONCURRENT_GENERATION = FORBIDDEN.
CG7  Reconnect without new refresh_token — existing usable credential generation N preserved. PASS: reconnect
     metadata update alone does not automatically stale the job; job may remain on N after bounded validation;
     generation need not advance merely because reconnect happened.
     connection metadata revision != credential rotation generation.
CG8  Disconnect/revoke — canonical provider connection revoked/disconnected after admission at N. PASS:
     provider calls after revocation = 0; automatic generation rebind = FORBIDDEN; job becomes truthful bounded
     failure/requeue/reauth-required; new OAuth authority required before provider work resumes.
     disconnect/revoke != "find latest generation and keep going".
CG9  Provider identity change — admitted under canonical identity X, current connection resolves to Y. PASS:
     CROSS_IDENTITY_SILENT_REBIND = FORBIDDEN; job stops/fails/requeues or requires explicit new import authority.
CG10 Executor takeover after credential rotation — worker A fence E1 + generation N; rotation N → N+1; A pauses;
     lease expires; worker B claims fence E2. PASS: B validates BOTH executor E2 current AND credential N stale,
     then server-validated rebind N → N+1 OR bounded fail/requeue before provider work. B cannot reason
     "I own fence E2, therefore stale generation N is usable".
CG11 Stale executor resumes after takeover (CG10 aftermath) — A resumes with stale E1 even knowing current N+1.
     PASS: authoritative mutation = 0. STALE_EXECUTOR + CURRENT_CREDENTIAL = ZERO AUTHORITATIVE JOB WRITE.
CG12 Normal access-token refresh — short-lived access token expires, same canonical refresh credential authority
     remains generation N. PASS: normal access-token refresh does NOT necessarily increment provider credential
     generation. ACCESS_TOKEN_INSTANCE != CANONICAL_PROVIDER_CREDENTIAL_GENERATION (otherwise a long-running 5K
     import would spuriously invalidate itself).
CG13 Credential rebind during source enumeration — pages 1–40 processed under N, rotation N → N+1, valid rebind,
     pages 41–100 continue. PASS: credential rebind does NOT prove source snapshot unchanged; S1/S2/S3 rules
     still apply; membership + order + count terminal revalidation remains mandatory.
     CREDENTIAL_REBIND != SOURCE_SNAPSHOT_VERSION_PROOF.
CG14 Queued job stale before first worker starts — admitted under N, rotation N → N+1 before worker starts. PASS:
     first provider call under stale N = 0; worker validates/rebinds or fails before provider use.
```

---

## 9. Source snapshot coherence acceptance — #4027

Provider `nextPageToken` / `pageToken` is pagination continuity, NOT snapshot isolation. PASS requires a controlled future scenario where the source mutates mid-enumeration:

```text
start multi-page enumeration
→ at least one page durably processed
→ controlled source mutation
S1 remove one occurrence + insert another (total count unchanged)
S2 same membership + reorder occurrences (total count unchanged)
S3 page token invalid / restart-from-beginning
```

PASS for each case:

- mixed source generations NEVER report `completed`;
- total-count equality alone cannot prove completeness;
- membership coherence revalidated (canonical occurrence set matches the selected #4027 snapshot contract);
- source-order coherence revalidated;
- count coherence revalidated;
- occurrence/order fingerprint or equivalent authority validated per #4027;
- implementation either performs a bounded clean restart/reconciliation OR returns truthful `partial_failed` / `failed` (`source_changed`);
- abandoned-version occurrences do not silently remain in the final snapshot;
- retained occurrences duplicated = 0 after restart/retry;
- page-token restart + item idempotency alone is NOT snapshot proof.

Evidence records only sanitized counts / fingerprints / categories / generation ids — never raw private playlist IDs, titles, or content.

---

## 10. Ordered read acceptance — #4028

Three distinct semantic authorities (per #4035/#4036 current authority):

```text
moment_sequence_version    = STRUCTURAL SEQUENCE REVISION      — ordered canonical set/order binding
public_projection_revision = PUBLIC ORDERED-READ PROJECTION MEMBERSHIP REVISION
publication_revision       = PUBLICATION PREFLIGHT/PUBLISH FRESHNESS — #4029 acceptance only
```

They are distinct:

```text
moment_sequence_version != public_projection_revision != publication_revision
```

`!=` means distinct semantic responsibility; physical storage architecture remains a future implementation decision. `public_projection_revision` is NEVER a publication authorization token, and `moment_sequence_version` alone is NEVER publication freshness.

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

### R4 — structural stale cursor

Fetch cursor, then reorder/insert/delete/sort_order change.

PASS:

```text
old cursor → stale structural sequence → rejected / restart per current contract
```

not a silently mixed sequence.

### R4a — immediate private revocation

Public cursor issued, then a later/public-visible Moment becomes private.

PASS:

```text
old cursor never exposes the revoked Moment
stale projection rejected/restarted
```

### R4b — newly public earlier member

Public cursor issued, then an earlier private Moment becomes public.

PASS:

```text
old cursor cannot silently continue and skip the new earlier member
reject/restart required
NEWLY_PUBLIC_EARLIER_MEMBER_SILENT_SKIP = FORBIDDEN
```

### R4c — Tree visibility revocation

Public cursor, then Tree public → private.

PASS:

```text
old public cursor immediately unusable
zero further public disclosure
```

### R4d — unchanged projection

Unchanged structural sequence + unchanged public projection generation.

PASS:

```text
deterministic continuation may succeed
```

### R4e — owner title/memo-only edit

Membership/order unchanged, owner-only content edit.

PASS:

```text
owner cursor may continue without unnecessary invalidation (per #4035 current authority)
```

### R4f — read-mode replay

PASS:

```text
OWNER cursor → PUBLIC replay = rejected
PUBLIC cursor → OWNER replay = rejected
```

### R4g — count/page coherence

PASS:

```text
totalCount + returned window + nextCursor bind to the SAME accepted
moment_sequence_version + public_projection_revision generation
```

### R4h — deep jump

Public deep jump carries the same read-mode + sequence + projection fence; it does not bypass public projection freshness.

### R4i — range read

Public range read applies the same public projection fencing.

Negative cases must prove after restart/full traversal:

```text
private leakage = 0
duplicate/gap after restart = 0
full traversal current truth restored
totalCount == current public projection
```

### R5 — privacy

Public windows expose:

```text
private playlist provenance = 0
unauthorized private Moment data = 0
```

---

## 11. Large UI acceptance — `lovetree-limone#172`

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

## 12. Publication acceptance — #4029

Publication freshness authority is the server-controlled monotonic `publication_revision` (#4036): preflight binds Tree/actor + `moment_sequence_version` + `publication_revision` + checked_at + valid_until/TTL + relevant provider freshness state. A client can never mint it (`publishReady: true` cannot bypass server authority).

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

### P6 — stale preflight matrix (per #4036 publication_revision authority)

```text
P6a preflight → reorder / insert / delete
     => structural sequence stale → publish rejected / re-preflight
P6b preflight → publication-relevant Moment visibility change (no sequence mutation)
     => moment_sequence_version unchanged, publication_revision advances → old preflight rejected
P6c preflight → Tree visibility / publication-relevant state change (structural sequence may be unchanged)
     => old preflight rejected
P6d preflight → source/media identity change altering provider target
     => publication_revision stale → reject / revalidate
P6e preflight → canonical availability/classification input change
     => reject / revalidate
P6f preflight → unlisted include / exclude / revoke decision change
     => stale publication authority → reject
P6g provider validity / TTL expired
     => provider recheck or fail closed
P6h unchanged exact relevant inputs + current structural sequence + current publication_revision + valid TTL/provider state
     => final publish path may proceed
P6i client sends publishReady=true with stale preflight
     => cannot bypass server authority
P6j Tree A preflight → Tree B publish attempt
     => reject
P6k publication_revision stale while structural sequence unchanged
     => reject
P6l structural sequence stale while publication_revision unchanged
     => reject / re-preflight per contract
```

The test asserts the server-controlled revision/fingerprint, not merely a browser-supplied flag. After every negative case, final public reread must remain leak-safe (no private/unavailable exposure, no stale projection).

### P7 — final public reread

After controlled publish:

- public shell/window counts reflect only public projection;
- private source playlist identity absent;
- owner private snapshot remains intact.

---

## 13. Publication visibility lifecycle acceptance — Model B (per #4026/#4029/#4033 current authority)

Selected staging model — MODEL B only (no dual-model acceptance):

```text
During import/review:
  Tree.visibility = private
  ALL imported Moment.visibility = private
Import completion != publication
Final publication = explicit owner action
FINAL_PUBLICATION_VISIBILITY_TRANSITION = APPROVED_MOMENTS + TREE ATOMIC PROMOTION
```

No canonical pseudo visibility values (`draft` / `staged` / `importing`); import lifecycle state is a separate server-side concept. At every scale gate (300 / 1K / 5K):

```text
V1  queued → public Tree exposure = 0, public imported Moment exposure = 0
V2  processing / importing → public exposure = 0
V3  partial_failed → public exposure = 0
V4  failed → public exposure = 0
V5  cancelled → public exposure = 0
V6  completed but not explicitly published → public exposure = 0
V7  explicit publish → exactly approved/current-public-eligible Moments promoted private→public
    AND Tree promoted private→public, in ONE atomic boundary
V8  blocked/private/unavailable/unknown/rejected-unlisted
    → owner row preserved private, absent from public projection
V9  public shell/window count = exact approved public Moment set count
V10 mid-publish failure → rollback → zero partial public state
V11 post-publish public reread → exact approved projection only
V12 source YouTube playlist privacy → unchanged
```

---

## 14. AI non-blocking acceptance — #4030

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

## 15. Gate A — 300 Moments

Required before 300 becomes an enabled product ceiling:

- authorization matrix PASS (A1–A5);
- OAuth reconnect/credential lifecycle PASS (A6a–A6f);
- exact mapping/order/provenance PASS;
- idempotent async job PASS;
- crash/restart/cancel PASS;
- structural cursor freshness + public projection cursor freshness PASS (R4, R4a–R4i);
- publication preflight freshness matrix PASS (P6a–P6l);
- Model B zero-exposure + atomic publish PASS (V1–V12);
- public count correctness PASS;
- complete ordered read PASS;
- desktop/mobile large UI baseline budgets frozen and PASS;
- publication privacy matrix PASS;
- cleanup/retry behavior PASS.

A 300 PASS is architecture proof, not evidence that 5K is safe.

---

## 16. Gate B — 1,000 Moments

Everything from Gate A plus:

- >= 20 provider pages where fixture/provider layout supports it, or equivalent pagination stress;
- forced lease-expiry/takeover cycle (J9/J10) — at least one full stale-executor takeover, not only restart before a replacement owner exists;
- multi-page enumeration + source mutation during enumeration (S1/S2/S3) with membership/order/count coherence;
- page-token restart truthfulness;
- bounded executor memory verified;
- multiple restart/checkpoint boundaries;
- full window traversal exact;
- cursor/deep pagination behavior under load;
- deep jump/search proven beyond first several windows;
- #160/#172 semantic-zoom/large-view behavior measured;
- no material UI regression against frozen budgets;
- publication preflight scale behavior (batching without one-provider-call-per-Moment).

---

## 17. Gate C — 5,000 Moments

Everything from A/B plus:

- complete ~100-page provider enumeration path or provider-equivalent controlled simulation;
- full canonical count/order/provenance reconciliation;
- executor survives process loss/reclaim at scale (fencing generation holds at 5K);
- restart/takeover under load;
- source mutation during multi-page import coherence;
- retry/cancel remains bounded;
- no single HTTP request or DB transaction spans the entire import;
- ordered read traverses all 5K with no gap/duplicate;
- deep jump near 4,999 works;
- editor does not mount 5K heavyweight surfaces;
- publication preflight uses batched unique-media checks;
- final approved-set atomic publication (V7/V10/V11) at 5K;
- final public/private projections remain leak-safe;
- cross-repository UI correctness against current `lovetree-limone` main;
- operational quota/resource estimates recorded;
- rollback/feature-disable switch documented.

Gate C Production enablement requires an explicit release decision after evidence review.

---

## 18. Per-gate acceptance evidence schema

Each future gate records, per run:

```text
gate, scale
LoveBud implementation SHA
lovetree-limone consumer SHA
deployment identity
fixture category
expected total occurrence count
actual canonical count
owner read count
public approved count
cursor generation metadata (sanitized)
publication revision metadata (sanitized)
job generation/fencing metadata (sanitized)
restart/takeover result
snapshot fingerprint result
duplicate count
private leakage count
silent truncation count
public exposure before publication
post-public projection count
latency/memory/render evidence where appropriate
verdict (PASS / FAIL / HOLD / BLOCKED)
```

NEVER recorded as evidence: OAuth/refresh token, authorization code, cookie/session secret, DB URL, raw private playlist URL, private playlist title (if sensitive), raw provider account identifier, secret bindings, raw provider error bodies.

---

## 19. Cleanup after test runs

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

## 20. Failure classification

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

## 21. Cross-repository release checklist

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

## 22. Stop conditions

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

## 23. Planning verdict

```text
CROSS_REPO_ACCEPTANCE_PLAN = RECONCILED
SCALE_GATES = 300 → 1000 → 5000
OAUTH_RECONNECT_ACCEPTANCE = DEFINED (A6a–A6f)
CREDENTIAL_GENERATION_FENCING_ACCEPTANCE = DEFINED (A6a–A6f, CG1–CG14)
EXECUTOR_LEASE_TAKEOVER_ACCEPTANCE = DEFINED (J9/J10)
STALE_EXECUTOR_AUTHORITATIVE_MUTATION = ZERO_REQUIRED
SOURCE_SNAPSHOT_COHERENCE_ACCEPTANCE = DEFINED (S1/S2/S3)
PAGETOKEN_AS_SNAPSHOT_ISOLATION = FORBIDDEN
COUNT_ONLY_COMPLETENESS = INSUFFICIENT
STRUCTURAL_SEQUENCE_ACCEPTANCE = DEFINED
PUBLIC_READ_PROJECTION_FRESHNESS_ACCEPTANCE = DEFINED (R4a–R4i)
NEWLY_PUBLIC_EARLIER_MEMBER_SILENT_SKIP = FORBIDDEN
IMMEDIATE_PRIVATE_REVOCATION_ACCEPTANCE = DEFINED
READ_MODE_CURSOR_REPLAY = FORBIDDEN
PUBLICATION_REVISION_FRESHNESS_ACCEPTANCE = DEFINED (P6a–P6l)
STALE_PUBLICATION_PREFLIGHT_BYPASS = FORBIDDEN
MODEL_B_PUBLICATION_TRANSITION_ACCEPTANCE = DEFINED (V1–V12)
APPROVED_MOMENTS_PLUS_TREE_ATOMIC_PROMOTION = REQUIRED
BLOCKED_MOMENTS_REMAIN_PRIVATE = REQUIRED
INCOMPLETE_IMPORT_PUBLIC_EXPOSURE = ZERO_REQUIRED
REVISION_AUTHORITY_CONFLATION = NONE
COUNT_ORDER_IDEMPOTENCY = HARD GATES
PRIVATE_SOURCE_VISIBILITY_MUTATION = ZERO
IMPORT_TO_PUBLIC_AUTOMATION = ZERO
AI_REQUIRED_FOR_IMPORT = NO
GATE_300_SPECIFICATION = DEFINED
GATE_1000_SPECIFICATION = DEFINED
GATE_5000_SPECIFICATION = DEFINED
GATE_300_RUNTIME_EVIDENCE = NOT_EXECUTED
GATE_1000_RUNTIME_EVIDENCE = NOT_EXECUTED
GATE_5000_RUNTIME_EVIDENCE = NOT_EXECUTED
PRODUCTION_5K_ENABLEMENT = NOT_AUTHORIZED
PRODUCTION_5K_TEST_WITHOUT_APPROVAL = PROHIBITED
RUNTIME_E2E_EXECUTION = NOT_PERFORMED
IMPLEMENTATION = NOT_YET PERFORMED
```
