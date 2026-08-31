'use strict';

/**
 * Ephemeral #4283 Production-readonly runtime-role / reactions ACL attestation.
 *
 * This file is intentionally source-bound to #4283 and is not a replacement for
 * the #4295 grantee reconciliation helper. The live path is never enabled by
 * an environment variable and accepts no caller SQL, role, object, or client.
 * It is suitable only for a separately approved one-session diagnostic run.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const boundary = require('./production-readonly-catalog-boundary-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_BOUND_ISSUE = '4283';
const SOURCE_BOUND_PURPOSE = 'ONE_PRODUCTION_READONLY_RUNTIME_ROLE_ACL_ATTESTATION';
const APPROVAL_REFERENCE = `issue:${SOURCE_BOUND_ISSUE}`;
const MAX_ROLE_CHAIN_DEPTH = 16;
const TARGET_RELATIONS = Object.freeze([
  'public.trees',
  'public.memories',
  'public.tree_social_counts',
  'public.reactions',
]);
const TARGET_SET = new Set(TARGET_RELATIONS);

const Q = Object.freeze({
  BEGIN_RO: 'BEGIN READ ONLY',
  SHOW_RO: 'SHOW transaction_read_only',
  ROLLBACK: 'ROLLBACK',
  IDENTITY: `SELECT current_user::text AS current_user,
                    session_user::text AS session_user,
                    current_role::text AS current_role,
                    current_database()::text AS current_database`,
  ROLE_CHAIN: `WITH RECURSIVE role_chain AS (
      SELECT r.oid, r.rolname::text AS role_name, 0::int AS depth, false AS admin_option
      FROM pg_roles r
      WHERE r.rolname = $1
      UNION ALL
      SELECT parent.oid, parent.rolname::text, child.depth + 1, m.admin_option
      FROM role_chain child
      JOIN pg_auth_members m ON m.member = child.oid
      JOIN pg_roles parent ON parent.oid = m.roleid
      WHERE child.depth < $2
    )
    SELECT oid::bigint AS oid, role_name, depth, admin_option
    FROM role_chain
    ORDER BY depth, role_name`,
  ROLE_FLAGS: `SELECT rolname::text AS role_name,
                      rolsuper,
                      rolcreatedb,
                      rolcreaterole,
                      rolbypassrls,
                      rolreplication,
                      rolinherit,
                      rolcanlogin
               FROM pg_roles
               WHERE rolname = ANY($1::text[])`,
  DATABASE_CONNECT: `SELECT has_database_privilege(current_database(), 'CONNECT') AS allowed`,
  PUBLIC_USAGE: `SELECT has_schema_privilege('public', 'USAGE') AS allowed`,
  TREES_SELECT: `SELECT has_table_privilege('public.trees', 'SELECT') AS allowed`,
  MEMORIES_SELECT: `SELECT has_table_privilege('public.memories', 'SELECT') AS allowed`,
  SOCIAL_COUNTS_SELECT: `SELECT has_table_privilege('public.tree_social_counts', 'SELECT') AS allowed`,
  REACTIONS_SELECT: `SELECT has_table_privilege('public.reactions', 'SELECT') AS allowed`,
  REACTIONS_INSERT: `SELECT has_table_privilege('public.reactions', 'INSERT') AS allowed`,
  REACTIONS_UPDATE: `SELECT has_table_privilege('public.reactions', 'UPDATE') AS allowed`,
  REACTIONS_DELETE: `SELECT has_table_privilege('public.reactions', 'DELETE') AS allowed`,
  PUBLIC_SELECT_GRANTS: `SELECT DISTINCT table_name::text AS table_name,
                                   grantee::text AS grantee,
                                   privilege_type::text AS privilege_type
                            FROM information_schema.table_privileges
                            WHERE table_schema = 'public'
                              AND privilege_type = 'SELECT'
                              AND grantee = ANY($1::text[])
                            ORDER BY table_name, grantee`,
});

const ALLOWED_FLAGS = new Set([
  '--secret-file',
  '--role-mapping-file',
  '--artifact-file',
  '--baseline-commit',
  '--approval-reference',
  '--purpose',
]);
const FORBIDDEN_FLAGS = new Set([
  '--host', '--port', '--user', '--username', '--password', '--database',
  '--database-url', '--connection-string', '--schema', '--table', '--role',
  '--objects', '--sql', '--query', '--client', '--output', '--repeat',
]);

function fail(category) {
  const error = new Error(category);
  error.category = category;
  throw error;
}

function safeBoolean(row) {
  if (!row || typeof row !== 'object') fail('ATTESTATION_CATALOG_SHAPE_INVALID');
  const value = row.allowed ?? row.transaction_read_only ?? Object.values(row)[0];
  if (value === true || ['true', 'on'].includes(String(value).toLowerCase())) return true;
  if (value === false || ['false', 'off'].includes(String(value).toLowerCase())) return false;
  fail('ATTESTATION_CATALOG_SHAPE_INVALID');
}

function safeQueryResult(result, field) {
  if (!result || !Array.isArray(result.rows)) fail('ATTESTATION_CATALOG_SHAPE_INVALID');
  if (!result.rows.length) fail(`ATTESTATION_${field}_MISSING`);
  return result.rows;
}

function parseArgs(args) {
  const values = {};
  const seen = new Set();
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (!flag || !flag.startsWith('--') || FORBIDDEN_FLAGS.has(flag) || !ALLOWED_FLAGS.has(flag)) {
      fail('ATTESTATION_INPUT_INVALID');
    }
    if (seen.has(flag)) fail('ATTESTATION_INPUT_INVALID');
    seen.add(flag);
    const value = args[i + 1];
    if (!value || value.startsWith('--')) fail('ATTESTATION_INPUT_INVALID');
    values[flag.slice(2).replaceAll('-', '_')] = value;
    i += 1;
  }
  return values;
}

function assertSourceBoundApproval(approvalReference, purpose) {
  if (approvalReference !== APPROVAL_REFERENCE || purpose !== SOURCE_BOUND_PURPOSE) {
    fail('ATTESTATION_SOURCE_BOUND_APPROVAL_REQUIRED');
  }
}

function assertBaseline(repoRoot, baselineCommit) {
  if (!/^[a-f0-9]{40}$/.test(baselineCommit || '')) fail('ATTESTATION_BASELINE_INVALID');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  if (head !== baselineCommit) fail('ATTESTATION_BASELINE_HEAD_MISMATCH');
}

function readOptionalArtifact(repoRoot, relPath) {
  if (relPath === undefined) return null;
  const abs = boundary.resolveSecretsRelativeFile(repoRoot, relPath);
  if (!fs.existsSync(abs)) return null;
  const doc = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) fail('ATTESTATION_ARTIFACT_INVALID');
  if (!Array.isArray(doc.unmapped_grantees) || doc.unmapped_grantees.length !== 2 ||
      !doc.unmapped_grantees.every((value) => typeof value === 'string' && value.length > 0)) {
    fail('ATTESTATION_ARTIFACT_INVALID');
  }
  return doc;
}

function buildRoleMappingRelation({ credentialUsername, identity, chain, mapping, artifact }) {
  const mappingKeys = new Set(Object.keys(mapping || {}).map((key) => key.toLowerCase()));
  const effective = String(identity.current_user || '');
  const session = String(identity.session_user || '');
  const currentRole = String(identity.current_role || '');
  const chainNames = chain.map((row) => String(row.role_name));
  const credential = String(credentialUsername || '');
  const credentialMapped = mappingKeys.has(credential.toLowerCase());
  const effectiveMapped = mappingKeys.has(effective.toLowerCase());

  let credentialRoleMatch = 'UNRESOLVED';
  if (credential && effective && currentRole) {
    if (currentRole !== session && credential === session && currentRole === effective) credentialRoleMatch = 'SET_ROLE_EFFECTIVE_ROLE';
    else if (credential === effective && currentRole === effective && chainNames.length > 1) credentialRoleMatch = 'INHERITED_EFFECTIVE_ROLE';
    else if (credential === effective && currentRole === effective) credentialRoleMatch = 'DIRECT_EFFECTIVE_ROLE';
    else if (effectiveMapped) credentialRoleMatch = 'DISTINCT_MAPPED_ROLE';
  }

  let historicalRelation = 'UNRESOLVED';
  const historical = artifact && artifact.unmapped_grantees ? artifact.unmapped_grantees : [];
  const currentChain = new Set(chainNames.map((name) => name.toLowerCase()));
  const historicalInChain = historical.some((name) => currentChain.has(String(name).toLowerCase()));
  if (historicalInChain) {
    historicalRelation = historical.some((name) => String(name).toLowerCase() === effective.toLowerCase())
      ? 'CURRENT_EFFECTIVE_ROLE'
      : 'MEMBER_OF_CURRENT_CHAIN';
  } else if (historical.length > 0 && chain.length > 0) {
    historicalRelation = 'STALE_NONCURRENT_ROLE';
  }

  const currentIdentityResolved = credentialRoleMatch !== 'UNRESOLVED';
  return {
    credentialRoleMatch,
    currentIdentityResolved,
    historicalRelation,
    roleMappingChangeRequired: currentIdentityResolved ? (effectiveMapped ? 'NO' : 'YES') : 'NOT_DETERMINABLE',
    credentialMapped,
  };
}

function deriveDecision({ identityResolved, privileges, roleAdmin, broadAllTableSelect }) {
  const baseline = privileges.SELECT_TREES === true && privileges.SELECT_MEMORIES === true &&
    privileges.SELECT_TREE_SOCIAL_COUNTS === true;
  const writesClosed = privileges.INSERT_REACTIONS === false &&
    privileges.UPDATE_REACTIONS === false && privileges.DELETE_REACTIONS === false;
  if (!identityResolved) {
    return {
      target: 'UNRESOLVED',
      minimalChange: 'NOT_DETERMINABLE',
      canProceed: 'NO',
      finalDisposition: 'RUNTIME_ROLE_IDENTITY_UNRESOLVED',
    };
  }
  if (!baseline || roleAdmin === true || broadAllTableSelect === true) {
    return {
      target: 'UNRESOLVED',
      minimalChange: 'NOT_DETERMINABLE',
      canProceed: 'NO',
      finalDisposition: 'BASELINE_PRIVILEGE_DRIFT_STOP',
    };
  }
  if (privileges.SELECT_REACTIONS === true) {
    return {
      target: 'RESOLVED',
      minimalChange: 'NO_PRIVILEGE_CHANGE',
      canProceed: writesClosed ? 'YES' : 'NO',
      finalDisposition: writesClosed ? 'ALREADY_PRIVILEGED_NO_MUTATION_NEEDED' : 'BASELINE_PRIVILEGE_DRIFT_STOP',
    };
  }
  if (privileges.SELECT_REACTIONS === false && writesClosed) {
    return {
      target: 'RESOLVED',
      minimalChange: 'SELECT_ON_REACTIONS_ONLY',
      canProceed: 'YES',
      finalDisposition: 'RUNTIME_READ_ROLE_ACL_ATTESTED',
    };
  }
  return {
    target: 'UNRESOLVED',
    minimalChange: 'NOT_DETERMINABLE',
    canProceed: 'NO',
    finalDisposition: 'BASELINE_PRIVILEGE_DRIFT_STOP',
  };
}

async function collectAttestation({ client, credentialUsername, roleMapping, artifact }) {
  if (!client || typeof client.connect !== 'function' || typeof client.query !== 'function' || typeof client.end !== 'function') {
    fail('ATTESTATION_CLIENT_INVALID');
  }
  let connected = false;
  let transactionStarted = false;
  try {
    await client.connect();
    connected = true;
    await client.query(Q.BEGIN_RO);
    transactionStarted = true;
    const readOnlyRows = safeQueryResult(await client.query(Q.SHOW_RO), 'READ_ONLY');
    if (!safeBoolean(readOnlyRows[0])) fail('ATTESTATION_READ_ONLY_REQUIRED');

    const identityRows = safeQueryResult(await client.query(Q.IDENTITY), 'IDENTITY');
    const identity = identityRows[0];
    for (const key of ['current_user', 'session_user', 'current_role', 'current_database']) {
      if (typeof identity[key] !== 'string' || !identity[key]) fail('ATTESTATION_IDENTITY_UNRESOLVED');
    }

    const chain = safeQueryResult(await client.query(Q.ROLE_CHAIN, [credentialUsername, MAX_ROLE_CHAIN_DEPTH]), 'ROLE_CHAIN');
    if (chain.length > MAX_ROLE_CHAIN_DEPTH + 1) fail('ATTESTATION_ROLE_CHAIN_BOUNDS');
    const chainNames = [...new Set(chain.map((row) => String(row.role_name)))];
    if (!chainNames.length) fail('ATTESTATION_ROLE_CHAIN_UNRESOLVED');

    const roleFlags = safeQueryResult(await client.query(Q.ROLE_FLAGS, [chainNames]), 'ROLE_FLAGS');
    const roleAdmin = roleFlags.some((row) => Boolean(row.rolsuper) || Boolean(row.rolcreatedb) ||
      Boolean(row.rolcreaterole) || Boolean(row.rolbypassrls) || Boolean(row.rolreplication)) ||
      chain.some((row) => Boolean(row.admin_option));
    const broadRows = await client.query(Q.PUBLIC_SELECT_GRANTS, [[...chainNames, 'PUBLIC']]);
    if (!broadRows || !Array.isArray(broadRows.rows)) fail('ATTESTATION_CATALOG_SHAPE_INVALID');
    const broadAllTableSelect = roleAdmin || broadRows.rows.some((row) => !TARGET_SET.has(`public.${String(row.table_name)}`));

    const privileges = {
      DATABASE_CONNECT: safeBoolean(safeQueryResult(await client.query(Q.DATABASE_CONNECT), 'DATABASE_CONNECT')[0]),
      USAGE_PUBLIC: safeBoolean(safeQueryResult(await client.query(Q.PUBLIC_USAGE), 'PUBLIC_USAGE')[0]),
      SELECT_TREES: safeBoolean(safeQueryResult(await client.query(Q.TREES_SELECT), 'TREES_SELECT')[0]),
      SELECT_MEMORIES: safeBoolean(safeQueryResult(await client.query(Q.MEMORIES_SELECT), 'MEMORIES_SELECT')[0]),
      SELECT_TREE_SOCIAL_COUNTS: safeBoolean(safeQueryResult(await client.query(Q.SOCIAL_COUNTS_SELECT), 'SOCIAL_COUNTS_SELECT')[0]),
      SELECT_REACTIONS: safeBoolean(safeQueryResult(await client.query(Q.REACTIONS_SELECT), 'REACTIONS_SELECT')[0]),
      INSERT_REACTIONS: safeBoolean(safeQueryResult(await client.query(Q.REACTIONS_INSERT), 'INSERT_REACTIONS')[0]),
      UPDATE_REACTIONS: safeBoolean(safeQueryResult(await client.query(Q.REACTIONS_UPDATE), 'UPDATE_REACTIONS')[0]),
      DELETE_REACTIONS: safeBoolean(safeQueryResult(await client.query(Q.REACTIONS_DELETE), 'DELETE_REACTIONS')[0]),
    };
    const relation = buildRoleMappingRelation({ credentialUsername, identity, chain, mapping: roleMapping, artifact });
    const decision = deriveDecision({ identityResolved: relation.currentIdentityResolved, privileges, roleAdmin, broadAllTableSelect });
    return {
      credentialRoleMatch: relation.credentialRoleMatch,
      currentRuntimeReadRoleIdentity: relation.currentIdentityResolved ? 'CONFIRMED' : 'UNRESOLVED',
      historicalRuntimeRoleRelation: relation.historicalRelation,
      privileges,
      roleAdmin: roleAdmin ? 'YES' : 'NO',
      broadAllTableSelect: broadAllTableSelect ? 'YES' : 'NO',
      decision,
      roleMappingChangeRequired: relation.roleMappingChangeRequired,
      rawRoleExposed: 'NO',
      rawGranteeExposed: 'NO',
      rawSecretExposed: 'NO',
    };
  } finally {
    if (transactionStarted) {
      try { await client.query(Q.ROLLBACK); } catch {}
    }
    if (connected) {
      try { await client.end(); } catch {}
    }
  }
}

function sanitizedFailure(category, runnerInvocationCount = 0) {
  return {
    runnerInvocationCount,
    productionConnectionCount: runnerInvocationCount,
    collectionSessionCount: runnerInvocationCount,
    transactionReadOnly: runnerInvocationCount ? 'FAILED' : 'NOT_REACHED',
    credentialRoleMatch: 'UNRESOLVED',
    currentRuntimeReadRoleIdentity: 'UNRESOLVED',
    historicalRuntimeRoleRelation: 'UNRESOLVED',
    selectTrees: 'UNKNOWN', selectMemories: 'UNKNOWN', selectTreeSocialCounts: 'UNKNOWN', selectReactions: 'UNKNOWN',
    insertReactions: 'UNKNOWN', updateReactions: 'UNKNOWN', deleteReactions: 'UNKNOWN',
    usagePublic: 'UNKNOWN', databaseConnect: 'UNKNOWN', broadAllTableSelect: 'UNKNOWN', roleAdmin: 'UNKNOWN',
    reactionsPrivilegeTargetIdentity: 'UNRESOLVED',
    minimalRequiredChange: 'NOT_DETERMINABLE', canProceed: 'NO', roleMappingChangeRequired: 'NOT_DETERMINABLE',
    finalDisposition: category === 'ATTESTATION_BASELINE_PRIVILEGE_DRIFT_STOP' ? 'BASELINE_PRIVILEGE_DRIFT_STOP' : 'RUNTIME_ROLE_IDENTITY_UNRESOLVED',
    errorCategory: category,
  };
}

function formatSuccess(result) {
  const p = result.privileges;
  return {
    runnerInvocationCount: 1,
    productionConnectionCount: 1,
    collectionSessionCount: 1,
    transactionReadOnly: 'VERIFIED',
    credentialRoleMatch: result.credentialRoleMatch,
    currentRuntimeReadRoleIdentity: result.currentRuntimeReadRoleIdentity,
    historicalRuntimeRoleRelation: result.historicalRuntimeRoleRelation,
    selectTrees: p.SELECT_TREES ? 'YES' : 'NO',
    selectMemories: p.SELECT_MEMORIES ? 'YES' : 'NO',
    selectTreeSocialCounts: p.SELECT_TREE_SOCIAL_COUNTS ? 'YES' : 'NO',
    selectReactions: p.SELECT_REACTIONS ? 'YES' : 'NO',
    insertReactions: p.INSERT_REACTIONS ? 'YES' : 'NO',
    updateReactions: p.UPDATE_REACTIONS ? 'YES' : 'NO',
    deleteReactions: p.DELETE_REACTIONS ? 'YES' : 'NO',
    usagePublic: p.USAGE_PUBLIC ? 'YES' : 'NO',
    databaseConnect: p.DATABASE_CONNECT ? 'YES' : 'NO',
    broadAllTableSelect: result.broadAllTableSelect,
    roleAdmin: result.roleAdmin,
    reactionsPrivilegeTargetIdentity: result.decision.target,
    minimalRequiredChange: result.decision.minimalChange,
    canProceed: result.decision.canProceed,
    roleMappingChangeRequired: result.roleMappingChangeRequired,
    rawRoleExposed: 'NO', rawGranteeExposed: 'NO', rawSecretExposed: 'NO',
    finalDisposition: result.decision.finalDisposition,
  };
}

async function runAttestationWithDeps({ approvalReference, purpose, baselineCommit, currentHead, loadPrivateInputs, collect }) {
  // This gate is deliberately before private input access.
  assertSourceBoundApproval(approvalReference, purpose);
  if (currentHead !== baselineCommit) fail('ATTESTATION_BASELINE_HEAD_MISMATCH');
  const inputs = await loadPrivateInputs();
  return formatSuccess(await collect(inputs));
}

async function main() {
  let runnerInvocationCount = 0;
  try {
    const args = parseArgs(process.argv.slice(2));
    assertSourceBoundApproval(args.approval_reference, args.purpose);
    assertBaseline(REPO_ROOT, args.baseline_commit);
    if (!args.secret_file || !args.role_mapping_file) fail('ATTESTATION_INPUT_INVALID');

    const secretUrl = boundary.loadDedicatedProductionReadonlyDatabaseUrl(REPO_ROOT, args.secret_file);
    const pgConfig = boundary.parseProductionReadonlyDatabaseUrl(secretUrl);
    const roleMapping = boundary.loadProductionRoleMapping(REPO_ROOT, args.role_mapping_file);
    const artifact = readOptionalArtifact(REPO_ROOT, args.artifact_file);
    const credentialUsername = pgConfig.user;

    // The sole live invocation starts only after all source-bound and input checks.
    runnerInvocationCount = 1;
    const { Client } = require('pg');
    const result = await collectAttestation({
      client: new Client(pgConfig), credentialUsername, roleMapping, artifact,
    });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    const category = error && typeof error.category === 'string' ? error.category : 'ATTESTATION_PREEXECUTION_STOP';
    process.stdout.write(JSON.stringify(sanitizedFailure(category, runnerInvocationCount), null, 2) + '\n');
    process.exitCode = 1;
  }
}

if (require.main === module) void main();

module.exports = {
  APPROVAL_REFERENCE,
  SOURCE_BOUND_ISSUE,
  SOURCE_BOUND_PURPOSE,
  MAX_ROLE_CHAIN_DEPTH,
  TARGET_RELATIONS,
  Q,
  parseArgs,
  assertSourceBoundApproval,
  buildRoleMappingRelation,
  deriveDecision,
  collectAttestation,
  runAttestationWithDeps,
  sanitizedFailure,
};
