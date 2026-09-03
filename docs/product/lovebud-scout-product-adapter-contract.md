# LoveBud Scout Product Adapter Contract — S1

Refs #1882

Keep #1882 open

## Status

```text
SLICE = S1_SCOUT_PRODUCT_ADAPTER_CONTRACT_ISOLATION
SCOUT_PRODUCT_CONTRACT_ISOLATED = YES
DIRECT_PROVIDER_RUNTIME_REMOVED = NO
DIRECT_PROVIDER_RUNTIME_AUTHORITY = LEGACY_MIGRATION_REFERENCE_ONLY
ENGINE_RUNTIME_ACTIVATED = NO
B14_RUNTIME_ACTIVATED = NO
CORE_EXTENSION_CREATED = NO
PRODUCTION_BEHAVIOR_CHANGED = NO
```

This document freezes the LoveBud-owned Product Adapter boundary before the later Engine/B14 migration. It does not activate a new runtime.

## Canonical direction

```text
Scout UI
  ↓
Scout Product Adapter Contract
  ├─ local_stub
  └─ endpoint_client
         ↓
     execution-service seam
```

The later S4 target is Padiem AI Engine. The Product Adapter contract itself must not change merely because the execution-service target changes.

## LoveBud-owned Product intent

The Product Adapter may express only bounded LoveBud intent:

- Scout task intent (`link_to_lovetree_moment`)
- output profile (`scout_suggestion_v1`)
- source URL or approved input reference
- user-provided excerpt/summary/memo
- requested language
- desired tone
- bounded output length
- fan-facing presentation requirements represented by the Scout output profile

The Product Adapter contract is allowlist-only. Supplying unrelated fields does not add them to the normalized Product intent.

## LoveBud-owned Product output

The stable fan-facing suggestion shape is:

- `titleSuggestion`
- `summarySuggestion`
- `translationSuggestion`
- `emotionTags`
- `memoSuggestion`
- `safetyNote`

Provider routing metadata, Core-internal Evidence objects, and execution-service diagnostics are not part of this fan-facing Product output.

## Explicitly outside the Product Adapter contract

The following are not part of the Product Adapter contract and must not become required Product fields:

- Provider API key
- Provider endpoint
- exact Provider name
- exact model routing logic
- Provider timeout/retry policy
- Provider fallback policy
- Provider transport implementation
- Core-internal Evidence representation
- Core-internal grounding implementation details

Product auth, user rate-limit, and entitlement enforcement remain LoveBud service-boundary responsibilities. They are separate from Provider credential/routing ownership.

## Preserved S1 assets

S1 preserves, without redesign:

- `local_stub` as the default source
- `endpoint_client` as the explicit opt-in source seam
- existing Scout draft flow
- emotion-tag validation/presentation semantics
- Memory draft construction
- LoveTree Memory payload conversion
- LoveTree persistence bridge
- preview/confirm/save flow
- explicit user save requirement

S1 does not add the future artist/member/fandom/era/event transformer. Fan-domain enrichment remains later Product work, primarily S6.

## Legacy direct Provider path

The current staging/test direct Provider implementation remains present for migration and behavior-parity reference only:

```text
DIRECT_PROVIDER_RUNTIME_REMOVED = NO
DIRECT_PROVIDER_RUNTIME_AUTHORITY = LEGACY_MIGRATION_REFERENCE_ONLY
```

S1 does not delete its safety gates, move credentials, invoke a real Provider, change Production configuration, or activate Engine/B14.

## Later migration boundary

S4 may change the `endpoint_client` execution-service target to Padiem AI Engine while preserving this Product contract. S5 may then retire LoveBud-owned generic Provider execution only after Engine/B14 replacement parity is proven and separately authorized.

No direct `LoveBud → Core` runtime coupling is authorized by this contract.
