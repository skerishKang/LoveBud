# LoveBud Scout Storage Key Hashing and Allowlist Contract

Version: v20260607-1  
Status: contract/readiness only / no runtime storage key builder  
Parent issue: #1882  
Slice issue: #2339

## 1. Purpose

This document locks the future Scout live rate-limit storage key policy before any real KV, Durable Object, or D1 implementation is introduced.

The current Scout live path remains scaffolded and safe-fail only. This contract does not implement storage key construction, hashing, persistent counters, endpoint behavior changes, frontend source changes, provider integration, deployment changes, or Browse #1661 work.

## 2. Current baseline

The baseline for this slice is:

- PR #2338 merged the rate-limit storage backend selection policy;
- main is expected to include merge commit `88e62187b4374b2008ec9fbb1b7123d8984a8408`;
- disabled storage scaffold outcomes already map to `RATE_LIMIT_STORAGE_UNAVAILABLE`;
- endpoint default remains `stub`;
- frontend default remains `local_stub`;
- endpoint client remains disabled by default;
- no real KV, Durable Object, or D1 access exists;
- no persistent quota counter exists;
- no live provider call is introduced by this contract.

## 3. Key safety goal

Future rate-limit storage keys must be deterministic enough to support quota checks, but they must not contain raw identifiers, user content, request content, provider content, or secrets.

The storage layer should receive only pre-hashed or non-sensitive routing dimensions. It should not be responsible for discovering, parsing, logging, or persisting raw identity values.

## 4. Allowed storage key inputs

Future storage key construction may use only the following input fields:

- `userKeyHash`;
- `ipHash`;
- `sessionKeyHash`;
- `endpointPath`;
- `providerMode`;
- `limitName`;
- `windowKey`.

These allowed inputs are intentionally narrow. The contract permits hashed identity labels and quota dimensions, not raw identity values.

## 5. Required field meaning

### 5.1 `userKeyHash`

`userKeyHash` is a pre-hashed user-scoped key label. It must not be a raw user ID, email address, Firebase UID, OAuth subject, or account identifier.

### 5.2 `ipHash`

`ipHash` is a pre-hashed network-scoped key label. It must not contain a raw IPv4 address, raw IPv6 address, forwarded-for header value, or geolocation payload.

### 5.3 `sessionKeyHash`

`sessionKeyHash` is a pre-hashed session-scoped key label. It must not contain a raw session ID, cookie, Firebase token, browser fingerprint, or bearer token.

### 5.4 `endpointPath`

`endpointPath` is a normalized route label, such as `/api/scout/suggest`. It must not include query strings, source URLs, request bodies, prompt fragments, or user content.

### 5.5 `providerMode`

`providerMode` is a bounded mode label, such as `stub`, `live`, or another approved enum used by the endpoint boundary. It must not contain model output, provider response data, or secret configuration.

### 5.6 `limitName`

`limitName` is a named quota policy label, such as `scout_suggest_per_user_minute` or `scout_suggest_per_ip_minute`. It must be a fixed policy name, not user-supplied text.

### 5.7 `windowKey`

`windowKey` is a deterministic quota window label, such as an approved minute, hour, or day bucket. It must not contain raw timestamps with user-identifying entropy unless that representation has been explicitly approved.

## 6. Prohibited storage key inputs

Future storage key construction must not use:

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

This prohibition applies to storage keys, storage values, observability fields, errors, and retry metadata unless a later dedicated policy explicitly allows a safe derived form.

## 7. Hashing requirement

The future hashing contract must use a one-way deterministic digest for identity-derived labels before they reach the storage adapter.

Required future properties:

- deterministic output for the same approved input and salt/version;
- no raw identifier in the output;
- stable key format with an explicit version prefix;
- environment separation so staging and production do not share key space;
- no client-side hashing requirement;
- no frontend exposure of hash inputs, salt, or derived storage keys;
- no storage of raw preimage values.

The current slice does not implement the hash helper or key builder. It only locks the policy that the later implementation must satisfy.

## 8. Key shape policy

A future storage key should be composed from approved labels only. The shape should make quota scope clear without exposing sensitive data.

Recommended future shape:

```text
scout:rate_limit:v1:{providerMode}:{endpointPath}:{limitName}:{windowKey}:{identityScopeHash}
```

Where `identityScopeHash` is selected from an approved hashed identity label such as `userKeyHash`, `ipHash`, or `sessionKeyHash`.

This recommended shape is not implemented in this slice.

## 9. Allowlist-first behavior

Future runtime code must follow an allowlist-first rule:

- copy only approved fields;
- drop unknown fields by default;
- reject prohibited fields when the caller requests strict mode;
- never concatenate raw request data into a storage key;
- never log a full storage key if it contains more than approved labels;
- never persist raw identity preimages next to hashed keys.

## 10. Observability policy

Allowed observability fields for this key policy are:

- request ID;
- storage adapter kind;
- dependency adapter mode;
- rate-limit decision code;
- hashed quota key label;
- limit name;
- window key;
- endpoint path;
- provider mode;
- retry-after value when safe;
- duration or latency bucket.

Prohibited observability fields are the same as the prohibited storage key inputs:

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

## 11. Failure and fallback policy

If a future key builder receives missing, malformed, unknown, or prohibited key inputs, the live provider path must fail closed before provider execution.

Required safe-fail behavior:

- missing approved hash input → deny;
- malformed approved hash input → deny;
- prohibited raw input detected → deny;
- unknown identity scope → deny;
- key builder exception → deny;
- storage key unavailable → deny.

Canonical dependency-level safe-fail code remains:

```text
RATE_LIMIT_STORAGE_UNAVAILABLE
```

A future implementation may add a more specific internal diagnostic code, but endpoint-facing behavior must remain safe and non-sensitive.

## 12. Runtime implementation gates

Before any runtime storage key builder is implemented, the following evidence must exist:

- this contract is merged;
- a dedicated implementation issue exists;
- a disabled-by-default key builder scaffold contract exists;
- tests prove allowed fields are copied and prohibited fields are rejected or dropped;
- tests prove raw identifiers are not present in generated keys;
- tests prove logs do not contain raw identifiers or full unsafe keys;
- tests prove endpoint default remains `stub`;
- tests prove frontend default remains `local_stub`;
- tests prove no real KV, Durable Object, or D1 call is introduced;
- tests prove no live provider call is introduced.

## 13. Non-goals

This slice does not implement:

- runtime storage key builder;
- runtime hash helper;
- real KV access;
- real Durable Object access;
- real D1 access;
- persistent quota counters;
- endpoint behavior changes;
- frontend source selector changes;
- provider integration;
- deployment or secret changes;
- Browse #1661 work.

## 14. Current verdict

GO for contract/readiness documentation and contract tests.

NO-GO for runtime storage key builder implementation in this slice.

NO-GO for real KV, Durable Object, or D1 implementation in this slice.

NO-GO for endpoint, frontend, provider, deployment, or Browse #1661 changes in this slice.
