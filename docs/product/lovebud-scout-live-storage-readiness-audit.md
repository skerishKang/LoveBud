# LoveBud Scout Live Storage Readiness Audit

Version: v20260616-refresh-1
Status: product readiness audit / no runtime behavior change
Parent issue: #1882
Slice issue: #2579
Depends on: #2577
Depends on: #2347

## 1. Purpose

This audit refreshes the Scout live storage readiness state after the runtime storage key builder, runtime key output scaffold, and dependency adapter safe-fail mapping slices.

The goal is to decide what can safely proceed next before any real KV, Durable Object, D1, runtime storage key generation, live endpoint wiring, frontend source change, provider integration, staging live, or production live work.

This audit is documentation and contract only. It does not change runtime code.

## 2. Baseline

Audit baseline:

```text
main HEAD before this audit: 7cef9f50a5c9d0cea7150eaa3dbc24a069e78069
latest completed storage safety issue: #2577
latest completed storage safety PR: #2578
```

The baseline is the squash-merged commit for PR #2578 (`tech(scout): map storage runtime key scaffold outcomes`).

## 3. Completed storage safety slices

| Slice | Status | Contribution |
| --- | --- | --- |
| #2337 / #2338 | Done | Rate-limit storage backend selection policy added before choosing KV / Durable Object / D1. |
| #2339 / #2340 | Done | Storage key hashing and allowlist contract added before implementing runtime key generation. |
| #2341 / #2342 | Done | Disabled storage key builder scaffold added with no usable key generation. |
| #2343 / #2344 | Done | Disabled key builder wired into storage adapter safe-fail path only. |
| #2345 / #2346 | Done | Storage key builder safe-fail codes mapped into dependency adapter as storage unavailable. |
| #2347 / #2348 | Done | Dependency storage safe-fail regression matrix added. |
| #2573 / #2574 | Done | Disabled-by-default runtime storage key builder mode added (`STORAGE_RUNTIME` mode with `STORAGE_KEY_BUILT` success code). Default disabled behavior preserved. |
| #2575 / #2576 | Done | Storage adapter scaffold path bound to runtime key builder output via explicit non-default `runtimeKey: true` opt-in. `STORAGE_KEY_BUILT` is preserved only as sanitized scaffold metadata under `storageKeyBuilder.code`, never as a quota allow decision. |
| #2577 / #2578 | Done | Dependency adapter explicitly recognizes `STORAGE_KEY_BUILT` from the storage adapter and safe-fails it to `RATE_LIMIT_STORAGE_UNAVAILABLE`. No runtime key builder field leaks beyond the dependency boundary. |

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

The key builder scaffold exists with two modes:

- default `disabled` mode: returns no usable key, returns `STORAGE_KEY_BUILDER_DISABLED`;
- explicit opt-in `runtime` mode: returns sanitized `STORAGE_KEY_BUILT` only when the factory is called with `{ disabled: false, runtime: true }`.

The default factory behavior is still disabled, and the runtime scaffold path is only reached when the storage adapter is explicitly opted in via `runtimeKey: true`. Even in runtime mode, the produced `storageKey` and `keyPreview` are derived from already-sanitized inputs only and are not treated as quota allow decisions.

Expected safe shape remains:

```text
ok: false
disabled: true
storageKey: null
keyPreview: null
```

### 4.4 Storage adapter safe-fail wiring

The storage adapter can recognize both the disabled key builder scaffold and the runtime key output scaffold on the non-default `runtimeKey: true` path. It still does not read or write real storage. The top-level `code` of the storage adapter response is the scaffold code (e.g. `STORAGE_KV_DISABLED`); the `STORAGE_KEY_BUILT` code from the key builder is preserved only as nested metadata under `storageKeyBuilder.code`.

### 4.5 Dependency adapter safe-fail mapping

The dependency adapter collapses storage-key-builder-specific outcomes into dependency-level safe-fail codes. It must not expose key-builder internals to endpoint-facing behavior.

The dependency adapter explicitly recognizes and safe-fails:

- `STORAGE_KEY_BUILDER_DISABLED` → `RATE_LIMIT_STORAGE_UNAVAILABLE`;
- `STORAGE_KEY_PAYLOAD_PROHIBITED` → `RATE_LIMIT_STORAGE_UNAVAILABLE`;
- `STORAGE_KEY_BUILT` → `RATE_LIMIT_STORAGE_UNAVAILABLE` (defensive — even though the storage adapter currently nests this code, the dependency adapter safe-fails it as a scaffold outcome rather than treating it as a quota allow).

The dependency adapter MUST NOT surface `storageKey`, `keyPreview`, `storageKeyBuilder`, or any raw key material in its response. The runtime key output is sanitized scaffold metadata only.

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
- `STORAGE_KEY_BUILT` (defensive safe-fail at dependency boundary);
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
- Browse #1661: not touched;
- dependency adapter default: mock-disabled;
- storage adapter default: mock-disabled;
- storage key builder default: disabled;
- storage adapter runtime scaffold path: reached only when `runtimeKey: true` is explicitly set;
- dependency adapter runtime-key boundary: `STORAGE_KEY_BUILT` is safe-failed to `RATE_LIMIT_STORAGE_UNAVAILABLE`, and no runtime key builder field leaks beyond the dependency boundary.

## 6. Go / no-go matrix

| Area | Current decision | Reason |
| --- | --- | --- |
| Additional documentation / contract hardening | GO | Existing storage safety boundary can be further audited without runtime risk. |
| Disabled scaffold refinements | CONDITIONAL GO | Allowed only if disabled-by-default and no endpoint/live backend behavior changes. |
| Disabled-by-default single backend skeleton (preferably KV first) | CONDITIONAL GO | May proceed only as a disabled-by-default skeleton. The skeleton must NOT perform real KV reads/writes, must NOT bind to `env.KV` / `env.DB`, must NOT execute a real storage call, must NOT change endpoint / frontend / provider / live behavior, and must continue to safe-fail. |
| Runtime key builder implementation | NO-GO | Needs deterministic hash helper, salt/version policy, key namespace design, and redaction tests first. The current `STORAGE_RUNTIME` mode is a non-live scaffold only; live traffic use is not enabled. |
| Real KV implementation | NO-GO | Needs backend implementation plan, quota model, rollback policy, abuse monitoring, and staging evidence. The disabled skeleton slice is the prerequisite. |
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
16. Disabled-by-default single backend skeleton contract (KV preferred first), still safe-failing and never executing a real storage call.
17. Defensive dependency adapter safe-fail mapping for any future storage adapter code that promotes a `STORAGE_KEY_BUILT` / runtime key outcome to the top level.

## 8. Recommended next slice

Recommended next slice:

```text
[TECH] Add Scout disabled-by-default single storage backend skeleton contract (KV first)
```

This next slice should:

- introduce a disabled-by-default single backend adapter skeleton (KV first, then DO / D1 in later slices);
- NOT bind to `env.KV`, `env.DB`, `DurableObjectNamespace`, or any real storage binding;
- NOT execute a real KV / DO / D1 read or write;
- preserve the dependency adapter's safe-fail boundary for any new code it emits;
- preserve default `stub` / `local_stub` / disabled endpoint client / mock-disabled dependency adapter;
- not change #1882 state.

## 9. Current verdict

The storage safety track is ready for another disabled-by-default scaffold contract.

It is not ready for real runtime key generation.

It is not ready for real KV, Durable Object, or D1 implementation.

It is not ready for endpoint live wiring.

It is not ready for frontend default endpoint mode.

It is not ready for staging live or production live.

It is not ready for provider integration.

`STORAGE_KEY_BUILT` from the storage adapter is sanitized scaffold metadata only, is safe-failed to `RATE_LIMIT_STORAGE_UNAVAILABLE` at the dependency adapter boundary, and MUST NOT be interpreted as a quota allow decision at any layer.
