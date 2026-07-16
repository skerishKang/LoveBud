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
const crypto = require('node:crypto');
const fs = require('node:fs');

// ─── Repository-owned core modules (NO require('pg')) ────────────────────────
const { collectProductionReadonlyCatalogEvidenceFromFiles } = require(
  path.resolve(__dirname, 'migration-catalog-postgres-adapter-core.cjs')
);
const {
  buildExpectedSchemaCandidate,
  serializeExpectedSchemaCandidate,
} = require(path.resolve(__dirname, 'expected-schema-candidate-core.cjs'));
const {
  computeObjectDigest,
  buildPreparedUnattestedAttestationDraft,
} = require(path.resolve(__dirname, 'adoption-attestation-core.cjs'));
const {
  buildCollectionReceipt,
  serializeCollectionReceipt,
  computeDigest,
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

const VALID_OUTCOMES = Object.freeze([
  'COLLECTION_PASS_SANITIZED_EVIDENCE_READY',
  'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY',
  'COLLECTION_FAIL_READONLY_PROOF',
  'COLLECTION_FAIL_ALLOWLIST_OR_METADATA_CONTRACT',
  'COLLECTION_FAIL_SANITIZATION',
  'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN',
]);

// ─── Single bounded output writer ───────────────────────────────────────────

function printOutput(outcome, category, sessionCount) {
  if (!VALID_OUTCOMES.includes(outcome)) outcome = 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
  const out = {
    format_version: '1.0',
    outcome,
    bounded_category: category || outcome,
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

// ─── Scoped helper for git HEAD check ──────────────────────────────────────

function loadJson(relPath) {
  const abs = path.resolve(REPO_ROOT, relPath);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function readFileBytes(relPath) {
  return fs.readFileSync(path.resolve(REPO_ROOT, relPath));
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let secretFile, roleMappingFile, baselineCommit, approvalReference, repeat = 1;
  let attemptedSessions = 0;

  // ── Parse args (no output in parser — throw up to main) ──
  try {
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (!arg.startsWith('--')) throw Object.assign(new Error('unknown'), { category: 'INPUT_INVALID' });
      if (FORBIDDEN_FLAGS.has(arg)) throw Object.assign(new Error('forbidden'), { category: 'INPUT_INVALID' });
      if (arg === '--repeat') {
        const val = args[i + 1];
        if (!val || val.startsWith('--')) throw Object.assign(new Error('missing'), { category: 'INPUT_INVALID' });
        repeat = parseInt(val, 10);
        if (!Number.isInteger(repeat) || repeat < 1 || repeat > 2) {
          throw Object.assign(new Error('out_of_range'), { category: 'INPUT_INVALID' });
        }
        i += 1;
        continue;
      }
      if (!ALLOWED_FLAGS.has(arg)) throw Object.assign(new Error('unknown'), { category: 'INPUT_INVALID' });
      const next = args[i + 1];
      if (!next || next.startsWith('--')) throw Object.assign(new Error('missing'), { category: 'INPUT_INVALID' });
      switch (arg) {
        case '--secret-file': secretFile = next; break;
        case '--role-mapping-file': roleMappingFile = next; break;
        case '--baseline-commit': baselineCommit = next; break;
        case '--approval-reference': approvalReference = next; break;
      }
      i += 1;
    }
  } catch (err) {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', err.category || 'INPUT_INVALID', 0);
    return;
  }

  // ── Required fields check ──
  if (!secretFile || !roleMappingFile || !baselineCommit || !approvalReference) {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 'INPUT_INVALID', 0);
    return;
  }

  // ── Baseline commit validation ──
  if (!/^[a-f0-9]{40}$/.test(baselineCommit)) {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 'BASELINE_INVALID', 0);
    return;
  }

  // ── Approving reference validation ──
  if (!/^(?:issue:\d+|decision:[A-Za-z0-9][A-Za-z0-9._-]{2,63})$/.test(approvalReference)) {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 'APPROVAL_INVALID', 0);
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
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 'HEAD_UNRESOLVABLE', 0);
    return;
  }

  const sha40 = /^[a-f0-9]{40}$/;
  if (!sha40.test(actualHead) || actualHead !== baselineCommit) {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 'BASELINE_HEAD_MISMATCH', 0);
    return;
  }

  // ── Build trusted prepared plan ──
  let preparedPlan;
  try {
    preparedPlan = buildPreparedCollectionPlan({
      baselineCommit,
      approvalReference,
    });
  } catch {
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 'PLAN_FAILED', 0);
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
    printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 'CONTRACT_LOAD_FAILED', 0);
    return;
  }

  // ── Round 1: call public collector ──
  let evidence1;
  try {
    attemptedSessions = 1;
    evidence1 = await collectProductionReadonlyCatalogEvidenceFromFiles({
      secretFile,
      roleMappingFile,
    });
  } catch (err) {
    const cat = err.category && err.category.startsWith('CATALOG_ADAPTER_')
      ? 'COLLECTION_FAIL_READONLY_PROOF'
      : 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
    printOutput(cat, err.category || 'COLLECTOR_FAILED', attemptedSessions);
    return;
  }

  // ── Round 2: if --repeat 2 ──
  if (repeat === 2) {
    let evidence2;
    try {
      attemptedSessions = 2;
      evidence2 = await collectProductionReadonlyCatalogEvidenceFromFiles({
        secretFile,
        roleMappingFile,
      });
    } catch (err) {
      const cat = err.category && err.category.startsWith('CATALOG_ADAPTER_')
        ? 'COLLECTION_FAIL_READONLY_PROOF'
        : 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
      printOutput(cat, err.category || 'COLLECTOR_FAILED', attemptedSessions);
      return;
    }

    // Canonical serialization comparison (not JSON.stringify insertion order)
    const json1 = JSON.stringify(evidence1);
    const json2 = JSON.stringify(evidence2);
    if (json1 !== json2) {
      printOutput('COLLECTION_FAIL_PARTIAL_OR_UNKNOWN', 'REPEAT_MISMATCH', 2);
      return;
    }
  }

  // ── Build inactive expected-schema candidate ──
  let schemaCandidate, candidateJson;
  try {
    schemaCandidate = buildExpectedSchemaCandidate(evidence1, expectedSchemaManifest);
    candidateJson = serializeExpectedSchemaCandidate(schemaCandidate);
  } catch {
    printOutput('COLLECTION_FAIL_SANITIZATION', 'CANDIDATE_FAILED', attemptedSessions);
    return;
  }

  // ── Build prepared UNATTESTED attestation draft ──
  let attestationDraft;
  try {
    attestationDraft = buildPreparedUnattestedAttestationDraft({
      preparedPlan,
      migrationManifest: canonicalManifest,
      expectedSchemaCandidate: schemaCandidate,
      catalogEvidence: evidence1,
    });
  } catch {
    printOutput('COLLECTION_FAIL_SANITIZATION', 'ATTESTATION_DRAFT_FAILED', attemptedSessions);
    return;
  }

  // ── Build final receipt (digests recomputed internally) ──
  let receipt;
  try {
    receipt = buildCollectionReceipt({
      preparedPlan,
      boundaryContractBytes,
      catalogMetadataContractBytes,
      canonicalManifest,
      expectedSchemaManifest,
      catalogEvidence: evidence1,
      inactiveExpectedSchemaCandidate: schemaCandidate,
      preparedAttestationDraft: attestationDraft,
      collectionSessionCount: attemptedSessions,
    });
  } catch (err) {
    const cat = err.category === 'RECEIPT_DIGEST_MISMATCH'
      ? 'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN'
      : 'COLLECTION_FAIL_SANITIZATION';
    printOutput(cat, err.category || 'RECEIPT_FAILED', attemptedSessions);
    return;
  }

  // ── Single output point ──
  try {
    process.stdout.write(serializeCollectionReceipt(receipt));
    process.exitCode = 0;
  } catch {
    printOutput('COLLECTION_FAIL_SANITIZATION', 'SERIALIZATION_FAILED', attemptedSessions);
  }
}

main().catch(() => {
  printOutput('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', 'UNEXPECTED', 0);
});
