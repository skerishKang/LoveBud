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
const DOC_OPERATOR_PATTERN = /\b(?:ON_ERROR_STOP|migration-[\w.-]+\.sql|-f\s+scripts\/|pg_dump[\s\S]{0,160}--(?:schema-only|table=)|BEGIN\s+TRANSACTION|psql\s+["'$]|pg_dump\s+["'$])/i;

function normalizePath(filePath) {
  return String(filePath || '').split(path.sep).join('/').replace(/^\.?\//, '');
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
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function discoverRepositoryPaths(repoRoot) {
  const scriptsDirectory = path.join(repoRoot, 'scripts');
  const scriptPaths = walkFiles(scriptsDirectory)
    .filter((filePath) => {
      const base = path.basename(filePath);
      if (/\.sql$/i.test(base)) return true;
      return /^(?:inspect-schema|verify-db|seed-)/i.test(base);
    })
    .map((filePath) => normalizePath(path.relative(repoRoot, filePath)));

  const documentationRoots = [
    path.join(repoRoot, 'docs', 'migration'),
    path.join(repoRoot, 'docs', 'ops'),
    path.join(repoRoot, 'docs', 'product')
  ];
  const documentationPaths = documentationRoots
    .flatMap((directory) => walkFiles(directory))
    .filter((filePath) => /\.md$/i.test(filePath))
    .filter((filePath) => {
      // Exclude provenance design docs from self-classification as operator paths.
      const relative = normalizePath(path.relative(repoRoot, filePath));
      if (relative.startsWith('docs/architecture/')) return false;
      if (/DB_MIGRATION_PROVENANCE/i.test(relative)) return false;
      const content = fs.readFileSync(filePath, 'utf8');
      if (!/\b(?:psql|pg_dump)\b/i.test(content)) return false;
      return DOC_OPERATOR_PATTERN.test(content);
    })
    .map((filePath) => normalizePath(path.relative(repoRoot, filePath)));

  const runtimeRoots = [path.join(repoRoot, 'modal_compute'), path.join(repoRoot, 'functions')];
  const runtimeDdlPaths = runtimeRoots
    .flatMap((directory) => walkFiles(directory))
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

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
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
  const migrationPaths = new Set();
  const migrations = Array.isArray(manifest.migrations) ? manifest.migrations : [];
  migrations.forEach((migration, migrationIndex) => {
    const migrationId = migration && migration.id ? migration.id : `<index:${migrationIndex}>`;
    for (const field of REQUIRED_MIGRATION_FIELDS) {
      if (!migration || migration[field] === undefined || migration[field] === null) {
        errors.push(`MIGRATION_FIELD_MISSING:${migrationId}:${field}`);
      }
    }
    if (!MIGRATION_ID_PATTERN.test((migration && migration.id) || '')) {
      errors.push(`MIGRATION_ID_INVALID:${migrationId}`);
    }
    if (migration && migrationIds.has(migration.id)) {
      errors.push(`MIGRATION_ID_DUPLICATE:${migration.id}`);
    }
    if (migration && migration.id) migrationIds.add(migration.id);

    if (!isNonEmptyString(migration && migration.name)) {
      errors.push(`MIGRATION_NAME_INVALID:${migrationId}`);
    }
    if (!isNonEmptyString(migration && migration.owner_domain)) {
      errors.push(`MIGRATION_OWNER_DOMAIN_INVALID:${migrationId}`);
    }
    if (!isNonEmptyString(migration && migration.path)) {
      errors.push(`MIGRATION_PATH_INVALID:${migrationId}`);
    }
    if (isNonEmptyString(migration && migration.path)) {
      // Canonical path ownership: a canonical migration lives only at
      // <canonical_directory>/<migration_id>.sql. Reject paths outside the canonical
      // directory, non-.sql extensions, path traversal that escapes the canonical
      // directory, and basename/ID mismatch.
      const canonicalDirectory = normalizePath(manifest.canonical_directory || '');
      const normalizedMigrationPath = normalizePath(migration.path);
      const pathSegments = normalizedMigrationPath.split('/');
      const hasTraversal = pathSegments.includes('..') || normalizedMigrationPath.startsWith('/');
      const isUnderCanonicalDirectory = !hasTraversal
        && canonicalDirectory.length > 0
        && normalizedMigrationPath.startsWith(`${canonicalDirectory}/`);
      const hasSqlExtension = /\.sql$/.test(normalizedMigrationPath);
      if (!isUnderCanonicalDirectory || !hasSqlExtension) {
        errors.push(`MIGRATION_PATH_NON_CANONICAL:${migrationId}`);
      } else {
        const pathBasename = normalizedMigrationPath.split('/').pop().replace(/\.sql$/, '');
        if (pathBasename !== migration.id) {
          errors.push(`MIGRATION_PATH_ID_MISMATCH:${migrationId}`);
        }
      }
      if (migrationPaths.has(normalizedMigrationPath)) {
        errors.push(`MIGRATION_PATH_DUPLICATE:${migration.path}`);
      }
      migrationPaths.add(normalizedMigrationPath);
    }
    if (!SHA256_PATTERN.test((migration && migration.checksum) || '')) {
      errors.push(`MIGRATION_CHECKSUM_INVALID:${migrationId}`);
    }

    const dependsOnIsArray = Array.isArray(migration && migration.depends_on);
    const destructiveIsArray = Array.isArray(migration && migration.destructive_operations);
    const preconditionsIsArray = Array.isArray(migration && migration.expected_preconditions);
    const postconditionsIsArray = Array.isArray(migration && migration.expected_postconditions);

    if (!dependsOnIsArray) {
      errors.push(`MIGRATION_DEPENDS_ON_TYPE_INVALID:${migrationId}`);
    }
    if (!destructiveIsArray) {
      errors.push(`MIGRATION_DESTRUCTIVE_OPERATIONS_TYPE_INVALID:${migrationId}`);
    }
    if (!preconditionsIsArray) {
      errors.push(`MIGRATION_PRECONDITIONS_TYPE_INVALID:${migrationId}`);
    }
    if (!postconditionsIsArray) {
      errors.push(`MIGRATION_POSTCONDITIONS_TYPE_INVALID:${migrationId}`);
    }
    if (!dependsOnIsArray || !destructiveIsArray) {
      errors.push(`MIGRATION_ARRAY_FIELD_INVALID:${migrationId}`);
    }

    const dependsOn = dependsOnIsArray ? migration.depends_on : [];
    const destructiveOperations = destructiveIsArray ? migration.destructive_operations : [];

    if (!['ADDITIVE', 'COMPATIBILITY', 'DESTRUCTIVE', 'ADOPTION'].includes(migration && migration.risk_class)) {
      errors.push(`MIGRATION_RISK_CLASS_INVALID:${migrationId}`);
    }
    if (!['REQUIRED', 'PROHIBITED', 'EXPLICIT'].includes(migration && migration.transaction_mode)) {
      errors.push(`MIGRATION_TRANSACTION_MODE_INVALID:${migrationId}`);
    }
    if (destructiveOperations.length > 0) {
      if (!isNonEmptyString(migration && migration.approval_reference) || migration.risk_class !== 'DESTRUCTIVE') {
        errors.push(`MIGRATION_DESTRUCTIVE_APPROVAL_MISSING:${migrationId}`);
      }
    }

    // Dependency graph validation (for ACTIVE/manifest with entries).
    const seenDeps = new Set();
    for (const dependency of dependsOn) {
      if (!isNonEmptyString(dependency)) {
        errors.push(`MIGRATION_DEPENDENCY_INVALID:${migrationId}`);
        continue;
      }
      if (dependency === migration.id) {
        errors.push(`MIGRATION_DEPENDENCY_SELF:${migrationId}`);
      }
      if (seenDeps.has(dependency)) {
        errors.push(`MIGRATION_DEPENDENCY_DUPLICATE:${migrationId}:${dependency}`);
      }
      seenDeps.add(dependency);
    }

    try {
      if (isNonEmptyString(migration && migration.path)) {
        const sourcePath = resolveRepositoryPath(repoRoot, migration.path);
        if (!fs.existsSync(sourcePath)) {
          errors.push(`MIGRATION_SOURCE_MISSING:${migration.path}`);
        } else {
          // Checksum is computed over the RAW BYTES of the SQL file. No newline,
          // whitespace, comment, or BOM normalization is applied. Any byte change —
          // LF<->CRLF, trailing newline add/remove, trailing space, comment edit, UTF-8
          // BOM add/remove, or a single byte — changes the checksum and fails closed.
          const sourceBytes = fs.readFileSync(sourcePath);
          if (SHA256_PATTERN.test(migration.checksum || '') && sha256(sourceBytes) !== migration.checksum) {
            errors.push(`MIGRATION_SOURCE_CHECKSUM_MISMATCH:${migrationId}`);
          }
          if (DESTRUCTIVE_SQL_PATTERN.test(sourceBytes.toString('utf8')) && destructiveOperations.length === 0) {
            errors.push(`MIGRATION_DESTRUCTIVE_OPERATION_UNDECLARED:${migrationId}`);
          }
        }
      }
    } catch (error) {
      errors.push(`MIGRATION_SOURCE_UNSAFE:${(migration && migration.path) || '<unknown>'}`);
    }
  });

  // Manifest order: migration IDs must be strictly ascending in array order.
  // Because IDs begin with a fixed-width 14-digit UTC timestamp, lexicographic
  // ascending order enforces chronological (timestamp) ordering and forbids
  // timestamp reversal or inserting an older ID after a newer one.
  for (let i = 1; i < migrations.length; i += 1) {
    const previousId = migrations[i - 1] && migrations[i - 1].id;
    const currentId = migrations[i] && migrations[i].id;
    if (typeof previousId === 'string' && previousId.length > 0
      && typeof currentId === 'string' && currentId.length > 0
      && currentId <= previousId) {
      errors.push(`MIGRATION_ORDER_INVALID:${currentId}`);
    }
  }

  // Cross-entry dependency existence and ordering.
  const idToIndex = new Map(migrations.map((migration, index) => [migration && migration.id, index]));
  migrations.forEach((migration, migrationIndex) => {
    if (!migration || !Array.isArray(migration.depends_on)) return;
    for (const dependency of migration.depends_on) {
      if (!idToIndex.has(dependency)) {
        errors.push(`MIGRATION_DEPENDENCY_UNKNOWN:${migration.id || `<index:${migrationIndex}>`}:${dependency}`);
        continue;
      }
      const dependencyIndex = idToIndex.get(dependency);
      if (dependencyIndex > migrationIndex) {
        errors.push(`MIGRATION_DEPENDENCY_ORDERING:${migration.id}:${dependency}`);
      }
    }
  });

  return { ok: errors.length === 0, errors, migrations };
}

function validateExpectedSchemaManifest(manifest) {
  const errors = [];
  if (!manifest || !Array.isArray(manifest.critical_objects)) {
    return { ok: false, errors: ['EXPECTED_SCHEMA_MANIFEST_MISSING'] };
  }
  if (!['ADOPTION_REQUIRED', 'ACTIVE'].includes(manifest.status)) {
    errors.push('EXPECTED_SCHEMA_STATUS_INVALID');
  }
  // Optional normalizer binding (Issue #3542). When present, must match catalog metadata contract.
  if (manifest.normalizer_version !== undefined && manifest.normalizer_version !== '1.0') {
    errors.push('EXPECTED_SCHEMA_NORMALIZER_CONTRACT_MISMATCH');
  }
  if (
    manifest.metadata_contract_path !== undefined &&
    manifest.metadata_contract_path !== 'db/migration-provenance/catalog-metadata-contract.json'
  ) {
    errors.push('EXPECTED_SCHEMA_NORMALIZER_CONTRACT_MISMATCH');
  }
  const seenNames = new Set();
  for (const object of manifest.critical_objects) {
    if (!object || !object.name || !SHA256_PATTERN.test(object.fingerprint || '')) {
      errors.push(`EXPECTED_SCHEMA_OBJECT_INVALID:${(object && object.name) || '<unknown>'}`);
      continue;
    }
    if (seenNames.has(object.name)) {
      errors.push(`EXPECTED_SCHEMA_OBJECT_DUPLICATE:${object.name}`);
    }
    seenNames.add(object.name);
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
      inventory_rows: Array.isArray(inventory && inventory.entries) ? inventory.entries.length : 0,
      discovered_paths: inventoryResult.discoveredPaths.length,
      canonical_migrations: migrationResult.migrations.length,
      expected_schema_objects: Array.isArray(expectedSchemaManifest && expectedSchemaManifest.critical_objects)
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
  const expectedById = new Map(
    (Array.isArray(expectedMigrations) ? expectedMigrations : []).map((migration, index) => [migration.id, { migration, index }])
  );
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
  for (const migration of expectedMigrations || []) {
    if (!appliedIds.has(migration.id)) blockers.push(`GATE_MISSING_APPLIED_MIGRATION:${migration.id}`);
  }
  return blockers;
}

function compareSchema(expectedSchemaManifest, catalogEvidence) {
  if (!catalogEvidence || !Array.isArray(catalogEvidence.objects)) {
    return ['GATE_CATALOG_EVIDENCE_UNAVAILABLE'];
  }
  const blockers = [];
  // Version binding when evidence or expected-schema carries normalizer metadata (#3542).
  if (
    catalogEvidence.normalizer_version !== undefined &&
    expectedSchemaManifest &&
    expectedSchemaManifest.normalizer_version !== undefined &&
    catalogEvidence.normalizer_version !== expectedSchemaManifest.normalizer_version
  ) {
    blockers.push('GATE_CATALOG_NORMALIZER_VERSION_MISMATCH');
  }
  if (
    catalogEvidence.format_version !== undefined &&
    expectedSchemaManifest &&
    expectedSchemaManifest.format_version !== undefined &&
    catalogEvidence.format_version !== expectedSchemaManifest.format_version
  ) {
    blockers.push('GATE_CATALOG_FORMAT_VERSION_MISMATCH');
  }
  if (
    catalogEvidence.normalizer_version !== undefined &&
    catalogEvidence.normalizer_version !== '1.0'
  ) {
    blockers.push('GATE_CATALOG_NORMALIZER_VERSION_MISMATCH');
  }
  if (catalogEvidence.format_version !== undefined && catalogEvidence.format_version !== '1.0') {
    blockers.push('GATE_CATALOG_FORMAT_VERSION_MISMATCH');
  }
  const expectedObjects = Array.isArray(expectedSchemaManifest && expectedSchemaManifest.critical_objects)
    ? expectedSchemaManifest.critical_objects
    : [];
  const expectedByName = new Map(expectedObjects.map((object) => [object.name, object]));
  const catalogNames = new Set();
  for (const object of catalogEvidence.objects) {
    if (!object || !object.name || !SHA256_PATTERN.test(object.fingerprint || '')) {
      blockers.push('GATE_CATALOG_RECORD_INVALID');
      continue;
    }
    if (catalogNames.has(object.name)) {
      blockers.push(`GATE_DUPLICATE_SCHEMA_OBJECT:${object.name}`);
    }
    catalogNames.add(object.name);
    const expected = expectedByName.get(object.name);
    if (!expected) {
      blockers.push(`GATE_UNEXPECTED_SCHEMA_OBJECT:${object.name}`);
    } else if (expected.fingerprint !== object.fingerprint) {
      blockers.push(`GATE_SCHEMA_FINGERPRINT_MISMATCH:${object.name}`);
    }
  }
  for (const object of expectedObjects) {
    if (!catalogNames.has(object.name)) blockers.push(`GATE_MISSING_SCHEMA_OBJECT:${object.name}`);
  }
  return blockers;
}

function evaluateProvenance({
  migrationManifest,
  expectedSchemaManifest,
  ledgerEvidence,
  catalogEvidence,
  adoptionBinding,
  adoptionContract
}) {
  const blockers = [];
  const migrations = Array.isArray(migrationManifest && migrationManifest.migrations)
    ? migrationManifest.migrations
    : [];
  const criticalObjects = Array.isArray(expectedSchemaManifest && expectedSchemaManifest.critical_objects)
    ? expectedSchemaManifest.critical_objects
    : [];

  if (!migrationManifest || (migrationManifest.status !== 'ACTIVE' || (expectedSchemaManifest && expectedSchemaManifest.status !== 'ACTIVE'))) {
    if (!migrationManifest || migrationManifest.status !== 'ACTIVE' || !expectedSchemaManifest || expectedSchemaManifest.status !== 'ACTIVE') {
      blockers.push('GATE_ADOPTION_BASELINE_REQUIRED');
    }
  }

  // Strict adoption attestation (#3553). Bare adoption_status is never sufficient.
  // ledgerEvidence is the claim; adoptionBinding is the trusted invocation binding.
  // Never construct digests/commits from caller-controlled objects as an authorization fallback.
  const attestationCore = require('./adoption-attestation-core.cjs');
  if (!ledgerEvidence) {
    blockers.push('GATE_ADOPTION_EVIDENCE_UNAVAILABLE');
  } else {
    // Repository-owned canonical migration sequence (never reconstructed from evidence).
    const repositoryExpectedMigrations = migrations.map((item) => ({
      id: item.id,
      checksum: item.checksum
    }));
    let binding = adoptionBinding || null;
    if (adoptionBinding && typeof adoptionBinding === 'object' && !Array.isArray(adoptionBinding)) {
      // Always attach repository-owned expected_migrations before completeness check.
      const bindingCandidate = {
        ...adoptionBinding,
        expected_migrations: repositoryExpectedMigrations
      };
      if (attestationCore.hasCompleteTrustedBinding(bindingCandidate)) {
        binding = {
          baseline_commit: bindingCandidate.baseline_commit,
          canonical_manifest_digest: bindingCandidate.canonical_manifest_digest,
          expected_schema_digest: bindingCandidate.expected_schema_digest,
          catalog_evidence_digest: bindingCandidate.catalog_evidence_digest,
          approval_reference: bindingCandidate.approval_reference,
          environment_class: bindingCandidate.environment_class,
          attestation_scope: bindingCandidate.attestation_scope,
          expected_migrations: repositoryExpectedMigrations
        };
      } else {
        binding = bindingCandidate;
      }
    }
    const attestationResult = attestationCore.validateAdoptionAttestationEvidence(
      ledgerEvidence,
      binding,
      adoptionContract
    );
    if (!attestationResult.ok) {
      blockers.push(...attestationResult.blockers);
    }
  }

  blockers.push(...compareLedger(migrations, ledgerEvidence));
  blockers.push(...compareSchema(expectedSchemaManifest || { critical_objects: [] }, catalogEvidence));
  const uniqueBlockers = [...new Set(blockers)].sort();
  return {
    decision: uniqueBlockers.length === 0 ? 'PASS' : 'FAIL_CLOSED',
    blockers: uniqueBlockers,
    summary: {
      expected_migrations: migrations.length,
      applied_migrations: Array.isArray(ledgerEvidence && ledgerEvidence.applied_migrations)
        ? ledgerEvidence.applied_migrations.length
        : 0,
      expected_schema_objects: criticalObjects.length,
      observed_schema_objects: Array.isArray(catalogEvidence && catalogEvidence.objects)
        ? catalogEvidence.objects.length
        : 0
    }
  };
}

function evaluateProvenanceWithSource({
  sourceResult,
  migrationManifest,
  expectedSchemaManifest,
  ledgerEvidence,
  catalogEvidence,
  adoptionBinding,
  adoptionContract
}) {
  const gateResult = evaluateProvenance({
    migrationManifest,
    expectedSchemaManifest,
    ledgerEvidence,
    catalogEvidence,
    adoptionBinding,
    adoptionContract
  });
  const blockers = [...gateResult.blockers];
  if (!sourceResult || sourceResult.ok !== true) {
    blockers.push('GATE_SOURCE_CONFIGURATION_INVALID');
  }
  const uniqueBlockers = [...new Set(blockers)].sort();
  return {
    decision: uniqueBlockers.length === 0 ? 'PASS' : 'FAIL_CLOSED',
    blockers: uniqueBlockers,
    summary: {
      ...gateResult.summary,
      source_ok: !!(sourceResult && sourceResult.ok)
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
  normalizePath,
  discoverRepositoryPaths,
  validateInventory,
  validateMigrationManifest,
  validateExpectedSchemaManifest,
  validateSourceConfiguration,
  compareSchema,
  evaluateProvenance,
  evaluateProvenanceWithSource
};
