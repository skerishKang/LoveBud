# LoveBud Node runtime policy

Refs #4534.

This document is the human-readable half of the LoveBud Node runtime contract.
The machine-readable half is [config/node-runtime-policy.json](../../config/node-runtime-policy.json),
and the enforcement half is [scripts/check-node-runtime-policy.cjs](../../scripts/check-node-runtime-policy.cjs)
run through `npm run check:node-runtime`.

## 1. Decision

`EXPLICIT_MULTI_VERSION_MATRIX`

LoveBud supports exactly **two** Node runtimes, each with a named scope and a
source-bound reason. There is no single-version unification and no silent drift:
every `actions/setup-node` step in an active workflow must be registered in the
policy with its workflow, version, and count.

## 2. Default runtime — Node 20

| Field | Value |
|---|---|
| Scope id | `DEFAULT_PRODUCT_CI` |
| Node version | `20` |
| Owner | GitHub Actions default Product CI and the merge gate |

Covered surfaces:

- Product source, Cloudflare Pages Functions and tooling;
- ordinary contract / unit / smoke / route tests (`npm test` glob);
- DB-engine PostgreSQL jobs (`npm run test:db-engine:*`);
- branch authority governance contracts;
- PR Fast Gate (`npm run lint`, `npm run build`, `npm run verify`).

Reason (source-bound): Node 20 GitHub Actions CI remains the merge gate, and
local Node 22 evidence cannot replace Node 20 CI
(`docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md`).

## 3. Scoped exception — Node 22.13.0

| Field | Value |
|---|---|
| Scope id | `RELIABILITY_PREVIEW_REHEARSAL` |
| Node version | `22.13.0` |
| Owner | `.github/workflows/reliability-preview.yml` only |

Covered surface:

- the hermetic Reliability Preview rehearsal suite in `tests/reliability-preview`
  and the local `workers/reliability-preview` runtime adapter.

Reason (source-bound): the rehearsal suite requires the `node:sqlite`
`DatabaseSync` API for its in-memory store; that API is not available on the
Node 20 runtime (`tests/reliability-preview/4082-nonprod-rehearsal.test.cjs`).

The exception grants no provider, Cloudflare Preview, Durable Object, Cron,
secret-binding, or Production authority. It is a local rehearsal runtime only.

## 4. Current workflow occurrence inventory

Active workflows today: **5**, with **20** `actions/setup-node` steps.

| Workflow | Node version | Steps | Scope |
|---|---|---|---|
| `.github/workflows/branch-authority-gate.yml` | `20` | 1 | `DEFAULT_PRODUCT_CI` |
| `.github/workflows/ci.yml` | `20` | 16 | `DEFAULT_PRODUCT_CI` |
| `.github/workflows/moment-social-visibility-concurrency-3954.yml` | `20` | 1 | `DEFAULT_PRODUCT_CI` |
| `.github/workflows/pr-fast-gate.yml` | `20` | 1 | `DEFAULT_PRODUCT_CI` |
| `.github/workflows/reliability-preview.yml` | `22.13.0` | 1 | `RELIABILITY_PREVIEW_REHEARSAL` |

## 5. What is deliberately NOT a runtime authority

The following must stay absent. They are not "missing"; they are excluded by
decision, because each one would create a second, silent runtime authority next
to the policy:

- `.nvmrc`
- `.node-version`
- `package.json#engines`

Adding any of them requires an explicit policy update and a guard change in the
same PR. The guard fails closed if one of them appears.

## 6. Drift detection

`node scripts/check-node-runtime-policy.cjs` (also `npm run check:node-runtime`)
fails closed when:

1. an active workflow has an unregistered `actions/setup-node` occurrence, or a
   registered workflow/version/count pair no longer matches reality;
2. a `setup-node` step has no literal `node-version`, uses `node-version-file`,
   or uses a `${{ }}` expression;
3. an active workflow uses a Node version that no scope declares;
4. a scope is unreferenced, or a registration references an unknown scope or a
   mismatched version;
5. a scope reason source is missing or lost its required token;
6. the human document stops naming a scope id or version;
7. `.nvmrc`, `.node-version`, or `package.json#engines` appears.

CI consumes the policy through `npm run verify`, which both CI entry workflows run
(`.github/workflows/pr-fast-gate.yml` and the `verify-static` job in
`.github/workflows/ci.yml`) and which reaches the guard via
`scripts/pre-deploy.cjs`. No CI job runs the un-suffixed full `npm test` glob
today, so `npm run verify` — not the contract layer — is the CI enforcement
path. `tests/contracts/node-runtime-policy-4534.test.cjs` is the local
full-regression contract for the same rules.

## 7. Changing a Node version

Update, in one reviewable PR:

1. `config/node-runtime-policy.json`;
2. this document;
3. the affected `node-version` lines in `.github/workflows/*.yml`.

Then run:

```bash
npm run check:node-runtime
node --test tests/contracts/node-runtime-policy-4534.test.cjs
npm run verify
```

## 8. Non-goals

- No dependency-major upgrade and no Cloudflare deployment is implied.
- Node 20 is not raised to Node 22 for the default Product/CI path.
- The Reliability Preview exception is not generalized to other workflows.
- No provider, Production, database, or Cloudflare mutation is authorized here.

## 금지

- 정책 파일을 우회해 workflow에 새 Node 버전을 직접 추가하는 행위
- `.nvmrc` / `.node-version` / `package.json#engines`를 근거 없이 추가하는 행위
- `node-version-file` 또는 `${{ }}` 표현식으로 런타임을 숨기는 행위
- Reliability Preview 예외를 다른 workflow로 확대하는 행위
