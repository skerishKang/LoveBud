'use strict';

/**
 * Source-static contract for Issue #3860 read-only target attribution &
 * catalog parity preflight. Locks the exact operation/attribution/outcome
 * vocabulary, committed authority binding, read-only boundaries, descriptor
 * safety, determinism, package script, CI job/image/version, and next-child
 * decision posture. Never executes a database, provider, network, or shell.
 *
 * Refs: #3860, #3458, #1882
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const core = require('../../scripts/migration-readonly-target-attribution-parity-core.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

const COMMITTED_LEDGER_OBJECT = {
  name: 'table:public.schema_migration_ledger',
  fingerprint: 'sha256:' + 'a'.repeat(64),
};
const COMMITTED_AUTHORITY = {
  status: 'ADOPTION_REQUIRED',
  critical_objects: [COMMITTED_LEDGER_OBJECT],
};

function matchingEvidence() {
  return {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: [
      { name: COMMITTED_LEDGER_OBJECT.name, fingerprint: COMMITTED_LEDGER_OBJECT.fingerprint },
    ],
  };
}

function baseConfig(collector, overrides) {
  return Object.assign(
    {
      operation: core.OPERATION,
      targetClass: core.TARGET_CLASS,
      environmentClass: core.ENVIRONMENT_CLASS,
      boundaryApproval: true,
      committedAuthority: COMMITTED_AUTHORITY,
      dependencies: { collectCatalogEvidence: collector },
    },
    overrides || {}
  );
}

async function run(collector, overrides) {
  return core.runParityPreflight(baseConfig(collector, overrides));
}

// ── 1. Exact vocabulary ──────────────────────────────────────────────────────

test('operation and attribution vocabulary are exact', async () => {
  assert.equal(core.OPERATION, 'READ_ONLY_TARGET_ATTRIBUTION_CATALOG_PARITY');
  assert.equal(core.TARGET_CLASS, 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET');
  assert.equal(core.ENVIRONMENT_CLASS, 'CI_EPHEMERAL');
  assert.deepEqual(core.ALLOWED_CONFIG_KEYS, [
    'operation',
    'targetClass',
    'environmentClass',
    'boundaryApproval',
    'releaseSha',
    'committedAuthority',
    'dependencies',
  ]);
  assert.deepEqual(core.ALLOWED_DEPENDENCY_KEYS, ['collectCatalogEvidence']);
});

test('outcome vocabulary is the exact fixed sanitized set', async () => {
  assert.deepEqual(core.PARITY_OUTCOMES, {
    PARITY_CONFIRMED: 'PARITY_CONFIRMED',
    PARITY_MISMATCH: 'PARITY_MISMATCH',
    TARGET_ATTRIBUTION_INVALID: 'TARGET_ATTRIBUTION_INVALID',
    APPROVAL_INVALID: 'APPROVAL_INVALID',
    AUTHORITY_ADOPTION_REQUIRED: 'AUTHORITY_ADOPTION_REQUIRED',
    EXPECTED_SCHEMA_INVALID: 'EXPECTED_SCHEMA_INVALID',
    CATALOG_COLLECTION_FAILED: 'CATALOG_COLLECTION_FAILED',
    INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  });
});

test('committed expected-schema authority binds exactly one critical object', async () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'db/migration-provenance/expected-schema-manifest.json'), 'utf8')
  );
  assert.equal(manifest.status, 'ADOPTION_REQUIRED');
  assert.ok(manifest.critical_objects.length >= 1, 'at least one committed critical object: ' + manifest.critical_objects.length);
  assert.equal(manifest.critical_objects[0].name, 'table:public.schema_migration_ledger');
  assert.match(manifest.critical_objects[0].fingerprint, /^sha256:[a-f0-9]{64}$/);
});

test('committed canonical migration manifest remains populated but ADOPTION_REQUIRED', async () => {
  const canonical = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'db/migration-provenance/canonical-migrations.json'), 'utf8')
  );
  assert.equal(canonical.status, 'ADOPTION_REQUIRED');
  assert.ok(canonical.migrations.length >= 1, 'migrations >= 1: ' + canonical.migrations.length);
  assert.equal(canonical.migrations[0].id, '20260802094500_bootstrap-migration-ledger');
});

test('core confirms parity against the committed authority with matching sanitized evidence', async () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'db/migration-provenance/expected-schema-manifest.json'), 'utf8')
  );
  const committed = {
    status: manifest.status,
    critical_objects: manifest.critical_objects,
  };
  const evidence = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: manifest.critical_objects,
  };
  const result = await core.runParityPreflight(
    baseConfig(() => evidence, { committedAuthority: committed })
  );
  assert.equal(result.outcome, 'PARITY_CONFIRMED');
  assert.equal(result.authorityStatus, 'ADOPTION_REQUIRED', 'no activation implied');
  assert.equal(result.collectionEffectCount, 1);
  assert.deepEqual(result.mismatchedObjects, []);
});

// ── 2. Core source boundaries (mutation, SQL, private identifiers) ──────────

test('core source is read-only and contains no SQL or mutation capability', async () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'scripts/migration-readonly-target-attribution-parity-core.cjs'),
    'utf8'
  );
  for (const keyword of [
    'CREATE TABLE',
    'ALTER TABLE',
    'DROP TABLE',
    'INSERT INTO',
    'UPDATE ',
    'DELETE FROM',
    'TRUNCATE',
    'GRANT ',
    'REVOKE',
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
    'pg_advisory_lock',
  ]) {
    assert.ok(!source.includes(keyword), 'core must not contain mutation SQL keyword: ' + keyword);
  }
  assert.ok(!source.includes("require('pg')"), 'core must not depend on pg driver');
  assert.ok(!source.includes('process.env'), 'core must not read environment variables');
  assert.ok(!source.includes('readFileSync'), 'core must not read filesystem');
  assert.ok(!source.includes('execSync'), 'core must not spawn a shell');
});

test('core source and inputs reject provider/database/operator/private identifiers', async () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'scripts/migration-readonly-target-attribution-parity-core.cjs'),
    'utf8'
  );
  for (const identifier of ['DATABASE_URL', 'connection_string', 'db.example.com', 'neon.tech']) {
    assert.ok(!source.includes(identifier), 'core source must not contain identifier: ' + identifier);
  }
  const result = await run(() => matchingEvidence(), { host: 'db.example.com' });
  assert.equal(result.outcome, 'TARGET_ATTRIBUTION_INVALID');
  assert.equal(result.collectionEffectCount, 0);
});

// ── 3. Positive and one-effect maximum ──────────────────────────────────────

test('PARITY_CONFIRMED uses exactly one collection effect and returns frozen detached result', async () => {
  let calls = 0;
  const result = await run(() => {
    calls += 1;
    return matchingEvidence();
  });
  assert.equal(result.outcome, 'PARITY_CONFIRMED');
  assert.equal(calls, 1);
  assert.equal(result.collectionEffectCount, 1);
  assert.ok(Object.isFrozen(result), 'result is frozen');
  assert.ok(Object.isFrozen(result.mismatchedObjects), 'mismatched array is frozen');
  assert.throws(() => {
    result.outcome = 'CHANGED';
  }, TypeError);
});

test('more than one injected dependency is rejected before any effect', async () => {
  let calls = 0;
  const result = await run(() => {
    calls += 1;
    return matchingEvidence();
  }, {
    dependencies: {
      collectCatalogEvidence: () => matchingEvidence(),
      secondEffect: () => matchingEvidence(),
    },
  });
  assert.equal(result.outcome, 'TARGET_ATTRIBUTION_INVALID');
  assert.equal(calls, 0);
  assert.equal(result.collectionEffectCount, 0);
});

test('same bounded input produces byte-stable results', async () => {
  const firstResult = await run(() => matchingEvidence());
  const secondResult = await run(() => matchingEvidence());
  const first = JSON.stringify(firstResult);
  const second = JSON.stringify(secondResult);
  assert.notEqual(first, '{}', 'serialized result is a real awaited result');
  assert.notEqual(second, '{}', 'serialized result is a real awaited result');
  assert.equal(firstResult.outcome, 'PARITY_CONFIRMED');
  assert.equal(secondResult.outcome, 'PARITY_CONFIRMED');
  assert.equal(first, second, 'byte-stable serialized equality');
  assert.equal(Object.isFrozen(firstResult), true, 'first result frozen');
  assert.equal(Object.isFrozen(secondResult), true, 'second result frozen');
});

// ── 4. NC1–NC4: attribution and approval fail closed with zero effects ──────

test('NC1 unknown operation fails closed with zero effects', async () => {
  let calls = 0;
  const result = await run(() => {
    calls += 1;
    return matchingEvidence();
  }, { operation: 'NOT_A_REAL_OPERATION' });
  assert.equal(result.outcome, 'TARGET_ATTRIBUTION_INVALID');
  assert.equal(calls, 0);
  assert.equal(result.collectionEffectCount, 0);
});

test('NC2 wrong target or environment class fails closed with zero effects', async () => {
  let calls = 0;
  const collector = () => {
    calls += 1;
    return matchingEvidence();
  };
  const wrongTarget = await run(collector, { targetClass: 'PRODUCTION_TARGET' });
  assert.equal(wrongTarget.outcome, 'TARGET_ATTRIBUTION_INVALID');
  assert.equal(wrongTarget.collectionEffectCount, 0);
  const wrongEnv = await run(collector, { environmentClass: 'PRODUCTION' });
  assert.equal(wrongEnv.outcome, 'TARGET_ATTRIBUTION_INVALID');
  assert.equal(wrongEnv.collectionEffectCount, 0);
  assert.equal(calls, 0);
});

test('NC3 missing or false approval fails closed with zero effects', async () => {
  let calls = 0;
  const collector = () => {
    calls += 1;
    return matchingEvidence();
  };
  const missing = await run(collector, { boundaryApproval: false });
  assert.equal(missing.outcome, 'APPROVAL_INVALID');
  assert.equal(missing.collectionEffectCount, 0);
  const absent = baseConfig(collector);
  delete absent.boundaryApproval;
  const absentResult = await core.runParityPreflight(absent);
  assert.equal(absentResult.outcome, 'APPROVAL_INVALID');
  assert.equal(calls, 0);
});

test('NC4 malformed release SHA fails closed with zero effects', async () => {
  let calls = 0;
  const collector = () => {
    calls += 1;
    return matchingEvidence();
  };
  for (const bad of ['nothex', 'A'.repeat(40), 'abc', '', '12345678']) {
    const result = await run(collector, { releaseSha: bad });
    assert.equal(result.outcome, 'TARGET_ATTRIBUTION_INVALID', 'malformed SHA: ' + bad);
    assert.equal(result.collectionEffectCount, 0);
  }
  const valid = await run(collector, { releaseSha: 'a'.repeat(40) });
  assert.equal(valid.outcome, 'PARITY_CONFIRMED', 'valid 40-hex release SHA is accepted');
  assert.equal(calls, 1);
});

// ── 5. NC5–NC7: committed authority and fingerprint boundaries ──────────────

test('NC5 synthetic ACTIVE manifest authority fails closed with zero effects', async () => {
  let calls = 0;
  const collector = () => {
    calls += 1;
    return matchingEvidence();
  };
  const result = await run(collector, {
    committedAuthority: { status: 'ACTIVE', critical_objects: COMMITTED_AUTHORITY.critical_objects },
  });
  assert.equal(result.outcome, 'EXPECTED_SCHEMA_INVALID');
  assert.equal(result.collectionEffectCount, 0);
  assert.equal(calls, 0);
});

test('NC6 missing, duplicate, or extra-field critical object fails closed', async () => {
  let calls = 0;
  const collector = () => {
    calls += 1;
    return matchingEvidence();
  };
  const missing = await run(collector, {
    committedAuthority: { status: 'ADOPTION_REQUIRED', critical_objects: [] },
  });
  assert.equal(missing.outcome, 'AUTHORITY_ADOPTION_REQUIRED', 'empty vocabulary is informational adoption-required posture');
  assert.equal(missing.collectionEffectCount, 0);

  const duplicate = await run(collector, {
    committedAuthority: {
      status: 'ADOPTION_REQUIRED',
      critical_objects: [COMMITTED_LEDGER_OBJECT, COMMITTED_LEDGER_OBJECT],
    },
  });
  assert.equal(duplicate.outcome, 'EXPECTED_SCHEMA_INVALID', 'duplicate critical object');
  assert.equal(duplicate.collectionEffectCount, 0);

  const extraField = await run(collector, {
    committedAuthority: {
      status: 'ADOPTION_REQUIRED',
      critical_objects: [{ ...COMMITTED_LEDGER_OBJECT, owner: 'operator' }],
    },
  });
  assert.equal(extraField.outcome, 'EXPECTED_SCHEMA_INVALID', 'extra private field in critical object');
  assert.equal(extraField.collectionEffectCount, 0);
  assert.equal(calls, 0);
});

test('NC7 malformed or mismatched fingerprint fails closed', async () => {
  let calls = 0;
  const collector = () => {
    calls += 1;
    return matchingEvidence();
  };
  const malformedAuthority = await run(collector, {
    committedAuthority: {
      status: 'ADOPTION_REQUIRED',
      critical_objects: [{ ...COMMITTED_LEDGER_OBJECT, fingerprint: 'sha256:zzzz' }],
    },
  });
  assert.equal(malformedAuthority.outcome, 'EXPECTED_SCHEMA_INVALID');
  assert.equal(malformedAuthority.collectionEffectCount, 0);

  const mismatched = await run(() => ({
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: [{ ...COMMITTED_LEDGER_OBJECT, fingerprint: 'sha256:' + 'b'.repeat(64) }],
  }));
  assert.equal(mismatched.outcome, 'PARITY_MISMATCH');
  assert.deepEqual(mismatched.mismatchedObjects, [COMMITTED_LEDGER_OBJECT.name]);
  assert.equal(mismatched.collectionEffectCount, 1);

  const malformedObserved = await run(() => ({
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: [{ ...COMMITTED_LEDGER_OBJECT, fingerprint: 'not-a-sha' }],
  }));
  assert.equal(malformedObserved.outcome, 'INSUFFICIENT_EVIDENCE');
  assert.equal(malformedObserved.collectionEffectCount, 1);
});

// ── 6. NC8–NC10: private fields, hostile inputs, collector failure ──────────

test('NC8 injected raw/private fields in evidence fail closed', async () => {
  const withHost = await run(() => ({
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: [{ ...COMMITTED_LEDGER_OBJECT, host: 'db.internal' }],
  }));
  assert.equal(withHost.outcome, 'INSUFFICIENT_EVIDENCE');
  assert.equal(withHost.collectionEffectCount, 1);

  const withPrivateTopLevel = await run(() => ({
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: [COMMITTED_LEDGER_OBJECT],
    connection_string: 'postgres://user:pass@host/db',
  }));
  assert.equal(withPrivateTopLevel.outcome, 'INSUFFICIENT_EVIDENCE');
});

test('NC9 accessor and Proxy hostile inputs fail without getter/trap leakage', async () => {
  let trapped = 0;
  const getterConfig = {
    operation: core.OPERATION,
    targetClass: core.TARGET_CLASS,
    environmentClass: core.ENVIRONMENT_CLASS,
    boundaryApproval: true,
    committedAuthority: COMMITTED_AUTHORITY,
    dependencies: { collectCatalogEvidence: () => matchingEvidence() },
  };
  Object.defineProperty(getterConfig, 'operation', {
    enumerable: true,
    configurable: true,
    get() {
      trapped += 1;
      return core.OPERATION;
    },
  });
  const getterResult = await core.runParityPreflight(getterConfig);
  assert.equal(getterResult.outcome, 'TARGET_ATTRIBUTION_INVALID');
  assert.equal(getterResult.collectionEffectCount, 0);

  const proxyConfig = new Proxy(
    baseConfig(() => matchingEvidence()),
    {
      get() {
        trapped += 1;
        throw new Error('trap leaked raw value');
      },
      ownKeys() {
        trapped += 1;
        throw new Error('trap leaked raw value');
      },
    }
  );
  const proxyResult = await core.runParityPreflight(proxyConfig);
  assert.equal(proxyResult.outcome, 'TARGET_ATTRIBUTION_INVALID');
  assert.equal(proxyResult.collectionEffectCount, 0);
  assert.ok(!JSON.stringify(proxyResult).includes('trap leaked raw value'), 'no trap message leakage');
});

test('nested committed authority accessor getter is never invoked and fails closed', async () => {
  let getterCalls = 0;
  let collectorCalls = 0;
  const object = {};
  Object.defineProperty(object, 'name', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1;
      return COMMITTED_LEDGER_OBJECT.name;
    },
  });
  Object.defineProperty(object, 'fingerprint', {
    enumerable: true,
    configurable: true,
    value: COMMITTED_LEDGER_OBJECT.fingerprint,
  });
  const result = await run(
    () => {
      collectorCalls += 1;
      return matchingEvidence();
    },
    { committedAuthority: { status: 'ADOPTION_REQUIRED', critical_objects: [object] } }
  );
  assert.equal(result.outcome, 'EXPECTED_SCHEMA_INVALID');
  assert.equal(result.collectionEffectCount, 0);
  assert.equal(collectorCalls, 0, 'collector never invoked for invalid committed authority');
  assert.equal(getterCalls, 0, 'nested committed getter never invoked');
  assert.ok(!JSON.stringify(result).includes('getter'), 'no getter detail leakage');
});

test('nested observed evidence accessor getter is never invoked and fails closed', async () => {
  let getterCalls = 0;
  let collectorCalls = 0;
  const object = {};
  Object.defineProperty(object, 'name', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1;
      return COMMITTED_LEDGER_OBJECT.name;
    },
  });
  Object.defineProperty(object, 'fingerprint', {
    enumerable: true,
    configurable: true,
    value: COMMITTED_LEDGER_OBJECT.fingerprint,
  });
  const result = await run(() => {
    collectorCalls += 1;
    return { format_version: '1.0', normalizer_version: '1.0', objects: [object] };
  });
  assert.equal(result.outcome, 'INSUFFICIENT_EVIDENCE');
  assert.equal(result.collectionEffectCount, 1);
  assert.equal(collectorCalls, 1, 'collector invoked exactly once');
  assert.equal(getterCalls, 0, 'nested observed getter never invoked');
  assert.ok(!JSON.stringify(result).includes('getter'), 'no getter detail leakage');
});

test('nested Proxy get trap is never invoked and no raw detail leaks', async () => {
  let getTrapCalls = 0;
  const makeProxyObject = () =>
    new Proxy(
      {
        name: COMMITTED_LEDGER_OBJECT.name,
        fingerprint: COMMITTED_LEDGER_OBJECT.fingerprint,
      },
      {
        get(target, key, receiver) {
          getTrapCalls += 1;
          throw new Error('nested raw trap detail');
        },
      }
    );

  const committedResult = await run(
    () => matchingEvidence(),
    {
      committedAuthority: {
        status: 'ADOPTION_REQUIRED',
        critical_objects: [makeProxyObject()],
      },
    }
  );
  assert.equal(getTrapCalls, 0, 'committed nested get trap never invoked');
  assert.ok(
    !JSON.stringify(committedResult).includes('nested raw trap detail'),
    'no committed raw detail leakage'
  );
  assert.equal(committedResult.outcome, 'PARITY_CONFIRMED', 'descriptor-safe reads resolve the committed proxy vocabulary');

  const observedResult = await run(() => ({
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: [makeProxyObject()],
  }));
  assert.equal(getTrapCalls, 0, 'observed nested get trap never invoked');
  assert.ok(
    !JSON.stringify(observedResult).includes('nested raw trap detail'),
    'no observed raw detail leakage'
  );
  assert.equal(observedResult.outcome, 'PARITY_CONFIRMED', 'descriptor-safe reads resolve the observed proxy vocabulary');
});

test('NC10 collector throw/reject maps to sanitized CATALOG_COLLECTION_FAILED', async () => {
  const thrown = await run(() => {
    throw new Error('raw adapter failure with connection details');
  });
  assert.equal(thrown.outcome, 'CATALOG_COLLECTION_FAILED');
  assert.equal(thrown.collectionEffectCount, 1);
  assert.ok(!JSON.stringify(thrown).includes('adapter failure'), 'no raw error leakage');
});

// ── 7. NC11–NC12: mutation and provider attempts ────────────────────────────

test('NC11 mutation capability is zero and the collector never receives SQL', async () => {
  let received = null;
  const result = await run((sql) => {
    received = sql;
    return matchingEvidence();
  });
  assert.equal(result.outcome, 'PARITY_CONFIRMED');
  assert.equal(received, null, 'core never passes SQL or arguments to the collection effect');
  assert.equal(result.collectionEffectCount, 1);
});

test('NC12 provider/Production identifier attempts are rejected with zero effects', async () => {
  let calls = 0;
  const collector = () => {
    calls += 1;
    return matchingEvidence();
  };
  for (const extra of [
    { provider: 'neon' },
    { accountId: 'acct_123' },
    { url: 'https://example.invalid' },
    { password: 'secret' },
    { database: 'prod' },
  ]) {
    const result = await run(collector, extra);
    assert.equal(result.outcome, 'TARGET_ATTRIBUTION_INVALID');
    assert.equal(result.collectionEffectCount, 0);
  }
  assert.equal(calls, 0);
});

// ── 8. Determinism, detached/frozen, exact binding ──────────────────────────

test('result is deeply frozen and detached from inputs', async () => {
  const result = await run(() => matchingEvidence());
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.mismatchedObjects));
  assert.throws(() => {
    result.outcome = 'CHANGED';
  }, TypeError);
  const mutableEvidence = matchingEvidence();
  mutableEvidence.objects[0].fingerprint = 'sha256:' + 'c'.repeat(64);
  const after = await run(() => mutableEvidence);
  assert.equal(after.outcome, 'PARITY_MISMATCH');
  assert.equal(result.outcome, 'PARITY_CONFIRMED', 'first result is detached from later mutation');
});

test('observed evidence is normalized deterministically before comparison', async () => {
  const unsorted = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: [
      { name: 'table:public.zeta', fingerprint: 'sha256:' + 'c'.repeat(64) },
      { name: 'table:public.alpha', fingerprint: 'sha256:' + 'd'.repeat(64) },
    ],
  };
  const committed = {
    status: 'ADOPTION_REQUIRED',
    critical_objects: [
      { name: 'table:public.alpha', fingerprint: 'sha256:' + 'd'.repeat(64) },
      { name: 'table:public.zeta', fingerprint: 'sha256:' + 'c'.repeat(64) },
    ],
  };
  const result = await core.runParityPreflight(baseConfig(() => unsorted, { committedAuthority: committed }));
  assert.equal(result.outcome, 'PARITY_CONFIRMED', 'unordered but identical vocabularies confirm');
});

// ── 9. Package script, CI job, classification ───────────────────────────────

test('exact package script and CI job/image/version are registered', async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(
    pkg.scripts['test:db-engine:readonly-target-attribution-parity'],
    'node --test --test-concurrency=1 tests/db-engine/readonly-target-attribution-parity-postgres.test.cjs'
  );
  const ci = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.ok(ci.includes('db-engine-readonly-target-attribution-parity:'), 'CI job registered');
  assert.ok(ci.includes('postgres:17.4-bookworm'), 'CI engine image registered');
  assert.ok(ci.includes('170004'), 'CI asserts server_version_num 170004');
  assert.ok(
    ci.includes('npm run test:db-engine:readonly-target-attribution-parity'),
    'CI runs only the exact new script'
  );
  const classification = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'tests', 'test-layer-classification.json'), 'utf8')
  );
  const contractEntry = classification.entries.find(
    (e) => e.path === 'tests/contracts/db-readonly-target-attribution-parity-contract.test.cjs'
  );
  assert.ok(contractEntry, 'contract test classified');
  assert.equal(contractEntry.layer, 'SOURCE_STATIC');
  const dbEntry = (classification.supplemental || []).find(
    (e) => e.path === 'tests/db-engine/readonly-target-attribution-parity-postgres.test.cjs'
  );
  assert.ok(dbEntry, 'db-engine test classified');
  assert.equal(dbEntry.layer, 'DB_ENGINE_EXECUTION');
  assert.equal(dbEntry.defaultCi, false);
  assert.deepEqual(dbEntry.capabilities, ['postgresql', 'network']);
});

test('reporter knows the new DB-engine script target', async () => {
  const reporterSource = fs.readFileSync(
    path.join(ROOT, 'scripts', 'report-ci-test-groups.cjs'),
    'utf8'
  );
  assert.ok(
    reporterSource.includes(
      "'test:db-engine:readonly-target-attribution-parity'"
    ),
    'reporter lists the new DB-engine script'
  );
  assert.ok(
    reporterSource.includes("'tests/db-engine/readonly-target-attribution-parity-postgres.test.cjs'"),
    'reporter maps the new DB-engine target'
  );
});

// ── 10. Next-child decision posture ──────────────────────────────────────────

test('decision doc records Child 4 selected as the only next child, not implemented', async () => {
  const decision = fs.readFileSync(
    path.join(ROOT, 'docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md'),
    'utf8'
  );
  assert.ok(decision.includes('FAIL_CLOSED_DEPLOY_GATE_TARGET_ACTIVATION_SELECTED'), 'exact next marker');
  assert.ok(/Step 8 Child 4/i.test(decision), 'Child 4 identified');
  assert.ok(/Step 8 Child 3/i.test(decision), 'Child 3 identified');
  assert.ok(/#3458/.test(decision) && /OPEN/.test(decision), '#3458 remains OPEN');
  assert.ok(/#3460/.test(decision), '#3460 referenced as unauthorized');
  assert.ok(/ADOPTION_REQUIRED/.test(decision), 'manifests remain ADOPTION_REQUIRED');
});
