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
  assertTargetRuntimeRole,
  TARGET_RELATION_NAMES,
  buildRoleMappingRelation,
  classifySelectGrantSources,
  deriveDecision,
  collectAttestation,
  loadTargetRoleMapping,
  runAttestationWithDeps,
  sanitizedFailure,
} = require('../../scripts/run-production-readonly-runtime-role-acl-attestation.cjs');
const boundary = require('../../scripts/production-readonly-catalog-boundary-core.cjs');

const RAW_OBSERVER = 'fixture_observer_must_never_escape';
const RAW_TARGET = 'fixture_target_must_never_escape';
const RAW_GRANTEE = 'fixture_grantee_must_never_escape';
const RAW_SECRET = 'fixture-secret-must-never-escape';
const TARGET_MAPPING = { [RAW_TARGET]: 'APPLICATION' };

function baseIdentity(overrides = {}) {
  return {
    current_user: RAW_OBSERVER,
    session_user: RAW_OBSERVER,
    current_role: RAW_OBSERVER,
    current_database: 'neondb',
    ...overrides,
  };
}

function aclRowsFor(sources = {}, relaclNullRelations = new Set()) {
  return TARGET_RELATION_NAMES.flatMap((relationName) => {
    const entries = sources[relationName] || [{ grantee_name: 'PUBLIC', grantee_oid: 0 }];
    return entries.map((entry) => ({
      relation_name: relationName,
      relacl_was_null: relaclNullRelations.has(relationName),
      owner_oid: entry.owner_oid ?? 999,
      owner_name: entry.owner_name ?? 'fixture_owner',
      grantee_oid: entry.grantee_oid,
      grantee_name: entry.grantee_name,
      privilege_type: entry.privilege_type || 'SELECT',
      is_grantable: entry.is_grantable ?? false,
    }));
  });
}

function fakeClient({
  readOnly = true,
  identity = baseIdentity(),
  targetRole = RAW_TARGET,
  chain,
  flags,
  privileges,
  aclRows = aclRowsFor(),
  broadAclRows,
} = {}) {
  const calls = [];
  let connectCount = 0;
  let endCount = 0;
  const roleChain = (chain || [{ role_name: targetRole, depth: 0, admin_option: false }]).map((row, index) => ({
    ...row,
    oid: row.oid ?? (row.role_name === targetRole ? 100 : 101 + index),
  }));
  const roleFlags = flags || [{
    role_name: targetRole,
    rolsuper: false,
    rolcreatedb: false,
    rolcreaterole: false,
    rolbypassrls: false,
    rolreplication: false,
  }];
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
  const defaultBroadAclRows = aclRows.filter((row) => row.privilege_type === 'SELECT' &&
    (row.grantee_name === 'PUBLIC' || roleChain.some((role) => role.oid === row.grantee_oid)));
  const client = {
    async connect() { connectCount += 1; },
    async end() { endCount += 1; },
    async query(text, params) {
      calls.push({ text, params });
      if (text === Q.BEGIN_RO || text === Q.ROLLBACK) return { rows: [] };
      if (text === Q.SHOW_RO) return { rows: [{ transaction_read_only: readOnly ? 'on' : 'off' }] };
      if (text === Q.IDENTITY) return { rows: [identity] };
      if (text === Q.ROLE_CHAIN) return { rows: roleChain };
      if (text === Q.ROLE_FLAGS) return { rows: roleFlags };
      if (text === Q.RELATION_ACL) return { rows: aclRows };
      if (text === Q.BROAD_SELECT_ACL) return { rows: broadAclRows || defaultBroadAclRows };
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
  const targetRole = options.targetRole || RAW_TARGET;
  const fixture = fakeClient({ ...options, targetRole });
  const result = await collectAttestation({
    client: fixture.client,
    targetRuntimeRole: targetRole,
    roleMapping: options.roleMapping || { [targetRole]: 'APPLICATION' },
    artifact: options.artifact || { unmapped_grantees: [RAW_GRANTEE, 'historical_role'] },
  });
  return { result, fixture };
}

function writePrivateMapping(file, value) {
  fs.writeFileSync(file, JSON.stringify(value), { mode: 0o600 });
}

describe('LoveBud #4283 target-role runtime ACL attestation contract', () => {
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
      ['--role', RAW_TARGET],
      ['--objects', 'public.reactions'],
      ['--repeat', '2'],
      ['--output', 'result.json'],
    ]) assert.throws(() => parseArgs(args), /ATTESTATION_INPUT_INVALID/);
  });

  it('requires a strict explicit target-role mapping and rejects absent/ambiguous input', () => {
    assert.throws(() => loadTargetRoleMapping(process.cwd()), /ATTESTATION_TARGET_ROLE_MAPPING_INVALID/);
    const file = path.join(process.cwd(), '.secrets', '.test-4283-target-role.json');
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      writePrivateMapping(file, { role_mapping: { [RAW_TARGET]: 'APPLICATION' } });
      assert.throws(() => loadTargetRoleMapping(process.cwd(), '.secrets/.test-4283-target-role.json'), /ATTESTATION_TARGET_ROLE_MAPPING_AMBIGUOUS/);
      writePrivateMapping(file, { target_runtime_role: RAW_TARGET, role_mapping: { [RAW_TARGET]: 'APPLICATION', other: 'SERVICE' } });
      assert.throws(() => loadTargetRoleMapping(process.cwd(), '.secrets/.test-4283-target-role.json'), /ATTESTATION_TARGET_ROLE_MAPPING_AMBIGUOUS/);
      writePrivateMapping(file, { target_runtime_role: RAW_TARGET, role_mapping: { [RAW_TARGET]: 'APPLICATION' } });
      const loaded = loadTargetRoleMapping(process.cwd(), '.secrets/.test-4283-target-role.json');
      assert.equal(loaded.targetRuntimeRole, RAW_TARGET);
    } finally {
      try { fs.unlinkSync(file); } catch {}
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

  it('fails closed on invalid target syntax and missing private inputs before collection', () => {
    assert.throws(() => assertTargetRuntimeRole(''), /ATTESTATION_TARGET_ROLE_INVALID/);
    assert.throws(() => assertTargetRuntimeRole('role-with-dash'), /ATTESTATION_TARGET_ROLE_INVALID/);
    assert.throws(() => boundary.loadDedicatedProductionReadonlyDatabaseUrl(process.cwd(), '.secrets/missing-4283.env'), /PRODUCTION_CATALOG_SECRET_FILE_INVALID|PRODUCTION_CATALOG_SECRET_REQUIRED/);
    assert.throws(() => boundary.loadProductionRoleMapping(process.cwd(), '.secrets/missing-4283-role-map.json'), /PRODUCTION_CATALOG_(ROLE_MAPPING_INVALID|ROLE_MAPPING_REQUIRED|SECRET_FILE_INVALID)/);
  });

  it('fails closed when the target role is unknown and still rolls back/disconnects', async () => {
    const fixture = fakeClient({ flags: [{ role_name: 'different_role', rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false, rolreplication: false }] });
    await assert.rejects(
      collectAttestation({ client: fixture.client, targetRuntimeRole: RAW_TARGET, roleMapping: TARGET_MAPPING }),
      { category: 'ATTESTATION_TARGET_ROLE_UNRESOLVED' },
    );
    assert.equal(fixture.counts().connectCount, 1);
    assert.equal(fixture.counts().endCount, 1);
    assert.equal(fixture.calls.filter((call) => call.text === Q.ROLLBACK).length, 1);
  });

  it('fails closed when transaction_read_only is not on', async () => {
    const fixture = fakeClient({ readOnly: false });
    await assert.rejects(collectAttestation({ client: fixture.client, targetRuntimeRole: RAW_TARGET, roleMapping: TARGET_MAPPING }), { category: 'ATTESTATION_READ_ONLY_REQUIRED' });
    assert.equal(fixture.counts().connectCount, 1);
    assert.equal(fixture.counts().endCount, 1);
  });

  it('queries privileges for target B, not observer A, and reports the roles separately', async () => {
    const { result, fixture } = await collectFixture({
      privileges: { SELECT_TREES: false, SELECT_MEMORIES: false, SELECT_TREE_SOCIAL_COUNTS: false, SELECT_REACTIONS: false },
    });
    assert.equal(result.sessionEqualsTarget, 'NO');
    assert.equal(result.targetRoleSpecificChecks, 'VERIFIED');
    const privilegeCalls = fixture.calls.filter((call) => [Q.DATABASE_CONNECT, Q.PUBLIC_USAGE, Q.TREES_SELECT, Q.MEMORIES_SELECT, Q.SOCIAL_COUNTS_SELECT, Q.REACTIONS_SELECT].includes(call.text));
    assert.ok(privilegeCalls.length >= 6);
    assert.ok(privilegeCalls.every((call) => call.params[0] === RAW_TARGET));
    assert.notEqual(result.decision.target, 'RESOLVED');
  });

  it('observer A SELECT does not contaminate target B = NO', async () => {
    const { result } = await collectFixture({ privileges: { SELECT_REACTIONS: false } });
    assert.equal(result.privileges.SELECT_REACTIONS, false);
    assert.equal(result.decision.target, 'RESOLVED');
  });

  it('observer A lacks SELECT while target B has SELECT -> target B = YES', async () => {
    const { result } = await collectFixture({ privileges: { SELECT_REACTIONS: true } });
    assert.equal(result.privileges.SELECT_REACTIONS, true);
    assert.equal(result.decision.target, 'RESOLVED');
    assert.equal(result.decision.minimalChange, 'NO_PRIVILEGE_CHANGE');
  });

  it('permits explicit session role == target role without treating it as implicit target selection', async () => {
    const { result } = await collectFixture({ identity: baseIdentity({ current_user: RAW_TARGET, session_user: RAW_TARGET, current_role: RAW_TARGET }) });
    assert.equal(result.sessionEqualsTarget, 'YES');
    assert.equal(result.targetRoleSpecificChecks, 'VERIFIED');
  });

  it('reports target SUPERUSER and ADMIN OPTION as unsafe, without normalization', async () => {
    const superuser = await collectFixture({ flags: [{ role_name: RAW_TARGET, rolsuper: true, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false, rolreplication: false }] });
    assert.equal(superuser.result.targetRoleSuperuser, 'YES');
    assert.equal(superuser.result.roleAdmin, 'YES');
    assert.equal(superuser.result.decision.canProceed, 'NO');
    const adminOption = await collectFixture({ chain: [{ role_name: RAW_TARGET, depth: 0, admin_option: true }] });
    assert.equal(adminOption.result.targetRoleAdminOption, 'YES');
    assert.equal(adminOption.result.roleAdmin, 'YES');
    assert.equal(adminOption.result.decision.canProceed, 'NO');
  });

  it('classifies direct, inherited, PUBLIC, and mixed provenance per relation', () => {
    const rows = aclRowsFor({
      trees: [{ grantee_name: RAW_TARGET, grantee_oid: 100 }],
      memories: [{ grantee_name: 'parent_role', grantee_oid: 101 }],
      tree_social_counts: [{ grantee_name: 'PUBLIC', grantee_oid: 0 }],
      reactions: [
        { grantee_name: RAW_TARGET, grantee_oid: 100 },
        { grantee_name: 'parent_role', grantee_oid: 101 },
      ],
    });
    const result = classifySelectGrantSources({
      targetRuntimeRole: RAW_TARGET,
      chainNames: [RAW_TARGET, 'parent_role'],
      rows,
    });
    assert.equal(result.relations.trees.directTargetGrant, 'YES');
    assert.equal(result.relations.trees.inheritedGrant, 'NO');
    assert.equal(result.relations.memories.directTargetGrant, 'NO');
    assert.equal(result.relations.memories.inheritedGrant, 'YES');
    assert.equal(result.relations.tree_social_counts.publicGrant, 'YES');
    assert.equal(result.relations.reactions.directTargetGrant, 'YES');
    assert.equal(result.relations.reactions.inheritedGrant, 'YES');
    assert.equal(result.direct, 'MIXED');
    assert.equal(result.inherited, 'MIXED');
  });

  it('observer A is unrelated and cannot contaminate direct target B provenance', async () => {
    const { result } = await collectFixture({
      aclRows: aclRowsFor({
        reactions: [{ grantee_name: RAW_TARGET, grantee_oid: 100 }],
      }),
      privileges: { SELECT_REACTIONS: true },
    });
    assert.equal(result.perRelationProvenance.reactions.directTargetGrant, 'YES');
    assert.equal(result.perRelationProvenance.reactions.inheritedGrant, 'NO');
    assert.equal(result.perRelationProvenance.reactions.effectiveSelect, 'YES');
  });

  it('observer A is unrelated and target B inherited parent C provenance remains inherited', async () => {
    const { result } = await collectFixture({
      chain: [
        { role_name: RAW_TARGET, depth: 0, admin_option: false, oid: 100 },
        { role_name: 'parent_role', depth: 1, admin_option: false, oid: 101 },
      ],
      aclRows: aclRowsFor({
        reactions: [{ grantee_name: 'parent_role', grantee_oid: 101 }],
      }),
      privileges: { SELECT_REACTIONS: true },
    });
    assert.equal(result.perRelationProvenance.reactions.directTargetGrant, 'NO');
    assert.equal(result.perRelationProvenance.reactions.inheritedGrant, 'YES');
    assert.equal(result.perRelationProvenance.reactions.effectiveSelect, 'YES');
  });

  it('PUBLIC source and effective privilege remain distinct from direct provenance', async () => {
    const { result } = await collectFixture({
      aclRows: aclRowsFor({ reactions: [{ grantee_name: 'PUBLIC', grantee_oid: 0 }] }),
      privileges: { SELECT_REACTIONS: true },
    });
    assert.equal(result.perRelationProvenance.reactions.publicGrant, 'YES');
    assert.equal(result.perRelationProvenance.reactions.directTargetGrant, 'NO');
    assert.equal(result.perRelationProvenance.reactions.effectiveSelect, 'YES');
  });

  it('owner-derived SELECT is not reported as a direct target grant', () => {
    const result = classifySelectGrantSources({
      targetRuntimeRole: RAW_TARGET,
      chainNames: [RAW_TARGET],
      rows: aclRowsFor({
        reactions: [{ grantee_name: RAW_TARGET, grantee_oid: 100, owner_oid: 100 }],
      }),
    });
    assert.equal(result.relations.reactions.ownerSelect, 'YES');
    assert.equal(result.relations.reactions.directTargetGrant, 'NO');
  });

  it('relacl NULL/default ACL rows are classified without information_schema', () => {
    const rows = aclRowsFor(
      { reactions: [{ grantee_name: RAW_TARGET, grantee_oid: 100 }] },
      new Set(TARGET_RELATION_NAMES),
    );
    const result = classifySelectGrantSources({
      targetRuntimeRole: RAW_TARGET,
      chainNames: [RAW_TARGET],
      rows,
    });
    assert.equal(result.relations.reactions.relaclWasNull, 'YES');
    assert.equal(result.relations.reactions.directTargetGrant, 'YES');
  });

  it('rejects incomplete or malformed catalog ACL rows closed', () => {
    assert.throws(() => classifySelectGrantSources({
      targetRuntimeRole: RAW_TARGET,
      chainNames: [RAW_TARGET],
      rows: aclRowsFor().slice(1),
    }), /ATTESTATION_ACL_RELATION_MISSING/);
    assert.throws(() => classifySelectGrantSources({
      targetRuntimeRole: RAW_TARGET,
      chainNames: [RAW_TARGET],
      rows: aclRowsFor({ reactions: [{ grantee_name: RAW_TARGET, grantee_oid: 0 }] }),
    }), /ATTESTATION_ACL_SHAPE_INVALID/);
  });

  it('observer A SELECT does not contaminate target B effective NO or provenance', async () => {
    const { result } = await collectFixture({
      aclRows: aclRowsFor({
        reactions: [{ grantee_name: RAW_OBSERVER, grantee_oid: 200 }],
      }),
      privileges: { SELECT_REACTIONS: false },
    });
    assert.equal(result.privileges.SELECT_REACTIONS, false);
    assert.equal(result.perRelationProvenance.reactions.effectiveSelect, 'NO');
    assert.equal(result.perRelationProvenance.reactions.publicGrant, 'NO');
    assert.equal(result.perRelationProvenance.reactions.directTargetGrant, 'NO');
    assert.equal(result.perRelationProvenance.reactions.inheritedGrant, 'NO');
  });

  it('broad catalog SELECT detection stays separate from per-relation source provenance', async () => {
    const broad = await collectFixture({
      broadAclRows: [{ relation_name: 'unrelated_table', grantee_oid: 100, grantee_name: RAW_TARGET, privilege_type: 'SELECT' }],
    });
    assert.equal(broad.result.broadAllTableSelect, 'YES');
    assert.equal(broad.result.decision.canProceed, 'NO');
    const writable = await collectFixture({ privileges: { INSERT_REACTIONS: true } });
    assert.equal(writable.result.privileges.DELETE_REACTIONS, false);
    assert.equal(writable.result.decision.canProceed, 'NO');
  });

  it('uses only fixed catalog queries and never a Product row query', async () => {
    const { fixture } = await collectFixture();
    const fixed = new Set(Object.values(Q));
    assert.ok(fixture.calls.every((call) => fixed.has(call.text)));
    assert.ok(fixture.calls.every((call) => !/SELECT\s+\*|FROM\s+public\.(trees|memories|tree_social_counts|reactions)\b/i.test(call.text)));
  });

  it('retains one read-only session, rollback, disconnect, and no retry', async () => {
    const { result, fixture } = await collectFixture();
    assert.equal(result.transactionReadOnly, 'VERIFIED');
    assert.equal(fixture.counts().connectCount, 1);
    assert.equal(fixture.counts().endCount, 1);
    assert.equal(fixture.calls.filter((call) => call.text === Q.BEGIN_RO).length, 1);
    assert.equal(fixture.calls.filter((call) => call.text === Q.ROLLBACK).length, 1);
  });

  it('redacts raw observer, target, grantee, and secret values from outputs', async () => {
    const { result } = await collectFixture();
    const successText = JSON.stringify(result);
    assert.equal(successText.includes(RAW_OBSERVER), false);
    assert.equal(successText.includes(RAW_TARGET), false);
    assert.equal(successText.includes(RAW_GRANTEE), false);
    assert.equal(successText.includes(RAW_SECRET), false);
    assert.equal(successText.includes('ownerOid'), false);
    const failureText = JSON.stringify(sanitizedFailure('ATTESTATION_PREEXECUTION_STOP'));
    assert.equal(failureText.includes(RAW_TARGET), false);
  });

  it('returns unresolved and no decision when the target relation is ambiguous', () => {
    assert.throws(() => buildRoleMappingRelation({
      targetRuntimeRole: RAW_TARGET,
      identity: baseIdentity(),
      chain: [{ role_name: 'other_role' }],
      roleMapping: TARGET_MAPPING,
    }), /ATTESTATION_TARGET_ROLE_UNRESOLVED/);
    const drift = deriveDecision({ identityResolved: true, roleAdmin: false, broadAllTableSelect: false, privileges: { DATABASE_CONNECT: true, USAGE_PUBLIC: true, SELECT_TREES: false, SELECT_MEMORIES: true, SELECT_TREE_SOCIAL_COUNTS: true } });
    assert.equal(drift.finalDisposition, 'BASELINE_PRIVILEGE_DRIFT_STOP');
  });
});
