# Define Scout KV Skeleton Activation Gates

Version: v20260617-1
Status: activation gates audit / no runtime behavior change
Parent issue: #1882 (must remain OPEN; never auto-close)
Slice issue: #2584
References: #2581, #2582

## 1. Purpose

This document defines the explicit activation gates and requirements that must be met and contract-locked before the Scout Rate-Limit Storage can move from the disabled-by-default `STORAGE_KV_SKELETON` mode to any real Cloudflare KV binding adapter.

This slice is audit/docs/contracts-only. It does not change any runtime code or introduce any live storage operations.

## 2. Current State Reference

As established in PR #2582:
- `STORAGE_KV_SKELETON` constant exists in the storage adapter.
- `kv_skeleton` mode exists in the storage adapter.
- The dependency adapter maps `STORAGE_KV_SKELETON` to `RATE_LIMIT_STORAGE_UNAVAILABLE` (safe-fail).
- The current implementation **is a skeleton only**:
  - No real Cloudflare KV binding is referenced or checked (no `env.KV`, global `KV`, or `globalThis.KV`).
  - No real storage operations (`get`, `put`, `list`, `delete`) are implemented.
  - No database, Durable Object, D1 instance, external API, or `fetch` calls are accessed.
  - No secrets, credentials, or client/provider SDKs are loaded.
  - No real quota persistence or allow decisions are performed.

## 3. Required Gate Decisions & Future Constraints

Before moving to a real KV binding, the following design constraints and validation criteria must be implemented and contract-locked in future slices:

### 3.1 Environment Binding & Config Policy
- **Exact Future Env Binding Name**: The binding name for the rate-limiting KV store must be named strictly `env.SCOUT_RATE_LIMIT_KV` (or a standardized config naming pattern).
- **Activation Mode/Feature Flag**: Real KV backend activation must require an explicit, separate opt-in config mode (e.g. `storageMode: 'kv_live'` or `storageMode: 'kv'`), separate from `kv_skeleton`.
- **Default Config Fallback**: If the KV binding is missing or config is invalid, the storage adapter must fail-safe and return `STORAGE_CONFIG_MISSING` / `STORAGE_KV_DISABLED` rather than throwing uncaught exceptions or defaulting to allow.

### 3.2 Safe-Fail & Rollback Posture
- **Safe-Fail Code**: Any lookup failure, network timeout, or binding error must map to `RATE_LIMIT_STORAGE_UNAVAILABLE` at the dependency boundary.
- **Rollback/Kill-Switch**: There must be a configuration flag or runtime environment switch to immediately fall back to `MOCK_DISABLED` or `KV_SKELETON` without redeploying code, in case of storage provider degradation.

### 3.3 Data Leaks & Privacy Controls
- **No-Leak Behavior**: Key names, previews, raw identifiers, tokens, authorization headers, prompt text, source URLs, and provider secrets must be guaranteed never to be logged, printed, or exposed in rate-limiting keys or adapter responses.
- **Staging-Only Validation**: Real KV bindings must be deployed and validated in a staging environment (`staging_live` context) and confirmed correct before any production path (`production_live`) is authorized.

### 3.4 Dependency Adapter Mapping
- The dependency adapter must map all intermediate storage codes (including `STORAGE_KV_SKELETON` and future `STORAGE_KV_DISABLED`) to `RATE_LIMIT_STORAGE_UNAVAILABLE` to keep the endpoint protected until a real KV path is explicitly approved and wired.

## 4. Current-State Locks

This audit confirms that the following safety boundaries are intact:
1. **Default Storage Adapter**: Remains strictly mock-disabled (`MOCK_DISABLED` / `mock_disabled`).
2. **KV Skeleton Mode**: `kv_skeleton` remains a non-live, disabled skeleton that safe-fails (`allowed: false`, `released: false`).
3. **No Real KV Binding**: No access to `env.KV` or any KV namespace exists in the codebase.
4. **No Real Storage Operations**: No `get`, `put`, `list`, or `delete` calls are present.
5. **No DB / External Dependencies**: No D1, Durable Object, fetch, or database integration exists in the Scout rate-limiting files.
6. **Defaults**:
   - Endpoint default remains `stub`.
   - Frontend source selector default remains `local_stub`.
   - Endpoint client remains disabled by default.
7. **Parent Issue #1882**: Remains open and active.
