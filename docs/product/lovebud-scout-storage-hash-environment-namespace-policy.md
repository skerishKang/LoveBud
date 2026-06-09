# Scout Storage Hash Environment Namespace Policy

Status: docs/tests only. No runtime change.

Parent issue: #1882
Depends on: #2365

Policy:
- Staging and production must use separate namespaces.
- Future preview/dev namespaces must stay isolated.
- Every namespace needs an explicit version label.
- Frontend must not see salts, namespace secrets, or hash keys.
- Preview/dev namespaces cannot promote to production automatically.
- Namespace rotation needs rollback guidance.

Non-goals:
- No real hashing.
- No salt or secret access.
- No KV/DO/D1.
- No endpoint wiring change.
- No frontend default source change.
- No provider integration.
- No Browse #1661 work.
