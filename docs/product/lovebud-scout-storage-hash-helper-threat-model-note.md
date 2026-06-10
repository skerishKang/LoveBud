# Scout Storage Hash Helper Threat Model Note

Status: docs/tests only. No runtime change.

Parent issue: #1882
Depends on: #2376

Threat model status: Pre-implementation note only.

Threat surfaces to review:
- Salt exposure.
- Namespace secret exposure.
- Hash key exposure.
- Environment namespace confusion.
- Preview/dev promotion to production.
- Rollback to the wrong namespace version.
- Frontend exposure of secrets or hash internals.

Out of scope:
- No real hashing.
- No salt or secret access.
- No KV/DO/D1.
- No endpoint wiring change.
- No frontend default source change.
- No provider integration.
- No Browse #1661 work.
