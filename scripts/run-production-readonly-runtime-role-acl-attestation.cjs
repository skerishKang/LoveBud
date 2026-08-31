'use strict';

/**
 * Ephemeral #4283 Production-readonly runtime-role / reactions ACL attestation.
 *
 * Source-bound, one-session catalog-only diagnostic. The connected observer is
 * never promoted to, made a member of, or otherwise used as the target role.
 * Target-role privilege functions receive the explicitly authorized target role
 * from the private role-mapping input.
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
const MAX_ACL_ROWS = 256;
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ROLE_CLASSES = new Set(['PUBLIC', 'APPLICATION', 'AUTHENTICATED', 'SERVICE', 'OWNER_CLASS']);
const TARGET_RELATIONS = Object.freeze([
  'public.trees',
  'public.memories',
  'public.tree_social_counts',
  'public.reactions',
]);
const TARGET_RELATION_NAMES = Object.freeze(TARGET_RELATIONS.map((value) => value.slice('public.'.length)));
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
      SELECT r.oid, r.rolname::text AS role_name, 0::int AS depth,
             false AS admin_option, ARRAY[r.oid]::oid[] AS role_path
      FROM pg_roles r
      WHERE r.rolname = $1
      UNION ALL
      SELECT parent.oid, parent.rolname::text, child.depth + 1,
             m.admin_option, child.role_path || parent.oid
      FROM role_chain child
      JOIN pg_auth_members m ON m.member = child.oid
      JOIN pg_roles parent ON parent.oid = m.roleid
      WHERE child.depth < $2
        AND NOT parent.oid = ANY(child.role_path)
    )
    SELECT oid::bigint AS oid, role_name, MIN(depth)::int AS depth,
           bool_or(admin_option) AS admin_option
    FROM role_chain
    GROUP BY oid, role_name
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
  DATABASE_CONNECT: `SELECT has_database_privilege($1::name, current_database(), 'CONNECT') AS allowed`,
  PUBLIC_USAGE: `SELECT has_schema_privilege($1::name, 'public', 'USAGE') AS allowed`,
  TREES_SELECT: `SELECT has_table_privilege($1::name, 'public.trees', 'SELECT') AS allowed`,
  MEMORIES_SELECT: `SELECT has_table_privilege($1::name, 'public.memories', 'SELECT') AS allowed`,
  SOCIAL_COUNTS_SELECT: `SELECT has_table_privilege($1::name, 'public.tree_social_counts', 'SELECT') AS allowed`,
  REACTIONS_SELECT: `SELECT has_table_privilege($1::name, 'public.reactions', 'SELECT') AS allowed`,
  REACTIONS_INSERT: `SELECT has_table_privilege($1::name, 'public.reactions', 'INSERT') AS allowed`,
  REACTIONS_UPDATE: `SELECT has_table_privilege($1::name, 'public.reactions', 'UPDATE') AS allowed`,
  REACTIONS_DELETE: `SELECT has_table_privilege($1::name, 'public.reactions', 'DELETE') AS allowed`,
  RELATION_ACL: `SELECT c.relname::text AS relation_name,
                      (c.relacl IS NULL) AS relacl_was_null,
                      c.relowner::bigint AS owner_oid,
                      owner_role.rolname::text AS owner_name,
                      acl.grantee::bigint AS grantee_oid,
                      CASE WHEN acl.grantee = 0 THEN 'PUBLIC'::text
                           ELSE grantee_role.rolname::text END AS grantee_name,
                      acl.privilege_type::text AS privilege_type,
                      acl.is_grantable
               FROM pg_class c
               JOIN pg_namespace n ON n.oid = c.relnamespace
               LEFT JOIN pg_roles owner_role ON owner_role.oid = c.relowner
               CROSS JOIN LATERAL aclexplode(
                 COALESCE(c.relacl, acldefault('r'::\"char\", c.relowner))
               ) AS acl(grantor, grantee, privilege_type, is_grantable)
               LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl.grantee
                                                AND acl.grantee <> 0
               WHERE n.nspname = 'public'
                 AND c.relname = ANY($1::text[])
                 AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
               ORDER BY c.relname, acl.grantee, acl.privilege_type`,
  BROAD_SELECT_ACL: `SELECT c.relname::text AS relation_name,
                            acl.grantee::bigint AS grantee_oid,
                            CASE WHEN acl.grantee = 0 THEN 'PUBLIC'::text
                                 ELSE grantee_role.rolname::text END AS grantee_name,
                            acl.privilege_type::text AS privilege_type
                     FROM pg_class c
                     JOIN pg_namespace n ON n.oid = c.relnamespace
                     CROSS JOIN LATERAL aclexplode(
                       COALESCE(c.relacl, acldefault('r'::\"char\", c.relowner))
                     ) AS acl(grantor, grantee, privilege_type, is_grantable)
                     LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl.grantee
                                                      AND acl.grantee <> 0
                     WHERE n.nspname = 'public'
                       AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
                       AND acl.privilege_type = 'SELECT'
                       AND acl.grantee = ANY($1::oid[])
                     ORDER BY c.relname, acl.grantee`,
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

function assertTargetRuntimeRole(value) {
  if (typeof value !== 'string' || !IDENT_RE.test(value) || value.length > 63) {
    fail('ATTESTATION_TARGET_ROLE_INVALID');
  }
  return value;
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

function readJsonPrivateFile(repoRoot, relPath, failure) {
  if (relPath === undefined) fail(failure);
  const abs = boundary.resolveSecretsRelativeFile(repoRoot, relPath);
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    fail(failure);
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) fail(failure);
  return doc;
}

/**
 * Strict private contract. The target role is explicit and exactly one mapped
 * role is accepted; no default, historical role, URL username, or observer
 * identity can become the target.
 */
function loadTargetRoleMapping(repoRoot, relPath) {
  const doc = readJsonPrivateFile(repoRoot, relPath, 'ATTESTATION_TARGET_ROLE_MAPPING_INVALID');
  const topKeys = Object.keys(doc).sort();
  if (topKeys.length !== 2 || topKeys[0] !== 'role_mapping' || topKeys[1] !== 'target_runtime_role') {
    fail('ATTESTATION_TARGET_ROLE_MAPPING_AMBIGUOUS');
  }
  const targetRuntimeRole = assertTargetRuntimeRole(doc.target_runtime_role);
  const mapping = doc.role_mapping;
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    fail('ATTESTATION_TARGET_ROLE_MAPPING_INVALID');
  }
  const keys = Object.keys(mapping);
  if (keys.length !== 1 || keys[0] !== targetRuntimeRole || !ROLE_CLASSES.has(mapping[keys[0]])) {
    fail('ATTESTATION_TARGET_ROLE_MAPPING_AMBIGUOUS');
  }
  return Object.freeze({
    targetRuntimeRole,
    roleMapping: Object.freeze({ [targetRuntimeRole]: mapping[targetRuntimeRole] }),
  });
}

function readOptionalArtifact(repoRoot, relPath) {
  if (relPath === undefined) return null;
  const doc = readJsonPrivateFile(repoRoot, relPath, 'ATTESTATION_ARTIFACT_INVALID');
  if (!Array.isArray(doc.unmapped_grantees) || doc.unmapped_grantees.length !== 2 ||
      !doc.unmapped_grantees.every((value) => typeof value === 'string' && value.length > 0)) {
    fail('ATTESTATION_ARTIFACT_INVALID');
  }
  return doc;
}

function buildRoleMappingRelation({ targetRuntimeRole, identity, chain, roleMapping, artifact }) {
  const target = assertTargetRuntimeRole(targetRuntimeRole);
  const mappingKeys = new Set(Object.keys(roleMapping || {}).map((key) => key.toLowerCase()));
  const sessionRole = String(identity.session_user || '');
  const currentRole = String(identity.current_role || '');
  const chainNames = chain.map((row) => String(row.role_name));
  const targetInChain = chainNames.some((name) => name.toLowerCase() === target.toLowerCase());
  if (!targetInChain || !mappingKeys.has(target.toLowerCase())) {
    fail('ATTESTATION_TARGET_ROLE_UNRESOLVED');
  }

  let historicalRelation = 'UNRESOLVED';
  const historical = artifact && artifact.unmapped_grantees ? artifact.unmapped_grantees : [];
  const currentChain = new Set(chainNames.map((name) => name.toLowerCase()));
  const historicalInChain = historical.some((name) => currentChain.has(String(name).toLowerCase()));
  if (historicalInChain) {
    historicalRelation = historical.some((name) => String(name).toLowerCase() === target.toLowerCase())
      ? 'CURRENT_TARGET_ROLE'
      : 'MEMBER_OF_CURRENT_TARGET_CHAIN';
  } else if (historical.length > 0 && chain.length > 0) {
    historicalRelation = 'STALE_NONCURRENT_ROLE';
  }

  return {
    currentIdentityResolved: true,
    historicalRelation,
    sessionEqualsTarget: sessionRole === target ? 'YES' : 'NO',
    currentRoleEqualsTarget: currentRole === target ? 'YES' : 'NO',
  };
}

function normalizeAclBoolean(value, field) {
  if (value === true || value === false) return value;
  if (['true', 't', 'yes'].includes(String(value).toLowerCase())) return true;
  if (['false', 'f', 'no'].includes(String(value).toLowerCase())) return false;
  fail(`ATTESTATION_ACL_${field}_INVALID`);
}

function classifyRelationAclSources({ rows, targetRuntimeRole, chainNames }) {
  const target = assertTargetRuntimeRole(targetRuntimeRole).toLowerCase();
  const chain = new Set();
  for (const name of chainNames) {
    if (typeof name !== 'string' || !IDENT_RE.test(name)) fail('ATTESTATION_ROLE_CHAIN_SHAPE_INVALID');
    const key = name.toLowerCase();
    if (chain.has(key)) fail('ATTESTATION_ROLE_CHAIN_DUPLICATE');
    chain.add(key);
  }
  if (!chain.has(target)) fail('ATTESTATION_TARGET_ROLE_UNRESOLVED');
  if (!Array.isArray(rows) || rows.length > MAX_ACL_ROWS) fail('ATTESTATION_ACL_SHAPE_INVALID');

  const relations = Object.fromEntries(TARGET_RELATION_NAMES.map((name) => [name, {
    effectiveSelect: 'UNKNOWN',
    publicGrant: 'NO',
    directTargetGrant: 'NO',
    inheritedGrant: 'NO',
    ownerSelect: 'NO',
    relaclWasNull: 'UNKNOWN',
    ownerOid: 'UNKNOWN',
  }]));
  const seenRelations = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || typeof row.relation_name !== 'string' ||
        !TARGET_RELATION_NAMES.includes(row.relation_name) ||
        typeof row.grantee_name !== 'string' || !row.grantee_name ||
        typeof row.privilege_type !== 'string' || typeof row.owner_name !== 'string' || !row.owner_name) {
      fail('ATTESTATION_ACL_SHAPE_INVALID');
    }
    const granteeOid = String(row.grantee_oid ?? '');
    if (!/^\d+$/.test(granteeOid) ||
        (granteeOid === '0' && row.grantee_name !== 'PUBLIC') ||
        (granteeOid !== '0' && row.grantee_name === 'PUBLIC')) {
      fail('ATTESTATION_ACL_SHAPE_INVALID');
    }
    if (!['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REFERENCES', 'TRIGGER', 'TRUNCATE'].includes(row.privilege_type)) {
      fail('ATTESTATION_ACL_SHAPE_INVALID');
    }
    const relation = relations[row.relation_name];
    const ownerOid = String(row.owner_oid ?? '');
    if (!/^\d+$/.test(ownerOid)) fail('ATTESTATION_ACL_SHAPE_INVALID');
    if (relation.ownerOid === 'UNKNOWN') relation.ownerOid = ownerOid;
    else if (relation.ownerOid !== ownerOid) fail('ATTESTATION_ACL_SHAPE_INVALID');
    const wasNull = normalizeAclBoolean(row.relacl_was_null, 'RELACL_NULL');
    if (relation.relaclWasNull === 'UNKNOWN') relation.relaclWasNull = wasNull ? 'YES' : 'NO';
    else if (relation.relaclWasNull !== (wasNull ? 'YES' : 'NO')) fail('ATTESTATION_ACL_SHAPE_INVALID');
    seenRelations.add(row.relation_name);
    if (row.privilege_type !== 'SELECT') continue;
    const grantee = row.grantee_name.toLowerCase();
    if (grantee === 'public') relation.publicGrant = 'YES';
    else if (granteeOid === ownerOid) relation.ownerSelect = 'YES';
    else if (grantee === target) relation.directTargetGrant = 'YES';
    else if (chain.has(grantee)) relation.inheritedGrant = 'YES';
  }
  if (seenRelations.size !== TARGET_RELATION_NAMES.length) fail('ATTESTATION_ACL_RELATION_MISSING');
  return relations;
}

function validateBroadSelectAclRows(rows) {
  if (!Array.isArray(rows) || rows.length > MAX_ACL_ROWS) fail('ATTESTATION_ACL_SHAPE_INVALID');
  for (const row of rows) {
    if (!row || typeof row !== 'object' || typeof row.relation_name !== 'string' ||
        typeof row.grantee_name !== 'string' || !row.grantee_name ||
        row.privilege_type !== 'SELECT') fail('ATTESTATION_ACL_SHAPE_INVALID');
    const granteeOid = String(row.grantee_oid ?? '');
    if (!/^\d+$/.test(granteeOid) ||
        (granteeOid === '0' && row.grantee_name !== 'PUBLIC') ||
        (granteeOid !== '0' && row.grantee_name === 'PUBLIC')) {
      fail('ATTESTATION_ACL_SHAPE_INVALID');
    }
  }
  return rows;
}

function sanitizeRelationProvenance(relations) {
  return Object.fromEntries(TARGET_RELATION_NAMES.map((name) => {
    const relation = relations[name];
    return [name, {
      effectiveSelect: relation.effectiveSelect,
      publicGrant: relation.publicGrant,
      directTargetGrant: relation.directTargetGrant,
      inheritedGrant: relation.inheritedGrant,
      ownerSelect: relation.ownerSelect,
      relaclWasNull: relation.relaclWasNull,
    }];
  }));
}

function summarizeRelationSource(relations, field) {
  const values = TARGET_RELATION_NAMES.map((name) => relations[name][field]);
  return values.every((value) => value === 'YES') ? 'YES' :
    values.every((value) => value === 'NO') ? 'NO' : 'MIXED';
}

function classifySelectGrantSources({ rows, targetRuntimeRole, chainNames }) {
  const relations = classifyRelationAclSources({ rows, targetRuntimeRole, chainNames });
  return {
    public: summarizeRelationSource(relations, 'publicGrant'),
    direct: summarizeRelationSource(relations, 'directTargetGrant'),
    inherited: summarizeRelationSource(relations, 'inheritedGrant'),
    relations,
  };
}

function deriveDecision({ identityResolved, privileges, roleAdmin, broadAllTableSelect }) {
  const baseline = privileges.DATABASE_CONNECT === true && privileges.USAGE_PUBLIC === true &&
    privileges.SELECT_TREES === true && privileges.SELECT_MEMORIES === true &&
    privileges.SELECT_TREE_SOCIAL_COUNTS === true;
  const writesClosed = privileges.INSERT_REACTIONS === false &&
    privileges.UPDATE_REACTIONS === false && privileges.DELETE_REACTIONS === false;
  if (!identityResolved) {
    return { target: 'UNRESOLVED', minimalChange: 'NOT_DETERMINABLE', canProceed: 'NO', finalDisposition: 'RUNTIME_ROLE_IDENTITY_UNRESOLVED' };
  }
  if (!baseline || roleAdmin === true || broadAllTableSelect === true) {
    return { target: 'UNRESOLVED', minimalChange: 'NOT_DETERMINABLE', canProceed: 'NO', finalDisposition: 'BASELINE_PRIVILEGE_DRIFT_STOP' };
  }
  if (privileges.SELECT_REACTIONS === true) {
    return { target: 'RESOLVED', minimalChange: 'NO_PRIVILEGE_CHANGE', canProceed: writesClosed ? 'YES' : 'NO', finalDisposition: writesClosed ? 'ALREADY_PRIVILEGED_NO_MUTATION_NEEDED' : 'BASELINE_PRIVILEGE_DRIFT_STOP' };
  }
  if (privileges.SELECT_REACTIONS === false && writesClosed) {
    return { target: 'RESOLVED', minimalChange: 'SELECT_ON_REACTIONS_ONLY', canProceed: 'YES', finalDisposition: 'RUNTIME_READ_ROLE_ACL_ATTESTED' };
  }
  return { target: 'UNRESOLVED', minimalChange: 'NOT_DETERMINABLE', canProceed: 'NO', finalDisposition: 'BASELINE_PRIVILEGE_DRIFT_STOP' };
}

async function collectAttestation({ client, targetRuntimeRole, roleMapping, artifact }) {
  const target = assertTargetRuntimeRole(targetRuntimeRole);
  if (!roleMapping || Object.keys(roleMapping).length !== 1 ||
      Object.keys(roleMapping)[0] !== target) fail('ATTESTATION_TARGET_ROLE_MAPPING_AMBIGUOUS');
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

    const identity = safeQueryResult(await client.query(Q.IDENTITY), 'IDENTITY')[0];
    for (const key of ['current_user', 'session_user', 'current_role', 'current_database']) {
      if (typeof identity[key] !== 'string' || !identity[key]) fail('ATTESTATION_IDENTITY_UNRESOLVED');
    }

    const chain = safeQueryResult(await client.query(Q.ROLE_CHAIN, [target, MAX_ROLE_CHAIN_DEPTH]), 'TARGET_ROLE_CHAIN');
    if (chain.length > MAX_ROLE_CHAIN_DEPTH + 1) fail('ATTESTATION_ROLE_CHAIN_BOUNDS');
    const chainNames = [...new Set(chain.map((row) => String(row.role_name)))];
    const roleFlags = safeQueryResult(await client.query(Q.ROLE_FLAGS, [chainNames]), 'TARGET_ROLE_FLAGS');
    if (!roleFlags.some((row) => String(row.role_name).toLowerCase() === target.toLowerCase())) fail('ATTESTATION_TARGET_ROLE_UNRESOLVED');
    const relation = buildRoleMappingRelation({ targetRuntimeRole: target, identity, chain, roleMapping, artifact });
    const targetFlags = roleFlags.find((row) => String(row.role_name).toLowerCase() === target.toLowerCase());
    if (!targetFlags) fail('ATTESTATION_TARGET_ROLE_UNRESOLVED');
    const targetRoleAdminOption = chain.some((row) => Boolean(row.admin_option));
    const targetRoleSuperuser = Boolean(targetFlags.rolsuper);
    const targetRoleCreatedb = Boolean(targetFlags.rolcreatedb);
    const targetRoleCreaterole = Boolean(targetFlags.rolcreaterole);
    const targetRoleBypassrls = Boolean(targetFlags.rolbypassrls);
    const targetRoleReplication = Boolean(targetFlags.rolreplication);
    const roleAdmin = roleFlags.some((row) => Boolean(row.rolsuper) || Boolean(row.rolcreatedb) ||
      Boolean(row.rolcreaterole) || Boolean(row.rolbypassrls) || Boolean(row.rolreplication)) ||
      targetRoleAdminOption;

    const aclRows = safeQueryResult(
      await client.query(Q.RELATION_ACL, [TARGET_RELATION_NAMES]),
      'RELATION_ACL',
    );
    const chainOids = [...new Set(chain.map((row) => String(row.oid)))];
    if (!chainOids.every((oid) => /^\d+$/.test(oid))) fail('ATTESTATION_ROLE_CHAIN_SHAPE_INVALID');
    const broadRows = validateBroadSelectAclRows(safeQueryResult(
      await client.query(Q.BROAD_SELECT_ACL, [chainOids.map((oid) => Number(oid)).concat(0)]),
      'BROAD_SELECT_ACL',
    ));
    const broadAllTableSelect = roleAdmin || broadRows.some((row) => !TARGET_RELATION_NAMES.includes(String(row.relation_name)));
    const grantSources = classifySelectGrantSources({ rows: aclRows, targetRuntimeRole: target, chainNames });
    const privilege = (query, field) => safeBoolean(safeQueryResult(query, field)[0]);
    const privileges = {
      DATABASE_CONNECT: privilege(await client.query(Q.DATABASE_CONNECT, [target]), 'DATABASE_CONNECT'),
      USAGE_PUBLIC: privilege(await client.query(Q.PUBLIC_USAGE, [target]), 'PUBLIC_USAGE'),
      SELECT_TREES: privilege(await client.query(Q.TREES_SELECT, [target]), 'TREES_SELECT'),
      SELECT_MEMORIES: privilege(await client.query(Q.MEMORIES_SELECT, [target]), 'MEMORIES_SELECT'),
      SELECT_TREE_SOCIAL_COUNTS: privilege(await client.query(Q.SOCIAL_COUNTS_SELECT, [target]), 'SOCIAL_COUNTS_SELECT'),
      SELECT_REACTIONS: privilege(await client.query(Q.REACTIONS_SELECT, [target]), 'REACTIONS_SELECT'),
      INSERT_REACTIONS: privilege(await client.query(Q.REACTIONS_INSERT, [target]), 'INSERT_REACTIONS'),
      UPDATE_REACTIONS: privilege(await client.query(Q.REACTIONS_UPDATE, [target]), 'UPDATE_REACTIONS'),
      DELETE_REACTIONS: privilege(await client.query(Q.REACTIONS_DELETE, [target]), 'DELETE_REACTIONS'),
    };
    const effectiveByRelation = {
      trees: privileges.SELECT_TREES,
      memories: privileges.SELECT_MEMORIES,
      tree_social_counts: privileges.SELECT_TREE_SOCIAL_COUNTS,
      reactions: privileges.SELECT_REACTIONS,
    };
    for (const relationName of TARGET_RELATION_NAMES) {
      grantSources.relations[relationName].effectiveSelect = effectiveByRelation[relationName] ? 'YES' : 'NO';
    }
    const decision = deriveDecision({ identityResolved: relation.currentIdentityResolved, privileges, roleAdmin, broadAllTableSelect });
    return {
      transactionReadOnly: 'VERIFIED',
      sessionRole: 'PRESENT_REDACTED',
      targetRuntimeRole: 'PRESENT_REDACTED',
      sessionEqualsTarget: relation.sessionEqualsTarget,
      currentRoleEqualsTarget: relation.currentRoleEqualsTarget,
      targetRoleSpecificChecks: 'VERIFIED',
      targetRoleSuperuser: targetRoleSuperuser ? 'YES' : 'NO',
      targetRoleCreatedb: targetRoleCreatedb ? 'YES' : 'NO',
      targetRoleCreaterole: targetRoleCreaterole ? 'YES' : 'NO',
      targetRoleBypassrls: targetRoleBypassrls ? 'YES' : 'NO',
      targetRoleReplication: targetRoleReplication ? 'YES' : 'NO',
      targetRoleAdminOption: targetRoleAdminOption ? 'YES' : 'NO',
      historicalRuntimeRoleRelation: relation.historicalRelation,
      privileges,
      roleAdmin: roleAdmin ? 'YES' : 'NO',
      broadAllTableSelect: broadAllTableSelect ? 'YES' : 'NO',
      publicSelectGrant: grantSources.public,
      directTargetSelectGrant: grantSources.direct,
      inheritedTargetSelectGrant: grantSources.inherited,
      perRelationProvenance: sanitizeRelationProvenance(grantSources.relations),
      decision,
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
    sessionRole: 'UNRESOLVED', targetRuntimeRole: 'UNRESOLVED', sessionEqualsTarget: 'UNRESOLVED',
    currentRoleEqualsTarget: 'UNRESOLVED', targetRoleSpecificChecks: 'UNRESOLVED',
    targetRoleSuperuser: 'UNKNOWN', targetRoleCreatedb: 'UNKNOWN', targetRoleCreaterole: 'UNKNOWN',
    targetRoleBypassrls: 'UNKNOWN', targetRoleReplication: 'UNKNOWN', targetRoleAdminOption: 'UNKNOWN',
    historicalRuntimeRoleRelation: 'UNRESOLVED',
    selectTrees: 'UNKNOWN', selectMemories: 'UNKNOWN', selectTreeSocialCounts: 'UNKNOWN', selectReactions: 'UNKNOWN',
    insertReactions: 'UNKNOWN', updateReactions: 'UNKNOWN', deleteReactions: 'UNKNOWN',
    usagePublic: 'UNKNOWN', databaseConnect: 'UNKNOWN', broadAllTableSelect: 'UNKNOWN', roleAdmin: 'UNKNOWN',
    publicSelectGrant: 'UNKNOWN', directTargetSelectGrant: 'UNKNOWN', inheritedTargetSelectGrant: 'UNKNOWN',
    perRelationProvenance: Object.fromEntries(TARGET_RELATION_NAMES.map((name) => [name, {
      effectiveSelect: 'UNKNOWN', publicGrant: 'UNKNOWN', directTargetGrant: 'UNKNOWN',
      inheritedGrant: 'UNKNOWN', ownerSelect: 'UNKNOWN', relaclWasNull: 'UNKNOWN', ownerOid: 'UNKNOWN',
    }])),
    reactionsPrivilegeTargetIdentity: 'UNRESOLVED', minimalRequiredChange: 'NOT_DETERMINABLE', canProceed: 'NO',
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
    sessionRole: result.sessionRole,
    targetRuntimeRole: result.targetRuntimeRole,
    sessionEqualsTarget: result.sessionEqualsTarget,
    currentRoleEqualsTarget: result.currentRoleEqualsTarget,
    targetRoleSpecificChecks: result.targetRoleSpecificChecks,
    targetRoleSuperuser: result.targetRoleSuperuser,
    targetRoleCreatedb: result.targetRoleCreatedb,
    targetRoleCreaterole: result.targetRoleCreaterole,
    targetRoleBypassrls: result.targetRoleBypassrls,
    targetRoleReplication: result.targetRoleReplication,
    targetRoleAdminOption: result.targetRoleAdminOption,
    historicalRuntimeRoleRelation: result.historicalRuntimeRoleRelation,
    selectTrees: p.SELECT_TREES ? 'YES' : 'NO', selectMemories: p.SELECT_MEMORIES ? 'YES' : 'NO',
    selectTreeSocialCounts: p.SELECT_TREE_SOCIAL_COUNTS ? 'YES' : 'NO', selectReactions: p.SELECT_REACTIONS ? 'YES' : 'NO',
    insertReactions: p.INSERT_REACTIONS ? 'YES' : 'NO', updateReactions: p.UPDATE_REACTIONS ? 'YES' : 'NO', deleteReactions: p.DELETE_REACTIONS ? 'YES' : 'NO',
    usagePublic: p.USAGE_PUBLIC ? 'YES' : 'NO', databaseConnect: p.DATABASE_CONNECT ? 'YES' : 'NO',
    broadAllTableSelect: result.broadAllTableSelect, roleAdmin: result.roleAdmin,
    publicSelectGrant: result.publicSelectGrant, directTargetSelectGrant: result.directTargetSelectGrant,
    inheritedTargetSelectGrant: result.inheritedTargetSelectGrant,
    perRelationProvenance: result.perRelationProvenance,
    reactionsPrivilegeTargetIdentity: result.decision.target, minimalRequiredChange: result.decision.minimalChange,
    canProceed: result.decision.canProceed, finalDisposition: result.decision.finalDisposition,
    rawRoleExposed: 'NO', rawGranteeExposed: 'NO', rawSecretExposed: 'NO',
  };
}

async function runAttestationWithDeps({ approvalReference, purpose, baselineCommit, currentHead, loadPrivateInputs, collect }) {
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
    const targetInput = loadTargetRoleMapping(REPO_ROOT, args.role_mapping_file);
    const secretUrl = boundary.loadDedicatedProductionReadonlyDatabaseUrl(REPO_ROOT, args.secret_file);
    const pgConfig = boundary.parseProductionReadonlyDatabaseUrl(secretUrl);
    const artifact = readOptionalArtifact(REPO_ROOT, args.artifact_file);

    // The sole live invocation starts only after all source-bound and input checks.
    runnerInvocationCount = 1;
    const { Client } = require('pg');
    const result = await collectAttestation({
      client: new Client(pgConfig),
      targetRuntimeRole: targetInput.targetRuntimeRole,
      roleMapping: targetInput.roleMapping,
      artifact,
    });
    process.stdout.write(JSON.stringify(formatSuccess(result), null, 2) + '\n');
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
  TARGET_RELATION_NAMES,
  Q,
  parseArgs,
  assertSourceBoundApproval,
  assertTargetRuntimeRole,
  loadTargetRoleMapping,
  buildRoleMappingRelation,
  classifySelectGrantSources,
  deriveDecision,
  collectAttestation,
  runAttestationWithDeps,
  sanitizedFailure,
};
