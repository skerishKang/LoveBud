# LoveBud Changeability and Production Parity Audit

> Read-only architecture audit foundation for #3425.
> This document maps change-cost and production-parity risks with repository evidence. It proposes
> prioritized child issues only. It does **not** implement, rewrite, migrate, deploy, or mutate anything.
> This audit does **not** close #3425; #3425 remains open as the parent tracking issue.

## Baseline

- Repository: `skerishKang/LoveBud`
- Audit branch: `audit/changeability-production-parity-3425`
- Baseline `origin/main` SHA: `ecc50370928e5ef35ebd5bde286fdf79dab4e34f`
- Audit method: read-only inspection of the repository at the baseline SHA. No production/staging
  access, no DB connection, no Cloudflare/Modal deploy, no runtime mutation.
- Evidence levels used in this document:
  - `CONFIRMED` — directly observed in repository files at the baseline SHA.
  - `LIKELY` — strongly implied by repository evidence but not directly proven.
  - `UNKNOWN` — cannot be determined from the repository alone.

Related open issues (all OPEN at audit time, not closed by this work): #3418, #3419, #3423,
#3188, #3075, #1882. PR #3424 (`db/tree-comments-legacy-reconcile-3423`) is 컴1 work in the
Social / `tree_comments` area and is out of scope for this audit; its files and branch are not
modified, checked out, or depended upon here.

## Executive findings

1. **Repository SQL files encode partial migration/schema intent, not a complete authoritative
   current-schema source of truth** (CONFIRMED). They are not a complete authoritative source of truth
   because: no complete `CREATE TABLE` definition exists for all production-critical tables such as
   `trees`; no applied-migration ledger / schema-version record exists; and the deployed schema cannot be
   reconstructed from repository artifacts alone.
2. **Migrations use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`** (CONFIRMED). If an
   incompatible object already exists in production, a migration can silently preserve the wrong shape.
3. **Migration contract tests are source/static/regex SQL-text only** (CONFIRMED). On current `main` they
   assert the SQL text via regex (no grammar parse); PR #3424's branch additionally adds a `pglast` grammar
   parse as static validation. Neither executes SQL against PostgreSQL. A green CI does not prove a
   migration runs.
4. **No CI test executes SQL against a real PostgreSQL engine** (CONFIRMED). Across `tests/smoke`,
   `tests/routes`, `tests/contracts`, `.github/workflows/ci.yml`, and `package.json`, `pg`/`Pool`/`psql`/
   `pool.query`/`DATABASE_URL`/`postgres` appear only in out-of-CI ops scripts (`scripts/verify-*.cjs`,
   `scripts/seed-*.cjs`); `ci.yml` defines no PostgreSQL service/container or DB execution step. There is
   **no actual PostgreSQL execution** in CI.
5. **`npm run ci` is static/structural plus mocked-logic contracts** (CONFIRMED). It guarantees lint
   hygiene, `index.html` presence, JS syntax, i18n key consistency, route *file* existence, and
   fake/mock contract logic — not real Cloudflare/Modal/Neon runtime, applied schema, or browser behavior.
6. **No deployment revision manifest links `main` SHA → Cloudflare → Modal → DB schema** (CONFIRMED).
   Deployed-SHA match is a manual reporting field, not an automated manifest.
7. **Editor and public viewer share un-prefixed class names and mutable `window.*` globals**
   (CONFIRMED). A broad `!important` or global rule can regress the other surface. 299 `!important`
   occurrences exist across 223 CSS files.
8. **Legacy structures are retained without a single retirement registry or removal plan**
   (CONFIRMED). Transitional adapters, `window.*` compatibility globals, and Modal legacy normalization
   coexist with canonical paths.

This audit deliberately avoids a repository-wide rewrite. It decomposes the above into small,
domain-separated child issues (see Recommended child issues).

## Evidence and methodology

- Inspection target: repository working tree at `ecc50370928e5ef35ebd5bde286fdf79dab4e34f`, fresh clone.
- Tools: `git`, `gh`, repository file reads, and `grep` (ripgrep) over `scripts/`, `tests/`,
  `css/`, `js/`, `functions/`, `modal_compute/`, and `docs/`.
- Boundaries honored:
  - No checkout/modification of PR #3424 branch `db/tree-comments-legacy-reconcile-3423`.
  - No production/staging DB query or mutation.
  - No Cloudflare/Modal deployment.
  - No Docker, local PostgreSQL, or disposable PostgreSQL execution.
  - No secret, token, cookie, private endpoint, DB URL, raw UUID, request ID, or private log is
    printed or recorded.
- Claims are tagged CONFIRMED / LIKELY / UNKNOWN. Speculation is not presented as fact.
- The companion contract test (`tests/contracts/changeability-production-parity-audit-contract.test.cjs`)
  verifies this document contains the required sections and boundaries; it does **not** assert that any
  implementation code exists.

## Database schema source of truth

> Repository `scripts/*.sql` files encode *partial* migration/schema intent. They are **not** a complete
> authoritative current-schema source of truth: the repository has no complete `CREATE` definition for all
> production-critical tables (e.g. `trees`), no applied-migration ledger / schema-version record exists, and
> the deployed schema cannot be reconstructed from repository artifacts alone.

**Repository migrations (CONFIRMED, `scripts/*.sql`):**

| Table(s) | Migration file | Line |
|---|---|---|
| `memories`, `reactions`, `comments` | `scripts/migration-add-reactions-comments.sql` | 14, 40, 54 |
| `tree_likes`, `tree_social_counts` | `scripts/migration-add-tree-social-counts.sql` | 14, 31 |
| `tree_view_dedup_events` | `scripts/migration-add-tree-view-tracking.sql` | 14 |
| `tree_comments` | `scripts/migration-add-tree-comments.sql` | 22 |
| `social_idempotency`, `social_rate_limits`, `social_audit_log` | `scripts/migration-harden-moment-social-writes.sql` | 94, 121, 141 |

ALTER-only migrations (no new table): `migration-add-tree-metadata.sql` (trees),
`migration-add-channel-fields.sql` (memories), `migration-add-generic-social-targets.sql` and
`migration-b-generic-social-targets-cutover.sql` (social_*).

**`trees` source of truth (UNKNOWN):** No `CREATE TABLE` for `trees` exists in `scripts/` or
`functions/api/**` (grep for `CREATE TABLE` across `functions/` returns no matches). The only
reference is a documentation example (`docs/product/DATA_NAMING_RULE.md:189`). The deployed `trees`
shape therefore cannot be confirmed from the repository at the baseline SHA. Production verification
evidence is absent from the repo.

**`IF NOT EXISTS` silent-preserve risk (CONFIRMED):** All new-table migrations use
`CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` (e.g. `migration-add-tree-comments.sql:22`).
ALTER migrations use guarded `ADD COLUMN IF NOT EXISTS` (`migration-add-channel-fields.sql:16-18`,
`migration-add-generic-social-targets.sql:75,78,81,84`) or `information_schema` guards
(`migration-add-tree-metadata.sql:14-30`). None use a plain unguarded `CREATE TABLE`. The risk is that
a pre-existing incompatible object is preserved rather than corrected.

**Applied-migration ledger / schema-version table (CONFIRMED — NO RECORD FOUND):** Repo-wide search for
`schema_migrations|applied_migrations|migration_version|schema_version|migration_ledger|applied_at`
finds no file. No `functions/api/**` contains `CREATE TABLE`. Migrations embed runbook posture text
("Apply under separate approval", "schema foundation only") but no machine-readable applied-state record.

**Rollback files (CONFIRMED — none in this branch):** No `scripts/*rollback*` files exist in the audit
branch. Rollback is only documented as commented DDL inside
`migration-harden-moment-social-writes.sql:70-73` (DROP TABLE / ALTER DROP COLUMN comments). No dedicated
rollback scripts or rollback contract tests are present here. (Note: PR #3424's branch carries
`scripts/rollback-tree-comments-legacy-reconcile.sql`; that is 컴1 work and not part of this audit.)

**Migration contract tests are source/static/regex SQL-text (CONFIRMED):**
- `tests/contracts/migration-reactions-comments-contract.test.cjs:8` — `fs.readFileSync` + regex; no DB.
- `tests/contracts/migration-tree-comments-contract.test.cjs:10` — header states "All assertions are
  source-level. No database connection, psql, subprocess…".
- `tests/contracts/generic-social-targets-migration-a-contract.test.cjs:8` and
  `...-b-contract.test.cjs:8` — static BEGIN/COMMIT, `to_regclass` prereq, ADD COLUMN IF NOT EXISTS,
  trigger/function, runbook assertions; no SQL execution.
- (PR #3424's branch adds a `pglast` grammar parse as *additional static validation*; that is 컴1 branch
  context and is **not** mixed into this audit's `main` baseline evidence.)

**Real PostgreSQL execution in migration tests (CONFIRMED — NO):** Grep over `tests/contracts` for
`pg`/`Pool`/`psql`/`pool.query` finds no matches. `pg`/`DATABASE_URL`/`Pool` appear only in
`scripts/verify-*.cjs` and `scripts/seed-*.cjs` (real DB helpers) and in runbook docs — not in `npm test`
or CI.

## Test-layer map

`npm run ci` = `lint && build && test && verify` (`package.json:34`).

| Layer | Command / file | What it actually does | Runtime executed? |
|---|---|---|---|
| Static lint | `scripts/lint-static.js` | CRLF, trailing whitespace, tab, DOCTYPE string presence | No (static) |
| Build | `scripts/build-static.js` | asserts `index.html` exists; comment "No bundle step configured" | No (static) |
| Verify | `scripts/pre-deploy.cjs` | `node --check` syntax, i18n key regex, route *file* existence, HTML tag presence, required-file existence, `node_modules` presence | No (static/structural) |
| Verify:remote | `scripts/pre-deploy.cjs --remote` → `verify-env.js` | adds `DATABASE_URL` requirement | NOT in CI |
| Test | `node --test tests/smoke tests/routes tests/contracts` | see below | mixed |

**Test classification at baseline:**

- **Static / source contract (majority):** `tests/smoke/routes.test.cjs:12-51` (file/string presence);
  `tests/contracts/editor-template-load-contract.test.cjs:5,54-90` (reads `editor.html`, asserts script
  order/mount IDs via `.indexOf`); all `migration-*-contract` tests (SQL text regex).
- **Executed logic with fakes:** `tests/contracts/viewer-local-layout-isolation-contract.test.cjs:426-447`
  (fake `localStorage`); `tests/contracts/search-preview-media-url-sanitization-contract.test.cjs:13-50`
  (mock `window`/`document`); `tests/contracts/tree-comments-read-only-panel-3416.test.cjs:6,29,649`
  (deterministic DOM mock, explicitly "must not import jsdom"); `scout-*-contract` tests (injected mock
  `fetch`).
- **Executed logic with stubbed DB (Python):** `tests/contracts/test_public_legacy_memory_visibility.py:24-104`
  stubs `psycopg`/`fastapi`, patches `get_db_connection`, but imports **real** `modal_compute.public_reads`.
- **Real PostgreSQL in CI:** NONE. `pg`/`Pool`/`DATABASE_URL` appear only in out-of-CI ops scripts.
- **Production smoke (NOT in CI):** `scripts/cloudflare-supplied-url-smoke.cjs` requires `SMOKE_BASE_URL`
  (live URL); `scripts/e2e-*-smoke.cjs` use Playwright + mocked API. Neither runs in `npm run ci`.

**What CI green guarantees vs. does not guarantee (CONFIRMED):**
- Guarantees: lint hygiene, `index.html` present, JS syntax, i18n key consistency, API route *files*
  exist, mocked/fake-logic contract tests pass.
- Does NOT guarantee: real Cloudflare/Modal/Neon runtime, that migrations were applied, real
  `fetch`/API behavior, browser rendering, or end-to-end flows.

Contract tests are **not** treated as bad here. They are valuable and cheap. The gap is the absence of an
execution tier that proves SQL and runtime integration actually work.

## Runtime and deployment parity

- **Deployment revision manifest file:** NONE (CONFIRMED). Glob `*revision*`/`*manifest*` in
  `modal_compute` and repo root finds nothing beyond `package.json`/`package-lock.json`/`vercel.json`.
- **Modal revision:** `modal_compute/app.py:95` `version="1.0.0"` is a Modal Image build tag;
  `modal_compute/hub_layouts.py` "revision" is per-tree *layout data* (DB), not a deploy manifest.
- **DB schema ↔ migration state linkage:** No artifact connects deployed schema version to repo
  migrations. Contract tests assert SQL text but never apply or verify applied state.
- **Docs describing SHA/Cloudflare/Modal/DB correlation:**
  - `docs/ops/OPERATIONS.md:164-172` — runtime checkpoints (`x-lovebud-upstream: modal`,
    `modal-function-call-id`, `MODAL_BASE_URL`, `/modal/health`); no SHA linkage.
  - `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md:7-72` — layer status; no SHA/schema linkage.
  - `docs/project/AGENT_OPERATION_GUARDRAILS.md:71` — "Confirm deployed SHA prefix match" (manual).
  - `docs/ops/TREE_LIKE_RUNTIME_VERIFICATION_RUNBOOK.md:6,29` — per-issue target SHA (manual operator).
  - Conclusion (CONFIRMED): deployed-SHA match is a manual reporting field, not an automated manifest.
- **Sanitized evidence template:** EXISTS as an operator template
  (`docs/ops/TREE_LIKE_RUNTIME_VERIFICATION_RUNBOOK.md:134-161`, forbidden-evidence rules §6) but is not a
  recorded manifest; whether any instance is filed is UNKNOWN.

The gap: after a deploy, there is no machine-readable record proving which `main` SHA, which Cloudflare
build, which Modal build, and which DB schema revision are live together.

## CSS and view scoping

- **`!important` concentration (CONFIRMED):** 299 occurrences across 223 CSS files. Top files:
  `css/editor/editor-sidebar.css:39`, `css/search/search-preview.css:25`,
  `css/editor/editor-canvas-affordance.css:23`, `css/viewer/public-tree-viewer/print.css:21`,
  `css/search/search-preview-sidebar/responsive.css:15`, `css/editor/editor-canvas.css:14`,
  `css/editor/editor-overrides.css:11`, `css/global/global-header-language.css:9`. `display:none !important`
  appears ~40 times.
- **Shared classes used by BOTH editor and public viewer (CONFIRMED):**
  - `memory-node` — `js/editor/editor-canvas-node.js:75`; `js/viewer/public-canvas-init.js:459`.
  - `detail-panel` — `js/editor/templates/editor-detail-panel-shell-template.js:4`;
    `js/viewer/public-viewer-detail-panel-shell-template.js:8`.
  - `editor-current-moment-card` — `js/editor/templates/editor-detail-view-mode-template.js:9`;
    `js/viewer/public-viewer-detail-view-mode-template.js:9`.
  - `diary-note` — `js/editor/templates/editor-detail-view-mode-template.js:60`;
    `js/viewer/public-viewer-detail-view-mode-template.js:38`.
- **Broadly-scoped display/visibility/`!important` risks (CONFIRMED):**
  - `css/global.css:15-110` — global classes (`.lovetree-*`, `.btn-round`, `.result-card`, `.tag-chip`,
    …) loaded on every page. `GLOBAL_CSS_TOKEN_READINESS_AUDIT.md` (#510) flags `lovetree-*` as `WATCH`
    ("Future changes affect Search/Browse and other shared surfaces").
  - `css/editor/editor-overrides.css:372-379` — Group G `display:none !important` block (HOLD in #516).
    This is the **confirmed** cross-surface case from #3419: the rule hides `.editor-tree-meta-section`, a
    class reused by both `js/editor/templates/editor-detail-view-mode-template.js:4` and
    `js/viewer/public-viewer-detail-view-mode-template.js:4`; the public viewer tree-meta action surface
    (whole-tree like/comments/share) is therefore hidden by an editor-only presentation override.
  - `css/editor.css:63` — `.editor-readonly .branch-port-handle { display: none !important; }`. Because the
    rule is scoped to `.editor-readonly`, it applies only when that ancestor is present; it is **not** asserted
    as a CONFIRMED public-viewer cross-surface regression. Classified **LIKELY / UNKNOWN** until repository
    evidence shows the public viewer renders under an `.editor-readonly` ancestor that loads this stylesheet.
    (Note: an earlier draft cited a non-existent nested path for this stylesheet; the real file is
    `css/editor.css`.)
  - `css/search/search-controls.css:108` and `css/search/search-tree-card/fallback.css:23,64` —
    `display:none !important` in shared Search/Browse surfaces.
- **Existing audit docs (extension, not duplication):** #510 (token/readiness), #511 (global focus/
  visibility), #516 (editor hidden/compatibility selectors) do **not** enumerate the editor↔viewer
  shared-class overlap that is the concrete cross-surface mechanism. That overlap is this audit's
  extension target.

## Legacy compatibility registry

Evidence level: CONFIRMED unless noted.

| Legacy item | Location | Why retained | Known consumer | Compatibility risk | Removal precondition | Recommended action | Candidate child issue |
|---|---|---|---|---|---|---|---|
| Transitional public-tree adapter | `js/api/public-tree-adapter.js:5-9` (canonical + transitional mode for `{ data }` wrapper + snake_case `tree_id/created_at/owner_id/emotion_tags`) | Migration period: unwrap legacy wrapped records + snake_case ids | public viewer, browse | Dual normalization split across client and Modal | Canonical path reaches 100% of live records; transitional reads removed | Retire transitional branch behind a flag | Legacy retirement registry |
| Modal legacy node normalization | `modal_compute/public_reads.py:76-778` (`_is_public_legacy_node`, `_legacy_payload_node_to_memory_row`, `_normalize_legacy_tree_row`; falls back to legacy `trees.payload`) | Backward compat with legacy tree payloads | public reads | Falls back to legacy payload when `memories` missing | Legacy payload fully migrated to canonical schema | Extract `legacy_normalizer.py`; gate removal | Legacy retirement registry |
| Shared mutable `window.*` globals | `window.currentTreeData`, `window.currentTreeMemories`, `window.__viewerTreeData` set in `js/viewer/public-canvas-bridge.js:115-116`, `js/editor/editor-tree-helpers.js:67-89`; read across editor/viewer | Editor/viewer state bridge during refactor | editor.js, viewer handlers | Couples editor authoring state with viewer runtime | Canonical in-memory store replaces globals | Migrate to explicit store; remove aliases | Editor/viewer shared-state cleanup |
| Editor global bridge | `js/editor/editor-canvas.js:839,849` ("Bridge to window for legacy editor.js compatibility", #1495) | Legacy `editor.js` compatibility | `editor.js` | Hidden coupling via globals | `editor.js` modernized off bridge | Remove bridge post-migration | Editor/viewer shared-state cleanup |
| Legacy key guard | `functions/_shared/legacy-key-guard.js:1-45` (rejects legacy localization keys; imported by `functions/api/trees.js:1`, `functions/_shared/memory-route-proxy.js:1,243`) | Reject deprecated localization keys at boundary | trees/memory routes | Guard must stay until all clients send canonical keys | All clients send canonical keys | Keep guard; document removal trigger | Legacy retirement registry |
| Legacy social storage columns | `docs/product/lovebud-tree-comment-storage-schema-boundary-audit.md:116-163` (`target_memory_id/memory_id` retained; Migration B only relaxes NOT NULL) | Social storage migration in progress | tree/moment social | Two social storage models coexist | Migration completed; canonical model sole writer | Track in Social migration plan (#3188/#3075) | (context only — owned by #3424/#3188) |
| Netlify legacy artifact | `netlify/README.md:1,5,21-23`, `netlify/functions/README.md:1,11-15` | Legacy / fallback / artifact (not active) | none (removal candidate) | Accidental reactivation | CTO approval per AGENTS.md | Keep removed-from-active; document | Legacy retirement registry |
| Vercel legacy fallback | `vercel.json:3` (`x-lovebud-runtime-note: Deprecated transitional fallback only`) | Transitional/secondary entry | none (active=Cloudflare/Modal) | Misuse as primary | Confirm Cloudflare/Modal sole active | Keep documented as legacy | Legacy retirement registry |

## Module and domain boundaries

- **Editor vs public viewer (CONFIRMED):** coupled via shared mutable `window.currentTreeData` /
  `currentTreeMemories` (`editor.js:558-610` ↔ `public-canvas-bridge.js:115-116`) and shared un-prefixed
  class names (`memory-node`, `detail-panel`, `editor-current-moment-card`, `diary-note`).
- **Client vs Cloudflare Functions (LIKELY):** `js/api/public-tree-adapter.js` performs client-side
  legacy normalization that duplicates `modal_compute/public_reads.py:100-160` legacy normalization;
  `functions/_shared/memory-route-proxy.js` is the client→Modal proxy.
- **Cloudflare Functions vs Modal (CONFIRMED):** `functions/api/[[path]].js` (gateway, near-500 lines,
  WATCH #470/#473) maps routes to Modal; `modal_compute/app.py:588` (AUDIT_NEEDED #423) owns owner
  read/write orchestration. Routing/blame split across two runtimes.
- **Tree-level vs moment-level Social (CONFIRMED):** `js/social/tree-comments-client.js` (tree) vs
  `modal_compute/comments.py` (moment, legacy). Two social storage models coexist
  (`docs/product/lovebud-tree-comment-storage-schema-boundary-audit.md:160`). Ownership separation:
  Tree Social = #3424 / #3188; Moment Social = #3075; Scout = #1882 (separate domain). This audit records
  the Social split only as context and does **not** mix Social implementation into this PR. Scout (#1882)
  remains separate, untouched, and is **not** part of the Social migration plan.
- **Scout vs Social (LIKELY):** `js/scout/*` is cleanly isolated from `js/social/*`, but Scout logic is
  duplicated across client (`js/scout/*`), ~14 `functions/api/scout/*` files, and Modal. Cross-layer
  scattering increases change cost.
- **Legacy vs canonical storage (CONFIRMED):** public-tree-adapter transitional/canonical split mirrors
  `modal_compute/public_reads.py:776` legacy (`payload/name`) vs modern (`title`) branch selection.
- **Large files mixing responsibilities (CONFIRMED, per `CODE_ARCHITECTURE.md`):** `js/editor.js` = 883
  lines (EXTRACTION_CANDIDATE #225/#422/#518-521; exceeds the 500-line budget); `modal_compute/app.py` = 678
  lines (AUDIT_NEEDED #423; exceeds the 500-line budget); `modal_compute/public_reads.py` = 780 (exceeds the
  500-line budget); `functions/api/[[path]].js` = 677 (exceeds the 500-line budget; WATCH).

## Change-risk model

For each change type, the minimum verification bar. This is a draft standard, not yet enforced.

| Change type | Required test layer | Required remote verification | Rollback expectation | Post-merge verification | Production verification needed? | Forbidden shortcuts |
|---|---|---|---|---|---|---|
| presentation-only (CSS class/visual) | static CSS contract + per-surface smoke | fixed-slot browser smoke for affected surfaces | CSS revert | PR preview smoke | only for shared/global rules | editing global.css without view scope; `!important` to mask another surface |
| client state | executed-logic contract (fake DOM) | fixed-slot smoke | JS revert | PR preview smoke | if shared global state | relying on string-presence test for state logic |
| API contract | route contract + real-call contract (mock) | Cloudflare preview API call | route revert | preview API check | yes (same-origin `/api`) | mocking the exact response shape only |
| runtime/backend (Modal) | unit + integration on Modal staging | Modal staging call | Modal prior build | staging + prod health | yes | skipping staging because unit passed |
| deployment | build + deploy gate | preview deploy + revision record | prior deploy revert | manifest check | yes | deploy without recording revision |
| schema migration | SQL parser contract **+ isolated PG execution (separate approval)** | staging DB apply + drift check | documented rollback SQL | applied-state check | yes | source/static/regex SQL-text test as proof of execution |
| destructive/irreversible | execution test + staged rollout | staging + explicit sign-off | tested rollback SQL | post-apply verification | yes | DDL without rollback; `IF NOT EXISTS` masking drift |

## Prioritized risk register

Severity scale:
- **P0** — active production correctness or data-loss risk.
- **P1** — high change-cost or cross-surface regression risk.
- **P2** — maintainability and test-confidence risk.
- **P3** — cleanup/documentation improvement.

No **P0** risk was confirmed as *actively* impacting production in this read-only audit. The findings
below are latent/structural risks that raise change cost and can become production issues under the
right precondition. P0 is intentionally not overused.

---

**RK-01 — No applied-migration ledger / schema-version table (repo encodes only partial schema intent)**
- risk: Repository `scripts/*.sql` encode only partial migration/schema intent; deployed schema state is not reconstructable or verifiable from the repository alone.
- evidence: repo-wide grep finds no `schema_migrations|applied_migrations|schema_version|migration_ledger`; no complete `CREATE TABLE` for `trees` in `scripts/` or `functions/api`; no `CREATE TABLE` in `functions/api`.
- severity: P1 — likelihood: certain (gap exists) — blast radius: all migrations / prod schema.
- current control: migrations carry "Apply under separate approval" posture.
- control gap: no automated verification of applied state after deploy.
- recommended next action: design an applied-migration ledger + drift check (child issue).
- dependency: RK-02, RK-03.

**RK-02 — `IF NOT EXISTS` can silently preserve an incompatible existing object**
- risk: A pre-existing incompatible table/index in production is preserved rather than corrected.
- evidence: `migration-add-tree-comments.sql:22` and all new-table migrations use `CREATE TABLE IF NOT EXISTS`.
- severity: P1 — likelihood: conditional (requires pre-existing incompatible object) — blast radius: affected table.
- current control: guarded `ADD COLUMN IF NOT EXISTS`, inline `CHECK` constraints.
- control gap: cannot repair an incompatible existing object; drift is invisible.
- recommended next action: drift detection before apply, comparing repo-encoded migration intent to live schema (child issue).
- dependency: RK-01.

**RK-03 — Migration contract tests are source/static/regex SQL-text only**
- risk: Green CI does not prove a migration executes against PostgreSQL.
- evidence: `migration-tree-comments-contract.test.cjs:10`; `generic-social-targets-migration-a/b-contract.test.cjs:8` (source-level regex, no DB/psql/subprocess). PR #3424's branch adds a `pglast` grammar parse as *additional static validation* — that is 컴1 branch context, not part of this audit's `main` baseline evidence.
- severity: P2 — likelihood: always — blast radius: migration confidence.
- current control: SQL text assertions (order, columns, constraints).
- control gap: no execution guarantee.
- recommended next action: isolated PG execution test under separate approval (child issue).
- dependency: RK-04.

**RK-04 — No real PostgreSQL execution in CI tests**
- risk: SQL syntax/behavior differences from the production engine are not caught pre-merge.
- evidence: a repo-wide scan of `tests/smoke`, `tests/routes`, `tests/contracts`, `.github/workflows/ci.yml`,
  and `package.json` for `pg`/`Pool`/`psql`/`pool.query`/`DATABASE_URL`/`postgres` finds no execution path;
  `ci.yml` defines no PostgreSQL service/container and no DB execution step. `pg`/`DATABASE_URL`/`Pool`
  appear only in out-of-CI `scripts/verify-*.cjs` and `scripts/seed-*.cjs`.
- severity: P2 — likelihood: always — blast radius: all SQL-bearing changes.
- current control: out-of-CI `verify:remote` requires `DATABASE_URL`.
- control gap: not part of `npm run ci`.
- recommended next action: define CI-gated DB execution policy (child issue).
- dependency: none.

**RK-05 — `npm run ci` is static/structural, not runtime**
- risk: A change can pass CI while breaking real Cloudflare/Modal/Neon behavior.
- evidence: `package.json:34`; `scripts/lint-static.js`, `scripts/build-static.js`, `scripts/pre-deploy.cjs` (static/structural).
- severity: P2 — likelihood: always — blast radius: any runtime-dependent change.
- current control: out-of-CI smoke (`cloudflare-supplied-url-smoke.cjs`, `e2e-*-smoke.cjs`).
- control gap: smoke not in `ci`; coverage of read paths partial.
- recommended next action: bounded production-critical read-path smoke standard (child issue).
- dependency: RK-06.

**RK-06 — No deployment revision manifest links SHA → Cloudflare → Modal → DB**
- risk: After deploy, no machine-readable proof of which revisions are live together.
- evidence: no `*revision*`/`*manifest*` file; manual SHA-match field in `docs/project/AGENT_OPERATION_GUARDRAILS.md:71`.
- severity: P1 — likelihood: certain (gap exists) — blast radius: all deploys / parity.
- current control: manual operator reporting of target SHA.
- control gap: not automated; no DB-schema linkage.
- recommended next action: sanitized revision-manifest standard (child issue).
- dependency: RK-01.

**RK-07 — Cross-surface CSS risk from shared editor/public-viewer classes + broad `!important`**
- risk: A global or editor rule can hide/restyle the public viewer (or vice versa).
- evidence: shared `memory-node`/`detail-panel`/`editor-current-moment-card`/`diary-note`; **confirmed**
  `#3419` case — `css/editor/editor-overrides.css:372-379` hides `.editor-tree-meta-section`, a class reused
  by both editor and public viewer templates (`js/editor/templates/editor-detail-view-mode-template.js:4`,
  `js/viewer/public-viewer-detail-view-mode-template.js:4`); `css/global.css:15-110` global classes; 299
  `!important` total. (`css/editor.css:63` `.editor-readonly .branch-port-handle` is scoped to
  `.editor-readonly` and is NOT treated as a CONFIRMED cross-surface case.)
- severity: P1 — likelihood: medium — blast radius: editor + public viewer + shared surfaces.
- current control: #510/#511/#516 audit docs (token/focus/editor-hidden scope), not the shared-class overlap.
- control gap: no explicit view scoping for shared classes.
- recommended next action: view-scoped CSS + shared-class split (child issue).
- dependency: none.

**RK-08 — High `!important` count across many CSS files**
- risk: Cascade specificity battles raise change cost and hide regressions.
- evidence: 299 `!important` across 223 files; top `css/editor/editor-sidebar.css:39`, `css/search/search-preview.css:25`.
- severity: P3 — likelihood: always — blast radius: maintainability.
- current control: existing CSS audits.
- control gap: no enforced reduction policy.
- recommended next action: per-PR `!important` budget / scoped reduction (child issue, optional).
- dependency: RK-07.

**RK-09 — Legacy structures retained without a single retirement registry**
- risk: Legacy and canonical paths accumulate; removal preconditions are unclear.
- evidence: `js/api/public-tree-adapter.js:5-9` transitional; `modal_compute/public_reads.py:76-778` legacy normalization; `window.*` globals; `netlify/`, `vercel.json` legacy.
- severity: P2 — likelihood: always — blast radius: change cost across modules.
- current control: per-item audit docs (#412, #516, NETLIFY_LEGACY_ARTIFACT_AUDIT).
- control gap: no unified registry with removal preconditions.
- recommended next action: legacy retirement registry (child issue).
- dependency: none.

**RK-10 — Shared mutable `window.*` globals bridge editor and viewer**
- risk: Editor authoring state and viewer runtime are coupled via globals; a write can regress the other surface.
- evidence: `window.currentTreeData`/`currentTreeMemories`/`__viewerTreeData` set in `public-canvas-bridge.js:115-116`, `editor-tree-helpers.js:67-89`; read across editor/viewer.
- severity: P1 — likelihood: medium — blast radius: editor + viewer.
- current control: `docs/security/AUTH_GLOBAL_EXPORTS_INVENTORY.md:66-68` (aliases retained until migration).
- control gap: no enforced migration to explicit store.
- recommended next action: editor/viewer shared-state cleanup (child issue).
- dependency: RK-09.

**RK-11 — Dual schema normalization split across client and Modal**
- risk: Legacy normalization logic duplicated in `public-tree-adapter.js` and `public_reads.py`; divergence risk.
- evidence: `js/api/public-tree-adapter.js` vs `modal_compute/public_reads.py:100-160`.
- severity: P2 — likelihood: medium — blast radius: public reads.
- current control: contract tests cover each side.
- control gap: no single source of normalization truth.
- recommended next action: consolidate normalization ownership (child issue, depends on RK-09).
- dependency: RK-09.

**RK-12 — Large files mixing responsibilities**
- risk: Changes require touching broad files; blast radius and review cost are high.
- evidence: `js/editor.js` = 883 lines; `modal_compute/app.py` = 678; `modal_compute/public_reads.py` = 780; `functions/api/[[path]].js` = 677 (all exceed the 500-line budget). This file-size decomposition relates to the already-closed `#1698` (editor core orchestrator/canvas split) and `#1711` (public viewer lightweight entrypoint split); those issues are not reopened here.
- severity: P2 — likelihood: always — blast radius: change cost.
- current control: `CODE_ARCHITECTURE.md` thin-entrypoint policy; `LARGE_FILE_MODULARIZATION_CANDIDATES.md`.
- control gap: extraction not yet completed for these files.
- recommended next action: continue one-file-at-a-time extraction per existing policy.
- dependency: none.

**RK-13 — Tree-level vs moment-level Social dual storage models**
- risk: Two social storage models coexist; a change to one can miss the other.
- evidence: `js/social/tree-comments-client.js` vs `modal_compute/comments.py`; boundary doc `:160`.
- severity: P2 — likelihood: medium — blast radius: Social features.
- current control: storage schema boundary audit doc; PR #3424 reconciliation work.
- control gap: canonical model not yet sole writer.
- recommended next action: track within Social migration plan (#3188/#3075); NOT owned by this PR.
- dependency: #3424 (컴1).

## Recommended child issues

These are **candidates only**. No GitHub issue is created by this PR. Each is domain-separated and small.

### A. DB migration execution testing
- Problem: Migration contract tests are source/static/regex SQL-text only (PR #3424's branch adds a
  `pglast` grammar parse as static validation); SQL is never executed in CI.
- Exact scope: add an isolated PostgreSQL execution tier for `scripts/*.sql` under separate approval.
- Files/areas: `scripts/*.sql`, `tests/contracts/*migration*`, new `tests/db/` (approval-gated).
- Dependencies: RK-03, RK-04.
- Non-goals: no production DB; no schema mutation in this child issue's tests against prod.
- Required validation: migrations apply cleanly on a throwaway PostgreSQL; idempotent re-run safe.
- Rollback/post-merge verification: revert test config; no prod impact.
- Suggested priority: P2.

### B. Schema drift detection + applied-migration ledger
- Problem: Repository `scripts/*.sql` encode only partial schema intent; no record of which migrations are applied, and `IF NOT EXISTS` can mask drift.
- Exact scope: design a ledger (e.g. `schema_migrations` table) + a read-only drift-diff script comparing repo-encoded migration intent to live schema.
- Files/areas: `scripts/inspect-schema.cjs`, new ledger migration, docs.
- Dependencies: RK-01, RK-02.
- Non-goals: no automatic apply; no prod mutation without sign-off.
- Required validation: drift-diff reports zero diff on a known-good staging DB.
- Rollback/post-merge verification: ledger migration has documented rollback; verified on staging.
- Suggested priority: P1.

### C. Deployment revision manifest / sanitized evidence standard
- Problem: No machine-readable link between `main` SHA, Cloudflare build, Modal build, and DB schema.
- Exact scope: define a sanitized manifest schema (no secrets/URLs/UUIDs/request IDs) written on each deploy.
- Files/areas: `docs/ops/`, deploy workflow docs, `DEPLOY_CHECKLIST.md`.
- Dependencies: RK-06.
- Non-goals: no secret exposure; no new deployment pipeline.
- Required validation: manifest example passes sanitization rules in `TREE_LIKE_RUNTIME_VERIFICATION_RUNBOOK.md:134-161`.
- Rollback/post-merge verification: doc-only; no runtime change.
- Suggested priority: P1.

### D. CSS/view scope isolation
- Problem: Shared editor/public-viewer classes and broad `!important` can regress the other surface. The
  confirmed `#3419` case shows `css/editor/editor-overrides.css:372-379` hides `.editor-tree-meta-section`,
  which the public viewer reuses, hiding whole-tree like/comments/share controls in the public viewer.
- Exact scope: add explicit view scoping (e.g. `[data-view="editor"]` / `[data-view="public-viewer"]`) and
  split the four shared classes; give the public viewer a narrow, view-scoped visibility rule instead of
  relying on editor-only hide rules.
- Files/areas: `css/global.css`, `css/editor/*`, `css/viewer/*`, `js/editor/templates/*`, `js/viewer/*`.
- Dependencies: RK-07, RK-08.
- Non-goals: no visual rewrite; no global restyle beyond scoping.
- Required validation: per-surface smoke on fixed slots for editor + public viewer before/after.
- Rollback/post-merge verification: CSS revert; preview smoke PASS.
- Suggested priority: P1.

### E. Legacy retirement registry + per-item removal preconditions
- Problem: Legacy structures are retained without a unified registry or removal plan.
- Exact scope: create `docs/engineering/LEGACY_COMPATIBILITY_REGISTRY.md` capturing the table above with removal preconditions and triggers.
- Files/areas: `docs/engineering/`, `js/api/public-tree-adapter.js`, `modal_compute/public_reads.py`, `netlify/`, `vercel.json`.
- Dependencies: RK-09, RK-10, RK-11.
- Non-goals: no removal in this child issue; documentation + triggers only.
- Required validation: registry reviewed; each item has a removal precondition.
- Rollback/post-merge verification: doc-only.
- Suggested priority: P2.

### F. Contract-test classification
- Problem: It is hard to tell which tests execute logic vs assert strings.
- Exact scope: tag contract tests (static / executed-fake / executed-real) and surface a CI summary.
- Files/areas: `tests/contracts/*`, `package.json` test script, CI config.
- Dependencies: RK-03, RK-05.
- Non-goals: no new runtime tests; classification metadata only.
- Required validation: `npm test` summary lists layer counts.
- Rollback/post-merge verification: revert metadata.
- Suggested priority: P2.

### G. Editor/public-viewer shared-state cleanup
- Problem: `window.currentTreeData`/`currentTreeMemories`/`__viewerTreeData` couple editor and viewer.
- Exact scope: migrate shared state to an explicit store; remove `window.*` aliases post-migration.
- Files/areas: `js/editor/*`, `js/viewer/*`, `js/api/*`.
- Dependencies: RK-10, RK-09.
- Non-goals: no behavior change beyond state ownership; no Social/Scout changes.
- Required validation: fixed-slot smoke for editor save + public viewer read.
- Rollback/post-merge verification: JS revert; preview smoke PASS.
- Suggested priority: P1.
- **Existing-issue reconciliation (do not duplicate #3120):** classified `NEW_NARROW_GAP_REQUIRED` that
  references the closed `#3120` (global namespace bridges audit). `#3120` already completed an audit-first,
  behavior-preserving plan to reduce *internal* global namespace coupling by boundary. The remaining concrete
  gap this candidate addresses is the specific editor↔viewer shared `window.*` state bridge
  (`window.currentTreeData`/`currentTreeMemories`/`__viewerTreeData`), which #3120 enumerated at a boundary
  level but did not close as a concrete extraction child. No follow-up issue is reopened; this is a new narrow
  child that builds on the #3120 plan without re-auditing global namespaces wholesale. Related large-file work
  is covered by already-closed `#1698` (editor split) and `#1711` (public viewer split), which are not
  reopened.

### H. Runtime smoke evidence standard
- Problem: Production-critical read paths lack a bounded smoke standard in CI.
- Exact scope: define a minimal, sanitized read-path smoke (browse/search/public-tree) run post-deploy.
- Files/areas: `scripts/cloudflare-supplied-url-smoke.cjs`, `docs/ops/*`.
- Dependencies: RK-05, RK-06.
- Non-goals: no new endpoints; no write-path smoke.
- Required validation: smoke runs against a preview URL with sanitized output.
- Rollback/post-merge verification: doc/script only; no prod mutation.
- Suggested priority: P2.

## Recommended execution order

1. **E** (legacy registry) — low-risk doc that anchors removals and unblocks D/G.
2. **F** (contract-test classification) — cheap; improves signal for everything else.
3. **B** (drift detection + ledger) — closes the highest change-cost gap (P1).
4. **C** (revision manifest) — closes prod-parity gap (P1).
5. **A** (migration execution testing) — raises migration confidence (P2), depends on B's staging DB.
6. **D** (CSS/view scoping) — cross-surface regression risk (P1), independent.
7. **G** (editor/viewer shared-state cleanup) — depends on E.
8. **H** (runtime smoke standard) — depends on C.

This order avoids a big-bang rewrite: each step is a small, separable PR.

## Non-goals and safety boundaries

This audit and its PR deliberately:

- Perform **no repository-wide rewrite**. It decomposes risks into small child issues.
- Perform **no production/staging access**, **no DB migration or schema mutation**, **no Cloudflare/Modal
  deployment**, **no Docker/local PostgreSQL**, **no runtime/source/CSS/SQL modification**.
- Do **not** mix Social and Scout implementation. Scout and Social are treated as separate domains;
  tree-level vs moment-level Social is recorded only as context: Tree Social = #3424/#3188; Moment Social =
  #3075; Scout = #1882 (separate, untouched).
- Do **not** modify PR #3424 (`db/tree-comments-legacy-reconcile-3423`) or its branch.
- Do **not** close #3425. #3425 remains the open parent tracking issue.
- Do **not** assert that any implementation code exists. The companion contract test validates document
  structure and boundaries only.
- Print or record **no** secret, token, cookie, private endpoint, DB URL, raw UUID, request ID, or
  private log.

Refs #3425, #3418, #3419, #3423, #3188, #3075, #1882.
