# LoveBud Scout Storage Safe-Fail Fallback Docs Alignment

Version: v20260607-2  
Status: explicit mapping alignment  
Parent issue: #1882  
Slice issue: #2334  
Previous contracts: PR #2329, PR #2333

## 1. Purpose

This note records the current LoveBud Scout rate-limit storage mapping position after the explicit dependency-adapter mapping slice.

The important conclusion is narrow:

> Disabled rate-limit storage scaffold outcomes now have explicit dependency-adapter mapping to `RATE_LIMIT_STORAGE_UNAVAILABLE`.

This remains a safe-fail scaffold alignment. It does not add a storage backend and does not change endpoint or frontend behavior.

## 2. Current behavior

The storage adapter scaffold may expose disabled/config-missing storage outcomes such as:

- `STORAGE_KV_DISABLED`
- `STORAGE_DURABLE_OBJECT_DISABLED`
- `STORAGE_D1_DISABLED`
- `STORAGE_CONFIG_MISSING`

The live dependency adapter now explicitly maps these outcomes to a fail-closed dependency result:

```text
allowed: false
code: RATE_LIMIT_STORAGE_UNAVAILABLE
```

The generic unknown storage-code fallback remains in place for future unrecognized storage outcomes.

## 3. Promotion from fallback-only to explicit mapping

Earlier slices used the existing unknown storage-code fallback as the safe path for disabled storage scaffold outcomes.

That was acceptable while the project was still validating the scaffold boundary.

This slice promotes the known disabled/config-missing scaffold outcomes from fallback-only behavior to explicit mapping behavior, while preserving the same canonical dependency result: `RATE_LIMIT_STORAGE_UNAVAILABLE`.

## 4. Why this is acceptable for the current slice

The current project phase is still scaffold and contract validation, not live runtime storage implementation.

For this phase, the desired behavior is:

- deny by default;
- do not allow live traffic because a storage backend is disabled;
- do not silently pass rate-limit checks;
- do not introduce KV / Durable Object / D1 access;
- do not add endpoint-level storage wiring;
- do not change the frontend source selector.

The explicit mapping satisfies that requirement because known disabled/config-missing storage outcomes become `RATE_LIMIT_STORAGE_UNAVAILABLE` deterministically.

## 5. Explicit non-goals

This alignment does not implement any of the following:

- real KV storage;
- real Durable Object storage;
- real D1 storage;
- persistent quota counters;
- endpoint default behavior changes;
- frontend default source changes;
- provider API integration;
- production or staging rollout.

## 6. Runtime guardrails

The following guardrails remain unchanged:

- endpoint default remains `providerMode: "stub"`;
- frontend source selector default remains `local_stub`;
- endpoint client remains disabled by default;
- no real provider call is introduced;
- no real storage backend is introduced;
- no raw token, API key, prompt, excerpt, source URL, raw request body, or raw model output should be propagated into storage payloads.

## 7. Future implementation note

A later runtime storage implementation may replace disabled scaffold responses with real backend quota decisions.

That future slice should be separate and should include:

- storage backend selection policy;
- backend-specific adapter contract tests;
- updated error taxonomy documentation;
- rollback / kill-switch confirmation;
- observability field allowlist confirmation;
- staging-live and production-live gate checks.

Until then, explicit disabled/config-missing mapping to `RATE_LIMIT_STORAGE_UNAVAILABLE` is the intended safe scaffold position.

## 8. Current verdict

GO for explicit mapping alignment only.

NO-GO for real storage runtime implementation in this slice.
