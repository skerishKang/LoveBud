# LoveBud Scout Rate-Limit Storage Backend Selection Policy

Version: v20260607-1  
Status: policy-only / no runtime storage implementation  
Parent issue: #1882  
Slice issue: #2337

## 1. Purpose

This document defines the storage backend selection policy for the future Scout live rate-limit path.

The current Scout live path remains scaffolded and safe-fail only. This policy does not implement a real backend and does not change endpoint, frontend, provider, or deployment behavior.

## 2. Current baseline

The current baseline after the explicit mapping slice is:

- disabled storage scaffold outcomes explicitly map to `RATE_LIMIT_STORAGE_UNAVAILABLE`;
- endpoint default remains `stub`;
- frontend default remains `local_stub`;
- endpoint client remains disabled by default;
- no real KV, Durable Object, or D1 access exists;
- no persistent quota counter exists;
- no live provider call is introduced by this policy.

## 3. Backend candidates

### 3.1 KV

KV may be considered for simple, low-contention quota reads where eventual consistency is acceptable.

KV should not be the first choice when strict per-request atomicity is required.

Allowed future use cases:

- low-risk per-IP soft throttles;
- coarse abuse dampening;
- cached denylist or allowlist snapshots;
- read-heavy policy metadata.

Do not use KV alone for strict spend-control counters.

### 3.2 Durable Object

Durable Object should be the preferred candidate for strict per-key rate-limit counters where serialized updates matter.

Allowed future use cases:

- per-user hard quota windows;
- per-session request reservation;
- provider spend guard counters;
- burst control where concurrent requests must be coordinated.

Durable Object should be evaluated first for live provider protection because it can centralize mutation for a given key.

### 3.3 D1

D1 may be considered for auditable quota ledgers, administrative reporting, or longer-lived policy state.

D1 should not be the first choice for high-frequency per-request counter mutation unless a separate concurrency policy is approved.

Allowed future use cases:

- quota event audit trail;
- daily aggregate reporting;
- administrative review records;
- policy configuration history.

## 4. Initial recommendation

The recommended future implementation order is:

1. Durable Object for strict live request quota counters.
2. KV only for coarse auxiliary policy reads or non-strict throttles.
3. D1 only for audit/reporting or lower-frequency policy state.

This recommendation is policy-only. It does not authorize runtime storage implementation in this slice.

## 5. Keying policy

Future storage implementations must avoid raw identifiers.

Allowed key inputs:

- `userKeyHash`;
- `ipHash`;
- `sessionKeyHash`;
- `endpointPath`;
- `providerMode`;
- `limitName`;
- `windowKey`.

Prohibited key inputs:

- raw token;
- authorization header;
- raw user ID;
- email;
- phone number;
- API key;
- prompt;
- excerpt;
- source URL;
- raw request body;
- raw provider response;
- raw model output.

## 6. Quota window policy

Future quota windows should be explicit and named.

Required dimensions:

- limit name;
- window key;
- window duration;
- request cost unit;
- user/session/IP scope;
- retry-after behavior;
- failure mode.

The first live implementation should prefer conservative hard-deny behavior when quota state is unavailable.

## 7. Failure mode policy

Storage failures must fail closed for live provider protection.

Required behavior:

- storage unavailable → deny;
- backend disabled → deny;
- config missing → deny;
- malformed storage result → deny;
- unknown storage code → deny;
- transient storage exception → deny.

Canonical dependency code:

```text
RATE_LIMIT_STORAGE_UNAVAILABLE
```

## 8. Environment policy

No environment should enable live storage by default.

Required future environment gates:

- local: mock-disabled or stub-only;
- test: deterministic mock-only;
- staging: explicit opt-in with isolated storage namespace;
- production: separate explicit approval after staging evidence.

Staging and production storage must not share quota state.

## 9. Observability policy

Allowed observability fields:

- request ID;
- storage adapter kind;
- dependency adapter mode;
- rate-limit decision code;
- hashed quota key label;
- limit name;
- window key;
- retry-after value when safe;
- duration or latency bucket.

Prohibited observability fields:

- raw token;
- authorization header;
- API key;
- raw user ID;
- email;
- phone number;
- prompt;
- excerpt;
- source URL;
- raw request body;
- raw provider response;
- raw model output.

## 10. Rollout policy

Future storage rollout must be staged:

1. contract-only policy;
2. disabled runtime scaffold;
3. mock execution contract;
4. staging isolated backend;
5. staging kill-switch drill;
6. production readiness audit;
7. production opt-in.

No step may skip CI, contract tests, or rollback review.

## 11. Rollback policy

Rollback must support:

- immediate storage kill switch;
- reversion to `RATE_LIMIT_STORAGE_UNAVAILABLE` safe-fail;
- preservation of endpoint default stub behavior;
- preservation of frontend `local_stub` behavior;
- no provider-call continuation when rate-limit storage is unavailable.

## 12. Non-goals

This policy does not implement:

- real KV access;
- real Durable Object access;
- real D1 access;
- persistent quota storage;
- endpoint runtime wiring changes;
- frontend source selector changes;
- live provider calls;
- deployment or secret changes.

## 13. Readiness gates before runtime storage implementation

Before any real storage backend is implemented, the following evidence must exist:

- explicit backend selection issue;
- storage adapter implementation contract;
- key hashing and key allowlist contract;
- failure-mode contract;
- observability allowlist contract;
- rollback / kill-switch policy check;
- staging namespace separation policy;
- CI green on the implementation PR;
- no raw identifiers in logs or storage keys;
- no endpoint default-live change.

## 14. Current verdict

GO for policy and contract documentation.

NO-GO for real storage backend implementation in this slice.
