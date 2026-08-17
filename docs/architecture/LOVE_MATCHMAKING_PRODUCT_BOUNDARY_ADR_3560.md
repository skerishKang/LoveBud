# Love Matchmaking — Product Boundary ADR (Phase-0)

**Issue:** #3560
**Status:** Phase-0 architecture decision record — recommendation only.
**Important:** `RECOMMENDED != AUTHORIZED TO CREATE`. This ADR evaluates and recommends; it does not create a repository, package, service, or deployment.

Refs #3560
Refs #3425
Refs #1882 — Keep OPEN.

## 1. Decision context

Love Matchmaking introduces responsibilities that must not be forced into the current LoveBud/LoveTree UI and database:

```text
identity and discovery preferences
bilateral consent
explainable similarity
connection requests
blocking, reporting, moderation
age and minor-safety policy
harassment and spam prevention
messaging permissions
relationship intent
international / multilingual interaction
```

Direct shared-database coupling is **not** the default. The boundary must be explicit and versioned.

## 2. Options compared

### Option A — Separate repository + application

```text
- strongest product and security boundary
- independent design system and deployment
- explicit LoveBud data/API integration only
- higher operational overhead
```

### Option B — Same repository, isolated top-level package

```text
- shared infrastructure and contracts
- easier early experimentation
- risk of coupling matching responsibilities into the LoveBud application
- weaker security/privacy isolation unless carefully enforced
```

### Option C — Separate frontend + shared backend services

```text
- independent experience with selected shared identity/data services
- requires strict API, authorization, consent, and versioning boundaries
- medium operational overhead
```

## 3. Comparison matrix

| Dimension | A (separate repo/app) | B (same repo package) | C (shared backend) |
|---|---|---|---|
| Security isolation | Strongest | Weakest unless enforced | Strong |
| Privacy/consent boundary | Clean | At-risk | Requires strict contract |
| Account relationship | Explicit interop | Shared implicitly | Shared by design |
| Data deletion | Independent + propagation | Must share deletion path | Contract-driven |
| Deployment | Independent | Coupled | Partially coupled |
| API/versioning | Explicit | Shared surface risk | Explicit |
| Moderation | Independent | Coupled risk | Shared/integrated |
| Messaging isolation | Clean | At-risk | Contract-driven |
| Rollback | Independent | Coupled | Partial |
| Operational complexity | Highest | Lowest | Medium |
| Coupling risk | Lowest | Highest | Medium |

## 4. RECOMMENDED DIRECTION

```text
RECOMMENDED = OPTION A — separate repository/application
```

Rationale:

```text
- matching introduces safety/moderation/messaging responsibilities that must not be
  forced into the LoveBud/LoveTree UI and database
- a clean product and security boundary protects LoveBud's existing trust surface
- explicit, consent-aware, versioned interoperability keeps coupling low
- independent deployment and rollback reduces blast radius
- a distinct design identity is allowed without LoveBud visual parity
```

Trade-offs accepted:

```text
- higher operational overhead (separate deploy/CI/monitoring)
- explicit integration contract work is required up front
- account relationship and deletion propagation must be designed deliberately
```

## 5. Authentication, API, storage, consent, deletion, deployment model (target, future)

```text
authentication:   shared identity/account reference via explicit interop (no shared session table)
API:              versioned, consent-scoped, bounded export/import contracts
storage:          separate datastore; derived resonance profile in matchmaking domain only
consent:          opt-in, per-signal, revocable, propagated
deletion:         account-level deletion propagates to derived profiles (contract + job)
deployment:       independent pipeline, independent rollback
```

This is a **target model** for future design. Nothing here is implemented in Phase 0.

## 6. Explicit non-authorization

```text
NEW_REPOSITORY_CREATED = NO
PACKAGE_CREATED = NO
SERVICE_CREATED = NO
DEPLOYMENT_CHANGED = NO
DATABASE_CHANGED = NO
```

Refs #3560
Refs #3425 — Keep OPEN.
Refs #1882 — Keep OPEN.
