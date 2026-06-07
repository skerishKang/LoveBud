# LoveBud Scout Storage Safe-Fail Fallback Docs Alignment

Version: v20260607-1  
Status: docs-only alignment  
Parent issue: #1882  
Slice issue: #2330  
Previous contract: PR #2329

## 1. Purpose

This note records the current LoveBud Scout rate-limit storage fallback position after PR #2329.

The important conclusion is narrow:

> Disabled rate-limit storage scaffold outcomes are currently covered by the existing dependency-adapter unknown storage-code safe-fail fallback. They fail closed as `RATE_LIMIT_STORAGE_UNAVAILABLE` without adding explicit runtime mapping.

This is a documentation alignment slice only. It does not add a storage backend and does not change endpoint or frontend behavior.

## 2. Current behavior

The storage adapter scaffold may expose disabled/config-missing storage outcomes such as:

- `STORAGE_KV_DISABLED`
- `STORAGE_DURABLE_OBJECT_DISABLED`
- `STORAGE_D1_DISABLED`
- `STORAGE_CONFIG_MISSING`

The live dependency adapter already has a generic unknown storage-code fallback. When an unrecognized storage result reaches the dependency adapter, it returns a fail-closed dependency result:

```text
allowed: false
code: RATE_LIMIT_STORAGE_UNAVAILABLE
```

Therefore the current safe path is not explicit per-backend mapping. It is the existing canonical fallback path.

## 3. Why this is acceptable for the current slice

The current project phase is still scaffold and contract validation, not live runtime storage implementation.

For this phase, the desired behavior is:

- deny by default;
- do not allow live traffic because a storage backend is disabled;
- do not silently pass rate-limit checks;
- do not introduce KV / Durable Object / D1 access;
- do not add endpoint-level storage wiring;
- do not change the frontend source selector.

The existing fallback satisfies that requirement because disabled or unrecognized storage outcomes become `RATE_LIMIT_STORAGE_UNAVAILABLE`.

## 4. Explicit non-goals

This alignment does not implement any of the following:

- real KV storage;
- real Durable Object storage;
- real D1 storage;
- persistent quota counters;
- endpoint default behavior changes;
- frontend default source changes;
- provider API integration;
- production or staging rollout.

## 5. Runtime guardrails

The following guardrails remain unchanged:

- endpoint default remains `providerMode: "stub"`;
- frontend source selector default remains `local_stub`;
- endpoint client remains disabled by default;
- no real provider call is introduced;
- no real storage backend is introduced;
- no raw token, API key, prompt, excerpt, source URL, raw request body, or raw model output should be propagated into storage payloads.

## 6. Future implementation note

A later runtime storage implementation may replace the fallback-only behavior with explicit mappings for backend-specific disabled/config-missing outcomes.

That future slice should be separate and should include:

- explicit dependency-adapter mapping tests;
- updated error taxonomy documentation;
- storage backend selection policy;
- rollback / kill-switch confirmation;
- observability field allowlist confirmation;
- staging-live and production-live gate checks.

Until then, the fallback-only behavior is the intended safe scaffold position.

## 7. Current verdict

GO for docs alignment only.

NO-GO for real storage runtime implementation in this slice.
