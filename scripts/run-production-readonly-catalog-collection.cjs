'use strict';

/**
 * Reviewed Phase B operator CLI for Production-readonly catalog collection.
 *
 * Calls ONLY the merged public collector:
 *   collectProductionReadonlyCatalogEvidenceFromFiles({ secretFile, roleMappingFile })
 *
 * No direct require('pg'), no new Client(), no SQL strings, no COMMIT.
 * No caller-controlled repoRoot, objects, connection, or SQL.
 *
 * Output policy: SANITIZED_STDOUT_ONLY (no file writes).
 *
 * Refs #3573 (NEW), #3458 (OPEN), #3425 (OPEN), #1882 (OPEN)
 * Refs #3549, #3553, #3555, #3569, #3570, #3571, #3572
 * #3572 is CLOSED / not reopened.
 */

const path = require('node:path');
const crypto = require('node:crypto');

// ─── Repository-owned core modules (no require('pg')) ────────────────────────
const { collectProductionReadonlyCatalogEvidenceFromFiles } = require(
  path.resolve(__dirname, 'migration-catalog-postgres-adapter-core.cjs')
);
const {
  buildExpectedSchemaCandidate,
  serializeExpectedSchemaCandidate,
} = require(
  path.resolve(__dirname, 'expected-schema-candidate-core.cjs')
);
const {
  computeObjectDigest,
  buildPreparedUnattestedAttestationDraft,
} = require(
  path.resolve(__dirname, 'adoption-attestation-core.cjs')
);
const {
  buildCollectionReceipt,
  serializeCollectionReceipt,
  computeDigest,
} = require(
  path.resolve(__dirname, 'phase-b-collection-receipt-core.cjs')
);

// ─── Repository-owned manifest paths (no caller-controlled root) ───────────
const REPO_ROOT = path.resolve(__dirname, '..');

function loadJson(relPath) {
  const fs = require('node:fs');
  const abs = path.resolve(REPO_ROOT, relPath);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

const canonicalManifest = loadJson('db/migration-provenance/canonical-migrations.json');
const expectedSchemaManifest = loadJson('db/migration-provenance/expected-schema-manifest.json');
const adoptionPlanContract = loadJson(
  'db/migration-provenance/adoption-baseline-collection-plan-contract.json'
);
const boundaryContract = loadJson(
  'db/migration-provenance/production-readonly-catalog-boundary-contract.json'
);
const catalogMetadataContract = loadJson(
  'db/migration-provenance/catalog-metadata-contract.json'
);

// ─── CLI arg parsing ────────────────────────────────────────────────────────

const ALLOWED_FLAGS = new Set([
  '--secret-file',
  '--role-mapping-file',
  '--baseline-commit',
  '--approval-reference',
  '--repeat',
]);

const FORBIDDEN_FLAGS = new Set([
  '--host', '--port', '--user', '--username', '--password',
  '--database', '--database-url', '--connection-string',
  '--objects', '--sql', '--repo-root', '--root',
  '--contract-root', '--policy-root',
  '--output', '--output-file', '--manifest', '--activate', '--attest',
]);

function parseArgs(argv) {
  const map = new Map();
  let repeat = 1;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      failInput('unknown');
    }
    if (FORBIDDEN_FLAGS.has(arg)) {
      failInput('forbidden');
    }
    if (arg === '--repeat') {
      const val = argv[i + 1];
      if (!val || val.startsWith('--')) failInput('missing');
      repeat = parseInt(val, 10);
      if (!Number.isInteger(repeat) || repeat < 1 || repeat > 2) {
        failInput('out_of_range');
      }
      i += 1;
      continue;
    }
    if (!ALLOWED_FLAGS.has(arg)) {
      failInput('unknown');
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) failInput('missing');
    map.set(arg, next);
    i += 1;
  }

  return { map, repeat };
}

function failInput(reason) {
  const out = {
    format_version: '1.0',
    outcome: 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY',
    bounded_category: reason === 'forbidden' ? 'CALLER_OVERRIDE_REJECTED' : 'INPUT_INVALID',
    collection_session_count: 0,
    attestation_status: 'UNATTESTED',
    manifest_activation: 'NONE',
    schema_mutation: 'NONE',
    data_mutation: 'NONE',
    credential_change: 'NONE',
    privilege_change: 'NONE',
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exitCode = 1;
  throw new Error('input_error');
}

// ─── Digest helpers (stdin/stdout serialization) ───────────────────────────

function stableStringify(value) {
  const compareCodePoint = (a, b) => {
    const l = String(a), r = String(b);
    return l < r ? -1 : l > r ? 1 : 0;
  };
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') return JSON.stringify(value);
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (t === 'object') {
    const keys = Object.keys(value).sort(compareCodePoint);
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return 'null';
}

function objDigest(obj) {
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(stableStringify(obj), 'utf8')).digest('hex')}`;
}

// ─── Bounded failure output ────────────────────────────────────────────────

function failClosed(category, sessionCount) {
  const out = {
    format_version: '1.0',
    outcome: category,
    bounded_category: category,
    collection_session_count: sessionCount || 0,
    attestation_status: 'UNATTESTED',
    manifest_activation: 'NONE',
    schema_mutation: 'NONE',
    data_mutation: 'NONE',
    credential_change: 'NONE',
    privilege_change: 'NONE',
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exitCode = 1;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  let secretFile, roleMappingFile, baselineCommit, approvalReference, repeat;

  try {
    const parsed = parseArgs(process.argv.slice(2));
    secretFile = parsed.map.get('--secret-file');
    roleMappingFile = parsed.map.get('--role-mapping-file');
    baselineCommit = parsed.map.get('--baseline-commit');
    approvalReference = parsed.map.get('--approval-reference');
    repeat = parsed.repeat;

    if (!secretFile || !roleMappingFile || !baselineCommit || !approvalReference) {
      failClosed('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 0);
      return;
    }

    // Validate SHA
    if (!/^[a-f0-9]{40}$/.test(baselineCommit)) {
      failClosed('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 0);
      return;
    }

    // Validate approval reference
    if (!/^(?:issue:\d+|decision:[A-Za-z0-9][A-Za-z0-9._-]{2,63})$/.test(approvalReference)) {
      failClosed('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 0);
      return;
    }

    // ── Round 1: call the public collector ──
    const evidence1 = await collectProductionReadonlyCatalogEvidenceFromFiles({
      secretFile,
      roleMappingFile,
    });

    // Build collection-level digests from repository-owned contracts
    const collectionPlanDigest = objDigest(adoptionPlanContract);
    const objectAllowlistDigest = objDigest(
      (adoptionPlanContract && adoptionPlanContract.reviewed_object_allowlist) || []
    );
    const boundaryContractDigest = objDigest(boundaryContract);
    const catalogMetadataContractDigest = objDigest(catalogMetadataContract);
    const canonicalManifestDigest = objDigest(canonicalManifest);
    const expectedSchemaManifestDigest = objDigest(expectedSchemaManifest);

    // Catalog evidence digest
    const catalogEvidenceJson = JSON.stringify(evidence1, null, 2);
    const catalogEvidenceDigest = computeDigest(Buffer.from(catalogEvidenceJson, 'utf8'));

    // ── Round 2: if --repeat 2, run again and compare ──
    let sessionCount = 1;
    if (repeat === 2) {
      const evidence2 = await collectProductionReadonlyCatalogEvidenceFromFiles({
        secretFile,
        roleMappingFile,
      });
      sessionCount = 2;

      const json1 = JSON.stringify(evidence1);
      const json2 = JSON.stringify(evidence2);
      if (json1 !== json2) {
        failClosed('COLLECTION_FAIL_PARTIAL_OR_UNKNOWN', 2);
        return;
      }
    }

    // ── Build inactive expected-schema candidate ──
    const schemaCandidate = buildExpectedSchemaCandidate(evidence1, expectedSchemaManifest);
    const candidateJson = serializeExpectedSchemaCandidate(schemaCandidate);
    const inactiveCandidateDigest = computeDigest(Buffer.from(candidateJson, 'utf8'));

    // ── Build prepared UNATTESTED attestation draft ──
    const attestationDraft = buildPreparedUnattestedAttestationDraft({
      baselineCommit,
      migrationManifest: canonicalManifest,
      expectedSchemaCandidate: schemaCandidate,
      catalogEvidence: evidence1,
      environmentClass: 'PRODUCTION',
      approvalReference,
      attestationScope: 'PRODUCTION_READONLY',
    });
    const attestationDigest = computeObjectDigest(attestationDraft);

    // ── Build final receipt ──
    const receipt = buildCollectionReceipt({
      baselineMainSha: baselineCommit,
      approvalReference,
      collectionSessionCount: sessionCount,
      collectionPlanDigest,
      objectAllowlistDigest,
      boundaryContractDigest,
      catalogMetadataContractDigest,
      canonicalManifestDigest,
      expectedSchemaManifestDigest,
      catalogEvidence: evidence1,
      catalogEvidenceDigest,
      inactiveExpectedSchemaCandidate: schemaCandidate,
      inactiveCandidateDigest,
      preparedAttestationDraft: attestationDraft,
      preparedAttestationDigest: attestationDigest,
    });

    process.stdout.write(serializeCollectionReceipt(receipt));
    process.exitCode = 0;
  } catch (error) {
    // Bounded failure — never echo raw error message / stack
    const category =
      error && error.category === 'MUTATION_DETECTED'
        ? 'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN'
        : error && error.category && error.category.startsWith('CATALOG_ADAPTER_')
          ? 'COLLECTION_FAIL_READONLY_PROOF'
          : 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
    failClosed(category, repeat || 1);
  }
}

main();
