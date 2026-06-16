# LoveBud Scout Real-KV Adapter Interface Scaffold

**Issue context:**
- PR context: #2589
- Parent MVP: #1882

## Status
- This is a scaffold.
- It is disabled by default.
- It does **not** access real KV.
- No binding access is allowed.

## Overview
This document describes the interface seam for the future real-KV adapter for LoveBud Scout.
Currently, all methods return a safe-fail result because the implementation is purely a scaffold and does not interact with the Cloudflare KV binding.
This adheres to the activation gates in #2584/#2585 and respects the schema and TTL policy established in #2586/#2588.

## Interface methods
- `readQuotaRecord`
- `writeQuotaRecord`
- `deleteQuotaRecord`
- `buildQuotaKey`
- `parseQuotaRecord`
- `validateQuotaRecordFreshness`

All these methods currently return a strict safe-fail response:
```json
{
  "allowed": false,
  "released": false,
  "code": "KV_ADAPTER_DISABLED",
  "reason": "..."
}
```

No automatic allow behavior on failure, missing, or malformed states.
