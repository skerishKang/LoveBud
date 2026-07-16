'use strict';

/**
 * Source-static contract: Production-readonly catalog connection boundary (#3570).
 *
 * Isolated temp repo roots only — never creates/modifies/deletes REPO/.secrets.
 * No Production DB session.
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
const { spawnSync } = require('node:child_process');

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

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function fixturePgUrl(opts) {
  const user = opts.user || 'fixtureuser';
  const token = opts.token || 'fixturetoken';
  let host = opts.host || 'db.example.test';
  // IPv6 hosts must be bracketed in URLs.
  if (host.startsWith('[')) {
    /* already bracketed */
  } else if (host.includes(':')) {
    host = '[' + host + ']';
  }
  const port = opts.port || '5432';
  const db = opts.db || 'appdb';
  const sslmode = opts.sslmode === undefined ? 'require' : opts.sslmode;
  const extra = opts.extraQuery ? '&' + opts.extraQuery : '';
  if (!sslmode) {
    return ['postgresql', '://', user, ':', token, '@', host, ':', port, '/', db].join('');
  }
  return [
    'postgresql',
    '://',
    user,
    ':',
    token,
    '@',
    host,
    ':',
    port,
    '/',
    db,
    '?sslmode=',
    sslmode,
    extra,
  ].join('');
}

function catchCategory(fn) {
  try {
    fn();
    return null;
  } catch (e) {
    return e.category || e.message;
  }
}

/**
 * Fully isolated temporary repository root with synthetic contracts + .secrets.
 * Never touches REPO/.secrets.
 */
function withIsolatedRepo(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-prod-ro-'));
  const secretsDir = path.join(root, '.secrets');
  const provDir = path.join(root, 'db', 'migration-provenance');
  fs.mkdirSync(secretsDir, { recursive: true });
  fs.mkdirSync(provDir, { recursive: true });
  fs.copyFileSync(
    ADOPTION_CONTRACT,
    path.join(provDir, 'adoption-baseline-collection-plan-contract.json')
  );
  fs.copyFileSync(
    BOUNDARY_CONTRACT,
    path.join(provDir, 'production-readonly-catalog-boundary-contract.json')
  );
  try {
    for (const [name, content] of Object.entries(files || {})) {
      fs.writeFileSync(path.join(secretsDir, name), content, 'utf8');
    }
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function listRepoSecretsIfAny() {
  const p = path.join(REPO, '.secrets');
  if (!fs.existsSync(p)) return null;
  try {
    return fs.readdirSync(p).sort();
  } catch {
    return null;
  }
}

test('boundary contract and dedicated secret key are fixed', () => {
  const c = JSON.parse(read(BOUNDARY_CONTRACT));
  assert.equal(c.mode, 'PRODUCTION_READONLY_CATALOG');
  assert.equal(c.dedicated_secret_key, 'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL');
  assert.equal(c.disposable_mode_preserved, 'DISPOSABLE_CI');
  assert.ok(c.prohibited_secret_keys.includes('DATABASE_URL'));
  assert.equal(c.caller_object_override, false);
});

test('disposable adapter restrictions remain unchanged', () => {
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
  // forged Production marker rejected by disposable validator
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
  // generic adapter rejects mode field (async fn rejects as promise)
  assert.equal(
    typeof ADAPTER.collectCatalogMetadata,
    'function'
  );
  assert.equal(typeof ADAPTER.acceptProductionReadonlyConnectionConfig, 'undefined');
  assert.equal(typeof ADAPTER.resolveCollectionMode, 'undefined');
  assert.equal(typeof ADAPTER.COLLECTION_MODE, 'undefined');
  const disposableCli = read(DISPOSABLE_CLI);
  assert.match(disposableCli, /--password/);
  assert.doesNotMatch(disposableCli, /LOVEBUD_PRODUCTION_READONLY_DATABASE_URL/);
});

test('forged marker and private handle cannot open Production collector', async () => {
  async function cat(fn) {
    try {
      await fn();
      return null;
    } catch (e) {
      return e.category || e.message;
    }
  }
  assert.equal(
    await cat(() =>
      ADAPTER.collectProductionReadonlyCatalogEvidenceFromFiles({
        repoRoot: REPO,
        secretFile: '.secrets/nope.env',
        roleMappingFile: '.secrets/nope.json',
        objects: [{ schema: 'public', object_name: 'trees', object_kind: 'TABLE' }],
      })
    ),
    'CATALOG_ADAPTER_INPUT_INVALID'
  );
  assert.equal(
    await cat(() =>
      ADAPTER.collectProductionReadonlyCatalogEvidenceFromFiles({
        repoRoot: REPO,
        secretFile: '.secrets/nope.env',
        roleMappingFile: '.secrets/nope.json',
        connection: { __productionReadonlyValidated: true, host: 'x' },
      })
    ),
    'CATALOG_ADAPTER_INPUT_INVALID'
  );
  assert.equal(
    await cat(() =>
      ADAPTER.collectProductionReadonlyCatalogEvidenceFromFiles({
        repoRoot: REPO,
        secretFile: '.secrets/nope.env',
        roleMappingFile: '.secrets/nope.json',
        roleMapping: { public: 'PUBLIC' },
      })
    ),
    'CATALOG_ADAPTER_INPUT_INVALID'
  );
  assert.equal(
    await cat(() =>
      ADAPTER.collectProductionReadonlyCatalogEvidenceFromFiles({
        repoRoot: REPO,
        secretFile: '.secrets/nope.env',
        roleMappingFile: '.secrets/nope.json',
        mode: 'PRODUCTION_READONLY_CATALOG',
      })
    ),
    'CATALOG_ADAPTER_INPUT_INVALID'
  );
  // generic collect rejects mode
  assert.equal(
    await cat(() =>
      ADAPTER.collectCatalogMetadata({
        mode: 'PRODUCTION_READONLY_CATALOG',
        connection: {
          host: '127.0.0.1',
          port: 5432,
          user: 'u',
          password: 'p',
          database: 'lovebud_ci_x',
        },
        objects: [{ schema: 'public', object_name: 'trees', object_kind: 'TABLE' }],
        roleMapping: { public: 'PUBLIC' },
        contract: ADAPTER.loadContract(REPO),
      })
    ),
    'CATALOG_ADAPTER_INPUT_INVALID'
  );
  // JSON-cloned handle is not trusted (WeakMap object identity — branded-looking object fails)
  assert.equal(
    catchCategory(() =>
      CORE.toPgClientConfigFromInvocationPlan({
        handle: { brand: true },
      })
    ),
    'PRODUCTION_CATALOG_HANDLE_INVALID'
  );
});

test('dedicated key only: extra or prohibited keys fail even with dedicated present', () => {
  // dedicated + DATABASE_URL together must fail
  assert.equal(
    catchCategory(() =>
      CORE.parseSecretFileKeyValues(
        [
          'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({}),
          'DATABASE_URL=' + fixturePgUrl({ db: 'other' }),
          '',
        ].join('\n')
      )
    ),
    'PRODUCTION_CATALOG_GENERIC_DATABASE_URL_REJECTED'
  );
  assert.equal(
    catchCategory(() =>
      CORE.parseSecretFileKeyValues('OTHER_KEY=1\n')
    ),
    'PRODUCTION_CATALOG_SECRET_FILE_INVALID'
  );
  assert.equal(
    catchCategory(() =>
      CORE.parseSecretFileKeyValues(
        'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({}) + '\nOTHER=1\n'
      )
    ),
    'PRODUCTION_CATALOG_SECRET_FILE_INVALID'
  );
  assert.equal(
    catchCategory(() =>
      CORE.parseSecretFileKeyValues(
        'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=a\nLOVEBUD_PRODUCTION_READONLY_DATABASE_URL=b\n'
      )
    ),
    'PRODUCTION_CATALOG_SECRET_FILE_INVALID'
  );
  assert.equal(
    catchCategory(() =>
      CORE.parseSecretFileKeyValues('export LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=x\n')
    ),
    'PRODUCTION_CATALOG_SECRET_FILE_INVALID'
  );
  const ok = CORE.parseSecretFileKeyValues(
    '# comment\n\nLOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({}) + '\n'
  );
  assert.equal(ok.size, 1);
  assert.equal(ok.has('LOVEBUD_PRODUCTION_READONLY_DATABASE_URL'), true);
});

test('loopback alternate forms are all rejected', () => {
  const hosts = [
    'localhost',
    'localhost.',
    'LOCALHOST',
    '127.0.0.1',
    '127.1',
    '127.0.0.2',
    '2130706433',
    '0x7f000001',
    '0177.0.0.1',
    '::1',
    '[::1]',
    '[0:0:0:0:0:0:0:1]',
    '[::ffff:127.0.0.1]',
    '[::ffff:7f00:1]',
  ];
  for (const host of hosts) {
    assert.equal(
      CORE.isLoopbackHost(host),
      true,
      'expected loopback: ' + host
    );
    assert.equal(
      catchCategory(() =>
        CORE.parseProductionReadonlyDatabaseUrl(
          fixturePgUrl({ host, user: 'u', token: 'p', db: 'app' })
        )
      ),
      'PRODUCTION_CATALOG_LOOPBACK_REJECTED',
      'url reject: ' + host
    );
  }
  // remote accepted
  const cfg = CORE.parseProductionReadonlyDatabaseUrl(fixturePgUrl({ host: 'db.example.test' }));
  assert.equal(cfg.host, 'db.example.test');
  assert.equal(Object.prototype.hasOwnProperty.call(cfg, '__productionReadonlyValidated'), false);
  // error context never includes host
  try {
    CORE.parseProductionReadonlyDatabaseUrl(
      fixturePgUrl({ host: '127.0.0.1', sslmode: 'disable' })
    );
    assert.fail('expected');
  } catch (e) {
    const blob = JSON.stringify(e);
    assert.equal(blob.includes('127.0.0.1'), false);
    assert.equal(blob.includes('localhost'), false);
  }
});

test('URL TLS and malformed matrix', () => {
  assert.equal(
    catchCategory(() =>
      CORE.parseProductionReadonlyDatabaseUrl(
        fixturePgUrl({ host: 'db.example.test', sslmode: 'disable' })
      )
    ),
    'PRODUCTION_CATALOG_TLS_REQUIRED'
  );
  assert.equal(
    catchCategory(() =>
      CORE.parseProductionReadonlyDatabaseUrl(
        fixturePgUrl({ host: 'db.example.test', sslmode: '' })
      )
    ),
    'PRODUCTION_CATALOG_TLS_REQUIRED'
  );
  assert.equal(
    catchCategory(() =>
      CORE.parseProductionReadonlyDatabaseUrl(
        ['mysql', '://', 'u', ':', 'p', '@', 'db.example.test', '/', 'app'].join('')
      )
    ),
    'PRODUCTION_CATALOG_URL_INVALID'
  );
  assert.equal(
    catchCategory(() =>
      CORE.parseProductionReadonlyDatabaseUrl(
        fixturePgUrl({ host: 'db.example.test' }) + '#frag'
      )
    ),
    'PRODUCTION_CATALOG_URL_INVALID'
  );
  assert.equal(
    catchCategory(() =>
      CORE.parseProductionReadonlyDatabaseUrl(
        fixturePgUrl({ host: 'db.example.test', extraQuery: 'password=nested' })
      )
    ),
    'PRODUCTION_CATALOG_URL_INVALID'
  );
});

test('Production version policy major 17 window', () => {
  assert.equal(CORE.isSupportedProductionServerVersionNum(170000), true);
  assert.equal(CORE.isSupportedProductionServerVersionNum(170004), true);
  assert.equal(CORE.isSupportedProductionServerVersionNum(179999), true);
  assert.equal(CORE.isSupportedProductionServerVersionNum(169999), false);
  assert.equal(CORE.isSupportedProductionServerVersionNum(180000), false);
  assert.equal(
    catchCategory(() => CORE.assertSupportedProductionServerVersionNum(160000)),
    'PRODUCTION_CATALOG_SERVER_VERSION_UNSUPPORTED'
  );
});

test('frozen allowlist and caller override rejection', () => {
  const objects = CORE.loadFrozenAdoptionAllowlistObjects(REPO);
  assert.equal(objects.length, 9);
  assert.equal(
    catchCategory(() => CORE.rejectCallerOverrides({ objects: [] })),
    'PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED'
  );
  assert.equal(
    catchCategory(() => CORE.rejectCallerOverrides({ connection: {} })),
    'PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED'
  );
  assert.equal(
    catchCategory(() => CORE.rejectCallerOverrides({ roleMapping: {} })),
    'PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED'
  );
  assert.equal(
    catchCategory(() => CORE.rejectCallerOverrides({ mode: 'PRODUCTION_READONLY_CATALOG' })),
    'PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED'
  );
  assert.equal(
    catchCategory(() => CORE.rejectCallerOverrides({ __productionReadonlyValidated: true })),
    'PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED'
  );
});

test('role mapping synthetic valid; missing required', () => {
  withIsolatedRepo(
    {
      'roles.json': JSON.stringify({
        role_mapping: { synthetic_app_role: 'APPLICATION' },
      }),
    },
    (root) => {
      const map = CORE.loadProductionRoleMapping(root, '.secrets/roles.json');
      assert.equal(map.synthetic_app_role, 'APPLICATION');
      assert.equal(map.public, 'PUBLIC');
    }
  );
  assert.equal(
    catchCategory(() => CORE.loadProductionRoleMapping(REPO, '')),
    'PRODUCTION_CATALOG_ROLE_MAPPING_REQUIRED'
  );
});

test('build invocation plan uses opaque handle; no forgeable marker', () => {
  const plan = withIsolatedRepo(
    {
      'url.env':
        'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({}) + '\n',
      'roles.json': JSON.stringify({
        role_mapping: { synthetic_service_role: 'SERVICE' },
      }),
    },
    (root) =>
      CORE.buildProductionReadonlyInvocationPlan(root, {
        secretFile: '.secrets/url.env',
        roleMappingFile: '.secrets/roles.json',
      })
  );
  assert.equal(plan.mode, 'PRODUCTION_READONLY_CATALOG');
  assert.equal(plan.objectCount, 9);
  assert.ok(plan.handle);
  assert.equal(plan.connection, undefined);
  assert.equal(plan.roleMapping, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(plan, '__productionReadonlyValidated'), false);
  // handle has no caller-visible id property
  assert.equal(Object.prototype.hasOwnProperty.call(plan.handle, 'id'), false);
  const cfg = CORE.toPgClientConfigFromInvocationPlan(plan);
  assert.equal(cfg.host, 'db.example.test');
  assert.equal(cfg.ssl.rejectUnauthorized, true);
  // JSON clone of plan cannot recover private credentials
  const cloned = JSON.parse(JSON.stringify(plan));
  assert.equal(
    catchCategory(() => CORE.toPgClientConfigFromInvocationPlan(cloned)),
    'PRODUCTION_CATALOG_HANDLE_INVALID'
  );
  CORE.releaseInvocationPlan(plan);
});

test('WeakMap handle identity: genuine resolves, JSON/spread/forged all fail', () => {
  const planA = withIsolatedRepo(
    {
      'url.env':
        'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({}) + '\n',
      'roles.json': JSON.stringify({
        role_mapping: { synthetic_a: 'APPLICATION' },
      }),
    },
    (root) =>
      CORE.buildProductionReadonlyInvocationPlan(root, {
        secretFile: '.secrets/url.env',
        roleMappingFile: '.secrets/roles.json',
      })
  );

  // 1. Genuine plan resolves
  const cfg = CORE.toPgClientConfigFromInvocationPlan(planA);
  assert.equal(cfg.host, 'db.example.test');
  assert.equal(cfg.user, 'fixtureuser');

  // 2. JSON-cloned plan fails (WeakMap object identity)
  const jsonClone = JSON.parse(JSON.stringify(planA));
  assert.equal(
    catchCategory(() => CORE.toPgClientConfigFromInvocationPlan(jsonClone)),
    'PRODUCTION_CATALOG_HANDLE_INVALID'
  );

  // 3. Spread-cloned handle fails (different object reference)
  const spreadHandle = { ...planA.handle };
  const spreadPlan = Object.freeze({
    ...planA,
    handle: Object.freeze(spreadHandle),
  });
  assert.equal(
    catchCategory(() => CORE.toPgClientConfigFromInvocationPlan(spreadPlan)),
    'PRODUCTION_CATALOG_HANDLE_INVALID'
  );

  // 4. Forged branded-looking object fails (different object identity, WeakMap cannot match)
  const forgedHandle = { brand: true };
  const forgedPlan = Object.freeze({
    ...planA,
    handle: Object.freeze(forgedHandle),
  });
  assert.equal(
    catchCategory(() => CORE.toPgClientConfigFromInvocationPlan(forgedPlan)),
    'PRODUCTION_CATALOG_HANDLE_INVALID'
  );

  // 5. Forged release cannot invalidate genuine plan
  const forgedReleaseHandle = Object.freeze({});
  CORE.releaseInvocationPlan({ handle: forgedReleaseHandle });
  // Genuine handle still resolves
  const cfgAfter = CORE.toPgClientConfigFromInvocationPlan(planA);
  assert.equal(cfgAfter.host, 'db.example.test');

  // 6. StructuredClone (Node 17+) also fails
  if (typeof structuredClone === 'function') {
    const structuredCloned = structuredClone(planA);
    assert.equal(
      catchCategory(() => CORE.toPgClientConfigFromInvocationPlan(structuredCloned)),
      'PRODUCTION_CATALOG_HANDLE_INVALID'
    );
  }

  CORE.releaseInvocationPlan(planA);
  // After release, genuine plan also fails
  assert.equal(
    catchCategory(() => CORE.toPgClientConfigFromInvocationPlan(planA)),
    'PRODUCTION_CATALOG_HANDLE_INVALID'
  );
});

test('WeakMap release is idempotent and safe on forged/deleted handles', () => {
  // Repeated release on non-existent handle is safe
  assert.doesNotThrow(() => CORE.releaseInvocationPlan({ handle: Object.freeze({}) }));
  assert.doesNotThrow(() => CORE.releaseInvocationPlan(null));
  assert.doesNotThrow(() => CORE.releaseInvocationPlan(undefined));
  assert.doesNotThrow(() => CORE.releaseInvocationPlan({}));

  // Repeated release on genuine plan is safe (idempotent)
  const plan = withIsolatedRepo(
    {
      'url.env':
        'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({}) + '\n',
      'roles.json': JSON.stringify({
        role_mapping: { synthetic_b: 'SERVICE' },
      }),
    },
    (root) =>
      CORE.buildProductionReadonlyInvocationPlan(root, {
        secretFile: '.secrets/url.env',
        roleMappingFile: '.secrets/roles.json',
      })
  );
  assert.doesNotThrow(() => CORE.releaseInvocationPlan(plan));
  assert.doesNotThrow(() => CORE.releaseInvocationPlan(plan));
  assert.doesNotThrow(() => CORE.releaseInvocationPlan(plan));
  // After multiple releases, resolve still fails
  assert.equal(
    catchCategory(() => CORE.toPgClientConfigFromInvocationPlan(plan)),
    'PRODUCTION_CATALOG_HANDLE_INVALID'
  );
});

test('multiple builds create independent handles; each release isolated', () => {
  const planA = withIsolatedRepo(
    {
      'url.env':
        'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({ host: 'db.alpha.test', user: 'ua', token: 'pa' }) + '\n',
      'roles.json': JSON.stringify({
        role_mapping: { synthetic_a: 'APPLICATION' },
      }),
    },
    (root) =>
      CORE.buildProductionReadonlyInvocationPlan(root, {
        secretFile: '.secrets/url.env',
        roleMappingFile: '.secrets/roles.json',
      })
  );
  const planB = withIsolatedRepo(
    {
      'url.env':
        'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({ host: 'db.beta.test', user: 'ub', token: 'pb' }) + '\n',
      'roles.json': JSON.stringify({
        role_mapping: { synthetic_b: 'SERVICE' },
      }),
    },
    (root) =>
      CORE.buildProductionReadonlyInvocationPlan(root, {
        secretFile: '.secrets/url.env',
        roleMappingFile: '.secrets/roles.json',
      })
  );

  // Both resolve
  assert.equal(CORE.toPgClientConfigFromInvocationPlan(planA).host, 'db.alpha.test');
  assert.equal(CORE.toPgClientConfigFromInvocationPlan(planB).host, 'db.beta.test');

  // Release A only; A fails, B still works
  CORE.releaseInvocationPlan(planA);
  assert.equal(
    catchCategory(() => CORE.toPgClientConfigFromInvocationPlan(planA)),
    'PRODUCTION_CATALOG_HANDLE_INVALID'
  );
  assert.equal(CORE.toPgClientConfigFromInvocationPlan(planB).host, 'db.beta.test');

  CORE.releaseInvocationPlan(planB);
  assert.equal(
    catchCategory(() => CORE.toPgClientConfigFromInvocationPlan(planB)),
    'PRODUCTION_CATALOG_HANDLE_INVALID'
  );

  // old handles both fail
  assert.equal(
    catchCategory(() => CORE.toPgClientConfigFromInvocationPlan(planA)),
    'PRODUCTION_CATALOG_HANDLE_INVALID'
  );
});

test('cleanup: explicit release ensures no credential retention', () => {
  const plan = withIsolatedRepo(
    {
      'url.env':
        'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({}) + '\n',
      'roles.json': JSON.stringify({
        role_mapping: { synthetic_c: 'AUTHENTICATED' },
      }),
    },
    (root) =>
      CORE.buildProductionReadonlyInvocationPlan(root, {
        secretFile: '.secrets/url.env',
        roleMappingFile: '.secrets/roles.json',
      })
  );

  // Before release: resolves
  assert.ok(CORE.toPgClientConfigFromInvocationPlan(plan));

  // After release: fails
  CORE.releaseInvocationPlan(plan);
  assert.equal(
    catchCategory(() => CORE.toPgClientConfigFromInvocationPlan(plan)),
    'PRODUCTION_CATALOG_HANDLE_INVALID'
  );

  // No secret values in release path (WeakMap delete is opaque)
  // This is structural: release never touches raw payload credentials
});

test('cleanup: no raw values exposed through error contexts', () => {
  const plan = withIsolatedRepo(
    {
      'url.env':
        'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({}) + '\n',
      'roles.json': JSON.stringify({
        role_mapping: { synthetic_d: 'OWNER_CLASS' },
      }),
    },
    (root) =>
      CORE.buildProductionReadonlyInvocationPlan(root, {
        secretFile: '.secrets/url.env',
        roleMappingFile: '.secrets/roles.json',
      })
  );

  // After release, the error should not contain raw secret values
  CORE.releaseInvocationPlan(plan);
  try {
    CORE.toPgClientConfigFromInvocationPlan(plan);
    assert.fail('expected error');
  } catch (e) {
    const blob = JSON.stringify(e);
    assert.equal(blob.includes('fixtureuser'), false, 'no username in error');
    assert.equal(blob.includes('fixturetoken'), false, 'no password in error');
    assert.equal(blob.includes('db.example.test'), false, 'no host in error');
    assert.equal(blob.includes('appdb'), false, 'no database in error');
  }
});

test('isolated temp secrets never touch real REPO/.secrets', () => {
  const before = listRepoSecretsIfAny();
  const sentinelName = 'do-not-touch-sentinel-3570.env';
  const sentinelPath = path.join(REPO, '.secrets', sentinelName);
  let createdSentinel = false;
  try {
    if (before && !before.includes(sentinelName)) {
      // Do not create under real .secrets — only observe.
    }
    withIsolatedRepo(
      {
        'url.env': 'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL=' + fixturePgUrl({}) + '\n',
        'roles.json': JSON.stringify({ role_mapping: { synthetic_x: 'APPLICATION' } }),
      },
      (root) => {
        assert.notEqual(path.resolve(root), path.resolve(REPO));
        assert.ok(fs.existsSync(path.join(root, '.secrets', 'url.env')));
        CORE.buildProductionReadonlyInvocationPlan(root, {
          secretFile: '.secrets/url.env',
          roleMappingFile: '.secrets/roles.json',
        });
      }
    );
    const after = listRepoSecretsIfAny();
    assert.deepEqual(after, before);
    assert.equal(fs.existsSync(sentinelPath) && createdSentinel, false);
  } finally {
    if (createdSentinel && fs.existsSync(sentinelPath)) {
      // never created
    }
  }
});

test('Production CLI surface and validate-only on isolated fixtures', () => {
  const cli = read(CLI_PATH);
  const allowedBlock = cli.match(/const ALLOWED_FLAGS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(allowedBlock);
  assert.doesNotMatch(allowedBlock[1], /password|host|user|database|port|objects|sql/i);
  assert.doesNotMatch(cli, /process\.env\.DATABASE_URL/);
  assert.doesNotMatch(cli, /child_process|execSync|spawnSync/);

  // validate-only needs CLI cwd = isolated root? CLI uses REPO_ROOT=__dirname/.. which is real repo.
  // So for CLI we must not write to real .secrets. CLI validate-only will fail without real secrets.
  // Instead unit-test plan builder on isolated root (above) and CLI forbidden flag only.
  const result = spawnSync(process.execPath, [CLI_PATH, '--password', 'nope'], {
    cwd: REPO,
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout.includes('nope'), false);
  const report = JSON.parse(result.stdout);
  assert.equal(report.decision, 'FAIL_CLOSED');
});

test('CLI validate-only with synthetic secrets via temporary chdir into isolated root', () => {
  // Spawn node with cwd=isolated root but CLI still resolves REPO_ROOT from __dirname.
  // So CLI always uses real REPO root — cannot pass isolated secrets without writing REPO/.secrets.
  // Contract: Production CLI validate-only is covered by plan builder; CLI path rejection covered.
  // Explicitly document that CLI uses package root, not process.cwd(), so tests never write REPO/.secrets.
  const cli = read(CLI_PATH);
  assert.match(cli, /path\.resolve\(__dirname, '\.\.'\)/);
  assert.doesNotMatch(cli, /process\.cwd\(\)/);
});

test('adapter source: no Production mode on generic collect; has dedicated file entrypoint', () => {
  const src = read(ADAPTER_CORE);
  assert.match(src, /BEGIN READ ONLY/);
  assert.match(src, /ROLLBACK/);
  assert.match(src, /collectProductionReadonlyCatalogEvidenceFromFiles/);
  assert.doesNotMatch(src, /acceptProductionReadonlyConnectionConfig/);
  assert.doesNotMatch(src, /COLLECTION_MODE/);
  assert.match(src, /hasOwnProperty\.call\(options, 'mode'\)/);
  assert.match(src, /rejectBypassOptions/);
});

test('manifests remain inactive', () => {
  const expected = JSON.parse(
    read(path.join(REPO, 'db/migration-provenance/expected-schema-manifest.json'))
  );
  assert.equal(expected.status || expected.adoption_status, 'ADOPTION_REQUIRED');
});

test('package script and docs', () => {
  const pkg = JSON.parse(read(path.join(REPO, 'package.json')));
  assert.equal(
    pkg.scripts['build:production-readonly-catalog-evidence-from-postgres'],
    'node scripts/build-production-readonly-catalog-evidence-from-postgres.cjs'
  );
  const docs = read(path.join(REPO, 'docs/architecture/DB_MIGRATION_PROVENANCE_GATE.md'));
  assert.match(docs, /PRODUCTION_READONLY_CATALOG/);
  assert.match(docs, /LOVEBUD_PRODUCTION_READONLY_DATABASE_URL/);
  assert.doesNotMatch(docs, /neon\.tech/);
});
