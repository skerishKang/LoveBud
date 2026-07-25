'use strict';

/**
 * Focused CANONICAL_MANIFEST contract test: canonical manifest loader adapter (#3652).
 *
 * Exercises scripts/migration-canonical-manifest-adapter-core.cjs using ONLY
 * synthetic JavaScript mocks and isolated temp-filesystem fixtures. No DB,
 * PostgreSQL, Docker, SQL fixture, network, or environment secret is used.
 *
 * Refs #3652
 * Refs #3650
 * Refs #3458 - Keep #3458 OPEN.
 * Refs #3425 - Keep #3425 OPEN.
 * Refs #3435 - Keep #3435 OPEN.
 * Refs #3437 - Keep #3437 OPEN.
 * Refs #1882 - Keep #1882 OPEN.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ADAPTER_PATH = path.join(REPO_ROOT, 'scripts', 'migration-canonical-manifest-adapter-core.cjs');
const ORCH_PATH = path.join(REPO_ROOT, 'scripts', 'migration-runner-orchestrator-core.cjs');
const PROVENANCE_CORE_PATH = path.join(REPO_ROOT, 'scripts', 'migration-provenance-core.cjs');

const {
  createMigrationCanonicalManifestAdapter,
  FACTORY_ERROR_INVALID_DEPENDENCY,
  PUBLIC_ERROR_UNAVAILABLE,
  MANIFEST_RELATIVE_PATH
} = require(ADAPTER_PATH);

const orch = require(ORCH_PATH);

const {
  runCanonicalMigration,
  ORCHESTRATION_OUTCOMES,
  ORCHESTRATION_STAGES
} = orch;

const MIGRATION_1_ID = '20250101120000_add-users-table';
const MIGRATION_2_ID = '20250201120000_add-posts-table';
const MIGRATION_1_SQL = 'CREATE TABLE users (id SERIAL PRIMARY KEY);';
const MIGRATION_2_SQL = 'CREATE TABLE posts (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id));';
const MIGRATION_1_CHECKSUM = 'sha256:' + crypto.createHash('sha256').update(MIGRATION_1_SQL).digest('hex');
const MIGRATION_2_CHECKSUM = 'sha256:' + crypto.createHash('sha256').update(MIGRATION_2_SQL).digest('hex');

const ACTIVE_MANIFEST = {
  format_version: '1.0',
  status: 'ACTIVE',
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
  migrations: [
    {
      id: MIGRATION_1_ID,
      name: 'Add users table',
      path: `db/migrations/${MIGRATION_1_ID}.sql`,
      checksum: MIGRATION_1_CHECKSUM,
      depends_on: [],
      transaction_mode: 'REQUIRED',
      risk_class: 'ADDITIVE',
      expected_preconditions: [],
      expected_postconditions: [],
      rollback_support: 'not supported',
      destructive_operations: [],
      owner_domain: 'db',
      approval_reference: 'issue:1'
    },
    {
      id: MIGRATION_2_ID,
      name: 'Add posts table',
      path: `db/migrations/${MIGRATION_2_ID}.sql`,
      checksum: MIGRATION_2_CHECKSUM,
      depends_on: [MIGRATION_1_ID],
      transaction_mode: 'REQUIRED',
      risk_class: 'ADDITIVE',
      expected_preconditions: [],
      expected_postconditions: [],
      rollback_support: 'not supported',
      destructive_operations: [],
      owner_domain: 'db',
      approval_reference: 'issue:2'
    }
  ]
};

const ADOPTION_REQUIRED_MANIFEST = {
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

const VALID_MANIFEST_TEXT = JSON.stringify(ACTIVE_MANIFEST);
const ADOPTION_MANIFEST_TEXT = JSON.stringify(ADOPTION_REQUIRED_MANIFEST);

const MOCK_RUNTIME = { runnerVersion: '1.0', environmentClass: 'test', deployedCommit: 'abc123' };

function noopValidator() { return { ok: true }; }
function failingValidator() { return { ok: false }; }

function createTrackingValidator(delegate) {
  let callCount = 0;
  const validator = (parsed, repoRoot) => { callCount += 1; return delegate(parsed, repoRoot); };
  return { validator, getCallCount: () => callCount };
}

function createTrackingReader(text) {
  let readCount = 0;
  const reader = () => { readCount += 1; return text; };
  return { reader, getReadCount: () => readCount };
}

function createTempRepo() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lovebud-manifest-'));
  const scriptsDir = path.join(tmpDir, 'scripts');
  const migrationsDir = path.join(tmpDir, 'db', 'migrations');
  const provenanceDir = path.join(tmpDir, 'db', 'migration-provenance');
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(migrationsDir, { recursive: true });
  fs.mkdirSync(provenanceDir, { recursive: true });
  return { tmpDir, scriptsDir, migrationsDir, provenanceDir };
}

function writeTempAdapterFiles(scriptsDir) {
  const adapterSource = fs.readFileSync(ADAPTER_PATH, 'utf8');
  fs.writeFileSync(path.join(scriptsDir, 'migration-canonical-manifest-adapter-core.cjs'), adapterSource, 'utf8');
  const provenanceSource = fs.readFileSync(PROVENANCE_CORE_PATH, 'utf8');
  fs.writeFileSync(path.join(scriptsDir, 'migration-provenance-core.cjs'), provenanceSource, 'utf8');
}

function writeLedgerContract(provenanceDir) {
  const ledgerContract = {
    format_version: '1.0',
    relation_name: 'schema_migration_ledger',
    required_record_fields: [
      'migration_id', 'content_checksum', 'applied_at',
      'runner_version', 'environment_class', 'deployed_commit',
      'transaction_outcome'
    ]
  };
  fs.writeFileSync(path.join(provenanceDir, 'ledger-contract.json'), JSON.stringify(ledgerContract), 'utf8');
}

function writeActiveManifest(provenanceDir) {
  fs.writeFileSync(path.join(provenanceDir, 'canonical-migrations.json'), JSON.stringify(ACTIVE_MANIFEST), 'utf8');
}

function writeAdoptionManifest(provenanceDir) {
  fs.writeFileSync(path.join(provenanceDir, 'canonical-migrations.json'), JSON.stringify(ADOPTION_REQUIRED_MANIFEST), 'utf8');
}

function writeMigrationSqlFiles(migrationsDir) {
  fs.writeFileSync(path.join(migrationsDir, MIGRATION_1_ID + '.sql'), MIGRATION_1_SQL, 'utf8');
  fs.writeFileSync(path.join(migrationsDir, MIGRATION_2_ID + '.sql'), MIGRATION_2_SQL, 'utf8');
}

function loadTempAdapter(scriptsDir) {
  const adapterPath = path.join(scriptsDir, 'migration-canonical-manifest-adapter-core.cjs');
  const provenancePath = path.join(scriptsDir, 'migration-provenance-core.cjs');
  for (const key of Object.keys(require.cache)) {
    if (key === adapterPath || key === provenancePath || key.endsWith('migration-provenance-core.cjs') && key.includes(path.basename(scriptsDir))) {
      delete require.cache[key];
    }
  }
  delete require.cache[adapterPath];
  delete require.cache[provenancePath];
  return require(adapterPath);
}

function buildActiveManifestTempRepo() {
  const { tmpDir, scriptsDir, migrationsDir, provenanceDir } = createTempRepo();
  writeTempAdapterFiles(scriptsDir);
  writeLedgerContract(provenanceDir);
  writeActiveManifest(provenanceDir);
  writeMigrationSqlFiles(migrationsDir);
  return { tmpDir, scriptsDir };
}

function buildAdoptionManifestTempRepo() {
  const { tmpDir, scriptsDir, provenanceDir } = createTempRepo();
  writeTempAdapterFiles(scriptsDir);
  writeLedgerContract(provenanceDir);
  writeAdoptionManifest(provenanceDir);
  return { tmpDir, scriptsDir };
}

function createOrchDeps(overrides) {
  return {
    validateSource: () => ({ status: 'PASS' }),
    loadManifest: () => { throw new Error('not wired'); },
    acquireAdvisoryLock: () => { throw new Error('not wired'); },
    readLedger: () => { throw new Error('not wired'); },
    evaluatePrecondition: () => { throw new Error('not wired'); },
    executeMigration: () => { throw new Error('not wired'); },
    evaluatePostcondition: () => { throw new Error('not wired'); },
    checkAdvisoryLock: () => { throw new Error('not wired'); },
    appendLedgerRecord: () => { throw new Error('not wired'); },
    releaseAdvisoryLock: () => { throw new Error('not wired'); },
    now: () => new Date().toISOString(),
    ...overrides
  };
}

describe('DB migration canonical manifest adapter contract (#3652)', () => {

  describe('A. Public surface', () => {
    it('1. factory is a function', () => {
      assert.strictEqual(typeof createMigrationCanonicalManifestAdapter, 'function');
    });

    it('2. adapter is frozen', () => {
      const adapter = createMigrationCanonicalManifestAdapter();
      assert.ok(Object.isFrozen(adapter));
    });

    it('3. adapter own keys are exactly ["loadManifest"]', () => {
      const adapter = createMigrationCanonicalManifestAdapter();
      assert.deepStrictEqual(Reflect.ownKeys(adapter), ['loadManifest']);
    });

    it('4. MANIFEST_RELATIVE_PATH exported correctly', () => {
      assert.strictEqual(MANIFEST_RELATIVE_PATH, path.join('db', 'migration-provenance', 'canonical-migrations.json'));
    });

    it('5. FACTORY_ERROR_INVALID_DEPENDENCY is correct string', () => {
      assert.strictEqual(FACTORY_ERROR_INVALID_DEPENDENCY, 'MIGRATION_CANONICAL_MANIFEST_ADAPTER_INVALID_DEPENDENCY');
    });

    it('6. PUBLIC_ERROR_UNAVAILABLE is correct string', () => {
      assert.strictEqual(PUBLIC_ERROR_UNAVAILABLE, 'MIGRATION_CANONICAL_MANIFEST_UNAVAILABLE');
    });
  });

  describe('B. Current repository', () => {
    it('7. current committed manifest loads exactly', async () => {
      const adapter = createMigrationCanonicalManifestAdapter();
      const result = await adapter.loadManifest({ targetMigrationId: 'test' });
      assert.strictEqual(result.status, 'ADOPTION_REQUIRED');
      assert.deepStrictEqual([...result.migrations], []);
      assert.ok(Object.isFrozen(result));
      assert.ok(Object.isFrozen(result.migrations));
      assert.deepStrictEqual(Reflect.ownKeys(result), ['status', 'migrations']);
    });

    it('8. reader not called before method invocation', () => {
      const { reader, getReadCount } = createTrackingReader(ADOPTION_MANIFEST_TEXT);
      assert.strictEqual(getReadCount(), 0);
      createMigrationCanonicalManifestAdapter({
        readFixedManifestText: reader,
        validateMigrationManifest: noopValidator
      });
      assert.strictEqual(getReadCount(), 0);
    });

    it('9. each fixed file read at most once per call', async () => {
      const { reader, getReadCount } = createTrackingReader(ADOPTION_MANIFEST_TEXT);
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: reader,
        validateMigrationManifest: noopValidator
      });
      await adapter.loadManifest({ targetMigrationId: 'test' });
      assert.strictEqual(getReadCount(), 1);
    });

    it('10. validator called exactly once per call', async () => {
      const { validator, getCallCount } = createTrackingValidator(noopValidator);
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: validator
      });
      await adapter.loadManifest({ targetMigrationId: 'test' });
      assert.strictEqual(getCallCount(), 1);
    });
  });

  describe('C. Synthetic ACTIVE projection', () => {
    it('11. valid active manifest returns status ACTIVE', async () => {
      const { tmpDir, scriptsDir } = buildActiveManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const adapter = create();
        const result = await adapter.loadManifest({ targetMigrationId: 'test' });
        assert.strictEqual(result.status, 'ACTIVE');
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('12. migrations array is frozen', async () => {
      const { tmpDir, scriptsDir } = buildActiveManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        assert.ok(Object.isFrozen(result.migrations));
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('13. migrations length matches fixture', async () => {
      const { tmpDir, scriptsDir } = buildActiveManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        assert.strictEqual(result.migrations.length, 2);
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('14. each migration has exactly 6 own keys', async () => {
      const { tmpDir, scriptsDir } = buildActiveManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        for (const m of result.migrations) {
          assert.deepStrictEqual(Reflect.ownKeys(m), ['id', 'checksum', 'depends_on', 'transaction_mode', 'risk_class', 'destructive_operations']);
        }
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('15. each migration is frozen', async () => {
      const { tmpDir, scriptsDir } = buildActiveManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        for (const m of result.migrations) { assert.ok(Object.isFrozen(m)); }
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('16. depends_on is frozen array', async () => {
      const { tmpDir, scriptsDir } = buildActiveManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        for (const m of result.migrations) {
          assert.ok(Array.isArray(m.depends_on));
          assert.ok(Object.isFrozen(m.depends_on));
        }
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('17. destructive_operations is frozen array', async () => {
      const { tmpDir, scriptsDir } = buildActiveManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        for (const m of result.migrations) {
          assert.ok(Array.isArray(m.destructive_operations));
          assert.ok(Object.isFrozen(m.destructive_operations));
        }
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('18. migration 1 id matches expected', async () => {
      const { tmpDir, scriptsDir } = buildActiveManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        assert.strictEqual(result.migrations[0].id, MIGRATION_1_ID);
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('19. migration 1 checksum matches expected', async () => {
      const { tmpDir, scriptsDir } = buildActiveManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        assert.strictEqual(result.migrations[0].checksum, MIGRATION_1_CHECKSUM);
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('20. first migration depends_on is empty', async () => {
      const { tmpDir, scriptsDir } = buildActiveManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        assert.deepStrictEqual([...result.migrations[0].depends_on], []);
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('21. second migration depends_on contains first', async () => {
      const { tmpDir, scriptsDir } = buildActiveManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        assert.deepStrictEqual([...result.migrations[1].depends_on], [MIGRATION_1_ID]);
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('22. result object is frozen', async () => {
      const { tmpDir, scriptsDir } = buildActiveManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        assert.ok(Object.isFrozen(result));
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });
  });

  describe('D. ADOPTION_REQUIRED manifest', () => {
    it('23. ADOPTION_REQUIRED status returned', async () => {
      const { tmpDir, scriptsDir } = buildAdoptionManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        assert.strictEqual(result.status, 'ADOPTION_REQUIRED');
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('24. migrations is frozen empty array', async () => {
      const { tmpDir, scriptsDir } = buildAdoptionManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        assert.ok(Object.isFrozen(result.migrations));
        assert.strictEqual(result.migrations.length, 0);
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('25. result has exactly 2 own keys', async () => {
      const { tmpDir, scriptsDir } = buildAdoptionManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        assert.deepStrictEqual(Reflect.ownKeys(result), ['status', 'migrations']);
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('26. result is frozen', async () => {
      const { tmpDir, scriptsDir } = buildAdoptionManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        assert.ok(Object.isFrozen(result));
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('27. multiple calls produce equal but distinct results', async () => {
      const { tmpDir, scriptsDir } = buildAdoptionManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const adapter = create();
        const r1 = await adapter.loadManifest({ targetMigrationId: 'a' });
        const r2 = await adapter.loadManifest({ targetMigrationId: 'b' });
        assert.deepStrictEqual(r1.status, r2.status);
        assert.deepStrictEqual([...r1.migrations], [...r2.migrations]);
        assert.notStrictEqual(r1, r2);
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });
  });

  describe('E. Target neutrality', () => {
    it('28. result JSON does not contain targetMigrationId value', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await adapter.loadManifest({ targetMigrationId: 'super-secret-id-99999' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('super-secret'));
      assert.ok(!resultStr.includes('99999'));
    });

    it('29. non-empty ACTIVE manifest: all target IDs return same full ordered result', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const r1 = await adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID });
      const r2 = await adapter.loadManifest({ targetMigrationId: MIGRATION_2_ID });
      const r3 = await adapter.loadManifest({ targetMigrationId: 'unknown-id-99999' });
      const r4 = await adapter.loadManifest({ targetMigrationId: 'unrelated-valid-id' });
      for (const r of [r1, r2, r3, r4]) {
        assert.strictEqual(r.migrations.length, 2);
        assert.deepStrictEqual([...r.migrations[0].id], [...r1.migrations[0].id]);
        assert.deepStrictEqual([...r.migrations[1].id], [...r1.migrations[1].id]);
        assert.deepStrictEqual([...r.migrations[0].checksum], [...r1.migrations[0].checksum]);
        assert.deepStrictEqual([...r.migrations[1].checksum], [...r1.migrations[1].checksum]);
        assert.deepStrictEqual([...r.migrations[0].depends_on], [...r1.migrations[0].depends_on]);
        assert.deepStrictEqual([...r.migrations[1].depends_on], [...r1.migrations[1].depends_on]);
      }
      assert.ok(!JSON.stringify(r1).includes('unknown-id-99999'));
      assert.ok(!JSON.stringify(r1).includes('unrelated-valid-id'));
    });

    it('30. result does not contain source file paths', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await adapter.loadManifest({ targetMigrationId: 'test' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('canonical-migrations.json'));
      assert.ok(!resultStr.includes('migration-provenance'));
    });

    it('31. result does not contain REPO_ROOT path', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await adapter.loadManifest({ targetMigrationId: 'test' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes(REPO_ROOT));
    });

    it('32. result does not contain internal paths or secrets', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await adapter.loadManifest({ targetMigrationId: 'test' });
      const resultStr = JSON.stringify(result);
      assert.ok(!resultStr.includes('DATABASE_URL'));
      assert.ok(!resultStr.includes('localhost'));
      assert.ok(!resultStr.includes('credential'));
    });
  });

  describe('F. Malformed call envelope', () => {
    function assertRejectsEnvelope(arg) {
      return async () => {
        const adapter = createMigrationCanonicalManifestAdapter({
          readFixedManifestText: () => { throw new Error('should not be called'); }
        });
        await assert.rejects(
          adapter.loadManifest(arg),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      };
    }

    it('33. undefined', assertRejectsEnvelope(undefined));
    it('34. null', assertRejectsEnvelope(null));
    it('35. primitive (string)', assertRejectsEnvelope('test'));
    it('36. primitive (number)', assertRejectsEnvelope(42));
    it('37. array', assertRejectsEnvelope([]));
    it('38. function', assertRejectsEnvelope(() => {}));
    it('39. missing targetMigrationId', assertRejectsEnvelope({}));
    it('40. empty targetMigrationId', assertRejectsEnvelope({ targetMigrationId: '' }));
    it('41. whitespace-only targetMigrationId', assertRejectsEnvelope({ targetMigrationId: '   ' }));
    it('42. accessor targetMigrationId', assertRejectsEnvelope(
      Object.create({}, { targetMigrationId: { get() { return 'test'; }, enumerable: true } })
    ));
    it('43. extra key', assertRejectsEnvelope({ targetMigrationId: 'test', extra: 'bad' }));
    it('44. symbol key', assertRejectsEnvelope((() => {
      const o = { targetMigrationId: 'test' };
      o[Symbol('bad')] = 'v';
      return o;
    })()));
    it('45. non-enumerable targetMigrationId', assertRejectsEnvelope(
      Object.create({}, { targetMigrationId: { value: 'test', enumerable: false } })
    ));
    it('46. inherited targetMigrationId', assertRejectsEnvelope(Object.create({ targetMigrationId: 'test' })));
    it('47. custom prototype', assertRejectsEnvelope((() => {
      function P() { this.targetMigrationId = 'test'; }
      return new P();
    })()));
  });

  describe('G. Filesystem confinement', () => {
    it('48. regular file inside repo resolves and reads', async () => {
      const { tmpDir, scriptsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        writeLedgerContract(provenanceDir);
        fs.writeFileSync(path.join(provenanceDir, 'canonical-migrations.json'), '{"broken', 'utf8');
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('49. directory at manifest path returns UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        fs.rmSync(path.join(provenanceDir, 'canonical-migrations.json'), { force: true });
        fs.mkdirSync(path.join(provenanceDir, 'canonical-migrations.json'));
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('50. missing manifest file returns UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('51. symlink escaping repo returns UNAVAILABLE', async (t) => {
      const { tmpDir, scriptsDir, provenanceDir } = createTempRepo();
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lovebud-outside-'));
      try {
        writeTempAdapterFiles(scriptsDir);
        const outsideFile = path.join(outsideDir, 'escaped.json');
        fs.writeFileSync(outsideFile, '{}', 'utf8');
        const manifestPath = path.join(provenanceDir, 'canonical-migrations.json');
        fs.rmSync(manifestPath, { force: true });
        try {
          fs.symlinkSync(outsideFile, manifestPath);
        } catch (error) {
          t.skip('symlink unavailable: ' + (error.code || error.message));
          return;
        }
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });

    it('52. symlink to directory returns UNAVAILABLE', async (t) => {
      const { tmpDir, scriptsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lovebud-dir-'));
        const manifestPath = path.join(provenanceDir, 'canonical-migrations.json');
        fs.rmSync(manifestPath, { force: true });
        try {
          fs.symlinkSync(outsideDir, manifestPath);
        } catch (error) {
          t.skip('symlink unavailable: ' + (error.code || error.message));
          return;
        }
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('53. empty file returns UNAVAILABLE (bad JSON)', async () => {
      const { tmpDir, scriptsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        fs.writeFileSync(path.join(provenanceDir, 'canonical-migrations.json'), '', 'utf8');
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('54. valid JSON but invalid manifest returns UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        writeLedgerContract(provenanceDir);
        fs.writeFileSync(path.join(provenanceDir, 'canonical-migrations.json'), '{"status":"INVALID"}', 'utf8');
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('55. file with NUL bytes returns UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        fs.writeFileSync(path.join(provenanceDir, 'canonical-migrations.json'), Buffer.from([0x00, 0x01, 0x02]), 'utf8');
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });
  });

  describe('H. Read counts', { concurrency: false }, () => {
    it('56. valid manifest read exactly once via readFixedManifestText', async () => {
      const { reader, getReadCount } = createTrackingReader(ADOPTION_MANIFEST_TEXT);
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: reader,
        validateMigrationManifest: noopValidator
      });
      await adapter.loadManifest({ targetMigrationId: 'test' });
      assert.strictEqual(getReadCount(), 1);
    });

    it('57. malformed envelope: reader called 0 times', async () => {
      const { reader, getReadCount } = createTrackingReader(ADOPTION_MANIFEST_TEXT);
      const adapter = createMigrationCanonicalManifestAdapter({ readFixedManifestText: reader });
      await assert.rejects(adapter.loadManifest(undefined));
      assert.strictEqual(getReadCount(), 0);
    });

    it('58. malformed envelope: validator called 0 times', async () => {
      let validatorCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => { validatorCalls += 1; return noopValidator(); }
      });
      await assert.rejects(adapter.loadManifest(undefined));
      assert.strictEqual(validatorCalls, 0);
    });

    it('59. valid manifest: readFileSync called once for manifest file on temp repo', async () => {
      const { tmpDir, scriptsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        writeLedgerContract(provenanceDir);
        writeAdoptionManifest(provenanceDir);
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const adapter = create();
        const manifestReal = fs.realpathSync(path.join(provenanceDir, 'canonical-migrations.json'));
        let readCount = 0;
        const originalReadFileSync = fs.readFileSync;
        fs.readFileSync = function patchedRead(file, ...args) {
          const resolved = path.resolve(String(file));
          if (resolved === manifestReal) readCount += 1;
          return originalReadFileSync.call(this, file, ...args);
        };
        try {
          await adapter.loadManifest({ targetMigrationId: 'test' });
          assert.strictEqual(readCount, 1);
        } finally { fs.readFileSync = originalReadFileSync; }
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('60. consecutive calls each read independently', async () => {
      const { reader, getReadCount } = createTrackingReader(ADOPTION_MANIFEST_TEXT);
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: reader,
        validateMigrationManifest: noopValidator
      });
      await adapter.loadManifest({ targetMigrationId: 'a' });
      assert.strictEqual(getReadCount(), 1);
      await adapter.loadManifest({ targetMigrationId: 'b' });
      assert.strictEqual(getReadCount(), 2);
      await adapter.loadManifest({ targetMigrationId: 'c' });
      assert.strictEqual(getReadCount(), 3);
    });
  });

  describe('I. Default loader filesystem', () => {
    it('61. valid adoption manifest with empty migrations returns success', async () => {
      const { tmpDir, scriptsDir } = buildAdoptionManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const result = await create().loadManifest({ targetMigrationId: 'test' });
        assert.strictEqual(result.status, 'ADOPTION_REQUIRED');
        assert.strictEqual(result.migrations.length, 0);
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('62. malformed JSON file returns UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        writeLedgerContract(provenanceDir);
        fs.writeFileSync(path.join(provenanceDir, 'canonical-migrations.json'), '{ broken json', 'utf8');
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('63. valid JSON but missing canonical_directory returns UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        writeLedgerContract(provenanceDir);
        const badManifest = { format_version: '1.0', status: 'ACTIVE', migrations: [] };
        fs.writeFileSync(path.join(provenanceDir, 'canonical-migrations.json'), JSON.stringify(badManifest), 'utf8');
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('64. valid JSON but wrong status returns UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        writeLedgerContract(provenanceDir);
        const badManifest = { format_version: '1.0', status: 'WRONG', canonical_directory: 'db/migrations', migrations: [] };
        fs.writeFileSync(path.join(provenanceDir, 'canonical-migrations.json'), JSON.stringify(badManifest), 'utf8');
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('65. valid manifest but missing ledger contract returns UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        writeAdoptionManifest(provenanceDir);
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('66. valid manifest but missing SQL files returns UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir, migrationsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        writeLedgerContract(provenanceDir);
        writeActiveManifest(provenanceDir);
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('67. valid manifest but checksum mismatch returns UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir, migrationsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        writeLedgerContract(provenanceDir);
        writeActiveManifest(provenanceDir);
        fs.writeFileSync(path.join(migrationsDir, MIGRATION_1_ID + '.sql'), 'WRONG CONTENT', 'utf8');
        fs.writeFileSync(path.join(migrationsDir, MIGRATION_2_ID + '.sql'), 'ALSO WRONG', 'utf8');
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('68. valid manifest but non-matching dependency returns UNAVAILABLE', async () => {
      const { tmpDir, scriptsDir, migrationsDir, provenanceDir } = createTempRepo();
      try {
        writeTempAdapterFiles(scriptsDir);
        writeLedgerContract(provenanceDir);
        const badManifest = JSON.parse(JSON.stringify(ACTIVE_MANIFEST));
        badManifest.migrations[1].depends_on = ['nonexistent_id'];
        fs.writeFileSync(path.join(provenanceDir, 'canonical-migrations.json'), JSON.stringify(badManifest), 'utf8');
        writeMigrationSqlFiles(migrationsDir);
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        await assert.rejects(
          create().loadManifest({ targetMigrationId: 'test' }),
          (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
        );
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });
  });

  describe('J. Factory hostile config', () => {
    function assertFactoryReject(arg) {
      return () => {
        assert.throws(
          () => createMigrationCanonicalManifestAdapter(arg),
          (err) => err.message === FACTORY_ERROR_INVALID_DEPENDENCY
        );
      };
    }

    it('69. numeric config', assertFactoryReject(1));
    it('70. string config', assertFactoryReject('bad'));
    it('71. array config', assertFactoryReject([]));
    it('72. function config', assertFactoryReject(() => {}));
    it('73. null config', assertFactoryReject(null));
    it('74. custom prototype config', assertFactoryReject((() => { function P() {} return new P(); })()));
    it('75. extra key config', assertFactoryReject({ readFixedManifestText: () => '{}', extra: true }));
    it('76. symbol key config', assertFactoryReject((() => { const c = {}; c[Symbol('bad')] = true; return c; })()));

    it('77. accessor dependency getter 0 calls', () => {
      let getterCalls = 0;
      const cfg = Object.create({}, {
        readFixedManifestText: {
          get() { getterCalls += 1; return () => '{}'; },
          enumerable: true
        }
      });
      assert.throws(
        () => createMigrationCanonicalManifestAdapter(cfg),
        (err) => err.message === FACTORY_ERROR_INVALID_DEPENDENCY
      );
      assert.strictEqual(getterCalls, 0);
    });

    it('78. non-enumerable dependency -> fixed error', () => {
      const cfg = Object.create(null, {
        readFixedManifestText: { value: () => '{}', enumerable: false }
      });
      assert.throws(
        () => createMigrationCanonicalManifestAdapter(cfg),
        (err) => err.message === FACTORY_ERROR_INVALID_DEPENDENCY
      );
    });

    it('79. Proxy has trap 0 calls', () => {
      let hasCalls = 0;
      const inner = { readFixedManifestText: () => '{}' };
      const proxy = new Proxy(inner, { has() { hasCalls += 1; return Reflect.has(...arguments); } });
      const adapter = createMigrationCanonicalManifestAdapter(proxy);
      assert.ok(adapter);
      assert.strictEqual(hasCalls, 0);
    });

    it('80. Proxy get trap 0 calls on config', () => {
      let getCalls = 0;
      const inner = { readFixedManifestText: () => '{}' };
      const proxy = new Proxy(inner, { get() { getCalls += 1; return Reflect.get(...arguments); } });
      const adapter = createMigrationCanonicalManifestAdapter(proxy);
      assert.ok(adapter);
      assert.strictEqual(getCalls, 0);
    });

    it('81. Proxy ownKeys throw -> fixed error', assertFactoryReject(
      new Proxy({}, { ownKeys() { throw new Error('trap'); } })
    ));
    it('82. Proxy getPrototypeOf throw -> fixed error', assertFactoryReject(
      new Proxy({}, { getPrototypeOf() { throw new Error('trap'); } })
    ));
    it('83. Proxy getOwnPropertyDescriptor throw -> fixed error', assertFactoryReject(
      new Proxy({ readFixedManifestText: 'x' }, { getOwnPropertyDescriptor() { throw new Error('trap'); } })
    ));
    it('84. revoked Proxy -> fixed error', assertFactoryReject((() => {
      const { proxy, revoke } = Proxy.revocable({}, {});
      revoke();
      return proxy;
    })()));

    it('85. factory config with swapped dependency insertion order -> OK', () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        validateMigrationManifest: noopValidator,
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT
      });
      assert.ok(adapter);
    });
  });

  describe('K. Async loader/validator', () => {
    it('86. async reader resolve processes result', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: async () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await adapter.loadManifest({ targetMigrationId: 'test' });
      assert.strictEqual(result.status, 'ADOPTION_REQUIRED');
    });

    it('87. async reader rejection -> UNAVAILABLE', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: async () => { throw new Error('async read fail'); }
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
    });

    it('88. genuine Promise resolve processes result', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => Promise.resolve(ADOPTION_MANIFEST_TEXT),
        validateMigrationManifest: noopValidator
      });
      const result = await adapter.loadManifest({ targetMigrationId: 'test' });
      assert.strictEqual(result.status, 'ADOPTION_REQUIRED');
    });

    it('89. genuine Promise reject -> UNAVAILABLE', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => Promise.reject(new Error('genuine reject'))
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
    });

    it('90. Proxy-wrapped Promise -> NOT assimilated -> UNAVAILABLE', async () => {
      const genuine = Promise.resolve(ADOPTION_MANIFEST_TEXT);
      let getCalls = 0;
      const proxiedPromise = new Proxy(genuine, {
        get(target, property, receiver) {
          getCalls += 1;
          return Reflect.get(target, property, receiver);
        }
      });
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => proxiedPromise
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
      assert.strictEqual(getCalls, 0);
    });

    it('91. accessor thenable reader -> NOT assimilated -> UNAVAILABLE', async () => {
      let getterCalls = 0;
      const thenable = Object.create(null, {
        then: {
          get() { getterCalls += 1; return () => ADOPTION_MANIFEST_TEXT; },
          enumerable: true
        }
      });
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => thenable
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
      assert.strictEqual(getterCalls, 0);
    });

    it('92. data-property thenable reader -> NOT assimilated -> UNAVAILABLE', async () => {
      let thenCalls = 0;
      const thenable = {
        then() { thenCalls += 1; return ADOPTION_MANIFEST_TEXT; }
      };
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => thenable
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
      assert.strictEqual(thenCalls, 0);
    });

    it('93. async validator resolve processes result', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: async () => ({ ok: true })
      });
      const result = await adapter.loadManifest({ targetMigrationId: 'test' });
      assert.strictEqual(result.status, 'ADOPTION_REQUIRED');
    });

    it('94. async validator rejection -> UNAVAILABLE', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: async () => { throw new Error('async validator fail'); }
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
    });

    it('95. genuine Promise validator resolve processes result', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => Promise.resolve({ ok: true })
      });
      const result = await adapter.loadManifest({ targetMigrationId: 'test' });
      assert.strictEqual(result.status, 'ADOPTION_REQUIRED');
    });
  });

  describe('L. Hostile validator result', () => {
    it('96. { ok: true } own data -> passes projection', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => ({ ok: true })
      });
      const result = await adapter.loadManifest({ targetMigrationId: 'test' });
      assert.strictEqual(result.status, 'ADOPTION_REQUIRED');
    });

    it('97. { ok: false } own data -> UNAVAILABLE', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => ({ ok: false })
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
    });

    it('98. accessor ok, getter 0 -> UNAVAILABLE', async () => {
      let getterCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => Object.create({}, {
          ok: { get() { getterCalls += 1; return true; }, enumerable: true }
        })
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
      assert.strictEqual(getterCalls, 0);
    });

    it('99. Proxy get trap 0 calls on validator result', async () => {
      let getTrapCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => {
          const inner = { ok: true };
          return new Proxy(inner, {
            get(target, prop) { getTrapCalls += 1; return Reflect.get(target, prop); }
          });
        }
      });
      const result = await adapter.loadManifest({ targetMigrationId: 'test' });
      assert.strictEqual(result.status, 'ADOPTION_REQUIRED');
      assert.strictEqual(getTrapCalls, 0);
    });

    it('100. validator result ownKeys throw -> UNAVAILABLE', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => new Proxy({}, { ownKeys() { throw new Error('trap'); } })
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
    });

    it('101. validator result getPrototypeOf throw -> UNAVAILABLE', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => new Proxy({}, { getPrototypeOf() { throw new Error('trap'); } })
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
    });

    it('102. validator result getOwnPropertyDescriptor throw -> UNAVAILABLE', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('trap'); } })
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
    });

    it('103. revoked Proxy validator result -> UNAVAILABLE', async () => {
      const { proxy, revoke } = Proxy.revocable({}, {});
      revoke();
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => proxy
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
    });

    it('104. validator Promise reject -> UNAVAILABLE', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => Promise.reject(new Error('reject'))
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
    });

    it('105. genuine Promise resolve { ok: true } -> passes projection', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => Promise.resolve({ ok: true })
      });
      const result = await adapter.loadManifest({ targetMigrationId: 'test' });
      assert.strictEqual(result.status, 'ADOPTION_REQUIRED');
    });

    it('106. Proxy-wrapped validator result -> treated as sync, get trap 0', async () => {
      const genuine = { ok: true };
      let getCalls = 0;
      const proxied = new Proxy(genuine, {
        get(target, property, receiver) { getCalls += 1; return Reflect.get(target, property, receiver); }
      });
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => proxied
      });
      const result = await adapter.loadManifest({ targetMigrationId: 'test' });
      assert.strictEqual(result.status, 'ADOPTION_REQUIRED');
      assert.strictEqual(getCalls, 0);
    });

    it('107. non-enumerable ok -> UNAVAILABLE', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => Object.create(null, {
          ok: { value: true, enumerable: false }
        })
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => err.message === PUBLIC_ERROR_UNAVAILABLE
      );
    });
  });

  describe('M. Sanitization', () => {
    it('108. console.log/error/warn calls 0', async () => {
      const origLog = console.log;
      const origErr = console.error;
      const origWarn = console.warn;
      let counts = { log: 0, err: 0, warn: 0 };
      console.log = () => { counts.log += 1; };
      console.error = () => { counts.err += 1; };
      console.warn = () => { counts.warn += 1; };
      try {
        const adapter = createMigrationCanonicalManifestAdapter();
        try { await adapter.loadManifest({ targetMigrationId: 'test' }); } catch {}
        assert.strictEqual(counts.log, 0);
        assert.strictEqual(counts.err, 0);
        assert.strictEqual(counts.warn, 0);
      } finally {
        console.log = origLog;
        console.error = origErr;
        console.warn = origWarn;
      }
    });

    it('109. error message does not contain targetMigrationId', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => { throw new Error('raw reader failure'); }
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'super-secret-99999' }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          assert.ok(!err.message.includes('super-secret'));
          assert.ok(!err.message.includes('99999'));
          return true;
        }
      );
    });

    it('110. error message does not contain file paths', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => { throw new Error('raw reader failure'); }
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          assert.ok(!err.message.includes('migration-provenance'));
          assert.ok(!err.message.includes('canonical-migrations'));
          return true;
        }
      );
    });

    it('111. error does not expose stack trace', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => { throw new Error('raw reader failure'); }
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => {
          assert.strictEqual(err.stack, undefined);
          assert.strictEqual(err.cause, undefined);
          return true;
        }
      );
    });

    it('112. read failure error does not contain internal details', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => {
          const err = new Error('EACCES: /internal/.secrets/token');
          err.stack = 'Error: EACCES\n    at Object.readSync';
          throw err;
        }
      });
      try {
        await adapter.loadManifest({ targetMigrationId: 'test' });
        assert.fail('should have thrown');
      } catch (err) {
        assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
        assert.ok(!err.message.includes('EACCES'));
        assert.ok(!err.message.includes('.secrets'));
      }
    });

    it('113. validator failure error does not contain validator detail', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => { throw new Error('secret internal detail: /path/to/db'); }
      });
      try {
        await adapter.loadManifest({ targetMigrationId: 'test' });
        assert.fail('should have thrown');
      } catch (err) {
        assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
        assert.ok(!err.message.includes('secret internal'));
        assert.ok(!err.message.includes('/path/to/db'));
      }
    });

    it('114. Promise rejection error is sanitized', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => Promise.reject(new Error('raw rejection with credential'))
      });
      try {
        await adapter.loadManifest({ targetMigrationId: 'test' });
        assert.fail('should have thrown');
      } catch (err) {
        assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
        assert.ok(!err.message.includes('credential'));
      }
    });

    it('115. error is an instance of Error', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => { throw new Error('raw reader failure'); }
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => {
          assert.ok(err instanceof Error);
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          return true;
        }
      );
    });
  });

  describe('O. Validator mutation defense', () => {
    it('116. validator data-property mutation of id does not affect result', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          parsed.migrations[0].id = '20990101000000_mutated-id';
          return { ok: true };
        }
      });
      const result = await adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID });
      assert.strictEqual(result.migrations[0].id, MIGRATION_1_ID);
    });

    it('117. validator data-property mutation of checksum does not affect result', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          parsed.migrations[0].checksum = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
          return { ok: true };
        }
      });
      const result = await adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID });
      assert.strictEqual(result.migrations[0].checksum, MIGRATION_1_CHECKSUM);
    });

    it('118. validator data-property mutation of depends_on does not affect result', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          parsed.migrations[1].depends_on = ['mutated-dep'];
          return { ok: true };
        }
      });
      const result = await adapter.loadManifest({ targetMigrationId: MIGRATION_2_ID });
      assert.deepStrictEqual([...result.migrations[1].depends_on], [MIGRATION_1_ID]);
    });

    it('119. validator data-property mutation of risk_class does not affect result', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          parsed.migrations[0].risk_class = 'DESTRUCTIVE';
          return { ok: true };
        }
      });
      const result = await adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID });
      assert.strictEqual(result.migrations[0].risk_class, 'ADDITIVE');
    });

    it('120. validator data-property mutation of destructive_operations does not affect result', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          parsed.migrations[0].destructive_operations = ['DROP_TABLE'];
          return { ok: true };
        }
      });
      const result = await adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID });
      assert.deepStrictEqual([...result.migrations[0].destructive_operations], []);
    });

    it('121. validator data-property mutation of top-level status does not affect result', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          parsed.status = 'ADOPTION_REQUIRED';
          return { ok: true };
        }
      });
      const result = await adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID });
      assert.strictEqual(result.status, 'ACTIVE');
    });

    it('122. validator data-property mutation of entire migrations array does not affect result', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          parsed.migrations = [];
          return { ok: true };
        }
      });
      const result = await adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID });
      assert.strictEqual(result.migrations.length, 2);
    });

    it('123. validator accessor replacement of migration id: getter 0, result unchanged', async () => {
      let getterCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          Object.defineProperty(parsed.migrations[0], 'id', {
            enumerable: true,
            get() { getterCalls += 1; throw new Error('raw getter error'); }
          });
          return { ok: true };
        }
      });
      const result = await adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID });
      assert.strictEqual(result.migrations[0].id, MIGRATION_1_ID);
      assert.strictEqual(getterCalls, 0);
    });

    it('124. validator Proxy replacement of migration record: all traps 0, result unchanged', async () => {
      let getCalls = 0;
      let hasCalls = 0;
      let ownKeysCalls = 0;
      let descCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          const original = parsed.migrations[0];
          parsed.migrations[0] = new Proxy(original, {
            get() { getCalls += 1; return Reflect.get(...arguments); },
            has() { hasCalls += 1; return Reflect.has(...arguments); },
            ownKeys() { ownKeysCalls += 1; return Reflect.ownKeys(...arguments); },
            getOwnPropertyDescriptor() { descCalls += 1; return Reflect.getOwnPropertyDescriptor(...arguments); }
          });
          return { ok: true };
        }
      });
      const result = await adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID });
      assert.strictEqual(result.migrations[0].id, MIGRATION_1_ID);
      assert.strictEqual(getCalls, 0);
      assert.strictEqual(hasCalls, 0);
      assert.strictEqual(ownKeysCalls, 0);
      assert.strictEqual(descCalls, 0);
    });

    it('125. validator Proxy replacement of migrations array: all traps 0, result unchanged', async () => {
      let getCalls = 0;
      let hasCalls = 0;
      let ownKeysCalls = 0;
      let descCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          const original = parsed.migrations;
          parsed.migrations = new Proxy(original, {
            get() { getCalls += 1; return Reflect.get(...arguments); },
            has() { hasCalls += 1; return Reflect.has(...arguments); },
            ownKeys() { ownKeysCalls += 1; return Reflect.ownKeys(...arguments); },
            getOwnPropertyDescriptor() { descCalls += 1; return Reflect.getOwnPropertyDescriptor(...arguments); }
          });
          return { ok: true };
        }
      });
      const result = await adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID });
      assert.strictEqual(result.migrations.length, 2);
      assert.strictEqual(getCalls, 0);
      assert.strictEqual(hasCalls, 0);
      assert.strictEqual(ownKeysCalls, 0);
      assert.strictEqual(descCalls, 0);
    });

    it('126. validator Proxy replacement of depends_on array: all traps 0, result unchanged', async () => {
      let getCalls = 0;
      let hasCalls = 0;
      let ownKeysCalls = 0;
      let descCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          const original = parsed.migrations[1].depends_on;
          parsed.migrations[1].depends_on = new Proxy(original, {
            get() { getCalls += 1; return Reflect.get(...arguments); },
            has() { hasCalls += 1; return Reflect.has(...arguments); },
            ownKeys() { ownKeysCalls += 1; return Reflect.ownKeys(...arguments); },
            getOwnPropertyDescriptor() { descCalls += 1; return Reflect.getOwnPropertyDescriptor(...arguments); }
          });
          return { ok: true };
        }
      });
      const result = await adapter.loadManifest({ targetMigrationId: MIGRATION_2_ID });
      assert.deepStrictEqual([...result.migrations[1].depends_on], [MIGRATION_1_ID]);
      assert.strictEqual(getCalls, 0);
      assert.strictEqual(hasCalls, 0);
      assert.strictEqual(ownKeysCalls, 0);
      assert.strictEqual(descCalls, 0);
    });

    it('127. validator Proxy replacement of destructive_operations: all traps 0, result unchanged', async () => {
      let getCalls = 0;
      let hasCalls = 0;
      let ownKeysCalls = 0;
      let descCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          const original = parsed.migrations[0].destructive_operations;
          parsed.migrations[0].destructive_operations = new Proxy(original, {
            get() { getCalls += 1; return Reflect.get(...arguments); },
            has() { hasCalls += 1; return Reflect.has(...arguments); },
            ownKeys() { ownKeysCalls += 1; return Reflect.ownKeys(...arguments); },
            getOwnPropertyDescriptor() { descCalls += 1; return Reflect.getOwnPropertyDescriptor(...arguments); }
          });
          return { ok: true };
        }
      });
      const result = await adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID });
      assert.deepStrictEqual([...result.migrations[0].destructive_operations], []);
      assert.strictEqual(getCalls, 0);
      assert.strictEqual(hasCalls, 0);
      assert.strictEqual(ownKeysCalls, 0);
      assert.strictEqual(descCalls, 0);
    });

    it('128. validator throw after mutation: fixed error, snapshot not exposed', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          parsed.migrations[0].id = '20990101000000_mutated-id';
          throw new Error('raw validator throw after mutation');
        }
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          assert.ok(!err.message.includes('mutated'));
          assert.ok(!err.message.includes('raw validator'));
          return true;
        }
      );
    });

    it('129. validator Promise reject after mutation: fixed error, snapshot not exposed', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: (parsed) => {
          parsed.migrations[0].id = '20990101000000_mutated-id';
          return Promise.reject(new Error('raw async reject after mutation'));
        }
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          assert.ok(!err.message.includes('mutated'));
          return true;
        }
      );
    });
  });

  describe('P. Projection hostile evidence', { concurrency: false }, () => {
    let originalParse;

    beforeEach(() => {
      originalParse = JSON.parse;
    });

    afterEach(() => {
      JSON.parse = originalParse;
    });

    it('130. top-level status accessor: getter 0, fixed error', async () => {
      let getterCalls = 0;
      JSON.parse = function patchedParse(text, ...args) {
        const obj = originalParse.call(this, text, ...args);
        Object.defineProperty(obj, 'status', {
          enumerable: true,
          get() { getterCalls += 1; throw new Error('raw status getter'); }
        });
        return obj;
      };
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          assert.strictEqual(getterCalls, 0);
          return true;
        }
      );
    });

    it('131. top-level migrations accessor: getter 0, fixed error', async () => {
      let getterCalls = 0;
      JSON.parse = function patchedParse(text, ...args) {
        const obj = originalParse.call(this, text, ...args);
        Object.defineProperty(obj, 'migrations', {
          enumerable: true,
          get() { getterCalls += 1; throw new Error('raw migrations getter'); }
        });
        return obj;
      };
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          assert.strictEqual(getterCalls, 0);
          return true;
        }
      );
    });

    it('132. migration field accessor: getter 0, fixed error', async () => {
      let getterCalls = 0;
      JSON.parse = function patchedParse(text, ...args) {
        const obj = originalParse.call(this, text, ...args);
        Object.defineProperty(obj.migrations[0], 'id', {
          enumerable: true,
          get() { getterCalls += 1; throw new Error('raw id getter'); }
        });
        return obj;
      };
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          assert.strictEqual(getterCalls, 0);
          return true;
        }
      );
    });

    it('133. migration record Proxy ownKeys throw: fixed error', async () => {
      JSON.parse = function patchedParse(text, ...args) {
        const obj = originalParse.call(this, text, ...args);
        obj.migrations[0] = new Proxy(obj.migrations[0], {
          ownKeys() { throw new Error('raw ownKeys trap'); }
        });
        return obj;
      };
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          assert.ok(!err.message.includes('ownKeys'));
          return true;
        }
      );
    });

    it('134. migrations array Proxy ownKeys throw: fixed error', async () => {
      JSON.parse = function patchedParse(text, ...args) {
        const obj = originalParse.call(this, text, ...args);
        obj.migrations = new Proxy(obj.migrations, {
          ownKeys() { throw new Error('raw array ownKeys'); }
        });
        return obj;
      };
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          return true;
        }
      );
    });

    it('135. nested array Proxy descriptor throw: fixed error', async () => {
      JSON.parse = function patchedParse(text, ...args) {
        const obj = originalParse.call(this, text, ...args);
        obj.migrations[1].depends_on = new Proxy(obj.migrations[1].depends_on, {
          getOwnPropertyDescriptor() { throw new Error('raw desc trap'); }
        });
        return obj;
      };
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: MIGRATION_2_ID }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          return true;
        }
      );
    });

    it('136. sparse migrations array: fixed error', async () => {
      JSON.parse = function patchedParse(text, ...args) {
        const obj = originalParse.call(this, text, ...args);
        obj.migrations[5] = { id: 'sparse', checksum: 'sha256:00', depends_on: [], transaction_mode: 'REQUIRED', risk_class: 'ADDITIVE', destructive_operations: [] };
        return obj;
      };
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          return true;
        }
      );
    });

    it('137. sparse depends_on: fixed error', async () => {
      JSON.parse = function patchedParse(text, ...args) {
        const obj = originalParse.call(this, text, ...args);
        obj.migrations[1].depends_on[5] = 'sparse-dep';
        return obj;
      };
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: MIGRATION_2_ID }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          return true;
        }
      );
    });

    it('138. extra array property: fixed error', async () => {
      JSON.parse = function patchedParse(text, ...args) {
        const obj = originalParse.call(this, text, ...args);
        obj.migrations.extra = 'bad';
        return obj;
      };
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          return true;
        }
      );
    });

    it('139. symbol array property: fixed error', async () => {
      JSON.parse = function patchedParse(text, ...args) {
        const obj = originalParse.call(this, text, ...args);
        obj.migrations[Symbol('bad')] = 'v';
        return obj;
      };
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          return true;
        }
      );
    });

    it('140. accessor array index: getter 0, fixed error', async () => {
      let getterCalls = 0;
      JSON.parse = function patchedParse(text, ...args) {
        const obj = originalParse.call(this, text, ...args);
        Object.defineProperty(obj.migrations, 0, {
          enumerable: true,
          get() { getterCalls += 1; throw new Error('raw index getter'); }
        });
        return obj;
      };
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: MIGRATION_1_ID }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          assert.strictEqual(getterCalls, 0);
          return true;
        }
      );
    });
  });

  describe('Q. Validator result strict evidence', () => {
    it('141. validator result with symbol key: fixed error', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => {
          const result = { ok: true };
          result[Symbol('bad')] = 1;
          return result;
        }
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => { assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE); return true; }
      );
    });

    it('142. validator result with extra accessor: getter 0, fixed error', async () => {
      let getterCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => {
          const result = { ok: true };
          Object.defineProperty(result, 'errors', {
            enumerable: true,
            get() { getterCalls += 1; return ['raw detail']; }
          });
          return result;
        }
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          assert.strictEqual(getterCalls, 0);
          return true;
        }
      );
    });

    it('143. validator result with non-enumerable extra field: fixed error', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => {
          const result = { ok: true };
          Object.defineProperty(result, 'hidden', {
            value: 'secret',
            enumerable: false
          });
          return result;
        }
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => { assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE); return true; }
      );
    });

    it('144. validator Proxy-wrapped Promise: get trap 0, fixed error', async () => {
      let getCalls = 0;
      const genuine = Promise.resolve({ ok: true });
      const proxiedPromise = new Proxy(genuine, {
        get() { getCalls += 1; return Reflect.get(...arguments); }
      });
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => proxiedPromise
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          assert.strictEqual(getCalls, 0);
          return true;
        }
      );
    });

    it('145. validator accessor thenable: getter 0, fixed error', async () => {
      let getterCalls = 0;
      const thenable = Object.create(null, {
        then: {
          get() { getterCalls += 1; return () => ({ ok: true }); },
          enumerable: true
        }
      });
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => thenable
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          assert.strictEqual(getterCalls, 0);
          return true;
        }
      );
    });

    it('146. validator data-property thenable: then call 0, fixed error', async () => {
      let thenCalls = 0;
      const thenable = {
        then() { thenCalls += 1; return { ok: true }; }
      };
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => thenable
      });
      await assert.rejects(
        adapter.loadManifest({ targetMigrationId: 'test' }),
        (err) => {
          assert.strictEqual(err.message, PUBLIC_ERROR_UNAVAILABLE);
          assert.strictEqual(thenCalls, 0);
          return true;
        }
      );
    });
  });

  describe('R. JSON.parse exact count', { concurrency: false }, () => {
    let originalParse;

    beforeEach(() => {
      originalParse = JSON.parse;
    });

    afterEach(() => {
      JSON.parse = originalParse;
    });

    it('147. valid manifest: JSON.parse exactly once, validator exactly once', async () => {
      let parseCalls = 0;
      JSON.parse = function patchedParse(text, ...args) {
        parseCalls += 1;
        return originalParse.call(this, text, ...args);
      };
      const { validator, getCallCount } = createTrackingValidator(noopValidator);
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: validator
      });
      await adapter.loadManifest({ targetMigrationId: 'test' });
      assert.strictEqual(parseCalls, 1);
      assert.strictEqual(getCallCount(), 1);
    });

    it('148. malformed envelope: JSON.parse 0, validator 0', async () => {
      let parseCalls = 0;
      JSON.parse = function patchedParse(text, ...args) {
        parseCalls += 1;
        return originalParse.call(this, text, ...args);
      };
      const { validator, getCallCount } = createTrackingValidator(noopValidator);
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: validator
      });
      await assert.rejects(adapter.loadManifest(undefined));
      assert.strictEqual(parseCalls, 0);
      assert.strictEqual(getCallCount(), 0);
    });

    it('149. reader failure: JSON.parse 0, validator 0', async () => {
      let parseCalls = 0;
      JSON.parse = function patchedParse(text, ...args) {
        parseCalls += 1;
        return originalParse.call(this, text, ...args);
      };
      const { validator, getCallCount } = createTrackingValidator(noopValidator);
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => { throw new Error('raw reader fail'); },
        validateMigrationManifest: validator
      });
      await assert.rejects(adapter.loadManifest({ targetMigrationId: 'test' }));
      assert.strictEqual(parseCalls, 0);
      assert.strictEqual(getCallCount(), 0);
    });

    it('150. malformed JSON: parse 1, validator 0', async () => {
      let parseCalls = 0;
      JSON.parse = function patchedParse(text, ...args) {
        parseCalls += 1;
        return originalParse.call(this, text, ...args);
      };
      const { validator, getCallCount } = createTrackingValidator(noopValidator);
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => '{ broken json',
        validateMigrationManifest: validator
      });
      await assert.rejects(adapter.loadManifest({ targetMigrationId: 'test' }));
      assert.strictEqual(parseCalls, 1);
      assert.strictEqual(getCallCount(), 0);
    });

    it('151. snapshot invalid (bad status): parse 1, validator 0', async () => {
      let parseCalls = 0;
      JSON.parse = function patchedParse(text, ...args) {
        parseCalls += 1;
        return originalParse.call(this, text, ...args);
      };
      const { validator, getCallCount } = createTrackingValidator(noopValidator);
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => '{"status":"WRONG","migrations":[]}',
        validateMigrationManifest: validator
      });
      await assert.rejects(adapter.loadManifest({ targetMigrationId: 'test' }));
      assert.strictEqual(parseCalls, 1);
      assert.strictEqual(getCallCount(), 0);
    });
  });

  describe('N. Orchestrator compatibility', () => {
    it('116. adapter result accepted as loadManifest dependency', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => adapter.loadManifest(arg),
          acquireAdvisoryLock: () => ({ status: 'NOT_ATTEMPTED' })
        })
      });
      assert.ok(result.events.includes('MANIFEST_LOADED'));
      assert.strictEqual(result.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
    });

    it('117. adapter reader failure blocks at MANIFEST_LOAD with exact blocker', async () => {
      let acquireCalls = 0;
      let readLedgerCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText() {
          throw new Error('raw reader failure');
        }
      });
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => adapter.loadManifest(arg),
          acquireAdvisoryLock: () => { acquireCalls += 1; return { status: 'ACQUIRED', handle: {} }; },
          readLedger: () => { readLedgerCalls += 1; return []; }
        })
      });
      assert.strictEqual(result.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
      assert.strictEqual(result.stage, ORCHESTRATION_STAGES.MANIFEST_LOAD);
      assert.strictEqual(acquireCalls, 0);
      assert.strictEqual(readLedgerCalls, 0);
    });

    it('118. adapter validator failure blocks at MANIFEST_LOAD with exact blocker', async () => {
      let acquireCalls = 0;
      let readLedgerCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: () => { throw new Error('raw validator failure'); }
      });
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => adapter.loadManifest(arg),
          acquireAdvisoryLock: () => { acquireCalls += 1; return { status: 'ACQUIRED', handle: {} }; },
          readLedger: () => { readLedgerCalls += 1; return []; }
        })
      });
      assert.strictEqual(result.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
      assert.strictEqual(result.stage, ORCHESTRATION_STAGES.MANIFEST_LOAD);
      assert.strictEqual(acquireCalls, 0);
      assert.strictEqual(readLedgerCalls, 0);
    });

    it('119. source validation FAIL: loadManifest called 0 times', async () => {
      let loadManifestCalls = 0;
      let acquireCalls = 0;
      await runCanonicalMigration({
        targetMigrationId: 'test',
        requestedAction: 'APPLY_FORWARD',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          validateSource: () => ({ status: 'FAIL' }),
          loadManifest: (arg) => { loadManifestCalls += 1; return { status: 'ADOPTION_REQUIRED', migrations: [] }; },
          acquireAdvisoryLock: () => { acquireCalls += 1; return { status: 'ACQUIRED', handle: {} }; }
        })
      });
      assert.strictEqual(loadManifestCalls, 0);
      assert.strictEqual(acquireCalls, 0);
    });

    it('120. inactive manifest reaches acquireAdvisoryLock exactly once', async () => {
      let acquireCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        requestedAction: 'APPLY_FORWARD',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => adapter.loadManifest(arg),
          acquireAdvisoryLock: () => { acquireCalls += 1; return { status: 'NOT_ATTEMPTED' }; }
        })
      });
      assert.ok(result.events.includes('MANIFEST_LOADED'));
      assert.strictEqual(acquireCalls, 1);
    });

    it('118. adapter rejection blocks at MANIFEST_LOAD', async () => {
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: () => Promise.reject(new Error('rejected'))
        })
      });
      assert.strictEqual(result.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
      assert.strictEqual(result.stage, ORCHESTRATION_STAGES.MANIFEST_LOAD);
    });

    it('119. ACTIVE status proceeds past MANIFEST_LOAD', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      let loadManifestCalls = 0;
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => { loadManifestCalls += 1; return adapter.loadManifest(arg); },
          acquireAdvisoryLock: () => ({ status: 'NOT_ATTEMPTED' })
        })
      });
      assert.strictEqual(loadManifestCalls, 1);
      assert.ok(result.events.includes('MANIFEST_LOADED'));
    });

    it('120. ADOPTION_REQUIRED status proceeds past MANIFEST_LOAD', async () => {
      let acquireCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        requestedAction: 'APPLY_FORWARD',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => adapter.loadManifest(arg),
          acquireAdvisoryLock: () => { acquireCalls += 1; return { status: 'NOT_ATTEMPTED' }; }
        })
      });
      assert.ok(result.events.includes('MANIFEST_LOADED'));
      assert.strictEqual(acquireCalls, 1);
    });

    it('121. adapter frozen result accepted by orchestrator', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => adapter.loadManifest(arg),
          acquireAdvisoryLock: () => ({ status: 'NOT_ATTEMPTED' })
        })
      });
      assert.ok(result.events.includes('MANIFEST_LOADED'));
    });

    it('122. adapter result migrations array accepted by orchestrator', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => adapter.loadManifest(arg),
          acquireAdvisoryLock: () => ({ status: 'NOT_ATTEMPTED' })
        })
      });
      assert.ok(result.events.includes('MANIFEST_LOADED'));
    });

    it('123. adapter result status string accepted by orchestrator', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => adapter.loadManifest(arg),
          acquireAdvisoryLock: () => ({ status: 'NOT_ATTEMPTED' })
        })
      });
      assert.ok(result.events.includes('MANIFEST_LOADED'));
    });

    it('124. adapter called with correct targetMigrationId by orchestrator', async () => {
      let receivedId;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      await runCanonicalMigration({
        targetMigrationId: 'my-special-migration',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => { receivedId = arg.targetMigrationId; return adapter.loadManifest(arg); }
        })
      });
      assert.strictEqual(receivedId, 'my-special-migration');
    });

    it('125. adapter called exactly once during orchestration', async () => {
      let loadManifestCalls = 0;
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => ADOPTION_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => { loadManifestCalls += 1; return adapter.loadManifest(arg); }
        })
      });
      assert.strictEqual(loadManifestCalls, 1);
    });

    it('126. adapter blocks -> no downstream dependencies called', async () => {
      let acquireCalls = 0;
      let readLedgerCalls = 0;
      let executeCalls = 0;
      await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: () => { throw new Error('blocked'); },
          acquireAdvisoryLock: () => { acquireCalls += 1; return { status: 'ACQUIRED', handle: {} }; },
          readLedger: () => { readLedgerCalls += 1; return []; },
          executeMigration: () => { executeCalls += 1; return { executionOutcome: 'SUCCEEDED', transactionOutcome: 'COMMITTED' }; }
        })
      });
      assert.strictEqual(acquireCalls, 0);
      assert.strictEqual(readLedgerCalls, 0);
      assert.strictEqual(executeCalls, 0);
    });

    it('127. full pipeline with adapter -> EXECUTED_AND_RECORDED', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await runCanonicalMigration({
        targetMigrationId: MIGRATION_1_ID,
        requestedAction: 'APPLY_FORWARD',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => adapter.loadManifest(arg),
          acquireAdvisoryLock: () => ({ status: 'ACQUIRED', handle: { id: 'lock-1' } }),
          readLedger: () => [],
          evaluatePrecondition: () => ({ status: 'PASS' }),
          executeMigration: () => ({ executionOutcome: 'SUCCEEDED', transactionOutcome: 'COMMITTED' }),
          evaluatePostcondition: () => ({ status: 'PASS' }),
          checkAdvisoryLock: () => ({ status: 'ACQUIRED' }),
          appendLedgerRecord: () => ({ status: 'APPENDED' }),
          releaseAdvisoryLock: () => ({ status: 'RELEASED' })
        })
      });
      assert.strictEqual(result.outcome, ORCHESTRATION_OUTCOMES.EXECUTED_AND_RECORDED);
    });

    it('128. adapter + executeMigration fail -> COMPLETION_BLOCKED', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await runCanonicalMigration({
        targetMigrationId: MIGRATION_1_ID,
        requestedAction: 'APPLY_FORWARD',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => adapter.loadManifest(arg),
          acquireAdvisoryLock: () => ({ status: 'ACQUIRED', handle: { id: 'lock-1' } }),
          readLedger: () => [],
          evaluatePrecondition: () => ({ status: 'PASS' }),
          executeMigration: () => { throw new Error('exec fail'); },
          evaluatePostcondition: () => ({ status: 'PASS' }),
          checkAdvisoryLock: () => ({ status: 'ACQUIRED' }),
          appendLedgerRecord: () => ({ status: 'APPENDED' }),
          releaseAdvisoryLock: () => ({ status: 'RELEASED' })
        })
      });
      assert.strictEqual(result.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
    });

    it('129. adapter + ledger append fail -> LEDGER_APPEND_FAILED', async () => {
      const adapter = createMigrationCanonicalManifestAdapter({
        readFixedManifestText: () => VALID_MANIFEST_TEXT,
        validateMigrationManifest: noopValidator
      });
      const result = await runCanonicalMigration({
        targetMigrationId: MIGRATION_1_ID,
        requestedAction: 'APPLY_FORWARD',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: (arg) => adapter.loadManifest(arg),
          acquireAdvisoryLock: () => ({ status: 'ACQUIRED', handle: { id: 'lock-1' } }),
          readLedger: () => [],
          evaluatePrecondition: () => ({ status: 'PASS' }),
          executeMigration: () => ({ executionOutcome: 'SUCCEEDED', transactionOutcome: 'COMMITTED' }),
          evaluatePostcondition: () => ({ status: 'PASS' }),
          checkAdvisoryLock: () => ({ status: 'ACQUIRED' }),
          appendLedgerRecord: () => { throw new Error('append fail'); },
          releaseAdvisoryLock: () => ({ status: 'RELEASED' })
        })
      });
      assert.strictEqual(result.outcome, ORCHESTRATION_OUTCOMES.LEDGER_APPEND_FAILED);
    });

    it('130. adapter with default reader + temp repo -> MANIFEST_LOADED event', async () => {
      const { tmpDir, scriptsDir } = buildAdoptionManifestTempRepo();
      try {
        const { createMigrationCanonicalManifestAdapter: create } = loadTempAdapter(scriptsDir);
        const adapter = create();
        const result = await runCanonicalMigration({
          targetMigrationId: 'test',
          runtimeMetadata: MOCK_RUNTIME,
          dependencies: createOrchDeps({
            loadManifest: (arg) => adapter.loadManifest(arg),
            acquireAdvisoryLock: () => ({ status: 'NOT_ATTEMPTED' })
          })
        });
        assert.ok(result.events.includes('MANIFEST_LOADED'));
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    });

    it('131. adapter null result -> BLOCKED', async () => {
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: () => null
        })
      });
      assert.strictEqual(result.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
    });

    it('132. adapter string result -> BLOCKED', async () => {
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: () => 'not an object'
        })
      });
      assert.strictEqual(result.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
    });

    it('133. adapter array result -> BLOCKED', async () => {
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: () => []
        })
      });
      assert.strictEqual(result.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
    });

    it('134. adapter empty status string -> BLOCKED', async () => {
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: () => ({ status: '', migrations: [] })
        })
      });
      assert.strictEqual(result.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
    });

    it('135. adapter result with extra keys -> still accepted', async () => {
      const result = await runCanonicalMigration({
        targetMigrationId: 'test',
        runtimeMetadata: MOCK_RUNTIME,
        dependencies: createOrchDeps({
          loadManifest: () => ({ status: 'ADOPTION_REQUIRED', migrations: [], extra: 'ignored' }),
          acquireAdvisoryLock: () => ({ status: 'NOT_ATTEMPTED' })
        })
      });
      assert.ok(result.events.includes('MANIFEST_LOADED'));
    });
  });
});
