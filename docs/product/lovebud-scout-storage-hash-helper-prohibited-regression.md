# Scout storage hash helper prohibited regression

Status: regression only.
Issue: #2356.

Sanitizer may copy only `userKeyHash`.

It must not copy: token, authorization, email, apiKey, prompt, excerpt, sourceUrl.

No real hashing or storage work.
