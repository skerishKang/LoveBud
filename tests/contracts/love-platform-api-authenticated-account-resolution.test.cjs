'use strict';

// Issue #4567 - Non-wired stable-account compatibility resolver contract.
// Evidence layer: EXECUTED_FAKE.
//
// Executes the production-source R1 account-resolution policy
// (workers/love-platform-api/authenticated-account-resolution.js) with an
// injected fake identity lookup: verified { provider, providerSubject } ->
// stable app_account -> legacy owner projection -> ALLOW / HOLD / DENY.
// No DB, no network, no provider, no Product wiring.
//
// Refs #4567 #4006 #4004 - Keep OPEN.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const RESOLVER_PATH = path.join(ROOT, 'workers', 'love-platform-api', 'authenticated-account-resolution.js');
const BOUNDARY_PATH = path.join(ROOT, 'workers', 'love-platform-api', 'authenticated-principal.js');
const NEON_VERIFIER_PATH = path.join(ROOT, 'workers', 'love-platform-api', 'neon-auth-token-verifier.js');

let resolverModulePromise = null;
function loadResolverModule() {
  if (!resolverModulePromise) {
    resolverModulePromise = import('../../workers/love-platform-api/authenticated-account-resolution.js');
  }
  return resolverModulePromise;
}

const ACTIVE_ROW = Object.freeze({
  identityStatus: 'active',
  accountId: 'acct-4567-1',
  accountStatus: 'active',
  legacyOwnerId: 'owner-4567-1'
});

function makeLookup(rows, { throws = false } = {}) {
  const state = { calls: 0, keys: [], args: [] };
  const table = new Map(Object.entries(rows));
  const lookupIdentity = async (key) => {
    state.calls += 1;
    state.args.push(key);
    state.keys.push(`${key.provider}|${key.providerSubject}`);
    if (throws) throw new Error('simulated lookup outage with private detail');
    return table.get(`${key.provider}|${key.providerSubject}`) ?? null;
  };
  return { lookupIdentity, state };
}

async function makeResolver(rows, options) {
  const { createAuthenticatedAccountResolver } = await loadResolverModule();
  const lookup = makeLookup(rows, options);
  const resolver = createAuthenticatedAccountResolver({ lookupIdentity: lookup.lookupIdentity });
  return { resolver, lookup };
}

test('1. mapped active Firebase identity resolves to an exact frozen ALLOW', async () => {
  const { resolver } = await makeResolver({ 'firebase|fb-active': ACTIVE_ROW });
  const outcome = await resolver.resolve({ provider: 'firebase', providerSubject: 'fb-active' });
  assert.deepEqual(outcome, { decision: 'ALLOW', accountId: 'acct-4567-1', legacyOwnerId: 'owner-4567-1' });
  assert.deepEqual(Object.keys(outcome), ['decision', 'accountId', 'legacyOwnerId']);
  assert.ok(Object.isFrozen(outcome));
});

test('2. mapped active Neon identity resolves to an exact frozen ALLOW', async () => {
  const { resolver } = await makeResolver({ 'neon|ne-active': ACTIVE_ROW });
  const outcome = await resolver.resolve({ provider: 'neon', providerSubject: 'ne-active' });
  assert.deepEqual(outcome, { decision: 'ALLOW', accountId: 'acct-4567-1', legacyOwnerId: 'owner-4567-1' });
  assert.ok(Object.isFrozen(outcome));
});

test('3. dual-provider linked identities project to identical accountId and legacyOwnerId', async () => {
  const { resolver } = await makeResolver({
    'firebase|fb-linked': ACTIVE_ROW,
    'neon|ne-linked': ACTIVE_ROW
  });
  const viaFirebase = await resolver.resolve({ provider: 'firebase', providerSubject: 'fb-linked' });
  const viaNeon = await resolver.resolve({ provider: 'neon', providerSubject: 'ne-linked' });
  assert.equal(viaFirebase.decision, 'ALLOW');
  assert.equal(viaNeon.decision, 'ALLOW');
  assert.equal(viaFirebase.accountId, viaNeon.accountId);
  assert.equal(viaFirebase.legacyOwnerId, viaNeon.legacyOwnerId);
});

test('4. unknown identity is denied with IDENTITY_UNKNOWN', async () => {
  const { resolver, lookup } = await makeResolver({});
  const outcome = await resolver.resolve({ provider: 'firebase', providerSubject: 'fb-missing' });
  assert.deepEqual(outcome, { decision: 'DENY', reason: 'IDENTITY_UNKNOWN' });
  assert.ok(Object.isFrozen(outcome));
  assert.equal(lookup.state.calls, 1);
});

test('5. revoked identity is denied with IDENTITY_REVOKED', async () => {
  const { resolver } = await makeResolver({
    'neon|ne-revoked': { ...ACTIVE_ROW, identityStatus: 'revoked' }
  });
  const outcome = await resolver.resolve({ provider: 'neon', providerSubject: 'ne-revoked' });
  assert.deepEqual(outcome, { decision: 'DENY', reason: 'IDENTITY_REVOKED' });
});

test('6. disabled account is denied with ACCOUNT_DISABLED', async () => {
  const { resolver } = await makeResolver({
    'firebase|fb-disabled': { ...ACTIVE_ROW, accountStatus: 'disabled' }
  });
  const outcome = await resolver.resolve({ provider: 'firebase', providerSubject: 'fb-disabled' });
  assert.deepEqual(outcome, { decision: 'DENY', reason: 'ACCOUNT_DISABLED' });
});

test('7. merged account is denied with ACCOUNT_MERGED_WITHOUT_POLICY', async () => {
  const { resolver } = await makeResolver({
    'firebase|fb-merged': { ...ACTIVE_ROW, accountStatus: 'merged' }
  });
  const outcome = await resolver.resolve({ provider: 'firebase', providerSubject: 'fb-merged' });
  assert.deepEqual(outcome, { decision: 'DENY', reason: 'ACCOUNT_MERGED_WITHOUT_POLICY' });
});

test('8. Firebase identity without legacy owner projection is denied as AMBIGUOUS_OWNER_PROJECTION', async () => {
  const { resolver } = await makeResolver({
    'firebase|fb-no-owner': { ...ACTIVE_ROW, legacyOwnerId: null }
  });
  const outcome = await resolver.resolve({ provider: 'firebase', providerSubject: 'fb-no-owner' });
  assert.deepEqual(outcome, { decision: 'DENY', reason: 'AMBIGUOUS_OWNER_PROJECTION' });
});

test('9. Neon identity without legacy owner projection is held with HOLD_NEW_NEON_ONLY_PRODUCT_WRITES', async () => {
  const { resolver } = await makeResolver({
    'neon|ne-no-owner': { ...ACTIVE_ROW, legacyOwnerId: null }
  });
  const outcome = await resolver.resolve({ provider: 'neon', providerSubject: 'ne-no-owner' });
  assert.deepEqual(outcome, { decision: 'HOLD', reason: 'HOLD_NEW_NEON_ONLY_PRODUCT_WRITES' });
  assert.deepEqual(Object.keys(outcome), ['decision', 'reason']);
  assert.ok(Object.isFrozen(outcome));
});

test('10. unknown provider fails closed as DENY without any lookup', async () => {
  const { resolver, lookup } = await makeResolver({ 'firebase|fb-active': ACTIVE_ROW });
  for (const provider of ['google', 'github', '', null, 42, undefined]) {
    const outcome = await resolver.resolve({ provider, providerSubject: 'fb-active' });
    assert.deepEqual(outcome, { decision: 'DENY', reason: 'IDENTITY_UNKNOWN' });
  }
  assert.equal(lookup.state.calls, 0, 'unsupported providers must never reach the lookup');
});

test('11. empty, untrimmed, or non-string providerSubject fails closed without any lookup', async () => {
  const { resolver, lookup } = await makeResolver({ 'firebase|fb-active': ACTIVE_ROW });
  for (const providerSubject of ['', '  fb-active', 'fb-active  ', ' padded ', null, 42, undefined]) {
    const outcome = await resolver.resolve({ provider: 'firebase', providerSubject });
    assert.deepEqual(outcome, { decision: 'DENY', reason: 'IDENTITY_UNKNOWN' });
  }
  assert.equal(lookup.state.calls, 0);
});

test('12. malformed lookup results fail closed with the bounded LOOKUP_INVALID_RESULT error', async () => {
  const malformedRows = [
    'not-an-object',
    42,
    [],
    { ...ACTIVE_ROW, identityStatus: 'weird' },
    { ...ACTIVE_ROW, identityStatus: undefined },
    { ...ACTIVE_ROW, accountId: '' },
    { ...ACTIVE_ROW, accountId: 7 },
    { ...ACTIVE_ROW, accountStatus: 'unknown' },
    { ...ACTIVE_ROW, accountStatus: undefined },
    { ...ACTIVE_ROW, legacyOwnerId: '' },
    { ...ACTIVE_ROW, legacyOwnerId: 99 }
  ];
  for (const row of malformedRows) {
    const { resolver } = await makeResolver({ 'firebase|fb-active': row });
    await assert.rejects(
      resolver.resolve({ provider: 'firebase', providerSubject: 'fb-active' }),
      (error) => error.code === 'LOOKUP_INVALID_RESULT' && error.message === 'LOOKUP_INVALID_RESULT'
    );
  }
});

test('13. lookup exceptions are sanitized into the bounded LOOKUP_UNAVAILABLE error with no retry', async () => {
  const { resolver, lookup } = await makeResolver({}, { throws: true });
  await assert.rejects(
    resolver.resolve({ provider: 'firebase', providerSubject: 'fb-active' }),
    (error) => error.code === 'LOOKUP_UNAVAILABLE'
      && error.message === 'LOOKUP_UNAVAILABLE'
      && !error.message.includes('private detail')
  );
  assert.equal(lookup.state.calls, 1, 'no automatic retry');
});

test('14. email collisions have zero effect and email is never passed into the lookup', async () => {
  const { resolver, lookup } = await makeResolver({
    'firebase|fb-email-a': { ...ACTIVE_ROW, accountId: 'acct-a', legacyOwnerId: 'owner-a' },
    'firebase|fb-email-b': { ...ACTIVE_ROW, accountId: 'acct-b', legacyOwnerId: 'owner-b' }
  });
  const collisionA = await resolver.resolve({
    provider: 'firebase', providerSubject: 'fb-email-a',
    email: 'shared@example.invalid', accountId: 'caller-acct', legacyOwnerId: 'caller-owner'
  });
  const collisionB = await resolver.resolve({
    provider: 'firebase', providerSubject: 'fb-email-b',
    email: 'shared@example.invalid', accountId: 'caller-acct', legacyOwnerId: 'caller-owner'
  });
  assert.deepEqual(collisionA, { decision: 'ALLOW', accountId: 'acct-a', legacyOwnerId: 'owner-a' });
  assert.deepEqual(collisionB, { decision: 'ALLOW', accountId: 'acct-b', legacyOwnerId: 'owner-b' });
  for (const received of lookup.state.args) {
    assert.ok(Object.isFrozen(received), 'lookup input must be frozen');
    assert.deepEqual(Object.keys(received), ['provider', 'providerSubject']);
    const serialized = JSON.stringify(received);
    assert.ok(!serialized.includes('shared@example.invalid'), 'email must never reach the lookup');
    assert.ok(!serialized.includes('caller-acct') && !serialized.includes('caller-owner'));
  }
});

test('15. each resolution performs at most one logical lookup', async () => {
  const { resolver, lookup } = await makeResolver({ 'firebase|fb-active': ACTIVE_ROW });
  await resolver.resolve({ provider: 'firebase', providerSubject: 'fb-active' });
  await resolver.resolve({ provider: 'firebase', providerSubject: 'fb-active' });
  await resolver.resolve({ provider: 'neon', providerSubject: 'ne-missing' });
  assert.equal(lookup.state.calls, 3, 'exactly one lookup per valid resolution');
});

test('16. caller input and lookup fixtures are never mutated', async () => {
  const fixtureRow = { ...ACTIVE_ROW };
  const fixtureSnapshot = JSON.stringify(fixtureRow);
  const { resolver } = await makeResolver({ 'firebase|fb-active': fixtureRow });
  const input = { provider: 'firebase', providerSubject: 'fb-active', email: 'x@example.invalid' };
  const inputSnapshot = JSON.stringify(input);
  await resolver.resolve(input);
  await resolver.resolve(input);
  assert.equal(JSON.stringify(input), inputSnapshot, 'caller input must not be mutated');
  assert.equal(JSON.stringify(fixtureRow), fixtureSnapshot, 'lookup fixture must not be mutated');
});

test('17. every terminal outcome is frozen and DENY/HOLD carry no private leakage', async () => {
  const cases = [
    [{}, 'firebase', 'fb-missing', 'DENY'],
    [{ 'firebase|fb-revoked': { ...ACTIVE_ROW, identityStatus: 'revoked' } }, 'firebase', 'fb-revoked', 'DENY'],
    [{ 'firebase|fb-disabled': { ...ACTIVE_ROW, accountStatus: 'disabled' } }, 'firebase', 'fb-disabled', 'DENY'],
    [{ 'firebase|fb-merged': { ...ACTIVE_ROW, accountStatus: 'merged' } }, 'firebase', 'fb-merged', 'DENY'],
    [{ 'firebase|fb-no-owner': { ...ACTIVE_ROW, legacyOwnerId: null } }, 'firebase', 'fb-no-owner', 'DENY'],
    [{ 'neon|ne-no-owner': { ...ACTIVE_ROW, legacyOwnerId: null } }, 'neon', 'ne-no-owner', 'HOLD'],
    [{ 'firebase|fb-active': ACTIVE_ROW }, 'firebase', 'fb-active', 'ALLOW']
  ];
  for (const [rows, provider, subject, decision] of cases) {
    const { resolver } = await makeResolver(rows);
    const outcome = await resolver.resolve({ provider, providerSubject: subject });
    assert.equal(outcome.decision, decision);
    assert.ok(Object.isFrozen(outcome), `${decision} outcome must be frozen`);
    if (decision !== 'ALLOW') {
      assert.deepEqual(Object.keys(outcome), ['decision', 'reason']);
      const serialized = JSON.stringify(outcome);
      assert.ok(!serialized.includes(subject), 'subject must not leak into DENY/HOLD');
      assert.ok(!serialized.includes('acct-4567-1') && !serialized.includes('owner-4567-1'));
    } else {
      const serialized = JSON.stringify(outcome);
      assert.ok(!serialized.includes(subject), 'providerSubject must not leak into ALLOW');
    }
  }
});

test('18. resolver creation requires a function lookupIdentity', async () => {
  const { createAuthenticatedAccountResolver } = await loadResolverModule();
  for (const dependencies of [null, {}, { lookupIdentity: null }, { lookupIdentity: 'nope' }, undefined]) {
    assert.throws(
      () => createAuthenticatedAccountResolver(dependencies),
      (error) => error.code === 'CONFIG_INVALID' && error.message === 'CONFIG_INVALID'
    );
  }
});

test('19. policy vocabulary matches the #4006 R1 contract exactly', async () => {
  const { AUTHENTICATED_ACCOUNT_RESOLUTION_CONTRACT: contract } = await loadResolverModule();
  assert.deepEqual(contract.supportedProviders, ['firebase', 'neon']);
  assert.deepEqual(contract.decisions, ['ALLOW', 'DENY', 'HOLD']);
  assert.deepEqual(contract.denyReasons, [
    'IDENTITY_UNKNOWN',
    'IDENTITY_REVOKED',
    'ACCOUNT_DISABLED',
    'ACCOUNT_MERGED_WITHOUT_POLICY',
    'AMBIGUOUS_OWNER_PROJECTION'
  ]);
  assert.deepEqual(contract.holdReasons, ['HOLD_NEW_NEON_ONLY_PRODUCT_WRITES']);
  assert.deepEqual(contract.allowFields, ['decision', 'accountId', 'legacyOwnerId']);
  assert.deepEqual(contract.denyHoldFields, ['decision', 'reason']);
  assert.equal(contract.lookupCallMaxPerResolution, 1);
  assert.equal(contract.acceptsEmailAuthority, false);
  assert.equal(contract.wiredIntoProductBoundary, false);
  assert.equal(contract.wiredIntoRoutes, false);
});

test('20. non-wiring guard: the resolver stays isolated from Product source', () => {
  const boundarySource = fs.readFileSync(BOUNDARY_PATH, 'utf8');
  const neonVerifierSource = fs.readFileSync(NEON_VERIFIER_PATH, 'utf8');
  assert.ok(!boundarySource.includes('authenticated-account-resolution'), 'boundary must not import the resolver');
  assert.ok(!neonVerifierSource.includes('authenticated-account-resolution'), 'Neon verifier must not import the resolver');

  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js') && fs.readFileSync(full, 'utf8').includes('authenticated-account-resolution')) {
        offenders.push(path.relative(ROOT, full));
      }
    }
  };
  walk(path.join(ROOT, 'functions', '_shared'));
  walk(path.join(ROOT, 'functions', 'api'));
  const modalDir = path.join(ROOT, 'modal_compute');
  if (fs.existsSync(modalDir)) walk(modalDir);
  assert.deepEqual(offenders, [], 'no helper, route, or Modal source may reference the resolver');
});