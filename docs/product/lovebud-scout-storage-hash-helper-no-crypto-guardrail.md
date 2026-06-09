# Scout hash helper no-crypto guardrail

Status: contract only.
Issue: #2358.

The storage hash helper must not use crypto, HMAC, salt, secret, KV, Durable Object, D1, provider SDK, fetch, endpoint wiring, frontend wiring, or Browse #1661.

Allowed now: disabled helper, sanitizer, null hash, null preview.
