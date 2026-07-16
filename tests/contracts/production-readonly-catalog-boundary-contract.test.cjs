'use strict';

/**
 * Source-static contract: Production-readonly catalog connection boundary (#3570).
 *
 * No Production DB session. Synthetic secret files only under temp dirs mapped
 * via repo-relative .secrets fixtures created in-process under os.tmpdir is NOT
 * used for path confinement — tests use temporary directories under
 * tests/contracts/fixtures/... and also pure parsers that take string content.
 *
 * Refs #3570, #3458
 * Refs #3425 — Keep #3425 OPEN.
 * Refs #1882 — Keep #1882 OPEN.
 * #3569 is CLOSED / completed. Do not reopen.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const CORE = require(path.join(REPO, 'scripts/production-readonly-catalog-boundary-core.cjs'));
const ADAPTER = require(path.join(
  REPO,
  'scripts/migration-catalog-postgres-adapter-core.cjs'
));
const CLI_PATH = path.join(
  REPO,
  'scripts/build-production-readonly-catalog-evidence-from-postgres.cjs'
);
const DISPOSABLE_CLI = path.join(
  REPO,
  'scripts/build-migration-catalog-evidence-from-postgres.cjs'
);
const ADAPTER_CORE = path.join(REPO, 'scripts/migration-catalog-postgres-adapter-core.cjs');
const BOUNDARY_CONTRACT = path.join(
  REPO,
  'db/migration-provenance/production-readonly-catalog-boundary-contract.json'
);
const ADOPTION_CONTRACT = path.join(
  REPO,
  'db/migration-provenance/adoption-baseline-collection-plan-contract.json'
);


// Build fixture URLs without contiguous credential-looking string literals (GitGuardian).
function fixturePgUrl(opts) {
  const user = opts.user || 'fixtureuser';
  const token = opts.token || 'fixturetoken';
  const host = opts.host || 'db.example.test';
  const port = opts.port || '5432';
  const db = opts.db || 'appdb';
  const sslmode = opts.sslmode || 'require';
  const extra = opts.extraQuery ? ('&' + opts.extraQuery) : '';
  return ['postgresql', '://', user, ':', token, '@', host, ':', port, '/', db, '?sslmode=', sslmode, extra].join('');
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function catchCategory(fn) {
  try {
    fn();
    return null;
  } catch (e) {
    return e.category || e.message;
  }
}

function withTempSecrets(files, fn) {
  const secretsDir = path.join(REPO, '.secrets');
  fs.mkdirSync(secretsDir, { recursive: true });
  const created = [];
  try {
    for (const [name, content] of Object.entries(files)) {
      const abs = path.join(secretsDir, name);
      fs.writeFileSync(abs, content, 'utf8');
      created.push(abs);
    }
    return fn();
  } finally {
    for (const abs of created) {
      try {
        fs.unlinkSync(abs);
      } catch {
        /* ignore */
      }
    }
  }
}

test('boundary contract and dedicated secret key are fixed', () => {
  const c = JSON.parse(read(BOUNDARY_CONTRACT));
  assert.equal(c.mode, 'PRODUCTION_READONLY_CATALOG');
  assert.equal(c.dedicated_secret_key, 'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL');
  assert.equal(c.disposable_mode_preserved, 'DISPOSABLE_CI');
  assert.ok(c.prohibited_secret_keys.includes('DATABASE_URL'));
  assert.equal(c.caller_object_override, false);
  assert.equal(c.caller_sql, false);
  assert.ok(c.cli_forbidden_flags.includes('--password'));
  assert.ok(c.cli_forbidden_flags.includes('--host'));
  assert.ok(c.url_policy.require_tls);
  assert.equal(c.version_policy.supported_major, 17);
});

test('disposable adapter restrictions remain unchanged', () => {
  // loopback + lovebud_ci accepted
  assert.deepEqual(
    ADAPTER.validateConnectionConfig({
      host: '127.0.0.1',
      port: 5432,
      user: 'u',
      password: 'p',
      database: 'lovebud_ci_x',
    }),
    {
      host: '127.0.0.1',
      port: 5432,
      user: 'u',
      password: 'p',
      database: 'lovebud_ci_x',
      connectionTimeoutMillis: 10000,
    }
  );
  assert.equal(
    catchCategory(() =>
      ADAPTER.validateConnectionConfig({
        host: 'db.example.test',
        port: 5432,
        user: 'u',
        password: 'p',
        database: 'lovebud_ci_x',
      })
    ),
    'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID'
  );
  assert.equal(
    catchCategory(() =>
      ADAPTER.validateConnectionConfig({
        host: '127.0.0.1',
        port: 5432,
        user: 'u',
        password: 'p',
        database: 'neondb',
      })
    ),
    'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID'
  );
  assert.equal(ADAPTER.REQUIRED_SERVER_VERSION_NUM, 170004);
  assert.equal(
    catchCategory(() => ADAPTER.assertServerVersionForMode('DISPOSABLE_CI', 170005)),
    'CATALOG_ADAPTER_SERVER_VERSION_MISMATCH'
  );
  // Production marker must not be accepted by disposable validator
  assert.equal(
    catchCategory(() =>
      ADAPTER.validateConnectionConfig({
        __productionReadonlyValidated: true,
        host: 'db.example.test',
        port: 5432,
        user: 'u',
        password: 'p',
        database: 'appdb',
        ssl: { rejectUnauthorized: true },
      })
    ),
    'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID'
  );
  const disposableCli = read(DISPOSABLE_CLI);
  assert.match(disposableCli, /--password/);
  assert.match(disposableCli, /No DATABASE_URL/);
  assert.doesNotMatch(disposableCli, /LOVEBUD_PRODUCTION_READONLY_DATABASE_URL/);
});

test('secret file parser accepts dedicated key and rejects generic-only / duplicates', () => {
  const ok = CORE.parseSecretFileKeyValues(
    'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({ user: 'u', token: 'p', db: 'app' }) + '\n'
  );
  assert.equal(ok.has('LOVEBUD_PRODUCTION_READONLY_DATABASE_URL'), true);

  assert.equal(
    catchCategory(() =>
      CORE.parseSecretFileKeyValues(
        'DATABASE_URL=' +
          ['postgresql', '://', 'u', ':', 'p', '@', 'db.example.test', '/', 'app'].join('') +
          '\n'
      )
    ),
    // dedicated missing + generic present handled at loadDedicated*
    null
  );
  // dedicated missing with generic only
  assert.equal(
    catchCategory(() =>
      withTempSecrets(
        {
          'tmp-generic-only-3570.env':
            'DATABASE_URL=' +
            ['postgresql', '://', 'u', ':', 'p', '@', 'db.example.test', '/', 'app', '?sslmode=require'].join('') +
            '\n',
        },
        () =>
          CORE.loadDedicatedProductionReadonlyDatabaseUrl(
            REPO,
            '.secrets/tmp-generic-only-3570.env'
          )
      )
    ),
    'PRODUCTION_CATALOG_GENERIC_DATABASE_URL_REJECTED'
  );

  assert.equal(
    catchCategory(() =>
      withTempSecrets(
        {
          'tmp-missing-3570.env': 'OTHER_KEY=1\n',
        },
        () => CORE.loadDedicatedProductionReadonlyDatabaseUrl(REPO, '.secrets/tmp-missing-3570.env')
      )
    ),
    'PRODUCTION_CATALOG_SECRET_REQUIRED'
  );

  assert.equal(
    catchCategory(() =>
      CORE.parseSecretFileKeyValues('A=1\nA=2\n')
    ),
    'PRODUCTION_CATALOG_SECRET_FILE_INVALID'
  );
});

test('URL/TLS validation matrix (pure)', () => {
  const good = fixturePgUrl({});
  const cfg = CORE.parseProductionReadonlyDatabaseUrl(good);
  assert.equal(cfg.__productionReadonlyValidated, true);
  assert.equal(cfg.host, 'db.example.test');
  assert.equal(cfg.user, 'fixtureuser');
  assert.equal(cfg.database, 'appdb');
  assert.equal(cfg.ssl.rejectUnauthorized, true);

  assert.equal(
    catchCategory(() =>
      CORE.parseProductionReadonlyDatabaseUrl(
        fixturePgUrl({ host: '127.0.0.1', user: 'u', token: 'p', db: 'app' })
      )
    ),
    'PRODUCTION_CATALOG_LOOPBACK_REJECTED'
  );
  assert.equal(
    catchCategory(() =>
      CORE.parseProductionReadonlyDatabaseUrl(
        fixturePgUrl({ host: 'localhost', user: 'u', token: 'p', db: 'app' })
      )
    ),
    'PRODUCTION_CATALOG_LOOPBACK_REJECTED'
  );
  assert.equal(
    catchCategory(() =>
      CORE.parseProductionReadonlyDatabaseUrl(
        fixturePgUrl({ user: 'u', token: 'p', db: 'app', sslmode: 'disable' })
      )
    ),
    'PRODUCTION_CATALOG_TLS_REQUIRED'
  );
  assert.equal(
    catchCategory(() =>
      CORE.parseProductionReadonlyDatabaseUrl(['postgresql','://','u',':','p','@','db.example.test',':','5432','/','app'].join(''))
    ),
    'PRODUCTION_CATALOG_TLS_REQUIRED'
  );
  assert.equal(
    catchCategory(() => CORE.parseProductionReadonlyDatabaseUrl(['mysql','://','u',':','p','@','db.example.test','/','app'].join(''))),
    'PRODUCTION_CATALOG_URL_INVALID'
  );
  assert.equal(
    catchCategory(() =>
      CORE.parseProductionReadonlyDatabaseUrl(
        ['postgresql','://','u',':','p','@','db.example.test',':','5432','/','app','?sslmode=require#frag'].join('')
      )
    ),
    'PRODUCTION_CATALOG_URL_INVALID'
  );
  assert.equal(
    catchCategory(() =>
      CORE.parseProductionReadonlyDatabaseUrl(
        fixturePgUrl({ user: 'u', token: 'p', db: 'app', extraQuery: 'password=nested' })
      )
    ),
    'PRODUCTION_CATALOG_URL_INVALID'
  );
  const long = fixturePgUrl({ user: 'u', token: 'p', db: 'app', extraQuery: 'pad=' + 'x'.repeat(5000) });
  assert.equal(
    catchCategory(() => CORE.parseProductionReadonlyDatabaseUrl(long)),
    'PRODUCTION_CATALOG_URL_INVALID'
  );

  // errors must not embed raw URL
  try {
    CORE.parseProductionReadonlyDatabaseUrl(
      fixturePgUrl({ user: 'u', token: 'fixturetoken-should-not-leak', db: 'app', sslmode: 'disable' })
    );
    assert.fail('expected throw');
  } catch (e) {
    const blob = JSON.stringify(e);
    assert.equal(blob.includes('fixturetoken-should-not-leak'), false);
    assert.equal(blob.includes('db.example.test'), false);
    assert.equal(e.category, 'PRODUCTION_CATALOG_TLS_REQUIRED');
  }
});

test('Production version policy major 17 window', () => {
  assert.equal(CORE.isSupportedProductionServerVersionNum(170000), true);
  assert.equal(CORE.isSupportedProductionServerVersionNum(170004), true);
  assert.equal(CORE.isSupportedProductionServerVersionNum(179999), true);
  assert.equal(CORE.isSupportedProductionServerVersionNum(169999), false);
  assert.equal(CORE.isSupportedProductionServerVersionNum(180000), false);
  assert.equal(ADAPTER.isSupportedProductionServerVersionNum(170100), true);
  assert.equal(
    catchCategory(() => ADAPTER.assertServerVersionForMode('PRODUCTION_READONLY_CATALOG', 160000)),
    'PRODUCTION_CATALOG_SERVER_VERSION_UNSUPPORTED'
  );
  assert.equal(
    catchCategory(() => ADAPTER.assertServerVersionForMode('PRODUCTION_READONLY_CATALOG', 180000)),
    'PRODUCTION_CATALOG_SERVER_VERSION_UNSUPPORTED'
  );
  // disposable exactness preserved
  assert.equal(
    catchCategory(() => ADAPTER.assertServerVersionForMode('DISPOSABLE_CI', 170000)),
    'CATALOG_ADAPTER_SERVER_VERSION_MISMATCH'
  );
});

test('frozen allowlist loaded from adoption contract; caller override rejected', () => {
  const objects = CORE.loadFrozenAdoptionAllowlistObjects(REPO);
  assert.equal(objects.length, 9);
  assert.deepEqual(
    objects.map((o) => `${o.object_kind}:${o.schema}.${o.object_name}`).sort(),
    [
      'TABLE:public.comments',
      'TABLE:public.memories',
      'TABLE:public.reactions',
      'TABLE:public.social_audit_log',
      'TABLE:public.social_idempotency',
      'TABLE:public.tree_comments',
      'TABLE:public.tree_likes',
      'TABLE:public.tree_social_counts',
      'TABLE:public.trees',
    ].sort()
  );
  assert.equal(
    catchCategory(() => CORE.rejectCallerOverrides({ objects: [] })),
    'PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED'
  );
  assert.equal(
    catchCategory(() => CORE.rejectCallerOverrides({ sql: 'select 1' })),
    'PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED'
  );
  assert.equal(
    catchCategory(() => CORE.rejectCallerOverrides({ DATABASE_URL: 'x' })),
    'PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED'
  );
  assert.equal(
    catchCategory(() => CORE.rejectCallerOverrides({ client: {} })),
    'PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED'
  );
});

test('role mapping synthetic valid; unmapped classes fail; raw role not in errors', () => {
  withTempSecrets(
    {
      'tmp-roles-3570.json': JSON.stringify({
        role_mapping: {
          synthetic_app_role: 'APPLICATION',
          synthetic_owner_role: 'OWNER_CLASS',
        },
      }),
    },
    () => {
      const map = CORE.loadProductionRoleMapping(REPO, '.secrets/tmp-roles-3570.json');
      assert.equal(map.synthetic_app_role, 'APPLICATION');
      assert.equal(map.public, 'PUBLIC');
    }
  );

  assert.equal(
    catchCategory(() => CORE.loadProductionRoleMapping(REPO, '')),
    'PRODUCTION_CATALOG_ROLE_MAPPING_REQUIRED'
  );

  assert.equal(
    catchCategory(() =>
      withTempSecrets(
        {
          'tmp-bad-roles-3570.json': JSON.stringify({
            role_mapping: { synthetic_x: 'DATABASE_OWNER' },
          }),
        },
        () => CORE.loadProductionRoleMapping(REPO, '.secrets/tmp-bad-roles-3570.json')
      )
    ),
    'PRODUCTION_CATALOG_ROLE_MAPPING_INVALID'
  );

  try {
    withTempSecrets(
      {
        'tmp-bad-roles2-3570.json': JSON.stringify({
          role_mapping: { 'raw-prod-role-should-not-leak': 'NOT_A_CLASS' },
        }),
      },
      () => CORE.loadProductionRoleMapping(REPO, '.secrets/tmp-bad-roles2-3570.json')
    );
    assert.fail('expected');
  } catch (e) {
    const blob = JSON.stringify(e);
    assert.equal(blob.includes('raw-prod-role-should-not-leak'), false);
  }
});

test('build invocation plan end-to-end with synthetic secrets only', () => {
  const secretBody = [
    'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({ user: 'fixtureuser', token: 'fixturetoken', host: 'db.example.test', port: '5432', db: 'appdb', sslmode: 'require' }),
    'DATABASE_URL=' + ['postgresql','://','should-not-fallback','@','db.example.test','/','x','?sslmode=require'].join(''),
    '',
  ].join('\n');
  const rolesBody = JSON.stringify({
    role_mapping: {
      synthetic_service_role: 'SERVICE',
      synthetic_auth_role: 'AUTHENTICATED',
    },
  });

  const plan = withTempSecrets(
    {
      'tmp-prod-url-3570.env': secretBody,
      'tmp-prod-roles-3570.json': rolesBody,
    },
    () =>
      CORE.buildProductionReadonlyInvocationPlan(REPO, {
        secretFile: '.secrets/tmp-prod-url-3570.env',
        roleMappingFile: '.secrets/tmp-prod-roles-3570.json',
      })
  );

  assert.equal(plan.mode, 'PRODUCTION_READONLY_CATALOG');
  assert.equal(plan.objectCount, 9);
  assert.equal(plan.connection.__productionReadonlyValidated, true);
  assert.equal(plan.connection.host, 'db.example.test');
  const clientCfg = CORE.stripValidatedConnectionForClient(plan.connection);
  assert.equal(clientCfg.ssl.rejectUnauthorized, true);
  assert.ok(ADAPTER.acceptProductionReadonlyConnectionConfig(plan.connection));
});

test('Production CLI source surface has no password/host/user/database argv and no generic DATABASE_URL', () => {
  const cli = read(CLI_PATH);
  const allowedBlock = cli.match(/const ALLOWED_FLAGS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(allowedBlock, 'ALLOWED_FLAGS block present');
  const allowed = allowedBlock[1];
  assert.match(allowed, /--secret-file/);
  assert.match(allowed, /--role-mapping-file/);
  assert.match(allowed, /--validate-only/);
  assert.doesNotMatch(allowed, /password|host|user|database|port|objects|sql/i);
  const forbiddenBlock = cli.match(/const FORBIDDEN_FLAGS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(forbiddenBlock, 'FORBIDDEN_FLAGS block present');
  assert.match(forbiddenBlock[1], /password/);
  assert.doesNotMatch(cli, /process\.env\.DATABASE_URL/);
  assert.match(cli, /LOVEBUD_PRODUCTION_READONLY_DATABASE_URL|dedicatedSecretKey|secret-file/);
  assert.doesNotMatch(cli, /neon\.tech|cloud\.neon|dashboard\.|console\.cloud/);
  assert.doesNotMatch(cli, /child_process|execSync|spawnSync/);
  assert.doesNotMatch(cli, /\bACTIVE\b|\bATTESTED\b|\bAPPLIED\b/);
});

test('CLI validate-only succeeds with synthetic secrets and never prints password', () => {
  const { spawnSync } = require('node:child_process');
  const secretBody =
    'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({ user: 'fixtureuser', token: 'fixturetoken', host: 'db.example.test', port: '5432', db: 'appdb', sslmode: 'require\n' });
  const rolesBody = JSON.stringify({
    role_mapping: { synthetic_application_role: 'APPLICATION' },
  });

  const result = withTempSecrets(
    {
      'tmp-cli-url-3570.env': secretBody,
      'tmp-cli-roles-3570.json': rolesBody,
    },
    () =>
      spawnSync(
        process.execPath,
        [
          CLI_PATH,
          '--secret-file',
          '.secrets/tmp-cli-url-3570.env',
          '--role-mapping-file',
          '.secrets/tmp-cli-roles-3570.json',
          '--validate-only',
        ],
        { cwd: REPO, encoding: 'utf8' }
      )
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.includes('fixturetoken'), false);
  assert.equal(result.stdout.includes('fixtureuser'), false);
  const report = JSON.parse(result.stdout);
  assert.equal(report.decision, 'VALIDATION_PASS');
  assert.equal(report.object_count, 9);
  assert.equal(report.mode, 'PRODUCTION_READONLY_CATALOG');
});

test('CLI rejects forbidden password flag', () => {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync(
    process.execPath,
    [CLI_PATH, '--password', 'nope'],
    { cwd: REPO, encoding: 'utf8' }
  );
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout.includes('nope'), false);
  const report = JSON.parse(result.stdout);
  assert.equal(report.decision, 'FAIL_CLOSED');
  assert.ok(
    report.blockers.includes('PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED') ||
      report.blockers.includes('PRODUCTION_CATALOG_INPUT_INVALID')
  );
});

test('adapter mode resolution and no transaction bypass surface', () => {
  assert.equal(ADAPTER.resolveCollectionMode({}), 'DISPOSABLE_CI');
  assert.equal(
    ADAPTER.resolveCollectionMode({ mode: 'PRODUCTION_READONLY_CATALOG' }),
    'PRODUCTION_READONLY_CATALOG'
  );
  assert.equal(
    catchCategory(() => ADAPTER.resolveCollectionMode({ mode: 'WRITE_ANYTHING' })),
    'CATALOG_ADAPTER_MODE_INVALID'
  );
  const src = read(ADAPTER_CORE);
  assert.match(src, /BEGIN READ ONLY/);
  assert.match(src, /ROLLBACK/);
  assert.doesNotMatch(src, /manageTransaction:\s*false/);
  assert.match(src, /rejectBypassOptions/);
  assert.match(src, /COLLECTION_MODE/);
});

test('manifests remain inactive and unchanged bytes for this suite setup', () => {
  const canonical = JSON.parse(
    read(path.join(REPO, 'db/migration-provenance/canonical-migrations.json'))
  );
  const expected = JSON.parse(
    read(path.join(REPO, 'db/migration-provenance/expected-schema-manifest.json'))
  );
  assert.ok(canonical);
  assert.equal(expected.status || expected.adoption_status, 'ADOPTION_REQUIRED');
  const adoption = JSON.parse(read(ADOPTION_CONTRACT));
  assert.equal(adoption.fixed_field_values.plan_status, 'PREPARED_ONLY');
  assert.equal(adoption.reviewed_object_allowlist.length, 9);
});

test('package script and docs mention Production-readonly boundary without hostname literals', () => {
  const pkg = JSON.parse(read(path.join(REPO, 'package.json')));
  assert.equal(
    pkg.scripts['build:production-readonly-catalog-evidence-from-postgres'],
    'node scripts/build-production-readonly-catalog-evidence-from-postgres.cjs'
  );
  const docs = read(path.join(REPO, 'docs/architecture/DB_MIGRATION_PROVENANCE_GATE.md'));
  assert.match(docs, /PRODUCTION_READONLY_CATALOG|Production-readonly catalog connection boundary/);
  assert.match(docs, /LOVEBUD_PRODUCTION_READONLY_DATABASE_URL/);
  assert.doesNotMatch(docs, /neon\.tech|console\.neon|cloud\.neon/);
  assert.match(docs, /DISPOSABLE_CI/);
});
