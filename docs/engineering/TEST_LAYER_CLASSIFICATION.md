# LoveBud CI Test Layer Classification

- Issue: #3429
- Parent: #3425 (architecture audit / hardening)
- Sibling context: #3427 (legacy compatibility registry), #3428 (expected-head fix)
- Scope: classification metadata, reporting tooling, documentation, and a focused contract test only.

## Purpose

The default LoveBud CI runs a Node test command that executes hundreds of
`*.test.cjs` files. A green CI does **not** mean every test exercised real
runtime behavior. This document classifies each default-CI test into an
**evidence layer** so reviewers can see, deterministically, what each layer
actually proves.

It answers one question precisely: *for a given test, what kind of evidence
does a passing run actually provide?*

## Vocabulary (primary layers)

Exactly these six primary layers are used. No other category is allowed.

| Layer | One-line meaning |
| --- | --- |
| `SOURCE_STATIC` | Reads source/docs/config; asserts strings, regex, existence, structure, order, syntax markers. Does not execute the asserted target's runtime behavior. |
| `EXECUTED_FAKE` | Executes production module/adapter logic, but replaces external resources (DOM, fetch, localStorage, DB, clock, env) with fake/mock/stub/injected dependencies. |
| `EXECUTED_REAL_LOCAL` | Executes core production behavior in a local process without replacing that core behavior with fakes. No production/staging resource is used. |
| `EXTERNAL_INTEGRATION` | Connects to an approved non-production external service/engine. |
| `PRODUCTION_SMOKE` | Bounded smoke against an approved production endpoint/runtime. |
| `DB_ENGINE_EXECUTION` | Applies/executes SQL against a real PostgreSQL engine. |

## Definitions

### SOURCE_STATIC
- Reads source, docs, or configuration.
- Validates strings, regex, file existence, structure, order, or syntax markers.
- Does **not** execute the actual runtime behavior of the asserted target.

Examples: SQL migration text regex contract, document contract, HTML/script-order
source contract.

### EXECUTED_FAKE
- Runs production module or adapter logic.
- Replaces DOM, fetch, localStorage, DB, clock, or environment with
  fake/mock/stub/injected dependencies.
- Does not use a real external system or production resource.

Examples: adapter executed with an injected mock executor, production UI source
run inside a `vm` context with a fake DOM, in-memory store, stubbed DB connection,
fake timers.

### EXECUTED_REAL_LOCAL
- Runs core production behavior in a local process.
- The core claimed behavior is **not** replaced by a fake.
- Does not use production/staging resources.

Important: a test file being executed by Node or Python does **not** by itself
make it `EXECUTED_REAL_LOCAL`. The deciding question is whether the *core
behavior under test* was executed for real.

### EXTERNAL_INTEGRATION
- Real connection to an approved non-production external service/engine.
- In the current default CI there is no repository evidence for this, so the
  default-CI count is `0`.

### PRODUCTION_SMOKE
- Bounded smoke against an approved production endpoint/runtime.
- In the current default CI there is no repository evidence for this, so the
  default-CI count is `0`.

### DB_ENGINE_EXECUTION
- SQL applied/executed against a real PostgreSQL engine.
- Parser or `pglast` syntax parse is **not** included here.
- In the current default CI there is no repository evidence for this, so the
  default-CI count is `0`.

## What each layer proves

- `SOURCE_STATIC` proves the checked source contract (text/structure/order) holds.
- `EXECUTED_FAKE` proves production logic behaves correctly given controlled,
  faked boundaries.
- `EXECUTED_REAL_LOCAL` proves production behavior works when executed locally
  without fakes (within the faked-free core under test).
- `EXTERNAL_INTEGRATION` proves behavior against a real non-production external
  dependency.
- `PRODUCTION_SMOKE` proves a bounded production path is alive.
- `DB_ENGINE_EXECUTION` proves SQL actually runs and behaves on a real PostgreSQL
  engine.

## What each layer does NOT prove

- `SOURCE_STATIC` does **not** prove executable runtime compatibility.

  > A green SOURCE_STATIC test proves the checked source contract, not executable runtime compatibility.

- A parser success does **not** prove the SQL executes.

  > A parser success proves syntax acceptance by that parser, not successful execution against PostgreSQL.

- `EXECUTED_FAKE` does not prove behavior against real external systems, real
  browsers, real networks, or real PostgreSQL.
- `EXECUTED_REAL_LOCAL` does not prove production deployment behavior or
  integration with real external services.

## Procedure for classifying a new test

1. Identify which default-CI glob the file lives under
   (`tests/smoke`, `tests/routes`, `tests/contracts`, `*.test.cjs`).
2. Read the file. Determine whether it executes production source and whether it
   uses fakes.
3. Assign exactly one primary layer.
4. Add the file to `tests/test-layer-classification.json` with a non-empty
   `rationale` grounded in source evidence (not the filename).
5. Run `npm run test:layers`. It must stay green and the counts must remain
   consistent.

## Conditions for using glob/rules

Rules may be used to classify many files at once, but only when:

- the rule is grounded in observed source evidence (how the files actually
  behave), not the filename alone;
- every matched file shares the same layer;
- ambiguous files are captured by an exact-path override instead.

A filename-only rule is forbidden. The committed inventory stores a per-file
`rationale` so the classification is auditable.

## Conditions for using an exact override

Use an exact-path entry when:

- a file's behavior is ambiguous or surprising;
- a glob rule would mis-classify it;
- the rationale needs to be specific to that file.

Exact overrides take precedence over any rule and must still carry a non-empty
rationale.

## Value and limits of SOURCE_STATIC

`SOURCE_STATIC` is high-value and cheap: it catches drift in contracts,
structure, ordering, and syntax markers across hundreds of files without
spinning up runtimes. Its limit is precisely stated above — it does not prove
executable runtime compatibility. Treating a `SOURCE_STATIC` pass as proof of
runtime behavior is the most common misreading this classification prevents.

## Why a parser is not DB execution

A `pglast` parse or any SQL syntax parser only checks that text is accepted by
that parser. It does not create tables, enforce constraints, or run against a
live engine. Therefore migration SQL contracts are `SOURCE_STATIC`, never
`DB_ENGINE_EXECUTION`.

## Fake execution vs real-local execution

The dividing line is whether the **core behavior under test** was replaced by a
fake:

- Production adapter run with an injected mock executor → `EXECUTED_FAKE`.
- Production source run inside a `vm` context with a fake DOM → `EXECUTED_FAKE`.
- Production function run locally with no fake standing in for the core behavior
  → `EXECUTED_REAL_LOCAL`.

Running a file with Node does not make it `EXECUTED_REAL_LOCAL` by itself.

## Default CI vs supplemental / out-of-CI

The default CI Node test command enumerates:

```text
tests/smoke/*.test.cjs
tests/routes/*.test.cjs
tests/contracts/*.test.cjs
```

- `*.test.js` files in those directories are **not** matched by the default-CI
  glob and are out of scope for this classification.
- Python tests (e.g. `tests/contracts/*.py`) are recorded as `supplemental`
  with `defaultCi: false`. They are not part of the default-CI count even if run
  manually or via a separate command. Manual/local execution is never presented
  as CI evidence.

`npm run test:layers` reports the supplemental count separately from the
default-CI counts.

## Current default-CI classification snapshot

Measured by `npm run test:layers` at the time of #3429 (authoritative values
come from the live reporter, not this table):

| Layer | Count |
| --- | --- |
| `SOURCE_STATIC` | 520 |
| `EXECUTED_FAKE` | 145 |
| `EXECUTED_REAL_LOCAL` | 3 |
| `EXTERNAL_INTEGRATION` | 0 |
| `PRODUCTION_SMOKE` | 0 |
| `DB_ENGINE_EXECUTION` | 0 |
| **Default-CI total** | **668** |
| Supplemental (Python, out-of-CI) | 10 |

## Future DB engine / production smoke children need separate approval

Adding `DB_ENGINE_EXECUTION`, `PRODUCTION_SMOKE`, or `EXTERNAL_INTEGRATION`
coverage is a separate, explicitly approved child effort. It requires:

- a new PostgreSQL service / approved external target / approved production
  smoke boundary;
- review of secrets, network, and deployment implications;
- an update to this document and the inventory.

Until then, the default CI counts for those layers remain `0` by design.

## Tooling

- `tests/test-layer-classification.json` — machine-readable classification
  (inventory). Source of truth for the reporter and contract test.
- `scripts/report-test-layers.cjs` — deterministic reporter. Enumerates the
  default-CI directories, classifies each file exactly once, prints counts, and
  exits non-zero on unclassified/conflicting/stale/invalid entries. No network,
  DB, browser, or deployment access. No secret/private data in output.
- `tests/contracts/test-layer-classification-contract.test.cjs` — focused
  validator enforcing the vocabulary, complete single classification, no
  migration-as-DB, no fake-as-external, `DB_ENGINE_EXECUTION = 0`,
  `PRODUCTION_SMOKE = 0`, supplemental separation, and output hygiene.
- `npm run test:layers` — runs the reporter.

This tooling is intentionally NOT injected into the `test`/`ci`/`verify` chains
yet; it is merged first so the classification can be judged on its own before any
wider rollout decision.
