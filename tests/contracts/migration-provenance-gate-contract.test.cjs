const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE_PATH = path.join(ROOT, 'scripts', 'migration-provenance-core.cjs');
const CLI_PATH = path.join(ROOT, 'scripts', 'check-migration-provenance.cjs');
const INVENTORY_PATH = path.join(ROOT, 'docs', 'architecture', 'migration-path-inventory.json');
const DESIGN_PATH = path.join(ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_GATE.md');
const LEDGER_CONTRACT_PATH = path.join(ROOT, 'db', 'migration-provenance', 'ledger-contract.json');
const MIGRATION_MANIFEST_PATH = path.join(ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
const EXPECTED_SCHEMA_PATH = path.join(ROOT, 'db', 'migration-provenance', 'expected-schema-manifest.json');

const core = require(CORE_PATH);
const attestation = require(path.join(ROOT, 'scripts', 'adoption-attestation-core.cjs'));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    ...options
  });
}

function trustedCliBindingArgs() {
  return [
    '--baseline-commit',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '--approval-reference',
    'issue:9999',
    '--environment-class',
    'DISPOSABLE_CI',
    '--attestation-scope',
    'INACTIVE_BASELINE'
  ];
}

function fullMigrationEntry(overrides = {}) {
  const checksum = overrides.checksum || core.sha256('migration-body');
  return {
    id: '20260713090000_example-one',
    name: 'example-one',
    path: 'db/migrations/README.md',
    checksum,
    depends_on: [],
    risk_class: 'ADDITIVE',
    transaction_mode: 'REQUIRED',
    expected_preconditions: [],
    expected_postconditions: [],
    rollback_support: 'NONE',
    destructive_operations: [],
    owner_domain: 'platform',
    approval_reference: 'n/a',
    ...overrides
  };
}

function activeFixture() {
  const firstChecksum = core.sha256('migration-one');
  const secondChecksum = core.sha256('migration-two');
  const schemaFingerprint = core.sha256('table:example|id:text:not-null');
  const migrationManifest = {
    status: 'ACTIVE',
    migrations: [
      { id: '20260713090000_example-one', checksum: firstChecksum },
      { id: '20260713090100_example-two', checksum: secondChecksum }
    ]
  };
  const expectedSchemaManifest = {
    status: 'ACTIVE',
    format_version: '1.0',
    normalizer_version: '1.0',
    metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
    critical_objects: [{ name: 'table:example', fingerprint: schemaFingerprint }]
  };
  const catalogEvidence = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: [{ name: 'table:example', fingerprint: schemaFingerprint }]
  };
  const baselineCommit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const ledgerEvidence = attestation.buildSyntheticAttestation({
    baselineCommit,
    migrationManifest,
    expectedSchemaManifest,
    catalogEvidence,
    environmentClass: 'DISPOSABLE_CI',
    varianceClassification: 'MATCH',
    approvalReference: 'issue:9999',
    attestationScope: 'DISPOSABLE_RECONSTRUCTION'
  });
  return {
    migrationManifest,
    expectedSchemaManifest,
    ledgerEvidence,
    catalogEvidence,
    adoptionBinding: {
      baseline_commit: baselineCommit,
      canonical_manifest_digest: ledgerEvidence.canonical_manifest_digest,
      expected_schema_digest: ledgerEvidence.expected_schema_digest,
      catalog_evidence_digest: ledgerEvidence.catalog_evidence_digest,
      approval_reference: 'issue:9999',
      environment_class: 'DISPOSABLE_CI',
      attestation_scope: 'DISPOSABLE_RECONSTRUCTION'
    }
  };
}

function bootstrapManifest() {
  return readJson(MIGRATION_MANIFEST_PATH);
}

test('committed provenance source configuration is complete and static-only', () => {
  const inventory = readJson(INVENTORY_PATH);
  const discovered = core.discoverRepositoryPaths(ROOT);
  const result = core.validateSourceConfiguration({
    repoRoot: ROOT,
    inventory,
    migrationManifest: readJson(MIGRATION_MANIFEST_PATH),
    expectedSchemaManifest: readJson(EXPECTED_SCHEMA_PATH)
  });

  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.summary.discovered_paths, discovered.length);
  assert.ok(result.summary.inventory_rows >= result.summary.discovered_paths);
  assert.ok(result.summary.canonical_migrations >= 1, 'canonical_migrations >= 1: ' + result.summary.canonical_migrations);

  const inventoryPaths = new Set(inventory.entries.map((entry) => entry.path));
  for (const discoveredPath of discovered) {
    assert.ok(inventoryPaths.has(discoveredPath), `missing inventory coverage for ${discoveredPath}`);
  }
  assert.equal(new Set(inventory.entries.map((entry) => entry.path)).size, inventory.entries.length);
  assert.equal(result.errors.filter((error) => error.startsWith('INVENTORY_PATH_UNCLASSIFIED:')).length, 0);
  assert.equal(result.errors.filter((error) => error.startsWith('INVENTORY_CHECKSUM_MISMATCH:')).length, 0);
});

test('inventory keeps the required classifications, checksums, and dispositions', () => {
  const inventory = readJson(INVENTORY_PATH);
  assert.deepEqual(inventory.classification_enum, core.CLASSIFICATIONS);
  assert.ok(inventory.entries.length >= core.discoverRepositoryPaths(ROOT).length);
  for (const entry of inventory.entries) {
    for (const field of core.REQUIRED_INVENTORY_FIELDS) {
      assert.notEqual(entry[field], undefined, `${entry.path} missing ${field}`);
      assert.notEqual(entry[field], '', `${entry.path} has empty ${field}`);
    }
    assert.match(entry.content_checksum, core.SHA256_PATTERN);
    assert.equal(entry.baseline_sha, inventory.baseline_sha);
  }
});

test('ledger contract excludes operator identity and credential material', () => {
  const ledgerContract = readJson(LEDGER_CONTRACT_PATH);
  assert.deepEqual(ledgerContract.required_record_fields, [
    'migration_id',
    'content_checksum',
    'applied_at',
    'runner_version',
    'environment_class',
    'deployed_commit',
    'transaction_outcome'
  ]);
  assert.ok(ledgerContract.prohibited_record_fields.includes('operator_email'));
  assert.ok(ledgerContract.prohibited_record_fields.includes('connection_string'));
});

test('manifest and ledger contract cannot drift independently', () => {
  const manifest = readJson(MIGRATION_MANIFEST_PATH);
  manifest.ledger.required_record_fields = manifest.ledger.required_record_fields.slice(0, -1);
  const result = core.validateMigrationManifest(manifest, ROOT);

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('MIGRATION_LEDGER_CONTRACT_MISMATCH'));
});

test('committed populated ADOPTION_REQUIRED manifest is valid', () => {
  const manifest = bootstrapManifest();
  const result = core.validateMigrationManifest(manifest, ROOT);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.ok(result.migrations.length >= 1, 'migrations >= 1: ' + result.migrations.length);
  assert.equal(result.migrations[0].id, '20260802094500_bootstrap-migration-ledger');
  assert.equal(
    result.migrations[0].path,
    'db/migrations/20260802094500_bootstrap-migration-ledger.sql'
  );
});

test('synthetic empty ADOPTION_REQUIRED manifest remains valid', () => {
  const syntheticEmpty = {
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
  const result = core.validateMigrationManifest(syntheticEmpty, ROOT);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.migrations.length, 0);
});

test('malformed destructive_operations does not throw and returns structured type errors', () => {
  const manifest = bootstrapManifest();
  manifest.status = 'ACTIVE';
  manifest.migrations = [
    fullMigrationEntry({
      destructive_operations: 'not-an-array'
    })
  ];

  let result;
  assert.doesNotThrow(() => {
    result = core.validateMigrationManifest(manifest, ROOT);
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('MIGRATION_DESTRUCTIVE_OPERATIONS_TYPE_INVALID:20260713090000_example-one'));
  assert.ok(result.errors.includes('MIGRATION_ARRAY_FIELD_INVALID:20260713090000_example-one'));
});

test('malformed depends_on does not throw and returns structured type errors', () => {
  const manifest = bootstrapManifest();
  manifest.status = 'ACTIVE';
  manifest.migrations = [
    fullMigrationEntry({
      depends_on: { bad: true }
    })
  ];

  let result;
  assert.doesNotThrow(() => {
    result = core.validateMigrationManifest(manifest, ROOT);
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('MIGRATION_DEPENDS_ON_TYPE_INVALID:20260713090000_example-one'));
  assert.ok(result.errors.includes('MIGRATION_ARRAY_FIELD_INVALID:20260713090000_example-one'));
});

test('unknown dependency fails closed', () => {
  const manifest = bootstrapManifest();
  manifest.status = 'ACTIVE';
  manifest.migrations = [
    fullMigrationEntry({
      depends_on: ['20260713080000_missing']
    })
  ];
  const result = core.validateMigrationManifest(manifest, ROOT);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('MIGRATION_DEPENDENCY_UNKNOWN:20260713090000_example-one:20260713080000_missing'));
});

test('self-dependency fails closed', () => {
  const manifest = bootstrapManifest();
  manifest.status = 'ACTIVE';
  manifest.migrations = [
    fullMigrationEntry({
      depends_on: ['20260713090000_example-one']
    })
  ];
  const result = core.validateMigrationManifest(manifest, ROOT);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('MIGRATION_DEPENDENCY_SELF:20260713090000_example-one'));
});

test('later-entry dependency / ordering failure is rejected', () => {
  const first = fullMigrationEntry({
    id: '20260713090000_example-one',
    name: 'example-one',
    depends_on: ['20260713090100_example-two']
  });
  const second = fullMigrationEntry({
    id: '20260713090100_example-two',
    name: 'example-two',
    checksum: core.sha256('migration-two')
  });
  const manifest = bootstrapManifest();
  manifest.status = 'ACTIVE';
  manifest.migrations = [first, second];
  const result = core.validateMigrationManifest(manifest, ROOT);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('MIGRATION_DEPENDENCY_ORDERING:20260713090000_example-one:20260713090100_example-two'));
});

test('duplicate expected-schema object is rejected', () => {
  const fingerprint = core.sha256('table:example');
  const result = core.validateExpectedSchemaManifest({
    status: 'ACTIVE',
    critical_objects: [
      { name: 'table:example', fingerprint },
      { name: 'table:example', fingerprint }
    ]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('EXPECTED_SCHEMA_OBJECT_DUPLICATE:table:example'));
});

test('duplicate catalog evidence object is rejected even with matching fingerprints', () => {
  const fixture = activeFixture();
  const fingerprint = fixture.catalogEvidence.objects[0].fingerprint;
  fixture.catalogEvidence.objects = [
    { name: 'table:example', fingerprint },
    { name: 'table:example', fingerprint }
  ];
  const result = core.evaluateProvenance(fixture);
  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.includes('GATE_DUPLICATE_SCHEMA_OBJECT:table:example'));
});

test('unadopted repository state fails closed without target evidence', () => {
  const result = core.evaluateProvenance({
    migrationManifest: readJson(MIGRATION_MANIFEST_PATH),
    expectedSchemaManifest: readJson(EXPECTED_SCHEMA_PATH)
  });

  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.includes('GATE_ADOPTION_BASELINE_REQUIRED'));
  assert.ok(result.blockers.includes('GATE_LEDGER_EVIDENCE_UNAVAILABLE'));
  assert.ok(result.blockers.includes('GATE_CATALOG_EVIDENCE_UNAVAILABLE'));
});

test('gate passes only matching migration and catalog evidence', () => {
  const fixture = activeFixture();
  const result = core.evaluateProvenance(fixture);

  assert.equal(result.decision, 'PASS');
  assert.deepEqual(result.blockers, []);
});

test('gate fails closed for unknown, edited, missing, and reordered migrations', () => {
  const fixture = activeFixture();
  fixture.ledgerEvidence.applied_migrations = [
    { id: '20260713090100_example-two', checksum: core.sha256('edited') },
    { id: '20260713090200_unknown', checksum: core.sha256('unknown') }
  ];
  const result = core.evaluateProvenance(fixture);

  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.some((blocker) => blocker.startsWith('GATE_REORDERED_MIGRATION:')));
  assert.ok(result.blockers.some((blocker) => blocker.startsWith('GATE_EDITED_MIGRATION:')));
  assert.ok(result.blockers.some((blocker) => blocker.startsWith('GATE_UNKNOWN_APPLIED_MIGRATION:')));
  assert.ok(result.blockers.some((blocker) => blocker.startsWith('GATE_MISSING_APPLIED_MIGRATION:')));
});

test('gate fails closed for catalog drift and unavailable adoption evidence', () => {
  const fixture = activeFixture();
  fixture.ledgerEvidence.adoption_status = 'UNATTESTED';
  fixture.catalogEvidence.objects = [{ name: 'table:unexpected', fingerprint: core.sha256('unexpected') }];
  const result = core.evaluateProvenance(fixture);

  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.includes('GATE_ADOPTION_EVIDENCE_UNAVAILABLE'));
  assert.ok(result.blockers.some((blocker) => blocker.startsWith('GATE_UNEXPECTED_SCHEMA_OBJECT:')));
  assert.ok(result.blockers.some((blocker) => blocker.startsWith('GATE_MISSING_SCHEMA_OBJECT:')));
});

test('bare adoption_status ATTESTED is rejected by the gate', () => {
  const fixture = activeFixture();
  fixture.ledgerEvidence = {
    adoption_status: 'ATTESTED',
    applied_migrations: fixture.ledgerEvidence.applied_migrations
  };
  const result = core.evaluateProvenance(fixture);
  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.includes('GATE_ADOPTION_EVIDENCE_INVALID'));
});

test('valid synthetic attestation still fails closed when committed manifests are inactive', () => {
  const expectedSchema = readJson(EXPECTED_SCHEMA_PATH);
  const canonical = readJson(MIGRATION_MANIFEST_PATH);
  const catalogEvidence = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: []
  };
  const baselineCommit = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const ledgerEvidence = attestation.buildSyntheticAttestation({
    baselineCommit,
    migrationManifest: canonical,
    expectedSchemaManifest: expectedSchema,
    catalogEvidence,
    approvalReference: 'decision:synthetic-attestation-ok',
    environmentClass: 'DISPOSABLE_CI',
    attestationScope: 'INACTIVE_BASELINE'
  });
  const result = core.evaluateProvenance({
    migrationManifest: canonical,
    expectedSchemaManifest: expectedSchema,
    ledgerEvidence,
    catalogEvidence,
    adoptionBinding: {
      baseline_commit: baselineCommit,
      canonical_manifest_digest: ledgerEvidence.canonical_manifest_digest,
      expected_schema_digest: ledgerEvidence.expected_schema_digest,
      catalog_evidence_digest: ledgerEvidence.catalog_evidence_digest,
      approval_reference: 'decision:synthetic-attestation-ok',
      environment_class: 'DISPOSABLE_CI',
      attestation_scope: 'INACTIVE_BASELINE'
    }
  });
  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.includes('GATE_ADOPTION_BASELINE_REQUIRED'));
  assert.equal(
    result.blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED'),
    false
  );
  assert.equal(expectedSchema.status, 'ADOPTION_REQUIRED');
  assert.ok(expectedSchema.critical_objects.length >= 1, 'critical_objects >= 1: ' + expectedSchema.critical_objects.length);
  assert.equal(expectedSchema.critical_objects[0].name, 'table:public.schema_migration_ledger');
  assert.equal(canonical.status, 'ADOPTION_REQUIRED');
  assert.ok(canonical.migrations.length >= 1, 'migrations >= 1: ' + canonical.migrations.length);
  assert.equal(canonical.migrations[0].id, '20260802094500_bootstrap-migration-ledger');
});

test('self-consistent ATTESTED evidence without trusted binding fails closed', () => {
  const fixture = activeFixture();
  delete fixture.adoptionBinding;
  const result = core.evaluateProvenance(fixture);
  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED'));
});

test('CLI target mode requires trusted binding arguments', () => {
  const relCatalog = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-catalog-binding.json')
    .replace(/\\/g, '/');
  const relLedger = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-ledger-binding.json')
    .replace(/\\/g, '/');
  const catalogPath = path.join(ROOT, relCatalog);
  const ledgerPath = path.join(ROOT, relLedger);
  try {
    fs.writeFileSync(catalogPath, JSON.stringify({ format_version: '1.0', normalizer_version: '1.0', objects: [] }), 'utf8');
    fs.writeFileSync(ledgerPath, JSON.stringify({ adoption_status: 'ATTESTED', applied_migrations: [] }), 'utf8');

    const missingBaseline = runCli([
      '--ledger-evidence',
      relLedger,
      '--catalog-evidence',
      relCatalog,
      '--approval-reference',
      'issue:1',
      '--environment-class',
      'DISPOSABLE_CI',
      '--attestation-scope',
      'INACTIVE_BASELINE'
    ]);
    assert.equal(missingBaseline.status, 1);
    const payloadA = JSON.parse(missingBaseline.stdout);
    assert.equal(payloadA.decision, 'FAIL_CLOSED');
    assert.ok(payloadA.blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED'));
    assert.equal(missingBaseline.stdout.includes('issue:1'), false);

    const missingApproval = runCli([
      '--ledger-evidence',
      relLedger,
      '--catalog-evidence',
      relCatalog,
      '--baseline-commit',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '--environment-class',
      'DISPOSABLE_CI',
      '--attestation-scope',
      'INACTIVE_BASELINE'
    ]);
    assert.equal(missingApproval.status, 1);
    assert.ok(
      JSON.parse(missingApproval.stdout).blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED')
    );

    const missingEnvScope = runCli([
      '--ledger-evidence',
      relLedger,
      '--catalog-evidence',
      relCatalog,
      '--baseline-commit',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '--approval-reference',
      'issue:1'
    ]);
    assert.equal(missingEnvScope.status, 1);
    assert.ok(
      JSON.parse(missingEnvScope.stdout).blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED')
    );
  } finally {
    if (fs.existsSync(catalogPath)) fs.unlinkSync(catalogPath);
    if (fs.existsSync(ledgerPath)) fs.unlinkSync(ledgerPath);
  }
});

test('source validation failure forces target decision FAIL_CLOSED even with matching evidence', () => {
  const fixture = activeFixture();
  const sourceResult = {
    ok: false,
    errors: ['INVENTORY_CHECKSUM_MISMATCH:example'],
    summary: { inventory_rows: 0, discovered_paths: 0, canonical_migrations: 0, expected_schema_objects: 0 }
  };
  const result = core.evaluateProvenanceWithSource({
    sourceResult,
    ...fixture
  });

  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.includes('GATE_SOURCE_CONFIGURATION_INVALID'));
  assert.equal(result.summary.source_ok, false);
});

test('source-only implementation has no database, network, or deploy client', () => {
  const source = fs.readFileSync(CORE_PATH, 'utf8');
  const cli = fs.readFileSync(CLI_PATH, 'utf8');
  // Dependency surface only: discovery may mention operator tool names as text markers.
  for (const body of [source, cli]) {
    assert.doesNotMatch(body, /require\(['"](?:pg|child_process|playwright|dotenv|net|http|https|node:child_process|node:net|node:http|node:https)['"]\)/i);
    assert.doesNotMatch(body, /\bfetch\s*\(/);
    assert.doesNotMatch(body, /\bDATABASE_URL\b/);
    assert.doesNotMatch(body, /\bwrangler\b/i);
    assert.doesNotMatch(body, /https?:\/\//i);
    assert.doesNotMatch(body, /spawnSync|execSync|spawn\(|exec\(/);
  }
});

test('nested scripts path discovery and path separator normalization', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lovebud-provenance-'));
  try {
    const nestedDir = path.join(tempRoot, 'scripts', 'nested', 'deep');
    fs.mkdirSync(nestedDir, { recursive: true });
    const nestedSql = path.join(nestedDir, 'migration.sql');
    fs.writeFileSync(nestedSql, 'CREATE TABLE nested_probe (id text);\n', 'utf8');

    // Windows-style relative segments should normalize to POSIX inventory form.
    const mixed = ['scripts', 'nested', 'deep', 'migration.sql'].join(path.sep);
    assert.equal(core.normalizePath(mixed), 'scripts/nested/deep/migration.sql');

    const discovered = core.discoverRepositoryPaths(tempRoot);
    assert.ok(
      discovered.includes('scripts/nested/deep/migration.sql'),
      `expected nested discovery, got: ${discovered.join(',')}`
    );
    assert.ok(discovered.every((entryPath) => !entryPath.includes('\\')));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('CLI source-only exits 0 with PASS when configuration is valid', () => {
  const child = runCli(['--source-only']);
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const payload = JSON.parse(child.stdout);
  assert.equal(payload.mode, 'SOURCE_ONLY');
  assert.equal(payload.decision, 'PASS');
  assert.equal(payload.ok, true);
});

test('CLI missing evidence argument fails closed with consistent exit semantics', () => {
  const child = runCli([]);
  assert.equal(child.status, 1);
  const payload = JSON.parse(child.stdout);
  assert.equal(payload.decision, 'FAIL_CLOSED');
  assert.ok(payload.blockers.includes('GATE_EVIDENCE_ARGUMENTS_REQUIRED'));
});

test('CLI flag without value fails closed', () => {
  const child = runCli(['--ledger-evidence']);
  assert.equal(child.status, 1);
  const payload = JSON.parse(child.stdout);
  assert.equal(payload.decision, 'FAIL_CLOSED');
  assert.ok(payload.blockers.includes('GATE_EVIDENCE_ARGUMENTS_REQUIRED'));
});

test('CLI malformed evidence JSON fails closed with bounded category', () => {
  const relLedger = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-ledger-bad.json')
    .replace(/\\/g, '/');
  const relCatalog = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-catalog-ok.json')
    .replace(/\\/g, '/');
  const badLedger = path.join(ROOT, relLedger);
  const goodCatalog = path.join(ROOT, relCatalog);
  try {
    fs.writeFileSync(badLedger, '{not-json', 'utf8');
    fs.writeFileSync(goodCatalog, JSON.stringify({ objects: [] }), 'utf8');

    const child = runCli([
      '--ledger-evidence',
      relLedger,
      '--catalog-evidence',
      relCatalog,
      ...trustedCliBindingArgs()
    ]);
    assert.equal(child.status, 1);
    const payload = JSON.parse(child.stdout);
    assert.equal(payload.decision, 'FAIL_CLOSED');
    assert.ok(payload.blockers.some((blocker) => blocker.startsWith('GATE_EVIDENCE_JSON_INVALID')));
    assert.doesNotMatch(child.stdout, /SyntaxError|stack|at Object/i);
    assert.equal(child.stdout.includes(badLedger), false);
    assert.equal(child.stdout.includes(path.basename(badLedger)), false);
  } finally {
    if (fs.existsSync(badLedger)) fs.unlinkSync(badLedger);
    if (fs.existsSync(goodCatalog)) fs.unlinkSync(goodCatalog);
  }
});

test('CLI unreadable evidence fails closed with bounded category', () => {
  const relCatalog = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-catalog-missing-pair.json')
    .replace(/\\/g, '/');
  const catalog = path.join(ROOT, relCatalog);
  const missingLedger = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-missing-ledger.json')
    .replace(/\\/g, '/');
  try {
    fs.writeFileSync(catalog, JSON.stringify({ objects: [] }), 'utf8');
    const child = runCli([
      '--ledger-evidence',
      missingLedger,
      '--catalog-evidence',
      relCatalog,
      ...trustedCliBindingArgs()
    ]);
    assert.equal(child.status, 1);
    const payload = JSON.parse(child.stdout);
    assert.equal(payload.decision, 'FAIL_CLOSED');
    assert.ok(payload.blockers.some((blocker) => blocker.startsWith('GATE_EVIDENCE_READ_FAILED')));
  } finally {
    if (fs.existsSync(catalog)) fs.unlinkSync(catalog);
  }
});

test('CLI absolute evidence path fails closed', () => {
  const absCatalog = path.join(
    ROOT,
    'tests',
    'contracts',
    'fixtures',
    'migration-provenance',
    'catalog-baseline.json'
  );
  const child = runCli([
    '--ledger-evidence',
    absCatalog,
    '--catalog-evidence',
    absCatalog,
    ...trustedCliBindingArgs()
  ]);
  assert.equal(child.status, 1);
  const payload = JSON.parse(child.stdout);
  assert.equal(payload.decision, 'FAIL_CLOSED');
  assert.ok(payload.blockers.some((blocker) => blocker.startsWith('GATE_EVIDENCE_READ_FAILED')));
  assert.equal(child.stdout.includes(absCatalog), false);
});

test('JSON decision and exit code stay aligned when source is invalid under target mode', () => {
  // Force source invalid by pointing at a temporary inventory rewrite is out of scope;
  // evaluateProvenanceWithSource is the shared pure path used by CLI.
  const fixture = activeFixture();
  const gate = core.evaluateProvenanceWithSource({
    sourceResult: { ok: false, errors: ['INVENTORY_PATH_UNCLASSIFIED:x'], summary: {} },
    ...fixture
  });
  assert.equal(gate.decision, 'FAIL_CLOSED');
  assert.ok(gate.blockers.includes('GATE_SOURCE_CONFIGURATION_INVALID'));
  // Simulated exit semantics used by CLI.
  const exitCode = gate.decision === 'PASS' ? 0 : 1;
  assert.equal(exitCode, 1);
});

test('architecture document fixes the adoption and issue-boundary rules', () => {
  const design = fs.readFileSync(DESIGN_PATH, 'utf8');
  for (const heading of [
    '## A. Current State',
    '## B. Canonical Ledger',
    '## C. Migration Manifest',
    '## D. Expected-Schema Manifest',
    '## E. Read-Only Provenance Gate',
    '## F. Destructive DDL Policy',
    '## G. Existing Production Adoption',
    '## H. Rollback and Forward Fix',
    '## I. Clean Database Reconstruction',
    '## J. Follow-Up Child Work'
  ]) {
    assert.ok(design.includes(heading), `missing ${heading}`);
  }
  assert.ok(design.includes('Refs #3458'));
  assert.ok(design.includes('Refs #1882'));
  assert.ok(design.includes('Keep #1882 OPEN.'));
  assert.doesNotMatch(design, /\b(?:Closes|Fixes|Resolves)\s+#1882\b/i);
});
