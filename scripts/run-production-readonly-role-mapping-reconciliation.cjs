'use strict';

/**
 * Reviewed Production-readonly Role-Mapping Reconciliation Helper
 * Identify-only helper for CATALOG_ADAPTER_GRANTEE_UNMAPPED.
 *
 * Future approved production run will use:
 *   dedicated Production-readonly credential only via boundary
 *   reviewed object allowlist only
 *   BEGIN READ ONLY / SHOW transaction_read_only = on / SHOW server_version_num
 *   fixed catalog ACL + RLS policy queries only
 *   no caller SQL, no row-body read, ROLLBACK, disconnect
 *
 * Source-only turn: no Production connection opened in tests except via
 * explicitly injected collector. Real path always uses reviewed collector.
 *
 * stdout: sanitized counts only, never raw grantee/OID/credential.
 * private artifact: .secrets/** exclusive-create, minimal identifiers only.
 *
 * Refs #4295, #4304, #1882 KEEP OPEN
 */

const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');

// This ephemeral candidate is enabled only on its separately approved branch.
// It must never be merged to main; there is intentionally no runtime override.
const PRODUCTION_RECONCILIATION_EXECUTION_ENABLED = true;
const PRODUCTION_RECONCILIATION_APPROVAL_REFERENCE = 'issue:4295';

function isSourceBoundApprovalReference(approvalReference) {
  return approvalReference === PRODUCTION_RECONCILIATION_APPROVAL_REFERENCE;
}

const {
  RECON_FAILURE,
  validatePrivateOutputPath,
  validateSecretsInputPath,
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

function printSanitizedStdout(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function printErrorOutcome(count) {
  const out = {
    format_version: '1.0',
    outcome: 'RECONCILIATION_NOT_RUN_INPUT_INVALID',
    bounded_category: 'RECONCILIATION_NOT_RUN_INPUT_INVALID',
    collection_session_count: typeof count === 'number' ? count : 0,
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

function printUnexpected(count) {
  const out = {
    format_version: '1.0',
    outcome: 'RECONCILIATION_FAIL_UNEXPECTED',
    bounded_category: 'RECONCILIATION_FAIL_UNEXPECTED',
    collection_session_count: typeof count === 'number' ? count : 0,
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

function printSourceOnlyGate() {
  const out = {
    format_version: '1.0',
    outcome: 'RECONCILIATION_NOT_RUN_SOURCE_ONLY_GATE',
    bounded_category: 'RECONCILIATION_NOT_RUN_SOURCE_ONLY_GATE',
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

/**
 * Load the private role mapping through the same boundary normalization used by
 * the no-connect preflight while preserving a digest of the exact original file
 * bytes for the post-collection immutability check.
 *
 * The boundary accepts both the direct mapping object and the reviewed
 * { role_mapping: { ... } } wrapper and returns one normalized mapping object.
 */
function loadRoleMappingWithDigest(repoRoot, roleMappingFile) {
  const boundary = require(path.resolve(__dirname, 'production-readonly-catalog-boundary-core.cjs'));
  const mapAbs = path.resolve(repoRoot, roleMappingFile);
  const bytes = fs.readFileSync(mapAbs);
  const beforeDigest = computeDigest(bytes);
  const roleMapping = boundary.loadProductionRoleMapping(repoRoot, roleMappingFile);
  return { beforeDigest, roleMapping };
}

/**
 * Real reviewed Production-readonly grantee collector.
 * Reuses boundary and adapter authority, no caller-controlled host/objects/sql.
 * Collects union of ACL grantees and RLS policy role grantees.
 * PUBLIC always considered mapped. Unresolvable policy role → fail-closed.
 */
async function realCollectRawGrantees(repoRoot, secretFile, roleMappingFile, state) {
  const boundary = require(path.resolve(__dirname, 'production-readonly-catalog-boundary-core.cjs'));
  const adapter = require(path.resolve(__dirname, 'migration-catalog-postgres-adapter-core.cjs'));
  const { Client } = require('pg');
  // Build plan via dedicated boundary (same as Phase B collector)
  let plan = null;
  let privateParts, validatedObjects;
  let pgConfig, objects, roleMapping;
  try {
    plan = boundary.buildProductionReadonlyInvocationPlan({ secretFile, roleMappingFile });
    privateParts = boundary.getPrivateInvocationParts(plan);
    pgConfig = privateParts.pgConfig; objects = privateParts.objects; roleMapping = privateParts.roleMapping;
    adapter.validateRoleMapping(roleMapping);
    const maxObjects = 256;
    validatedObjects = adapter.validateObjectAllowlist(objects, maxObjects);
    const client = new Client(pgConfig);
    const granteesSet = new Set();
    let startedTxn = false;
    try {
      await client.connect();
      state.collection_session_count = 1;
      await client.query(adapter.Q.BEGIN_RO);
      startedTxn = true;
      const roRes = await client.query(adapter.Q.SHOW_RO);
      const roVal = roRes.rows[0] && (roRes.rows[0].transaction_read_only || Object.values(roRes.rows[0])[0]);
      if (String(roVal).toLowerCase() !== 'on') {
        const e = new Error(RECON_FAILURE.UNEXPECTED);
        e.category = adapter.ADAPTER_FAILURE.CATALOG_ADAPTER_READ_ONLY_REQUIRED;
        throw e;
      }
      const verRes = await client.query(adapter.Q.SHOW_VER);
      const verRaw = verRes.rows[0] && (verRes.rows[0].server_version_num || Object.values(verRes.rows[0])[0]);
      boundary.assertSupportedProductionServerVersionNum(verRaw);

      // Fixed repository-owned catalog queries only (union of grants + policy roles)
      for (const target of validatedObjects) {
        const relRes = await client.query(adapter.Q.RELATION, [target.schema, target.object_name]);
        const rel = adapter.classifyRelationRows(relRes.rows, target.object_kind);
        const oid = rel.oid;
        // grants — fail-closed on null/empty/non-string
        const grRes = await client.query(adapter.Q.GRANTS, [target.schema, target.object_name]);
        for (const r of grRes.rows) {
          const g = r.grantee;
          if (g == null || g === '' || typeof g !== 'string') {
            const e = new Error(RECON_FAILURE.GRANTEE_UNRESOLVABLE);
            e.category = RECON_FAILURE.GRANTEE_UNRESOLVABLE;
            throw e;
          }
          granteesSet.add(String(g));
        }
        // policies
        const pRes = await client.query(adapter.Q.POLICIES, [oid]);
        for (const prow of pRes.rows) {
          const oids = prow.polroles || [];
          if (oids.length === 0) {
            granteesSet.add('PUBLIC');
          } else {
            for (const oidVal of oids) {
              const num = Number(oidVal);
              if (num === 0) { granteesSet.add('PUBLIC'); continue; }
              const roleRes = await client.query(adapter.Q.ROLE_NAME, [num]);
              if (!roleRes.rows || roleRes.rows.length !== 1) {
                const e = new Error(RECON_FAILURE.POLICY_ROLE_UNRESOLVABLE);
                e.category = RECON_FAILURE.POLICY_ROLE_UNRESOLVABLE;
                throw e;
              }
              const rolname = roleRes.rows[0].rolname;
              if (typeof rolname !== 'string' || !rolname) {
                const e = new Error(RECON_FAILURE.POLICY_ROLE_UNRESOLVABLE);
                e.category = RECON_FAILURE.POLICY_ROLE_UNRESOLVABLE;
                throw e;
              }
              granteesSet.add(String(rolname));
            }
          }
        }
      }
      return [...granteesSet];
    } finally {
      if (startedTxn) {
        try { await client.query(adapter.Q.ROLLBACK); } catch {}
      }
      try { await client.end(); } catch {}
    }
  } finally {
    if (plan) { try { boundary.releaseInvocationPlan(plan); } catch {} }
  }
}

/**
 * Internal helper for tests with injected collector (no env var).
 * @param {object} opts - { repoRoot, secretFile, roleMappingFile, privateOutputFile, baselineCommit, approvalReference, collectGranteesFn }
 */
async function runReconciliationWithDeps(opts) {
  const { repoRoot, secretFile, roleMappingFile, privateOutputFile, baselineCommit, approvalReference, collectGranteesFn } = opts;
  const state = { collection_session_count: 0 };
  // The injected seam must obey the same source-bound approval contract before
  // any private path/input validation or collector/artifact activity.
  if (!isSourceBoundApprovalReference(approvalReference)) {
    return {
      outcome: 'RECONCILIATION_NOT_RUN_SOURCE_ONLY_GATE',
      bounded_category: 'RECONCILIATION_NOT_RUN_SOURCE_ONLY_GATE',
      collection_session_count: 0,
      private_artifact_written: false,
    };
  }
  // validate private output path
  let absPrivate;
  try {
    absPrivate = validatePrivateOutputPath(repoRoot, privateOutputFile);
  } catch (err) {
    return { outcome: 'RECONCILIATION_NOT_RUN_INPUT_INVALID', collection_session_count: 0, errorCategory: err.category };
  }
  // validate inputs via realpath
  try {
    validateSecretsInputPath(repoRoot, secretFile);
    validateSecretsInputPath(repoRoot, roleMappingFile);
  } catch (err) {
    return { outcome: 'RECONCILIATION_NOT_RUN_INPUT_INVALID', collection_session_count: 0, errorCategory: err.category };
  }
  // baseline check (caller ensures)
  if (!/^[a-f0-9]{40}$/.test(baselineCommit)) {
    return { outcome: 'RECONCILIATION_NOT_RUN_INPUT_INVALID', collection_session_count: 0 };
  }
  // Load and normalize through the same boundary contract as the preflight,
  // while digesting the original bytes for immutability.
  let beforeDigest, roleMapping;
  try {
    ({ beforeDigest, roleMapping } = loadRoleMappingWithDigest(repoRoot, roleMappingFile));
  } catch (err) {
    return { outcome: 'RECONCILIATION_NOT_RUN_INPUT_INVALID', collection_session_count: 0, errorCategory: err.category || RECON_FAILURE.ROLE_MAPPING_INVALID };
  }
  // collect grantees via injected fake collector
  let collected;
  try {
    collected = await collectGranteesFn();
    // must not be assumed session; caller provides fake, so session count stays 0 for source-only fake?
    // For test seam, we keep collection_session_count as 0 to distinguish from real production session.
    // Tests will assert that fake does not imply production session.
  } catch (err) {
    return { outcome: 'RECONCILIATION_FAIL_UNEXPECTED', collection_session_count: 0, errorCategory: err.category };
  }
  let unmapped;
  try {
    unmapped = computeUnmappedGrantees(collected, roleMapping);
  } catch (err) {
    return { outcome: 'RECONCILIATION_FAIL_UNEXPECTED', collection_session_count: 0 };
  }
  // immutability check
  try {
    const afterBytes = fs.readFileSync(path.resolve(repoRoot, roleMappingFile));
    if (computeDigest(afterBytes) !== beforeDigest) {
      return { outcome: 'RECONCILIATION_FAIL_UNEXPECTED', collection_session_count: 0, errorCategory: RECON_FAILURE.ROLE_MAPPING_MUTATED };
    }
  } catch (err) {
    return { outcome: 'RECONCILIATION_FAIL_UNEXPECTED', collection_session_count: 0 };
  }
  let artifact;
  try {
    artifact = buildPrivateArtifact(unmapped);
    writePrivateArtifactExclusive(absPrivate, artifact);
  } catch (err) {
    return { outcome: 'RECONCILIATION_NOT_RUN_INPUT_INVALID', collection_session_count: 0, errorCategory: err.category };
  }
  const shared = buildSharedOutput(unmapped.length, true, 0);
  return { outcome: shared.outcome, collection_session_count: 0, unmapped, artifact, shared };
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
  } catch { parseError = true; }
  if (parseError) { printErrorOutcome(0); return; }
  if (!secretFile || !roleMappingFile || !privateOutputFile || !baselineCommit || !approvalReference) {
    printErrorOutcome(0); return;
  }
  if (!/^[a-f0-9]{40}$/.test(baselineCommit)) { printErrorOutcome(0); return; }
  if (!/^(?:issue:\d+|decision:[A-Za-z0-9][A-Za-z0-9._-]{2,63})$/.test(approvalReference)) { printErrorOutcome(0); return; }
  // Reject every caller-supplied authority before any private input access,
  // boundary load, collector, artifact write, client construction, or connect.
  if (!isSourceBoundApprovalReference(approvalReference)) {
    printSourceOnlyGate(); return;
  }
  let actualHead;
  try {
    actualHead = require('child_process').execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: REPO_ROOT, timeout: 5000, maxBuffer: 1024 }).trim();
  } catch { printErrorOutcome(0); return; }
  if (actualHead !== baselineCommit) { printErrorOutcome(0); return; }

  // This source-only child cannot perform private-file or Production activity.
  // Keep this before all .secrets access, artifact handling, and collector code.
  if (!PRODUCTION_RECONCILIATION_EXECUTION_ENABLED) {
    printSourceOnlyGate(); return;
  }

  // Validate private output path before any DB
  let absPrivate;
  try {
    absPrivate = validatePrivateOutputPath(REPO_ROOT, privateOutputFile);
  } catch (err) {
    if (err.category === RECON_FAILURE.PRIVATE_OUTPUT_EXISTS) {
      printErrorOutcome(0); return;
    }
    printErrorOutcome(0); return;
  }
  // Validate input files realpath
  try {
    validateSecretsInputPath(REPO_ROOT, secretFile);
    validateSecretsInputPath(REPO_ROOT, roleMappingFile);
  } catch { printErrorOutcome(0); return; }

  // Load and normalize through the same boundary contract as the preflight,
  // while digesting the exact original bytes after the source-only gate so the
  // gate-ordering contract can prove no private read occurs before activation.
  let beforeDigest, roleMapping;
  try {
    const boundary = require(path.resolve(__dirname, 'production-readonly-catalog-boundary-core.cjs'));
    const mapAbs = path.resolve(REPO_ROOT, roleMappingFile);
    const bytes = fs.readFileSync(mapAbs);
    beforeDigest = computeDigest(bytes);
    roleMapping = boundary.loadProductionRoleMapping(REPO_ROOT, roleMappingFile);
  } catch { printErrorOutcome(0); return; }

  // Real production collection (no fake)
  const state = { collection_session_count: 0 };
  let collected;
  try {
    collected = await realCollectRawGrantees(REPO_ROOT, secretFile, roleMappingFile, state);
  } catch (err) {
    const cat = err && err.category;
    if (cat === RECON_FAILURE.POLICY_ROLE_UNRESOLVABLE || cat === RECON_FAILURE.GRANTEE_UNRESOLVABLE) {
      const out = {
        format_version: '1.0',
        outcome: cat,
        bounded_category: cat,
        collection_session_count: state.collection_session_count,
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
    // Generic sanitized failure
    if (state.collection_session_count > 0) printUnexpected(state.collection_session_count);
    else printErrorOutcome(0);
    return;
  }

  let unmapped;
  try {
    unmapped = computeUnmappedGrantees(collected, roleMapping);
  } catch { printUnexpected(state.collection_session_count); return; }

  // Immutability
  try {
    const afterBytes = fs.readFileSync(path.resolve(REPO_ROOT, roleMappingFile));
    if (computeDigest(afterBytes) !== beforeDigest) {
      printUnexpected(state.collection_session_count); return;
    }
  } catch { printUnexpected(state.collection_session_count); return; }

  let artifact;
  try {
    artifact = buildPrivateArtifact(unmapped);
    writePrivateArtifactExclusive(absPrivate, artifact);
  } catch (err) {
    if (err.category === RECON_FAILURE.PRIVATE_OUTPUT_EXISTS) { printErrorOutcome(state.collection_session_count); return; }
    printUnexpected(state.collection_session_count); return;
  }

  let shared;
  try {
    shared = buildSharedOutput(unmapped.length, true, state.collection_session_count);
  } catch { printUnexpected(state.collection_session_count); return; }
  printSanitizedStdout(shared);
  process.exitCode = 0;
}

if (require.main === module) {
  main().catch(() => { printUnexpected(0); });
}

module.exports = {
  runReconciliationWithDeps,
  loadRoleMappingWithDigest,
  validatePrivateOutputPath,
  computeUnmappedGrantees,
  buildPrivateArtifact,
  writePrivateArtifactExclusive,
  buildSharedOutput,
};
