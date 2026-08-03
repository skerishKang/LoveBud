'use strict';

/**
 * DB_ENGINE_EXECUTION: read-only target attribution & catalog parity preflight
 * rehearsal (Issue #3860, Step 8 Child 3).
 *
 * Executes only on fresh GitHub Actions via
 * `npm run test:db-engine:readonly-target-attribution-parity`.
 * Reads only LB_TEST_PG* synthetic loopback env via the shared disposable
 * harness. Never reads DATABASE_URL, never contacts Production/Neon/Modal,
 * and is never executed locally.
 *
 * R1: attributed parity confirmation (PARITY_CONFIRMED; manifest stays ADOPTION_REQUIRED)
 * R2: catalog mismatch (PARITY_MISMATCH; no raw leakage; no mutation)
 * R3: wrong attribution / missing approval fails before collection effects
 * R4: collection failure -> CATALOG_COLLECTION_FAILED (no raw leakage)
 * R5: insufficient/hostile evidence -> INSUFFICIENT_EVIDENCE
 * R6: read-only query proof (every preflight statement is a fixed read-only
 *     catalog query; mutation count zero)
 * R7: no activation or residual state (manifests ADOPTION_REQUIRED; no ledger
 *     append; no migration execution; sessions released; fixture DB removed)
 *
 * Refs: #3860, #3458, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('pg');

const harness = require('./helpers/postgres-disposable-harness.cjs');
const core = require('../../scripts/migration-readonly-target-attribution-parity-core.cjs');
const {
  collectCatalogEvidence,
  loadContract,
  Q,
} = require('../../scripts/migration-catalog-postgres-adapter-core.cjs');

const { withDisposableDb, baseClientConfig } = harness;

const ROOT = path.resolve(__dirname, '..', '..');
const BOOTSTRAP_SQL_PATH = path.join(
  ROOT,
  'db',
  'migrations',
  '20260802094500_bootstrap-migration-ledger.sql'
);
const SCHEMA_MANIFEST_PATH = path.join(
  ROOT,
  'db',
  'migration-provenance',
  'expected-schema-manifest.json'
);
const CANONICAL_MANIFEST_PATH = path.join(
  ROOT,
  'db',
  'migration-provenance',
  'canonical-migrations.json'
);

const LEDGER_OBJECT = {
  schema: 'public',
  object_name: 'schema_migration_ledger',
  object_kind: 'TABLE',
};
const EXPECTED_OBJECT_NAME = 'table:public.schema_migration_ledger';

function pass(name) {
  process.stdout.write(`${name}: PASS\n`);
}

function loadCommittedAuthority() {
  const manifest = JSON.parse(fs.readFileSync(SCHEMA_MANIFEST_PATH, 'utf8'));
  return { status: manifest.status, critical_objects: manifest.critical_objects };
}

function loadManifestStatus(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')).status;
}

function realCollectorFor(ctx) {
  return function collectCatalogEvidenceFromDisposable() {
    return collectCatalogEvidence({
      connection: {
        host: ctx.cfg.host,
        port: ctx.cfg.port,
        user: ctx.cfg.user,
        password: ctx.cfg.password,
        database: ctx.dbName,
      },
      objects: [LEDGER_OBJECT],
      roleMapping: { lovebud_ci: 'APPLICATION' },
      contract: loadContract(ROOT),
    });
  };
}

function parityConfig(ctx, overrides) {
  return Object.assign(
    {
      operation: core.OPERATION,
      targetClass: core.TARGET_CLASS,
      environmentClass: core.ENVIRONMENT_CLASS,
      boundaryApproval: true,
      committedAuthority: loadCommittedAuthority(),
      dependencies: { collectCatalogEvidence: realCollectorFor(ctx) },
    },
    overrides || {}
  );
}

// ── R1: attributed parity confirmation ───────────────────────────────────────

test('R1 attributed parity confirmation on fresh disposable PostgreSQL 17.4', async () => {
  await withDisposableDb('r1_parity_confirm', BOOTSTRAP_SQL_PATH, async (ctx) => {
    const result = await core.runParityPreflight(parityConfig(ctx));
    assert.equal(result.outcome, 'PARITY_CONFIRMED', 'attributed preflight confirms parity');
    assert.equal(result.authorityStatus, 'ADOPTION_REQUIRED', 'no activation implied');
    assert.equal(result.collectionEffectCount, 1);
    assert.equal(result.expectedObjectCount, 1);
    assert.equal(result.observedObjectCount, 1);
    assert.deepEqual(result.mismatchedObjects, []);
    assert.equal(loadManifestStatus(CANONICAL_MANIFEST_PATH), 'ADOPTION_REQUIRED');
    assert.equal(loadManifestStatus(SCHEMA_MANIFEST_PATH), 'ADOPTION_REQUIRED');
    pass('R1');
  });
});

// ── R2: catalog mismatch ─────────────────────────────────────────────────────

test('R2 catalog mismatch returns PARITY_MISMATCH with no raw leakage or mutation', async () => {
  const differingSql = path.join(os.tmpdir(), `r2_parity_mismatch_${process.pid}.sql`);
  fs.writeFileSync(
    differingSql,
    [
      'CREATE TABLE schema_migration_ledger (',
      '    migration_id         TEXT NOT NULL,',
      '    content_checksum      TEXT NOT NULL,',
      '    applied_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),',
      '    runner_version        TEXT NOT NULL,',
      '    environment_class     TEXT NOT NULL,',
      '    deployed_commit       TEXT NOT NULL,',
      '    transaction_outcome   TEXT NOT NULL,',
      '    drift_marker          TEXT,',
      '    CONSTRAINT schema_migration_ledger_pkey PRIMARY KEY (migration_id)',
      ');',
    ].join('\n'),
    'utf8'
  );
  try {
    await withDisposableDb('r2_catalog_mismatch', differingSql, async (ctx) => {
      const result = await core.runParityPreflight(parityConfig(ctx));
      assert.equal(result.outcome, 'PARITY_MISMATCH', 'drifting shape mismatches committed authority');
      assert.ok(result.mismatchedObjects.includes(EXPECTED_OBJECT_NAME), 'mismatch names the object identity');
      assert.ok(!JSON.stringify(result).includes('drift_marker'), 'no raw catalog/DDL leakage');
      assert.ok(!JSON.stringify(result).includes('CREATE TABLE'), 'no raw SQL leakage');
      assert.equal(result.collectionEffectCount, 1);
      pass('R2');
    });
  } finally {
    try {
      fs.unlinkSync(differingSql);
    } catch {
      // temp cleanup best effort
    }
  }
});

// ── R3: wrong attribution / missing approval ────────────────────────────────

test('R3 wrong attribution or missing approval fails before collection effects', async () => {
  await withDisposableDb('r3_attribution_invalid', null, async (ctx) => {
    const throwingCollector = () => {
      throw new Error('collector must never be invoked for invalid attribution');
    };
    const wrongTarget = await core.runParityPreflight(
      parityConfig(ctx, { targetClass: 'PRODUCTION_TARGET', dependencies: { collectCatalogEvidence: throwingCollector } })
    );
    assert.equal(wrongTarget.outcome, 'TARGET_ATTRIBUTION_INVALID');
    assert.equal(wrongTarget.collectionEffectCount, 0);

    const wrongEnv = await core.runParityPreflight(
      parityConfig(ctx, { environmentClass: 'PRODUCTION', dependencies: { collectCatalogEvidence: throwingCollector } })
    );
    assert.equal(wrongEnv.outcome, 'TARGET_ATTRIBUTION_INVALID');
    assert.equal(wrongEnv.collectionEffectCount, 0);

    const missingApproval = await core.runParityPreflight(
      parityConfig(ctx, { boundaryApproval: false, dependencies: { collectCatalogEvidence: throwingCollector } })
    );
    assert.equal(missingApproval.outcome, 'APPROVAL_INVALID');
    assert.equal(missingApproval.collectionEffectCount, 0);

    const malformedSha = await core.runParityPreflight(
      parityConfig(ctx, { releaseSha: 'not-hex', dependencies: { collectCatalogEvidence: throwingCollector } })
    );
    assert.equal(malformedSha.outcome, 'TARGET_ATTRIBUTION_INVALID');
    assert.equal(malformedSha.collectionEffectCount, 0);
    pass('R3');
  });
});

// ── R4: collection failure ───────────────────────────────────────────────────

test('R4 injected collection failure maps to CATALOG_COLLECTION_FAILED with no raw leakage', async () => {
  await withDisposableDb('r4_collection_failure', null, async (ctx) => {
    const failingCollector = () => {
      throw new Error('connection refused at db.internal:5432 with raw credentials');
    };
    const result = await core.runParityPreflight(
      parityConfig(ctx, { dependencies: { collectCatalogEvidence: failingCollector } })
    );
    assert.equal(result.outcome, 'CATALOG_COLLECTION_FAILED');
    assert.equal(result.collectionEffectCount, 1);
    assert.ok(!JSON.stringify(result).includes('connection refused'), 'no raw error leakage');
    assert.ok(!JSON.stringify(result).includes('db.internal'), 'no connection detail leakage');
    pass('R4');
  });
});

// ── R5: insufficient / hostile evidence ─────────────────────────────────────

test('R5 malformed or hostile observed evidence fails closed as INSUFFICIENT_EVIDENCE', async () => {
  await withDisposableDb('r5_insufficient_evidence', null, async (ctx) => {
    const malformedFingerprint = () => ({
      format_version: '1.0',
      normalizer_version: '1.0',
      objects: [{ name: EXPECTED_OBJECT_NAME, fingerprint: 'not-a-sha256' }],
    });
    const missingObject = () => ({
      format_version: '1.0',
      normalizer_version: '1.0',
      objects: [],
    });
    const privateField = () => ({
      format_version: '1.0',
      normalizer_version: '1.0',
      objects: [
        {
          name: EXPECTED_OBJECT_NAME,
          fingerprint: 'sha256:' + 'a'.repeat(64),
          owner: 'operator',
        },
      ],
    });
    for (const collector of [malformedFingerprint, missingObject, privateField]) {
      const result = await core.runParityPreflight(
        parityConfig(ctx, { dependencies: { collectCatalogEvidence: collector } })
      );
      assert.equal(result.outcome, 'INSUFFICIENT_EVIDENCE');
      assert.equal(result.collectionEffectCount, 1);
      assert.ok(!JSON.stringify(result).includes('owner'), 'no private field leakage');
    }
    pass('R5');
  });
});

// ── R6: read-only query proof ───────────────────────────────────────────────

test('R6 every preflight statement is a fixed read-only catalog query with zero mutation', async () => {
  const originalQuery = Client.prototype.query;
  const recorded = [];
  Client.prototype.query = function recordQuery(text) {
    const statement = typeof text === 'string' ? text : text && text.text;
    recorded.push(String(statement));
    return originalQuery.apply(this, arguments);
  };
  try {
    await withDisposableDb('r6_readonly_proof', BOOTSTRAP_SQL_PATH, async (ctx) => {
      recorded.length = 0;
      const result = await core.runParityPreflight(parityConfig(ctx));
      assert.equal(result.outcome, 'PARITY_CONFIRMED');
      assert.ok(recorded.length >= 1, 'collection issued at least one catalog query');
      const knownQueries = Object.values(Q);
      const mutationPattern = /\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|LOCK)\b/i;
      for (const statement of recorded) {
        assert.ok(knownQueries.includes(statement), 'statement is a fixed repository-owned read-only catalog query: ' + statement);
        assert.ok(!mutationPattern.test(statement), 'no mutation statement issued: ' + statement);
      }
      pass('R6');
    });
  } finally {
    Client.prototype.query = originalQuery;
  }
});

// ── R7: no activation or residual state ─────────────────────────────────────

test('R7 no activation or residual state after a confirmed preflight', async () => {
  await withDisposableDb('r7_no_residual', BOOTSTRAP_SQL_PATH, async (ctx) => {
    const before = {
      canonical: loadManifestStatus(CANONICAL_MANIFEST_PATH),
      schema: loadManifestStatus(SCHEMA_MANIFEST_PATH),
    };
    assert.equal(before.canonical, 'ADOPTION_REQUIRED');
    assert.equal(before.schema, 'ADOPTION_REQUIRED');

    const result = await core.runParityPreflight(parityConfig(ctx));
    assert.equal(result.outcome, 'PARITY_CONFIRMED');

    const after = {
      canonical: loadManifestStatus(CANONICAL_MANIFEST_PATH),
      schema: loadManifestStatus(SCHEMA_MANIFEST_PATH),
    };
    assert.equal(after.canonical, 'ADOPTION_REQUIRED', 'canonical manifest not activated');
    assert.equal(after.schema, 'ADOPTION_REQUIRED', 'expected-schema manifest not activated');

    const ledgerCount = await ctx.client.query(
      'SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
      ['public', 'schema_migration_ledger']
    );
    assert.equal(Number(ledgerCount.rows[0].c), 1, 'fixture relation exists');

    const rowCount = await ctx.client.query('SELECT COUNT(*)::int AS c FROM schema_migration_ledger');
    assert.equal(Number(rowCount.rows[0].c), 0, 'no ledger append occurred during the preflight');

    const cleanupErrors = globalThis.__lb_db_cleanup_errors || [];
    assert.equal(cleanupErrors.length, 0, 'all disposable sessions released and fixture DB removed');
    pass('R7');
  });
});
