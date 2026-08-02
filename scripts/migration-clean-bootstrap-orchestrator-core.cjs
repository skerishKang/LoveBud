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
 * factory. The `run` factory opens ONE pinned session, validates config and
 * clean-target evidence, executes the required sequence atomically in a single
 * transaction, and closes/rolls back on any pre-commit failure so no ledger
 * relation, ledger row, or partial object remains. Post-commit verification
 * failures are reported truthfully as COMMITTED_POST_VERIFICATION_FAILED.
 *
 *   validate config
 *   validate committed manifest/source
 *   validate exact operation
 *   validate exact target class
 *   validate exact approval
 *   open one pinned session
 *   verify clean target evidence
 *   BEGIN
 *   execute exact committed SQL
 *   insert exact ledger row
 *   verify relation and row
 *   COMMIT
 *   verify catalog fingerprint
 *   verify post-commit residual state
 *
 * Dependencies (all functions):
 *   openSession()        -> { query(text, values), release() } on ONE dedicated client
 *   verifyCatalogFingerprint(expectedFingerprint) -> boolean (read-only catalog collection)
 *   verifyNoResidualState() -> boolean
 *   verifyCleanTarget(session, projection) -> boolean
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
  OPERATION_INVALID: 'OPERATION_INVALID',
  CLEAN_TARGET_VERIFICATION_FAILED: 'CLEAN_TARGET_VERIFICATION_FAILED',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  LEDGER_VERIFICATION_FAILED: 'LEDGER_VERIFICATION_FAILED',
  CATALOG_FINGERPRINT_POST_COMMIT_FAILED: 'CATALOG_FINGERPRINT_POST_COMMIT_FAILED',
  RESIDUAL_STATE_POST_COMMIT_FAILED: 'RESIDUAL_STATE_POST_COMMIT_FAILED',
});

const REQUIRED_RUN_DEPENDENCIES = Object.freeze([
  'openSession',
  'verifyCatalogFingerprint',
  'verifyNoResidualState',
  'verifyCleanTarget',
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

const ALLOWED_CONFIG_KEYS = Object.freeze([
  'runnerVersion',
  'environmentClass',
  'deployedCommit',
  'operation',
  'targetClass',
  'approvalReference',
  'dependencies',
]);

const ALLOWED_DEPENDENCY_KEYS = Object.freeze([
  'openSession',
  'verifyCleanTarget',
  'verifyCatalogFingerprint',
  'verifyNoResidualState',
  'now',
]);

function readRequiredOwnEnumerableDataProperty(object, key, errorCode) {
  if (object === null || typeof object !== 'object') {
    throw new Error(errorCode || FACTORY_ERRORS.CONFIG_INVALID);
  }
  let proto;
  try {
    proto = Object.getPrototypeOf(object);
  } catch {
    throw new Error(FACTORY_ERRORS.PROXY_OR_ACCESSOR_INPUT);
  }
  if (proto !== Object.prototype && proto !== null) {
    throw new Error(errorCode || FACTORY_ERRORS.CONFIG_INVALID);
  }
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(object, key);
  } catch {
    throw new Error(FACTORY_ERRORS.PROXY_OR_ACCESSOR_INPUT);
  }
  if (!descriptor) {
    throw new Error(errorCode || FACTORY_ERRORS.CONFIG_INVALID);
  }
  if (typeof descriptor.get === 'function' || typeof descriptor.set === 'function') {
    throw new Error(FACTORY_ERRORS.PROXY_OR_ACCESSOR_INPUT);
  }
  if (descriptor.enumerable !== true) {
    throw new Error(errorCode || FACTORY_ERRORS.CONFIG_INVALID);
  }
  if (!('value' in descriptor)) {
    throw new Error(errorCode || FACTORY_ERRORS.CONFIG_INVALID);
  }
  if (descriptor.value === undefined || descriptor.value === null) {
    throw new Error(errorCode || FACTORY_ERRORS.CONFIG_INVALID);
  }
  return descriptor.value;
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
  const projection = loadBootstrapProjection();

  async function runBootstrap() {
      let session = null;
      let transactionOpen = false;
      let committed = false;
      let fingerprintVerified = false;
      try {
        if (!isPlainRecord(config)) {
          throw new Error(FACTORY_ERRORS.CONFIG_INVALID);
        }
        let configKeys;
        try {
          configKeys = Object.keys(config);
        } catch {
          throw new Error(FACTORY_ERRORS.CONFIG_INVALID);
        }
        if (configKeys.length !== ALLOWED_CONFIG_KEYS.length || !configKeys.every(function (k) { return ALLOWED_CONFIG_KEYS.includes(k); })) {
          throw new Error(FACTORY_ERRORS.CONFIG_INVALID);
        }
        const runnerVersion = readRequiredOwnEnumerableDataProperty(config, 'runnerVersion');
        const environmentClass = readRequiredOwnEnumerableDataProperty(config, 'environmentClass');
        const deployedCommit = readRequiredOwnEnumerableDataProperty(config, 'deployedCommit');
        const deps = readRequiredOwnEnumerableDataProperty(config, 'dependencies');

        if (!isNonEmptyString(runnerVersion)) throw new Error(FACTORY_ERRORS.CONFIG_INVALID);
        if (!isNonEmptyString(environmentClass)) throw new Error(FACTORY_ERRORS.CONFIG_INVALID);
        if (!isNonEmptyString(deployedCommit)) throw new Error(FACTORY_ERRORS.CONFIG_INVALID);
        if (!isPlainRecord(deps)) throw new Error(FACTORY_ERRORS.CONFIG_INVALID);

        let depKeys;
        try {
          depKeys = Object.keys(deps);
        } catch {
          throw new Error(FACTORY_ERRORS.DEPENDENCY_MISSING);
        }
        if (depKeys.length !== ALLOWED_DEPENDENCY_KEYS.length || !depKeys.every(function (k) { return ALLOWED_DEPENDENCY_KEYS.includes(k); })) {
          throw new Error(FACTORY_ERRORS.DEPENDENCY_MISSING);
        }

        for (const name of REQUIRED_RUN_DEPENDENCIES) {
          const depFn = readRequiredOwnEnumerableDataProperty(deps, name, FACTORY_ERRORS.DEPENDENCY_MISSING);
          if (typeof depFn !== 'function') {
            throw new Error(FACTORY_ERRORS.DEPENDENCY_MISSING);
          }
        }

        const operation = readRequiredOwnEnumerableDataProperty(config, 'operation');
        if (operation !== 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER') {
          throw new Error(FACTORY_ERRORS.OPERATION_INVALID);
        }
        const targetClass = readRequiredOwnEnumerableDataProperty(config, 'targetClass');
        if (targetClass !== 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET') {
          throw new Error(FACTORY_ERRORS.TARGET_CLASS_INVALID);
        }
        const approvalReference = readRequiredOwnEnumerableDataProperty(config, 'approvalReference');
        if (approvalReference !== 'issue:3846') {
          throw new Error(FACTORY_ERRORS.APPROVAL_INVALID);
        }

        session = await deps.openSession();

        const cleanTargetResult = await deps.verifyCleanTarget(session, projection);
        if (cleanTargetResult !== true) {
          throw new Error(FACTORY_ERRORS.CLEAN_TARGET_VERIFICATION_FAILED);
        }

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
          throw new Error(FACTORY_ERRORS.LEDGER_VERIFICATION_FAILED);
        }

        const rowCheck = await session.query({
          text: 'SELECT COUNT(*)::int AS count FROM ' + LEDGER_TABLE,
          values: [],
        });
        const rowCount = Number(rowCheck.rows[0] && rowCheck.rows[0].count);
        if (rowCount !== 1) {
          throw new Error(FACTORY_ERRORS.LEDGER_VERIFICATION_FAILED);
        }

        await session.query('COMMIT');
        transactionOpen = false;
        committed = true;

        const fpResult = await deps.verifyCatalogFingerprint(projection.catalogFingerprint);
        if (fpResult !== true) {
          throw new Error(FACTORY_ERRORS.CATALOG_FINGERPRINT_POST_COMMIT_FAILED);
        }
        fingerprintVerified = true;

        const noResidual = await deps.verifyNoResidualState();
        if (noResidual !== true) {
          throw new Error(FACTORY_ERRORS.RESIDUAL_STATE_POST_COMMIT_FAILED);
        }

        return {
          outcome: 'BOOTSTRAPPED',
          blockers: [],
          migrationId: projection.migrationId,
          checksum: projection.checksum,
          ledgerAppended: true,
          catalogFingerprintVerified: true,
          postCommitResidualVerified: true,
        };
      } catch (error) {
        const sanitizedCode = Object.values(FACTORY_ERRORS).includes(error && error.message)
          ? error.message
          : FACTORY_ERRORS.TRANSACTION_FAILED;
        if (session && transactionOpen) {
          try { await session.query('ROLLBACK'); } catch { /* preserve original error */ }
        }
        return {
          outcome: committed ? 'COMMITTED_POST_VERIFICATION_FAILED' : 'BLOCKED_BEFORE_COMMIT',
          blockers: [sanitizedCode],
          migrationId: projection.migrationId,
          checksum: projection.checksum,
          ledgerAppended: committed,
          catalogFingerprintVerified: fingerprintVerified,
          postCommitResidualVerified: false,
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
