# LoveBud Scout Storage Key Builder Adapter Wiring

Version: v20260607-1  
Status: disabled wiring / no live storage key generation  
Parent issue: #1882  
Slice issue: #2343  
Depends on: #2341

## 1. Purpose

This document defines the storage adapter wiring boundary for the disabled Scout live rate-limit storage key builder scaffold.

The purpose of this slice is narrow: the storage adapter may recognize and call the disabled key builder while still failing closed. The adapter must not generate a usable storage key, access hashing secrets or salts, call KV, Durable Object, or D1, change endpoint behavior, change frontend defaults, integrate a provider, deploy secrets, or touch Browse #1661.

## 2. Runtime files

This slice may update:

```text
functions/api/scout/live-rate-limit-storage-adapter.js
```

It may rely on the already-merged disabled scaffold:

```text
functions/api/scout/live-rate-limit-storage-key-builder.js
```

It must not import the key builder from:

```text
functions/api/scout/suggest.js
js/scout/scout-suggestion-source-selector.js
js/scout/scout-suggestion-endpoint-client.js
```

## 3. Allowed wiring

Allowed adapter-level wiring:

- import the disabled key builder scaffold;
- create a disabled key builder only inside the storage adapter runtime scaffold path;
- expose `hasStorageKeyBuilder: true` only on disabled runtime scaffold adapters;
- call `storageKeyBuilder.buildKey(payload)` only from disabled runtime scaffold methods;
- include a sanitized `storageKeyBuilder` result in safe-fail responses;
- preserve `storageKey: null` and `keyPreview: null`;
- map prohibited key-builder payloads to `STORAGE_KEY_PAYLOAD_PROHIBITED`;
- keep all storage methods returning denied/safe-fail responses.

## 4. Disallowed wiring

Disallowed behavior:

- no usable storage key generation;
- no real hash helper;
- no hashing secret or salt access;
- no KV read/write/delete;
- no Durable Object namespace, id, stub, or fetch;
- no D1 prepare/batch/exec;
- no endpoint import or behavior change;
- no frontend source selector change;
- no provider SDK or live provider call;
- no deployment or secret configuration;
- no Browse #1661 work.

## 5. Safe-fail response policy

When a disabled runtime storage scaffold calls the disabled key builder, the adapter response may include:

```text
storageKeyBuilder: {
  ok: false,
  disabled: true,
  code: STORAGE_KEY_BUILDER_DISABLED | STORAGE_KEY_PAYLOAD_PROHIBITED,
  storageKey: null,
  keyPreview: null,
  rejectedFields: []
}
```

The top-level storage adapter response must still deny quota actions:

- `checkQuota()` returns `allowed: false`;
- `consumeQuota()` returns `allowed: false`;
- `releaseQuota()` returns `released: false`.

## 6. Default behavior preservation

Default storage adapter behavior must remain mock-disabled.

Required defaults:

- `createScoutLiveRateLimitStorageAdapter()` still returns `mockDisabled: true`;
- default adapter does not call the key builder;
- default adapter has `hasStorageKeyBuilder: false`;
- endpoint default remains `stub`;
- frontend default remains `local_stub`;
- endpoint client remains disabled by default.

## 7. Contract expectations

Contract tests must prove:

- storage adapter imports the disabled key builder scaffold;
- runtime scaffold adapters expose `hasStorageKeyBuilder: true`;
- default mock-disabled adapters expose `hasStorageKeyBuilder: false`;
- key builder safe-fail result is included only in runtime scaffold responses;
- returned `storageKey` and `keyPreview` remain `null`;
- prohibited payloads map to `STORAGE_KEY_PAYLOAD_PROHIBITED`;
- no real hashing, salt, KV, Durable Object, D1, endpoint wiring, frontend wiring, provider integration, or Browse #1661 work is introduced.

## 8. Current verdict

GO for disabled storage key builder to storage adapter safe-fail wiring.

NO-GO for real key generation, real hashing, real storage backend access, endpoint wiring, frontend changes, provider integration, deployment changes, or Browse #1661 work in this slice.
