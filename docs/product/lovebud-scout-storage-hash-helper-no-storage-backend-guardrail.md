# Scout storage hash helper no-storage-backend guardrail

Issue: #2361
Refs: #1882

Regression only.

The storage hash helper must not use storage backend tokens:
SCOUT_RATE_LIMIT_KV, SCOUT_RATE_LIMIT_DO, SCOUT_RATE_LIMIT_D1, DurableObjectNamespace, idFromName, getByName, prepare, batch, exec.

No runtime change. No real hashing. No