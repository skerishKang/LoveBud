# Scout Storage Hash Namespace Rollback Policy

Status: docs/tests only. No runtime change.

Parent issue: #1882
Depends on: #2368

Policy:
- Namespace rotation must include rollback guidance.
- Rollback must identify the previous namespace version label.
- Rollback must keep staging and production separate.
- Rollback must not auto-promote preview/dev namespaces to production.
- Rollback must not expose salts, namespace secrets, or hash keys.
- Rollback evidence must be reviewed before production use.

Non-goals:
- No real hashing.
- No salt or secret access.
- No KV/DO/D1.
- No endpoint wiring change.
- No frontend default source change.
- No provider integration.
- No Browse #1661 work.
