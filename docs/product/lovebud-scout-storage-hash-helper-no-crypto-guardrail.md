# Scout storage hash helper no-crypto guardrail

Status: regression only.
Issue: #2360.
Refs: #1882.

The storage hash helper must stay disabled.
It must not use crypto digest, createHash, HMAC, salt, secret, KV, Durable Object, D1, provider SDKs, endpoint wiring, frontend wiring, or Browse #1661.