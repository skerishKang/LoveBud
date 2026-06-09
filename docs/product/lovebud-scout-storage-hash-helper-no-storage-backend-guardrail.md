# Scout storage hash helper no-storage guardrail

Issue: #2361
Refs: #1882

Regression only.

Storage backend markers covered by this guardrail:
SCOUT_RATE_LIMIT_KV, SCOUT_RATE_LIMIT_DO, SCOUT_RATE_LIMIT_D1, DurableObjectNamespace, idFromName, getByName, prepare, batch, exec.

No runtime change.
No real hashing.
