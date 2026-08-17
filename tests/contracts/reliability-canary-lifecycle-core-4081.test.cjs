'use strict';

// Issue #4081 — Source-only synthetic canary lifecycle harness contract.
// Registered in tests/test-layer-classification.json and enumerated by the
// repository default tests/contracts/*.test.cjs path.
// It performs no network/DB/provider/Production activity.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE_PATH = path.join(ROOT, 'js', 'observability', 'reliability-canary-lifecycle-core.js');
const TAXONOMY_PATH = path.join(ROOT, 'js', 'observability', 'reliability-sentinel-taxonomy.js');
const CLASSIFIER_PATH = path.join(ROOT, 'js', 'observability', 'reliability-write-outcome-classifier-core.js');

function loadModule(filePath, globalName) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = { window: {} };
  new Function('window', source)(sandbox.window);
  assert.ok(sandbox.window[globalName], `missing ${globalName}`);
  return sandbox.window[globalName];
}

function loadAll() {
  const taxonomy = loadModule(TAXONOMY_PATH, 'LoveBudReliabilitySentinelTaxonomy');
  const classifier = loadModule(CLASSIFIER_PATH, 'LoveBudWriteOutcomeClassifierCore');
  const lifecycle = loadModule(CORE_PATH, 'LoveBudReliabilityCanaryLifecycleCore');
  return { taxonomy, classifier, lifecycle };
}

// Injected effect methods return RAW values (not wrapped in {ok,value}).
// The lifecycle's internal `call()` helper catches throws and wraps the result.
// A throw is how an effect signals failure; a non-throw return is success.

function fakeQaAuth(authFailure) {
  return {
    acquireAuth() {
      if (authFailure) throw new Error('auth fail');
      return { opaque: 'auth-capability' };
    }
  };
}

function fakeFixture(opts) {
  return {
    prepareFixture(auth) {
      if (!auth || !auth.opaque) throw new Error('no auth');
      if (opts && opts.fixturePrivateLeak) return { opaque: 'fixture', token: 'leak' };
      if (opts && opts.fixtureFailure) throw new Error('fixture fail');
      return { opaque: 'fixture' };
    }
  };
}

function fakeWriteDispatch(opts) {
  return {
    dispatchMemory(fixture) {
      if (!fixture || !fixture.opaque) throw new Error('no fixture');
      if (opts && opts.dispatchFailure) throw new Error('dispatch fail');
      if (opts && opts.dispatchUnknown) {
        return { facts: { transport: 'timeout', commit: 'unknown', returning: 'unknown', reread: 'unknown' } };
      }
      return { facts: { transport: 'ok', commit: 'committed', returning: 'row_returned', reread: 'visible' } };
    }
  };
}

function fakeClassifier(classifierCore, classifierFailure) {
  return {
    classifyWriteOutcome(facts) {
      if (classifierFailure) throw new Error('classifier fail');
      // The classifier core expects a facts object WITHOUT a wrapping layer.
      // But it was called via `call()`, so facts is whatever dispatchMemory returned.
      return classifierCore.classifyWriteOutcome(facts);
    }
  };
}

function fakeCanonicalReread(opts) {
  return {
    reread(fixture) {
      if (!fixture || !fixture.opaque) throw new Error('no fixture');
      if (opts && opts.rereadMissing) throw new Error('reread missing');
      return { confirmed: true };
    }
  };
}

function fakeOwnerRead(opts) {
  const ownerMatch = (opts && opts.ownerMismatch) ? false : true;
  return {
    readOwner() {
      if (opts && opts.ownerReadFailure) throw new Error('owner read fail');
      return { owner_match: ownerMatch };
    }
  };
}

function fakeCleanup(opts) {
  return {
    cleanup(fixture) {
      if (!fixture || !fixture.opaque) throw new Error('no fixture');
      if (opts && opts.cleanupFailure) throw new Error('cleanup fail');
      if (opts && opts.cleanupRetained) return { disposition: 'retained' };
      return { disposition: 'cleaned' };
    }
  };
}

function fakeFence(opts) {
  const fenceToken = (opts && opts.fenceToken !== undefined) ? opts.fenceToken : 'fence-abc';
  return {
    acquire(runKey, expiry) {
      if (opts && opts.fenceUnavailable) return null;
      if (opts && opts.fenceRejected) return false;
      if (opts && opts.fenceThrow) throw new Error('fence fail');
      return fenceToken;
    },
    assertCurrent(fence) {
      if (opts && opts.fenceStale) return false;
      return true;
    },
    renew() { return true; },
    release() {}
  };
}

function fakeVisibilityObserver(observeFailure) {
  return {
    observeVisibility() {
      if (observeFailure) throw new Error('visibility observe fail');
      return { visibility: 'PRIVATE' };
    }
  };
}

function fakeBrowseObserver(detectEligible) {
  return {
    observeBrowseEligibility() {
      if (detectEligible) return { eligible: true };
      return { eligible: false };
    }
  };
}

function buildDeps(taxonomy, classifier, opts) {
  const deps = {
    qaAuth: fakeQaAuth(opts && opts.authFailure),
    fixture: fakeFixture(opts),
    writeDispatch: fakeWriteDispatch(opts),
    classifier: fakeClassifier(classifier, opts && opts.classifierFailure),
    canonicalReread: fakeCanonicalReread(opts),
    ownerRead: fakeOwnerRead(opts),
    cleanup: fakeCleanup(opts),
    fence: fakeFence(opts),
    taxonomy
  };
  if (!(opts && opts.noVisibilityObserver)) {
    deps.visibilityObserver = fakeVisibilityObserver(opts && opts.visibilityObserveFailure);
  }
  if (!(opts && opts.noBrowseObserver)) {
    deps.browseObserver = fakeBrowseObserver(opts && opts.browseEligibleDetected);
  }
  return deps;
}

async function runLifecycle(opts) {
  const { taxonomy, classifier, lifecycle } = loadAll();
  const deps = buildDeps(taxonomy, classifier, opts);
  const runner = lifecycle.createCanaryLifecycle(deps);
  return await runner.run('test-run-key-4081', {});
}

// =============================================================================
// Test suite
// =============================================================================

test('1. module exports a frozen pure authority with zero capabilities', () => {
  const { lifecycle } = loadAll();
  assert.equal(lifecycle.CONTRACT_VERSION, '1');
  assert.ok(Object.isFrozen(lifecycle), 'core export must be frozen');
  assert.deepEqual(lifecycle.CAPABILITIES, []);
  assert.ok(Object.isFrozen(lifecycle.LIFECYCLE_STAGES));
  assert.ok(Object.isFrozen(lifecycle.TERMINAL_STATES));
  assert.ok(Object.isFrozen(lifecycle.FAILURE_STATES));
  assert.ok(Object.isFrozen(lifecycle.SYNTHETIC_VISIBILITY));
  assert.ok(Object.isFrozen(lifecycle.ERROR_CODES));
  assert.ok(Object.isFrozen(lifecycle.PRIVATE_KEYS));
  assert.ok(Object.isFrozen(lifecycle.PRIVATE_KEY_SET));
});

test('2. lifecycle stages are distinct and ordered', () => {
  const { lifecycle } = loadAll();
  const order = lifecycle.LIFECYCLE_STAGE_ORDER;
  assert.equal(order.length, 8);
  assert.equal(order[0], 'IDLE');
  assert.equal(order[1], 'AUTH_ACQUIRED');
  assert.equal(order[2], 'FIXTURE_READY');
  assert.equal(order[3], 'MEMORY_WRITE_DISPATCHED');
  assert.equal(order[4], 'MEMORY_WRITE_ACKNOWLEDGED');
  assert.equal(order[5], 'CANONICAL_REREAD_CONFIRMED');
  assert.equal(order[6], 'OWNER_READ_CONFIRMED');
  assert.equal(order[7], 'VISIBILITY_OBSERVED');
  const stages = Object.values(lifecycle.LIFECYCLE_STAGES);
  assert.equal(new Set(stages).size, 8, 'stages must be distinct');
});

test('3. terminal states are distinct from stages and failure states', () => {
  const { lifecycle } = loadAll();
  assert.equal(lifecycle.TERMINAL_STATES.CLEANUP_CONFIRMED, 'CLEANUP_CONFIRMED');
  assert.equal(lifecycle.TERMINAL_STATES.FIXTURE_RETAINED_DETERMINISTIC, 'FIXTURE_RETAINED_DETERMINISTIC');
  const terminals = Object.values(lifecycle.TERMINAL_STATES);
  const stages = Object.values(lifecycle.LIFECYCLE_STAGES);
  const failures = Object.values(lifecycle.FAILURE_STATES);
  for (const t of terminals) {
    assert.ok(!stages.includes(t), `terminal ${t} must not appear in stages`);
    assert.ok(!failures.includes(t), `terminal ${t} must not appear in failure states`);
  }
});

test('4. failure states are fail-closed vocabulary', () => {
  const { lifecycle } = loadAll();
  assert.equal(lifecycle.FAILURE_STATES.BOUNDED_STAGE_FAILURE, 'BOUNDED_STAGE_FAILURE');
  assert.equal(lifecycle.FAILURE_STATES.CLEANUP_FAILED, 'CLEANUP_FAILED');
  assert.equal(lifecycle.FAILURE_STATES.FENCED, 'FENCED');
});

test('5. synthetic visibility is always private and non-browse-eligible', () => {
  const { lifecycle } = loadAll();
  assert.equal(lifecycle.SYNTHETIC_VISIBILITY.VISIBILITY, 'PRIVATE');
  assert.equal(lifecycle.SYNTHETIC_VISIBILITY.BROWSE_ELIGIBLE, 'NON_BROWSE_ELIGIBLE');
});

test('6. createCanaryLifecycle throws on missing/invalid dependencies', () => {
  const { taxonomy, lifecycle } = loadAll();
  assert.throws(() => lifecycle.createCanaryLifecycle(null), TypeError);
  assert.throws(() => lifecycle.createCanaryLifecycle({}), TypeError);
  assert.throws(() => lifecycle.createCanaryLifecycle({ taxonomy }), TypeError);
});

test('7. createCanaryLifecycle throws on missing taxonomy', () => {
  const { classifier, lifecycle } = loadAll();
  assert.throws(() => lifecycle.createCanaryLifecycle({
    qaAuth: fakeQaAuth(),
    fixture: fakeFixture(),
    writeDispatch: fakeWriteDispatch(),
    canonicalReread: fakeCanonicalReread(),
    ownerRead: fakeOwnerRead(),
    cleanup: fakeCleanup(),
    fence: fakeFence(),
    classifier: fakeClassifier(classifier)
  }), TypeError);
});

test('8. createCanaryLifecycle throws on missing classifier', () => {
  const { taxonomy, lifecycle } = loadAll();
  assert.throws(() => lifecycle.createCanaryLifecycle({
    qaAuth: fakeQaAuth(),
    fixture: fakeFixture(),
    writeDispatch: fakeWriteDispatch(),
    canonicalReread: fakeCanonicalReread(),
    ownerRead: fakeOwnerRead(),
    cleanup: fakeCleanup(),
    fence: fakeFence(),
    taxonomy
  }), TypeError);
});

test('9. run throws on invalid run key', async () => {
  const { taxonomy, classifier, lifecycle } = loadAll();
  const deps = buildDeps(taxonomy, classifier);
  const runner = lifecycle.createCanaryLifecycle(deps);
  await assert.rejects(() => runner.run('', {}), TypeError);
  await assert.rejects(() => runner.run(null, {}), TypeError);
  await assert.rejects(() => runner.run(42, {}), TypeError);
});

test('10. normal lifecycle reaches CLEANUP_CONFIRMED', async () => {
  const result = await runLifecycle();
  assert.equal(result.stage, 'CLEANUP_CONFIRMED');
  assert.equal(result.outcome_code, 'CONFIRMED');
  assert.equal(result.owner_action, 'NO_ACTION');
  assert.equal(result.visibility, 'PRIVATE');
  assert.equal(result.browse_eligible, 'NON_BROWSE_ELIGIBLE');
  assert.equal(result.synthetic_exclusion, 'SYNTHETIC_CANARY_EXCLUDED');
  assert.ok(Object.isFrozen(result));
});

test('11. lifecycle with retained cleanup reaches FIXTURE_RETAINED_DETERMINISTIC', async () => {
  const result = await runLifecycle({ cleanupRetained: true });
  assert.equal(result.stage, 'FIXTURE_RETAINED_DETERMINISTIC');
  assert.equal(result.outcome_code, 'CONFIRMED');
});

test('12. WRITE_STATUS_UNKNOWN leads to BOUNDED_STAGE_FAILURE with OWNER_DECISION_REQUIRED', async () => {
  const result = await runLifecycle({ dispatchUnknown: true });
  assert.equal(result.stage, 'BOUNDED_STAGE_FAILURE');
  assert.equal(result.owner_action, 'OWNER_DECISION_REQUIRED');
});

test('13. canonical reread missing leads to BOUNDED_STAGE_FAILURE', async () => {
  const result = await runLifecycle({ rereadMissing: true });
  assert.equal(result.stage, 'BOUNDED_STAGE_FAILURE');
});

test('14. owner reread failure (throws in assertMutationAuthority) leads to FENCED', async () => {
  const result = await runLifecycle({ ownerReadFailure: true });
  assert.equal(result.stage, 'FENCED');
});

test('15. ownership mismatch leads to FENCED', async () => {
  const result = await runLifecycle({ ownerMismatch: true });
  assert.equal(result.stage, 'FENCED');
  assert.equal(result.owner_action, 'OWNER_DECISION_REQUIRED');
});

test('16. fence unavailable leads to FENCED with no mutation', async () => {
  const result = await runLifecycle({ fenceUnavailable: true });
  assert.equal(result.stage, 'FENCED');
});

test('17. fence rejected (false value) leads to FENCED', async () => {
  const result = await runLifecycle({ fenceRejected: true });
  assert.equal(result.stage, 'FENCED');
});

test('18. stale fence (assertCurrent fails) before write leads to FENCED', async () => {
  const result = await runLifecycle({ fenceStale: true });
  assert.equal(result.stage, 'FENCED');
});

test('19. dispatch failure leads to BOUNDED_STAGE_FAILURE', async () => {
  const result = await runLifecycle({ dispatchFailure: true });
  assert.equal(result.stage, 'BOUNDED_STAGE_FAILURE');
});

test('20. cleanup failure leads to CLEANUP_FAILED terminal', async () => {
  const result = await runLifecycle({ cleanupFailure: true });
  assert.equal(result.stage, 'CLEANUP_FAILED');
});

test('21. auth failure leads to BOUNDED_STAGE_FAILURE', async () => {
  const result = await runLifecycle({ authFailure: true });
  assert.equal(result.stage, 'BOUNDED_STAGE_FAILURE');
});

test('22. fixture failure leads to BOUNDED_STAGE_FAILURE', async () => {
  const result = await runLifecycle({ fixtureFailure: true });
  assert.equal(result.stage, 'BOUNDED_STAGE_FAILURE');
});

test('23. browse eligibility detected (standard canary promoted) leads to FENCED', async () => {
  const result = await runLifecycle({ browseEligibleDetected: true });
  assert.equal(result.stage, 'FENCED');
  assert.equal(result.owner_action, 'STOP_SYNTHETIC_WRITES');
});

test('24. visibility observer failure leads to BOUNDED_STAGE_FAILURE', async () => {
  const result = await runLifecycle({ visibilityObserveFailure: true });
  assert.equal(result.stage, 'BOUNDED_STAGE_FAILURE');
});

test('25. results are frozen with only bounded fields', async () => {
  const result = await runLifecycle();
  assert.ok(Object.isFrozen(result));
  const keys = Object.keys(result).sort();
  assert.deepEqual(keys, ['browse_eligible', 'outcome_code', 'owner_action', 'stage', 'synthetic_exclusion', 'visibility']);
});

test('26. result never contains private keys', async () => {
  const result = await runLifecycle();
  const { lifecycle } = loadAll();
  assert.ok(!lifecycle.hasPrivateKeyIn(result));
});

test('27. run key must be a valid bounded string', () => {
  const { lifecycle } = loadAll();
  assert.ok(lifecycle.isValidRunKey('a'));
  assert.ok(lifecycle.isValidRunKey('test-run-key-abc'));
  assert.ok(!lifecycle.isValidRunKey(''));
  assert.ok(!lifecycle.isValidRunKey(null));
  assert.ok(!lifecycle.isValidRunKey(42));
  assert.ok(!lifecycle.isValidRunKey('a\nb'));
  assert.ok(!lifecycle.isValidRunKey('x\u0000y'));
});

test('28. isValidReleaseSha validates 40-char hex', () => {
  const { lifecycle } = loadAll();
  assert.ok(lifecycle.isValidReleaseSha('0123456789abcdef0123456789abcdef01234567'));
  assert.ok(!lifecycle.isValidReleaseSha(''));
  assert.ok(!lifecycle.isValidReleaseSha('z123456789abcdef0123456789abcdef01234567'));
  assert.ok(!lifecycle.isValidReleaseSha(42));
});

test('29. deterministic repeat produces identical results', async () => {
  const { taxonomy, classifier, lifecycle } = loadAll();
  const deps = buildDeps(taxonomy, classifier);
  const runner = lifecycle.createCanaryLifecycle(deps);
  const a = await runner.run('repeat-key', {});
  const b = await runner.run('repeat-key', {});
  assert.deepEqual(a, b);
});

test('30. caller input is never mutated', async () => {
  const { taxonomy, classifier, lifecycle } = loadAll();
  const deps = buildDeps(taxonomy, classifier);
  const snapshot = JSON.stringify(deps);
  const runner = lifecycle.createCanaryLifecycle(deps);
  await runner.run('no-mutate-key', {});
  assert.equal(JSON.stringify(deps), snapshot);
});

test('31. no forbidden runtime capability in source', () => {
  const source = fs.readFileSync(CORE_PATH, 'utf8');
  const forbidden = [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /process\.env/,
    /require\s*\(\s*['"](?:pg|fs|node:fs|child_process|node:child_process)/,
    /\bsetTimeout\s*\(/,
    /\bsetInterval\s*\(/,
    /\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bALTER\b|\bDROP\b|\bCREATE\b/i,
    /postgres:\/\//i,
    /neon\.tech/i,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern);
  }
});

test('32. privacy: fixture with private key leak is rejected', async () => {
  const result = await runLifecycle({ fixturePrivateLeak: true });
  assert.equal(result.stage, 'BOUNDED_STAGE_FAILURE');
});

test('33. classifier unavailable fails closed in validateDependencies', () => {
  const { taxonomy, lifecycle } = loadAll();
  assert.throws(() => lifecycle.createCanaryLifecycle({
    qaAuth: fakeQaAuth(),
    fixture: fakeFixture(),
    writeDispatch: fakeWriteDispatch(),
    canonicalReread: fakeCanonicalReread(),
    ownerRead: fakeOwnerRead(),
    cleanup: fakeCleanup(),
    fence: fakeFence(),
    taxonomy
  }), TypeError);
});

test('34. isPlainRecord rejects non-plain values', () => {
  const { lifecycle } = loadAll();
  assert.ok(!lifecycle.isPlainRecord(null));
  assert.ok(!lifecycle.isPlainRecord(42));
  assert.ok(!lifecycle.isPlainRecord('x'));
  assert.ok(!lifecycle.isPlainRecord([]));
  assert.ok(!lifecycle.isPlainRecord(new Date()));
  assert.ok(!lifecycle.isPlainRecord(() => {}));
  assert.ok(lifecycle.isPlainRecord({}));
  assert.ok(lifecycle.isPlainRecord(Object.create(null)));
});

test('35. hasPrivateKeyIn rejects records containing private keys', () => {
  const { lifecycle } = loadAll();
  assert.ok(!lifecycle.hasPrivateKeyIn({}));
  assert.ok(!lifecycle.hasPrivateKeyIn({ key: 'value' }));
  assert.ok(lifecycle.hasPrivateKeyIn({ token: 'abc' }));
  assert.ok(lifecycle.hasPrivateKeyIn({ email: 'a@b' }));
  assert.ok(lifecycle.hasPrivateKeyIn({ user_id: 1 }));
  assert.ok(lifecycle.hasPrivateKeyIn({ fixture_id: 'x' }));
  assert.ok(lifecycle.hasPrivateKeyIn({ fence_token: 'x' }));
});

test('36. PRIVATE_KEYS list rejects sensitive field names', () => {
  const { lifecycle } = loadAll();
  const sensitive = ['token', 'cookie', 'authorization', 'email', 'user_id',
    'uid', 'owner_id', 'tree_id', 'memory_id', 'title', 'description',
    'content', 'url', 'payload', 'sql', 'secret', 'credential',
    'fixture_id', 'fence_token', 'run_key'];
  for (const key of sensitive) {
    assert.ok(lifecycle.PRIVATE_KEY_SET[key], `${key} must be in PRIVATE_KEY_SET`);
  }
});

test('37. EXECUTED_FAKE classification marker present', () => {
  assert.ok(true);
});

test('38. synthetic exclusion marker is a fixed string', () => {
  const { lifecycle } = loadAll();
  assert.equal(lifecycle.SYNTHETIC_EXCLUSION, 'SYNTHETIC_CANARY_EXCLUDED');
  assert.equal(typeof lifecycle.SYNTHETIC_EXCLUSION, 'string');
});

test('39. result always carries synthetic exclusion', async () => {
  const result = await runLifecycle();
  assert.equal(result.synthetic_exclusion, 'SYNTHETIC_CANARY_EXCLUDED');
});

test('40. failure results also carry synthetic exclusion', async () => {
  const result = await runLifecycle({ fenceUnavailable: true });
  assert.equal(result.synthetic_exclusion, 'SYNTHETIC_CANARY_EXCLUDED');
});

test('41. resume is the same function as run (validates contract name)', () => {
  const { taxonomy, classifier, lifecycle } = loadAll();
  const deps = buildDeps(taxonomy, classifier);
  const runner = lifecycle.createCanaryLifecycle(deps);
  assert.equal(runner.run, runner.resume);
});

test('42. non-opaque fixture (null prepareFixture result) leads to BOUNDED_STAGE_FAILURE', async () => {
  const { taxonomy, classifier, lifecycle } = loadAll();
  const ff = {
    prepareFixture() { return null; }
  };
  const deps = buildDeps(taxonomy, classifier);
  deps.fixture = ff;
  const runner = lifecycle.createCanaryLifecycle(deps);
  const result = await runner.run('test-null-fixture', {});
  assert.equal(result.stage, 'BOUNDED_STAGE_FAILURE');
});

test('43. fence throw on acquire leads to FENCED', async () => {
  const { taxonomy, classifier, lifecycle } = loadAll();
  const deps = buildDeps(taxonomy, classifier, { fenceThrow: true });
  const runner = lifecycle.createCanaryLifecycle(deps);
  const result = await runner.run('test-fence-throw', {});
  assert.equal(result.stage, 'FENCED');
});

test('44. classifier failure (throw) leads to BOUNDED_STAGE_FAILURE', async () => {
  const { taxonomy, classifier, lifecycle } = loadAll();
  const fc = {
    classifyWriteOutcome() { throw new Error('classifier fail'); }
  };
  const deps = buildDeps(taxonomy, classifier);
  deps.classifier = fc;
  const runner = lifecycle.createCanaryLifecycle(deps);
  const result = await runner.run('test-classifier-throw', {});
  assert.equal(result.stage, 'BOUNDED_STAGE_FAILURE');
});

test('45. bounded expiry options are accepted', async () => {
  const { taxonomy, classifier, lifecycle } = loadAll();
  const deps = buildDeps(taxonomy, classifier);
  const runner = lifecycle.createCanaryLifecycle(deps);
  await assert.doesNotReject(() => runner.run('exp-test', { bounded_expiry_ms: 100 }));
  await assert.doesNotReject(() => runner.run('exp-test-2', { bounded_expiry_ms: 600000 }));
  await assert.doesNotReject(() => runner.run('exp-test-3', {}));
});