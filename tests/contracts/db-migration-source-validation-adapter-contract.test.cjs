'use strict';

/**
 * Focused SOURCE_STATIC contract test: migration source-validation adapter (#3650).
 *
 * Exercises scripts/migration-source-validation-adapter-core.cjs using ONLY
 * synthetic JavaScript mocks and isolated temp-filesystem fixtures. No DB,
 * PostgreSQL, Docker, SQL fixture, network, or environment secret is used.
 *
 * Refs #3650
 * Refs #3458 - Keep #3458 OPEN.
 * Refs #3425 - Keep #3425 OPEN.
 * Refs #3435 - Keep #3435 OPEN.
 * Refs #3437 - Keep #3437 OPEN.
 * Refs #1882 - Keep #1882 OPEN.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ADAPTER_PATH = path.join(REPO_ROOT, 'scripts', 'migration-source-validation-adapter-core.cjs');
const ORCH_PATH = path.join(REPO_ROOT, 'scripts', 'migration-runner-orchestrator-core.cjs');
const PROVENANCE_CORE_PATH = path.join(REPO_ROOT, 'scripts', 'migration-provenance-core.cjs');

const {
  createMigrationSourceValidationAdapter,
  SOURCE_VALIDATION_RESULTS,
  SOURCE_LOAD_STATUSES,
  FACTORY_ERROR_INVALID_DEPENDENCY
} = require(ADAPTER_PATH);

const orch = require(ORCH_PATH);

const {
  runCanonicalMigration,
  ORCHESTRATION_OUTCOMES,
  ORCHESTRATION_STAGES
} = orch;

const VALID_INVENTORY = {
  schema_version: '1.0',
  baseline_sha: 'a0b1c2d3e4f5a0b1c2d3e4f5a0b1c2d3e4f5a0b1',
  classification_enum: [
    'sql_migration', 'sql_incident_repair', 'sql_rollback',
    'sql_validation_guard', 'sql_data_mutation', 'provenance_tooling',
    'catalog_adapter', 'seed_or_data_script', 'test_fixture_sql'
  ],
  entries: [
    {
      path: 'db/migrations/20250101000000_test.sql',
      operation_class: 'sql_migration',
      schema_objects: ['test_table'],
      invocation_path: 'node scripts/run.cjs',
      current_owner_domain: 'db',
      classification: 'sql_migration',
      transaction_behavior: 'transactional',
      idempotency_claim: 'idempotent',
      rollback_claim: 'supported',
      production_relevance: 'active',
      evidence: 'unit test',
      risk: 'low',
      recommended_disposition: 'canonical',
      linked_issue: '#3458',
      baseline_sha: 'a0b1c2d3e4f5a0b1c2d3e4f5a0b1c2d3e4f5a0b1',
      content_checksum: 'sha256:' + 'a'.repeat(64)
    }
  ]
};

const VALID_MIGRATIONS = {
  format_version: '1.0',
  status: 'ADOPTION_REQUIRED',
  canonical_directory: 'db/migrations',
  ledger: {
    contract_path: 'db/migration-provenance/ledger-contract.json',
    required_record_fields: [
      'migration_id', 'content_checksum', 'applied_at',
      'runner_version', 'environment_class', 'deployed_commit',
      'transaction_outcome'
    ]
  },
  migration_id_format: 'YYYYMMDDHHMMSS_slug',
  checksum_algorithm: 'sha256',
  migrations: []
};

const VALID_SCHEMA = {
  format_version: '1.0',
  status: 'ADOPTION_REQUIRED',
  fingerprint_algorithm: 'sha256',
  critical_objects: [],
  adoption_rule: 'inactive',
  comparison_scope: [
    'tables', 'columns', 'constraints', 'indexes',
    'sequences', 'views', 'functions', 'triggers',
    'types', 'extensions', 'policies', 'roles', 'schemas'
  ]
};

const VALID_INVENTORY_TEXT = JSON.stringify(VALID_INVENTORY);
const VALID_MIGRATIONS_TEXT = JSON.stringify(VALID_MIGRATIONS);
const VALID_SCHEMA_TEXT = JSON.stringify(VALID_SCHEMA);

function loadedSource(inventoryText, migrationText, schemaText) {
  return {
    status: SOURCE_LOAD_STATUSES.LOADED,
    inventoryText: inventoryText !== undefined ? inventoryText : VALID_INVENTORY_TEXT,
    migrationManifestText: migrationText !== undefined ? migrationText : VALID_MIGRATIONS_TEXT,
    expectedSchemaManifestText: schemaText !== undefined ? schemaText : VALID_SCHEMA_TEXT
  };
}

function noopValidator() {
  return { ok: true, errors: [], summary: {} };
}

function failingValidator() {
  return { ok: false, errors: ['test failure'], summary: {} };
}

function createTrackingValidator(delegate) {
  let callCount = 0;
  const validator = (args) => {
    callCount += 1;
    return delegate(args);
  };
  return { validator, getCallCount: () => callCount };
}

function createCountingLoader(source) {
  let loadCount = 0;
  const loader = () => {
    loadCount += 1;
    return source;
  };
  return { loader, getLoadCount: () => loadCount };
}

function createTempRepo() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lovebud-source-validator-'));
  const scriptsDir = path.join(tmpDir, 'scripts');
  const docsDir = path.join(tmpDir, 'docs', 'architecture');
  const dbDir = path.join(tmpDir, 'db', 'migration-provenance');
  const migrationsDir = path.join(tmpDir, 'db', 'migrations');
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(migrationsDir, { recursive: true });
  return { tmpDir, scriptsDir, docsDir, dbDir, migrationsDir };
}

function writeTempAdapterCore(scriptsDir) {
  const coreSource = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'migration-source-validation-adapter-core.cjs'), 'utf8');
  const provenanceSource = fs.readFileSync(PROVENANCE_CORE_PATH, 'utf8');
  fs.writeFileSync(path.join(scriptsDir, 'migration-provenance-core.cjs'), provenanceSource, 'utf8');

  let adapted = coreSource.replace(
    "const { validateSourceConfiguration } = require('./migration-provenance-core.cjs');",
    "const { validateSourceConfiguration } = require('./migration-provenance-core.cjs');"
  );
  fs.writeFileSync(path.join(scriptsDir, 'migration-source-validation-adapter-core.cjs'), adapted, 'utf8');
}

function loadTempAdapter(scriptsDir) {
  const adapterPath = path.join(scriptsDir, 'migration-source-validation-adapter-core.cjs');
  delete require.cache[require.resolve(adapterPath)];
  return require(adapterPath);
}

describe('DB migration source-validation adapter contract (#3650)', () => {

  describe('1. Public surface', () => {
    it('1. factory is a function', () => {
      assert.strictEqual(typeof createMigrationSourceValidationAdapter, 'function');
    });

    it('2. adapter is frozen', () => {
      const adapter = createMigrationSourceValidationAdapter();
      assert.ok(Object.isFrozen(adapter));
    });

    it('3. adapter own keys are exactly ["validateSource"]', () => {
      const adapter = createMigrationSourceValidationAdapter();
      assert.deepStrictEqual(Reflect.ownKeys(adapter), ['validateSource']);
    });

    it('4. result objects are frozen', () => {
      assert.ok(Object.isFrozen(SOURCE_VALIDATION_RESULTS.PASS));
      assert.ok(Object.isFrozen(SOURCE_VALIDATION_RESULTS.FAIL));
      assert.ok(Object.isFrozen(SOURCE_VALIDATION_RESULTS.UNAVAILABLE));
    });

    it('5. result own keys are exactly ["status"]', () => {
      assert.deepStrictEqual(Reflect.ownKeys(SOURCE_VALIDATION_RESULTS.PASS), ['status']);
      assert.deepStrictEqual(Reflect.ownKeys(SOURCE_VALIDATION_RESULTS.FAIL), ['status']);
      assert.deepStrictEqual(Reflect.ownKeys(SOURCE_VALIDATION_RESULTS.UNAVAILABLE), ['status']);
    });

    it('6. status vocabulary is exactly PASS|FAIL|UNAVAILABLE', () => {
      assert.strictEqual(SOURCE_VALIDATION_RESULTS.PASS.status, 'PASS');
      assert.strictEqual(SOURCE_VALIDATION_RESULTS.FAIL.status, 'FAIL');
      assert.strictEqual(SOURCE_VALIDATION_RESULTS.UNAVAILABLE.status, 'UNAVAILABLE');
      assert.strictEqual(Object.keys(SOURCE_VALIDATION_RESULTS).length, 3);
    });
  });

  describe('2. Current repository', () => {
    it('7. default adapter returns PASS for current committed inactive source', async () => {
      const adapter = createMigrationSourceValidationAdapter();
      const result = await adapter.validateSource({ targetMigrationId: 'test-migration' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.PASS);
    });

    it('8. loader not called before method invocation', async () => {
      const { loader, getLoadCount } = createCountingLoader(loadedSource());
      assert.strictEqual(getLoadCount(), 0);
      const adapter = createMigrationSourceValidationAdapter({ loadFixedSources: loader });
      assert.strictEqual(getLoadCount(), 0);
      await adapter.validateSource({ targetMigrationId: 'test' });
      assert.strictEqual(getLoadCount(), 1);
    });

    it('9. each fixed source read at most once per call', async () => {
      const adapter = createMigrationSourceValidationAdapter();
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.PASS);
    });

    it('10. validator called exactly once per call', async () => {
      const { validator, getCallCount } = createTrackingValidator(noopValidator);
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: validator
      });
      await adapter.validateSource({ targetMigrationId: 'test' });
      assert.strictEqual(getCallCount(), 1);
    });
  });

  describe('3. PASS fixtures', () => {
    it('11. valid fixed synthetic fixture returns PASS', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: noopValidator
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.PASS);
    });

    it('12. ADOPTION_REQUIRED with empty migrations and critical objects returns PASS', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: noopValidator
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.PASS);
    });

    it('13. targetMigrationId not used as authorization input to source validator', async () => {
      const { validator, getCallCount } = createTrackingValidator(noopValidator);
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: validator
      });
      await adapter.validateSource({ targetMigrationId: 'my-special-migration-id-12345' });
      assert.strictEqual(getCallCount(), 1);
    });
  });

  describe('4. FAIL fixtures', () => {
    it('14. invalid inventory returns FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: failingValidator
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('15. invalid canonical manifest returns FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: failingValidator
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('16. invalid expected-schema manifest returns FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: failingValidator
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('17. malformed inventory raw text → FAIL (actual JSON.parse in adapter)', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource('{ broken', VALID_MIGRATIONS_TEXT, VALID_SCHEMA_TEXT)
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('18. malformed canonical manifest raw text → FAIL (actual JSON.parse in adapter)', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(VALID_INVENTORY_TEXT, '{ broken', VALID_SCHEMA_TEXT)
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('19. malformed expected-schema raw text → FAIL (actual JSON.parse in adapter)', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(VALID_INVENTORY_TEXT, VALID_MIGRATIONS_TEXT, '{ broken')
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('20. validator normal return with ok=false returns FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => ({ ok: false, errors: ['inventory validation failed'], summary: {} })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('21. validator error arrays not exposed in result', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => ({
          ok: false,
          errors: ['secret error detail', '/internal/path', 'stack trace'],
          summary: {}
        })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('secret error detail'));
      assert.ok(!resultStr.includes('/internal/path'));
      assert.deepStrictEqual(Object.keys(result), ['status']);
    });
  });

  describe('5. UNAVAILABLE fixtures', () => {
    it('22. loader returns UNAVAILABLE → UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({ status: SOURCE_LOAD_STATUSES.UNAVAILABLE })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('23. loader throws → UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => { throw new Error('EACCES: permission denied'); }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('24. loader returns INVALID → FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({ status: SOURCE_LOAD_STATUSES.INVALID })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('25. loader throws with EISDIR → UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => { throw new Error('EISDIR: not a file'); }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('26. loader throws path escape → UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => { throw new Error('path escape detected'); }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('27. validator synchronous throw → UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => { throw new Error('unexpected crash'); }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('28. validator Promise rejection → UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => Promise.reject(new Error('async failure'))
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('29. loader rejected Promise → UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => Promise.reject(new Error('loader rejected'))
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('30. raw error message and stack not exposed', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => {
          const err = new Error('EACCES: /internal/.secrets/token');
          err.stack = 'Error: EACCES\n    at Object.readSync';
          throw err;
        }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('EACCES'));
      assert.ok(!resultStr.includes('.secrets'));
      assert.ok(!resultStr.includes('readSync'));
      assert.deepStrictEqual(Object.keys(result), ['status']);
    });
  });

  describe('6. Hostile call envelope', () => {
    function assertFailEnvelope(arg) {
      return async () => {
        const adapter = createMigrationSourceValidationAdapter({
          loadFixedSources: () => { throw new Error('should not be called'); }
        });
        const result = await adapter.validateSource(arg);
        assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
      };
    }

    it('31. missing argument', assertFailEnvelope(undefined));
    it('32. null', assertFailEnvelope(null));
    it('33. primitive (string)', assertFailEnvelope('test'));
    it('34. primitive (number)', assertFailEnvelope(42));
    it('35. array', assertFailEnvelope([]));
    it('36. function', assertFailEnvelope(() => {}));
    it('37. missing targetMigrationId', assertFailEnvelope({}));
    it('38. empty targetMigrationId', assertFailEnvelope({ targetMigrationId: '' }));
    it('39. whitespace-only targetMigrationId', assertFailEnvelope({ targetMigrationId: '   ' }));
    it('40. accessor targetMigrationId', assertFailEnvelope(
      Object.create({}, { targetMigrationId: { get() { return 'test'; }, enumerable: true } })
    ));
    it('41. extra key', assertFailEnvelope({ targetMigrationId: 'test', extra: 'bad' }));
    it('42. symbol key', assertFailEnvelope((() => {
      const o = { targetMigrationId: 'test' };
      o[Symbol('bad')] = 'v';
      return o;
    })()));
    it('43. non-enumerable targetMigrationId', assertFailEnvelope(
      Object.create({}, { targetMigrationId: { value: 'test', enumerable: false } })
    ));
    it('44. inherited targetMigrationId', assertFailEnvelope(Object.create({ targetMigrationId: 'test' })));
    it('45. custom prototype', assertFailEnvelope((() => {
      function P() { this.targetMigrationId = 'test'; }
      return new P();
    })()));
    it('46. Proxy ownKeys throw', assertFailEnvelope(
      new Proxy({ targetMigrationId: 'test' }, { ownKeys() { throw new Error('trap'); } })
    ));
    it('47. Proxy getPrototypeOf throw', assertFailEnvelope(
      new Proxy({ targetMigrationId: 'test' }, { getPrototypeOf() { throw new Error('trap'); } })
    ));
    it('48. Proxy getOwnPropertyDescriptor throw', assertFailEnvelope(
      new Proxy({ targetMigrationId: 'test' }, { getOwnPropertyDescriptor() { throw new Error('trap'); } })
    ));
    it('49. revoked Proxy', assertFailEnvelope((() => {
      const { proxy, revoke } = Proxy.revocable({}, {});
      revoke();
      return proxy;
    })()));
    it('50. Proxy get trap execution 0 times', async () => {
      let getTrapCount = 0;
      const proxy = new Proxy({ targetMigrationId: 'test' }, {
        get(target, prop) {
          if (prop === 'targetMigrationId') getTrapCount += 1;
          return Reflect.get(target, prop);
        }
      });
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: failingValidator
      });
      const result = await adapter.validateSource(proxy);
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
      assert.strictEqual(getTrapCount, 0);
    });
  });

  describe('7. Sanitization', () => {
    it('51. console.log/error/warn calls 0', async () => {
      const origLog = console.log;
      const origErr = console.error;
      const origWarn = console.warn;
      let counts = { log: 0, err: 0, warn: 0 };
      console.log = () => { counts.log += 1; };
      console.error = () => { counts.err += 1; };
      console.warn = () => { counts.warn += 1; };
      try {
        const adapter = createMigrationSourceValidationAdapter();
        await adapter.validateSource({ targetMigrationId: 'test' });
        assert.strictEqual(counts.log, 0);
        assert.strictEqual(counts.err, 0);
        assert.strictEqual(counts.warn, 0);
      } finally {
        console.log = origLog;
        console.error = origErr;
        console.warn = origWarn;
      }
    });

    it('52. result does not contain target migration ID', async () => {
      const adapter = createMigrationSourceValidationAdapter();
      const result = await adapter.validateSource({ targetMigrationId: 'super-secret-99999' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('super-secret'));
      assert.ok(!resultStr.includes('99999'));
    });

    it('53. result does not contain source file paths', async () => {
      const adapter = createMigrationSourceValidationAdapter();
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('migration-path-inventory'));
      assert.ok(!resultStr.includes('canonical-migrations'));
      assert.ok(!resultStr.includes('expected-schema'));
    });

    it('54. result does not contain validator errors or raw data', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => ({ ok: false, errors: ['internal detail'], summary: {} })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('internal detail'));
      assert.deepStrictEqual(Object.keys(result), ['status']);
    });

    it('55. result does not contain hostname, URL, credential, or env var', async () => {
      const adapter = createMigrationSourceValidationAdapter();
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('DATABASE_URL'));
      assert.ok(!resultStr.includes('localhost'));
      assert.ok(!resultStr.includes('credential'));
    });
  });

  describe('8. Orchestrator compatibility', () => {
    const MOCK_RUNTIME = { runnerVersion: '0.1.0', environmentClass: 'test', deployedCommit: 'abc123' };

    it('56. PASS result accepted by orchestrator', async () => {
      const adapter = createMigrationSourceValidationAdapter();
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.strictEqual(result.status, 'PASS');
    });

    it('57. FAIL blocks orchestrator at SOURCE_VALIDATION stage', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: failingValidator
      });
      const mockDeps = {
        validateSource: (arg) => adapter.validateSource(arg),
        loadManifest: () => { throw new Error('should not be called'); },
        acquireAdvisoryLock: () => { throw new Error('should not be called'); },
        readLedger: () => { throw new Error('should not be called'); },
        evaluatePrecondition: () => { throw new Error('should not be called'); },
        executeMigration: () => { throw new Error('should not be called'); },
        evaluatePostcondition: () => { throw new Error('should not be called'); },
        checkAdvisoryLock: () => { throw new Error('should not be called'); },
        appendLedgerRecord: () => { throw new Error('should not be called'); },
        releaseAdvisoryLock: () => { throw new Error('should not be called'); },
        now: () => new Date().toISOString()
      };
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: mockDeps
      });
      assert.strictEqual(result.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
      assert.strictEqual(result.stage, ORCHESTRATION_STAGES.SOURCE_VALIDATION);
    });

    it('58. UNAVAILABLE blocks orchestrator at SOURCE_VALIDATION stage', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({ status: SOURCE_LOAD_STATUSES.UNAVAILABLE })
      });
      const mockDeps = {
        validateSource: (arg) => adapter.validateSource(arg),
        loadManifest: () => { throw new Error('should not be called'); },
        acquireAdvisoryLock: () => { throw new Error('should not be called'); },
        readLedger: () => { throw new Error('should not be called'); },
        evaluatePrecondition: () => { throw new Error('should not be called'); },
        executeMigration: () => { throw new Error('should not be called'); },
        evaluatePostcondition: () => { throw new Error('should not be called'); },
        checkAdvisoryLock: () => { throw new Error('should not be called'); },
        appendLedgerRecord: () => { throw new Error('should not be called'); },
        releaseAdvisoryLock: () => { throw new Error('should not be called'); },
        now: () => new Date().toISOString()
      };
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: mockDeps
      });
      assert.strictEqual(result.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
      assert.strictEqual(result.stage, ORCHESTRATION_STAGES.SOURCE_VALIDATION);
    });

    it('59. FAIL/UNAVAILABLE skips loadManifest and subsequent deps', async () => {
      let loadManifestCalls = 0;
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({ status: SOURCE_LOAD_STATUSES.UNAVAILABLE })
      });
      const mockDeps = {
        validateSource: (arg) => adapter.validateSource(arg),
        loadManifest: () => { loadManifestCalls += 1; throw new Error('should not be called'); },
        acquireAdvisoryLock: () => { throw new Error('should not be called'); },
        readLedger: () => { throw new Error('should not be called'); },
        evaluatePrecondition: () => { throw new Error('should not be called'); },
        executeMigration: () => { throw new Error('should not be called'); },
        evaluatePostcondition: () => { throw new Error('should not be called'); },
        checkAdvisoryLock: () => { throw new Error('should not be called'); },
        appendLedgerRecord: () => { throw new Error('should not be called'); },
        releaseAdvisoryLock: () => { throw new Error('should not be called'); },
        now: () => new Date().toISOString()
      };
      await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: mockDeps
      });
      assert.strictEqual(loadManifestCalls, 0);
    });
  });

  describe('A. Actual raw malformed JSON tests', () => {
    it('A1. malformed inventory raw text → FAIL, validator not called', async () => {
      const { validator, getCallCount } = createTrackingValidator(noopValidator);
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource('{ broken json!!!', VALID_MIGRATIONS_TEXT, VALID_SCHEMA_TEXT),
        validateSourceConfiguration: validator
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
      assert.strictEqual(getCallCount(), 0);
    });

    it('A2. malformed canonical manifest raw text → FAIL, validator not called', async () => {
      const { validator, getCallCount } = createTrackingValidator(noopValidator);
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(VALID_INVENTORY_TEXT, 'not json [', VALID_SCHEMA_TEXT),
        validateSourceConfiguration: validator
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
      assert.strictEqual(getCallCount(), 0);
    });

    it('A3. malformed expected-schema raw text → FAIL, validator not called', async () => {
      const { validator, getCallCount } = createTrackingValidator(noopValidator);
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(VALID_INVENTORY_TEXT, VALID_MIGRATIONS_TEXT, '{"incomplete'),
        validateSourceConfiguration: validator
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
      assert.strictEqual(getCallCount(), 0);
    });
  });

  describe('B. Default loader filesystem tests', () => {
    it('B1. default adapter with missing inventory → UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir, dbDir } = createTempRepo();
      try {
        fs.writeFileSync(path.join(dbDir, 'canonical-migrations.json'), VALID_MIGRATIONS_TEXT, 'utf8');
        fs.writeFileSync(path.join(dbDir, 'expected-schema-manifest.json'), VALID_SCHEMA_TEXT, 'utf8');
        writeTempAdapterCore(scriptsDir);
        const { createMigrationSourceValidationAdapter: create } = loadTempAdapter(scriptsDir);
        const adapter = create();
        const result = await adapter.validateSource({ targetMigrationId: 'test' });
        assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('B2. default adapter with directory instead of file → UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir, docsDir, dbDir } = createTempRepo();
      try {
        const invDir = path.join(docsDir, 'migration-path-inventory.json');
        fs.rmSync(invDir, { force: true });
        fs.mkdirSync(invDir);
        fs.writeFileSync(path.join(dbDir, 'canonical-migrations.json'), VALID_MIGRATIONS_TEXT, 'utf8');
        fs.writeFileSync(path.join(dbDir, 'expected-schema-manifest.json'), VALID_SCHEMA_TEXT, 'utf8');
        writeTempAdapterCore(scriptsDir);
        const { createMigrationSourceValidationAdapter: create } = loadTempAdapter(scriptsDir);
        const adapter = create();
        const result = await adapter.validateSource({ targetMigrationId: 'test' });
        assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('B3. default adapter with symlink escaping repo → UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir, docsDir, dbDir } = createTempRepo();
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lovebud-outside-'));
      try {
        const outsideFile = path.join(outsideDir, 'escaped.json');
        fs.writeFileSync(outsideFile, '{}', 'utf8');
        const invPath = path.join(docsDir, 'migration-path-inventory.json');
        fs.rmSync(invPath, { force: true });
        try {
          fs.symlinkSync(outsideFile, invPath);
        } catch (e) {
          return;
        }
        fs.writeFileSync(path.join(dbDir, 'canonical-migrations.json'), VALID_MIGRATIONS_TEXT, 'utf8');
        fs.writeFileSync(path.join(dbDir, 'expected-schema-manifest.json'), VALID_SCHEMA_TEXT, 'utf8');
        writeTempAdapterCore(scriptsDir);
        const { createMigrationSourceValidationAdapter: create } = loadTempAdapter(scriptsDir);
        const adapter = create();
        const result = await adapter.validateSource({ targetMigrationId: 'test' });
        assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });
  });

  describe('C. verified realTarget read regression', () => {
    it('C1. default loader reads verified realTarget not lexical symlink path', async () => {
      const { tmpDir, scriptsDir, docsDir, dbDir } = createTempRepo();
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lovebud-real-'));
      try {
        const realInvFile = path.join(outsideDir, 'real-inventory.json');
        fs.writeFileSync(realInvFile, VALID_INVENTORY_TEXT, 'utf8');
        const invPath = path.join(docsDir, 'migration-path-inventory.json');
        fs.rmSync(invPath, { force: true });
        try {
          fs.symlinkSync(realInvFile, invPath);
        } catch (e) {
          return;
        }
        fs.writeFileSync(path.join(dbDir, 'canonical-migrations.json'), VALID_MIGRATIONS_TEXT, 'utf8');
        fs.writeFileSync(path.join(dbDir, 'expected-schema-manifest.json'), VALID_SCHEMA_TEXT, 'utf8');
        writeTempAdapterCore(scriptsDir);
        const { createMigrationSourceValidationAdapter: create } = loadTempAdapter(scriptsDir);
        const adapter = create();
        const result = await adapter.validateSource({ targetMigrationId: 'test' });
        assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });
  });

  describe('D. Factory hostile config', () => {
    function assertFactoryReject(arg) {
      return () => {
        assert.throws(
          () => createMigrationSourceValidationAdapter(arg),
          (err) => err.message === FACTORY_ERROR_INVALID_DEPENDENCY
        );
      };
    }

    it('D1. numeric config', assertFactoryReject(1));
    it('D2. string config', assertFactoryReject('bad'));
    it('D3. array config', assertFactoryReject([]));
    it('D4. function config', assertFactoryReject(() => {}));
    it('D5. custom prototype config', assertFactoryReject((() => { function P() {} return new P(); })()));
    it('D6. extra key config', assertFactoryReject({ loadFixedSources: () => loadedSource(), extra: true }));
    it('D7. symbol key config', assertFactoryReject((() => { const c = {}; c[Symbol('bad')] = true; return c; })()));

    it('D8. accessor dependency getter 0 calls', () => {
      let getterCalls = 0;
      const cfg = Object.create({}, {
        loadFixedSources: {
          get() { getterCalls += 1; return () => loadedSource(); },
          enumerable: true
        }
      });
      assert.throws(
        () => createMigrationSourceValidationAdapter(cfg),
        (err) => err.message === FACTORY_ERROR_INVALID_DEPENDENCY
      );
      assert.strictEqual(getterCalls, 0);
    });

    it('D9. Proxy has trap 0 calls', () => {
      let hasCalls = 0;
      const inner = { loadFixedSources: () => loadedSource() };
      const proxy = new Proxy(inner, { has() { hasCalls += 1; return Reflect.has(...arguments); } });
      const adapter = createMigrationSourceValidationAdapter(proxy);
      assert.ok(adapter);
      assert.strictEqual(hasCalls, 0);
    });

    it('D10. Proxy get trap 0 calls on config', () => {
      let getCalls = 0;
      const inner = { loadFixedSources: () => loadedSource() };
      const proxy = new Proxy(inner, { get() { getCalls += 1; return Reflect.get(...arguments); } });
      const adapter = createMigrationSourceValidationAdapter(proxy);
      assert.ok(adapter);
      assert.strictEqual(getCalls, 0);
    });

    it('D11. Proxy ownKeys throw → fixed error', assertFactoryReject(
      new Proxy({}, { ownKeys() { throw new Error('trap'); } })
    ));
    it('D12. Proxy getPrototypeOf throw → fixed error', assertFactoryReject(
      new Proxy({}, { getPrototypeOf() { throw new Error('trap'); } })
    ));
    it('D13. Proxy getOwnPropertyDescriptor throw → fixed error', assertFactoryReject(
      new Proxy({ loadFixedSources: 'x' }, { getOwnPropertyDescriptor() { throw new Error('trap'); } })
    ));

    it('D14. revoked Proxy → fixed error', assertFactoryReject((() => {
      const { proxy, revoke } = Proxy.revocable({}, {});
      revoke();
      return proxy;
    })()));
  });

  describe('E. Async loader', () => {
    it('E1. async loader resolve LOADED → PASS', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: async () => loadedSource(),
        validateSourceConfiguration: noopValidator
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.PASS);
    });

    it('E2. async loader resolve INVALID → FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: async () => ({ status: SOURCE_LOAD_STATUSES.INVALID }),
        validateSourceConfiguration: noopValidator
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('E3. async loader resolve UNAVAILABLE → UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: async () => ({ status: SOURCE_LOAD_STATUSES.UNAVAILABLE })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('E4. async loader rejection → UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: async () => { throw new Error('async loader fail'); }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });
  });

  describe('F. Hostile loader result', () => {
    function assertLoaderResultUnavailable(arg) {
      return async () => {
        let validatorCalls = 0;
        const adapter = createMigrationSourceValidationAdapter({
          loadFixedSources: () => arg,
          validateSourceConfiguration: () => { validatorCalls += 1; return noopValidator(); }
        });
        const result = await adapter.validateSource({ targetMigrationId: 'test' });
        assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
        assert.strictEqual(validatorCalls, 0);
      };
    }

    it('F1. accessor status, getter 0 calls', assertLoaderResultUnavailable(
      Object.create({}, { status: { get() { return 'LOADED'; }, enumerable: true } })
    ));

    it('F2. Proxy get trap 0 calls', async () => {
      let getTrapCalls = 0;
      const inner = { status: SOURCE_LOAD_STATUSES.UNAVAILABLE };
      const proxy = new Proxy(inner, {
        get(target, prop) {
          getTrapCalls += 1;
          return Reflect.get(target, prop);
        }
      });
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => proxy
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
      assert.strictEqual(getTrapCalls, 0);
    });

    it('F3. ownKeys throw → UNAVAILABLE', assertLoaderResultUnavailable(
      new Proxy({}, { ownKeys() { throw new Error('trap'); } })
    ));
    it('F4. getPrototypeOf throw → UNAVAILABLE', assertLoaderResultUnavailable(
      new Proxy({}, { getPrototypeOf() { throw new Error('trap'); } })
    ));
    it('F5. getOwnPropertyDescriptor throw → UNAVAILABLE', assertLoaderResultUnavailable(
      new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('trap'); } })
    ));

    it('F6. revoked Proxy → UNAVAILABLE', assertLoaderResultUnavailable((() => {
      const { proxy, revoke } = Proxy.revocable({}, {});
      revoke();
      return proxy;
    })()));

    it('F7. unknown status value → UNAVAILABLE', assertLoaderResultUnavailable({ status: 'WEIRD' }));

    it('F8. extra key → UNAVAILABLE', assertLoaderResultUnavailable({
      status: SOURCE_LOAD_STATUSES.LOADED,
      inventoryText: '{}',
      migrationManifestText: '{}',
      expectedSchemaManifestText: '{}',
      extra: true
    }));

    it('F9. symbol key → UNAVAILABLE', assertLoaderResultUnavailable((() => {
      const o = { status: SOURCE_LOAD_STATUSES.LOADED, inventoryText: '{}', migrationManifestText: '{}', expectedSchemaManifestText: '{}' };
      o[Symbol('bad')] = true;
      return o;
    })()));

    it('F10. wrong text type (number) → UNAVAILABLE', assertLoaderResultUnavailable({
      status: SOURCE_LOAD_STATUSES.LOADED,
      inventoryText: 123,
      migrationManifestText: '{}',
      expectedSchemaManifestText: '{}'
    }));
  });

  describe('G. Hostile validator result', () => {
    it('G1. { ok: true } own data → PASS', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => ({ ok: true })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.PASS);
    });

    it('G2. { ok: false } own data → FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => ({ ok: false })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('G3. accessor ok, getter 0 → UNAVAILABLE', async () => {
      let getterCalls = 0;
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => Object.create({}, {
          ok: { get() { getterCalls += 1; return true; }, enumerable: true }
        })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
      assert.strictEqual(getterCalls, 0);
    });

    it('G4. Proxy get trap 0 calls', async () => {
      let getTrapCalls = 0;
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => {
          const inner = { ok: true };
          return new Proxy(inner, {
            get(target, prop) {
              getTrapCalls += 1;
              return Reflect.get(target, prop);
            }
          });
        }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.PASS);
      assert.strictEqual(getTrapCalls, 0);
    });

    it('G5. ownKeys throw → UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => new Proxy({}, { ownKeys() { throw new Error('trap'); } })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('G6. getPrototypeOf throw → UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => new Proxy({}, { getPrototypeOf() { throw new Error('trap'); } })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('G7. getOwnPropertyDescriptor throw → UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('trap'); } })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('G8. revoked Proxy → UNAVAILABLE', async () => {
      const { proxy, revoke } = Proxy.revocable({}, {});
      revoke();
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => proxy
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('G9. validator Promise reject → UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource(),
        validateSourceConfiguration: () => Promise.reject(new Error('reject'))
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });
  });

  describe('H. Source counts', () => {
    it('H1. valid call: loader called exactly once', async () => {
      const { loader, getLoadCount } = createCountingLoader(loadedSource());
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: loader,
        validateSourceConfiguration: noopValidator
      });
      await adapter.validateSource({ targetMigrationId: 'test' });
      assert.strictEqual(getLoadCount(), 1);
    });

    it('H2. malformed envelope: loader called 0 times', async () => {
      const { loader, getLoadCount } = createCountingLoader(loadedSource());
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: loader
      });
      await adapter.validateSource(undefined);
      assert.strictEqual(getLoadCount(), 0);
    });

    it('H3. malformed first source: validator called 0 times', async () => {
      let validatorCalls = 0;
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => loadedSource('{ broken'),
        validateSourceConfiguration: () => { validatorCalls += 1; return noopValidator(); }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
      assert.strictEqual(validatorCalls, 0);
    });
  });
});
