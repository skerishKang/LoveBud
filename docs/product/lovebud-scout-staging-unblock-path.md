# LoveBud Scout Staging Unblock Path

**Version:** 20260618-staging-unblock-path-1  
**Status:** PLAN / CONTRACT ONLY — no runtime activation  
**Refs:** #2660, #2636  
**Parent:** #1882 — keeps #1882 open

## Purpose

This document defines the next safe path after the #2636 Cloudflare Preview
smoke reached the live auth boundary but did not reach the provider boundary.
It separates the current AI model staging blocker from provider/model
activation.

This slice does not change runtime code. It does not enable the AI model path,
production live mode, frontend provider calls, or normal CI network calls.

## Current #2636 smoke state

The latest sanitized Preview smoke evidence records:

- `missing-auth`: pass, safe unauthorized result
- `invalid-auth`: pass, safe unauthorized result
- authenticated success / provider path: blocked before provider execution
- blocker: the staging auth verifier is mock-disabled and returns a safe auth
  failure for bearer tokens
- provider path reached: no
- production activation: blocked

## Decision summary

The existing `STAGING` verifier mode remains **DI-only**.

It must not be activated by a Cloudflare environment variable. It remains for
contract tests and injected test dependencies only.

The recommended future unblock path is a separate Preview-only verifier plan,
not a direct change to the existing `STAGING` mode:

1. Keep the current `STAGING` mode DI-only.
2. Add a future docs/contracts slice for a Preview token-hash verifier surface.
3. Add a later implementation slice only after the contract is reviewed.
4. Keep that implementation disabled-by-default and Preview-only.
5. Use sanitized hash comparison only; never store or record bearer token values.
6. Continue to treat rate-limit storage as a separate gate. If auth is unblocked
   first, the next smoke may still stop at the rate-limit boundary until a safe
   staging rate-limit strategy exists.

## Proposed future Preview verifier surface

A future implementation may define a Preview-only verifier that accepts the
staging bearer token only by comparing a derived hash with a platform-managed
secret hash.

Suggested future configuration names are placeholders for the future PR:

| Name | Kind | Rule |
| --- | --- | --- |
| `SCOUT_PREVIEW_VERIFIER_ENABLED` | env var | explicit `true` required |
| `SCOUT_PREVIEW_VERIFIER_MODE` | env var | explicit `token_hash` required |
| `SCOUT_PREVIEW_TOKEN_HASH` | Cloudflare Secret | hash only, never the bearer token |
| `SCOUT_SUGGEST_PROVIDER_STAGE` | env var | must be `staging` |

These names do not activate anything in this slice. They are reserved design
candidates only.

## Required future activation conditions

A future Preview verifier implementation must require all of the following:

1. `SCOUT_SUGGEST_PROVIDER_STAGE` is exactly `staging`.
2. `SCOUT_PREVIEW_VERIFIER_ENABLED` is explicitly `true`.
3. `SCOUT_PREVIEW_VERIFIER_MODE` is explicitly `token_hash`.
4. `SCOUT_PREVIEW_TOKEN_HASH` is present as a Cloudflare Secret.
5. The bearer token value is never logged, returned, persisted, or recorded.
6. Only a non-reversible token hash may be compared.
7. The response may expose only sanitized `userKeyHash` metadata.
8. Production stage values must safe-fail.
9. Missing configuration must safe-fail.
10. Any verifier exception must safe-fail.

## Required future rollback / kill-switch

A future Preview verifier implementation must be immediately disabled by any of
these actions:

- set `SCOUT_PREVIEW_VERIFIER_ENABLED=false`
- unset `SCOUT_PREVIEW_TOKEN_HASH`
- set `SCOUT_SUGGEST_PROVIDER_STAGE` to any value other than `staging`
- set `SCOUT_SUGGEST_PROVIDER_MODE=stub`
- redeploy the previous known-good build

Rollback evidence must be recorded without token values, secret values, prompt
text, excerpt text, source URLs, or raw provider output.

## What remains blocked

The following remain blocked by this plan:

- production activation
- `production_live`
- real Firebase Admin SDK import
- real production token verification
- real external auth service call
- real provider API call in normal CI
- frontend provider call
- persistent rate-limit storage
- automatic save or persistence of provider responses
- recording secret values, bearer token values, prompt text, excerpt text,
  source URL text, or raw provider responses

## Acceptance criteria for this plan slice

- This document exists and cites #2660 and #2636.
- #1882 remains open.
- The existing `STAGING` verifier mode remains DI-only.
- The document defines a future Preview token-hash verifier as a separate path.
- The document states that no runtime activation happens in this slice.
- The document states that production remains blocked.
- A contract test verifies no production activation, no frontend default change,
  no raw token or secret propagation, and no normal CI provider/network call.

## Next slice after this plan

After this plan is merged and reviewed, the next safe slice is:

`[TECH] Add Scout Preview token-hash verifier contract`

That next slice should still be docs/contracts-first. Runtime implementation
must remain a separate, disabled-by-default, Preview-only PR.
