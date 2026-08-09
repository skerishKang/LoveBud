# Social operational retention policy

Status: source policy and bounded cleanup primitive only. Production scheduling/execution is not authorized by this document.

Refs #3942. Refs #3177. Refs #3075. Refs #3917. Refs #1882.

## Authoritative source-derived thresholds

| Table | Retention rule in this PR | Authority |
| --- | --- | --- |
| `social_idempotency` | keep at least 24 hours; only rows older than 24h are eligible | `migration-harden-moment-social-writes.sql` cleanup comment |
| `social_rate_limits` | keep at least 1 hour; only completed buckets older than 1h are eligible | `migration-harden-moment-social-writes.sql` cleanup comment |
| `tree_view_dedup_events` | keep the active 24-hour/equivalent dedup window; only windows whose start is older than 24h are eligible | `migration-add-tree-view-tracking.sql` |
| `social_audit_log` | `RETENTION_DECISION_REQUIRED`; no default deletion threshold | repository has an age index but no approved duration |

The audit log must not inherit the idempotency or rate-limit TTL. The cleanup tool refuses audit cleanup unless an operator supplies an explicit retention period after that policy is separately approved.

## Bounded cleanup contract

`scripts/social_retention_cleanup.py` is operator-invoked only and is not scheduled or deployed by this PR.

Safety properties:

- default mode is dry-run;
- database access uses the dedicated `LOVEBUD_RETENTION_DATABASE_URL` environment variable by default rather than implicitly consuming the application `DATABASE_URL`;
- table and time-column identifiers come from a fixed allowlist;
- each mutation batch selects ordered IDs through an indexed timestamp column and `LIMIT N`, then deletes only those IDs with `DELETE ... USING`;
- batch size is capped at 1,000 and batches per invocation are capped at 100;
- each batch commits independently, so one invocation has an explicit work budget;
- dry-run counts only the next bounded batch rather than issuing an unbounded whole-table count;
- output contains target names and aggregate counts only; it does not print actor IDs, Memory/Tree IDs, comment bodies, tokens, request keys, row IDs, database URLs, SQL errors, or raw exception text;
- no `VACUUM`, DDL, schema mutation, or automatic scheduling is included.

Example dry-run shape (not authorization to connect to Production):

```text
python scripts/social_retention_cleanup.py --target social_idempotency
```

Mutation mode exists for a separately approved operations action only:

```text
python scripts/social_retention_cleanup.py --target social_idempotency --batch-size 500 --max-batches 4 --apply
```

## Tree-view coordination

`tree_view_dedup_events` remains coordinated with #3917. Cleanup must never remove a row while its dedup window is active because doing so could allow a repeated view to be counted again. The current repository contract uses a 24-hour/equivalent bucket; this PR therefore retains at least 24 hours from `counted_window_start`.

If #3917 changes anonymous actor authority or the dedup-window contract, this retention policy must be re-reviewed before activation.

## Audit rows

`social_audit_log` deletion is intentionally disabled by default. A later product/operations decision must establish an audit retention period appropriate for incident investigation and accountability. Only then may an operator supply `--audit-retention-hours` for a separately approved run.

## Production activation gate

Before any Production schedule or cleanup execution, require a separate operations approval with sanitized aggregate evidence for:

1. row-count and age distribution by target table;
2. the relevant timestamp-index/query plan;
3. an explicit `social_audit_log` retention decision;
4. schedule/cadence and maximum per-run work budget;
5. failure/alert ownership;
6. a dry-run/count-only result containing aggregate counts only.

This PR performs no Production/Preview/real-database mutation and creates no scheduler.
