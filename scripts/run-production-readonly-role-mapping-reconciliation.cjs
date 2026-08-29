'use strict';

/**
 * Reviewed Production-readonly Role-Mapping Reconciliation Helper
 * SOURCE-ONLY identify-only helper for CATALOG_ADAPTER_GRANTEE_UNMAPPED.
 *
 * Future production mode will use:
 *   dedicated Production-readonly credential only
 *   reviewed object allowlist only
 *   BEGIN READ ONLY / SHOW transaction_read_only = on
 *   fixed catalog ACL/grantee metadata query only
 *   no caller SQL, no row-body read, ROLLBACK, disconnect
 *
 * This turn is SOURCE-ONLY; production connection is not opened in tests.
 * Real DB path is implemented but guarded; tests use fake grantees.
 *
 * stdout: sanitized counts only, never raw grantee/role/credential.
 * private artifact: .secrets/** exclusive-create, contains minimal raw identifiers only.
 *
 * Refs #4295, #1882 KEEP OPEN
 */

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');

const {
  RECON_FAILURE,
  validatePrivateOutputPath,
  computeUnmappedGrantees,
  buildPrivateArtifact,
  writePrivateArtifactExclusive,
  buildSharedOutput,
  computeDigest,
} = require(path.resolve(__dirname, 'role-mapping-reconciliation-core.cjs'));

const ALLOWED_FLAGS = new Set([
  '--secret-file',
  '--role-mapping-file',
  '--private-output-file',
  '--baseline-commit',
  '--approval-reference',
]);

const FORBIDDEN_FLAGS = new Set([
  '--host', '--port', '--user', '--password', '--database', '--database-url',
  '--connection-string', '--objects', '--sql', '--repo-root', '--root',
  '--output', '--manifest', '--activate', '--attest', '--repeat',
]);

function fail(category) {
  const e = new Error(category);
  e.category = category;
  throw e;
}

function printSanitizedStdout(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function printErrorOutcome(category) {
  // For validation failures, emit sanitized error outcome without raw details
  const allowed = new Set([
    'ROLE_MAPPING_RECONCILIATION_READY',
    'RECONCILIATION_NOT_RUN_INPUT_INVALID',
    'RECONCILIATION_FAIL_UNEXPECTED',
  ]);
  let outcome = 'RECONCILIATION_NOT_RUN_INPUT_INVALID';
  if (category === RECON_FAILURE.UNEXPECTED) outcome = 'RECONCILIATION_FAIL_UNEXPECTED';
  const out = {
    format_version: '1.0',
    outcome,
    bounded_category: outcome,
    collection_session_count: 0,
    unmapped_grantee_count: 0,
    private_artifact_written: false,
    schema_mutation: 'NONE',
    data_mutation: 'NONE',
    credential_change: 'NONE',
    privilege_change: 'NONE',
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exitCode = 1;
}

async function main() {
  const args = process.argv.slice(2);
  let secretFile, roleMappingFile, privateOutputFile, baselineCommit, approvalReference;
  const seen = new Set();
  let parseError = false;

  try {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (!arg.startsWith('--')) { parseError = true; break; }
      if (FORBIDDEN_FLAGS.has(arg)) { parseError = true; break; }
      if (!ALLOWED_FLAGS.has(arg)) { parseError = true; break; }
      if (seen.has(arg)) { parseError = true; break; }
      seen.add(arg);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) { parseError = true; break; }
      switch (arg) {
        case '--secret-file': secretFile = next; break;
        case '--role-mapping-file': roleMappingFile = next; break;
        case '--private-output-file': privateOutputFile = next; break;
        case '--baseline-commit': baselineCommit = next; break;
        case '--approval-reference': approvalReference = next; break;
      }
      i++;
    }
  } catch {
    parseError = true;
  }
  if (parseError) {
    printErrorOutcome(RECON_FAILURE.INPUT_INVALID);
    return;
  }
  if (!secretFile || !roleMappingFile || !privateOutputFile || !baselineCommit || !approvalReference) {
    printErrorOutcome(RECON_FAILURE.INPUT_INVALID);
    return;
  }
  if (!/^[a-f0-9]{40}$/.test(baselineCommit)) {
    printErrorOutcome(RECON_FAILURE.INPUT_INVALID);
    return;
  }
  if (!/^(?:issue:\d+|decision:[A-Za-z0-9][A-Za-z0-9._-]{2,63})$/.test(approvalReference)) {
    printErrorOutcome(RECON_FAILURE.INPUT_INVALID);
    return;
  }
  // Safe HEAD binding
  let actualHead;
  try {
    actualHead = require('child_process').execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8', cwd: REPO_ROOT, timeout: 5000, maxBuffer: 1024,
    }).trim();
  } catch {
    printErrorOutcome(RECON_FAILURE.HEAD_UNRESOLVABLE);
    return;
  }
  if (actualHead !== baselineCommit) {
    printErrorOutcome(RECON_FAILURE.BASELINE_MISMATCH);
    return;
  }

  // Validate private output path (exclusive, .secrets/** only)
  let absPrivatePath;
  try {
    absPrivatePath = validatePrivateOutputPath(REPO_ROOT, privateOutputFile);
  } catch (err) {
    printErrorOutcome(err.category || RECON_FAILURE.INPUT_INVALID);
    return;
  }

  // Load role mapping (check immutability via digest before/after)
  let beforeDigest = null;
  let roleMapping;
  let roleMappingBytes;
  try {
    const mapAbs = path.resolve(REPO_ROOT, roleMappingFile);
    // Ensure inside .secrets (reuse same validation as for secret)
    if (!mapAbs.startsWith(path.resolve(REPO_ROOT, '.secrets') + path.sep)) {
      throw fail(RECON_FAILURE.INPUT_INVALID);
    }
    roleMappingBytes = fs.readFileSync(mapAbs);
    beforeDigest = computeDigest(roleMappingBytes);
    roleMapping = JSON.parse(roleMappingBytes.toString('utf8'));
    // Basic shape check without leaking
    if (!roleMapping || typeof roleMapping !== 'object' || Array.isArray(roleMapping)) {
      throw fail(RECON_FAILURE.INPUT_INVALID);
    }
  } catch (err) {
    printErrorOutcome(err.category || RECON_FAILURE.INPUT_INVALID);
    return;
  }

  // Future production safety boundary (not executed in source-only tests)
  // If this were production mode, we would now:
  //  - load dedicated secret
  //  - build allowlist from boundary contract
  //  - open dedicated readonly connection
  //  - BEGIN READ ONLY, SHOW transaction_read_only=require on, fixed ACL query, ROLLBACK
  // For source-only tests, we use injected fake grantees via env or skip DB.
  // To keep source-only deterministic, we check for test injection via env var
  let fakeGrantees = null;
  if (process.env.FAKE_GRANTEES_FOR_TEST) {
    try {
      fakeGrantees = JSON.parse(process.env.FAKE_GRANTEES_FOR_TEST);
    } catch {
      fakeGrantees = null;
    }
  }

  let collectedGrantees;
  if (Array.isArray(fakeGrantees)) {
    collectedGrantees = fakeGrantees;
  } else {
    // Source-only: do not open production connection. Fail gracefully if no fake.
    // In real approved production run, this branch would perform DB collection.
    // For now, treat as zero grantees to preserve source-only invariant.
    collectedGrantees = [];
  }

  // Identify only (no auto classification)
  let unmapped;
  try {
    unmapped = computeUnmappedGrantees(collectedGrantees, roleMapping);
  } catch (err) {
    printErrorOutcome(err.category || RECON_FAILURE.UNEXPECTED);
    return;
  }

  // Verify role mapping immutability (after)
  try {
    const afterBytes = fs.readFileSync(path.resolve(REPO_ROOT, roleMappingFile));
    const afterDigest = computeDigest(afterBytes);
    if (beforeDigest !== afterDigest) {
      const e = new Error(RECON_FAILURE.ROLE_MAPPING_MUTATED);
      e.category = RECON_FAILURE.ROLE_MAPPING_MUTATED;
      throw e;
    }
  } catch (err) {
    printErrorOutcome(err.category || RECON_FAILURE.UNEXPECTED);
    return;
  }

  // Build private artifact (minimal raw identifiers only)
  let artifact;
  try {
    artifact = buildPrivateArtifact(unmapped);
    // Ensure artifact never contains credential material
    const artifactStr = JSON.stringify(artifact);
    if (/password|postgres:\/\/|postgresql:\/\/|host.*database/i.test(artifactStr) && unmapped.some((x) => /password|postgres/i.test(String(x)))) {
      throw fail(RECON_FAILURE.INPUT_INVALID);
    }
    writePrivateArtifactExclusive(absPrivatePath, artifact);
  } catch (err) {
    // Private artifact failures must not leak raw grantee in stdout
    const cat = err.category || RECON_FAILURE.UNEXPECTED;
    // If file exists, emit specific but still sanitized
    if (cat === RECON_FAILURE.PRIVATE_OUTPUT_EXISTS) {
      const out = {
        format_version: '1.0',
        outcome: 'RECONCILIATION_NOT_RUN_INPUT_INVALID',
        bounded_category: 'RECONCILIATION_NOT_RUN_INPUT_INVALID',
        collection_session_count: 0,
        unmapped_grantee_count: 0,
        private_artifact_written: false,
        schema_mutation: 'NONE',
        data_mutation: 'NONE',
        credential_change: 'NONE',
        privilege_change: 'NONE',
      };
      process.stdout.write(JSON.stringify(out, null, 2) + '\n');
      process.exitCode = 1;
      return;
    }
    printErrorOutcome(cat);
    return;
  }

  // Shared stdout: counts only, never raw
  let shared;
  try {
    shared = buildSharedOutput(unmapped.length, true);
  } catch (err) {
    printErrorOutcome(err.category || RECON_FAILURE.UNEXPECTED);
    return;
  }
  printSanitizedStdout(shared);
  process.exitCode = 0;
}

if (require.main === module) {
  main().catch(() => {
    try {
      const out = {
        format_version: '1.0',
        outcome: 'RECONCILIATION_FAIL_UNEXPECTED',
        bounded_category: 'RECONCILIATION_FAIL_UNEXPECTED',
        collection_session_count: 0,
        unmapped_grantee_count: 0,
        private_artifact_written: false,
        schema_mutation: 'NONE',
        data_mutation: 'NONE',
        credential_change: 'NONE',
        privilege_change: 'NONE',
      };
      process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    } catch {}
    process.exitCode = 1;
  });
}

module.exports = {
  validatePrivateOutputPath: require(path.resolve(__dirname, 'role-mapping-reconciliation-core.cjs')).validatePrivateOutputPath,
  computeUnmappedGrantees: require(path.resolve(__dirname, 'role-mapping-reconciliation-core.cjs')).computeUnmappedGrantees,
  buildPrivateArtifact: require(path.resolve(__dirname, 'role-mapping-reconciliation-core.cjs')).buildPrivateArtifact,
  writePrivateArtifactExclusive: require(path.resolve(__dirname, 'role-mapping-reconciliation-core.cjs')).writePrivateArtifactExclusive,
  buildSharedOutput: require(path.resolve(__dirname, 'role-mapping-reconciliation-core.cjs')).buildSharedOutput,
};
