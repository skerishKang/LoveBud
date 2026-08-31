'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {
  APPROVAL_REFERENCE,
  SOURCE_BOUND_PURPOSE,
  Q,
  parseArgs,
  assertSourceBoundApproval,
  buildRoleMappingRelation,
  deriveDecision,
  collectAttestation,
  runAttestationWithDeps,
  sanitizedFailure,
} = require('../../scripts/run-production-readonly-runtime-role-acl-attestation.cjs');
const boundary = require('../../scripts/production-readonly-catalog-boundary-core.cjs');

const RAW_ROLE = 'fixture_role_must_never_escape';
const RAW_GRANTEE = 'fixture_grantee_must_never_escape';
const RAW_SECRET = 'fixture-secret-must-never-escape';
const MAPPING = { [RAW_ROLE]: 'APPLICATION', mapped_writer: 'APPLICATION', public: 'PUBLIC' };

function baseIdentity(overrides = {}) {
  return {
    current_user: RAW_ROLE,
    session_user: RAW_ROLE,
    current_role: RAW_ROLE,
    current_database: 'neondb',
    ...overrides,
  };
}

function fakeClient({ readOnly = true, identity = baseIdentity(), chain, flags, privileges, broadRows = [] } = {}) {
  const calls = [];
  let connectCount = 0;
  let endCount = 0;
  const roleChain = chain || [{ role_name: RAW_ROLE, depth: 0, admin_option: false }];
  const roleFlags = flags || [{ role_name: RAW_ROLE, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false, rolreplication: false }];
  const p = {
    DATABASE_CONNECT: true,
    USAGE_PUBLIC: true,
    SELECT_TREES: true,
    SELECT_MEMORIES: true,
    SELECT_TREE_SOCIAL_COUNTS: true,
    SELECT_REACTIONS: false,
    INSERT_REACTIONS: false,
    UPDATE_REACTIONS: false,
    DELETE_REACTIONS: false,
    ...privileges,
  };
  const bool = (key) => [{ allowed: p[key] }];
  const client = {
    async connect() { connectCount += 1; },
    async end() { endCount += 1; },
    async query(text) {
      calls.push(text);
      if (text === Q.BEGIN_RO || text === Q.ROLLBACK) return { rows: [] };
      if (text === Q.SHOW_RO) return { rows: [{ transaction_read_only: readOnly ? 'on' : 'off' }] };
      if (text === Q.IDENTITY) return { rows: [identity] };
      if (text === Q.ROLE_CHAIN) return { rows: roleChain };
      if (text === Q.ROLE_FLAGS) return { rows: roleFlags };
      if (text === Q.PUBLIC_SELECT_GRANTS) return { rows: broadRows };
      if (text === Q.DATABASE_CONNECT) return { rows: bool('DATABASE_CONNECT') };
      if (text === Q.PUBLIC_USAGE) return { rows: bool('USAGE_PUBLIC') };
      if (text === Q.TREES_SELECT) return { rows: bool('SELECT_TREES') };
      if (text === Q.MEMORIES_SELECT) return { rows: bool('SELECT_MEMORIES') };
      if (text === Q.SOCIAL_COUNTS_SELECT) return { rows: bool('SELECT_TREE_SOCIAL_COUNTS') };
      if (text === Q.REACTIONS_SELECT) return { rows: bool('SELECT_REACTIONS') };
      if (text === Q.REACTIONS_INSERT) return { rows: bool('INSERT_REACTIONS') };
      if (text === Q.REACTIONS_UPDATE) return { rows: bool('UPDATE_REACTIONS') };
      if (text === Q.REACTIONS_DELETE) return { rows: bool('DELETE_REACTIONS') };
      throw new Error('unexpected fixture query');
    },
  };
  return { client, calls, counts: () => ({ connectCount, endCount }) };
}

async function collectFixture(options = {}) {
  const fixture = fakeClient(options);
  const result = await collectAttestation({
    client: fixture.client,
    credentialUsername: options.credentialUsername || RAW_ROLE,
    roleMapping: options.roleMapping || MAPPING,
    artifact: options.artifact || { unmapped_grantees: [RAW_GRANTEE, 'historical_role'] },
  });
  return { result, fixture };
}

describe('LoveBud #4283 runtime-read role ACL attestation contract', () => {
  it('binds the exact issue and purpose before private input access', async () => {
    let loaded = false;
    await assert.rejects(
      runAttestationWithDeps({
        approvalReference: 'issue:4295',
        purpose: SOURCE_BOUND_PURPOSE,
        baselineCommit: 'a'.repeat(40),
        currentHead: 'a'.repeat(40),
        loadPrivateInputs: async () => { loaded = true; },
        collect: async () => ({}),
      }),
      { category: 'ATTESTATION_SOURCE_BOUND_APPROVAL_REQUIRED' },
    );
    assert.equal(loaded, false);
    assert.throws(() => assertSourceBoundApproval(APPROVAL_REFERENCE, 'wrong-purpose'), /ATTESTATION_SOURCE_BOUND_APPROVAL_REQUIRED/);
  });

  it('rejects arbitrary SQL, roles, objects, repeat, and output flags', () => {
    for (const args of [
      ['--approval-reference', APPROVAL_REFERENCE, '--purpose', SOURCE_BOUND_PURPOSE, '--sql', 'SELECT 1'],
      ['--role', RAW_ROLE],
      ['--objects', 'public.reactions'],
      ['--repeat', '2'],
      ['--output', 'result.json'],
    ]) {
      assert.throws(() => parseArgs(args), /ATTESTATION_INPUT_INVALID/);
    }
  });

  it('delegates private input path safety to the .secrets boundary', () => {
    assert.throws(() => boundary.resolveSecretsRelativeFile(process.cwd(), '../outside.env'));
    assert.throws(() => boundary.resolveSecretsRelativeFile(process.cwd(), '.secrets/../outside.env'));
    const temp = path.join(process.cwd(), '.secrets', '.test-4283-symlink');
    try {
      fs.mkdirSync(path.dirname(temp), { recursive: true });
      fs.writeFileSync(temp + '-target', RAW_SECRET, { mode: 0o600 });
      fs.symlinkSync(temp + '-target', temp);
      assert.throws(() => boundary.resolveSecretsRelativeFile(process.cwd(), '.secrets/.test-4283-symlink'));
    } finally {
      for (const file of [temp, temp + '-target']) {
        try { fs.unlinkSync(file); } catch {}
      }
    }
  });

  it('fails closed on missing private inputs before any collection', () => {
    assert.throws(
      () => boundary.loadDedicatedProductionReadonlyDatabaseUrl(process.cwd(), '.secrets/missing-4283.env'),
      /PRODUCTION_CATALOG_SECRET_FILE_INVALID|PRODUCTION_CATALOG_SECRET_REQUIRED/,
    );
    assert.throws(
      () => boundary.loadProductionRoleMapping(process.cwd(), '.secrets/missing-4283-role-map.json'),
      /PRODUCTION_CATALOG_(ROLE_MAPPING_INVALID|ROLE_MAPPING_REQUIRED|SECRET_FILE_INVALID)/,
    );
  });

  it('fails closed when transaction_read_only is not on and still disconnects', async () => {
    const { fixture } = await assert.rejects(
      collectFixture({ readOnly: false }),
      { category: 'ATTESTATION_READ_ONLY_REQUIRED' },
    ).then(() => ({ fixture: null }));
    assert.equal(fixture, null);
  });

  it('uses only fixed catalog queries and never a Product row query', async () => {
    const { result, fixture } = await collectFixture();
    const fixed = new Set(Object.values(Q));
    assert.ok(fixture.calls.every((query) => fixed.has(query)));
    assert.ok(fixture.calls.every((query) => !/SELECT\s+\*|FROM\s+public\.(trees|memories|tree_social_counts|reactions)\b/i.test(query)));
    assert.equal(fixture.counts().connectCount, 1);
    assert.equal(fixture.counts().endCount, 1);
    assert.equal(result.rawRoleExposed, 'NO');
  });

  it('classifies direct, inherited, SET ROLE, and unresolved identity relationships', () => {
    const direct = buildRoleMappingRelation({ credentialUsername: RAW_ROLE, identity: baseIdentity(), chain: [{ role_name: RAW_ROLE }], mapping: MAPPING });
    assert.equal(direct.credentialRoleMatch, 'DIRECT_EFFECTIVE_ROLE');

    const inherited = buildRoleMappingRelation({
      credentialUsername: RAW_ROLE,
      identity: baseIdentity({ current_user: RAW_ROLE, current_role: RAW_ROLE }),
      chain: [{ role_name: RAW_ROLE }, { role_name: 'parent_role' }],
      mapping: MAPPING,
    });
    assert.equal(inherited.credentialRoleMatch, 'INHERITED_EFFECTIVE_ROLE');

    const setRole = buildRoleMappingRelation({
      credentialUsername: RAW_ROLE,
      identity: baseIdentity({ session_user: RAW_ROLE, current_user: 'parent_role', current_role: 'parent_role' }),
      chain: [{ role_name: RAW_ROLE }, { role_name: 'parent_role' }],
      mapping: MAPPING,
    });
    assert.equal(setRole.credentialRoleMatch, 'SET_ROLE_EFFECTIVE_ROLE');

    const unresolved = buildRoleMappingRelation({
      credentialUsername: RAW_ROLE,
      identity: baseIdentity({ session_user: 'other_role', current_user: 'other_role', current_role: 'other_role' }),
      chain: [{ role_name: RAW_ROLE }],
      mapping: MAPPING,
    });
    assert.equal(unresolved.credentialRoleMatch, 'UNRESOLVED');
  });

  it('classifies current and stale historical artifact relationships without exposing names', () => {
    const current = buildRoleMappingRelation({ credentialUsername: RAW_ROLE, identity: baseIdentity(), chain: [{ role_name: RAW_ROLE }], mapping: MAPPING, artifact: { unmapped_grantees: [RAW_ROLE, RAW_GRANTEE] } });
    assert.equal(current.historicalRelation, 'CURRENT_EFFECTIVE_ROLE');
    const stale = buildRoleMappingRelation({ credentialUsername: RAW_ROLE, identity: baseIdentity(), chain: [{ role_name: RAW_ROLE }], mapping: MAPPING, artifact: { unmapped_grantees: [RAW_GRANTEE, 'old_role'] } });
    assert.equal(stale.historicalRelation, 'STALE_NONCURRENT_ROLE');
  });

  it('derives the minimal reactions-only decision when the baseline is intact', () => {
    const decision = deriveDecision({ identityResolved: true, roleAdmin: false, broadAllTableSelect: false, privileges: {
      SELECT_TREES: true, SELECT_MEMORIES: true, SELECT_TREE_SOCIAL_COUNTS: true, SELECT_REACTIONS: false,
      INSERT_REACTIONS: false, UPDATE_REACTIONS: false, DELETE_REACTIONS: false,
    } });
    assert.deepEqual(decision, { target: 'RESOLVED', minimalChange: 'SELECT_ON_REACTIONS_ONLY', canProceed: 'YES', finalDisposition: 'RUNTIME_READ_ROLE_ACL_ATTESTED' });
  });

  it('detects already-present reactions SELECT and disallowed write privilege', async () => {
    const present = await collectFixture({ privileges: { SELECT_REACTIONS: true } });
    assert.equal(present.result.decision.minimalChange, 'NO_PRIVILEGE_CHANGE');
    assert.equal(present.result.decision.canProceed, 'YES');

    const writable = await collectFixture({ privileges: { INSERT_REACTIONS: true } });
    assert.equal(writable.result.decision.canProceed, 'NO');
    assert.equal(writable.result.decision.finalDisposition, 'BASELINE_PRIVILEGE_DRIFT_STOP');
  });

  it('detects broad SELECT and role-admin capability as a stop', async () => {
    const broad = await collectFixture({ broadRows: [{ table_name: 'unrelated_table', grantee: RAW_ROLE, privilege_type: 'SELECT' }] });
    assert.equal(broad.result.broadAllTableSelect, 'YES');
    assert.equal(broad.result.decision.canProceed, 'NO');

    const admin = await collectFixture({ flags: [{ role_name: RAW_ROLE, rolsuper: false, rolcreatedb: false, rolcreaterole: true, rolbypassrls: false, rolreplication: false }] });
    assert.equal(admin.result.roleAdmin, 'YES');
    assert.equal(admin.result.decision.canProceed, 'NO');

    const membershipAdmin = await collectFixture({ chain: [{ role_name: RAW_ROLE, depth: 0, admin_option: true }] });
    assert.equal(membershipAdmin.result.roleAdmin, 'YES');
    assert.equal(membershipAdmin.result.decision.canProceed, 'NO');
  });

  it('redacts raw role, grantee, and secret values from success and failure results', async () => {
    const { result } = await collectFixture();
    const successText = JSON.stringify(result);
    assert.equal(successText.includes(RAW_ROLE), false);
    assert.equal(successText.includes(RAW_GRANTEE), false);
    assert.equal(successText.includes(RAW_SECRET), false);
    const failureText = JSON.stringify(sanitizedFailure('ATTESTATION_PREEXECUTION_STOP'));
    assert.equal(failureText.includes(RAW_ROLE), false);
    assert.equal(failureText.includes(RAW_GRANTEE), false);
    assert.equal(failureText.includes(RAW_SECRET), false);
  });

  it('uses one session, rollback, disconnect, and no retry', async () => {
    const { result, fixture } = await collectFixture();
    assert.equal(result.currentRuntimeReadRoleIdentity, 'CONFIRMED');
    assert.equal(fixture.counts().connectCount, 1);
    assert.equal(fixture.counts().endCount, 1);
    assert.equal(fixture.calls.filter((query) => query === Q.BEGIN_RO).length, 1);
    assert.equal(fixture.calls.filter((query) => query === Q.ROLLBACK).length, 1);
  });

  it('returns unresolved and no decision when identity or baseline is ambiguous', () => {
    const unresolved = deriveDecision({ identityResolved: false, roleAdmin: false, broadAllTableSelect: false, privileges: {} });
    assert.equal(unresolved.target, 'UNRESOLVED');
    assert.equal(unresolved.canProceed, 'NO');
    assert.equal(unresolved.finalDisposition, 'RUNTIME_ROLE_IDENTITY_UNRESOLVED');

    const drift = deriveDecision({ identityResolved: true, roleAdmin: false, broadAllTableSelect: false, privileges: { SELECT_TREES: false, SELECT_MEMORIES: true, SELECT_TREE_SOCIAL_COUNTS: true } });
    assert.equal(drift.finalDisposition, 'BASELINE_PRIVILEGE_DRIFT_STOP');
  });
});
