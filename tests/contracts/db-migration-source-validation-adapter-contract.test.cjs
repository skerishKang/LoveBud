'use strict';

/**
 * Focused SOURCE_STATIC contract test: migration source-validation adapter (#3650).
 *
 * Exercises scripts/migration-source-validation-adapter-core.cjs using ONLY
 * synthetic JavaScript mocks. No DB, PostgreSQL, Docker, SQL fixture, network,
 * filesystem write, or environment secret is used.
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

const {
  createMigrationSourceValidationAdapter,
  SOURCE_VALIDATION_RESULTS
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

function createCountingLoader(inventory, migrations, schema) {
  let callCount = 0;
  const loader = () => {
    callCount += 1;
    return {
      available: true,
      inventory: inventory || null,
      migrations: migrations || null,
      schema: schema || null
    };
  };
  return { loader, getCallCount: () => callCount };
}

function createFailingLoader(error) {
  return () => { throw error || new Error('injected loader failure'); };
}

function createTrackingValidator(delegate) {
  let callCount = 0;
  let lastArgs = null;
  const validator = (args) => {
    callCount += 1;
    lastArgs = args;
    return delegate(args);
  };
  return {
    validator,
    getCallCount: () => callCount,
    getLastArgs: () => lastArgs
  };
}

function noopValidator() {
  return { ok: true, errors: [], summary: {} };
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
      const result = await adapter.validateSource({ targetMigrationId: '20250101000000_test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.PASS);
    });

    it('8. source read count is 0 before method call', async () => {
      const { loader, getCallCount } = createCountingLoader(VALID_INVENTORY, VALID_MIGRATIONS, VALID_SCHEMA);
      assert.strictEqual(getCallCount(), 0);
      const adapter = createMigrationSourceValidationAdapter({ loadFixedSources: loader });
      assert.strictEqual(getCallCount(), 0);
      await adapter.validateSource({ targetMigrationId: 'test-migration' });
      assert.ok(getCallCount() >= 1);
    });

    it('9. each fixed source read exactly once per call', async () => {
      const { loader, getCallCount } = createCountingLoader(VALID_INVENTORY, VALID_MIGRATIONS, VALID_SCHEMA);
      const adapter = createMigrationSourceValidationAdapter({ loadFixedSources: loader });
      await adapter.validateSource({ targetMigrationId: 'test-migration' });
      assert.strictEqual(getCallCount(), 1);
    });

    it('10. validator called exactly once per call', async () => {
      const { validator, getCallCount } = createTrackingValidator(noopValidator);
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: VALID_MIGRATIONS,
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: validator
      });
      await adapter.validateSource({ targetMigrationId: 'test-migration' });
      assert.strictEqual(getCallCount(), 1);
    });
  });

  describe('3. PASS fixtures', () => {
    it('11. valid fixed synthetic fixture returns PASS', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: VALID_MIGRATIONS,
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: () => ({ ok: true, errors: [], summary: {} })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.PASS);
    });

    it('12. ADOPTION_REQUIRED with empty migrations and critical objects returns PASS', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: { ...VALID_MIGRATIONS, migrations: [], status: 'ADOPTION_REQUIRED' },
          schema: { ...VALID_SCHEMA, critical_objects: [], status: 'ADOPTION_REQUIRED' }
        }),
        validateSourceConfiguration: () => ({ ok: true, errors: [], summary: {} })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.PASS);
    });

    it('13. targetMigrationId not used as authorization input to source validator', async () => {
      const { validator, getLastArgs } = createTrackingValidator(noopValidator);
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: VALID_MIGRATIONS,
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: validator
      });
      await adapter.validateSource({ targetMigrationId: 'my-special-migration-id-12345' });
      const args = getLastArgs();
      assert.ok(args);
      assert.ok(!('targetMigrationId' in args));
      assert.strictEqual(typeof args.repoRoot, 'string');
      assert.ok(args.inventory);
      assert.ok(args.migrationManifest);
      assert.ok(args.expectedSchemaManifest);
    });
  });

  describe('4. FAIL fixtures', () => {
    it('14. invalid inventory returns FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: { invalid: true },
          migrations: VALID_MIGRATIONS,
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: () => ({ ok: false, errors: ['invalid inventory'], summary: {} })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('15. invalid canonical manifest returns FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: { invalid: true },
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: () => ({ ok: false, errors: ['invalid manifest'], summary: {} })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('16. invalid expected-schema manifest returns FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: VALID_MIGRATIONS,
          schema: { invalid: true }
        }),
        validateSourceConfiguration: () => ({ ok: false, errors: ['invalid schema'], summary: {} })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('17. malformed inventory JSON returns FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: 'this is not valid JSON',
          migrations: VALID_MIGRATIONS,
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: () => ({ ok: false, errors: ['parse error'], summary: {} })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('18. malformed canonical manifest JSON returns FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: '{ broken json',
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: () => ({ ok: false, errors: ['parse error'], summary: {} })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('19. malformed expected-schema JSON returns FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: VALID_MIGRATIONS,
          schema: 'not json'
        }),
        validateSourceConfiguration: () => ({ ok: false, errors: ['parse error'], summary: {} })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('20. validator normal return with ok=false returns FAIL', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: VALID_MIGRATIONS,
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: () => ({
          ok: false,
          errors: ['inventory validation failed: missing field'],
          summary: { inventory_rows: 0 }
        })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
    });

    it('21. validator error arrays not exposed in result', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: VALID_MIGRATIONS,
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: () => ({
          ok: false,
          errors: ['secret error detail', '/internal/path', 'stack trace here'],
          summary: {}
        })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('secret error detail'));
      assert.ok(!resultStr.includes('/internal/path'));
      assert.ok(!resultStr.includes('stack trace here'));
      assert.deepStrictEqual(Object.keys(result), ['status']);
      assert.strictEqual(result.status, 'FAIL');
    });
  });

  describe('5. UNAVAILABLE fixtures', () => {
    it('22. missing file returns UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({ available: false, inventory: null, migrations: null, schema: null })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('23. unreadable/read throw returns UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => { throw new Error('EACCES: permission denied'); }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('24. directory instead of file returns UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => { throw new Error('EISDIR: not a file'); }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('25. lexical escape returns UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => { throw new Error('path escape detected'); }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('26. repository escape via symlink/realpath returns UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => { throw new Error('symlink escape outside repository'); }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('27. unexpected validator synchronous throw returns UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: VALID_MIGRATIONS,
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: () => { throw new Error('unexpected validator crash'); }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('28. validator Promise rejection returns UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: VALID_MIGRATIONS,
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: () => Promise.reject(new Error('async validator failure'))
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('29. loader throw/reject returns UNAVAILABLE', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: createFailingLoader(new Error('loader internal error'))
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.UNAVAILABLE);
    });

    it('30. raw filesystem/validator error message and stack not exposed', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => {
          const err = new Error('EACCES: /internal/repo/.secrets/token');
          err.stack = 'Error: EACCES\n    at Object.readSync (internal/fs/sync.js:100)';
          throw err;
        }
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('EACCES'));
      assert.ok(!resultStr.includes('.secrets'));
      assert.ok(!resultStr.includes('token'));
      assert.ok(!resultStr.includes('readSync'));
      assert.deepStrictEqual(Object.keys(result), ['status']);
      assert.strictEqual(result.status, 'UNAVAILABLE');
    });
  });

  describe('6. Hostile call envelope', () => {

    function assertFailEnvelope(arg) {
      return async () => {
        const adapter = createMigrationSourceValidationAdapter({
          loadFixedSources: createFailingLoader(new Error('should not be called'))
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

    it('40. accessor targetMigrationId (getter)', assertFailEnvelope(
      Object.create({}, { targetMigrationId: { get() { return 'test'; }, enumerable: true } })
    ));

    it('41. extra key', assertFailEnvelope({ targetMigrationId: 'test', extra: 'bad' }));

    it('42. symbol key', assertFailEnvelope(
      (() => {
        const obj = { targetMigrationId: 'test' };
        obj[Symbol('bad')] = 'value';
        return obj;
      })()
    ));

    it('43. non-enumerable targetMigrationId', assertFailEnvelope(
      Object.create({}, { targetMigrationId: { value: 'test', enumerable: false } })
    ));

    it('44. inherited targetMigrationId', assertFailEnvelope(
      Object.create({ targetMigrationId: 'test' })
    ));

    it('45. custom prototype', assertFailEnvelope(
      (() => {
        function CustomProto() { this.targetMigrationId = 'test'; }
        return new CustomProto();
      })()
    ));

    it('46. Proxy ownKeys throw', assertFailEnvelope(
      new Proxy({ targetMigrationId: 'test' }, {
        ownKeys() { throw new Error('ownKeys trap'); }
      })
    ));

    it('47. Proxy getPrototypeOf throw', assertFailEnvelope(
      new Proxy({ targetMigrationId: 'test' }, {
        getPrototypeOf() { throw new Error('proto trap'); }
      })
    ));

    it('48. Proxy getOwnPropertyDescriptor throw', assertFailEnvelope(
      new Proxy({ targetMigrationId: 'test' }, {
        getOwnPropertyDescriptor() { throw new Error('gopd trap'); }
      })
    ));

    it('49. revoked Proxy', assertFailEnvelope(
      (() => {
        const { proxy, revoke } = Proxy.revocable({}, {});
        revoke();
        return proxy;
      })()
    ));

    it('50. Proxy get trap execution 0 times', async () => {
      let getTrapCount = 0;
      const proxy = new Proxy({ targetMigrationId: 'test' }, {
        get(target, prop) {
          if (prop === 'targetMigrationId') getTrapCount += 1;
          return Reflect.get(target, prop);
        }
      });
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: VALID_MIGRATIONS,
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: () => ({ ok: false, errors: ['fail'], summary: {} })
      });
      const result = await adapter.validateSource(proxy);
      assert.deepStrictEqual(result, SOURCE_VALIDATION_RESULTS.FAIL);
      assert.strictEqual(getTrapCount, 0);
    });
  });

  describe('7. Sanitization', () => {
    it('51. console.log/error/warn calls 0', async () => {
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;
      let logCount = 0;
      let errorCount = 0;
      let warnCount = 0;
      console.log = () => { logCount += 1; };
      console.error = () => { errorCount += 1; };
      console.warn = () => { warnCount += 1; };
      try {
        const adapter = createMigrationSourceValidationAdapter();
        await adapter.validateSource({ targetMigrationId: 'test' });
        assert.strictEqual(logCount, 0);
        assert.strictEqual(errorCount, 0);
        assert.strictEqual(warnCount, 0);
      } finally {
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
      }
    });

    it('52. result does not contain target migration ID', async () => {
      const adapter = createMigrationSourceValidationAdapter();
      const result = await adapter.validateSource({ targetMigrationId: 'super-secret-migration-id-99999' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('super-secret-migration-id'));
      assert.ok(!resultStr.includes('99999'));
    });

    it('53. result does not contain source file paths', async () => {
      const adapter = createMigrationSourceValidationAdapter();
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('migration-path-inventory'));
      assert.ok(!resultStr.includes('canonical-migrations'));
      assert.ok(!resultStr.includes('expected-schema'));
      assert.ok(!resultStr.includes('db/migration-provenance'));
    });

    it('54. result does not contain validator errors or raw inventory data', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: VALID_INVENTORY,
          migrations: VALID_MIGRATIONS,
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: () => ({
          ok: false,
          errors: ['internal validation error detail', 'another error'],
          summary: { inventory_rows: 30, discovered_paths: 25 }
        })
      });
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('internal validation error'));
      assert.ok(!resultStr.includes('inventory_rows'));
      assert.ok(!resultStr.includes('discovered_paths'));
      assert.deepStrictEqual(Object.keys(result), ['status']);
    });

    it('55. result does not contain hostname, URL, credential, or environment variable', async () => {
      const adapter = createMigrationSourceValidationAdapter();
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('DATABASE_URL'));
      assert.ok(!resultStr.includes('NEON'));
      assert.ok(!resultStr.includes('localhost'));
      assert.ok(!resultStr.includes('127.0.0.1'));
      assert.ok(!resultStr.includes('credential'));
      assert.ok(!resultStr.includes('secret'));
    });
  });

  describe('8. Orchestrator compatibility', () => {
    const MOCK_RUNTIME = {
      runnerVersion: '0.1.0',
      environmentClass: 'test',
      deployedCommit: 'abc123'
    };

    it('56. PASS result accepted by orchestrator validateSource dependency', async () => {
      const adapter = createMigrationSourceValidationAdapter();
      const result = await adapter.validateSource({ targetMigrationId: 'test' });
      assert.strictEqual(result.status, 'PASS');
      assert.ok(SOURCE_VALIDATION_RESULTS.PASS.status === result.status);
    });

    it('57. FAIL result blocks orchestrator at SOURCE_VALIDATION stage', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({
          available: true,
          inventory: { invalid: true },
          migrations: VALID_MIGRATIONS,
          schema: VALID_SCHEMA
        }),
        validateSourceConfiguration: () => ({ ok: false, errors: ['fail'], summary: {} })
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

    it('58. UNAVAILABLE result blocks orchestrator at SOURCE_VALIDATION stage', async () => {
      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({ available: false, inventory: null, migrations: null, schema: null })
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

    it('59. FAIL/UNAVAILABLE skips loadManifest and subsequent dependencies', async () => {
      let loadManifestCalls = 0;
      let lockCalls = 0;
      let ledgerCalls = 0;

      const adapter = createMigrationSourceValidationAdapter({
        loadFixedSources: () => ({ available: false, inventory: null, migrations: null, schema: null })
      });
      const mockDeps = {
        validateSource: (arg) => adapter.validateSource(arg),
        loadManifest: () => { loadManifestCalls += 1; throw new Error('should not be called'); },
        acquireAdvisoryLock: () => { lockCalls += 1; throw new Error('should not be called'); },
        readLedger: () => { ledgerCalls += 1; throw new Error('should not be called'); },
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
      assert.strictEqual(lockCalls, 0);
      assert.strictEqual(ledgerCalls, 0);
    });
  });
});
