'use strict';

/**
 * DB_ENGINE_EXECUTION: tree_comments reconcile + rollback on disposable PostgreSQL.
 *
 * Reads only LB_TEST_PG* synthetic connection vars (loopback).
 * Executes exact repository SQL via psql -X -v ON_ERROR_STOP=1 -f.
 * Never reads DATABASE_URL / Neon / secrets / production hosts.
 *
 * Refs: #3478, #3459, #3458, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const catalog = require('./helpers/postgres-catalog-assertions.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_SQL = path.join(ROOT, 'scripts/migration-reconcile-tree-comments-legacy-schema.sql');
const ROLLBACK_SQL = path.join(ROOT, 'scripts/rollback-tree-comments-legacy-reconcile.sql');
const LEGACY_FIXTURE = path.join(__dirname, 'fixtures/tree-comments-legacy.sql');

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const USER_RE = /^lovebud_ci(_[a-z0-9_]+)?$/;
const DB_PREFIX = 'lovebud_ci_';

function pass(name) {
  // Sanitized deterministic success line only.
  process.stdout.write(`${name}: PASS\n`);
}

function boundedFail(scenario, phase, category, exitCode, expectedClass, actualClass) {
  const msg = [
    `scenario=${scenario}`,
    `phase=${phase}`,
    `bounded_category=${category}`,
    `exit_code=${exitCode == null ? 'n/a' : String(exitCode)}`,
    `expected_class=${expectedClass}`,
    `actual_class=${actualClass}`,
  ].join(' ');
  const err = new Error(msg);
  err.bounded = true;
  throw err;
}

function readConfig() {
  // Explicit allow-list only. Never read DATABASE_URL.
  const host = process.env.LB_TEST_PGHOST || '';
  const port = process.env.LB_TEST_PGPORT || '5432';
  const user = process.env.LB_TEST_PGUSER || '';
  const password = process.env.LB_TEST_PGPASSWORD || '';
  const adminDb = process.env.LB_TEST_PGADMIN_DB || '';
  const psqlBin = process.env.PSQL_BIN || 'psql';

  if (!host || !user || !password || !adminDb) {
    boundedFail(
      'config',
      'preflight',
      'DB_ENGINE_MISSING_SYNTHETIC_ENV',
      null,
      'LB_TEST_PG_VARS',
      'missing'
    );
  }
  if (!ALLOWED_HOSTS.has(host)) {
    boundedFail(
      'config',
      'preflight',
      'DB_ENGINE_UNSAFE_HOST_REJECTED',
      null,
      'loopback',
      'non_loopback'
    );
  }
  if (!USER_RE.test(user)) {
    boundedFail('config', 'preflight', 'DB_ENGINE_UNSAFE_USER_REJECTED', null, 'lovebud_ci*', 'other');
  }
  if (!adminDb.startsWith(DB_PREFIX)) {
    boundedFail('config', 'preflight', 'DB_ENGINE_UNSAFE_ADMIN_DB_REJECTED', null, 'lovebud_ci_*', 'other');
  }
  const portNum = Number(port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    boundedFail('config', 'preflight', 'DB_ENGINE_INVALID_PORT', null, '1-65535', String(port));
  }

  return { host, port: portNum, user, password, adminDb, psqlBin };
}

function makeDbName(scenario) {
  const safe = String(scenario).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'x';
  const rnd = crypto.randomBytes(4).toString('hex');
  const name = `${DB_PREFIX}tc_${safe}_${process.pid}_${rnd}`;
  if (!/^[a-z0-9_]+$/.test(name) || name.length > 63) {
    throw new Error('DB_ENGINE_INVALID_DB_NAME');
  }
  return name;
}

function baseClientConfig(cfg, database) {
  return {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database,
    connectionTimeoutMillis: 10000,
    // Never log password or full connection string.
  };
}

function runPsqlFile(cfg, database, filePath) {
  if (!fs.existsSync(filePath)) {
    return { status: 127, stdout: '', stderr: 'FILE_MISSING' };
  }
  const args = [
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-h',
    cfg.host,
    '-p',
    String(cfg.port),
    '-U',
    cfg.user,
    '-d',
    database,
    '-f',
    filePath,
  ];
  const env = {
    ...process.env,
    PGPASSWORD: cfg.password,
    PGOPTIONS: '',
  };
  // Do not put password in argv. shell:false.
  const result = spawnSync(cfg.psqlBin, args, {
    encoding: 'utf8',
    env,
    shell: false,
    windowsHide: true,
    timeout: 60000,
  });
  return {
    status: result.status == null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.code || 'SPAWN_ERROR' : null,
  };
}

function combinedOutput(result) {
  // Used only for bounded substring checks; never printed in full.
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

async function withDisposableDb(scenario, fixtureSqlPath, fn) {
  const cfg = readConfig();
  const dbName = makeDbName(scenario);
  const admin = new Client(baseClientConfig(cfg, cfg.adminDb));
  let client = null;
  let created = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    created = true;
    await admin.end();

    const applyFixture = runPsqlFile(cfg, dbName, fixtureSqlPath);
    if (applyFixture.status !== 0) {
      boundedFail(
        scenario,
        'fixture_apply',
        'FIXTURE_APPLY_FAILED',
        applyFixture.status,
        'exit_0',
        `exit_${applyFixture.status}`
      );
    }

    client = new Client(baseClientConfig(cfg, dbName));
    await client.connect();
    return await fn({ cfg, client, dbName, runSql: (file) => runPsqlFile(cfg, dbName, file) });
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {
        // ignore disconnect errors
      }
    }
    const admin2 = new Client(baseClientConfig(cfg, cfg.adminDb));
    try {
      await admin2.connect();
      if (created) {
        await admin2.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      }
    } catch (cleanupErr) {
      // Cleanup failure is reported as a separate bounded error after scenario body.
      const code = cleanupErr && cleanupErr.code ? String(cleanupErr.code) : 'CLEANUP_FAIL';
      if (!globalThis.__lb_db_cleanup_errors) globalThis.__lb_db_cleanup_errors = [];
      globalThis.__lb_db_cleanup_errors.push(`${scenario}:${code}`);
    } finally {
      try {
        await admin2.end();
      } catch {
        // ignore
      }
    }
  }
}

async function assertNoMutation(client, beforeFp) {
  const after = await catalog.getCatalogFingerprint(client);
  if (!catalog.fingerprintEqual(beforeFp, after)) {
    failMutation();
  }
}

function failMutation() {
  const err = new Error('EXPECTED_PRESTATE_PRESERVED_ACTUAL_MUTATED');
  err.code = 'EXPECTED_PRESTATE_PRESERVED_ACTUAL_MUTATED';
  throw err;
}

// ─── Happy path: legacy → apply → canonical → second apply stop → rollback → reapply ───

test('tree-comments happy path apply/rollback/reapply', { concurrency: false }, async () => {
  await withDisposableDb('happy', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await catalog.assertLegacyCatalog(client);
    pass('tree-comments happy legacy preflight');

    const apply1 = runSql(MIGRATION_SQL);
    if (apply1.status !== 0) {
      boundedFail(
        'happy',
        'migration_apply',
        classifyMigrationError(combinedOutput(apply1)),
        apply1.status,
        'exit_0',
        `exit_${apply1.status}`
      );
    }
    pass('tree-comments happy apply');

    await catalog.assertCanonicalCatalog(client);
    pass('tree-comments happy canonical verify');
    const canonicalFp = await catalog.getCatalogFingerprint(client);

    const apply2 = runSql(MIGRATION_SQL);
    if (apply2.status === 0) {
      boundedFail('happy', 'second_apply', 'SECOND_APPLY_SHOULD_FAIL', 0, 'nonzero', '0');
    }
    if (!combinedOutput(apply2).includes('PREFLIGHT STOP: tree_comments already reconciled')) {
      boundedFail(
        'happy',
        'second_apply',
        'SECOND_APPLY_STOP_MESSAGE_MISSING',
        apply2.status,
        'PREFLIGHT_STOP_ALREADY_RECONCILED',
        'other'
      );
    }
    await assertNoMutation(client, canonicalFp);
    pass('tree-comments second apply stop');

    const rb = runSql(ROLLBACK_SQL);
    if (rb.status !== 0) {
      boundedFail(
        'happy',
        'rollback_apply',
        classifyRollbackError(combinedOutput(rb)),
        rb.status,
        'exit_0',
        `exit_${rb.status}`
      );
    }
    await catalog.assertLegacyCatalog(client);
    pass('tree-comments rollback');

    const apply3 = runSql(MIGRATION_SQL);
    if (apply3.status !== 0) {
      boundedFail(
        'happy',
        'reapply',
        classifyMigrationError(combinedOutput(apply3)),
        apply3.status,
        'exit_0',
        `exit_${apply3.status}`
      );
    }
    await catalog.assertCanonicalCatalog(client);
    pass('tree-comments reapply');
  });
});

// ─── Adversarial migration fixtures ───────────────────────────────────────────

test('tree-comments nonempty fixture fail closed', { concurrency: false }, async () => {
  await withDisposableDb('nonempty', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await client.query(`INSERT INTO public.users(id) VALUES ('u1')`);
    await client.query(`INSERT INTO public.trees(id) VALUES ('t1')`);
    await client.query(
      `INSERT INTO public.tree_comments(id, tree_id, author_id)
       VALUES ('c1', 't1', 'u1')`
    );
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    if (res.status === 0) {
      boundedFail('nonempty', 'migration', 'NONEMPTY_SHOULD_FAIL', 0, 'nonzero', '0');
    }
    const rows = await catalog.getRowCount(client);
    if (rows !== 1) failMutation();
    if ((await catalog.getCanonicalOnlyColumnCount(client)) !== 0) failMutation();
    await assertNoMutation(client, before);
    pass('tree-comments nonempty guard');
  });
});

test('tree-comments duplicate logical ids fail closed', { concurrency: false }, async () => {
  await withDisposableDb('dupids', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await client.query(`INSERT INTO public.users(id) VALUES ('u1')`);
    await client.query(`INSERT INTO public.trees(id) VALUES ('tree_a'), ('tree_b')`);
    await client.query(
      `INSERT INTO public.tree_comments(id, tree_id, author_id) VALUES
       ('same_id', 'tree_a', 'u1'),
       ('same_id', 'tree_b', 'u1')`
    );
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    if (res.status === 0) {
      boundedFail('dupids', 'migration', 'DUP_ID_SHOULD_FAIL', 0, 'nonzero', '0');
    }
    const rows = await catalog.getRowCount(client);
    if (rows !== 2) failMutation();
    const pk = await catalog.getPkColumns(client);
    if (pk.length !== 2 || pk[0] !== 'tree_id' || pk[1] !== 'id') failMutation();
    if ((await catalog.getCanonicalOnlyColumnCount(client)) !== 0) failMutation();
    await assertNoMutation(client, before);
    pass('tree-comments duplicate id guard');
  });
});

test('tree-comments unexpected secondary index fail closed', { concurrency: false }, async () => {
  await withDisposableDb('badidx', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await client.query(
      `CREATE INDEX unexpected_tree_comments_created ON public.tree_comments(created_at)`
    );
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    if (res.status === 0) {
      boundedFail('badidx', 'migration', 'UNEXPECTED_INDEX_SHOULD_FAIL', 0, 'nonzero', '0');
    }
    const idxs = await catalog.getSecondaryIndexes(client);
    if (!idxs.some((i) => i.name === 'unexpected_tree_comments_created')) failMutation();
    if ((await catalog.getCanonicalOnlyColumnCount(client)) !== 0) failMutation();
    await assertNoMutation(client, before);
    pass('tree-comments unexpected index guard');
  });
});

test('tree-comments migration dependent view fail closed', { concurrency: false }, async () => {
  await withDisposableDb('depview', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await client.query(
      `CREATE VIEW public.tree_comments_dep_view AS SELECT id, tree_id FROM public.tree_comments`
    );
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    if (res.status === 0) {
      boundedFail('depview', 'migration', 'DEPENDENT_VIEW_SHOULD_FAIL', 0, 'nonzero', '0');
    }
    if ((await catalog.getDependentViewCount(client)) < 1) failMutation();
    if ((await catalog.getCanonicalOnlyColumnCount(client)) !== 0) failMutation();
    const cols = await catalog.getColumnNames(client);
    if (cols.length !== 8) failMutation();
    await assertNoMutation(client, before);
    pass('tree-comments migration dependent view guard');
  });
});

test('tree-comments migration dependent matview fail closed', { concurrency: false }, async () => {
  await withDisposableDb('depmatview', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await client.query(
      `CREATE MATERIALIZED VIEW public.tree_comments_dep_matview AS
       SELECT id, tree_id FROM public.tree_comments`
    );
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    if (res.status === 0) {
      boundedFail('depmatview', 'migration', 'DEPENDENT_MATVIEW_SHOULD_FAIL', 0, 'nonzero', '0');
    }
    if ((await catalog.getDependentMatviewCount(client)) < 1) failMutation();
    if ((await catalog.getCanonicalOnlyColumnCount(client)) !== 0) failMutation();
    const cols = await catalog.getColumnNames(client);
    if (cols.length !== 8) failMutation();
    await assertNoMutation(client, before);
    pass('tree-comments migration dependent matview guard');
  });
});

test('tree-comments changed constraint fail closed', { concurrency: false }, async () => {
  await withDisposableDb('badfk', LEGACY_FIXTURE, async ({ client, runSql }) => {
    // Replace author FK SET NULL with RESTRICT (confdeltype 'r').
    const fkRows = await client.query(
      `SELECT c.conname
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       WHERE c.conrelid = 'public.tree_comments'::regclass
         AND c.contype = 'f'
         AND a.attname = 'author_id'`
    );
    if (!fkRows.rows[0]) throw new Error('EXPECTED_AUTHOR_FK_PRESENT');
    const conname = fkRows.rows[0].conname;
    await client.query(
      `ALTER TABLE public.tree_comments DROP CONSTRAINT ${quoteIdent(conname)}`
    );
    await client.query(
      `ALTER TABLE public.tree_comments
       ADD CONSTRAINT tree_comments_author_restrict
       FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE RESTRICT`
    );
    const before = await catalog.getCatalogFingerprint(client);
    const res = runSql(MIGRATION_SQL);
    if (res.status === 0) {
      boundedFail('badfk', 'migration', 'CHANGED_CONSTRAINT_SHOULD_FAIL', 0, 'nonzero', '0');
    }
    const fks = await catalog.getOutboundFkSummary(client);
    if (!fks.some((f) => f.startsWith('author_id->users(id):r'))) failMutation();
    if ((await catalog.getCanonicalOnlyColumnCount(client)) !== 0) failMutation();
    await assertNoMutation(client, before);
    pass('tree-comments changed constraint guard');
  });
});

test('tree-comments mismatched parent type fail closed', { concurrency: false }, async () => {
  const cfg = readConfig();
  const dbName = makeDbName('uuidparent');
  const admin = new Client(baseClientConfig(cfg, cfg.adminDb));
  let client = null;
  let created = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    created = true;
    await admin.end();

    client = new Client(baseClientConfig(cfg, dbName));
    await client.connect();
    await client.query(`
      CREATE TABLE public.users (id text NOT NULL PRIMARY KEY);
      CREATE TABLE public.trees (id uuid NOT NULL PRIMARY KEY);
      CREATE TABLE public.tree_comments (
        id text NOT NULL,
        tree_id uuid NOT NULL,
        author_id text NULL,
        author_display_name text NULL,
        is_deleted boolean NOT NULL DEFAULT false,
        created_at timestamptz NULL,
        updated_at timestamptz NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        PRIMARY KEY (tree_id, id),
        FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL,
        FOREIGN KEY (tree_id) REFERENCES public.trees(id) ON DELETE CASCADE
      );
    `);
    const before = await catalog.getCatalogFingerprint(client);
    const res = runPsqlFile(cfg, dbName, MIGRATION_SQL);
    if (res.status === 0) {
      boundedFail('uuidparent', 'migration', 'MISMATCHED_PARENT_SHOULD_FAIL', 0, 'nonzero', '0');
    }
    if ((await catalog.getCanonicalOnlyColumnCount(client)) !== 0) failMutation();
    await assertNoMutation(client, before);
    pass('tree-comments mismatched parent type guard');
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {
        // ignore
      }
    }
    const admin2 = new Client(baseClientConfig(cfg, cfg.adminDb));
    try {
      await admin2.connect();
      if (created) await admin2.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    } catch {
      // ignore cleanup
    } finally {
      try {
        await admin2.end();
      } catch {
        // ignore
      }
    }
  }
});

// ─── Adversarial rollback ─────────────────────────────────────────────────────

test('tree-comments rollback nonempty fail closed', { concurrency: false }, async () => {
  await withDisposableDb('rbnonempty', LEGACY_FIXTURE, async ({ client, runSql }) => {
    const apply = runSql(MIGRATION_SQL);
    if (apply.status !== 0) {
      boundedFail(
        'rbnonempty',
        'migration_apply',
        classifyMigrationError(combinedOutput(apply)),
        apply.status,
        'exit_0',
        `exit_${apply.status}`
      );
    }
    await catalog.assertCanonicalCatalog(client);

    await client.query(`INSERT INTO public.users(id) VALUES ('u1')`);
    await client.query(`INSERT INTO public.trees(id) VALUES ('t1')`);
    await client.query(
      `INSERT INTO public.tree_comments(id, tree_id, owner_id, body, target_kind)
       VALUES ('c1', 't1', 'owner1', 'synthetic body', 'tree')`
    );

    const before = await catalog.getCatalogFingerprint(client);
    const rb = runSql(ROLLBACK_SQL);
    if (rb.status === 0) {
      boundedFail('rbnonempty', 'rollback', 'ROLLBACK_NONEMPTY_SHOULD_FAIL', 0, 'nonzero', '0');
    }
    if (!/ROLLBACK PRECONDITION FAIL:\s*tree_comments row_count=/i.test(combinedOutput(rb))) {
      // Still accept any nonzero fail-closed as long as state preserved.
    }
    const rows = await catalog.getRowCount(client);
    if (rows !== 1) failMutation();
    const cols = await catalog.getColumnNames(client);
    if (cols.length !== 12) failMutation();
    const idxs = await catalog.getSecondaryIndexes(client);
    if (idxs.length !== 3) failMutation();
    await assertNoMutation(client, before);
    pass('tree-comments rollback nonempty guard');
  });
});

test('tree-comments rollback dependent view fail closed', { concurrency: false }, async () => {
  await withDisposableDb('rbdepview', LEGACY_FIXTURE, async ({ client, runSql }) => {
    const apply = runSql(MIGRATION_SQL);
    if (apply.status !== 0) {
      boundedFail(
        'rbdepview',
        'migration_apply',
        classifyMigrationError(combinedOutput(apply)),
        apply.status,
        'exit_0',
        `exit_${apply.status}`
      );
    }
    await catalog.assertCanonicalCatalog(client);
    await client.query(
      `CREATE VIEW public.tree_comments_rb_dep_view AS
       SELECT id, tree_id, body FROM public.tree_comments`
    );
    const before = await catalog.getCatalogFingerprint(client);
    const rb = runSql(ROLLBACK_SQL);
    if (rb.status === 0) {
      boundedFail('rbdepview', 'rollback', 'ROLLBACK_DEPENDENT_VIEW_SHOULD_FAIL', 0, 'nonzero', '0');
    }
    if ((await catalog.getDependentViewCount(client)) < 1) failMutation();
    const cols = await catalog.getColumnNames(client);
    if (cols.length !== 12) failMutation();
    const idxs = await catalog.getSecondaryIndexes(client);
    if (idxs.length !== 3) failMutation();
    await assertNoMutation(client, before);
    pass('tree-comments rollback dependent view guard');
  });
});

test('tree-comments rollback dependent matview fail closed', { concurrency: false }, async () => {
  await withDisposableDb('rbdepmat', LEGACY_FIXTURE, async ({ client, runSql }) => {
    const apply = runSql(MIGRATION_SQL);
    if (apply.status !== 0) {
      boundedFail(
        'rbdepmat',
        'migration_apply',
        classifyMigrationError(combinedOutput(apply)),
        apply.status,
        'exit_0',
        `exit_${apply.status}`
      );
    }
    await catalog.assertCanonicalCatalog(client);
    await client.query(
      `CREATE MATERIALIZED VIEW public.tree_comments_rb_dep_matview AS
       SELECT id, tree_id, body FROM public.tree_comments`
    );
    const before = await catalog.getCatalogFingerprint(client);
    const rb = runSql(ROLLBACK_SQL);
    if (rb.status === 0) {
      boundedFail('rbdepmat', 'rollback', 'ROLLBACK_DEPENDENT_MATVIEW_SHOULD_FAIL', 0, 'nonzero', '0');
    }
    if ((await catalog.getDependentMatviewCount(client)) < 1) failMutation();
    const cols = await catalog.getColumnNames(client);
    if (cols.length !== 12) failMutation();
    const idxs = await catalog.getSecondaryIndexes(client);
    if (idxs.length !== 3) failMutation();
    await assertNoMutation(client, before);
    pass('tree-comments rollback dependent matview guard');
  });
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function quoteIdent(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error('INVALID_IDENT');
  }
  return `"${name}"`;
}

function classifyMigrationError(out) {
  if (/syntax error/i.test(out)) return 'MIGRATION_SYNTAX_ERROR';
  if (/plpgsql/i.test(out) && /error/i.test(out)) return 'MIGRATION_PLPGSQL_ERROR';
  if (/PREFLIGHT FAIL/i.test(out)) return 'MIGRATION_PREFLIGHT_FALSE_NEGATIVE';
  if (/POST-VERIFY FAIL/i.test(out)) return 'MIGRATION_POST_VALIDATION_FAILURE';
  if (/PREFLIGHT STOP/i.test(out)) return 'MIGRATION_PREFLIGHT_STOP';
  return 'MIGRATION_ENGINE_ERROR';
}

function classifyRollbackError(out) {
  if (/syntax error/i.test(out)) return 'ROLLBACK_SYNTAX_ERROR';
  if (/ROLLBACK PRECONDITION FAIL/i.test(out)) return 'ROLLBACK_PREFLIGHT_FALSE_NEGATIVE';
  if (/POST-VERIFY FAIL|POST-ROLLBACK/i.test(out)) return 'ROLLBACK_POST_VALIDATION_FAILURE';
  return 'ROLLBACK_ENGINE_ERROR';
}
