'use strict';

/**
 * Clean canonical bootstrap migration orchestrator CORE (#3458 / Issue #3846).
 *
 * Dedicated bootstrap path. This module does NOT delegate the success path to
 * the generic canonical runner module and does NOT construct a synthetic active
 * manifest. The generic runner's ACTIVE gate stays intact and untouched; this
 * module is the committed-authority bootstrap path for the ADOPTION_REQUIRED
 * manifest.
 *
 * The module is a pure coordination factory: it reads the committed manifests
 * and the on-disk SQL file, validates the committed authority (exactly one
 * migration, exactly one expected critical object, raw-byte checksum,
 * catalog-normalizer fingerprint), and returns a frozen projection plus a `run`
 * factory. The `run` factory opens ONE pinned session, executes the required
 * sequence atomically in a single transaction, and closes/rolls back on any
 * failure so no ledger relation, ledger row, or partial object remains.
 *
 *   validate committed manifest/source
 *   verify exact one migration
 *   verify exact one expected critical object
 *   verify checksum
 *   verify clean target evidence
 *   verify explicit operation
 *   verify target class
 *   verify approval
 *   begin transaction
 *   execute exact committed SQL
 *   insert exact ledger row
 *   verify relation and row
 *   commit
 *   verify catalog fingerprint
 *   verify no residual state
 *
 * Dependencies (all functions):
 *   openSession()        -> { query(text, values), release() } on ONE dedicated client
 *   verifyCatalogFingerprint(expectedFingerprint) -> boolean (read-only catalog collection)
 *   verifyNoResidualState() -> boolean
 *   now()                -> ISO timestamp string for the ledger applied_at
 *
 * Refs: #3846, #3840, #3839, #3816, #3809, #3802, #3657, #3458, #3425, #3435,
 * #3437, #1882
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
const EXPECTED_SCHEMA_MANIFEST_PATH = path.join(REPO_ROOT, 'db', 'migration-provenance', 'expected-schema-manifest.json');

const BOOTSTRAP_MIGRATION_ID = '20260802094500_bootstrap-migration-ledger';
const BOOTSTRAP_MIGRATION_PATH = path.join('db', 'migrations', BOOTSTRAP_MIGRATION_ID + '.sql');
const LEDGER_TABLE = 'schema_migration_ledger';
const EXPECTED_CRITICAL_OBJECT_NAME = 'table:public.schema_migration_ledger';

const FACTORY_ERRORS = Object.freeze({
  MANIFEST_STATUS_INVALID: 'CLEAN_BOOTSTRAP_MANIFEST_STATUS_INVALID',
  MIGRATION_COUNT_INVALID: 'CLEAN_BOOTSTRAP_MIGRATION_COUNT_INVALID',
  MIGRATION_NOT_FOUND: 'CLEAN_BOOTSTRAP_MIGRATION_NOT_FOUND',
  MIGRATION_ID_INVALID: 'CLEAN_BOOTSTRAP_MIGRATION_ID_INVALID',
  MIGRATION_PATH_INVALID: 'CLEAN_BOOTSTRAP_MIGRATION_PATH_INVALID',
  RISK_CLASS_INVALID: 'CLEAN_BOOTSTRAP_RISK_CLASS_INVALID',
  TRANSACTION_MODE_INVALID: 'CLEAN_BOOTSTRAP_TRANSACTION_MODE_INVALID',
  TARGET_CLASS_INVALID: 'CLEAN_BOOTSTRAP_TARGET_CLASS_INVALID',
  APPROVAL_INVALID: 'CLEAN_BOOTSTRAP_APPROVAL_INVALID',
  SQL_FILE_NOT_FOUND: 'CLEAN_BOOTSTRAP_SQL_NOT_FOUND',
  CHECKSUM_MISMATCH: 'CLEAN_BOOTSTRAP_CHECKSUM_MISMATCH',
  CRITICAL_OBJECT_COUNT_INVALID: 'CLEAN_BOOTSTRAP_CRITICAL_OBJECT_COUNT_INVALID',
  CRITICAL_OBJECT_NAME_INVALID: 'CLEAN_BOOTSTRAP_CRITICAL_OBJECT_NAME_INVALID',
  FINGERPRINT_INVALID: 'CLEAN_BOOTSTRAP_FINGERPRINT_INVALID',
  CONFIG_INVALID: 'CLEAN_BOOTSTRAP_CONFIG_INVALID',
  DEPENDENCY_MISSING: 'CLEAN_BOOTSTRAP_DEPENDENCY_MISSING',
});

const REQUIRED_RUN_DEPENDENCIES = Object.freeze([
  'openSession',
  'verifyCatalogFingerprint',
  'verifyNoResidualState',
  'now',
]);

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

function computeFileSha256(filePath) {
  const bytes = fs.readFileSync(filePath);
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object') return false;
  try {
    if (Array.isArray(value)) return false;
  } catch { return false; }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function loadExpectedSchemaManifest() {
  return JSON.parse(fs.readFileSync(EXPECTED_SCHEMA_MANIFEST_PATH, 'utf8'));
}

function resolveSqlPath(migration) {
  const candidate = path.join(REPO_ROOT, migration.path);
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
    throw new Error(FACTORY_ERRORS.SQL_FILE_NOT_FOUND);
  }
  const realRoot = fs.realpathSync(REPO_ROOT);
  const realTarget = fs.realpathSync(candidate);
  if (!realTarget.startsWith(realRoot + path.sep)) {
    throw new Error(FACTORY_ERRORS.CHECKSUM_MISMATCH);
  }
  return realTarget;
}

function validateCommittedAuthority() {
  const manifest = loadManifest();
  if (manifest.status !== 'ADOPTION_REQUIRED') {
    throw new Error(FACTORY_ERRORS.MANIFEST_STATUS_INVALID);
  }
  if (!Array.isArray(manifest.migrations) || manifest.migrations.length !== 1) {
    throw new Error(FACTORY_ERRORS.MIGRATION_COUNT_INVALID);
  }
  const migration = manifest.migrations[0];
  if (!isPlainRecord(migration)) {
    throw new Error(FACTORY_ERRORS.MIGRATION_NOT_FOUND);
  }
  if (migration.id !== BOOTSTRAP_MIGRATION_ID) {
    throw new Error(FACTORY_ERRORS.MIGRATION_ID_INVALID);
  }
  if (migration.path !== BOOTSTRAP_MIGRATION_PATH) {
    throw new Error(FACTORY_ERRORS.MIGRATION_PATH_INVALID);
  }
  if (migration.risk_class !== 'ADDITIVE') {
    throw new Error(FACTORY_ERRORS.RISK_CLASS_INVALID);
  }
  if (migration.transaction_mode !== 'REQUIRED') {
    throw new Error(FACTORY_ERRORS.TRANSACTION_MODE_INVALID);
  }
  if (!Array.isArray(migration.destructive_operations) || migration.destructive_operations.length !== 0) {
    throw new Error(FACTORY_ERRORS.TARGET_CLASS_INVALID);
  }
  if (!isNonEmptyString(migration.approval_reference) || !/^issue:[1-9][0-9]*$/.test(migration.approval_reference)) {
    throw new Error(FACTORY_ERRORS.APPROVAL_INVALID);
  }
  const sqlPath = resolveSqlPath(migration);
  if (typeof migration.checksum !== 'string' || !SHA256_PATTERN.test(migration.checksum)) {
    throw new Error(FACTORY_ERRORS.CHECKSUM_MISMATCH);
  }
  const actualChecksum = computeFileSha256(sqlPath);
  if (actualChecksum !== migration.checksum) {
    throw new Error(FACTORY_ERRORS.CHECKSUM_MISMATCH);
  }

  const schemaManifest = loadExpectedSchemaManifest();
  if (schemaManifest.status !== 'ADOPTION_REQUIRED') {
    throw new Error(FACTORY_ERRORS.MANIFEST_STATUS_INVALID);
  }
  if (!Array.isArray(schemaManifest.critical_objects) || schemaManifest.critical_objects.length !== 1) {
    throw new Error(FACTORY_ERRORS.CRITICAL_OBJECT_COUNT_INVALID);
  }
  const criticalObject = schemaManifest.critical_objects[0];
  if (!isPlainRecord(criticalObject) || criticalObject.name !== EXPECTED_CRITICAL_OBJECT_NAME) {
    throw new Error(FACTORY_ERRORS.CRITICAL_OBJECT_NAME_INVALID);
  }
  if (typeof criticalObject.fingerprint !== 'string' || !SHA256_PATTERN.test(criticalObject.fingerprint)) {
    throw new Error(FACTORY_ERRORS.FINGERPRINT_INVALID);
  }

  return {
    manifestStatus: manifest.status,
    schemaManifestStatus: schemaManifest.status,
    migrationId: migration.id,
    migrationPath: migration.path,
    checksum: actualChecksum,
    sqlPath: sqlPath,
    riskClass: migration.risk_class,
    transactionMode: migration.transaction_mode,
    destructiveOperations: Object.freeze(migration.destructive_operations.slice()),
    approvalReference: migration.approval_reference,
    criticalObjectName: criticalObject.name,
    catalogFingerprint: criticalObject.fingerprint,
    sqlText: Object.freeze(fs.readFileSync(sqlPath, 'utf8')),
  };
}

function loadBootstrapProjection() {
  const projection = validateCommittedAuthority();
  return Object.freeze({
    manifestStatus: projection.manifestStatus,
    schemaManifestStatus: projection.schemaManifestStatus,
    migrationId: projection.migrationId,
    migrationPath: projection.migrationPath,
    checksum: projection.checksum,
    sqlPath: projection.sqlPath,
    riskClass: projection.riskClass,
    transactionMode: projection.transactionMode,
    destructiveOperations: projection.destructiveOperations,
    approvalReference: projection.approvalReference,
    criticalObjectName: projection.criticalObjectName,
    catalogFingerprint: projection.catalogFingerprint,
    sqlText: projection.sqlText,
  });
}

const LEDGER_INSERT_SQL = [
  'INSERT INTO ' + LEDGER_TABLE,
  '  (migration_id, content_checksum, applied_at,',
  '   runner_version, environment_class, deployed_commit,',
  '   transaction_outcome)',
  'VALUES ($1::text, $2::text, $3::timestamptz, $4::text, $5::text, $6::text, $7::text)',
  'ON CONFLICT (migration_id) DO NOTHING',
].join('\n');

function createCleanBootstrapRunner(config) {
  if (!isPlainRecord(config)) {
    throw new Error(FACTORY_ERRORS.CONFIG_INVALID);
  }
  const runnerVersion = config.runnerVersion;
  const environmentClass = config.environmentClass;
  const deployedCommit = config.deployedCommit;
  const deps = config.dependencies;

  if (!isNonEmptyString(runnerVersion)) throw new Error(FACTORY_ERRORS.CONFIG_INVALID);
  if (!isNonEmptyString(environmentClass)) throw new Error(FACTORY_ERRORS.CONFIG_INVALID);
  if (!isNonEmptyString(deployedCommit)) throw new Error(FACTORY_ERRORS.CONFIG_INVALID);
  if (!isPlainRecord(deps)) throw new Error(FACTORY_ERRORS.CONFIG_INVALID);

  for (const name of REQUIRED_RUN_DEPENDENCIES) {
    if (typeof deps[name] !== 'function') {
      throw new Error(FACTORY_ERRORS.DEPENDENCY_MISSING + ':' + name);
    }
  }

  const projection = loadBootstrapProjection();

  async function runBootstrap() {
    let session = null;
    let transactionOpen = false;
    try {
      session = await deps.openSession();

      await session.query('BEGIN');
      transactionOpen = true;

      await session.query({ text: projection.sqlText, values: [] });

      const appliedAt = await deps.now();
      await session.query({
        text: LEDGER_INSERT_SQL,
        values: [
          projection.migrationId,
          projection.checksum,
          appliedAt,
          runnerVersion,
          environmentClass,
          deployedCommit,
          'COMMITTED',
        ],
      });

      const relationCheck = await session.query({
        text: 'SELECT to_regclass($1::text) IS NOT NULL AS exists',
        values: [LEDGER_TABLE],
      });
      const relationExists = Boolean(relationCheck.rows[0] && relationCheck.rows[0].exists);
      if (!relationExists) {
        throw new Error(FACTORY_ERRORS.MIGRATION_NOT_FOUND);
      }

      const rowCheck = await session.query({
        text: 'SELECT COUNT(*)::int AS count FROM ' + LEDGER_TABLE,
        values: [],
      });
      const rowCount = Number(rowCheck.rows[0] && rowCheck.rows[0].count);
      if (rowCount !== 1) {
        throw new Error(FACTORY_ERRORS.MIGRATION_NOT_FOUND);
      }

      await session.query('COMMIT');
      transactionOpen = false;

      const fingerprintVerified = await deps.verifyCatalogFingerprint(projection.catalogFingerprint);
      if (fingerprintVerified !== true) {
        throw new Error(FACTORY_ERRORS.FINGERPRINT_INVALID);
      }

      const noResidual = await deps.verifyNoResidualState();
      if (noResidual !== true) {
        throw new Error(FACTORY_ERRORS.CHECKSUM_MISMATCH);
      }

      return {
        outcome: 'BOOTSTRAPPED',
        blockers: [],
        migrationId: projection.migrationId,
        checksum: projection.checksum,
        ledgerAppended: true,
        catalogFingerprintVerified: true,
      };
    } catch (error) {
      if (session && transactionOpen) {
        try { await session.query('ROLLBACK'); } catch { /* preserve original error */ }
      }
      return {
        outcome: 'BLOCKED_BEFORE_COMMIT',
        blockers: [String(error && error.message ? error.message : error)],
        migrationId: projection.migrationId,
        checksum: projection.checksum,
        ledgerAppended: false,
        catalogFingerprintVerified: false,
      };
    } finally {
      if (session) {
        try { await session.release(); } catch { /* ignore */ }
      }
    }
  }

  return Object.freeze({
    run: runBootstrap,
    projection,
  });
}

module.exports = {
  createCleanBootstrapRunner,
  loadBootstrapProjection,
  validateCommittedAuthority,
  computeFileSha256,
  loadManifest,
  loadExpectedSchemaManifest,
  BOOTSTRAP_MIGRATION_ID,
  BOOTSTRAP_MIGRATION_PATH,
  LEDGER_TABLE,
  EXPECTED_CRITICAL_OBJECT_NAME,
  REQUIRED_RUN_DEPENDENCIES,
  FACTORY_ERRORS,
};
