# Live Privilege Proof Packet — #4255 / #4256 / #4254

Docs-only authority packet prepared by KILO2 for Web CTO live privilege proof planning.

```text
STATUS = PREPARED / NOT EXECUTED
NO LIVE EXECUTION = YES (no DB connection, no SQL executed against any live database)
NO GRANT/REVOKE EXECUTED = YES
NO SECRETS / NO PRIVATE OUTPUTS / NO LIVE ROWS INCLUDED = YES
AUTHORITY FOR ANY MUTATION = Web CTO only (this packet authorizes nothing by itself)
```

Refs: #4255, #4256, #4254, #4000, #4004, #4006, #4112, #4131, #4157, #4217, #4238, #4283, #4311, #1882

Never close #1882; use `Refs #1882` only.

---

## 1. Issue scope

| Issue | Lane | Route | Gate | DB env |
|---|---|---|---|---|
| #4255 | Hub Layout GET read | `GET /api/trees/{id}/hub-layout` | `LB_HUB_LAYOUT_READ_RUNTIME=direct_neon` | `LOVE_PLATFORM_DATABASE_URL` |
| #4256 | Hub Layout PUT writer | `PUT /api/trees/{id}/hub-layout` | `LB_HUB_LAYOUT_WRITE_RUNTIME=direct_neon` | `LOVE_PLATFORM_WRITE_DATABASE_URL` |
| #4254 | Public Memory detail reactions | `GET /api/memories/{id}` (anonymous/public branch) | `LB_PUBLIC_MEMORY_DETAIL_RUNTIME=direct_neon` | `LOVE_PLATFORM_DATABASE_URL` |

This packet proves privilege state only. It does not activate gates, bind secrets,
deploy, or mutate any provider.

## 2. Source-derived dependency matrix

Verified against current main (`e6d39db72f8e44a38847275ec8c7023e514b10bd`):

| Source file | Statements | Tables touched |
|---|---|---|
| `functions/_shared/hub-layout-read-direct-neon.js` | `HUB_LAYOUT_OWNER_READ_SQL`, `HUB_LAYOUT_LATEST_READ_SQL` | SELECT `trees`; SELECT `tree_hub_layouts` |
| `functions/_shared/hub-layout-direct-neon.js` | `OWNER_TREE_SQL`, `HUB_LAYOUT_LOCK_SQL`, `LATEST_REVISION_SQL`, `INSERT_LAYOUT_SQL` | SELECT `trees`; `pg_advisory_xact_lock(bigint)`; SELECT `tree_hub_layouts`; INSERT `tree_hub_layouts` |
| `functions/_shared/public-memory-detail-direct-neon.js` | `PUBLIC_MEMORY_DETAIL_SQL` (one static SELECT) | SELECT `memories`; SELECT `trees` (INNER JOIN); SELECT `reactions` (correlated COUNT/GROUP BY aggregation only) |

Carry-forward caveat: all three helpers use **unqualified** table names
(`trees`, `tree_hub_layouts`, `memories`, `reactions`). The `public.*` privilege model
is only valid if the connected role's `search_path` resolves these to `public`.
Section 7 proves this before any extension is considered.

Additional source facts:

- `tree_hub_layouts.id` is TEXT supplied by application code (`crypto.randomUUID()`);
  no database sequence is used by any lane. Canonical migration
  `db/migrations/20260828070000_add-tree-hub-layouts.sql` records "No sequence" and
  the canonical adoption status remains `ADOPTION_REQUIRED` — relation existence is a
  stop-condition gate (Section 12).
- The FK `tree_hub_layouts.tree_id -> public.trees(id)` adds no grant requirement for
  the writer role (FK enforcement is not privilege-checked).
- `pg_advisory_xact_lock(bigint)` is a PostgreSQL built-in execution dependency, not an
  application-table grant.
- Reaction writes exist only in the separate `LB_MEMORY_REACTION_WRITE_RUNTIME` lane on
  the writer role; #4254 requires read-only aggregation.

## 3. Role identity placeholders

```text
<runtime_read_role> = dedicated Product application read role provisioned by #4112.
  Literal name is NOT present in repository source or issue bodies by design; it is held in
  the private role-mapping input consumed by
  scripts/run-production-readonly-runtime-role-acl-attestation.cjs (#4283 vehicle) and in
  #4112 completion evidence (Web CTO). Used by #4255 and #4254.
  RESOLVE BEFORE EXECUTION. If unresolvable or ambiguous: HOLD_RUNTIME_ROLE_IDENTITY_GAP,
  zero mutation.

<writer_role> = lb_product_rw_a3f8c2d1 (literal in #4256 body and repo evidence:
  canonical-neon-phase4-write-provenance-4005-4157.md, CANONICAL_SLICE_4006_ADOPTION_BASELINE_PACKET.md;
  boundary: LOVE_PLATFORM_WRITE_DATABASE_URL). Used by #4256.

NOT the runtime-read role: lb_ro_709d5f3e68f774d2 is the #4005 Phase-B
  CATALOG_METADATA_ONLY role. It must remain unchanged and must never be used as a target.
```

Target identity (from issue bodies; fresh re-verify at execution time):

```text
PROJECT = 133-relovetree / PROJECT_ID = proud-grass-75157219
DEFAULT_BRANCH = production / DEFAULT_BRANCH_ID = br-little-fire-a18brh25
DATABASE = neondb / RESOURCE_CLASS = CANONICAL_PRODUCT_AUTHORITY
```

## 4. Required present privileges

#4255 (`<runtime_read_role>`):

```text
CONNECT neondb                         = true   (#4112 baseline)
USAGE public                           = true   (#4112 baseline)
SELECT public.trees                    = true   (#4112 baseline)
SELECT public.memories                 = true   (#4112 baseline; other read routes)
SELECT public.tree_social_counts       = true   (#4131 baseline; other read routes)
SELECT public.tree_hub_layouts         = true|false -> drives this lane's decision
```

#4256 (`<writer_role>`):

```text
CONNECT neondb                          = true
USAGE public                            = true
SELECT public.trees                     = true   (#4157 baseline)
SELECT public.tree_hub_layouts          = true|false -> decision input
INSERT public.tree_hub_layouts          = true|false -> decision input
EXECUTE pg_advisory_xact_lock(bigint)   = true   (built-in default PUBLIC execute)
```

#4254 (`<runtime_read_role>`):

```text
SELECT public.memories                  = true   (#4112 baseline)
SELECT public.trees                     = true   (#4112 baseline)
SELECT public.reactions                 = true|false -> drives this lane's decision
```

## 5. Required absent privileges

All lanes, for the target role — each MUST read `false`:

```text
public.tree_hub_layouts: UPDATE, DELETE, TRUNCATE, REFERENCES, MAINTAIN
                         (plus INSERT for #4255/#4254 read role)
public.trees:            INSERT, UPDATE, DELETE, TRUNCATE
public.memories:         INSERT, UPDATE, DELETE, TRUNCATE
public.reactions:        INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
                         (plus TRUNCATE/REFERENCES for #4256 too)
sequences (public):      USAGE, SELECT, UPDATE — zero ACL lines
role attributes:         rolsuper=false, rolcreatedb=false, rolcreaterole=false,
                         rolreplication=false, rolbypassrls=false
role admin:              no admin_option=true membership grants held by target role
membership:              no inherited role conferring authority beyond documented baseline
```

#4256 additionally: no UPDATE/DELETE/TRUNCATE on `tree_hub_layouts`, no DDL, no broad
role authority, and no privileges outside the documented writer allowlist
(known precedent: `public.users` SELECT/INSERT/UPDATE per #4157;
`public.tree_appreciation_orders` SELECT/INSERT/UPDATE per #4257).

## 6. Read-only catalog proof SQL (common block, all lanes)

Run inside a `READ ONLY` session. The block contains only catalog views, `has_*`
privilege functions, `aclexplode`, `to_regclass`, and transaction control. It reads
**zero Product row bodies** and performs zero mutation.

`:'role'` is the psql variable for the resolved target role (Section 3).

```sql
BEGIN READ ONLY;

-- C1 identity / target
SELECT current_database(), current_user, session_user, current_role;

-- C2 role exists + bounded attributes (expect exactly 1 row; the five authority flags false)
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls,
       rolreplication, rolinherit, rolcanlogin
FROM pg_roles WHERE rolname = :'role';

-- C3 membership chain
SELECT r.rolname AS member, parent.rolname AS member_of,
       am.admin_option, am.inherit_option
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.member
JOIN pg_roles parent ON parent.oid = am.roleid
WHERE r.rolname = :'role';

-- C4 role-level ADMIN option (expect zero rows)
SELECT rg.rolname AS granted_to, gr.rolname AS granted_role, a.admin_option
FROM pg_auth_members a
JOIN pg_roles rg ON rg.oid = a.member
JOIN pg_roles gr ON gr.oid = a.roleid
WHERE a.admin_option = true AND rg.rolname = :'role';

-- C5 connect + schema usage
SELECT has_database_privilege(:'role', current_database(), 'CONNECT');
SELECT has_schema_privilege(:'role', 'public', 'USAGE');

-- C7 broad all-table privilege scan (expect exactly the documented lane allowlist)
SELECT n.nspname, c.relname, pr.privilege_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r'::"char", c.relowner))) pr
JOIN pg_roles g ON g.oid = pr.grantee
WHERE g.rolname = :'role'
  AND c.relkind IN ('r','p','v','m','f')
ORDER BY 1,2,3;

-- C8 column-level grants (expect zero rows)
SELECT c.relname, a.attname, pr.privilege_type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(a.attacl) pr
JOIN pg_roles g ON g.oid = pr.grantee
WHERE g.rolname = :'role' AND n.nspname = 'public' AND a.attnum > 0;

-- C9 sequence privileges (expect zero rows)
SELECT c.relname, pr.privilege_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('S'::"char", c.relowner))) pr
JOIN pg_roles g ON g.oid = pr.grantee
WHERE g.rolname = :'role' AND c.relkind = 'S' AND n.nspname = 'public';

-- C10 default-privilege widening (expect zero rows referencing :'role')
SELECT pg_get_userbyid(d.defaclrole) AS defined_for_owner, d.defaclacl::text
FROM pg_default_acl d
CROSS JOIN LATERAL aclexplode(d.defaclacl) pr
JOIN pg_roles g ON g.oid = pr.grantee
WHERE g.rolname = :'role';
SELECT count(*) AS any_default_acl_rows FROM pg_default_acl;  -- informational baseline

ROLLBACK;
```

## 7. search_path / public resolution check

```sql
-- C6 run in a session AS the target role (not as an admin observer):
SHOW search_path;

-- C6b ALTER ROLE SET search_path evidence (catalog-only, any observer):
SELECT d.datname, s.setconfig
FROM pg_db_role_setting s
JOIN pg_roles r ON r.oid = s.setrole
JOIN pg_database d ON d.oid = s.setdatabase
WHERE r.rolname = :'role';

-- C6c effective resolution order + unqualified-name resolution (as target role):
SELECT current_schemas(false);
SELECT to_regclass('trees')::text,
       to_regclass('tree_hub_layouts')::text,
       to_regclass('memories')::text,
       to_regclass('reactions')::text;
```

Gate: every unqualified name must resolve to `public.<name>`
(and `to_regclass('tree_hub_layouts')` must be non-NULL for the hub-layout lanes).
Any resolution outside `public`, any shadow schema earlier on the path, or NULL for a
required relation is a stop condition (Section 12). No grant may be executed against a
`public.*` target until this check passes for the exact target role.

## 8. Broad privilege checks

Defined by C3 + C4 + C7 + C8 in Section 6, scoped to the target role:

```text
PASS = relation ACL lines exactly match the documented lane allowlist (Section 4/5),
       zero column-level grants, zero admin_option memberships, no is_grantable rows.
FAIL = any additional relation/schema/database-level privilege -> STOP_BROAD_PRIVILEGES
       (report; do not revoke without separate Web CTO authority).
```

## 9. Default privilege widening checks

Defined by C10 (Section 6):

```text
PASS = zero pg_default_acl rows referencing the target role as grantee.
FAIL = any default-ACL row granting to the target role -> STOP_DEFAULT_PRIVILEGE_WIDENING.
Also record the informational total-row baseline so a later ALTER DEFAULT PRIVILEGES
is detectable on re-proof.
```

## 10. Lane-specific proof SQL and minimal extension / rollback templates

### #4255 Hub Layout GET (`<runtime_read_role>`)

```sql
-- Proof (read-only):
SELECT has_table_privilege(:'role','public.trees','SELECT')            AS trees_select;
SELECT has_table_privilege(:'role','public.tree_hub_layouts','SELECT') AS hub_layout_select;
SELECT has_table_privilege(:'role','public.tree_hub_layouts','INSERT') AS hub_layout_insert_must_be_false;
SELECT has_table_privilege(:'role','public.tree_hub_layouts','UPDATE') AS hub_layout_update_must_be_false;
SELECT has_table_privilege(:'role','public.tree_hub_layouts','DELETE') AS hub_layout_delete_must_be_false;
SELECT has_table_privilege(:'role','public.tree_hub_layouts','TRUNCATE') AS hub_layout_truncate_must_be_false;
```

```sql
-- Minimal extension ONLY if hub_layout_select = false, relation exists, USAGE public = true,
-- search_path gate passed, and separately authorized by Web CTO:
GRANT SELECT ON public.tree_hub_layouts TO <runtime_read_role>;

-- Exact rollback (only if exactly the above grant was applied):
REVOKE SELECT ON public.tree_hub_layouts FROM <runtime_read_role>;
```

Never grant INSERT/UPDATE/DELETE/TRUNCATE/sequence/DDL/writer authority here.
Never drop the shared read role.

### #4256 Hub Layout PUT (`<writer_role>` = `lb_product_rw_a3f8c2d1`)

```sql
-- Proof (read-only):
SELECT has_table_privilege(:'role','public.trees','SELECT')            AS trees_select;
SELECT has_table_privilege(:'role','public.tree_hub_layouts','SELECT') AS hub_select;
SELECT has_table_privilege(:'role','public.tree_hub_layouts','INSERT') AS hub_insert;
SELECT has_table_privilege(:'role','public.tree_hub_layouts','UPDATE') AS hub_update_must_be_false;
SELECT has_table_privilege(:'role','public.tree_hub_layouts','DELETE') AS hub_delete_must_be_false;
SELECT has_table_privilege(:'role','public.tree_hub_layouts','TRUNCATE') AS hub_truncate_must_be_false;
SELECT has_function_privilege(:'role','pg_catalog.pg_advisory_xact_lock(bigint)','EXECUTE')
       AS advisory_lock_execute;
```

```sql
-- Minimal extension (choose exactly one; only if proven missing; separately authorized):
GRANT SELECT, INSERT ON public.tree_hub_layouts TO <writer_role>;  -- both missing
GRANT SELECT ON public.tree_hub_layouts TO <writer_role>;          -- only SELECT missing
GRANT INSERT ON public.tree_hub_layouts TO <writer_role>;          -- only INSERT missing

-- Exact rollback (revoke ONLY the capability actually added):
REVOKE SELECT, INSERT ON public.tree_hub_layouts FROM <writer_role>;
```

Never re-grant a present capability; never bundle UPDATE/DELETE/TRUNCATE/sequence;
never drop the shared writer role. If `advisory_lock_execute = false`:
STOP_BUILTIN_EXECUTE_REVOKED (escalate; do not self-mutate function ACLs).

### #4254 Public Memory detail reactions (`<runtime_read_role>`)

```sql
-- Proof (read-only):
SELECT has_table_privilege(:'role','public.memories','SELECT') AS memories_select;
SELECT has_table_privilege(:'role','public.trees','SELECT')    AS trees_select;
SELECT has_table_privilege(:'role','public.reactions','SELECT') AS reactions_select;
SELECT has_table_privilege(:'role','public.reactions','INSERT') AS reactions_insert_must_be_false;
SELECT has_table_privilege(:'role','public.reactions','UPDATE') AS reactions_update_must_be_false;
SELECT has_table_privilege(:'role','public.reactions','DELETE') AS reactions_delete_must_be_false;
SELECT has_table_privilege(:'role','public.reactions','TRUNCATE') AS reactions_truncate_must_be_false;
```

```sql
-- Minimal extension ONLY if reactions_select = false (separately authorized):
GRANT SELECT ON public.reactions TO <runtime_read_role>;

-- Exact rollback (only if exactly the above grant was applied):
REVOKE SELECT ON public.reactions FROM <runtime_read_role>;
```

Sanctioned execution vehicle: `scripts/run-production-readonly-runtime-role-acl-attestation.cjs`
(#4283) already implements this catalog-only proof shape (BEGIN READ ONLY, private
role-mapping, targets `trees`/`memories`/`tree_social_counts`/`reactions`). Web CTO may run
that attestation instead of ad-hoc SQL for this lane. The #4283 unmapped-grantee
reconciliation must remain honored: public-memory-detail is classified `PRIVILEGE_BLOCKED
(see #4283)` in the #4311 readiness matrix; complete that reconciliation before extension.

## 11. Post-extension verification (read-only, after any authorized GRANT)

```sql
BEGIN READ ONLY;
-- Re-run the lane's has_table_privilege proofs; expect the extension target now true.
-- Re-run C7; expect the diff versus pre-extension to be EXACTLY the new ACL line(s)
-- and nothing else.
ROLLBACK;
```

## 12. Stop conditions (all lanes)

```text
HOLD_RUNTIME_ROLE_IDENTITY_GAP      <runtime_read_role> unresolvable/ambiguous from private mapping
HOLD_WRITER_ROLE_IDENTITY_GAP       writer role resolves to >1 login/role
STOP_WRONG_TARGET                   project/branch/database identity mismatch vs Section 3
STOP_RELATION_ABSENT                to_regclass('tree_hub_layouts') IS NULL -> canonical
                                    migration still ADOPTION_REQUIRED; route to schema-adoption
                                    lane, NOT a privilege mutation
STOP_SCHEMA_USAGE_GAP               has_schema_privilege USAGE public = false
STOP_SEARCH_PATH_NOT_PUBLIC         unqualified names do not resolve to public.* for target role
STOP_BROAD_PRIVILEGES               C7/C8 show privileges beyond documented allowlist
STOP_OVER_PRIVILEGED_REVIEW         UPDATE/DELETE already present on tree_hub_layouts (writer)
                                    or any write already present on reactions (read role):
                                    report; do not self-revoke without separate authority
STOP_ROLE_UNBOUNDED                 rolsuper/rolcreatedb/rolcreaterole/rolreplication/rolbypassrls true
STOP_DEFAULT_PRIVILEGE_WIDENING     pg_default_acl references target role
STOP_BUILTIN_EXECUTE_REVOKED        pg_advisory_xact_lock EXECUTE = false (writer lane)
HOLD_PROVIDER_METADATA_UNAVAILABLE  connector rejects catalog query (camelCase/snake_case recurrence)
UNKNOWN_STOP                        any catalog error / unreachable metadata -> zero mutation
```

## 13. No-live-execution statement

No statement in this document has been executed against any live database by KILO2.
This packet contains zero connection strings, zero credentials, zero live result rows.
KILO2 performed local source inspection and read-only issue lookup only.

## 14. No-secret / no-private-output statement

The artifact deliberately uses role-name placeholders (`<runtime_read_role>`) and private
mapping references instead of embedding secret values, DSNs, tokens, or provider
identifiers beyond public issue-recorded project identifiers already present in
governance docs. No Product row bodies, no live privilege outputs, and no secret material
are included.

---

Refs #4255 #4256 #4254 #4000 #4004 #4006 #4112 #4131 #4157 #4217 #4238 #4283 #4311 #1882
Keep #4000 / #4004 / #4006 / #1882 OPEN.
