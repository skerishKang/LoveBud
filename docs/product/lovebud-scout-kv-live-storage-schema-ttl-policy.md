# LoveBud Scout KV Live Storage Schema and TTL Policy

Version: v20260617-1
Status: schema and TTL policy audit / no runtime behavior change
Parent issue: #1882 (must remain OPEN; never auto-close)
Slice issue: #2586
References: #2584, #2585, `docs/product/lovebud-scout-kv-skeleton-activation-gates.md`

## 1. Purpose

This document defines the key/value schemas, namespace constraints, and TTL/quota-window policies for the future Scout KV Rate-Limit Storage backend. 

This slice is audit/docs/contracts-only. It does not introduce any real KV binding or runtime storage operations.

## 2. KV Key Schema Policy

### 2.1 Namespace & Prefix Policy
- **Key Prefix**: All rate-limiting keys stored in KV must use the dedicated namespace prefix `scout:rl:v1:`.
- **Key Versioning**: The prefix includes the version (`v1`) to allow schema migrations without collisions with legacy records.

### 2.2 Key Components
- **Allowed Components**: Only the following sanitization-approved components may be concatenated to build a key:
  - `userKeyHash` (16-char hex identifier derived from the verifier)
  - `ipHash` (16-char hex identifier derived from client IP)
  - `sessionKeyHash` (16-char hex identifier)
  - `endpointPath` (e.g. `/api/scout/suggest`)
  - `providerMode` (e.g. `stub`, `live`)
  - `limitName` (e.g. `hourly`, `daily`)
  - `windowKey` (timestamp-based window identifier)
- **Prohibited Components**: Under no circumstances shall any raw identifiers, tokens, authorization headers, prompt text, source URLs, or provider secrets enter the key.
- **Identifier Hashing**: Any user identifier, IP, or session token must be hashed via a secure one-way hashing seam before prefixing.
- **Key Collision Handling**: The key structure must be deterministic and ordered (e.g. `scout:rl:v1:<limitName>:<userKeyHash>:<windowKey>`) to prevent cross-account or cross-endpoint collisions.

## 3. KV Value Schema Policy

### 3.1 Value JSON Shape
The value in the KV store must be a flat, serialized JSON object.

### 3.2 Allowed Value Fields
- `allowed` (boolean: indicating if the client is within quota)
- `remaining` (number: remaining allowed requests in the current window)
- `resetTimeMs` (number: UTC timestamp indicating when the current window resets)
- `reason` (string: descriptive flag/reason for logging or debugging)
- `schemaVersion` (number: schema version identifier, strictly `1`)

### 3.3 Prohibited Value Fields
No raw prompts, raw request bodies, raw provider responses, raw model outputs, source text, translated text, summaries, or credentials may be stored in the KV record.

### 3.4 Exception & Corruption Handling
- **Malformed/Corrupted Value**: If a retrieved record is not valid JSON or lacks mandatory fields (e.g. `resetTimeMs`), the adapter must safe-fail and return `RATE_LIMIT_STORAGE_UNAVAILABLE`.
- **Missing Value**: A missing KV record must not be treated as an unconditional automatic allow. A future real-KV implementation may initialize a first-use quota record only after the key schema, schema version, quota window config, TTL write capability, and explicit real-KV activation gate are all validated. If any of those checks cannot be proven, the adapter must safe-fail to `RATE_LIMIT_STORAGE_UNAVAILABLE`.
- **Stale/Expired Value**: If `resetTimeMs` is in the past, the record must be treated as expired, and the quota must be reset to the maximum allowed limit.

## 4. TTL & Quota-Window Policy

### 4.1 Record TTL Boundaries
- **Minimum TTL**: 60 seconds (1 minute).
- **Maximum TTL**: 86400 seconds (24 hours).
- **TTL Set Policy**: Every write operation (`put`) must explicitly specify an expiration time matching the window's remaining duration plus a safety buffer (e.g. 5 minutes) to ensure stale records are auto-reclaimed by Cloudflare KV.
- **Freshness Verification**: Even if KV returns a record, the adapter must verify the timestamp locally. If local time exceeds `resetTimeMs`, the data must be discarded.
- **Quota Resets**: When a rate-limit window resets, the record must be updated with a reset count and a new `resetTimeMs` and TTL.
- **TTL Failures**: If KV fails to set a TTL, the adapter must safe-fail to prevent persistent locking.

## 5. Privacy & No-Leak Rules

To guarantee compliance, the following sensitive fields must **never** be stored in the KV key/value record, logged to console/logs, or returned in client-visible responses:
1. Raw auth tokens (`Authorization` header contents).
2. Prompt text or model input strings.
3. Excerpt, source URL, or metadata scrape outputs.
4. Raw user identifiers (UIDs, email addresses, phone numbers).
5. Raw session identifiers.
6. Full KV keys in client-visible API responses.
7. External provider API request/response bodies or provider secrets.

## 6. Current-State Locks

This policy confirms that the current codebase meets all of the following rules:
- **No Real KV Operations**: No `env.SCOUT_RATE_LIMIT_KV`, `env.KV`, `global.KV`, or `globalThis.KV` is accessed.
- **No Live Storage**: No `get`, `put`, `list`, or `delete` is invoked.
- **No DB Integration**: No Durable Object, D1, postgres, or database runtime changes are made.
- **Defaults**:
  - Endpoint default remains `stub` in `suggest.js`.
  - Frontend source selector default remains `local_stub`.
  - Endpoint client remains disabled by default.
  - Parent issue #1882 remains open.
