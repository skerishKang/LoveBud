# Scout storage hash salt/version policy

Status: policy only. Issue: #2365. Refs #1882.

Rules:
- No real hashing in this slice.
- No salt or secret access in this slice.
- Future hashes need a version label.
- Future salts must stay server-side only.
- Staging and production must not share hash namespace.
- Rotation needs a rollback plan.
- Frontend must never see salts, secrets