# Runtime Reliability Provider Preview Choreography — #4225 / #4082

Status: **SOURCE CORRECTION / NON-ACTIVATING**

Refs #4082. Refs #3461 — KEEP OPEN. Refs #1882 — ALWAYS KEEP OPEN.

This addendum supersedes only the stale Provider Preview deployment ladder in `RUNTIME_RELIABILITY_APPROVAL_PACKET_4082.md`. It does not supersede the packet's capability, privacy, read-only, synthetic-write, alert, or Production authority boundaries.

## Why this correction exists

Current Cloudflare Durable Object lifecycle uses the declarative `exports` model. With `exports` entries present:

- `wrangler versions upload` is not a valid lifecycle-preflight stage and fails fast;
- Durable Object lifecycle creation is applied by `wrangler deploy`;
- a normal `wrangler deploy` also applies the Wrangler config's Cron Trigger state;
- `crons = []` explicitly removes/keeps no Cron Triggers;
- omitted/undefined trigger configuration may leave previously deployed Cron Triggers in place.

Therefore the older sequence:

```text
versions upload
-> deploy DO without Cron
-> later triggers deploy
```

must not be executed as written.

## Wrangler compatibility floor

The declarative Durable Object `exports` lifecycle requires a Wrangler release
that understands and transmits that configuration shape. Provider Preview
operators must not rely on a dry-run from an older CLI that can parse the file
without applying the `exports` lifecycle during deployment.

Authoritative execution floor:

```text
DECLARATIVE_EXPORTS_WRANGLER_MIN_VERSION = 4.107.0
WRANGLER_SELECTION = EXACT_PIN_AT_OR_ABOVE_MINIMUM
DRY_RUN_DEPLOY_VERSION_EQUALITY = REQUIRED
BELOW_MINIMUM = STOP_ZERO_PROVIDER_MUTATION
EXPORTS_MODEL = RETAIN
LEGACY_MIGRATIONS_SWITCH = FORBIDDEN_IN_THIS_LANE
```

Before any Stage 2 provider mutation, record the exact Wrangler version and
require it to be at least `4.107.0`. Stage 1 dry-run and Stage 2 deploy must use
that same exact version. If the resolved version is below the floor, stop before
provider mutation. A failed attempt with an older CLI is not evidence that the
repository should revert from declarative `exports` to legacy `migrations`.

## Corrected fail-closed ladder

```text
1. SOURCE VALIDATION
   focused reliability-preview tests
   + exact-pinned Wrangler >= 4.107.0 deploy --dry-run only
   + record exact resolved Wrangler version
   PROVIDER MUTATION = NONE

2. DISABLED NONPROD PROVIDER DEPLOY
   explicit owner approval required
   same exact Wrangler version used by Stage 1 dry-run
   wrangler deploy using the checked-in reliability-preview config
   Worker/SQLite DO lifecycle may be created
   crons = []
   READ_ONLY sentinel = OFF
   ALERT delivery = OFF
   Production DB credential = ABSENT
   synthetic capability = ABSENT

3. DISABLED PROVIDER EVIDENCE
   prove Worker exists
   prove SQLite DO initializes
   prove Worker/DO fetch surfaces remain 404
   prove disabled sentinel causes zero read capability
   prove no Product/Production data access

4. CRON ATTACHMENT
   separate owner-approved mutation only
   target cadence candidate = */5 * * * *
   attachment is not implied by stage 2

5. READ-ONLY SENTINEL
   separate owner approval
   RELIABILITY_READ_ONLY_SENTINEL_ENABLED=true
   Production read authority still separately required

6. ALERT DELIVERY
   separate provider/secret approval
   RELIABILITY_ALERT_DELIVERY_ENABLED=true
   Slack App Incoming Webhook is selected-not-bound authority only

7. PRODUCTION
   explicit Web CTO / owner capability approval only
```

## Hard invariants

```text
EXPORTS_WITH_VERSIONS_UPLOAD = FORBIDDEN
DECLARATIVE_EXPORTS_WRANGLER_MIN_VERSION = 4.107.0
WRANGLER_SELECTION = EXACT_PIN_AT_OR_ABOVE_MINIMUM
DRY_RUN_DEPLOY_VERSION_EQUALITY = REQUIRED
BELOW_MINIMUM = STOP_ZERO_PROVIDER_MUTATION
EXPORTS_MODEL = RETAIN
LEGACY_MIGRATIONS_SWITCH = FORBIDDEN_IN_THIS_LANE
BASE_PROVIDER_DEPLOY_CRONS = []
BASE_PROVIDER_DEPLOY_READ_SENTINEL = OFF
BASE_PROVIDER_DEPLOY_ALERT = OFF
PRODUCTION_CREDENTIAL_IN_BASE_PREVIEW = NO
SYNTHETIC_CAPABILITY_IN_BASE_PREVIEW = ABSENT
CRON_ATTACHMENT = SEPARATE_OWNER_GATE
PROVIDER_PREVIEW_EXECUTED_BY_THIS_CHANGE = NO
PROVIDER_MUTATION = NONE
PRODUCTION_MUTATION = NONE
```

The checked-in `workers/reliability-preview/wrangler.reliability-preview.toml` is the fail-closed base deployment shape. A future owner-authorized Cron attachment must be an explicit provider/config mutation and must not silently broaden read-only, alert, or synthetic authority.

## Current gate consequence

```text
SOURCE_CHOREOGRAPHY_CORRECTION = PREPARED
ACTUAL_PROVIDER_PREVIEW = NOT_EXECUTED
READ_ONLY_SENTINEL_ACTIVATION = NO
ALERT_DELIVERY_ACTIVATION = NO
PRODUCTION_READ_AUTHORITY = NO
PRODUCTION_SYNTHETIC_WRITE_AUTHORITY = NO
C4_RUNTIME_BINDING_APPROVAL_PACKET_READY = NO
```

Refs #4225.
