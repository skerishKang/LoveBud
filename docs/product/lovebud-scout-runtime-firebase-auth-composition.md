# LoveBud Scout — Runtime Firebase Auth Composition (Issue #4536 Slice A)

- **Issue**: #4536 Slice A (parent #1882 — must remain OPEN; portfolio #4390)
- **Status**: SOURCE ONLY / DISABLED BY DEFAULT — pushed for CENTRAL review, no PR
- **Scope**: compose the existing Cloudflare-edge Firebase ID-token verifier into
  the Scout live auth dependency chain behind one explicit opt-in runtime gate
- **Non-scope**: persistent rate limiting (Slice B), provider activation, Engine
  activation, Cloudflare/Service Binding/secret mutation, Durable Object/KV/D1
  provisioning, Production/Preview deploy

## Gate

```text
SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED=true
```

- Default / absent / any value other than `true` → **OFF**.
- The gate is supported in code only. No checked-in config (including
  `wrangler.toml`) activates it.
- Gate OFF preserves the current mock-disabled behavior exactly: no shared
  verifier construction, no JWK fetch, no raw token handoff, and no endpoint
  default change.

## Composition (gate TRUE, no injected live dependencies)

1. Build the shared Firebase verifier lazily from current `FIREBASE_PROJECT_ID`
   authority via `readFirebaseProjectId(env)` +
   `createFirebaseIdTokenVerifier(...)` from
   `functions/_shared/firebase-id-token-verifier.js`.
2. Construct the existing Scout verifier adapter in `FIREBASE_RUNTIME` mode
   (`live-auth-verifier-adapter.js`).
3. Construct the existing dependency adapter with `mockDisabled:false`,
   that verifier adapter, and `allowRawTokenHandoff:true`
   (`live-auth-rate-limit-dependency-adapter.js`).
4. Use the existing auth boundary factory with `includeIdTokenForVerifier:true`
   (`live-auth-rate-limit-boundary.js`) so the parsed Bearer token exists only
   in the in-memory verifier handoff.
5. After verification, only the sanitized `userKeyHash` (16 lowercase hex)
   crosses the Scout verifier/dependency boundary.

Implementation lives in `functions/api/scout/runtime-auth-composition.js`.
`functions/api/scout/suggest.js` only selects the composition inside the LIVE
branch; injected live dependencies (`context.liveAdapter`,
`context.liveDependencies`, `context.verifyToken`) keep precedence, and
construction failure returns a fail-closed `firebase_runtime_unavailable`
result that falls back to the existing mock-disabled path.

No Firebase Admin SDK. No second JWT verifier. No new network call at module
import time.

## Critical stop property

Persistent rate limiting is **not implemented** in Slice A, so even when
Firebase auth succeeds:

```text
AUTH = VERIFIED
RATE_LIMIT = UNAVAILABLE / FAIL_CLOSED
PROVIDER_REACHED = NO
ENGINE_REACHED_FROM_THIS_PATH = NO
```

A verified request stops at `RATE_LIMIT_UNAVAILABLE` / 503 with provider
transport call count 0. The rate-limit safe-fail is not weakened to make an
end-to-end request succeed.

## Sanitization

Raw token, Authorization header, UID, email, decoded claims, JWK body, and
verifier exception detail never enter the response, observer metadata, storage,
or the composition result. Sensitive-field leak count is proved 0 by contract
tests.

## Evidence

`tests/contracts/scout-runtime-firebase-auth-composition-contract.test.cjs`
(synthetic/local fixtures only) proves:

1. gate absent/false → no verifier construction, no JWK fetch, mock-disabled
   endpoint response preserved;
2. gate true + missing/malformed Bearer → auth safe-fail, no JWK fetch;
3. gate true + invalid Firebase token (bad signature / wrong audience) → auth
   safe-fail, provider 0;
4. gate true + valid synthetic Firebase token/JWK → sanitized VERIFIED
   (`^[0-9a-f]{16}$` userKeyHash only);
5. VERIFIED + no persistent limiter → `RATE_LIMIT_UNAVAILABLE` / 503 with
   provider transport calls = 0;
6. sensitive field leak count = 0 across response/observer/composition;
7. frontend default `local_stub`, Engine gate/default, and Production provider
   stage block unchanged;
8. checked-in config never enables the gate;
9. reuse-only composition (no Firebase Admin SDK, no second verifier, no
   persistent rate-limit backend).

## Next slice (not implemented here)

Slice B owns the persistent quota backend. Per existing policy, a Durable
Object is the preferred backend for a strict per-key atomic quota; KV is not
the first choice for a strict atomic counter.
