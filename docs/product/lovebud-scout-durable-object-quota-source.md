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

## Required Slice B stop property (exact transitional truth)

```text
DO adapter/backend result        = DO_QUOTA_* codes
DEPENDENCY MAPPER (unchanged)    = does not accept the DO codes
                                  -> RATE_LIMIT_STORAGE_UNAVAILABLE
CURRENT RATE-LIMIT BOUNDARY      = collapses any `allowed !== true` to
                                  rate_limited / RATE_LIMITED
CURRENT ENDPOINT RESPONSE        = HTTP 429 / RATE_LIMITED (fail-closed)
PROVIDER CALLS                   = 0
ENGINE CALLS FROM THIS PATH      = 0
```

The live dependency mapper is intentionally **not** modified: it maps unknown
storage result codes to `RATE_LIMIT_STORAGE_UNAVAILABLE`, so the new codes keep
failing closed.

Important correction: the current endpoint response is **429 / RATE_LIMITED**,
not 503 / RATE_LIMIT_UNAVAILABLE. The rate-limit boundary does not inspect the
limiter result code, so a storage-unavailable result and a genuinely exhausted
quota are indistinguishable at the endpoint today. This is a **pre-existing
boundary taxonomy gap**, not something Slice B may fix.

Slice C must make the runtime taxonomy precise:

```text
backend unavailable / config invalid -> 503 RATE_LIMIT_UNAVAILABLE
quota exhausted                      -> 429 RATE_LIMITED
admitted                             -> allowed
```

The contract assertions in `scout-durable-object-strict-quota-source-contract.test.cjs`
encode today's 429 / RATE_LIMITED behavior and are explicitly transitional.

## DI resolution precedence

The adapter resolves its Durable Object admission surface in a fixed order:

1. `stub` — an injected Durable Object stub double;
2. `backend` — an injected DO quota backend exposing the bounded
   `admit(request)` seam (backend-only injection is fully supported and needs
   no namespace or stub);
3. `namespace` — resolved through `idFromName` / `get`.

No env lookup, no runtime binding, no global is consulted.

## What is deferred to Slice C

- dependency result mapping for the DO codes;
- the precise runtime taxonomy (503 vs 429) described above;
- runtime composition in `suggest.js`;
- non-Production DO binding/config integration and migrations;
- staging proof.

### Slice C activation prerequisite 1 — Cloudflare runtime wrapper

`ScoutRateLimitDurableObjectQuota` is **backend logic source only**. It is not
directly bindable Cloudflare RPC runtime code as it stands. Cloudflare Durable
Object RPC requires public RPC methods on a registered runtime Durable Object
class, so Slice C must add (and verify) the actual runtime wrapper class
registration that delegates to this backend before any binding or migration is
even considered.

### Slice C activation gate 2 — object lifecycle / TTL decision

The canonical runtime key builder's default composite key **includes**
`windowKey`. When that key is used as `idFromName(storageKey)`, a new quota
window can resolve a new Durable Object identity.

Durable Object storage is persistent, so old window objects and their state
survive. A lifecycle decision is therefore locked as a **pre-activation gate**:

- either a bounded TTL / alarm design with `deleteAll()` cleanup, or
- an approved stable Durable Object identity design that still preserves
  quota-key separation.

Slice B does not implement cleanup because runtime activation is forbidden here.
**No non-Production Durable Object binding until this decision is resolved and
tested.**

No `wrangler.toml` change, no DO binding, no migration, no
`SCOUT_RUNTIME_RATE_LIMIT_BACKEND` / `SCOUT_RUNTIME_RATE_LIMIT_DO_BINDING`
lookup, and no `env.SCOUT_*` read exists in this slice.
