# Scout storage hash salt/version policy

Status: policy only. Issue: #2365. Refs #1882.

Rules:
- No real hashing in this slice.
- No salt or secret access in this slice.
- Future hashes need a version label.
- Future salts stay server-side only.
- Staging and production use separate namespaces.
- Rotation needs a rollback plan.
- Frontend never sees salts or hash keys.

Verdict: docs and contracts only. No runtime change.
