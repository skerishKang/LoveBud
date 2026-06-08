# LoveBud Scout Live Storage Readiness Audit

Version: v20260608-1  
Status: product readiness audit / no runtime behavior change  
Parent issue: #1882  
Slice issue: #2349  
Depends on: #2347

## 1. Purpose

This audit summarizes the current Scout live storage readiness state after the safe-fail mapping matrix work.

The goal is to decide what can safely proceed next before any real KV, Durable Object, D1, runtime storage key generation, live endpoint wiring, frontend source change, provider integration, staging live, or production live work.

## 2. Baseline

Audit baseline:

```text
main HEAD before this audit: 74f17432c56c5d2aec9def25309049707b955a36
latest completed storage matrix issue: #2347
latest completed storage matrix PR: #2348
```

This audit is documentation and contract only. It does not change runtime code.

## 3. Completed storage safety slices

| Slice | Status | Contribution |
| --- | --- | --- |
| #2337 / #2338 | Done | Rate-limit storage backend selection policy added before choosing KV / Durable Object / D1. |
| #2339 / #2340 | Done | Storage key hashing and allowlist contract added before implementing runtime key generation. |
| #2341 / #2342 | Done | Disabled storage key builder scaffold added with no usable key generation. |
| #2343 / #2344 | Done | Disabled key builder wired into storage adapter safe-fail path only. |
| #2345 / #2346 | Done | Storage key builder safe-fail codes mapped into dependency adapter as storage unavailable. |
| #2347 / #2348 | Done | Dependency storage safe-fail regression matrix added. |

## 4. Current implemented boundary inventory

### 4.1 Storage backend selection policy

Storage backend selection is documented but no backend is selected for live runtime use. The project still has no real KV, Durable Object, or D1 implementation.

### 4.2 Key hashing and allowlist policy

Allowed future key inputs are documented:

- `userKeyHash`;
- `ipHash`;
- `sessionKeyHash`;
- `endpointPath`;
- `providerMode`;
- `limitName`;
- `windowKey`.

Raw identifiers, tokens, authorization headers, emails, phone numbers, API keys, prompts, excerpts, source URLs, raw request bodies, raw provider responses, and raw model outputs remain prohibited.

### 4.3 Disabled key builder scaffold

The key builder scaffold exists but remains disabled. It returns no usable key.

Expected safe shape remains:

```text
ok: false
disabled: true
storageKey: null
keyPreview: null
```

### 4.4 Storage adapter safe-fail wiring

The storage adapter can recognize the disabled key builder scaffold on runtime scaffold paths. It still does not read or write real storage.

### 4.5 Dependency adapter safe-fail mapping

The dependency adapter collapses storage-key-builder-specific outcomes into dependency-level safe-fail codes. It must not expose key-builder internals to endpoint-facing behavior.

### 4.6 Regression matrix

The regression matrix locks expected storage-to-dependency mapping for:

- `STORAGE_PAYLOAD_PROHIBITED`;
- `STORAGE_NOT_IMPLEMENTED`;
- `STORAGE_MOCK_DISABLED`;
- `STORAGE_KV_DISABLED`;
- `STORAGE_DURABLE_OBJECT_DISABLED`;
- `STORAGE_D1_DISABLED`;
- `STORAGE_CONFIG_MISSING`;
- `STORAGE_KEY_BUILDER_DISABLED`;
- `STORAGE_KEY_PAYLOAD_PROHIBITED`;
- unknown storage code;
- missing storage code;
- storage adapter throw.

## 5. Current default behavior

The current default behavior must remain:

- endpoint default: `stub`;
- frontend source selector default: `local_stub`;
- endpoint client: disabled by default;
- live provider call: not enabled;
- real storage backend call: not enabled;
- storage key generation for live traffic: not enabled;
- hashing secret or salt access: not enabled;
- Browse #1661: not touched.

## 6. Go / no-go matrix

| Area | Current decision | Reason |
| --- | --- | --- |
| Additional documentation / contract hardening | GO | Existing storage safety boundary can be further audited without runtime risk. |
| Disabled scaffold refinements | CONDITIONAL GO | Allowed only if disabled-by-default and no endpoint/live backend behavior changes. |
| Runtime key builder implementation | NO-GO | Needs deterministic hash helper, salt/version policy, key namespace design, and redaction tests first. |
| Real KV implementation | NO-GO | Needs backend implementation plan, quota model, rollback policy, abuse monitoring, and staging evidence. |
| Real Durable Object implementation | NO-GO | Needs object namespace design, concurrency model, cost/quota plan, and rollback policy. |
| Real D1 implementation | NO-GO | Needs schema/migration plan, retention policy, query limits, and rollback policy. |
| Endpoint live wiring | NO-GO | Must wait for runtime auth, rate-limit storage, observability, error taxonomy, and rollout gates. |
| Frontend endpoint default change | NO-GO | `local_stub` must remain default until live endpoint readiness is separately approved. |
| Staging live | NO-GO | Real auth/storage/provider dependencies are not ready. |
| Production live | NO-GO | Staging evidence, monitoring, quota, abuse controls, rollback, and legal/privacy review remain missing. |
| Provider integration | NO-GO | Storage readiness does not authorize live provider calls. |
| Browse #1661 | NO-GO | Out of scope for this storage readiness track. |

## 7. Remaining blockers before real storage backend work

Before any real KV, Durable Object, or D1 implementation, the project still needs:

1. Deterministic hash helper contract.
2. Salt and versioning policy.
3. Environment namespace separation policy for staging and production.
4. Storage key format implementation contract.
5. Raw preimage non-persistence tests.
6. Log redaction and observability tests for storage keys.
7. Quota window model and limit policy.
8. Abuse monitoring policy.
9. Backend-specific implementation plan for KV, Durable Object, or D1.
10. Rollback and kill-switch plan for storage runtime.
11. Cost and quota impact review.
12. Staging-only rollout checklist.
13. Privacy review for hashed identifiers and retention.
14. Endpoint safe-fail integration tests.
15. CI evidence that default stub and frontend `local_stub` remain unchanged.

## 8. Recommended next slice

Recommended next slice:

```text
[TECH] Add Scout storage hash helper disabled scaffold contract
```

This next slice should still avoid real hashing secret/salt access. It should define a disabled hash helper scaffold that refuses to produce real hashes until salt/version policy and environment namespace rules are finalized.

## 9. Current verdict

The storage safety track is ready for another disabled-by-default scaffold contract.

It is not ready for real runtime key generation.

It is not ready for real KV, Durable Object, or D1 implementation.

It is not ready for endpoint live wiring.

It is not ready for frontend default endpoint mode.

It is not ready for staging live or production live.

It is not ready for provider integration.
