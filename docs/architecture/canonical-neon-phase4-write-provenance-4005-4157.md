# Canonical Neon Phase-4 Write Provenance Sync — #4005 / #4157

Parent authority: #4004  
Canonical schema/data provenance: #4005  
Phase-4 write cutover: #4157  
Historical schema-drift provenance: #3435  
Identity/auth authority: #4006  
Protected long-lived issue: #1882

## Purpose

This document records **already executed and already verified** canonical-production changes discovered during the #4157 Phase-4 Comment / Like / Fork write cutover. It is a provenance sync for the #4005 lineage trail; it does not authorize or perform any additional database, provider, secret, environment, or deployment mutation.

The repository baseline observed when this sync branch was created was:

```text
LoveBud main = ff64e5537a092633543c027c74100daf31bbb8bd
```

That SHA is evidence for this synchronization event only. Current authority must always be fresh-read from GitHub and the live provider before future mutable work.

## 1. Why this sync is required

The original #4005 audit correctly treated current provider state as fresh-query-required, but its detailed live catalog snapshot predates the later #4157 cutover work. During the authenticated Tree Fork cutover, fail-closed runtime probes exposed two canonical-vs-contract gaps that were repaired under separate explicit CTO/owner GO decisions.

This file narrows the delta to those executed changes so future workers do not incorrectly reuse the older catalog snapshot as current truth.

## 2. Writer-role `users` privilege completion

The canonical `public.users` table was created by the separately governed #4006 canonical identity slice. The dedicated #4157 application writer role already had an approved least-privilege matrix that included `users` SELECT / INSERT / UPDATE, but the table was created after the role's initial grants and therefore did not inherit those privileges.

On 2026-08-22, after a fail-closed authenticated fork probe proved the privilege gap and after explicit CTO authorization, the owner/migration context executed exactly:

```sql
GRANT SELECT, INSERT, UPDATE ON public.users TO lb_product_rw_a3f8c2d1;
```

Recorded evidence in #4157 shows:

```text
before = SELECT false / INSERT false / UPDATE false
after  = SELECT true  / INSERT true  / UPDATE true
```

The application writer role was not given DELETE, DDL, SUPERUSER, CREATEDB, or CREATEROLE authority. This was completion of the previously approved matrix, not an expansion into a broader writer.

## 3. `trees.forked_from_tree_id` contract restoration

The Tree Fork direct-Neon adapter, the Modal Tree Fork implementation, and the PostgreSQL contract fixture all require a nullable text lineage column:

```text
public.trees.forked_from_tree_id text NULL
```

The canonical production catalog did not contain that column when #4157 first activated the Fork gate. The authenticated probe failed closed before any durable write, so the missing column was classified as a pre-existing #4005 / #3435 canonical-vs-contract drift rather than a defect introduced by the gate.

After explicit CTO authorization and a fresh provider/remote preflight, the owner/migration context executed exactly:

```sql
ALTER TABLE public.trees
  ADD COLUMN IF NOT EXISTS forked_from_tree_id text;
```

Recorded #4157 catalog evidence:

```text
before = 11 columns; forked_from_tree_id ABSENT
after  = 12 columns; forked_from_tree_id text; nullable YES
```

No FK was added. No other table or column was changed by this statement. This repairs one current contract gap while #3435 remains open for historical provenance/recovery tracking; it does **not** reactivate the obsolete seven-column restoration path described in the old #3435 incident body.

## 4. Runtime proof after convergence

The write gate sequence remained independently controlled:

```text
Tree Comment = direct-Neon LIVE
Tree Like    = direct-Neon LIVE
Tree Fork    = direct-Neon LIVE + FUNCTIONAL
```

The final #4157 Tree Fork verification, after the schema/privilege corrections and PR #4170 timestamp-cast fix, recorded:

```text
unauthenticated marker probe:
  HTTP 401 AUTHORIZATION_REQUIRED
  x-lovebud-upstream: direct-neon

authenticated fork smoke:
  HTTP 200
  x-lovebud-runtime: direct_neon
  x-lovebud-route-status: fork-complete
  lineage binding present
```

The final CTO judgment classified Phase-4 direct-Neon write-path cutover as **3/3 COMPLETE**, while keeping #4157 open only for the two bounded follow-ups documented there: this provenance synchronization and the Comment/Like timestamp-cast audit.

## 5. Provenance and lifecycle reconciliation

```text
#4005 = canonical schema/data provenance authority; issue itself is closed/completed,
        but its documents are historical lineage and must be extended when later
        approved production changes alter the observed catalog.

#3435 = KEEP OPEN_HISTORICAL_PROVENANCE.
        Current old seven-column incident is resolved; the 2026-08-22
        forked_from_tree_id addition is a later partial contract-drift repair.

#4006 = canonical Product account/auth identity authority for public.users.

#4157 = Phase-4 write-cutover authority; do not close until both bounded follow-ups land.

#1882 = ALWAYS KEEP OPEN.
```

## 6. Safety boundary of this PR

```text
PRODUCTION_DDL_DML_MUTATION = NO
ROLE_GRANT_REVOKE_MUTATION = NO
SECRET_ENV_MUTATION = NO
CLOUDFLARE_DEPLOYMENT_MUTATION = NO
AUTH_PROVIDER_MUTATION = NO
SOURCE_RUNTIME_MUTATION = NO
DOCUMENTATION_PROVENANCE_SYNC_ONLY = YES
```

This document must not be treated as permission to re-run either SQL statement. Any future provider mutation requires a fresh target-identity check and separate explicit authorization under the then-current parent issues.
