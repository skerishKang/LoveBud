const fs = require('node:fs');
const path = require('node:path');

const {
  evaluateProvenanceWithSource,
  loadJson,
  validateSourceConfiguration
} = require('./migration-provenance-core.cjs');
const attestation = require('./adoption-attestation-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const INVENTORY_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'migration-path-inventory.json');
const MIGRATION_MANIFEST_PATH = path.join(REPO_ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
const EXPECTED_SCHEMA_PATH = path.join(REPO_ROOT, 'db', 'migration-provenance', 'expected-schema-manifest.json');
const ADOPTION_CONTRACT_PATH = path.join(
  REPO_ROOT,
  'db',
  'migration-provenance',
  'adoption-attestation-contract.json'
);

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

/**
 * Load evidence through repository-relative + realpath confinement.
 * Absolute paths, .. escapes, directories, and symlink escapes fail closed.
 */
function loadEvidence(label, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath) {
    return { ok: false, blockers: [`GATE_EVIDENCE_READ_FAILED:${label}`] };
  }
  if (path.isAbsolute(relativePath)) {
    return { ok: false, blockers: [`GATE_EVIDENCE_READ_FAILED:${label}`] };
  }
  try {
    const loaded = attestation.readConfinedEvidenceFile(REPO_ROOT, relativePath);
    return { ok: true, value: loaded.value, bytes: loaded.bytes, digest: loaded.digest };
  } catch (error) {
    if (error && error.category === 'ADOPTION_ATTESTATION_INPUT_INVALID') {
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
    let adoptionContract;
    let canonicalBytes;
    let expectedSchemaBytes;
    try {
      inventory = loadJson(INVENTORY_PATH);
      canonicalBytes = fs.readFileSync(MIGRATION_MANIFEST_PATH);
      expectedSchemaBytes = fs.readFileSync(EXPECTED_SCHEMA_PATH);
      migrationManifest = JSON.parse(canonicalBytes.toString('utf8'));
      expectedSchemaManifest = JSON.parse(expectedSchemaBytes.toString('utf8'));
      adoptionContract = loadJson(ADOPTION_CONTRACT_PATH);
      attestation.validateAdoptionAttestationContract(adoptionContract);
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
    const baselineCommit = argumentsByName.get('--baseline-commit');
    const approvalReference = argumentsByName.get('--approval-reference');
    const environmentClass = argumentsByName.get('--environment-class');
    const attestationScope = argumentsByName.get('--attestation-scope');

    if (!ledgerPath || !catalogPath) {
      failClosed('PROVENANCE_GATE', ['GATE_EVIDENCE_ARGUMENTS_REQUIRED'], {
        source: sourceResult.summary
      });
      return;
    }

    // Target mode requires explicit trusted binding arguments.
    // Values are never echoed in failure output.
    if (!baselineCommit || !approvalReference || !environmentClass || !attestationScope) {
      failClosed('PROVENANCE_GATE', ['GATE_ADOPTION_TRUST_BINDING_REQUIRED'], {
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

    // Exact-byte digests only: repository-owned file bytes + confined catalog evidence bytes.
    const adoptionBinding = {
      baseline_commit: baselineCommit,
      approval_reference: approvalReference,
      environment_class: environmentClass,
      attestation_scope: attestationScope,
      canonical_manifest_digest: attestation.computeEvidenceDigest(canonicalBytes),
      expected_schema_digest: attestation.computeEvidenceDigest(expectedSchemaBytes),
      catalog_evidence_digest: catalogLoad.digest
    };

    const gateResult = evaluateProvenanceWithSource({
      sourceResult,
      migrationManifest,
      expectedSchemaManifest,
      ledgerEvidence: ledgerLoad.value,
      catalogEvidence: catalogLoad.value,
      adoptionBinding,
      adoptionContract
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
