# Post-#4346 Privilege Proof Handoff Checklist — #4255 / #4256 / #4254

Status: TEMPLATE-ONLY HANDOFF CHECKLIST. No live proof was executed by KILO2.
Pinned source of truth: `main` @ `ac5618c512bc7de8fdc372c58a637382b0cff88f`
(merged packet `docs/ops/privilege-proof/4255-4256-4254-live-proof-packet.md`).

Refs #4255 (Hub Layout GET privilege readiness)
Refs #4256 (Hub Layout PUT writer privilege readiness)
Refs #4254 (public Memory detail reactions privilege readiness)
Refs #4346 (schema adoption dependency)
Refs #4283 (runtime role reconciliation)
Refs #4311 (direct-Neon readiness matrix)

This checklist is for the future live executor (Web CTO or an explicitly delegated
operator with separate authorization). It sequences the merged live-proof packet into
execution phases and states what remains excluded. It proves nothing itself.

---

## 0. Scope and standing rules

- Every SQL fragment below is a **template**. Nothing in this document has been run.
- Catalog metadata only. No product row bodies, no DSNs, no role credentials, no
  connection strings may ever appear in executor output routed back to issues.
- Each lane returns **exactly one** decision. Never bundle lanes into a single grant.
- Writer lane target: `lb_product_rw_a3f8c2d1` (literal, packet §3).
- Runtime-read lane target: `<runtime_read_role>` — **no repo literal exists**; it is
  the private role-mapping input of
  `scripts/run-production-readonly-runtime-role-acl-attestation.cjs` (#4283 vehicle).
  Unresolvable or ambiguous → `HOLD_RUNTIME_ROLE_IDENTITY_GAP`.
- `lb_ro_709d5f3e68f774d2` is the #4005 CATALOG_METADATA_ONLY role and is **never** a
  privilege target for these lanes.

---

## PHASE 0 — Confirm #4346 schema state first

- [ ] P0.1 Catalog-only observer check:

  ```sql
  SELECT to_regclass('public.tree_hub_layouts');
  ```

- [ ] P0.2 If `NULL` → `STOP_RELATION_ABSENT` for the #4255/#4256 lanes. Canonical
  migration `db/migrations/20260828070000_add-tree-hub-layouts.sql` remains
  `ADOPTION_REQUIRED` at the pinned main. Route to the #4346 schema-adoption lane.
  No privilege GRANT may be considered for hub-layout lanes until adoption is proven.
- [ ] P0.3 If present → require Web CTO evidence that the applied schema matches the
  canonical migration file (catalog comparison only, e.g.
  `information_schema.columns WHERE table_name = 'tree_hub_layouts'`) before treating
  `ADOPTION_REQUIRED` as retired.
- [ ] P0.4 Note: #4254 does not depend on `public.tree_hub_layouts` (its relations are
  `memories` / `trees` / `reactions`), so P0 does not gate #4254's schema state —
  but #4254 remains gated by #4283 (see PHASE 2).

## PHASE 1 — Read-only role / identity / search_path / catalog proof (before any GRANT)

- [ ] P1.1 Identity:

  ```sql
  SELECT current_user, session_user;
  ```

  Writer lane must equal `lb_product_rw_a3f8c2d1`. Runtime-read lane resolved only via
  the #4283 private mapping; otherwise `HOLD_RUNTIME_ROLE_IDENTITY_GAP`.

- [ ] P1.2 search_path: helpers use **unqualified** table names (`trees`,
  `tree_hub_layouts`, `memories`, `reactions`), so they must resolve to `public.*` for
  the target role.

  ```sql
  SHOW search_path;
  -- plus catalog-only pg_roles.rolconfig evidence (packet §7)
  ```

  Failure → `STOP_SEARCH_PATH_NOT_PUBLIC`.

- [ ] P1.3 Catalog-only privilege inventory (`has_table_privilege`, `pg_class.relacl`,
  or `information_schema.role_table_grants`) for exactly:

  | Lane | Required present |
  | --- | --- |
  | #4255 | `SELECT` on `trees`, `SELECT` on `tree_hub_layouts` |
  | #4256 | `SELECT` on `trees`, `SELECT` + `INSERT` on `tree_hub_layouts` |
  | #4254 | `SELECT` on `memories`, `SELECT` on `trees`, `SELECT` on `reactions` |

  No table SELECT of product rows. Catalog metadata only.

- [ ] P1.4 Negative proof (do **not** grant):
  - `id` is TEXT / application-generated (`crypto.randomUUID`) → no sequence
    references → no `USAGE`/`SELECT` on sequences required.
  - #4256 advisory lock uses built-in `pg_advisory_xact_lock`
    (`functions/_shared/hub-layout-direct-neon.js:51`) → no GRANT. `advisoryLock:false`
    at `:304` is metadata, not a privilege dependency.
- [ ] P1.5 #4254 catalog-only proof runs through the sanctioned vehicle
  `scripts/run-production-readonly-runtime-role-acl-attestation.cjs` (#4283).

## PHASE 2 — Lane decision matrix (exactly one decision per lane)

- [ ] P2.1 **#4255 hub-layout-get** (matrix at pinned main: `PRIVILEGE_UNPROVEN`):
  - `STOP_RELATION_ABSENT` / `HOLD_SCHEMA_NOT_ADOPTED` — P0 fails
  - `HOLD_RUNTIME_ROLE_IDENTITY_GAP` — `<runtime_read_role>` unresolved
  - `STOP_SEARCH_PATH_NOT_PUBLIC` — P1.2 fails
  - `ALREADY_PRIVILEGED_NO_MUTATION_NEEDED` — P1.3 shows both SELECTs present
  - `GO_MUTATION_PREFLIGHT` — only the proven-missing SELECTs absent
  - `UNKNOWN_STOP` — otherwise
- [ ] P2.2 **#4256 hub-layout-put** (matrix at pinned main: `PRIVILEGE_UNPROVEN`):
  same gate set; `GO` resolves to exactly one of V1/V2/V3 by the missing subset
  (see PHASE 3).
- [ ] P2.3 **#4254 public-memory-detail** (matrix at pinned main:
  `PRIVILEGE_BLOCKED`, see #4283):
  - `HOLD_4283_OR_4311_BLOCKER` — **unconditional** at the pinned main, even if P1.3
    shows the source-matrix SELECTs provable. No GO decision is available for this
    lane until #4283 reconciliation closes.

## PHASE 3 — Minimal GRANT variants (templates only; only if separately authorized)

- [ ] P3.1 **#4255** (single variant; trim to relation(s) proven missing in P1.3):

  ```sql
  GRANT SELECT ON public.trees, public.tree_hub_layouts TO <runtime_read_role>;
  ```

- [ ] P3.2 **#4256** (exact variants, packet §10 lines 337–349):

  ```sql
  -- V1 (both SELECT and INSERT missing on tree_hub_layouts):
  GRANT SELECT, INSERT ON public.tree_hub_layouts TO lb_product_rw_a3f8c2d1;
  -- (+ GRANT SELECT ON public.trees only if proven missing)

  -- V2 (only SELECT missing; INSERT already present):
  GRANT SELECT ON public.tree_hub_layouts TO lb_product_rw_a3f8c2d1;

  -- V3 (only INSERT missing; SELECT already present):
  GRANT INSERT ON public.tree_hub_layouts TO lb_product_rw_a3f8c2d1;
  ```

- [ ] P3.3 **#4254**: no GRANT template may be executed while
  `HOLD_4283_OR_4311_BLOCKER` stands. Post-#4283 scope would be `SELECT` on
  `public.memories`, `public.trees`, `public.reactions` for the resolved runtime-read
  role — trim to the missing subset only.

## PHASE 4 — Exact rollback mirror variants (templates only)

- [ ] P4.1 Mirrors (1:1 inverse of the specific variant applied, never broader):

  ```sql
  -- V1 exact rollback:
  REVOKE SELECT, INSERT ON public.tree_hub_layouts FROM lb_product_rw_a3f8c2d1;
  -- (+ REVOKE SELECT ON public.trees only if granted in this variant)

  -- V2 exact rollback (must NOT revoke INSERT — it pre-existed the extension):
  REVOKE SELECT ON public.tree_hub_layouts FROM lb_product_rw_a3f8c2d1;

  -- V3 exact rollback (must NOT revoke SELECT — it pre-existed the extension):
  REVOKE INSERT ON public.tree_hub_layouts FROM lb_product_rw_a3f8c2d1;
  ```

- [ ] P4.2 Standing rules:
  - Never revoke any pre-existing capability.
  - Never `DROP` or `ALTER` shared roles; `REVOKE` object privileges only.
  - #4254 rollback mirrors apply only to grants made after #4283 reconciliation.
  - Post-extension re-proof follows packet §11 (read-only).

## PHASE 5 — Remains excluded from this handoff

Excluded until separately authorized, each by its own lane/issue:

- Runtime gate activation and readiness-matrix promotion (#4311 lane state changes)
- Cloudflare configuration or any edge mutation
- Product request / canary / any row-level production verification
- Issue closure for #4255 / #4256 / #4254 / #4346 / #4283 / #4311
- #1882 stays open; this document uses `Refs` only, never `Closes`/`Fixes`/`Resolves`
- Ready marking, merge, or any mutation authority held by Web CTO

---

## Executor report contract

A live run of this checklist must report per lane: phase outcomes, the single decision
from PHASE 2, the exact variant applied (if any), the paired rollback mirror, and stop
codes verbatim from packet §12. Output must contain no DSN, no row bodies, no secrets.

## Non-execution statement

KILO2 prepared this checklist from static repo inspection only:
DB connection = 0, SQL execution = 0, GRANT/REVOKE = 0, migration apply = 0,
production mutation = 0. No privilege state is claimed for any role.
