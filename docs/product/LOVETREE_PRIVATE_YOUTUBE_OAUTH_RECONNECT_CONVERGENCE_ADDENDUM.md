# LoveTree Private YouTube OAuth — Reconnect / Credential Convergence Addendum

**Issue:** #4025  
**Parent Epic:** #4024  
**Product parent:** #3897 — Keep OPEN  
**Platform authority:** #4004  
**Base authority:** `LOVETREE_PRIVATE_YOUTUBE_OAUTH_AUTHORITY.md`  
**Status:** Normative future implementation addendum. No OAuth/provider/schema/Production/Preview implementation is authorized here.

---

## 1. Why this addendum exists

The base OAuth authority correctly selected:

```text
Google OAuth 2.0 server-side authorization-code flow
+ youtube.readonly
+ offline access
+ server-side encrypted refresh credential
+ actor-bound one-time state
```

One implementation-readiness ambiguity remained: what happens when an already-connected actor reconnects the **same canonical YouTube identity**, especially when the new authorization-code exchange does not contain a replacement `refresh_token`.

This addendum is normative for that lifecycle. Where the base authority says the reconnect uniqueness policy is a later decision, the rules below supersede that ambiguity for V1 implementation planning.

---

## 2. Canonical V1 connection convergence key

V1 must have one active connection authority for:

```text
application actor/account
+ provider = youtube
+ canonical provider identity
```

The canonical provider identity must be established server-side from the bounded post-exchange authorized YouTube identity check selected by the implementation. It must not be supplied or trusted from arbitrary browser input.

Logical invariant:

```text
same actor + youtube + same canonical provider identity
→ at most one active provider_connection authority
```

A reconnect of the same identity updates/converges the existing canonical connection. It must not silently create parallel active rows with independently usable long-lived credentials.

If the product later supports multiple YouTube identities for one actor, each distinct canonical provider identity may have its own connection. That does not weaken the one-active-authority rule for the same identity.

---

## 3. Reconnect when no new refresh token is returned

A reconnect authorization-code exchange may yield a valid access token while omitting a new refresh token.

Required behavior:

```text
existing canonical connection
+ existing still-usable encrypted refresh credential
+ reconnect succeeds for same provider identity
+ token response omits refresh_token

→ PRESERVE existing encrypted refresh credential
→ DO NOT replace it with NULL/empty
→ DO NOT create a second active connection
→ update only non-secret connection metadata that is valid to refresh
```

Absence of a new refresh token is **not** evidence that the old stored refresh credential should be deleted.

If no usable stored refresh credential exists and async/offline access is required, the connection must remain/re-enter an explicit reauthorization-required state rather than pretend that durable offline authority exists.

---

## 4. Reconnect when a new refresh token is returned

When the provider returns a replacement refresh token for the same canonical connection, rotation must be atomic with connection authority.

Required transaction semantics:

```text
verify actor + provider identity
→ encrypt new refresh token under current key version
→ advance credential generation/version
→ store new ciphertext + key version
→ update connection state/verification metadata
→ invalidate superseded credential generation
→ commit atomically
```

A crash/failure must not leave two independently authoritative active credential generations.

The old plaintext/ciphertext must never appear in API output, ordinary logs, issue comments, or client state.

---

## 5. Credential generation / fencing authority

The canonical provider connection must expose a server-side monotonic `credential_generation`, connection revision, or transactionally equivalent fencing value.

Exact schema names are not fixed by this document, but semantics are mandatory.

Any long-running import job that depends on provider access must record the provider connection authority/generation it was admitted under.

If that credential authority is later rotated, disconnected, revoked, or replaced:

```text
job using superseded credential generation
→ MUST NOT silently continue with stale credential authority
```

The implementation must select one explicit behavior:

```text
A. resolve/rebind through the current canonical connection after server-side validation
or
B. stop/fail/requeue with explicit reauthorization/rebind requirement
```

What is forbidden is continued hidden use of a superseded credential generation.

This connection-generation rule complements, but does not replace, #4027's async executor lease fencing.

---

## 6. Duplicate-active-connection prevention

The database/runtime contract must make the convergence invariant race-safe.

Unsafe behavior:

```text
request A reconnects identity X
request B reconnects identity X concurrently
→ two active connections / two usable credentials
```

Required result:

```text
concurrent same-identity reconnect
→ one canonical active connection authority
```

Implementation may use an appropriate uniqueness constraint, transaction/lock, upsert protocol, or equivalent reviewed mechanism aligned with the canonical shared schema.

Do not rely only on a pre-insert SELECT without race protection.

Raw uniqueness errors/SQLSTATE/constraint names must not reach the browser.

---

## 7. Disconnect / revoke convergence

Disconnect/revoke applies to the **canonical connection authority**, not merely one physical duplicate row.

After successful disconnect/revoke:

```text
active credential authority for that canonical connection = NONE
```

Required:

- connection status no longer authorizes provider access;
- stored refresh credential is deleted or cryptographically rendered unusable per implementation authority;
- every superseded generation remains unusable;
- queued/running jobs follow the explicit generation/rebind policy;
- reconnect after disconnect creates/reactivates authority only through a new verified OAuth flow;
- already snapshot-imported canonical LoveTree/Moment data is not implicitly deleted.

---

## 8. Required implementation tests

Future runtime implementation must include executable coverage for at least:

1. first connection creates one active canonical provider connection;
2. same-identity reconnect converges to the same active connection authority;
3. reconnect with no new refresh token preserves the existing usable encrypted refresh credential;
4. reconnect with a new refresh token atomically rotates ciphertext/key-version and advances credential generation;
5. concurrent same-identity reconnect cannot create duplicate active authorities;
6. different canonical provider identities remain distinct only if the selected V1 product policy permits them;
7. actor A cannot converge onto or mutate actor B's provider connection;
8. disconnect makes the canonical current and superseded credential generations unusable;
9. job admitted under an old credential generation cannot silently continue after rotation/revocation;
10. no access token, refresh token, authorization code, client secret, ciphertext, raw provider body, or database constraint detail leaks through API/log output.

Tests must use fakes/non-Production seams unless a separately authorized integration environment exists.

---

## 9. Reconciled OAuth authority verdict

The future OAuth authority is now interpreted as:

```text
PROVIDER_AUTH = GOOGLE_OAUTH_2_SERVER_SIDE_AUTH_CODE
MIN_SCOPE = youtube.readonly
OFFLINE_REFRESH = REQUIRED
ONE_ACTIVE_CONNECTION_PER_ACTOR_PROVIDER_IDENTITY = REQUIRED
RECONNECT_WITHOUT_NEW_REFRESH_TOKEN = PRESERVE_EXISTING_USABLE_CREDENTIAL
RECONNECT_WITH_NEW_REFRESH_TOKEN = ATOMIC_ROTATION
CREDENTIAL_GENERATION_FENCING = REQUIRED
DUPLICATE_ACTIVE_CONNECTIONS = FORBIDDEN
DISCONNECT_INVALIDATES_CANONICAL_CREDENTIAL_AUTHORITY = REQUIRED
RUNTIME_IMPLEMENTATION = NOT_YET_PERFORMED
PRODUCTION_OAUTH_CONFIG = NOT_AUTHORIZED
```

This addendum is future planning only. It does not authorize OAuth client creation, redirect configuration, provider calls, credential storage, schema migration, Production/Preview mutation, or a second LoveTree backend authority.

Refs #4025.  
Refs #4027.  
Refs #4031.  
Refs #4024.  
Refs #4004.  
Refs #3897 — Keep OPEN.  
Refs #1882 — Keep OPEN; use only `Refs #1882`.
