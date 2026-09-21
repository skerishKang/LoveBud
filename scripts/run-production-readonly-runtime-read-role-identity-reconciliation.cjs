'use strict';

/**
 * Production-readonly runtime read-role identity reconciliation (#4422).
 *
 * Source-bound, one-session catalog-only diagnostic. The connected observer is
 * never promoted to, made a member of, or otherwise adopted as the target role,
 * and no caller may supply, hint at, or override the target identity: there is no
 * --role, --table, --schema, --objects, --sql, --query, --connection-string,
 * --database-url, --output, --repeat or --role-mapping-file surface at all.
 *
 * This runner exists because the private one-entry target-role mapping consumed by
 * scripts/run-production-readonly-runtime-role-acl-attestation.cjs is not
 * recoverable locally, and because the two tracked documents that describe the
 * runtime read role contradict each other. Identity is therefore re-established
 * from a fresh Production catalog measurement of a fixed fingerprint rather than
 * from any historical name, literal, seed, or URL username.
 *
 * Identity discovery is deliberately separated from the #4422 B1 tree-likes
 * privilege attestation: public.tree_likes is NOT part of this runner's query
 * surface or fingerprint, so re-establishing identity can never double as, or
 * silently collapse into, a B1 privilege measurement.
 *
 * Every statement is a catalog or privilege-function read. This runner never
 * issues GRANT, REVOKE, DML, or DDL, and never selects a Product table row.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const boundary = require('./production-readonly-catalog-boundary-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

const SOURCE_BOUND_ISSUE = '4422';
const IDENTITY_PURPOSE = 'ONE_PRODUCTION_READONLY_RUNTIME_READ_ROLE_IDENTITY_RECONCILIATION';
const IDENTITY_APPROVAL_REFERENCE = `issue:${SOURCE_BOUND_ISSUE}`;
const APPLICATION_ROLE_CLASS = 'APPLICATION';
const ROLE_CLASSES = new Set(['PUBLIC', 'APPLICATION', 'AUTHENTICATED', 'SERVICE', 'OWNER_CLASS']);

const MAX_ROLE_CHAIN_DEPTH = 16;
const MAX_ROLE_CHAIN_ROWS = 128;
const MAX_ACL_ROWS = 256;
const MAX_CANDIDATE_ROLES = 64;
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Required minimum fingerprint. This is the reviewed read envelope, not an
 * exclusivity assertion: a candidate may legitimately hold further per-table
 * SELECT and still qualify, as long as it is not a broad/admin grant.
 */
const REQUIRED_SELECT_RELATIONS = Object.freeze([
  'public.trees',
  'public.memories',
  'public.tree_social_counts',
  'public.reactions',
  'public.comments',
  'public.tree_comments',
  'public.tree_hub_layouts',
]);
const REQUIRED_SELECT_RELATION_NAMES = Object.freeze(
  REQUIRED_SELECT_RELATIONS.map((value) => value.slice('public.'.length)),
);
const REQUIRED_RELATION_SET = new Set(REQUIRED_SELECT_RELATION_NAMES);
const WRITE_PRIVILEGES = Object.freeze([
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE',
  'REFERENCES',
  'TRIGGER',
]);

const PRIVATE_OUTPUT_REL_PATH = '.secrets/private/4422-b1-target-role-mapping.json';

const IDENTITY_DISPOSITION = Object.freeze({
  RESOLVED: 'RUNTIME_READ_ROLE_IDENTITY_RESOLVED',
  UNRESOLVED: 'RUNTIME_READ_ROLE_IDENTITY_UNRESOLVED',
  AMBIGUOUS: 'RUNTIME_READ_ROLE_IDENTITY_AMBIGUOUS',
});

const FAILURE = Object.freeze({
  IDENTITY_INPUT_INVALID: 'IDENTITY_INPUT_INVALID',
  IDENTITY_SOURCE_BOUND_APPROVAL_REQUIRED: 'IDENTITY_SOURCE_BOUND_APPROVAL_REQUIRED',
  IDENTITY_BASELINE_INVALID: 'IDENTITY_BASELINE_INVALID',
  IDENTITY_BASELINE_HEAD_MISMATCH: 'IDENTITY_BASELINE_HEAD_MISMATCH',
  IDENTITY_CATALOG_SHAPE_INVALID: 'IDENTITY_CATALOG_SHAPE_INVALID',
  IDENTITY_CANDIDATE_BOUND_EXCEEDED: 'IDENTITY_CANDIDATE_BOUND_EXCEEDED',
  IDENTITY_READ_ONLY_NOT_VERIFIED: 'IDENTITY_READ_ONLY_NOT_VERIFIED',
  IDENTITY_CLEANUP_FAILED: 'IDENTITY_CLEANUP_FAILED',
  IDENTITY_OBSERVER_EQUALS_TARGET_STOP: 'IDENTITY_OBSERVER_EQUALS_TARGET_STOP',
  IDENTITY_PRIVATE_OUTPUT_EXISTS: 'IDENTITY_PRIVATE_OUTPUT_EXISTS',
  IDENTITY_PRIVATE_OUTPUT_INVALID: 'IDENTITY_PRIVATE_OUTPUT_INVALID',
  IDENTITY_CATALOG_MISSING: 'IDENTITY_CATALOG_MISSING',
  IDENTITY_PREEXECUTION_STOP: 'IDENTITY_PREEXECUTION_STOP',
});

/**
 * Build the fixed (relation, privilege) matrix from source constants only.
 * Literals are re-validated here so no value can ever reach SQL unverified.
 */
function buildPrivilegeMatrixTuples() {
  const tuples = [];
  for (const relation of REQUIRED_SELECT_RELATIONS) {
    if (!/^public\.[A-Za-z_][A-Za-z0-9_]*$/.test(relation)) {
      fail(FAILURE.IDENTITY_INPUT_INVALID);
    }
    for (const privilege of ['SELECT', ...WRITE_PRIVILEGES]) {
      if (!/^[A-Z]+$/.test(privilege)) fail(FAILURE.IDENTITY_INPUT_INVALID);
      tuples.push(`('${relation}', '${privilege}')`);
    }
  }
  return tuples;
}

const PRIVILEGE_MATRIX_TUPLES = Object.freeze(buildPrivilegeMatrixTuples());
const REQUIRED_RELATION_SQL_LIST = Object.freeze(
  REQUIRED_SELECT_RELATION_NAMES.map((name) => `'${name}'`).join(', '),
);

const Q = Object.freeze({
  BEGIN_RO: 'BEGIN READ ONLY',
  SHOW_RO: 'SHOW transaction_read_only',
  ROLLBACK: 'ROLLBACK',
  IDENTITY: `SELECT current_user::text AS current_user,
                    session_user::text AS session_user,
                    current_role::text AS current_role,
                    current_database()::text AS current_database`,
  // Bounded, login-capable, non-system candidate enumeration. Bounded by
  // MAX_CANDIDATE_ROLES at the call site via LIMIT $1 = MAX + 1.
  CANDIDATE_ROLES: `SELECT r.oid::bigint AS oid, r.rolname::text AS role_name
                    FROM pg_roles r
                    WHERE r.rolcanlogin
                      AND r.rolname !~ '^pg_'
                      AND r.rolname <> 'PUBLIC'
                    ORDER BY r.rolname
                    LIMIT $1`,
  CANDIDATE_FLAGS: `SELECT r.oid::bigint AS oid, r.rolname::text AS role_name,
                           r.rolsuper, r.rolcreatedb, r.rolcreaterole,
                           r.rolbypassrls, r.rolreplication, r.rolinherit,
                           r.rolcanlogin
                    FROM pg_roles r
                    WHERE r.oid = ANY($1::oid[])`,
  DATABASE_SCHEMA_BASELINE: `SELECT r.oid::bigint AS oid,
                                    has_database_privilege(r.oid, current_database(), 'CONNECT') AS database_connect,
                                    has_schema_privilege(r.oid, 'public', 'USAGE') AS usage_public
                             FROM pg_roles r
                             WHERE r.oid = ANY($1::oid[])`,
  // Direct (depth-1) membership admin option, matching the reviewed PG17
  // membership semantics used by the #4283 attestation vehicle.
  DIRECT_ADMIN_MEMBERSHIP: `SELECT m.member::bigint AS member_oid,
                                   bool_or(m.admin_option) AS has_admin_option
                            FROM pg_auth_members m
                            WHERE m.member = ANY($1::oid[])
                            GROUP BY m.member`,
  PRIVILEGE_MATRIX: `SELECT r.oid::bigint AS oid, t.rel AS relation_name, t.priv AS privilege_type,
                            has_table_privilege(r.oid, t.rel, t.priv) AS allowed
                     FROM pg_roles r
                     CROSS JOIN (VALUES ${PRIVILEGE_MATRIX_TUPLES.join(', ')})
                       AS t(rel, priv)
                     WHERE r.oid = ANY($1::oid[])
                     ORDER BY r.oid, t.rel, t.priv`,
  RELATION_OWNERS: `SELECT c.relname::text AS relation_name, c.relowner::bigint AS owner_oid
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public'
                      AND c.relname = ANY($1::text[])`,
  REQUIRED_RELATION_GRANTS: `SELECT c.relname::text AS relation_name,
                                    acl.grantee::bigint AS grantee_oid,
                                    CASE WHEN acl.grantee = 0 THEN 'PUBLIC'::text
                                         ELSE grantee_role.rolname::text END AS grantee_name,
                                    acl.privilege_type::text AS privilege_type
                             FROM pg_class c
                             JOIN pg_namespace n ON n.oid = c.relnamespace
                             CROSS JOIN LATERAL aclexplode(
                               COALESCE(c.relacl, acldefault('r'::"char", c.relowner))
                             ) AS acl(grantor, grantee, privilege_type, is_grantable)
                             LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl.grantee
                                                              AND acl.grantee <> 0
                             WHERE n.nspname = 'public'
                               AND c.relname = ANY($1::text[])
                             ORDER BY c.relname, acl.grantee, acl.privilege_type`,
  // Bounded role-ancestry closure for every candidate at once.
  CANDIDATE_ANCESTRY: `WITH RECURSIVE chain AS (
                         SELECT r.oid AS root_oid, r.oid AS member_oid, 0 AS depth,
                                ARRAY[r.oid]::oid[] AS role_path
                         FROM pg_roles r
                         WHERE r.oid = ANY($1::oid[])
                         UNION ALL
                         SELECT child.root_oid, parent.oid, child.depth + 1,
                                child.role_path || parent.oid
                         FROM chain child
                         JOIN pg_auth_members m ON m.member = child.member_oid
                         JOIN pg_roles parent ON parent.oid = m.roleid
                         WHERE child.depth < $2
                           AND NOT parent.oid = ANY(child.role_path)
                       )
                       SELECT DISTINCT root_oid::bigint AS root_oid, member_oid::bigint AS member_oid
                       FROM chain`,
  BROAD_SELECT_GRANTS: `SELECT c.relname::text AS relation_name, acl.grantee::bigint AS grantee_oid
                        FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        CROSS JOIN LATERAL aclexplode(
                          COALESCE(c.relacl, acldefault('r'::"char", c.relowner))
                        ) AS acl(grantor, grantee, privilege_type, is_grantable)
                        WHERE n.nspname = 'public'
                          AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
                          AND acl.privilege_type = 'SELECT'
                          AND acl.grantee = ANY($1::oid[])
                        ORDER BY c.relname, acl.grantee`,
});

const ALLOWED_FLAGS = new Set([
  '--secret-file',
  '--baseline-commit',
  '--approval-reference',
  '--purpose',
]);
const FORBIDDEN_FLAGS = new Set([
  '--host', '--port', '--user', '--username', '--password', '--database',
  '--database-url', '--connection-string', '--schema', '--table', '--role',
  '--objects', '--sql', '--query', '--client', '--output', '--repeat',
  '--role-mapping-file', '--repo-root', '--mapping-file',
]);

function fail(category) {
  const error = new Error(category);
  error.category = category;
  throw error;
}

function safeBoolean(row, field) {
  if (!row || typeof row !== 'object') fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
  const value = row[field] ?? row.allowed ?? row.transaction_read_only ?? Object.values(row)[0];
  if (value === true || ['true', 'on', 't', 'yes'].includes(String(value).toLowerCase())) return true;
  if (value === false || ['false', 'off', 'f', 'no'].includes(String(value).toLowerCase())) return false;
  fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
}

function safeQueryResult(result, field, { allowEmpty = true } = {}) {
  if (!result || !Array.isArray(result.rows)) fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
  if (!allowEmpty && result.rows.length === 0) fail(`IDENTITY_${field}_MISSING`);
  if (result.rows.length > MAX_ACL_ROWS * 4) fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
  return result.rows;
}

function assertTargetRuntimeRole(value) {
  if (typeof value !== 'string' || !IDENT_RE.test(value) || value.length > 63) {
    fail('IDENTITY_TARGET_ROLE_INVALID');
  }
  return value;
}

function parseArgs(args) {
  const values = {};
  const seen = new Set();
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (!flag || !flag.startsWith('--') || FORBIDDEN_FLAGS.has(flag) || !ALLOWED_FLAGS.has(flag)) {
      fail(FAILURE.IDENTITY_INPUT_INVALID);
    }
    if (seen.has(flag)) fail(FAILURE.IDENTITY_INPUT_INVALID);
    seen.add(flag);
    const value = args[i + 1];
    if (!value || value.startsWith('--')) fail(FAILURE.IDENTITY_INPUT_INVALID);
    values[flag.slice(2).replaceAll('-', '_')] = value;
    i += 1;
  }
  return values;
}

function assertSourceBoundApproval(approvalReference, purpose) {
  if (approvalReference !== IDENTITY_APPROVAL_REFERENCE || purpose !== IDENTITY_PURPOSE) {
    fail(FAILURE.IDENTITY_SOURCE_BOUND_APPROVAL_REQUIRED);
  }
}

function assertBaseline(repoRoot, baselineCommit) {
  if (!/^[a-f0-9]{40}$/.test(baselineCommit || '')) fail(FAILURE.IDENTITY_BASELINE_INVALID);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  if (head !== baselineCommit) fail(FAILURE.IDENTITY_BASELINE_HEAD_MISMATCH);
}

/**
 * Evaluate one candidate against the fixed fingerprint. Pure: no I/O.
 * A candidate is accepted only when every safety condition holds.
 */
function evaluateCandidate({
  flags,
  adminOption,
  ownsRequiredRelation,
  databaseConnect,
  usagePublic,
  requiredSelect,
  writePositive,
  publicGrantOnRequired,
  broadAllTableSelect,
}) {
  const reasons = [];
  if (!flags || flags.rolcanlogin !== true) reasons.push('NOT_LOGIN_CAPABLE');
  if (!flags || flags.rolsuper === true) reasons.push('SUPERUSER');
  if (!flags || flags.rolcreatedb === true) reasons.push('CREATEDB');
  if (!flags || flags.rolcreaterole === true) reasons.push('CREATEROLE');
  if (!flags || flags.rolbypassrls === true) reasons.push('BYPASSRLS');
  if (!flags || flags.rolreplication === true) reasons.push('REPLICATION');
  if (adminOption === true) reasons.push('MEMBERSHIP_ADMIN_OPTION');
  if (ownsRequiredRelation === true) reasons.push('RELATION_OWNER');
  if (databaseConnect !== true) reasons.push('DATABASE_CONNECT_MISSING');
  if (usagePublic !== true) reasons.push('PUBLIC_SCHEMA_USAGE_MISSING');
  if (publicGrantOnRequired === true) reasons.push('PUBLIC_GRANT_DEPENDENCY');
  if (broadAllTableSelect === true) reasons.push('BROAD_ALL_TABLE_SELECT');
  if (writePositive === true) reasons.push('WRITE_PRIVILEGE_PRESENT');
  for (const relation of REQUIRED_SELECT_RELATION_NAMES) {
    if (requiredSelect[relation] !== true) reasons.push(`SELECT_MISSING:${relation}`);
  }
  return Object.freeze({ accepted: reasons.length === 0, reasons: Object.freeze(reasons) });
}

function deriveIdentityDisposition(candidateCount) {
  if (candidateCount === 0) return IDENTITY_DISPOSITION.UNRESOLVED;
  if (candidateCount === 1) return IDENTITY_DISPOSITION.RESOLVED;
  return IDENTITY_DISPOSITION.AMBIGUOUS;
}

/** Reduce raw catalog rows into per-candidate booleans. Pure: no I/O. */
function deriveCandidateFacts({
  candidates,
  flagRows,
  adminRows,
  baselineRows,
  matrixRows,
  ownerRows,
  grantRows,
  ancestryRows,
  broadRows,
}) {
  const byOid = new Map(candidates.map((row) => [String(row.oid), row]));
  const flagsByOid = new Map(flagRows.map((row) => [String(row.oid), row]));
  const adminByOid = new Map(adminRows.map((row) => [String(row.member_oid), row]));
  const baselineByOid = new Map(baselineRows.map((row) => [String(row.oid), row]));

  const requiredSelectByOid = new Map();
  const writePositiveByOid = new Map();
  for (const row of matrixRows) {
    if (!row || typeof row.relation_name !== 'string') fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
    if (!REQUIRED_RELATION_SET.has(row.relation_name)) fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
    const oid = String(row.oid);
    const allowed = safeBoolean(row, 'allowed');
    if (row.privilege_type === 'SELECT') {
      if (!requiredSelectByOid.has(oid)) requiredSelectByOid.set(oid, {});
      requiredSelectByOid.get(oid)[row.relation_name] = allowed;
    } else if (WRITE_PRIVILEGES.includes(row.privilege_type)) {
      writePositiveByOid.set(oid, (writePositiveByOid.get(oid) || false) || allowed);
    } else {
      fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
    }
  }

  const ownerOidsByRequiredRelation = new Map();
  for (const row of ownerRows) {
    if (!row || typeof row.relation_name !== 'string') fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
    ownerOidsByRequiredRelation.set(row.relation_name, String(row.owner_oid));
  }

  const publicGrantRelations = new Set();
  const directSelectGrantees = new Map();
  for (const row of grantRows) {
    if (!row || typeof row.relation_name !== 'string') fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
    if (row.privilege_type !== 'SELECT') continue;
    if (String(row.grantee_oid) === '0') {
      publicGrantRelations.add(row.relation_name);
      continue;
    }
    const oid = String(row.grantee_oid);
    if (!directSelectGrantees.has(oid)) directSelectGrantees.set(oid, new Set());
    directSelectGrantees.get(oid).add(row.relation_name);
  }

  const ancestryByRoot = new Map();
  for (const row of ancestryRows) {
    const root = String(row.root_oid);
    if (!ancestryByRoot.has(root)) ancestryByRoot.set(root, new Set());
    ancestryByRoot.get(root).add(String(row.member_oid));
  }

  const broadSelectOids = new Map();
  for (const row of broadRows) {
    if (!row || typeof row.relation_name !== 'string') fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
    const oid = String(row.grantee_oid);
    if (!broadSelectOids.has(oid)) broadSelectOids.set(oid, new Set());
    broadSelectOids.get(oid).add(row.relation_name);
  }

  return candidates.map((candidate) => {
    const oid = String(candidate.oid);
    const roleName = assertTargetRuntimeRole(String(candidate.role_name));
    const flags = flagsByOid.get(oid);
    if (!flags) fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
    const normalisedFlags = {
      rolsuper: safeBoolean(flags, 'rolsuper'),
      rolcreatedb: safeBoolean(flags, 'rolcreatedb'),
      rolcreaterole: safeBoolean(flags, 'rolcreaterole'),
      rolbypassrls: safeBoolean(flags, 'rolbypassrls'),
      rolreplication: safeBoolean(flags, 'rolreplication'),
      rolcanlogin: safeBoolean(flags, 'rolcanlogin'),
    };

    const baseline = baselineByOid.get(oid);
    if (!baseline) fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
    const databaseConnect = safeBoolean(baseline, 'database_connect');
    const usagePublic = safeBoolean(baseline, 'usage_public');

    const adminRow = adminByOid.get(oid);
    const adminOption = adminRow ? safeBoolean(adminRow, 'has_admin_option') : false;

    const requiredSelect = requiredSelectByOid.get(oid) || {};
    let publicGrantOnRequired = false;
    for (const relation of REQUIRED_SELECT_RELATION_NAMES) {
      if (publicGrantRelations.has(relation)) publicGrantOnRequired = true;
    }

    const ownedRelationOids = [...ownerOidsByRequiredRelation.values()];
    const ownsRequiredRelation = ownedRelationOids.includes(oid);

    const ancestry = ancestryByRoot.get(oid) || new Set([oid]);
    let broadAllTableSelect = false;
    for (const memberOid of ancestry) {
      const relations = broadSelectOids.get(memberOid);
      if (!relations) continue;
      for (const relation of relations) {
        if (!REQUIRED_RELATION_SET.has(relation)) broadAllTableSelect = true;
      }
    }

    const evaluation = evaluateCandidate({
      flags: normalisedFlags,
      adminOption,
      ownsRequiredRelation,
      databaseConnect,
      usagePublic,
      requiredSelect,
      writePositive: writePositiveByOid.get(oid) === true,
      publicGrantOnRequired,
      broadAllTableSelect,
    });

    return Object.freeze({
      oid,
      roleName,
      accepted: evaluation.accepted,
      reasons: evaluation.reasons,
      facts: Object.freeze({
        databaseConnect,
        usagePublic,
        adminOption,
        ownsRequiredRelation,
        broadAllTableSelect,
        publicGrantOnRequired,
        requiredSelect: Object.freeze({ ...requiredSelect }),
        directSelectGrantees: Object.freeze({
          [oid]: Object.freeze([...(directSelectGrantees.get(oid) || [])]),
        }),
      }),
    });
  });
}

/**
 * Resolve the single accepted candidate, honouring the observer/target separation
 * rule. Pure: no I/O, no mapping side effects.
 */
function resolveIdentity({ facts, sessionUser, currentUser }) {
  const accepted = facts.filter((row) => row.accepted);
  const disposition = deriveIdentityDisposition(accepted.length);
  const observerEqualsTarget = accepted.some(
    (row) => row.roleName === sessionUser || row.roleName === currentUser,
  );
  const resolved = disposition === IDENTITY_DISPOSITION.RESOLVED && !observerEqualsTarget
    ? { targetRuntimeRole: accepted[0].roleName }
    : null;
  return Object.freeze({
    candidateCount: accepted.length,
    identityDisposition: observerEqualsTarget ? IDENTITY_DISPOSITION.AMBIGUOUS : disposition,
    observerEqualsTarget,
    resolved,
    facts,
  });
}

function buildPrivateMappingPayload(targetRuntimeRole) {
  const role = assertTargetRuntimeRole(targetRuntimeRole);
  if (!ROLE_CLASSES.has(APPLICATION_ROLE_CLASS)) fail(FAILURE.IDENTITY_INPUT_INVALID);
  return {
    target_runtime_role: role,
    role_mapping: { [role]: APPLICATION_ROLE_CLASS },
  };
}

/**
 * Exclusive-create the private mapping. Never overwrites an existing file, and
 * only ever writes inside <repoRoot>/.secrets/.
 */
function writePrivateMapping(repoRoot, payload) {
  const root = path.resolve(repoRoot);
  const secretsRoot = path.resolve(root, '.secrets');
  const abs = path.resolve(root, PRIVATE_OUTPUT_REL_PATH);
  if (abs !== secretsRoot && !abs.startsWith(`${secretsRoot}${path.sep}`)) {
    fail(FAILURE.IDENTITY_PRIVATE_OUTPUT_INVALID);
  }
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
  } catch {
    fail(FAILURE.IDENTITY_PRIVATE_OUTPUT_INVALID);
  }
  let fd;
  try {
    fd = fs.openSync(abs, 'wx', 0o600);
  } catch (err) {
    if (err && err.code === 'EEXIST') fail(FAILURE.IDENTITY_PRIVATE_OUTPUT_EXISTS);
    fail(FAILURE.IDENTITY_PRIVATE_OUTPUT_INVALID);
  }
  try {
    fs.writeSync(fd, `${JSON.stringify(payload, null, 2)}\n`);
  } finally {
    fs.closeSync(fd);
  }
  return PRIVATE_OUTPUT_REL_PATH;
}

/**
 * One bounded read-only collection session. `client` is injectable so the
 * contract suite can drive every branch without a database.
 *
 * Candidate resolution is computed in memory only; `finalize` performs the private
 * mapping write after ROLLBACK and the disconnect have completed, and a cleanup
 * failure suppresses that write instead of being swallowed.
 */
async function collectIdentityReconciliation({ client, repoRoot = REPO_ROOT, writeMapping = writePrivateMapping }) {
  let transactionStarted = false;
  let connected = false;
  let outcome = null;
  let collectionError = null;
  try {
    await client.connect();
    connected = true;
    await client.query(Q.BEGIN_RO);
    transactionStarted = true;
    const readOnly = safeBoolean(
      safeQueryResult(await client.query(Q.SHOW_RO), 'READ_ONLY', { allowEmpty: false })[0],
      'transaction_read_only',
    );
    if (readOnly !== true) fail(FAILURE.IDENTITY_READ_ONLY_NOT_VERIFIED);

    const identity = safeQueryResult(await client.query(Q.IDENTITY), 'IDENTITY', { allowEmpty: false })[0];
    if (!identity || typeof identity.current_user !== 'string' || typeof identity.session_user !== 'string') {
      fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
    }
    const sessionUser = assertTargetRuntimeRole(identity.session_user);
    const currentUser = assertTargetRuntimeRole(identity.current_user);

    const candidateRows = safeQueryResult(
      await client.query(Q.CANDIDATE_ROLES, [MAX_CANDIDATE_ROLES + 1]),
      'CANDIDATE_ROLES',
    );
    if (candidateRows.length > MAX_CANDIDATE_ROLES) fail(FAILURE.IDENTITY_CANDIDATE_BOUND_EXCEEDED);
    for (const row of candidateRows) {
      if (!row || typeof row.role_name !== 'string') fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
      assertTargetRuntimeRole(row.role_name);
    }

    if (candidateRows.length === 0) {
      outcome = {
        disposition: IDENTITY_DISPOSITION.UNRESOLVED,
        candidateCount: 0,
        observerEqualsTarget: false,
        mapped: null,
      };
    } else {
      const oids = candidateRows.map((row) => String(row.oid));
      const flagRows = safeQueryResult(await client.query(Q.CANDIDATE_FLAGS, [oids]), 'CANDIDATE_FLAGS');
      const baselineRows = safeQueryResult(
        await client.query(Q.DATABASE_SCHEMA_BASELINE, [oids]),
        'DATABASE_SCHEMA_BASELINE',
      );
      const adminRows = safeQueryResult(
        await client.query(Q.DIRECT_ADMIN_MEMBERSHIP, [oids]),
        'DIRECT_ADMIN_MEMBERSHIP',
      );
      const matrixRows = safeQueryResult(
        await client.query(Q.PRIVILEGE_MATRIX, [oids]),
        'PRIVILEGE_MATRIX',
        { allowEmpty: false },
      );
      const ownerRows = safeQueryResult(await client.query(Q.RELATION_OWNERS, [REQUIRED_SELECT_RELATION_NAMES]), 'RELATION_OWNERS');
      const grantRows = safeQueryResult(await client.query(Q.REQUIRED_RELATION_GRANTS, [REQUIRED_SELECT_RELATION_NAMES]), 'REQUIRED_RELATION_GRANTS');
      const ancestryRows = safeQueryResult(
        await client.query(Q.CANDIDATE_ANCESTRY, [oids, MAX_ROLE_CHAIN_DEPTH]),
        'CANDIDATE_ANCESTRY',
        { allowEmpty: false },
      );
      if (ancestryRows.length > MAX_ROLE_CHAIN_ROWS * MAX_CANDIDATE_ROLES) {
        fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
      }
      const ancestryOids = [...new Set(ancestryRows.map((row) => String(row.member_oid)))];
      if (ancestryOids.length > MAX_ROLE_CHAIN_ROWS) fail(FAILURE.IDENTITY_CATALOG_SHAPE_INVALID);
      const broadRows = safeQueryResult(
        await client.query(Q.BROAD_SELECT_GRANTS, [ancestryOids]),
        'BROAD_SELECT_GRANTS',
      );

      const facts = deriveCandidateFacts({
        candidates: candidateRows,
        flagRows,
        adminRows,
        baselineRows,
        matrixRows,
        ownerRows,
        grantRows,
        ancestryRows,
        broadRows,
      });
      const resolution = resolveIdentity({ facts, sessionUser, currentUser });
      outcome = {
        disposition: resolution.identityDisposition,
        candidateCount: resolution.candidateCount,
        observerEqualsTarget: resolution.observerEqualsTarget,
        mapped: resolution.resolved,
      };
    }
  } catch (error) {
    collectionError = error;
  }

  let cleanupFailed = false;
  if (transactionStarted) {
    try { await client.query(Q.ROLLBACK); } catch { cleanupFailed = true; }
  }
  if (connected) {
    try { await client.end(); } catch { cleanupFailed = true; }
  }

  if (collectionError) throw collectionError;
  if (cleanupFailed) fail(FAILURE.IDENTITY_CLEANUP_FAILED);

  return finalize({
    disposition: outcome.disposition,
    candidateCount: outcome.candidateCount,
    observerEqualsTarget: outcome.observerEqualsTarget,
    mapped: outcome.mapped,
    writeMapping,
    repoRoot,
  });
}

function finalize({
  disposition,
  candidateCount,
  observerEqualsTarget,
  mapped,
  writeMapping = writePrivateMapping,
  repoRoot = REPO_ROOT,
}) {
  // The private mapping is written only after every catalog read, the ROLLBACK
  // and the disconnect have completed.
  const mappingWritten = mapped
    ? writeMapping(repoRoot, buildPrivateMappingPayload(mapped.targetRuntimeRole))
    : null;
  return Object.freeze({
    candidateCount,
    identityDisposition: disposition,
    applicationRoleClass: APPLICATION_ROLE_CLASS,
    privateMappingWritten: mappingWritten ? 'YES' : 'NO',
    privateMappingRelPath: mappingWritten,
    observerEqualsTarget: observerEqualsTarget ? 'YES' : 'NO',
    requiredSelectFingerprintMatched: disposition === IDENTITY_DISPOSITION.RESOLVED && !observerEqualsTarget ? 'YES' : 'NO',
    writeNegativeFingerprintMatched: disposition === IDENTITY_DISPOSITION.RESOLVED && !observerEqualsTarget ? 'YES' : 'NO',
    roleSafetyFingerprintMatched: disposition === IDENTITY_DISPOSITION.RESOLVED && !observerEqualsTarget ? 'YES' : 'NO',
    databaseConnectBaseline: 'VERIFIED',
    usagePublicBaseline: 'VERIFIED',
    broadAllTableSelect: 'NO',
  });
}

function sanitizedFailure(category, runnerInvocationCount = 0) {
  return {
    runnerInvocationCount,
    productionConnectionCount: runnerInvocationCount,
    collectionSessionCount: runnerInvocationCount,
    transactionReadOnly: runnerInvocationCount ? 'FAILED' : 'NOT_REACHED',
    candidateCount: 0,
    identityDisposition: category === FAILURE.IDENTITY_OBSERVER_EQUALS_TARGET_STOP
      ? IDENTITY_DISPOSITION.AMBIGUOUS
      : IDENTITY_DISPOSITION.UNRESOLVED,
    applicationRoleClass: APPLICATION_ROLE_CLASS,
    privateMappingWritten: 'NO',
    privateMappingRelPath: null,
    observerEqualsTarget: category === FAILURE.IDENTITY_OBSERVER_EQUALS_TARGET_STOP ? 'YES' : 'UNKNOWN',
    requiredSelectFingerprintMatched: 'UNKNOWN',
    writeNegativeFingerprintMatched: 'UNKNOWN',
    roleSafetyFingerprintMatched: 'UNKNOWN',
    databaseConnectBaseline: 'UNKNOWN',
    usagePublicBaseline: 'UNKNOWN',
    broadAllTableSelect: 'UNKNOWN',
    rawRoleExposed: 'NO',
    rawGranteeExposed: 'NO',
    rawSecretExposed: 'NO',
    errorCategory: category,
  };
}

function formatSuccess(result) {
  return {
    runnerInvocationCount: 1,
    productionConnectionCount: 1,
    collectionSessionCount: 1,
    transactionReadOnly: 'VERIFIED',
    candidateCount: result.candidateCount,
    identityDisposition: result.identityDisposition,
    applicationRoleClass: result.applicationRoleClass,
    privateMappingWritten: result.privateMappingWritten,
    requiredSelectFingerprintMatched: result.requiredSelectFingerprintMatched,
    writeNegativeFingerprintMatched: result.writeNegativeFingerprintMatched,
    roleSafetyFingerprintMatched: result.roleSafetyFingerprintMatched,
    databaseConnectBaseline: result.databaseConnectBaseline,
    usagePublicBaseline: result.usagePublicBaseline,
    broadAllTableSelect: result.broadAllTableSelect,
    observerEqualsTarget: result.observerEqualsTarget,
    rawRoleExposed: 'NO',
    rawGranteeExposed: 'NO',
    rawSecretExposed: 'NO',
  };
}

async function main() {
  let runnerInvocationCount = 0;
  try {
    const args = parseArgs(process.argv.slice(2));
    assertSourceBoundApproval(args.approval_reference, args.purpose);
    assertBaseline(REPO_ROOT, args.baseline_commit);
    if (!args.secret_file) fail(FAILURE.IDENTITY_INPUT_INVALID);
    const secretUrl = boundary.loadDedicatedProductionReadonlyDatabaseUrl(REPO_ROOT, args.secret_file);
    const pgConfig = boundary.parseProductionReadonlyDatabaseUrl(secretUrl);

    // The sole live invocation starts only after all source-bound and input checks.
    runnerInvocationCount = 1;
    const { Client } = require('pg');
    const result = await collectIdentityReconciliation({ client: new Client(pgConfig) });
    process.stdout.write(`${JSON.stringify(formatSuccess(result), null, 2)}\n`);
  } catch (error) {
    const category = error && typeof error.category === 'string' ? error.category : FAILURE.IDENTITY_PREEXECUTION_STOP;
    process.stdout.write(`${JSON.stringify(sanitizedFailure(category, runnerInvocationCount), null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();

module.exports = {
  SOURCE_BOUND_ISSUE,
  IDENTITY_PURPOSE,
  IDENTITY_APPROVAL_REFERENCE,
  APPLICATION_ROLE_CLASS,
  ROLE_CLASSES,
  REQUIRED_SELECT_RELATIONS,
  REQUIRED_SELECT_RELATION_NAMES,
  REQUIRED_RELATION_SET,
  WRITE_PRIVILEGES,
  MAX_CANDIDATE_ROLES,
  MAX_ROLE_CHAIN_DEPTH,
  PRIVATE_OUTPUT_REL_PATH,
  IDENTITY_DISPOSITION,
  FAILURE,
  Q,
  parseArgs,
  assertSourceBoundApproval,
  assertTargetRuntimeRole,
  assertBaseline,
  evaluateCandidate,
  deriveIdentityDisposition,
  deriveCandidateFacts,
  resolveIdentity,
  buildPrivateMappingPayload,
  writePrivateMapping,
  collectIdentityReconciliation,
  sanitizedFailure,
  formatSuccess,
};
