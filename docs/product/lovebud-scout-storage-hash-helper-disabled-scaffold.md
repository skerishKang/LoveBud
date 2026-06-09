# Scout storage hash helper disabled scaffold

Status: disabled scaffold.
Issue: #2351. Parent: #1882. Depends: #2349.

The helper is disabled. It returns ok false, disabled true, code STORAGE_HASH_HELPER_DISABLED, and hash null.

Forbidden: real hashing; salt access; crypto calls; KV; DO; D1; endpoint wiring; frontend change