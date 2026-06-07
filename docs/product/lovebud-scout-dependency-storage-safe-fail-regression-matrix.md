# LoveBud Scout Dependency Storage Safe-Fail Regression Matrix

Version: v20260608-1  
Status: regression matrix only / no runtime behavior expansion  
Parent issue: #1882  
Slice issue: #2347  
Depends on: #2345

## 1. Purpose

This document locks the dependency adapter storage safe-fail mapping matrix for the Scout live auth/rate-limit/storage boundary.

The goal is regression protection only. This slice documents expected mappings and adds contract coverage so future changes do not accidentally expose storage internals, key-builder internals, raw fields, or live storage/provider behavior.

## 2. Runtime scope

This slice should not expand runtime behavior.

Allowed scope:

- add this regression matrix document;
- add contract tests that inspect existing dependency adapter mapping behavior;
- preserve existing code behavior.

Disallowed scope:

- endpoint wiring change;
- real storage key generation;
- real hashing implementation;
- secret or salt access;
- real KV access;
- real Durable Object access;
- real D1 access;
- frontend source selector change;
- provider integration;
- deployment configuration;
- Browse #1661 work.

## 3. Regression matrix

| Storage adapter result code | Dependency adapter result code | Decision | Rationale |
| --- | --- | --- | --- |
| `STORAGE_PAYLOAD_PROHIBITED` | `RATE_LIMIT_PAYLOAD_PROHIBITED` | deny | Storage payload itself contained prohibited fields, so preserve payload-policy failure. |
| `STORAGE_NOT_IMPLEMENTED` | `RATE_LIMIT_NOT_IMPLEMENTED` | deny | Storage adapter is explicitly not implemented. |
| `STORAGE_MOCK_DISABLED` | `RATE_LIMIT_NOT_IMPLEMENTED` | deny | Default mock-disabled storage is a not-implemented safe-fail. |
| `STORAGE_KV_DISABLED` | `RATE_LIMIT_STORAGE_UNAVAILABLE` | deny | KV runtime scaffold is disabled. |
| `STORAGE_DURABLE_OBJECT_DISABLED` | `RATE_LIMIT_STORAGE_UNAVAILABLE` | deny | Durable Object runtime scaffold is disabled. |
| `STORAGE_D1_DISABLED` | `RATE_LIMIT_STORAGE_UNAVAILABLE` | deny | D1 runtime scaffold is disabled. |
| `STORAGE_CONFIG_MISSING` | `RATE_LIMIT_STORAGE_UNAVAILABLE` | deny | Storage runtime configuration is missing. |
| `STORAGE_KEY_BUILDER_DISABLED` | `RATE_LIMIT_STORAGE_UNAVAILABLE` | deny | Storage key builder is intentionally disabled and cannot provide a usable key. |
| `STORAGE_KEY_PAYLOAD_PROHIBITED` | `RATE_LIMIT_STORAGE_UNAVAILABLE` | deny | Key-builder payload policy failed; dependency boundary must not leak key-builder details. |
| unknown storage code | `RATE_LIMIT_STORAGE_UNAVAILABLE` | deny | Unknown storage result must fail closed. |
| missing storage code | `RATE_LIMIT_STORAGE_UNAVAILABLE` | deny | Missing storage result code must fail closed. |
| storage adapter throw | `RATE_LIMIT_STORAGE_UNAVAILABLE` | deny | Exceptions are swallowed to a storage-unavailable safe-fail. |

## 4. Boundary rule

The dependency adapter is the interpretation boundary. It may know storage adapter codes, but endpoint-facing behavior should only receive dependency-layer codes.

Storage-specific and key-builder-specific details must not leak beyond the dependency adapter. In particular, key-builder codes should be collapsed into `RATE_LIMIT_STORAGE_UNAVAILABLE`.

## 5. Default preservation

The regression matrix must preserve:

- dependency adapter default `mockDisabled: true`;
- endpoint default `stub`;
- frontend default `local_stub`;
- endpoint client disabled by default;
- no live provider call;
- no real storage backend call;
- no real storage key generation;
- no real hashing or salt access.

## 6. Contract expectations

Contract tests must verify:

- every matrix source code is documented;
- every matrix target code is documented;
- dependency adapter code recognizes the expected explicit source codes;
- `STORAGE_PAYLOAD_PROHIBITED` remains mapped to `RATE_LIMIT_PAYLOAD_PROHIBITED`;
- storage mock/not-implemented codes remain mapped to `RATE_LIMIT_NOT_IMPLEMENTED`;
- storage runtime scaffold and key-builder safe-fail codes remain mapped to `RATE_LIMIT_STORAGE_UNAVAILABLE`;
- unknown or missing storage code still fails closed to `RATE_LIMIT_STORAGE_UNAVAILABLE`;
- endpoint/frontend defaults are unchanged;
- no real storage, hashing, provider, or Browse #1661 work is introduced.

## 7. Current verdict

GO for regression matrix documentation and contract tests.

NO-GO for runtime behavior expansion, endpoint wiring, real key generation, real hashing, real storage backend access, frontend changes, provider integration, deployment changes, or Browse #1661 work in this slice.
