const path = require('node:path');

const {
  evaluateProvenance,
  loadJson,
  validateSourceConfiguration
} = require('./migration-provenance-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const INVENTORY_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'migration-path-inventory.json');
const MIGRATION_MANIFEST_PATH = path.join(REPO_ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
const EXPECTED_SCHEMA_PATH = path.join(REPO_ROOT, 'db', 'migration-provenance', 'expected-schema-manifest.json');

function parseArguments(argv) {
  const argumentsByName = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) continue;
    const next = argv[index + 1];
    argumentsByName.set(argument, next && !next.startsWith('--') ? next : true);
  }
  return argumentsByName;
}

function report(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function main() {
  const argumentsByName = parseArguments(process.argv.slice(2));
  const inventory = loadJson(INVENTORY_PATH);
  const migrationManifest = loadJson(MIGRATION_MANIFEST_PATH);
  const expectedSchemaManifest = loadJson(EXPECTED_SCHEMA_PATH);
  const sourceResult = validateSourceConfiguration({
    repoRoot: REPO_ROOT,
    inventory,
    migrationManifest,
    expectedSchemaManifest
  });

  if (argumentsByName.has('--source-only')) {
    report({ mode: 'SOURCE_ONLY', decision: sourceResult.ok ? 'PASS' : 'FAIL_CLOSED', ...sourceResult });
    process.exitCode = sourceResult.ok ? 0 : 1;
    return;
  }

  const ledgerPath = argumentsByName.get('--ledger-evidence');
  const catalogPath = argumentsByName.get('--catalog-evidence');
  if (!ledgerPath || !catalogPath) {
    report({
      mode: 'PROVENANCE_GATE',
      decision: 'FAIL_CLOSED',
      blockers: ['GATE_EVIDENCE_ARGUMENTS_REQUIRED'],
      source: sourceResult.summary
    });
    process.exitCode = 1;
    return;
  }

  const gateResult = evaluateProvenance({
    migrationManifest,
    expectedSchemaManifest,
    ledgerEvidence: loadJson(path.resolve(REPO_ROOT, ledgerPath)),
    catalogEvidence: loadJson(path.resolve(REPO_ROOT, catalogPath))
  });
  report({ mode: 'PROVENANCE_GATE', source: sourceResult.summary, ...gateResult });
  process.exitCode = sourceResult.ok && gateResult.decision === 'PASS' ? 0 : 1;
}

main();
