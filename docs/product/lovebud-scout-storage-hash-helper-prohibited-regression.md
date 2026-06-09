# Scout storage hash helper prohibited regression

Status: regression only.
Issue: #2356.

The hash helper sanitizer may copy only `userKeyHash`.

It must not copy: token, authorization, email, apiKey, prompt, excerpt, sourceUrl.

No real hashing, salt, secret, KV, Durable Object, D1, endpoint, frontend, provider, or Browse #1661 work is