# LoveBud Scout Storage Key Safe-Fail Dependency Mapping

Version: v20260607-1  
Status: dependency adapter mapping only / no endpoint behavior change  
Parent issue: #1882  
Slice issue: #2345  
Depends on: #2343

## 1. Purpose

This document defines how disabled Scout storage key builder safe-fail codes are interpreted by the live auth/rate-limit dependency adapter.

The storage adapter may now include disabled key-builder outcomes in its safe-fail response metadata. The dependency adapter must collapse those storage-key-specific details into the existing generic rate-limit storage unavailable boundary so endpoint-facing behavior does not expose storage key internals.

## 2. Runtime file

This slice may update only the dependency adapter mapping boundary:

```text
functions/api/scout/live-auth-rate-limit-dependency-adapter.js
```

The slice does not update endpoint wiring, frontend source selection, provider integration, hashing, storage backend implementation, or Browse #1661.

## 3. Mapping policy

The dependency adapter must map these storage adapter result codes to:

```text
RATE_LIMIT_STORAGE_UNAVAILABLE
```

Mapped storage-key-builder safe-fail codes:

```text
STORAGE_KEY_BUILDER_DISABLED
STORAGE_KEY_PAYLOAD_PROHIBITED
```

Existing storage scaffold safe-fail codes remain mapped to the same dependency boundary:

```text
STORAGE_KV_DISABLED
STORAGE_DURABLE_OBJECT_DISABLED
STORAGE_D1_DISABLED
STORAGE_CONFIG_MISSING
```

## 4. Rationale

The dependency adapter boundary should not leak key-builder internals to endpoint callers.

`STORAGE_KEY_BUILDER_DISABLED` means the storage key builder is intentionally disabled and cannot produce a usable storage key. The dependency-level decision is therefore storage unavailable.

`STORAGE_KEY_PAYLOAD_PROHIBITED` means a prohibited key-builder payload was detected. The dependency-level decision is also storage unavailable, without exposing raw field names or raw payload content.

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
- Browse #1661 work.

## 7. Contract expectations

Contract tests must prove:

- `STORAGE_KEY_BUILDER_DISABLED` maps to `RATE_LIMIT_STORAGE_UNAVAILABLE`;
- `STORAGE_KEY_PAYLOAD_PROHIBITED` maps to `RATE_LIMIT_STORAGE_UNAVAILABLE`;
- existing storage scaffold mappings remain intact;
- `STORAGE_PAYLOAD_PROHIBITED` remains mapped to `RATE_LIMIT_PAYLOAD_PROHIBITED`;
- default mock-disabled dependency behavior remains intact;
- no endpoint import or behavior change is introduced;
- no frontend source change is introduced;
- no real hashing, storage backend, provider SDK, or network call is introduced.

## 8. Current verdict

GO for dependency adapter safe-fail code mapping.

NO-GO for endpoint wiring, real key generation, real hashing, real storage backend access, frontend changes, provider integration, deployment changes, or Browse #1661 work in this slice.
