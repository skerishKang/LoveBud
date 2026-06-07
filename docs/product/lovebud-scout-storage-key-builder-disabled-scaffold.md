# LoveBud Scout Storage Key Builder Disabled Scaffold

Version: v20260607-1  
Status: disabled scaffold / no live storage key generation  
Parent issue: #1882  
Slice issue: #2341  
Depends on: #2339

## 1. Purpose

This document defines the disabled-by-default scaffold for future Scout live rate-limit storage key construction.

The scaffold exists so the project can lock the interface, allowlist, prohibited input policy, and safe-fail behavior before any real storage key generation, hashing secret, KV, Durable Object, D1, endpoint behavior change, frontend source change, provider integration, deployment change, or Browse #1661 work.

## 2. Scope

This slice adds a scaffold module only:

```text
functions/api/scout/live-rate-limit-storage-key-builder.js
```

The scaffold may expose constants, allowlists, prohibited-input lists, a sanitizer, a disabled build function, and a factory.

The scaffold must not generate usable storage keys for live traffic.

## 3. Allowed inputs

The scaffold locks the same future storage key inputs from the prior key hashing and allowlist contract:

- `userKeyHash`;
- `ipHash`;
- `sessionKeyHash`;
- `endpointPath`;
- `providerMode`;
- `limitName`;
- `windowKey`.

The scaffold must copy only allowed fields into the sanitized payload.

## 4. Prohibited inputs

The scaffold must reject or remove raw/sensitive fields, including:

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
- raw model output;
- password;
- cookie;
- Firebase token.

## 5. Disabled behavior

The scaffold must be disabled by default.

Required behavior:

- `createScoutLiveRateLimitStorageKeyBuilder()` returns an object with `disabled: true`;
- `buildScoutLiveRateLimitStorageKey()` returns `ok: false` by default;
- the returned `storageKey` is always `null`;
- the returned `keyPreview` is always `null`;
- no usable storage key is generated;
- prohibited fields return a safe prohibited-payload response;
- unknown fields are not copied into the sanitized payload.

Canonical scaffold codes:

```text
STORAGE_KEY_BUILDER_DISABLED
STORAGE_KEY_BUILDER_NOT_IMPLEMENTED
STORAGE_KEY_PAYLOAD_PROHIBITED
```

## 6. Non-goals

This scaffold does not implement:

- real storage key generation for live traffic;
- real hash helper;
- real hashing secret or salt access;
- real KV access;
- real Durable Object access;
- real D1 access;
- endpoint wiring;
- dependency adapter wiring;
- frontend source selector changes;
- provider integration;
- deployment or secret configuration;
- Browse #1661 work.

## 7. Runtime safety constraints

The scaffold must not contain or call:

- `crypto.subtle.digest`;
- `createHash`;
- `HMAC`;
- `SCOUT_STORAGE_KEY_SALT`;
- `SCOUT_RATE_LIMIT_KV`;
- `SCOUT_RATE_LIMIT_DO`;
- `SCOUT_RATE_LIMIT_D1`;
- `DurableObjectNamespace`;
- `fetch(`;
- provider SDK calls.

## 8. Endpoint and frontend preservation

This slice must preserve:

- endpoint default `stub` behavior;
- frontend default `local_stub` behavior;
- endpoint client disabled-by-default behavior;
- no live provider call;
- no runtime storage backend call.

The scaffold module must not be imported by `functions/api/scout/suggest.js` in this slice.

## 9. Future implementation gates

Before a real storage key builder may replace this disabled scaffold, the project must add:

- a dedicated implementation issue;
- deterministic hash helper tests;
- salt/version policy tests;
- raw preimage non-persistence tests;
- log redaction tests;
- endpoint safe-fail tests;
- staging/prod key namespace separation tests;
- rollback/kill-switch confirmation;
- CI green evidence.

## 10. Current verdict

GO for disabled scaffold and contract tests.

NO-GO for real key generation, real hashing, real storage backend access, endpoint wiring, frontend changes, provider integration, deployment changes, or Browse #1661 work in this slice.
