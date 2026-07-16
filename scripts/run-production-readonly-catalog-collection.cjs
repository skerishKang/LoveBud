'use strict';

/**
 * Reviewed Phase B operator CLI for Production-readonly catalog collection.
 *
 * Calls ONLY the merged public collector:
 *   collectProductionReadonlyCatalogEvidenceFromFiles({ secretFile, roleMappingFile })
 *
 * Uses trusted prepared plan from:
 *   buildPreparedCollectionPlan({ baselineCommit, approvalReference })
 *
 * No direct require('pg'), no new Client(), no SQL strings, no COMMIT.
 * No caller-controlled repoRoot, objects, connection, or SQL.
 * No getPrivateInvocationParts() — the public collector owns that boundary.
 *
 * Output policy: SANITIZED_STDOUT_ONLY (single deterministic JSON to stdout).
 *
 * Refs #3573 (NEW), #3458 (OPEN), #3425 (OPEN), #1882 (OPEN)
 * Refs #3549, #3553, #3555, #3569, #3570, #3571, #3572
 * PR #3574 is CLOSED / not reopened.
 */

const path = require('node:path');
const fs = require('node:fs');

// ─── Repository-owned core modules (NO require('pg')) ────────────────────────
const { collectProductionReadonlyCatalogEvidenceFromFiles } = require(
  path.resolve(__dirname, 'migration-catalog-postgres-adapter-core.cjs')
);
const {
  buildExpectedSchemaCandidate,
} = require(path.resolve(__dirname, 'expected-schema-candidate-core.cjs'));
const {
  computeObjectDigest,
  buildPreparedUnattestedAttestationDraft,
} = require(path.resolve(__dirname, 'adoption-attestation-core.cjs'));
const {
  buildCollectionReceipt,
  serializeCollectionReceipt,
  validateArtifact,
} = require(path.resolve(__dirname, 'phase-b-collection-receipt-core.cjs'));
const {
  buildPreparedCollectionPlan,
} = require(path.resolve(__dirname, 'adoption-baseline-collection-plan-core.cjs'));

// ─── Fixed repository root ─────────────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, '..');

// ─── Allowed / Forbidden CLI flags ──────────────────────────────────────────

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

// ─── Approved bounded failure outcomes ─────────────────────────────────────

const VALID_OUTCOMES = Object.freeze([
  'COLLECTION_PASS_SANITIZED_EVIDENCE_READY',
  'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY',
  'COLLECTION_FAIL_READONLY_PROOF',
  'COLLECTION_FAIL_ALLOWLIST_OR_METADATA_CONTRACT',
  'COLLECTION_FAIL_SANITIZATION',
  'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN',
]);

/**
 * Approved bounded failure mapping table with session context.
 *
 * @param {string|null} category — internal error category
 * @param {number} attemptedSessions — 0, 1, or 2
 * @returns {string} approved bounded outcome string
 */
function mapFailure(category, attemptedSessions) {
  if (!category) {
    return attemptedSessions > 0
      ? 'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN'
      : 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
  }

  // RUNTIME FAILURE (unknown) — session preservation determines outcome
  // Unknown runtime after attempt → partial/unknown
  // Unknown runtime before attempt → connection boundary
  if (category === 'UNEXPECTED') {
    return attemptedSessions > 0
      ? 'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN'
      : 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
  }

  // INPUT / PATH / CREDENTIAL / CONFIG / VERSION — before any collection
  if (category === 'INPUT_INVALID' ||
      category.startsWith('COLLECTION_PLAN_') ||
      category === 'HEAD_UNRESOLVABLE' ||
      category === 'BASELINE_HEAD_MISMATCH' ||
      category === 'CONTRACT_LOAD_FAILED') {
    return 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
  }

  // READ-ONLY PROOF FAILURE
  if (category === 'CATALOG_ADAPTER_READ_ONLY_REQUIRED' ||
      category === 'CATALOG_ADAPTER_MUTATION_DETECTED') {
    return 'COLLECTION_FAIL_READONLY_PROOF';
  }

  // ALLOWLIST / CATALOG CONTRACT FAILURE
  if (category === 'CATALOG_ADAPTER_INPUT_INVALID' ||
      category === 'CATALOG_ADAPTER_GRANTEE_UNMAPPED' ||
      category.startsWith('CATALOG_ADAPTER_CATALOG_SHAPE_')) {
    return 'COLLECTION_FAIL_ALLOWLIST_OR_METADATA_CONTRACT';
  }

  // SANITIZATION / RECEIPT / CANDIDATE FAILURE
  if (category === 'CANDIDATE_FAILED' ||
      category === 'ATTESTATION_DRAFT_FAILED' ||
      category.startsWith('RECEIPT_') ||
      category === 'CATALOG_ADAPTER_SANITIZATION_FAILED') {
    return 'COLLECTION_FAIL_SANITIZATION';
  }

  // REPEAT MISMATCH
  if (category === 'REPEAT_MISMATCH') {
    return 'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN';
  }

  // ADAPTER: connection/config — before session attempt
  if (category === 'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID' ||
      category === 'CATALOG_ADAPTER_SERVER_VERSION_MISMATCH') {
    return 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
  }

  // ADAPTER: query failure after attempt → partial/unknown
  if (category === 'CATALOG_ADAPTER_QUERY_FAILED' ||
      category === 'COLLECTOR_FAILED') {
    return attemptedSessions > 0
      ? 'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN'
      : 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
  }

  // Unknown category: use session count to determine
  return attemptedSessions > 0
    ? 'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN'
    : 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
}

// ─── Single bounded output writer ───────────────────────────────────────────

function printOutput(outcome, sessionCount) {
  if (!VALID_OUTCOMES.includes(outcome)) outcome = 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
  const out = {
    format_version: '1.0',
    outcome,
    bounded_category: outcome,
    collection_session_count: typeof sessionCount === 'number' ? sessionCount : 0,
    attestation_status: 'UNATTESTED',
    manifest_activation: 'NONE',
    schema_mutation: 'NONE',
    data_mutation: 'NONE',
    credential_change: 'NONE',
    privilege_change: 'NONE',
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exitCode = outcome === 'COLLECTION_PASS_SANITIZED_EVIDENCE_READY' ? 0 : 1;
}

// ─── Scoped helpers ─────────────────────────────────────────────────────────

function loadJson(relPath) {
  const abs = path.resolve(REPO_ROOT, relPath);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function readFileBytes(relPath) {
  return fs.readFileSync(path.resolve(REPO_ROOT, relPath));
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(state) {
  const args = process.argv.slice(2);
  let secretFile, roleMappingFile, baselineCommit, approvalReference, repeat = '1';
  let seenFlags = new Set();

  // ── Parse args with exact repeat parsing & duplicate detection ──
  let parseError = false;
  try {
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (!arg.startsWith('--')) { parseError = true; break; }
      if (FORBIDDEN_FLAGS.has(arg)) { parseError = true; break; }

      if (arg === '--repeat') {
        if (seenFlags.has('--repeat')) { parseError = true; break; }
        seenFlags.add('--repeat');
        const val = args[i + 1];
        if (!val || val.startsWith('--')) { parseError = true; break; }
        // Exact match only: '1' or '2' — no parseInt, no leading zeros, no junk
        if (val !== '1' && val !== '2') { parseError = true; break; }
        repeat = val;
        i += 1;
        continue;
      }

      if (!ALLOWED_FLAGS.has(arg)) { parseError = true; break; }

      // Duplicate flag detection
      if (seenFlags.has(arg)) { parseError = true; break; }
      seenFlags.add(arg);

      const next = args[i + 1];
      if (!next || next.startsWith('--')) { parseError = true; break; }
      switch (arg) {
        case '--secret-file': secretFile = next; break;
        case '--role-mapping-file': roleMappingFile = next; break;
        case '--baseline-commit': baselineCommit = next; break;
        case '--approval-reference': approvalReference = next; break;
      }
      i += 1;
    }
  } catch {
    parseError = true;
  }
  if (parseError) {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 0);
    return;
  }

  // ── Required fields check ──
  if (!secretFile || !roleMappingFile || !baselineCommit || !approvalReference) {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 0);
    return;
  }

  // ── Baseline commit validation ──
  if (!/^[a-f0-9]{40}$/.test(baselineCommit)) {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 0);
    return;
  }

  // ── Approval reference validation ──
  if (!/^(?:issue:\d+|decision:[A-Za-z0-9][A-Za-z0-9._-]{2,63})$/.test(approvalReference)) {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 0);
    return;
  }

  // ── Safe HEAD binding via execFile sync ──
  let actualHead;
  try {
    actualHead = require('child_process').execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      timeout: 5000,
      maxBuffer: 1024,
    }).trim();
  } catch {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 0);
    return;
  }
  if (!/^[a-f0-9]{40}$/.test(actualHead) || actualHead !== baselineCommit) {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 0);
    return;
  }

  // ── Build trusted prepared plan ──
  let preparedPlan;
  try {
    preparedPlan = buildPreparedCollectionPlan({ baselineCommit, approvalReference });
  } catch {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 0);
    return;
  }

  // ── Load repository-owned contracts (exact bytes for digests) ──
  let canonicalManifest, expectedSchemaManifest, boundaryContractBytes, catalogMetadataContractBytes;
  try {
    canonicalManifest = loadJson('db/migration-provenance/canonical-migrations.json');
    expectedSchemaManifest = loadJson('db/migration-provenance/expected-schema-manifest.json');
    boundaryContractBytes = readFileBytes('db/migration-provenance/production-readonly-catalog-boundary-contract.json');
    catalogMetadataContractBytes = readFileBytes('db/migration-provenance/catalog-metadata-contract.json');
  } catch {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 0);
    return;
  }

  // ── Round 1: call public collector ──
  let evidence1;
  try {
    state.attemptedSessions = 1;
    evidence1 = await collectProductionReadonlyCatalogEvidenceFromFiles({
      secretFile,
      roleMappingFile,
    });
  } catch (err) {
    const outcome = mapFailure(err && err.category, state.attemptedSessions);
    printOutput(outcome, state.attemptedSessions);
    return;
  }

  // ── Round 2: if --repeat 2, canonical comparison in bounded block ──
  if (repeat === '2') {
    let evidence2;
    try {
      state.attemptedSessions = 2;
      evidence2 = await collectProductionReadonlyCatalogEvidenceFromFiles({
        secretFile,
        roleMappingFile,
      });
    } catch (err) {
      const outcome = mapFailure(err && err.category, state.attemptedSessions);
      printOutput(outcome, state.attemptedSessions);
      return;
    }

    // Bounded repeat comparison: validate artifacts then compare digests
    try {
      // 1-2: validate both artifacts
      validateArtifact(evidence1);
      validateArtifact(evidence2);
      // 3: canonical digest comparison
      const dig1 = computeObjectDigest(evidence1);
      const dig2 = computeObjectDigest(evidence2);
      // 4: compare
      if (dig1 !== dig2) {
        printOutput(mapFailure('REPEAT_MISMATCH', state.attemptedSessions), state.attemptedSessions);
        return;
      }
    } catch {
      // Any validation/comparison failure keeps session count = 2
      printOutput('COLLECTION_FAIL_SANITIZATION', state.attemptedSessions);
      return;
    }
  }

  // ── Build inactive expected-schema candidate ──
  let schemaCandidate;
  try {
    schemaCandidate = buildExpectedSchemaCandidate(evidence1, expectedSchemaManifest);
  } catch {
    printOutput(mapFailure('CANDIDATE_FAILED', state.attemptedSessions), state.attemptedSessions);
    return;
  }

  // ── Build prepared UNATTESTED attestation draft ──
  let attestationDraft;
  try {
    attestationDraft = buildPreparedUnattestedAttestationDraft({
      preparedPlan,
      // NOTE: No validatePlanFn — module-owned validator only
      migrationManifest: canonicalManifest,
      expectedSchemaCandidate: schemaCandidate,
      catalogEvidence: evidence1,
    });
  } catch {
    printOutput(mapFailure('ATTESTATION_DRAFT_FAILED', state.attemptedSessions), state.attemptedSessions);
    return;
  }

  // ── Build final receipt (digests recomputed internally via module-owned validator) ──
  let receipt;
  try {
    receipt = buildCollectionReceipt({
      preparedPlan,
      // NOTE: No validatePlanFn — module-owned validator only
      boundaryContractBytes,
      catalogMetadataContractBytes,
      canonicalManifest,
      expectedSchemaManifest,
      catalogEvidence: evidence1,
      inactiveExpectedSchemaCandidate: schemaCandidate,
      preparedAttestationDraft: attestationDraft,
      collectionSessionCount: state.attemptedSessions,
    });
  } catch (err) {
    const outcome = mapFailure(err && err.category, state.attemptedSessions);
    printOutput(outcome, state.attemptedSessions);
    return;
  }

  // ── Single output point ──
  try {
    process.stdout.write(serializeCollectionReceipt(receipt));
    process.exitCode = 0;
  } catch {
    printOutput(mapFailure('RECEIPT_SERIALIZATION_FAILED', state.attemptedSessions), state.attemptedSessions);
  }
}

const _state = { attemptedSessions: 0 };
main(_state).catch(() => {
  printOutput(
    _state.attemptedSessions > 0
      ? 'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN'
      : 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY',
    _state.attemptedSessions
  );
});
