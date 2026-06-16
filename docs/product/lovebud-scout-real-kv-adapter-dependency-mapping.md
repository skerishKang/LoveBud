# LoveBud Scout Real-KV Adapter Dependency Mapping

**Issue context:**
- PR context: #2594
- Parent MVP: #1882

## Status
- This mapping connects the disabled real-KV adapter result codes to the Scout storage dependency safe-fail taxonomy.
- The real KV adapter is not executed and does not access any KV bindings.

## Overview
This document specifies how the result codes from the disabled real-KV adapter are mapped to safe-fail responses in the dependency adapter layer.
This ensures that the `KV_ADAPTER_*` codes correctly trigger a safe-fail (`RATE_LIMIT_STORAGE_UNAVAILABLE`) in the dependency response.

This adheres to the activation gates in #2584/#2585 and respects the schema and TTL policy established in #2586/#2588.
It also references the disabled real-KV adapter scaffold from #2589/#2592.

## Mapping
The following codes from the real-KV adapter:
- `KV_ADAPTER_DISABLED`
- `KV_ADAPTER_NOT_IMPLEMENTED`
- `KV_ADAPTER_BINDING_UNAVAILABLE`
- `KV_ADAPTER_UNTRUSTED_STATE`

Are mapped to:
```json
{
  "allowed": false,
  "released": false,
  "code": "RATE_LIMIT_STORAGE_UNAVAILABLE"
}
```

Unknown adapter codes and thrown mapping errors also result in a safe-fail `RATE_LIMIT_STORAGE_UNAVAILABLE` response.
There is no automatic allow behavior on missing, malformed, stale, or untrusted quota state.
