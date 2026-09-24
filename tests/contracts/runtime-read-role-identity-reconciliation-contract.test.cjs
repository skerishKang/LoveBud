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

function makeDriverError(code, message = 'synthetic driver failure', properties = {}) {
  const error = new Error(message);
  if (code !== undefined) error.code = code;
  Object.assign(error, properties);
  return error;
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
  failOnRollback = false,
  failOnEnd = false,
  rawConnectError = null,
  events = null,
} = {}) {
  const calls = events || [];
  const state = { connects: 0, ends: 0 };
  return {
    calls,
    state,
    async connect() {
      calls.push('connect');
      state.connects += 1;
      if (connectError) {
        const error = typeof connectError === 'string'
          ? Object.assign(new Error(connectError), { code: connectError })
          : connectError;
        throw error;
      }
      if (rawConnectError) {
        const error = typeof rawConnectError === 'string' ? new Error(rawConnectError) : rawConnectError;
        throw error;
      }
    },
    async end() {
      calls.push('end');
      if (failOnEnd) throw new Error('disconnect failure');
      state.ends += 1;
    },
    async query(text) {
      calls.push(text);
      if (failOn && text === failOn) throw new Error('catalog failure');
      if (failOnRollback && text === Q.ROLLBACK) throw new Error('rollback failure');
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

/**
 * One shared event sequence records every client call and the private mapping write
 * together, so a test can compare the write against the cleanup itself rather than
 * checking the client call list and the write list separately.
 */
function makeHarness(catalogOptions = {}, clientOptions = {}) {
  const events = [];
  const client = makeFakeClient(buildCatalog(catalogOptions), { ...clientOptions, events });
  const writes = [];
  const writeMapping = (repoRoot, payload) => {
    events.push('writeMapping');
    writes.push({ repoRoot, payload });
    return PRIVATE_OUTPUT_REL_PATH;
  };
  return {
    client,
    events,
    writes,
    writeCount: () => events.filter((event) => event === 'writeMapping').length,
    run: () => collectIdentityReconciliation({ client, writeMapping }),
  };
}

function collectFixture(options = {}) {
  const harness = makeHarness(options.catalog, options.client);
  return harness.run().then((result) => ({
    result,
    client: harness.client,
    writes: harness.writes,
    events: harness.events,
  }));
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
    const client = makeFakeClient(catalog, { connectError: makeDriverError('ETIMEDOUT') });
    let writes = 0;
    await assert.rejects(
      () => collectIdentityReconciliation({ client, writeMapping: () => { writes += 1; return PRIVATE_OUTPUT_REL_PATH; } }),
      /IDENTITY_CONNECT_TIMEOUT/,
    );
    assert.equal(client.state.connects, 1);
    assert.equal(writes, 0);
  });

  it('classifies a catalog query failure by stage and never surfaces the driver message', async () => {
    const catalog = buildCatalog({ roles: [{ name: 'app_read_role', oid: '100' }] });
    const client = makeFakeClient(catalog, { failOn: Q.PRIVILEGE_MATRIX });
    let writes = 0;
    const error = await collectIdentityReconciliation({
      client, writeMapping: () => { writes += 1; return PRIVATE_OUTPUT_REL_PATH; },
    }).then(() => null, (caught) => caught);
    assert.equal(error.category, 'IDENTITY_CATALOG_QUERY_FAILED');
    assert.equal(error.message, 'IDENTITY_CATALOG_QUERY_FAILED');
    assert.equal(String(error.message).includes('catalog failure'), false, 'raw driver text must not survive');
    assert.equal(error.cause, undefined, 'the original error must not be retained');
    assert.equal(client.calls.filter((call) => call === Q.ROLLBACK).length, 1);
    assert.equal(client.state.ends, 1);
    assert.equal(writes, 0);
  });
});

// ---------------------------------------------------------------------------
// Cleanup-before-private-write ordering
// ---------------------------------------------------------------------------

describe('LoveBud #4422 identity private mapping is written only after cleanup completes', () => {
  const RESOLVED = { roles: [{ name: 'app_read_role', oid: '100' }] };
  const DISQUALIFIED = { roles: [{ name: 'app_read_role', oid: '100', flags: { rolcanlogin: false } }] };
  const TWO_CANDIDATES = { roles: [{ name: 'app_read_a', oid: '100' }, { name: 'app_read_b', oid: '101' }] };

  it('pins the fixed cleanup-failure category', () => {
    assert.equal(FAILURE.IDENTITY_CLEANUP_FAILED, 'IDENTITY_CLEANUP_FAILED');
  });

  it('orders a resolved candidate as ROLLBACK, then disconnect, then exactly one write', async () => {
    const harness = makeHarness(RESOLVED);
    const result = await harness.run();
    const { events } = harness;
    const rollbackIndex = events.indexOf(Q.ROLLBACK);
    const endIndex = events.indexOf('end');
    const writeIndex = events.indexOf('writeMapping');

    assert.equal(result.identityDisposition, IDENTITY_DISPOSITION.RESOLVED);
    assert.equal(result.privateMappingWritten, 'YES');
    assert.ok(rollbackIndex > events.indexOf(Q.BROAD_SELECT_GRANTS), 'ROLLBACK must follow every catalog query');
    assert.ok(endIndex > rollbackIndex, 'disconnect must follow ROLLBACK');
    assert.ok(writeIndex > endIndex, 'the private write must follow the disconnect');
    assert.equal(events[events.length - 1], 'writeMapping', 'no client call may follow the private write');
    assert.equal(harness.writeCount(), 1);
    assert.equal(harness.writes.length, 1);
  });

  it('writes no mapping when ROLLBACK fails although the candidate resolved', async () => {
    const harness = makeHarness(RESOLVED, { failOnRollback: true });
    await assert.rejects(() => harness.run(), /IDENTITY_CLEANUP_FAILED/);
    assert.equal(harness.writeCount(), 0);
    assert.equal(harness.client.calls.filter((call) => call === Q.ROLLBACK).length, 1);
    assert.equal(harness.client.state.ends, 1, 'the disconnect is still attempted');
  });

  it('writes no mapping when the disconnect fails although the candidate resolved', async () => {
    const harness = makeHarness(RESOLVED, { failOnEnd: true });
    await assert.rejects(() => harness.run(), /IDENTITY_CLEANUP_FAILED/);
    assert.equal(harness.writeCount(), 0);
    assert.equal(harness.client.calls.filter((call) => call === Q.ROLLBACK).length, 1);
    assert.equal(harness.client.state.ends, 0);
  });

  it('writes no mapping when a catalog query fails', async () => {
    const harness = makeHarness(RESOLVED, { failOn: Q.PRIVILEGE_MATRIX });
    await assert.rejects(() => harness.run(), /IDENTITY_CATALOG_QUERY_FAILED/);
    assert.equal(harness.writeCount(), 0);
    assert.ok(harness.events.indexOf('end') > harness.events.indexOf(Q.ROLLBACK));
  });

  it('writes no mapping when connect fails', async () => {
    const harness = makeHarness(RESOLVED, { connectError: makeDriverError('ETIMEDOUT') });
    await assert.rejects(() => harness.run(), /IDENTITY_CONNECT_TIMEOUT/);
    assert.equal(harness.writeCount(), 0);
    assert.equal(harness.events.filter((event) => event === Q.ROLLBACK || event === 'end').length, 0);
  });

  it('writes no mapping on an unresolved identity', async () => {
    const harness = makeHarness(DISQUALIFIED);
    const result = await harness.run();
    assert.equal(result.identityDisposition, IDENTITY_DISPOSITION.UNRESOLVED);
    assert.equal(result.privateMappingWritten, 'NO');
    assert.equal(harness.writeCount(), 0);
  });

  it('writes no mapping on an ambiguous identity', async () => {
    const harness = makeHarness(TWO_CANDIDATES);
    const result = await harness.run();
    assert.equal(result.identityDisposition, IDENTITY_DISPOSITION.AMBIGUOUS);
    assert.equal(result.privateMappingWritten, 'NO');
    assert.equal(harness.writeCount(), 0);
  });

  it('writes no mapping when the observer is the resolved candidate', async () => {
    const harness = makeHarness(RESOLVED, { sessionUser: 'app_read_role' });
    const result = await harness.run();
    assert.equal(result.observerEqualsTarget, 'YES');
    assert.equal(result.privateMappingWritten, 'NO');
    assert.equal(harness.writeCount(), 0);
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
    const lifecycle = identity.createIdentityLifecycle();
    lifecycle.invocationStarted = true;
    lifecycle.connectionAttempted = true;
    lifecycle.connectionEstablished = true;
    lifecycle.transactionStarted = true;
    lifecycle.readOnlyVerified = true;
    const failure = identity.sanitizedFailure(FAILURE.IDENTITY_CANDIDATE_BOUND_EXCEEDED, lifecycle);
    assert.equal(failure.rawRoleExposed, 'NO');
    assert.equal(failure.rawGranteeExposed, 'NO');
    assert.equal(failure.rawSecretExposed, 'NO');
    assert.equal(failure.privateMappingWritten, 'NO');
    assert.equal(failure.errorCategory, FAILURE.IDENTITY_CANDIDATE_BOUND_EXCEEDED);
    assert.equal(failure.transactionReadOnly, 'VERIFIED');
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

// ---------------------------------------------------------------------------
// #4479 live-stage classification and connection accounting
// ---------------------------------------------------------------------------

describe('LoveBud #4479 identity live-stage classification and connection accounting', () => {
  const RESOLVED = { roles: [{ name: 'app_read_role', oid: '100' }] };
  // These harmless fragments are assembled at runtime. No real DSN or
  // credential-shaped literal is placed in the source-controlled test.
  const SYNTHETIC_DRIVER_FRAGMENT_A = 'synthetic_driver_detail_do_not_leak';
  const SYNTHETIC_HOST_FRAGMENT_A = 'synthetic-host-';
  const SYNTHETIC_HOST_FRAGMENT_B = 'do-not-leak.invalid';
  const SYNTHETIC_CREDENTIAL_MARKER = 'synthetic-credential-marker';
  const SYNTHETIC_STACK_MARKER = 'synthetic-stack-cause-marker';
  const SYNTHETIC_HOST_MARKER = `${SYNTHETIC_HOST_FRAGMENT_A}${SYNTHETIC_HOST_FRAGMENT_B}`;
  const SYNTHETIC_DRIVER_TEXT = `connect failed for ${SYNTHETIC_DRIVER_FRAGMENT_A} on ${SYNTHETIC_HOST_MARKER}`;
  const SYNTHETIC_RAW_CATEGORY = [
    'raw-category-marker',
    SYNTHETIC_DRIVER_TEXT,
    SYNTHETIC_CREDENTIAL_MARKER,
    SYNTHETIC_STACK_MARKER,
  ].join('|');

  async function attempt(clientOptions = {}) {
    const lifecycle = identity.createIdentityLifecycle();
    lifecycle.invocationStarted = true;
    const client = makeFakeClient(buildCatalog(RESOLVED), { ...clientOptions, events: [] });
    let writes = 0;
    let error = null;
    await collectIdentityReconciliation({
      client,
      lifecycle,
      writeMapping: () => { writes += 1; return PRIVATE_OUTPUT_REL_PATH; },
    }).then(() => undefined, (caught) => { error = caught; });
    return {
      lifecycle,
      client,
      error,
      writes,
      envelope: identity.sanitizedFailure(error.category, lifecycle),
    };
  }

  function assertConnectFailureLifecycle(run, expectedCategory) {
    assert.ok(run.error instanceof Error);
    assert.equal(run.error.category, expectedCategory);
    assert.equal(run.error.message, expectedCategory);
    assert.equal(run.error.code, undefined, 'raw error.code must not be retained');
    assert.equal(run.error.errno, undefined, 'raw errno must not be retained');
    assert.equal(run.error.sqlstate, undefined, 'raw SQLSTATE must not be retained');
    assert.equal(run.error.cause, undefined, 'the driver error must not be retained as cause');
    assert.equal(run.writes, 0);
    assert.equal(run.client.state.connects, 1);
    assert.equal(run.lifecycle.invocationStarted, true);
    assert.equal(run.lifecycle.connectionAttempted, true);
    assert.equal(run.lifecycle.connectionEstablished, false);
    assert.equal(run.lifecycle.transactionStarted, false);
    assert.equal(run.envelope.runnerInvocationCount, 1);
    assert.equal(run.envelope.connectionAttemptedCount, 1);
    assert.equal(run.envelope.productionConnectionCount, 0);
    assert.equal(run.envelope.collectionSessionCount, 0);
    assert.equal(run.envelope.transactionReadOnly, 'NOT_REACHED');
    assert.equal(run.envelope.privateMappingWritten, 'NO');
  }

  it('pins the fixed live-stage and connect subcategories', () => {
    assert.equal(FAILURE.IDENTITY_CONNECT_TIMEOUT, 'IDENTITY_CONNECT_TIMEOUT');
    assert.equal(FAILURE.IDENTITY_CONNECT_REFUSED, 'IDENTITY_CONNECT_REFUSED');
    assert.equal(FAILURE.IDENTITY_CONNECT_DNS, 'IDENTITY_CONNECT_DNS');
    assert.equal(FAILURE.IDENTITY_CONNECT_AUTH_REJECTED, 'IDENTITY_CONNECT_AUTH_REJECTED');
    assert.equal(FAILURE.IDENTITY_CONNECT_TLS_FAILED, 'IDENTITY_CONNECT_TLS_FAILED');
    assert.equal(FAILURE.IDENTITY_CONNECT_FAILED, 'IDENTITY_CONNECT_FAILED');
    assert.equal(FAILURE.IDENTITY_BEGIN_READ_ONLY_FAILED, 'IDENTITY_BEGIN_READ_ONLY_FAILED');
    assert.equal(FAILURE.IDENTITY_READ_ONLY_VERIFY_FAILED, 'IDENTITY_READ_ONLY_VERIFY_FAILED');
    assert.equal(FAILURE.IDENTITY_CATALOG_QUERY_FAILED, 'IDENTITY_CATALOG_QUERY_FAILED');
    assert.notEqual(FAILURE.IDENTITY_CONNECT_FAILED, FAILURE.IDENTITY_PREEXECUTION_STOP);
  });

  const CONNECT_CASES = [
    ['timeout', 'ETIMEDOUT', FAILURE.IDENTITY_CONNECT_TIMEOUT],
    ['connection refused', 'ECONNREFUSED', FAILURE.IDENTITY_CONNECT_REFUSED],
    ['DNS lookup', 'ENOTFOUND', FAILURE.IDENTITY_CONNECT_DNS],
    ['temporary DNS lookup', 'EAI_AGAIN', FAILURE.IDENTITY_CONNECT_DNS],
    ['authorization rejection', '28000', FAILURE.IDENTITY_CONNECT_AUTH_REJECTED],
    ['password rejection', '28P01', FAILURE.IDENTITY_CONNECT_AUTH_REJECTED],
    ['certificate verification', 'CERT_HAS_EXPIRED', FAILURE.IDENTITY_CONNECT_TLS_FAILED],
    ['TLS hostname verification', 'ERR_TLS_CERT_ALTNAME_INVALID', FAILURE.IDENTITY_CONNECT_TLS_FAILED],
    ['unknown code', 'EUNMAPPED_CONNECT_CODE', FAILURE.IDENTITY_CONNECT_FAILED],
    ['missing code', undefined, FAILURE.IDENTITY_CONNECT_FAILED],
  ];
  for (const [label, code, expectedCategory] of CONNECT_CASES) {
    it(`maps ${label} to ${expectedCategory} with zero established connections`, async () => {
      const run = await attempt({ connectError: makeDriverError(code) });
      assertConnectFailureLifecycle(run, expectedCategory);
    });
  }

  it('redacts raw code, driver text, host-like, credential-like, and cause/stack markers', async () => {
    const rawCause = new Error(SYNTHETIC_STACK_MARKER);
    const rawError = makeDriverError('ETIMEDOUT', SYNTHETIC_DRIVER_TEXT, {
      category: SYNTHETIC_RAW_CATEGORY,
      cause: rawCause,
      errno: -113,
      sqlstate: SYNTHETIC_STACK_MARKER,
      stack: `${SYNTHETIC_DRIVER_TEXT}\n${SYNTHETIC_STACK_MARKER}`,
    });
    const run = await attempt({ connectError: rawError });
    assertConnectFailureLifecycle(run, FAILURE.IDENTITY_CONNECT_TIMEOUT);
    const serialized = JSON.stringify(run.envelope);
    for (const marker of [
      'ETIMEDOUT',
      SYNTHETIC_DRIVER_FRAGMENT_A,
      SYNTHETIC_HOST_MARKER,
      SYNTHETIC_CREDENTIAL_MARKER,
      SYNTHETIC_STACK_MARKER,
      SYNTHETIC_DRIVER_TEXT,
      SYNTHETIC_RAW_CATEGORY,
    ]) {
      assert.equal(serialized.includes(marker), false, `${marker} must never appear in the report`);
      assert.equal(String(run.error.stack).includes(marker), false, `${marker} must not survive on the replacement error`);
    }
  });

  it('separates an established connection from a session once BEGIN fails', async () => {
    const run = await attempt({ failOn: Q.BEGIN_RO });
    assert.equal(run.error.category, 'IDENTITY_BEGIN_READ_ONLY_FAILED');
    assert.equal(run.envelope.productionConnectionCount, 1);
    assert.equal(run.envelope.collectionSessionCount, 0);
    assert.equal(run.envelope.transactionReadOnly, 'NOT_REACHED');
    assert.equal(run.writes, 0);
  });

  it('reports the transaction as FAILED when read-only verification itself fails', async () => {
    const run = await attempt({ failOn: Q.SHOW_RO });
    assert.equal(run.error.category, 'IDENTITY_READ_ONLY_VERIFY_FAILED');
    assert.equal(run.envelope.productionConnectionCount, 1);
    assert.equal(run.envelope.collectionSessionCount, 1);
    assert.equal(run.envelope.transactionReadOnly, 'FAILED');
    assert.equal(run.writes, 0);
  });

  it('reports read-only as VERIFIED once the session is live and only a catalog read fails', async () => {
    const run = await attempt({ failOn: Q.BROAD_SELECT_GRANTS });
    assert.equal(run.error.category, 'IDENTITY_CATALOG_QUERY_FAILED');
    assert.equal(run.envelope.transactionReadOnly, 'VERIFIED');
    assert.equal(run.envelope.collectionSessionCount, 1);
    assert.equal(run.client.calls.filter((call) => call === Q.ROLLBACK).length, 1);
    assert.equal(run.client.state.ends, 1);
    assert.equal(run.writes, 0);
  });

  it('never derives a connection count from the invocation count', () => {
    const untouched = identity.sanitizedFailure(FAILURE.IDENTITY_INPUT_INVALID, identity.createIdentityLifecycle());
    assert.equal(untouched.runnerInvocationCount, 0);
    assert.equal(untouched.connectionAttemptedCount, 0);
    assert.equal(untouched.productionConnectionCount, 0);
    assert.equal(untouched.collectionSessionCount, 0);
    assert.equal(untouched.transactionReadOnly, 'NOT_REACHED');
    assert.equal(untouched.privateMappingWritten, 'NO');
  });
});
