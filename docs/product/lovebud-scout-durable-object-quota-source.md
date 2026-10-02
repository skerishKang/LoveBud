# Scout Durable Object Strict Quota Source (#4536 Slice B)

Status: SOURCE ONLY / NOT RUNTIME-ACTIVATED
Base: `e4fa0cb6426a14c89200a269462b0cdba723061f`
Refs: #4536, #1882 (keep OPEN), #4390

## What this slice is

The preferred backend for strict per-key live quota counters is the Cloudflare
**Durable Object**. This slice implements that backend's source code and proves
its semantics in isolated, injected tests — and deliberately stops there.

New source modules:

- `functions/api/scout/live-rate-limit-durable-object-quota-backend.js`
  — bounded DO strict-quota backend with one serialized admission operation.
- `functions/api/scout/live-rate-limit-durable-object-adapter.js`
  — Scout-side DI-only adapter that resolves a Durable Object stub from an
  injected namespace and reuses the canonical sanitized runtime key.

## Backend selection authority

1. Durable Object first for strict serialized per-key quota counters.
2. KV only for coarse auxiliary / non-strict throttles.
3. D1 only for audit / reporting / lower-frequency policy state.

KV is **not** a first choice for a strict atomic counter, so this slice does not
implement one.

## Single serialized admission

`admit()` performs the quota decision *and* the persistent counter update inside
one serialized operation. There is no client-side `read -> allow -> later write`
split, so concurrent callers cannot oversubscribe.

Proven semantics (synthetic in-memory storage double):

- first request in a window admits and the counter becomes 1;
- requests through the configured limit N admit; request N+1 is denied with
  positive bounded `retryAfterSeconds`;
- concurrent/adversarial admissions never exceed N;
- a new `windowKey` resets the counter;
- storage exception → `DO_QUOTA_BACKEND_UNAVAILABLE` (never allow);
- malformed/untrusted persisted state → `DO_QUOTA_BACKEND_UNAVAILABLE`
  (never allow). A *missing* record is the only initializing path, under an
  explicit first-use contract.

An optional bounded `requestId` gives idempotent admission: replaying an
already-admitted id consumes no further quota. Idempotency metadata is bounded
by the quota limit itself and carries no user content.

## Result codes (local to the DO backend/adapter)

- `DO_QUOTA_ADMITTED`
- `DO_QUOTA_LIMITED`
- `DO_QUOTA_BACKEND_DISABLED`
- `DO_QUOTA_BACKEND_UNAVAILABLE`
- `DO_QUOTA_PAYLOAD_PROHIBITED`
- `DO_QUOTA_CONFIG_INVALID`

Outputs expose only bounded safe fields: `allowed`, `code`, `limit`,
`remaining`, `retryAfterSeconds`, bounded window metadata, `replayed`, and
sanitized adapter/backend mode + version. Never the DO id, raw storage key,
namespace object, persisted record, or exception detail.

## Key and privacy rules

Identity material is limited to the existing sanitized/hash seam, and the
Durable Object name is the canonical runtime key from
`functions/api/scout/live-rate-limit-storage-key-builder.js` — no new hashing
scheme is introduced. Raw Firebase UID, token/Authorization, email, decoded
claims, raw IP, session cookie/id, prompt, excerpt, sourceUrl, API key, secret,
and raw request/provider body are never a DO name, storage key, persisted value,
log field, or response field.

The backend is admission-only: there is no `releaseQuota` seam, because a
client-side refund would break strict atomicity.

## Required Slice B stop property

```text
DO BACKEND                       = can admit/persist in an isolated injected test
DEPENDENCY MAPPER (unchanged)    = does not accept the DO success/limited codes
ENDPOINT RATE LIMIT              = RATE_LIMIT_STORAGE_UNAVAILABLE / FAIL CLOSED
PROVIDER REACHED                 = NO
ENGINE REACHED FROM THIS PATH    = NO
```

The live dependency mapper is intentionally **not** modified: it maps unknown
storage result codes to `RATE_LIMIT_STORAGE_UNAVAILABLE`, so the new codes keep
failing closed.

## What is deferred to Slice C

- dependency result mapping for the DO codes;
- runtime composition in `suggest.js`;
- non-Production DO binding/config integration and migrations;
- staging proof.

No `wrangler.toml` change, no DO binding, no migration, no
`SCOUT_RUNTIME_RATE_LIMIT_BACKEND` / `SCOUT_RUNTIME_RATE_LIMIT_DO_BINDING`
lookup, and no `env.SCOUT_*` read exists in this slice.