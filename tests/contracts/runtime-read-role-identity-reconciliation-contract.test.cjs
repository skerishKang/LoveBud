'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const identity = require('../../scripts/run-production-readonly-runtime-read-role-identity-reconciliation.cjs');

const {
  IDENTITY_APPROVAL_REFERENCE,
  IDENTITY_PURPOSE,
  APPLICATION_ROLE_CLASS,
  REQUIRED_SELECT_RELATIONS,
  REQUIRED_SELECT_RELATION_NAMES,
  WRITE_PRIVILEGES,
  MAX_CANDIDATE_ROLES,
  PRIVATE_OUTPUT_REL_PATH,
  IDENTITY_DISPOSITION,
  FAILURE,
  Q,
  parseArgs,
  assertSourceBoundApproval,
  evaluateCandidate,
  deriveIdentityDisposition,
  deriveCandidateFacts,
  resolveIdentity,
  buildPrivateMappingPayload,
  writePrivateMapping,
  collectIdentityReconciliation,
} = identity;

const RUNNER_SOURCE_PATH = path.join(__dirname, '..', '..', 'scripts',
  'run-production-readonly-runtime-read-role-identity-reconciliation.cjs');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEFAULT_FLAGS = Object.freeze({
  rolsuper: false, rolcreatedb: false, rolcreaterole: false,
  rolbypassrls: false, rolreplication: false, rolinherit: true, rolcanlogin: true,
});

/** Build a synthetic catalog for the fake client. */
function buildCatalog({
  roles = [{ name: 'app_read_role', oid: '100' }],
  ownerOid = '1',
  publicGrantRelations = [],
  broadRelations = {},
  ancestry = null,
} = {}) {
  const candidateRows = roles.map((role) => ({ oid: role.oid, role_name: role.name }));
  const flagRows = roles.map((role) => ({
    oid: role.oid, role_name: role.name, ...DEFAULT_FLAGS, ...(role.flags || {}),
  }));
  const baselineRows = roles.map((role) => ({
    oid: role.oid,
    database_connect: role.databaseConnect === undefined ? true : role.databaseConnect,
    usage_public: role.usagePublic === undefined ? true : role.usagePublic,
  }));
  const adminRows = roles.filter((role) => role.adminOption).map((role) => ({
    member_oid: role.oid, has_admin_option: true,
  }));
  const matrixRows = [];
  for (const role of roles) {
    for (const relation of REQUIRED_SELECT_RELATIONS) {
      const name = relation.slice('public.'.length);
      const selectValue = role.select === undefined ? true : role.select[name];
      matrixRows.push({
        oid: role.oid, relation_name: name, privilege_type: 'SELECT', allowed: selectValue === true,
      });
      for (const privilege of WRITE_PRIVILEGES) {
        const writeValue = role.write === undefined ? false : role.write[privilege] === true;
        matrixRows.push({
          oid: role.oid, relation_name: name, privilege_type: privilege, allowed: writeValue,
        });
      }
    }
  }
  const ownerRows = REQUIRED_SELECT_RELATION_NAMES.map((name) => ({
    relation_name: name, owner_oid: ownerOid,
  }));
  const grantRows = [];
  for (const role of roles) {
    for (const relation of REQUIRED_SELECT_RELATIONS) {
      const name = relation.slice('public.'.length);
      const selectValue = role.select === undefined ? true : role.select[name];
      if (selectValue === true) {
        grantRows.push({ relation_name: name, grantee_oid: role.oid, grantee_name: role.name, privilege_type: 'SELECT' });
      }
    }
  }
  for (const relation of publicGrantRelations) {
    grantRows.push({ relation_name: relation, grantee_oid: '0', grantee_name: 'PUBLIC', privilege_type: 'SELECT' });
  }
  const ancestryRows = ancestry
    || roles.map((role) => ({ root_oid: role.oid, member_oid: role.oid }));
  const broadRows = [];
  for (const [oid, relations] of Object.entries(broadRelations)) {
    for (const relation of relations) broadRows.push({ relation_name: relation, grantee_oid: oid });
  }
  return { candidateRows, flagRows, baselineRows, adminRows, matrixRows, ownerRows, grantRows, ancestryRows, broadRows };
}

const QUERY_ROUTES = new Map([
  [Q.CANDIDATE_ROLES, 'candidateRows'],
  [Q.CANDIDATE_FLAGS, 'flagRows'],
  [Q.DATABASE_SCHEMA_BASELINE, 'baselineRows'],
  [Q.DIRECT_ADMIN_MEMBERSHIP, 'adminRows'],
  [Q.PRIVILEGE_MATRIX, 'matrixRows'],
  [Q.RELATION_OWNERS, 'ownerRows'],
  [Q.REQUIRED_RELATION_GRANTS, 'grantRows'],
  [Q.CANDIDATE_ANCESTRY, 'ancestryRows'],
  [Q.BROAD_SELECT_GRANTS, 'broadRows'],
]);

function makeFakeClient(catalog, {
  sessionUser = 'observer_role',
  currentUser = 'observer_role',
  currentRole = 'observer_role',
  readOnly = true,
  failOn = null,
  connectError = null,
} = {}) {
  const calls = [];
  const state = { connects: 0, ends: 0 };
  return {
    calls,
    state,
    async connect() {
      calls.push('connect');
      state.connects += 1;
      if (connectError) throw Object.assign(new Error(connectError), { category: connectError });
    },
    async end() { calls.push('end'); state.ends += 1; },
    async query(text) {
      calls.push(text);
      if (failOn && text === failOn) throw new Error('catalog failure');
      if (text === Q.BEGIN_RO || text === Q.ROLLBACK) return { rows: [] };
      if (text === Q.SHOW_RO) return { rows: [{ transaction_read_only: readOnly }] };
      if (text === Q.IDENTITY) {
        return { rows: [{ current_user: currentUser, session_user: sessionUser, current_role: currentRole, current_database: 'neondb' }] };
      }
      const key = QUERY_ROUTES.get(text);
      if (!key) throw new Error(`unrouted query: ${text}`);
      return { rows: catalog[key].map((row) => ({ ...row })) };
    },
  };
}

function collectFixture(options = {}) {
  const catalog = buildCatalog(options.catalog);
  const client = makeFakeClient(catalog, options.client);
  const writes = [];
  const writeMapping = (repoRoot, payload) => {
    writes.push({ repoRoot, payload });
    return PRIVATE_OUTPUT_REL_PATH;
  };
  return collectIdentityReconciliation({ client, writeMapping })
    .then((result) => ({ result, client, writes }));
}

// ---------------------------------------------------------------------------
// Source authority
// ---------------------------------------------------------------------------

describe('LoveBud #4422 runtime read-role identity reconciliation contract', () => {
  it('accepts only the exact #4422 identity approval/purpose pair and rejects every cross pairing', () => {
    assert.doesNotThrow(() => assertSourceBoundApproval(IDENTITY_APPROVAL_REFERENCE, IDENTITY_PURPOSE));
    assert.equal(IDENTITY_APPROVAL_REFERENCE, 'issue:4422');
    assert.equal(IDENTITY_PURPOSE, 'ONE_PRODUCTION_READONLY_RUNTIME_READ_ROLE_IDENTITY_RECONCILIATION');
    for (const pairing of [
      ['issue:4000', IDENTITY_PURPOSE],
      ['issue:4423', IDENTITY_PURPOSE],
      ['issue:4422', 'ONE_PRODUCTION_READONLY_RUNTIME_ROLE_ACL_ATTESTATION'],
      ['issue:4422', 'ONE_PRODUCTION_READONLY_MEMORY_SOCIAL_READ_ACL_ATTESTATION'],
      ['issue:4422', 'ARBITRARY_PURPOSE'],
      ['', ''],
      [undefined, undefined],
    ]) {
      assert.throws(
        () => assertSourceBoundApproval(pairing[0], pairing[1]),
        /IDENTITY_SOURCE_BOUND_APPROVAL_REQUIRED/,
        `pairing must fail closed: ${pairing.join(' + ')}`,
      );
    }
  });

  it('exposes exactly the four permitted CLI flags and rejects every identity-bearing flag', () => {
    assert.deepEqual(parseArgs([
      '--secret-file', '.secrets/readonly.env',
      '--baseline-commit', 'f'.repeat(40),
      '--approval-reference', 'issue:4422',
      '--purpose', IDENTITY_PURPOSE,
    ]), {
      secret_file: '.secrets/readonly.env',
      baseline_commit: 'f'.repeat(40),
      approval_reference: 'issue:4422',
      purpose: IDENTITY_PURPOSE,
    });

    for (const flag of [
      '--role-mapping-file', '--role', '--table', '--schema', '--objects',
      '--sql', '--query', '--connection-string', '--database-url', '--output',
      '--repeat', '--repo-root', '--host', '--user', '--password',
    ]) {
      assert.throws(
        () => parseArgs([flag, 'value']),
        /IDENTITY_INPUT_INVALID/,
        `${flag} must be rejected`,
      );
    }
    assert.throws(() => parseArgs(['--secret-file', '.secrets/a.env', '--secret-file', '.secrets/b.env']), /IDENTITY_INPUT_INVALID/);
    assert.throws(() => parseArgs(['--secret-file']), /IDENTITY_INPUT_INVALID/);
  });

  it('carries no raw Production role literal, no historical seed, and no tree_likes on the query surface', () => {
    const source = fs.readFileSync(RUNNER_SOURCE_PATH, 'utf8');
    // Raw role literals that appear in tracked docs must never be seeded here.
    assert.equal(source.includes('lb_ro_'), false);
    assert.equal(source.includes('lb_product_rw_'), false);
    assert.equal(source.includes('709d5f3e68f774d2'), false);
    assert.equal(source.includes('a3f8c2d1'), false);

    // Identity discovery must not collapse into a B1 privilege measurement.
    const querySurface = Object.values(Q).join('\n');
    assert.equal(querySurface.includes('tree_likes'), false);
    assert.equal(querySurface.includes('TREE_LIKES'), false);
    assert.equal(REQUIRED_SELECT_RELATIONS.some((value) => value.includes('tree_likes')), false);
  });

  it('pins the required fingerprint to the seven reviewed read-envelope relations only', () => {
    assert.deepEqual([...REQUIRED_SELECT_RELATION_NAMES], [
      'trees', 'memories', 'tree_social_counts', 'reactions', 'comments', 'tree_comments', 'tree_hub_layouts',
    ]);
    assert.deepEqual([...WRITE_PRIVILEGES], ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);
    assert.equal(MAX_CANDIDATE_ROLES, 64);
  });

  it('contains no mutation statement on the live query surface', () => {
    const querySurface = Object.values(Q).join('\n');
    for (const pattern of [/\bGRANT\b/, /\bREVOKE\b/, /\bINSERT\s+INTO\b/i, /\bUPDATE\s+\S+\s+SET\b/i,
      /\bDELETE\s+FROM\b/i, /\bALTER\b/i, /\bDROP\b/i, /\bCREATE\b/, /\bTRUNCATE\s+TABLE\b/i]) {
      assert.equal(pattern.test(querySurface), false, `query surface must not contain ${pattern}`);
    }
    // Product relations may only be reached through catalog / privilege functions.
    assert.equal(/FROM\s+public\./i.test(querySurface), false);
  });
});

// ---------------------------------------------------------------------------
// Candidate decisions
// ---------------------------------------------------------------------------

describe('LoveBud #4422 identity candidate decisions', () => {
  it('resolves exactly one safe candidate and writes a one-entry APPLICATION mapping', async () => {
    const { result, writes } = await collectFixture({ catalog: { roles: [{ name: 'app_read_role', oid: '100' }] } });
    assert.equal(result.candidateCount, 1);
    assert.equal(result.identityDisposition, IDENTITY_DISPOSITION.RESOLVED);
    assert.equal(result.privateMappingWritten, 'YES');
    assert.equal(result.observerEqualsTarget, 'NO');
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0].payload, {
      target_runtime_role: 'app_read_role',
      role_mapping: { app_read_role: APPLICATION_ROLE_CLASS },
    });
  });

  it('reports UNRESOLVED and writes nothing when no candidate matches', async () => {
    const { result, writes } = await collectFixture({
      catalog: { roles: [{ name: 'app_read_role', oid: '100', flags: { rolcanlogin: false } }] },
    });
    assert.equal(result.candidateCount, 0);
    assert.equal(result.identityDisposition, IDENTITY_DISPOSITION.UNRESOLVED);
    assert.equal(result.privateMappingWritten, 'NO');
    assert.equal(writes.length, 0);
  });

  it('reports AMBIGUOUS and writes nothing when two candidates match', async () => {
    const { result, writes } = await collectFixture({
      catalog: { roles: [{ name: 'app_read_a', oid: '100' }, { name: 'app_read_b', oid: '101' }] },
    });
    assert.equal(result.candidateCount, 2);
    assert.equal(result.identityDisposition, IDENTITY_DISPOSITION.AMBIGUOUS);
    assert.equal(result.privateMappingWritten, 'NO');
    assert.equal(writes.length, 0);
  });

  it('stops with no mapping when the observer is itself the resolved candidate', async () => {
    const { result, writes } = await collectFixture({
      catalog: { roles: [{ name: 'app_read_role', oid: '100' }] },
      client: { sessionUser: 'app_read_role' },
    });
    assert.equal(result.observerEqualsTarget, 'YES');
    assert.equal(result.privateMappingWritten, 'NO');
    assert.equal(result.requiredSelectFingerprintMatched, 'NO');
    assert.equal(writes.length, 0);
  });

  it('stops with no mapping when current_user is the resolved candidate', async () => {
    const { result, writes } = await collectFixture({
      catalog: { roles: [{ name: 'app_read_role', oid: '100' }] },
      client: { currentUser: 'app_read_role' },
    });
    assert.equal(result.observerEqualsTarget, 'YES');
    assert.equal(writes.length, 0);
  });

  it('reports derived disposition for every candidate count', () => {
    assert.equal(deriveIdentityDisposition(0), IDENTITY_DISPOSITION.UNRESOLVED);
    assert.equal(deriveIdentityDisposition(1), IDENTITY_DISPOSITION.RESOLVED);
    assert.equal(deriveIdentityDisposition(2), IDENTITY_DISPOSITION.AMBIGUOUS);
    assert.equal(deriveIdentityDisposition(9), IDENTITY_DISPOSITION.AMBIGUOUS);
  });
});

// ---------------------------------------------------------------------------
// Candidate safety filters
// ---------------------------------------------------------------------------

describe('LoveBud #4422 identity candidate safety filters', () => {
  const safeCandidate = () => ({
    flags: { rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false, rolreplication: false, rolcanlogin: true },
    adminOption: false,
    ownsRequiredRelation: false,
    databaseConnect: true,
    usagePublic: true,
    requiredSelect: Object.fromEntries(REQUIRED_SELECT_RELATION_NAMES.map((name) => [name, true])),
    writePositive: false,
    publicGrantOnRequired: false,
    broadAllTableSelect: false,
  });

  it('accepts the clean baseline candidate', () => {
    assert.equal(evaluateCandidate(safeCandidate()).accepted, true);
  });

  it('rejects every role-flag, admin, ownership, baseline and broadness violation', () => {
    const cases = [
      ['rolsuper', { flags: { ...safeCandidate().flags, rolsuper: true } }],
      ['rolcreatedb', { flags: { ...safeCandidate().flags, rolcreatedb: true } }],
      ['rolcreaterole', { flags: { ...safeCandidate().flags, rolcreaterole: true } }],
      ['rolbypassrls', { flags: { ...safeCandidate().flags, rolbypassrls: true } }],
      ['rolreplication', { flags: { ...safeCandidate().flags, rolreplication: true } }],
      ['rolcanlogin', { flags: { ...safeCandidate().flags, rolcanlogin: false } }],
      ['adminOption', { adminOption: true }],
      ['ownsRequiredRelation', { ownsRequiredRelation: true }],
      ['databaseConnect', { databaseConnect: false }],
      ['usagePublic', { usagePublic: false }],
      ['publicGrantOnRequired', { publicGrantOnRequired: true }],
      ['broadAllTableSelect', { broadAllTableSelect: true }],
      ['writePositive', { writePositive: true }],
    ];
    for (const [label, override] of cases) {
      const result = evaluateCandidate({ ...safeCandidate(), ...override });
      assert.equal(result.accepted, false, `${label} must be rejected`);
      assert.ok(result.reasons.length > 0, `${label} must record a reason`);
    }
  });

  it('rejects a candidate missing any single required SELECT', () => {
    for (const missing of REQUIRED_SELECT_RELATION_NAMES) {
      const requiredSelect = Object.fromEntries(REQUIRED_SELECT_RELATION_NAMES.map((name) => [name, name !== missing]));
      const result = evaluateCandidate({ ...safeCandidate(), requiredSelect });
      assert.equal(result.accepted, false, `missing ${missing} must be rejected`);
      assert.ok(result.reasons.includes(`SELECT_MISSING:${missing}`));
    }
  });

  it('rejects each individual write privilege on the fingerprint surface', async () => {
    for (const privilege of WRITE_PRIVILEGES) {
      const { result, writes } = await collectFixture({
        catalog: { roles: [{ name: 'app_read_role', oid: '100', write: { [privilege]: true } }] },
      });
      assert.equal(result.candidateCount, 0, `${privilege} must disqualify the candidate`);
      assert.equal(result.identityDisposition, IDENTITY_DISPOSITION.UNRESOLVED);
      assert.equal(writes.length, 0);
    }
  });

  it('rejects PUBLIC-grant dependency and broad all-table SELECT', async () => {
    const publicDep = await collectFixture({
      catalog: { roles: [{ name: 'app_read_role', oid: '100' }], publicGrantRelations: ['reactions'] },
    });
    assert.equal(publicDep.result.candidateCount, 0);
    assert.equal(publicDep.writes.length, 0);

    const broad = await collectFixture({
      catalog: { roles: [{ name: 'app_read_role', oid: '100' }], broadRelations: { 100: ['tree_view_dedup_events'] } },
    });
    assert.equal(broad.result.candidateCount, 0);
    assert.equal(broad.writes.length, 0);
  });

  it('rejects a candidate that owns a fingerprint relation', async () => {
    const { result, writes } = await collectFixture({
      catalog: { roles: [{ name: 'app_read_role', oid: '100' }], ownerOid: '100' },
    });
    assert.equal(result.candidateCount, 0);
    assert.equal(writes.length, 0);
  });

  it('rejects an inherited broad SELECT through an ancestor role', async () => {
    const { result, writes } = await collectFixture({
      catalog: {
        roles: [{ name: 'app_read_role', oid: '100' }],
        ancestry: [{ root_oid: '100', member_oid: '100' }, { root_oid: '100', member_oid: '200' }],
        broadRelations: { 200: ['social_audit_log'] },
      },
    });
    assert.equal(result.candidateCount, 0);
    assert.equal(writes.length, 0);
  });

  it('rejects a non-login role and an admin-option membership', async () => {
    const noLogin = await collectFixture({
      catalog: { roles: [{ name: 'app_read_role', oid: '100', flags: { rolcanlogin: false } }] },
    });
    assert.equal(noLogin.result.candidateCount, 0);

    const admin = await collectFixture({
      catalog: { roles: [{ name: 'app_read_role', oid: '100', adminOption: true }] },
    });
    assert.equal(admin.result.candidateCount, 0);
  });

  it('fails closed when the bounded candidate enumeration is exceeded', async () => {
    const roles = Array.from({ length: MAX_CANDIDATE_ROLES + 1 }, (_, index) => ({
      name: `candidate_role_${index}`, oid: String(1000 + index),
    }));
    await assert.rejects(
      () => collectFixture({ catalog: { roles } }),
      /IDENTITY_CANDIDATE_BOUND_EXCEEDED/,
    );
  });
});

// ---------------------------------------------------------------------------
// Transaction lifecycle
// ---------------------------------------------------------------------------

describe('LoveBud #4422 identity reconciliation transaction lifecycle', () => {
  it('connects once, begins one read-only transaction, rolls back, and disconnects in order', async () => {
    const { client, writes } = await collectFixture({ catalog: { roles: [{ name: 'app_read_role', oid: '100' }] } });
    assert.equal(client.state.connects, 1);
    assert.equal(client.state.ends, 1);
    const beginIndex = client.calls.indexOf(Q.BEGIN_RO);
    const rollbackIndex = client.calls.indexOf(Q.ROLLBACK);
    const endIndex = client.calls.indexOf('end');
    assert.ok(beginIndex > 0, 'BEGIN must follow connect');
    assert.equal(client.calls.filter((call) => call === Q.BEGIN_RO).length, 1);
    assert.equal(client.calls.filter((call) => call === Q.ROLLBACK).length, 1);
    assert.ok(rollbackIndex > beginIndex, 'ROLLBACK must follow BEGIN');
    assert.ok(endIndex > rollbackIndex, 'disconnect must follow ROLLBACK');
    assert.equal(writes.length, 1);
  });

  it('never maps and still rolls back when the read-only transaction cannot be verified', async () => {
    const catalog = buildCatalog({ roles: [{ name: 'app_read_role', oid: '100' }] });
    const client = makeFakeClient(catalog, { readOnly: false });
    let writes = 0;
    await assert.rejects(
      () => collectIdentityReconciliation({ client, writeMapping: () => { writes += 1; return PRIVATE_OUTPUT_REL_PATH; } }),
      /IDENTITY_READ_ONLY_NOT_VERIFIED/,
    );
    assert.equal(writes, 0);
    assert.equal(client.calls.filter((call) => call === Q.ROLLBACK).length, 1);
    assert.equal(client.state.ends, 1);
  });

  it('never opens a second connection and never maps when connect fails', async () => {
    const catalog = buildCatalog({ roles: [{ name: 'app_read_role', oid: '100' }] });
    const client = makeFakeClient(catalog, { connectError: 'ETIMEDOUT' });
    let writes = 0;
    await assert.rejects(
      () => collectIdentityReconciliation({ client, writeMapping: () => { writes += 1; return PRIVATE_OUTPUT_REL_PATH; } }),
      /ETIMEDOUT/,
    );
    assert.equal(client.state.connects, 1);
    assert.equal(writes, 0);
  });

  it('rolls back, disconnects and never maps when a catalog query fails', async () => {
    const catalog = buildCatalog({ roles: [{ name: 'app_read_role', oid: '100' }] });
    const client = makeFakeClient(catalog, { failOn: Q.PRIVILEGE_MATRIX });
    let writes = 0;
    await assert.rejects(
      () => collectIdentityReconciliation({ client, writeMapping: () => { writes += 1; return PRIVATE_OUTPUT_REL_PATH; } }),
      /catalog failure/,
    );
    assert.equal(client.calls.filter((call) => call === Q.ROLLBACK).length, 1);
    assert.equal(client.state.ends, 1);
    assert.equal(writes, 0);
  });
});

// ---------------------------------------------------------------------------
// Private mapping output
// ---------------------------------------------------------------------------

describe('LoveBud #4422 private mapping output', () => {
  it('builds exactly a two-key one-entry APPLICATION payload', () => {
    const payload = buildPrivateMappingPayload('app_read_role');
    assert.deepEqual(Object.keys(payload).sort(), ['role_mapping', 'target_runtime_role']);
    assert.equal(Object.keys(payload.role_mapping).length, 1);
    assert.equal(Object.keys(payload.role_mapping)[0], payload.target_runtime_role);
    assert.equal(payload.role_mapping.app_read_role, APPLICATION_ROLE_CLASS);
    assert.equal(APPLICATION_ROLE_CLASS, 'APPLICATION');
    assert.throws(() => buildPrivateMappingPayload('bad role'), /IDENTITY_TARGET_ROLE_INVALID/);
  });

  it('uses a fixed source-controlled destination path', () => {
    assert.equal(PRIVATE_OUTPUT_REL_PATH, '.secrets/private/4422-b1-target-role-mapping.json');
    assert.equal(PRIVATE_OUTPUT_REL_PATH.startsWith('.secrets/'), true);
  });

  it('exclusive-creates the mapping and fails closed on an existing destination', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lovebud-4422-identity-'));
    try {
      const payload = buildPrivateMappingPayload('app_read_role');
      const relPath = writePrivateMapping(repoRoot, payload);
      assert.equal(relPath, PRIVATE_OUTPUT_REL_PATH);
      const abs = path.join(repoRoot, PRIVATE_OUTPUT_REL_PATH);
      assert.equal(fs.statSync(abs).isFile(), true);
      assert.deepEqual(JSON.parse(fs.readFileSync(abs, 'utf8')), payload);

      assert.throws(
        () => writePrivateMapping(repoRoot, buildPrivateMappingPayload('other_role')),
        /IDENTITY_PRIVATE_OUTPUT_EXISTS/,
      );
      // The original content must survive a rejected overwrite.
      assert.equal(JSON.parse(fs.readFileSync(abs, 'utf8')).target_runtime_role, 'app_read_role');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('never writes a mapping on UNRESOLVED or AMBIGUOUS outcomes', async () => {
    const unresolved = await collectFixture({
      catalog: { roles: [{ name: 'app_read_role', oid: '100', flags: { rolsuper: true } }] },
    });
    assert.equal(unresolved.result.privateMappingWritten, 'NO');
    assert.equal(unresolved.writes.length, 0);

    const ambiguous = await collectFixture({
      catalog: { roles: [{ name: 'app_read_a', oid: '100' }, { name: 'app_read_b', oid: '101' }] },
    });
    assert.equal(ambiguous.result.privateMappingWritten, 'NO');
    assert.equal(ambiguous.writes.length, 0);
  });

  it('reports a sanitized failure shape with no raw identifiers', () => {
    const failure = identity.sanitizedFailure(FAILURE.IDENTITY_CANDIDATE_BOUND_EXCEEDED, 1);
    assert.equal(failure.rawRoleExposed, 'NO');
    assert.equal(failure.rawGranteeExposed, 'NO');
    assert.equal(failure.rawSecretExposed, 'NO');
    assert.equal(failure.privateMappingWritten, 'NO');
    assert.equal(failure.errorCategory, FAILURE.IDENTITY_CANDIDATE_BOUND_EXCEEDED);
    const serialized = JSON.stringify(failure);
    assert.equal(serialized.includes('lb_ro_'), false);
    assert.equal(serialized.includes('app_read_role'), false);
  });

  it('never leaks a raw role name into the success envelope', async () => {
    const { result } = await collectFixture({ catalog: { roles: [{ name: 'app_read_role', oid: '100' }] } });
    const serialized = JSON.stringify(identity.formatSuccess(result));
    assert.equal(serialized.includes('app_read_role'), false);
    assert.equal(serialized.includes('rawRoleExposed'), true);
    assert.equal(JSON.parse(serialized).rawRoleExposed, 'NO');
    assert.equal(JSON.parse(serialized).privateMappingWritten, 'YES');
  });
});

// ---------------------------------------------------------------------------
// Pure reducers
// ---------------------------------------------------------------------------

describe('LoveBud #4422 identity pure reducers', () => {
  it('derives facts and resolves identity without touching the candidate list order', () => {
    const catalog = buildCatalog({ roles: [{ name: 'app_read_role', oid: '100' }] });
    const facts = deriveCandidateFacts({ ...catalog, candidates: catalog.candidateRows });
    assert.equal(facts.length, 1);
    assert.equal(facts[0].roleName, 'app_read_role');
    assert.equal(facts[0].accepted, true);

    const resolution = resolveIdentity({ facts, sessionUser: 'observer_role', currentUser: 'observer_role' });
    assert.equal(resolution.identityDisposition, IDENTITY_DISPOSITION.RESOLVED);
    assert.deepEqual(resolution.resolved, { targetRuntimeRole: 'app_read_role' });
    assert.equal(resolution.observerEqualsTarget, false);

    const observer = resolveIdentity({ facts, sessionUser: 'app_read_role', currentUser: 'app_read_role' });
    assert.equal(observer.resolved, null);
    assert.equal(observer.observerEqualsTarget, true);
    assert.equal(observer.identityDisposition, IDENTITY_DISPOSITION.AMBIGUOUS);
  });

  it('rejects a malformed catalog row instead of silently accepting it', () => {
    const catalog = buildCatalog({ roles: [{ name: 'app_read_role', oid: '100' }] });
    catalog.matrixRows.push({ oid: '100', relation_name: 'tree_likes', privilege_type: 'SELECT', allowed: true });
    assert.throws(
      () => deriveCandidateFacts({ ...catalog, candidates: catalog.candidateRows }),
      /IDENTITY_CATALOG_SHAPE_INVALID/,
    );
  });
});
