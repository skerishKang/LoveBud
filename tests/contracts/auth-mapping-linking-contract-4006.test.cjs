'use strict';

// Issue #4006 - Auth three-layer account mapping contract (prototype core).
// Evidence layer: EXECUTED_FAKE.
//
// Executes a pure in-memory state machine mirroring the proposed
// app_account / app_auth_identity / auth_audit_log constraints and proves the
// mapping contract rules R1-R4 documented in
// docs/architecture/AUTH_THREE_LAYER_MAPPING_CONTRACT_4006.md:
// verification-before-mapping, deny-by-default resolution, email never a key,
// idempotency, takeover prevention, one-active-identity-per-provider,
// Neon-only HOLD, audit exactly-once with privacy screening, and the operator
// recovery path. No network, no database engine, no provider, no Production.
//
// Refs #4006.
// Refs #4004 - Keep OPEN.
// Refs #4157.
// Refs #1882 - Keep OPEN.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const CONTRACT_DOC_REL = 'docs/architecture/AUTH_THREE_LAYER_MAPPING_CONTRACT_4006.md';

function makeErr(code, message) {
  const err = new Error(code + ': ' + message);
  err.code = code;
  return err;
}

function createAuthAccountMappingCore() {
  const ERR = Object.freeze({
    INVALID_INPUT: 'INVALID_INPUT',
    LINK_REQUIRES_VERIFIED_IDENTITY: 'LINK_REQUIRES_VERIFIED_IDENTITY',
    IDENTITY_ALREADY_BOUND: 'IDENTITY_ALREADY_BOUND',
    ONE_ACTIVE_IDENTITY_PER_PROVIDER_PER_ACCOUNT: 'ONE_ACTIVE_IDENTITY_PER_PROVIDER_PER_ACCOUNT',
    ACCOUNT_NOT_ELIGIBLE: 'ACCOUNT_NOT_ELIGIBLE',
    LEGACY_OWNER_ALREADY_BOUND: 'LEGACY_OWNER_ALREADY_BOUND',
    IDENTITY_UNKNOWN: 'IDENTITY_UNKNOWN',
    AUDIT_PRIVACY_VIOLATION: 'AUDIT_PRIVACY_VIOLATION',
    RECOVERY_NOT_AUTHORIZED: 'RECOVERY_NOT_AUTHORIZED',
    OPERATOR_ACTION_REQUIRED: 'OPERATOR_ACTION_REQUIRED'
  });
  const PROVIDERS = Object.freeze(['firebase', 'neon']);
  const AUDIT_ACTIONS = Object.freeze([
    'link_created',
    'link_revoked',
    'account_disabled',
    'account_merged',
    'recovery_used'
  ]);

  let clock = 0;
  const accounts = new Map();
  const identities = new Map();
  const legacyOwners = new Map();
  const auditLog = [];

  function ok(extra) {
    return Object.freeze(Object.assign({ ok: true }, extra || {}));
  }
  function deny(reason) {
    return Object.freeze({ decision: 'DENY', reason });
  }

  function pushAudit(action, actorClass, accountId, identityProvider) {
    if (!AUDIT_ACTIONS.includes(action)) throw makeErr(ERR.INVALID_INPUT, 'unknown audit action');
    if (!['system', 'operator', 'user'].includes(actorClass)) {
      throw makeErr(ERR.INVALID_INPUT, 'unknown actor class');
    }
    auditLog.push(
      Object.freeze({
        action,
        actor_class: actorClass,
        account_id: accountId === undefined ? null : accountId,
        identity_provider: identityProvider === undefined ? null : identityProvider,
        request_id: null,
        details: null
      })
    );
  }

  function getAccount(accountId) {
    return accounts.get(accountId) || null;
  }
  function getIdentity(provider, subject) {
    return identities.get(provider + '|' + subject) || null;
  }
  function findActiveSameAccountProvider(accountId, provider, exceptSubject) {
    for (const row of identities.values()) {
      if (
        row.provider === provider &&
        row.accountId === accountId &&
        row.status === 'active' &&
        row.subject !== exceptSubject
      ) {
        return row;
      }
    }
    return null;
  }

  function createAccount() {
    clock += 1;
    const id = 'acct-' + String(clock).padStart(4, '0');
    accounts.set(id, { id, status: 'active', mergedIntoAccountId: null });
    return ok({ accountId: id });
  }

  function bindLegacyOwner(input) {
    const account = getAccount(input.accountId);
    if (!account || account.status !== 'active') throw makeErr(ERR.ACCOUNT_NOT_ELIGIBLE, 'bind legacy owner');
    const existing = legacyOwners.get(input.accountId);
    if (existing !== undefined) {
      if (existing !== input.legacyOwnerId) {
        throw makeErr(ERR.LEGACY_OWNER_ALREADY_BOUND, 'one legacy owner per account');
      }
      return ok({ idempotent: true });
    }
    legacyOwners.set(input.accountId, input.legacyOwnerId);
    return ok({ bound: true });
  }

  function attachVerifiedIdentity(input) {
    if (input.verifiedEvidence !== true) {
      throw makeErr(ERR.LINK_REQUIRES_VERIFIED_IDENTITY, 'verification-before-mapping invariant');
    }
    const { targetAccountId, subject } = input;
    const provider = input.provider;
    if (!PROVIDERS.includes(provider)) throw makeErr(ERR.INVALID_INPUT, 'provider');
    if (typeof subject !== 'string' || subject.length === 0) throw makeErr(ERR.INVALID_INPUT, 'subject');
    if (typeof input.verificationMethod !== 'string' || input.verificationMethod.length === 0) {
      throw makeErr(ERR.INVALID_INPUT, 'verification method');
    }
    const account = getAccount(targetAccountId);
    if (!account || account.status !== 'active') throw makeErr(ERR.ACCOUNT_NOT_ELIGIBLE, 'target account');

    let row = getIdentity(provider, subject);
    if (row && row.accountId !== targetAccountId) {
      throw makeErr(ERR.IDENTITY_ALREADY_BOUND, 'subject active/known on another account');
    }
    if (row && row.status === 'active') {
      return ok({ accountId: targetAccountId, idempotent: true });
    }
    const clash = findActiveSameAccountProvider(targetAccountId, provider, subject);
    if (clash) {
      throw makeErr(ERR.ONE_ACTIVE_IDENTITY_PER_PROVIDER_PER_ACCOUNT, provider);
    }
    clock += 1;
    if (row) {
      row.status = 'active';
      row.unlinkedAt = null;
      row.updatedAt = clock;
    } else {
      row = {
        provider,
        subject,
        accountId: targetAccountId,
        status: 'active',
        verificationMethod: input.verificationMethod,
        unlinkedAt: null,
        updatedAt: clock
      };
      identities.set(provider + '|' + subject, row);
    }
    pushAudit('link_created', input.actorClass || 'user', targetAccountId, provider);
    return ok({ accountId: targetAccountId });
  }

  function resolvePrincipal(input) {
    const provider = input.provider;
    if (!PROVIDERS.includes(provider)) return deny('IDENTITY_UNKNOWN');
    const row = getIdentity(provider, input.subject);
    if (!row) return deny('IDENTITY_UNKNOWN');
    if (row.status !== 'active') return deny('IDENTITY_REVOKED');
    const account = getAccount(row.accountId);
    if (!account) return deny('ACCOUNT_DISABLED');
    if (account.status === 'disabled') return deny('ACCOUNT_DISABLED');
    if (account.status === 'merged') return deny('ACCOUNT_MERGED_WITHOUT_POLICY');
    const legacyOwnerId = legacyOwners.get(row.accountId);
    if (legacyOwnerId === undefined) {
      if (provider === 'firebase') return deny('AMBIGUOUS_OWNER_PROJECTION');
      return Object.freeze({ decision: 'HOLD', reason: 'HOLD_NEW_NEON_ONLY_PRODUCT_WRITES' });
    }
    return Object.freeze({
      decision: 'ALLOW',
      accountId: row.accountId,
      legacyOwnerId,
      resolvedVia: provider
    });
  }

  function revokeIdentity(input) {
    const row = getIdentity(input.provider, input.subject);
    if (!row) throw makeErr(ERR.IDENTITY_UNKNOWN, 'revoke');
    if (row.status !== 'active') return ok({ idempotent: true });
    clock += 1;
    row.status = 'revoked';
    row.unlinkedAt = clock;
    row.updatedAt = clock;
    pushAudit('link_revoked', input.actorClass || 'system', row.accountId, input.provider);
    return ok({ revoked: true });
  }

  function disableAccount(input) {
    if (input.actorClass !== 'operator') throw makeErr(ERR.OPERATOR_ACTION_REQUIRED, 'disable account');
    const account = getAccount(input.accountId);
    if (!account) throw makeErr(ERR.INVALID_INPUT, 'unknown account');
    if (account.status === 'disabled') return ok({ idempotent: true });
    account.status = 'disabled';
    pushAudit('account_disabled', 'operator', input.accountId, undefined);
    return ok({ disabled: true });
  }

  function mergeAccounts(input) {
    if (input.actorClass !== 'operator') throw makeErr(ERR.OPERATOR_ACTION_REQUIRED, 'merge accounts');
    const from = getAccount(input.fromAccountId);
    const into = getAccount(input.intoAccountId);
    if (!from || !into || from.id === into.id || from.status !== 'active') {
      throw makeErr(ERR.INVALID_INPUT, 'merge inputs');
    }
    from.status = 'merged';
    from.mergedIntoAccountId = into.id;
    pushAudit('account_merged', 'operator', from.id, undefined);
    return ok({ merged: true });
  }

  function recoveryUnlink(input) {
    if (input.operatorAuthorized !== true || typeof input.justification !== 'string' ||
        input.justification.length === 0) {
      throw makeErr(ERR.RECOVERY_NOT_AUTHORIZED, 'operator authority and justification required');
    }
    const row = getIdentity(input.provider, input.subject);
    if (!row) throw makeErr(ERR.IDENTITY_UNKNOWN, 'recovery unlink');
    if (row.status !== 'active') return ok({ idempotent: true });
    row.status = 'revoked';
    clock += 1;
    row.unlinkedAt = clock;
    row.updatedAt = clock;
    pushAudit('recovery_used', 'operator', row.accountId, input.provider);
    return ok({ recovered: true });
  }

  function getAuditLog() {
    return Object.freeze(auditLog.map((r) => Object.assign({}, r)));
  }

  return Object.freeze({
    ERR,
    PROVIDERS,
    AUDIT_ACTIONS,
    createAccount,
    bindLegacyOwner,
    attachVerifiedIdentity,
    resolvePrincipal,
    revokeIdentity,
    disableAccount,
    mergeAccounts,
    recoveryUnlink,
    getAuditLog
  });
}

function assertCodeThrows(fn, expectedCode) {
  assert.throws(fn, (e) => e && e.code === expectedCode, 'expected code ' + expectedCode);
}

test('1. module surface is frozen with fixed provider and error vocabulary', () => {
  const core = createAuthAccountMappingCore();
  assert.ok(Object.isFrozen(core), 'core must be frozen');
  assert.ok(Object.isFrozen(core.ERR));
  assert.deepEqual([...core.PROVIDERS], ['firebase', 'neon']);
  assert.equal(typeof core.resolveByEmail, 'undefined', 'no email-based resolver may exist');
  assert.equal(typeof core.findAccountByEmail, 'undefined', 'no email-based lookup may exist');
});

test('2. R1 full three-layer resolution: both verified subjects reach same account and owner', () => {
  const core = createAuthAccountMappingCore();
  const created = core.createAccount();
  const accountId = created.accountId;
  core.bindLegacyOwner({ accountId, legacyOwnerId: 'legacy-owner-1' });
  core.attachVerifiedIdentity({
    targetAccountId: accountId,
    provider: 'firebase',
    subject: 'fb-subj-1',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true,
    actorClass: 'system'
  });
  core.attachVerifiedIdentity({
    targetAccountId: accountId,
    provider: 'neon',
    subject: 'ne-subj-1',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true,
    actorClass: 'system'
  });
  const viaFirebase = core.resolvePrincipal({ provider: 'firebase', subject: 'fb-subj-1' });
  const viaNeon = core.resolvePrincipal({ provider: 'neon', subject: 'ne-subj-1' });
  assert.equal(viaFirebase.decision, 'ALLOW');
  assert.equal(viaNeon.decision, 'ALLOW');
  assert.equal(viaFirebase.accountId, accountId);
  assert.equal(viaNeon.accountId, accountId);
  assert.equal(viaFirebase.legacyOwnerId, 'legacy-owner-1');
  assert.equal(viaNeon.legacyOwnerId, 'legacy-owner-1');
});

test('3. R1 unknown and revoked subjects are denied without fallback', () => {
  const core = createAuthAccountMappingCore();
  const a = core.createAccount().accountId;
  core.bindLegacyOwner({ accountId: a, legacyOwnerId: 'owner-a' });
  core.attachVerifiedIdentity({
    targetAccountId: a,
    provider: 'firebase',
    subject: 'fb-known',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  assert.deepEqual(core.resolvePrincipal({ provider: 'firebase', subject: 'fb-ghost' }), {
    decision: 'DENY',
    reason: 'IDENTITY_UNKNOWN'
  });
  core.revokeIdentity({ provider: 'firebase', subject: 'fb-known' });
  assert.equal(core.resolvePrincipal({ provider: 'firebase', subject: 'fb-known' }).reason, 'IDENTITY_REVOKED');
});

test('4. R1 disabled and merged accounts are fail-closed denials', () => {
  const core = createAuthAccountMappingCore();
  const a = core.createAccount().accountId;
  core.bindLegacyOwner({ accountId: a, legacyOwnerId: 'owner-a' });
  core.attachVerifiedIdentity({
    targetAccountId: a,
    provider: 'neon',
    subject: 'ne-dis',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  core.disableAccount({ accountId: a, actorClass: 'operator' });
  assert.equal(core.resolvePrincipal({ provider: 'neon', subject: 'ne-dis' }).reason, 'ACCOUNT_DISABLED');

  const b = core.createAccount().accountId;
  core.bindLegacyOwner({ accountId: b, legacyOwnerId: 'owner-b' });
  core.attachVerifiedIdentity({
    targetAccountId: b,
    provider: 'firebase',
    subject: 'fb-merged',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  core.mergeAccounts({ fromAccountId: b, intoAccountId: a, actorClass: 'operator' });
  assert.equal(
    core.resolvePrincipal({ provider: 'firebase', subject: 'fb-merged' }).reason,
    'ACCOUNT_MERGED_WITHOUT_POLICY'
  );
});

test('5. R2 linking without verified evidence always fails closed before any mutation', () => {
  const core = createAuthAccountMappingCore();
  const a = core.createAccount().accountId;
  assertCodeThrows(
    () =>
      core.attachVerifiedIdentity({
        targetAccountId: a,
        provider: 'neon',
        subject: 'ne-unverified',
        verificationMethod: 'none',
        verifiedEvidence: false
      }),
    core.ERR.LINK_REQUIRES_VERIFIED_IDENTITY
  );
  assert.equal(core.getAuditLog().length, 0, 'failed attempts write zero audit rows');
});

test('6. R2 email is never a linking or ownership key', () => {
  const core = createAuthAccountMappingCore();
  const a = core.createAccount().accountId;
  const b = core.createAccount().accountId;
  core.bindLegacyOwner({ accountId: a, legacyOwnerId: 'owner-a' });
  core.bindLegacyOwner({ accountId: b, legacyOwnerId: 'owner-b' });
  core.attachVerifiedIdentity({
    targetAccountId: a,
    provider: 'firebase',
    subject: 'fb-a',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  core.attachVerifiedIdentity({
    targetAccountId: b,
    provider: 'neon',
    subject: 'ne-b1',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  core.attachVerifiedIdentity({
    targetAccountId: b,
    provider: 'neon',
    subject: 'ne-b2',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  const r1 = core.resolvePrincipal({ provider: 'neon', subject: 'ne-b1' });
  const r2 = core.resolvePrincipal({ provider: 'neon', subject: 'ne-b2' });
  assert.equal(r1.decision, 'ALLOW');
  assert.equal(r2.decision, 'ALLOW');
  assert.notEqual(r1.accountId, r2.accountId, 'shared display email across accounts creates zero coupling');
});

test('7. R2 re-attach of an identical active pair is an idempotent no-op', () => {
  const core = createAuthAccountMappingCore();
  const a = core.createAccount().accountId;
  const attach = () =>
    core.attachVerifiedIdentity({
      targetAccountId: a,
      provider: 'neon',
      subject: 'ne-idem',
      verificationMethod: 'id_token_jwks',
      verifiedEvidence: true
    });
  attach();
  const auditBefore = core.getAuditLog().length;
  const second = attach();
  assert.equal(second.idempotent, true);
  assert.equal(core.getAuditLog().length, auditBefore, 'idempotent relink writes zero audit delta');
});

test('8. R2/L4 active binding on another account blocks rebinding with zero mutation', () => {
  const core = createAuthAccountMappingCore();
  const a = core.createAccount().accountId;
  const b = core.createAccount().accountId;
  core.attachVerifiedIdentity({
    targetAccountId: a,
    provider: 'neon',
    subject: 'ne-bound',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  const auditBefore = core.getAuditLog().length;
  assertCodeThrows(
    () =>
      core.attachVerifiedIdentity({
        targetAccountId: b,
        provider: 'neon',
        subject: 'ne-bound',
        verificationMethod: 'id_token_jwks',
        verifiedEvidence: true
      }),
    core.ERR.IDENTITY_ALREADY_BOUND
  );
  assert.equal(core.getAuditLog().length, auditBefore, 'conflicting attach writes nothing');
  assert.equal(
    core.resolvePrincipal({ provider: 'neon', subject: 'ne-fresh' }).decision,
    'DENY',
    'target account gained no phantom access'
  );
});

test('9. R2/L3 at most one active identity per provider per account', () => {
  const core = createAuthAccountMappingCore();
  const a = core.createAccount().accountId;
  core.bindLegacyOwner({ accountId: a, legacyOwnerId: 'owner-a' });
  core.attachVerifiedIdentity({
    targetAccountId: a,
    provider: 'firebase',
    subject: 'fb-first',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  assertCodeThrows(
    () =>
      core.attachVerifiedIdentity({
        targetAccountId: a,
        provider: 'firebase',
        subject: 'fb-second',
        verificationMethod: 'id_token_jwks',
        verifiedEvidence: true
      }),
    core.ERR.ONE_ACTIVE_IDENTITY_PER_PROVIDER_PER_ACCOUNT
  );
  core.attachVerifiedIdentity({
    targetAccountId: a,
    provider: 'neon',
    subject: 'ne-first',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  assertCodeThrows(
    () =>
      core.attachVerifiedIdentity({
        targetAccountId: a,
        provider: 'neon',
        subject: 'ne-second',
        verificationMethod: 'id_token_jwks',
        verifiedEvidence: true
      }),
    core.ERR.ONE_ACTIVE_IDENTITY_PER_PROVIDER_PER_ACCOUNT
  );
});

test('10. bridge section 8 HOLD: neon-only identity cannot perform legacy owner writes', () => {
  const core = createAuthAccountMappingCore();
  const a = core.createAccount().accountId;
  core.attachVerifiedIdentity({
    targetAccountId: a,
    provider: 'neon',
    subject: 'ne-only',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  const outcome = core.resolvePrincipal({ provider: 'neon', subject: 'ne-only' });
  assert.equal(outcome.decision, 'HOLD');
  assert.equal(outcome.reason, 'HOLD_NEW_NEON_ONLY_PRODUCT_WRITES');
  assert.equal(outcome.legacyOwnerId, undefined, 'no legacy projection exists to hand out');
});

test('11. defense-in-depth: firebase identity without legacy projection is ambiguous denial', () => {
  const core = createAuthAccountMappingCore();
  const a = core.createAccount().accountId;
  core.attachVerifiedIdentity({
    targetAccountId: a,
    provider: 'firebase',
    subject: 'fb-orphan',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  assert.equal(
    core.resolvePrincipal({ provider: 'firebase', subject: 'fb-orphan' }).reason,
    'AMBIGUOUS_OWNER_PROJECTION'
  );
});

test('12. every successful mutation appends exactly one audit row; failures append none', () => {
  const core = createAuthAccountMappingCore();
  const a = core.createAccount().accountId;
  core.bindLegacyOwner({ accountId: a, legacyOwnerId: 'owner-a' });
  const base = core.getAuditLog().length;
  core.attachVerifiedIdentity({
    targetAccountId: a,
    provider: 'firebase',
    subject: 'fb-audit',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  assert.equal(core.getAuditLog().length - base, 1, 'attach writes exactly one row');
  core.revokeIdentity({ provider: 'firebase', subject: 'fb-audit' });
  assert.equal(core.getAuditLog().length - base, 2, 'revoke writes exactly one row');
  core.revokeIdentity({ provider: 'firebase', subject: 'fb-audit' });
  assert.equal(core.getAuditLog().length - base, 2, 'duplicate revoke stays idempotent');
  assertCodeThrows(
    () =>
      core.attachVerifiedIdentity({
        targetAccountId: a,
        provider: 'firebase',
        subject: 'fb-second',
        verificationMethod: 'id_token_jwks',
        verifiedEvidence: true
      }),
    core.ERR.ONE_ACTIVE_IDENTITY_PER_PROVIDER_PER_ACCOUNT
  );
  assert.equal(core.getAuditLog().length - base, 2, 'rejected mutation writes zero rows');
});

test('13. audit rows carry bounded fields only and never raw provider subjects', () => {
  const core = createAuthAccountMappingCore();
  const a = core.createAccount().accountId;
  core.attachVerifiedIdentity({
    targetAccountId: a,
    provider: 'neon',
    subject: 'ne-shape',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  const log = core.getAuditLog();
  assert.equal(log.length, 1);
  assert.deepEqual(
    Object.keys(log[0]).sort(),
    ['account_id', 'actor_class', 'action', 'details', 'identity_provider', 'request_id']
  );
  const serialized = JSON.stringify(core.getAuditLog());
  assert.ok(!serialized.includes('ne-shape'), 'raw subject must not leak into audit payload');
});

test('14. recovery path requires operator authority plus justification', () => {
  const core = createAuthAccountMappingCore();
  const a = core.createAccount().accountId;
  core.bindLegacyOwner({ accountId: a, legacyOwnerId: 'owner-a' });
  core.attachVerifiedIdentity({
    targetAccountId: a,
    provider: 'neon',
    subject: 'ne-recover',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  assertCodeThrows(
    () => core.recoveryUnlink({ provider: 'neon', subject: 'ne-recover', operatorAuthorized: false }),
    core.ERR.RECOVERY_NOT_AUTHORIZED
  );
  assertCodeThrows(
    () => core.recoveryUnlink({ provider: 'neon', subject: 'ne-recover', operatorAuthorized: true }),
    core.ERR.RECOVERY_NOT_AUTHORIZED
  );
  core.recoveryUnlink({
    provider: 'neon',
    subject: 'ne-recover',
    operatorAuthorized: true,
    justification: 'credential-loss drill per contract R3'
  });
  assert.equal(core.resolvePrincipal({ provider: 'neon', subject: 'ne-recover' }).reason, 'IDENTITY_REVOKED');
  const lastRow = core.getAuditLog()[core.getAuditLog().length - 1];
  assert.equal(lastRow.action, 'recovery_used');
  core.attachVerifiedIdentity({
    targetAccountId: a,
    provider: 'neon',
    subject: 'ne-recover',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  assert.equal(core.resolvePrincipal({ provider: 'neon', subject: 'ne-recover' }).decision, 'ALLOW');
});

test('15. caller input objects are never mutated by core operations', () => {
  const core = createAuthAccountMappingCore();
  const a = core.createAccount().accountId;
  const input = Object.freeze({
    targetAccountId: a,
    provider: 'firebase',
    subject: 'fb-immutable',
    verificationMethod: 'id_token_jwks',
    verifiedEvidence: true
  });
  const snapshot = JSON.stringify(input);
  core.attachVerifiedIdentity(input);
  assert.equal(JSON.stringify(input), snapshot, 'frozen caller input survives untouched');
});

test('16. contract document exists and names this prototype validation scope', () => {
  const doc = fs.readFileSync(path.join(ROOT, CONTRACT_DOC_REL), 'utf8');
  assert.ok(doc.includes('auth-mapping-linking-contract-4006.test.cjs'), 'doc references this test file');
  assert.ok(doc.includes('R1'), 'resolve rules section');
  assert.ok(doc.includes('HOLD_NEW_NEON_ONLY_PRODUCT_WRITES'), 'hold vocabulary');
});
