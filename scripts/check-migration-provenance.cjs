const path = require('node:path');

const {
  evaluateProvenanceWithSource,
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
    if (!next || next.startsWith('--')) {
      argumentsByName.set(argument, null);
    } else {
      argumentsByName.set(argument, next);
      index += 1;
    }
  }
  return argumentsByName;
}

function report(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function failClosed(mode, blockers, extra = {}) {
  report({
    mode,
    decision: 'FAIL_CLOSED',
    blockers: [...new Set(blockers)].sort(),
    ...extra
  });
  process.exitCode = 1;
}

function loadEvidence(label, relativeOrAbsolute) {
  try {
    const resolved = path.isAbsolute(relativeOrAbsolute)
      ? relativeOrAbsolute
      : path.resolve(REPO_ROOT, relativeOrAbsolute);
    return { ok: true, value: loadJson(resolved) };
  } catch (error) {
    if (error && error.name === 'SyntaxError') {
      return { ok: false, blockers: [`GATE_EVIDENCE_JSON_INVALID:${label}`] };
    }
    return { ok: false, blockers: [`GATE_EVIDENCE_READ_FAILED:${label}`] };
  }
}

function main() {
  try {
    const argumentsByName = parseArguments(process.argv.slice(2));

    // Fail closed when a flag is present without a value.
    for (const [flag, value] of argumentsByName.entries()) {
      if (flag !== '--source-only' && value === null) {
        failClosed('PROVENANCE_GATE', ['GATE_EVIDENCE_ARGUMENTS_REQUIRED']);
        return;
      }
    }

    let inventory;
    let migrationManifest;
    let expectedSchemaManifest;
    try {
      inventory = loadJson(INVENTORY_PATH);
      migrationManifest = loadJson(MIGRATION_MANIFEST_PATH);
      expectedSchemaManifest = loadJson(EXPECTED_SCHEMA_PATH);
    } catch (error) {
      failClosed('SOURCE_ONLY', ['GATE_SOURCE_CONFIGURATION_INVALID']);
      return;
    }

    const sourceResult = validateSourceConfiguration({
      repoRoot: REPO_ROOT,
      inventory,
      migrationManifest,
      expectedSchemaManifest
    });

    if (argumentsByName.has('--source-only')) {
      report({
        mode: 'SOURCE_ONLY',
        decision: sourceResult.ok ? 'PASS' : 'FAIL_CLOSED',
        ...sourceResult
      });
      process.exitCode = sourceResult.ok ? 0 : 1;
      return;
    }

    const ledgerPath = argumentsByName.get('--ledger-evidence');
    const catalogPath = argumentsByName.get('--catalog-evidence');
    if (!ledgerPath || !catalogPath) {
      failClosed('PROVENANCE_GATE', ['GATE_EVIDENCE_ARGUMENTS_REQUIRED'], {
        source: sourceResult.summary
      });
      return;
    }

    const ledgerLoad = loadEvidence('ledger', ledgerPath);
    const catalogLoad = loadEvidence('catalog', catalogPath);
    if (!ledgerLoad.ok || !catalogLoad.ok) {
      const blockers = [
        ...(ledgerLoad.ok ? [] : ledgerLoad.blockers),
        ...(catalogLoad.ok ? [] : catalogLoad.blockers)
      ];
      if (!sourceResult.ok) blockers.push('GATE_SOURCE_CONFIGURATION_INVALID');
      failClosed('PROVENANCE_GATE', blockers, { source: sourceResult.summary });
      return;
    }

    const gateResult = evaluateProvenanceWithSource({
      sourceResult,
      migrationManifest,
      expectedSchemaManifest,
      ledgerEvidence: ledgerLoad.value,
      catalogEvidence: catalogLoad.value
    });

    report({
      mode: 'PROVENANCE_GATE',
      source: sourceResult.summary,
      ...gateResult
    });
    process.exitCode = gateResult.decision === 'PASS' ? 0 : 1;
  } catch (error) {
    failClosed('PROVENANCE_GATE', ['GATE_EVIDENCE_READ_FAILED']);
  }
}

main();
