const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CLASSIFICATIONS = Object.freeze([
  'CANONICAL_CANDIDATE',
  'LEGACY_COMPATIBILITY',
  'MANUAL_ONLY',
  'INCIDENT_REPAIR_ONLY',
  'ROLLBACK_ONLY',
  'TEST_FIXTURE_ONLY',
  'DEPRECATED',
  'PROHIBITED_FOR_NEW_USE',
  'UNCLEAR_REQUIRES_DECISION'
]);

const REQUIRED_INVENTORY_FIELDS = Object.freeze([
  'path',
  'operation_class',
  'schema_objects',
  'invocation_path',
  'current_owner_domain',
  'classification',
  'transaction_behavior',
  'idempotency_claim',
  'rollback_claim',
  'production_relevance',
  'evidence',
  'risk',
  'recommended_disposition',
  'linked_issue',
  'baseline_sha',
  'content_checksum'
]);

const REQUIRED_MIGRATION_FIELDS = Object.freeze([
  'id',
  'name',
  'path',
  'checksum',
  'depends_on',
  'risk_class',
  'transaction_mode',
  'expected_preconditions',
  'expected_postconditions',
  'rollback_support',
  'destructive_operations',
  'owner_domain',
  'approval_reference'
]);

const MIGRATION_ID_PATTERN = /^\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SCHEMA_DDL_PATTERN = /\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+(?:TABLE|INDEX|TYPE|SCHEMA|VIEW|MATERIALIZED\s+VIEW|FUNCTION|TRIGGER|POLICY|ROLE)\b/i;
const DESTRUCTIVE_SQL_PATTERN = /\b(?:DROP\s+(?:TABLE|INDEX|COLUMN|CONSTRAINT|FUNCTION|TRIGGER|TYPE)|TRUNCATE\b|ALTER\s+TABLE[\s\S]{0,120}?\bDROP\s+COLUMN|ALTER\s+TABLE[\s\S]{0,120}?\bSET\s+NOT\s+NULL)\b/i;
const SENSITIVE_MARKER_PATTERN = /(?:postgres(?:ql)?:\/\/|(?:api[_-]?key|token|secret|password)\s*[:=]|-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----)/i;

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function arraysMatch(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function resolveRepositoryPath(repoRoot, relativePath) {
  const root = path.resolve(repoRoot);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Path escapes repository root: ${relativePath}`);
  }
  return resolved;
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function discoverRepositoryPaths(repoRoot) {
  const scriptsDirectory = path.join(repoRoot, 'scripts');
  const scriptPaths = fs.existsSync(scriptsDirectory)
    ? fs.readdirSync(scriptsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .filter((entry) => {
        if (/\.sql$/i.test(entry.name)) return true;
        return /^(?:inspect-schema|verify-db|seed-)/i.test(entry.name);
      })
      .map((entry) => normalizePath(path.relative(repoRoot, path.join(scriptsDirectory, entry.name))))
    : [];

  const documentationRoots = [
    path.join(repoRoot, 'docs', 'migration'),
    path.join(repoRoot, 'docs', 'ops'),
    path.join(repoRoot, 'docs', 'product')
  ];
  const documentationPaths = documentationRoots.flatMap((directory) => walkFiles(directory))
    .filter((filePath) => /\.md$/i.test(filePath))
    .filter((filePath) => /\bpsql\b/i.test(fs.readFileSync(filePath, 'utf8')))
    .map((filePath) => normalizePath(path.relative(repoRoot, filePath)));

  const runtimeRoots = [path.join(repoRoot, 'modal_compute'), path.join(repoRoot, 'functions')];
  const runtimeDdlPaths = runtimeRoots.flatMap((directory) => walkFiles(directory))
    .filter((filePath) => /\.(?:py|js|cjs|mjs)$/i.test(filePath))
    .filter((filePath) => SCHEMA_DDL_PATTERN.test(fs.readFileSync(filePath, 'utf8')))
    .map((filePath) => normalizePath(path.relative(repoRoot, filePath)));

  return [...new Set([...scriptPaths, ...documentationPaths, ...runtimeDdlPaths])].sort();
}

function validateInventory(inventory, repoRoot) {
  const errors = [];
  if (!inventory || !Array.isArray(inventory.entries)) {
    return { ok: false, errors: ['INVENTORY_ENTRIES_MISSING'], discoveredPaths: [] };
  }
  if (!Array.isArray(inventory.classification_enum)
    || inventory.classification_enum.length !== CLASSIFICATIONS.length
    || CLASSIFICATIONS.some((classification) => !inventory.classification_enum.includes(classification))) {
    errors.push('INVENTORY_CLASSIFICATION_ENUM_INVALID');
  }

  const inventoryPaths = new Set();
  for (const entry of inventory.entries) {
    for (const field of REQUIRED_INVENTORY_FIELDS) {
      if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
        errors.push(`INVENTORY_FIELD_MISSING:${entry.path || '<unknown>'}:${field}`);
      }
    }
    if (!CLASSIFICATIONS.includes(entry.classification)) {
      errors.push(`INVENTORY_CLASSIFICATION_INVALID:${entry.path || '<unknown>'}`);
    }
    if (!Array.isArray(entry.schema_objects)) {
      errors.push(`INVENTORY_SCHEMA_OBJECTS_INVALID:${entry.path || '<unknown>'}`);
    }
    if (!SHA256_PATTERN.test(entry.content_checksum || '')) {
      errors.push(`INVENTORY_CHECKSUM_INVALID:${entry.path || '<unknown>'}`);
    }
    if (!/^[a-f0-9]{40}$/.test(entry.baseline_sha || '')) {
      errors.push(`INVENTORY_BASELINE_INVALID:${entry.path || '<unknown>'}`);
    }
    if (inventoryPaths.has(entry.path)) {
      errors.push(`INVENTORY_PATH_DUPLICATE:${entry.path}`);
    }
    inventoryPaths.add(entry.path);

    try {
      const sourcePath = resolveRepositoryPath(repoRoot, entry.path);
      if (!fs.existsSync(sourcePath)) {
        errors.push(`INVENTORY_PATH_MISSING:${entry.path}`);
      } else if (SHA256_PATTERN.test(entry.content_checksum || '') && sha256File(sourcePath) !== entry.content_checksum) {
        errors.push(`INVENTORY_CHECKSUM_MISMATCH:${entry.path}`);
      }
    } catch (error) {
      errors.push(`INVENTORY_PATH_UNSAFE:${entry.path}`);
    }
  }

  const discoveredPaths = discoverRepositoryPaths(repoRoot);
  for (const discoveredPath of discoveredPaths) {
    if (!inventoryPaths.has(discoveredPath)) {
      errors.push(`INVENTORY_PATH_UNCLASSIFIED:${discoveredPath}`);
    }
  }

  const rawInventory = JSON.stringify(inventory);
  if (SENSITIVE_MARKER_PATTERN.test(rawInventory)) {
    errors.push('INVENTORY_SENSITIVE_MARKER_DETECTED');
  }

  return { ok: errors.length === 0, errors, discoveredPaths };
}

function validateMigrationManifest(manifest, repoRoot) {
  const errors = [];
  if (!manifest || !Array.isArray(manifest.migrations)) {
    return { ok: false, errors: ['MIGRATION_MANIFEST_MISSING'], migrations: [] };
  }
  if (manifest.status !== 'ADOPTION_REQUIRED' && manifest.status !== 'ACTIVE') {
    errors.push('MIGRATION_MANIFEST_STATUS_INVALID');
  }
  if (!manifest.canonical_directory) {
    errors.push('MIGRATION_CANONICAL_DIRECTORY_MISSING');
  } else {
    try {
      const canonicalDirectory = resolveRepositoryPath(repoRoot, manifest.canonical_directory);
      if (!fs.existsSync(canonicalDirectory) || !fs.statSync(canonicalDirectory).isDirectory()) {
        errors.push('MIGRATION_CANONICAL_DIRECTORY_UNAVAILABLE');
      }
    } catch (error) {
      errors.push('MIGRATION_CANONICAL_DIRECTORY_UNSAFE');
    }
  }
  if (!manifest.ledger || !Array.isArray(manifest.ledger.required_record_fields)) {
    errors.push('MIGRATION_LEDGER_CONTRACT_MISSING');
  } else if (!manifest.ledger.contract_path) {
    errors.push('MIGRATION_LEDGER_CONTRACT_PATH_MISSING');
  } else {
    try {
      const ledgerContractPath = resolveRepositoryPath(repoRoot, manifest.ledger.contract_path);
      const ledgerContract = loadJson(ledgerContractPath);
      if (!arraysMatch(manifest.ledger.required_record_fields, ledgerContract.required_record_fields)) {
        errors.push('MIGRATION_LEDGER_CONTRACT_MISMATCH');
      }
    } catch (error) {
      errors.push('MIGRATION_LEDGER_CONTRACT_UNAVAILABLE');
    }
  }

  const migrationIds = new Set();
  for (const migration of manifest.migrations) {
    for (const field of REQUIRED_MIGRATION_FIELDS) {
      if (migration[field] === undefined || migration[field] === null) {
        errors.push(`MIGRATION_FIELD_MISSING:${migration.id || '<unknown>'}:${field}`);
      }
    }
    if (!MIGRATION_ID_PATTERN.test(migration.id || '')) {
      errors.push(`MIGRATION_ID_INVALID:${migration.id || '<unknown>'}`);
    }
    if (migrationIds.has(migration.id)) {
      errors.push(`MIGRATION_ID_DUPLICATE:${migration.id}`);
    }
    migrationIds.add(migration.id);
    if (!SHA256_PATTERN.test(migration.checksum || '')) {
      errors.push(`MIGRATION_CHECKSUM_INVALID:${migration.id || '<unknown>'}`);
    }
    if (!Array.isArray(migration.depends_on) || !Array.isArray(migration.destructive_operations)) {
      errors.push(`MIGRATION_ARRAY_FIELD_INVALID:${migration.id || '<unknown>'}`);
    }
    if (!['ADDITIVE', 'COMPATIBILITY', 'DESTRUCTIVE', 'ADOPTION'].includes(migration.risk_class)) {
      errors.push(`MIGRATION_RISK_CLASS_INVALID:${migration.id || '<unknown>'}`);
    }
    if (!['REQUIRED', 'PROHIBITED', 'EXPLICIT'].includes(migration.transaction_mode)) {
      errors.push(`MIGRATION_TRANSACTION_MODE_INVALID:${migration.id || '<unknown>'}`);
    }
    if (migration.destructive_operations.length > 0 && (!migration.approval_reference || migration.risk_class !== 'DESTRUCTIVE')) {
      errors.push(`MIGRATION_DESTRUCTIVE_APPROVAL_MISSING:${migration.id || '<unknown>'}`);
    }
    try {
      const sourcePath = resolveRepositoryPath(repoRoot, migration.path);
      if (!fs.existsSync(sourcePath)) {
        errors.push(`MIGRATION_SOURCE_MISSING:${migration.path}`);
      } else {
        const source = fs.readFileSync(sourcePath, 'utf8');
        if (sha256(source) !== migration.checksum) {
          errors.push(`MIGRATION_SOURCE_CHECKSUM_MISMATCH:${migration.id}`);
        }
        if (DESTRUCTIVE_SQL_PATTERN.test(source) && migration.destructive_operations.length === 0) {
          errors.push(`MIGRATION_DESTRUCTIVE_OPERATION_UNDECLARED:${migration.id}`);
        }
      }
    } catch (error) {
      errors.push(`MIGRATION_SOURCE_UNSAFE:${migration.path || '<unknown>'}`);
    }
  }

  return { ok: errors.length === 0, errors, migrations: manifest.migrations };
}

function validateExpectedSchemaManifest(manifest) {
  const errors = [];
  if (!manifest || !Array.isArray(manifest.critical_objects)) {
    return { ok: false, errors: ['EXPECTED_SCHEMA_MANIFEST_MISSING'] };
  }
  if (!['ADOPTION_REQUIRED', 'ACTIVE'].includes(manifest.status)) {
    errors.push('EXPECTED_SCHEMA_STATUS_INVALID');
  }
  for (const object of manifest.critical_objects) {
    if (!object.name || !SHA256_PATTERN.test(object.fingerprint || '')) {
      errors.push(`EXPECTED_SCHEMA_OBJECT_INVALID:${object.name || '<unknown>'}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function validateSourceConfiguration({ repoRoot, inventory, migrationManifest, expectedSchemaManifest }) {
  const inventoryResult = validateInventory(inventory, repoRoot);
  const migrationResult = validateMigrationManifest(migrationManifest, repoRoot);
  const schemaResult = validateExpectedSchemaManifest(expectedSchemaManifest);
  const errors = [...inventoryResult.errors, ...migrationResult.errors, ...schemaResult.errors];
  return {
    ok: errors.length === 0,
    errors,
    summary: {
      inventory_rows: Array.isArray(inventory.entries) ? inventory.entries.length : 0,
      discovered_paths: inventoryResult.discoveredPaths.length,
      canonical_migrations: migrationResult.migrations.length,
      expected_schema_objects: Array.isArray(expectedSchemaManifest.critical_objects)
        ? expectedSchemaManifest.critical_objects.length
        : 0
    }
  };
}

function compareLedger(expectedMigrations, ledgerEvidence) {
  const blockers = [];
  if (!ledgerEvidence || !Array.isArray(ledgerEvidence.applied_migrations)) {
    return ['GATE_LEDGER_EVIDENCE_UNAVAILABLE'];
  }
  const expectedById = new Map(expectedMigrations.map((migration, index) => [migration.id, { migration, index }]));
  const appliedIds = new Set();
  ledgerEvidence.applied_migrations.forEach((applied, index) => {
    if (!applied || !applied.id || !SHA256_PATTERN.test(applied.checksum || '')) {
      blockers.push('GATE_LEDGER_RECORD_INVALID');
      return;
    }
    if (appliedIds.has(applied.id)) blockers.push(`GATE_DUPLICATE_APPLIED_MIGRATION:${applied.id}`);
    appliedIds.add(applied.id);
    const expected = expectedById.get(applied.id);
    if (!expected) {
      blockers.push(`GATE_UNKNOWN_APPLIED_MIGRATION:${applied.id}`);
      return;
    }
    if (expected.migration.checksum !== applied.checksum) {
      blockers.push(`GATE_EDITED_MIGRATION:${applied.id}`);
    }
    if (expected.index !== index) {
      blockers.push(`GATE_REORDERED_MIGRATION:${applied.id}`);
    }
  });
  for (const migration of expectedMigrations) {
    if (!appliedIds.has(migration.id)) blockers.push(`GATE_MISSING_APPLIED_MIGRATION:${migration.id}`);
  }
  return blockers;
}

function compareSchema(expectedSchemaManifest, catalogEvidence) {
  if (!catalogEvidence || !Array.isArray(catalogEvidence.objects)) {
    return ['GATE_CATALOG_EVIDENCE_UNAVAILABLE'];
  }
  const blockers = [];
  const expectedByName = new Map(expectedSchemaManifest.critical_objects.map((object) => [object.name, object]));
  const catalogNames = new Set();
  for (const object of catalogEvidence.objects) {
    if (!object || !object.name || !SHA256_PATTERN.test(object.fingerprint || '')) {
      blockers.push('GATE_CATALOG_RECORD_INVALID');
      continue;
    }
    catalogNames.add(object.name);
    const expected = expectedByName.get(object.name);
    if (!expected) {
      blockers.push(`GATE_UNEXPECTED_SCHEMA_OBJECT:${object.name}`);
    } else if (expected.fingerprint !== object.fingerprint) {
      blockers.push(`GATE_SCHEMA_FINGERPRINT_MISMATCH:${object.name}`);
    }
  }
  for (const object of expectedSchemaManifest.critical_objects) {
    if (!catalogNames.has(object.name)) blockers.push(`GATE_MISSING_SCHEMA_OBJECT:${object.name}`);
  }
  return blockers;
}

function evaluateProvenance({ migrationManifest, expectedSchemaManifest, ledgerEvidence, catalogEvidence }) {
  const blockers = [];
  if (migrationManifest.status !== 'ACTIVE' || expectedSchemaManifest.status !== 'ACTIVE') {
    blockers.push('GATE_ADOPTION_BASELINE_REQUIRED');
  }
  if (!ledgerEvidence || ledgerEvidence.adoption_status !== 'ATTESTED') {
    blockers.push('GATE_ADOPTION_EVIDENCE_UNAVAILABLE');
  }
  blockers.push(...compareLedger(migrationManifest.migrations, ledgerEvidence));
  blockers.push(...compareSchema(expectedSchemaManifest, catalogEvidence));
  const uniqueBlockers = [...new Set(blockers)].sort();
  return {
    decision: uniqueBlockers.length === 0 ? 'PASS' : 'FAIL_CLOSED',
    blockers: uniqueBlockers,
    summary: {
      expected_migrations: migrationManifest.migrations.length,
      applied_migrations: Array.isArray(ledgerEvidence?.applied_migrations) ? ledgerEvidence.applied_migrations.length : 0,
      expected_schema_objects: expectedSchemaManifest.critical_objects.length,
      observed_schema_objects: Array.isArray(catalogEvidence?.objects) ? catalogEvidence.objects.length : 0
    }
  };
}

module.exports = {
  CLASSIFICATIONS,
  REQUIRED_INVENTORY_FIELDS,
  REQUIRED_MIGRATION_FIELDS,
  SHA256_PATTERN,
  sha256,
  sha256File,
  loadJson,
  discoverRepositoryPaths,
  validateInventory,
  validateMigrationManifest,
  validateExpectedSchemaManifest,
  validateSourceConfiguration,
  evaluateProvenance
};
