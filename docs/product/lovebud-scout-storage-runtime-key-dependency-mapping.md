# LoveBud Scout Storage Runtime Key Dependency Mapping

Version: v20260616-runtime-key-mapping-1
Status: dependency adapter mapping only / no endpoint behavior change
Parent issue: #1882
Slice issue: #2577
Depends on: #2575
Depends on: #2576

## 1. Purpose

This document defines how Scout storage runtime-key scaffold outcomes are interpreted by the live auth/rate-limit dependency adapter.

The storage adapter can now produce a `STORAGE_KEY_BUILT` result (preserved as sanitized scaffold metadata under `storageKeyBuilder.code`) through the explicit non-default `runtimeKey: true` path. The next safety boundary is the dependency adapter: it must continue treating all storage scaffold outcomes as unavailable / safe-fail, and it must not allow a runtime key scaffold result to become a live quota allow decision.

## 2. Runtime file

This slice may update only the dependency adapter mapping boundary:

```text
functions/api/scout/live-auth-rate-limit-dependency-adapter.js
```

The slice does not update endpoint wiring, frontend source selection, provider integration, hashing, storage backend implementation, or Browse #1661.

## 3. Mapping policy

The dependency adapter must recognize `STORAGE_KEY_BUILT` from the storage adapter as a storage scaffold outcome and map it to:

```text
RATE_LIMIT_STORAGE_UNAVAILABLE
```

The runtime key output is sanitized scaffold metadata only and MUST NOT be interpreted as a quota allow decision. The dependency adapter response also MUST NOT surface `storageKey`, `keyPreview`, `storageKeyBuilder`, or any other runtime key builder field.

Existing storage scaffold safe-fail codes remain mapped to the same dependency boundary:

```text
STORAGE_KV_DISABLED
STORAGE_DURABLE_OBJECT_DISABLED
STORAGE_D1_DISABLED
STORAGE_CONFIG_MISSING
STORAGE_KEY_BUILDER_DISABLED
STORAGE_KEY_PAYLOAD_PROHIBITED
```

`STORAGE_KEY_BUILT` maps to `RATE_LIMIT_STORAGE_UNAVAILABLE`.

## 4. Rationale

The dependency adapter boundary should not leak runtime key builder internals to endpoint callers.

`STORAGE_KEY_BUILT` is a sanitized scaffold metadata result from the key builder's runtime mode. Even when the storage adapter surfaces it (currently nested under `storageKeyBuilder.code`, never as a top-level code), the dependency-level decision must remain storage unavailable. The dependency adapter must not:

- treat `STORAGE_KEY_BUILT` as a quota allow;
- expose `storageKey`, `keyPreview`, or `storageKeyBuilder` in its response;
- propagate the key builder's internal fields beyond the dependency boundary.

A future storage adapter shape that promotes `STORAGE_KEY_BUILT` to the top-level `code` field would still be safe-failed at the dependency adapter because of this slice's explicit mapping.

## 5. Behavior preservation

Required preservation:

- endpoint default remains `stub`;
- frontend default remains `local_stub`;
- endpoint client remains disabled by default;
- dependency adapter default remains mock-disabled;
- no real storage key generation occurs;
- no hashing secret or salt is accessed;
- no KV, Durable Object, or D1 backend is accessed;
- no provider integration is introduced;
- Browse #1661 is not touched.

## 6. Non-goals

This slice does not implement:

- KV / Durable Object / D1 implementation;
- persistent quota counter read/write;
- rate-limit allow/deny decisions backed by real storage;
- DB / API / schema changes;
- live provider execution;
- endpoint wiring change;
- real storage key generation for live traffic;
- real hashing implementation;
- secret or salt access;
- real KV access;
- real Durable Object access;
- real D1 access;
- frontend source selector change;
- provider integration;
- deployment configuration;
- staging or production live rollout;
- Browse #1661 work;
- any state change to #1882.

The dependency adapter must not leak runtime key builder internals (storageKey, keyPreview, storageKeyBuilder, raw key material) beyond the dependency boundary in any response.

## 7. Contract expectations

Contract tests must prove:

- dependency adapter explicitly recognizes `STORAGE_KEY_BUILT` from the storage adapter;
- `STORAGE_KEY_BUILT` maps to `RATE_LIMIT_STORAGE_UNAVAILABLE` and never to an allow decision;
- dependency adapter response does not surface `storageKey`, `keyPreview`, `storageKeyBuilder`, or raw key material;
- existing storage disabled / prohibited / config-missing mappings remain intact;
- `STORAGE_PAYLOAD_PROHIBITED` remains mapped to `RATE_LIMIT_PAYLOAD_PROHIBITED`;
- unknown / missing storage result codes still fail closed to `RATE_LIMIT_STORAGE_UNAVAILABLE`;
- storage adapter throw is safe-swallowed to `RATE_LIMIT_STORAGE_UNAVAILABLE`;
- default mock-disabled dependency behavior remains intact;
- no endpoint import or behavior change is introduced;
- no frontend source change is introduced;
- no real hashing, storage backend, provider SDK, env, secrets, or network call is introduced;
- no staging_live / production_live path is introduced;
- parent umbrella #1882 is not closed.

## 8. Current verdict

GO for dependency adapter safe-fail code mapping for storage runtime-key scaffold outcomes.

NO-GO for endpoint wiring, real key generation, real hashing, real storage backend access, frontend changes, provider integration, deployment changes, or Browse #1661 work in this slice.
