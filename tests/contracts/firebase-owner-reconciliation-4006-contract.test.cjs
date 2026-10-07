'use strict';

// Issue #4572 - Read-only Firebase owner reconciliation harness contract.
// Evidence layer: EXECUTED_FAKE.
//
// Exercises scripts/run-production-readonly-firebase-owner-reconciliation.cjs
// with injected fake Firebase Admin Auth and fake DB clients only. The live
// path (Firebase listUsers / Neon read-only session) is never executed here:
// LIVE_FIREBASE_AUTH_CALL_COUNT = 0, LIVE_DB_CONNECTION_COUNT = 0,
// LIVE_SQL_COUNT = 0. No identifiers, credentials, or raw rows may leave the
// fixture layer.
//
// Refs #4572 #4006 #4004 #4005 - Keep OPEN.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const RUNNER_PATH = path.join(ROOT, 'scripts', 'run-production-readonly-firebase-owner-reconciliation.cjs');
const BOUNDARY_PATH = path.join(ROOT, 'workers', 'love-platform-api', 'authenticated-principal.js');
const NEON_VERIFIER_PATH = path.join(ROOT, 'workers', 'love-platform-api', 'neon-auth-token-verifier.js');
const RESOLVER_PATH = path.join(ROOT, 'workers', 'love-platform-api', 'authenticated-account-resolution.js');
const NEON_LOOKUP_PATH = path.join(ROOT, 'workers', 'love-platform-api', 'authenticated-account-neon-lookup.js');
const SHARED_DIR = path.join(ROOT, 'functions', '_shared');
const API_DIR = path.join(ROOT, 'functions', 'api');
const MODAL_DIR = path.join(ROOT, 'modal_compute');
const RUNNER_BASENAME = 'run-production-readonly-firebase-owner-reconciliation';

const runner = require(RUNNER_PATH);

const HEAD = 'fc8288a6110c5880663bd9b59b35682faaa60a27';
const DB_URL = 'postgresql://read_user:secret@ep-synthetic-4572.us-east-1.aws.neon.tech/neondb?sslmode=require';

const FIXTURE_USERS = Object.freeze(['user-1', 'user-2', 'user-3', 'user-4', 'user-5']);
const FIXTURE_OWNERS = Object.freeze(['user-1', 'user-2', 'user-3', 'owner-x', 'owner-y']);
const FIXTURE_RAW_IDENTIFIERS = [...FIXTURE_USERS, ...FIXTURE_OWNERS, 'extra-uid-4572'];

const WRITE_VERB_PATTERN = /\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i;

function fbUser(uid, { disabled = false, providers = ['password'] } = {}) {
  return {
    uid,
    disabled,
    providerData: providers.map((providerId) => ({ providerId, uid, providerSpecific: 'ignored' })),
    email: uid + '@synthetic.invalid',
    displayName: 'fixture-display-name'
  };
}

function makeFakeFirebase({ pages = [], fail = false } = {}) {
  const state = { listUsersCalls: [] };
  const auth = {
    async listUsers(maxResults, pageToken) {
      state.listUsersCalls.push({ maxResults, pageToken });
      if (fail) throw new Error('raw firebase failure mentioning ' + FIXTURE_RAW_IDENTIFIERS[0]);
      const index = state.listUsersCalls.length - 1;
      return pages[index] !== undefined ? pages[index] : { users: [], pageToken: undefined };
    }
  };
  return { auth, state };
}

function makeFakeDb({
  users = FIXTURE_USERS,
  owners = FIXTURE_OWNERS,
  mapping = { appAccountCount: 0, appAuthIdentityCount: 0, usersWithAccountIdCount: 0 },
  transactionReadOnly = 'on',
  failConnect = false,
  failOnUsersSelect = false
} = {}) {
  const state = { statements: [] };
  const client = {
    async connect() {
      state.statements.push({ type: 'connect' });
      if (failConnect) throw new Error('raw connect failure for ' + DB_URL);
    },
    async query(text) {
      state.statements.push({ type: 'query', text });
      if (text === runner.SESSION_STATEMENTS.BEGIN_READ_ONLY) return { rows: [] };
      if (text === runner.SESSION_STATEMENTS.SHOW_TRANSACTION_READ_ONLY) {
        return { rows: [{ transaction_read_only: transactionReadOnly }] };
      }
      if (text === runner.SESSION_STATEMENTS.ROLLBACK) return { rows: [] };
      if (text === runner.DB_READ_CATALOG.users) {
        if (failOnUsersSelect) throw new Error('raw select failure for table users');
        return { rows: users.map((user_id) => ({ user_id })) };
      }
      if ([runner.DB_READ_CATALOG.ownersTrees, runner.DB_READ_CATALOG.ownersComments,
        runner.DB_READ_CATALOG.ownersReactions, runner.DB_READ_CATALOG.ownersTreeComments,
        runner.DB_READ_CATALOG.ownersTreeLikes].includes(text)) {
        return { rows: owners.map((owner_id) => ({ owner_id })) };
      }
      if (text === runner.DB_READ_CATALOG.mappingAppAccountCount) return { rows: [{ count: mapping.appAccountCount }] };
      if (text === runner.DB_READ_CATALOG.mappingAppAuthIdentityCount) return { rows: [{ count: mapping.appAuthIdentityCount }] };
      if (text === runner.DB_READ_CATALOG.mappingUsersAccountIdCount) return { rows: [{ count: mapping.usersWithAccountIdCount }] };
      throw new Error('unexpected query in fake client');
    },
    async end() {
      state.statements.push({ type: 'end' });
    }
  };
  return { client, state };
}

function validEnv(overrides = {}) {
  return {
    FIREBASE_OWNER_RECONCILIATION_APPROVAL: runner.APPROVAL_TOKEN,
    FIREBASE_OWNER_RECONCILIATION_EXPECTED_HEAD: HEAD,
    FIREBASE_PROJECT_ID: 'relovetree',
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'relovetree', private_key: 'synthetic-not-a-real-key' }),
    LOVE_PLATFORM_DATABASE_URL: DB_URL,
    ...overrides
  };
}

function makeDeps({ firebase, db, head = HEAD, headCalls } = {}) {
  return {
    getCurrentHead: async () => {
      if (headCalls) headCalls.count += 1;
      return head;
    },
    createFirebaseAuth: async () => {
      if (!firebase) throw new Error('firebase not injected');
      return firebase.auth;
    },
    createDbClient: async () => {
      if (!db) throw new Error('db not injected');
      return db.client;
    }
  };
}

function statementsAfter(database, marker) {
  const index = database.state.statements.findIndex((entry) => entry.type === 'query' && entry.text === marker);
  return index === -1 ? [] : database.state.statements.slice(index + 1);
}

test('1. default invocation is PREEXECUTION_STOP with zero external calls', async () => {
  const result = await runner.runReconciliation({ argv: [], env: {}, dependencies: {} });
  assert.equal(result.disposition, 'PREEXECUTION_STOP');
  assert.equal(result.counters.firebaseInitializationAttemptedCount, 0);
  assert.equal(result.counters.dbConnectionAttemptedCount, 0);
  assert.equal(result.counters.firebaseListUsersCallCount, 0);
  assert.equal(result.counters.privateMappingWritten, 'NO');
  assert.equal(result.counters.outputFileWritten, 'NO');
});

test('2. the execute flag without the source-bound approval is PREEXECUTION_STOP', async () => {
  const headCalls = { count: 0 };
  for (const approval of [undefined, '', 'APPROVED_SOMETHING_ELSE']) {
    const result = await runner.runReconciliation({
      argv: [runner.EXECUTE_FLAG],
      env: validEnv({ FIREBASE_OWNER_RECONCILIATION_APPROVAL: approval }),
      dependencies: makeDeps({ headCalls })
    });
    assert.equal(result.disposition, 'PREEXECUTION_STOP', String(approval));
  }
  assert.equal(headCalls.count, 0, 'approval gate precedes the HEAD gate');
  assert.equal(runner.APPROVAL_TOKEN, 'APPROVED_4006_4572_PRODUCTION_READONLY_FIREBASE_OWNER_RECONCILIATION');
});

test('3. expected HEAD mismatch is PREEXECUTION_STOP before any initialization', async () => {
  const firebase = makeFakeFirebase({ pages: [] });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv({ FIREBASE_OWNER_RECONCILIATION_EXPECTED_HEAD: '0000000000000000000000000000000000000000' }),
    dependencies: makeDeps({ firebase })
  });
  assert.equal(result.disposition, 'PREEXECUTION_STOP');
  assert.equal(firebase.state.listUsersCalls.length, 0);
  assert.equal(result.counters.firebaseInitializationAttemptedCount, 0);
});

test('4. service-account project mismatch stops before listUsers', async () => {
  const firebase = makeFakeFirebase({ pages: [] });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'some-other-project' }) }),
    dependencies: makeDeps({ firebase })
  });
  assert.equal(result.disposition, 'PREEXECUTION_STOP');
  assert.equal(firebase.state.listUsersCalls.length, 0);
  assert.equal(result.counters.firebaseInitializationAttemptedCount, 0);
});

test('4b. non-product FIREBASE_PROJECT_ID or invalid DB URL stops pre-execution', async () => {
  const firebase = makeFakeFirebase({ pages: [] });
  const wrongProject = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv({ FIREBASE_PROJECT_ID: 'attacker-project' }),
    dependencies: makeDeps({ firebase })
  });
  assert.equal(wrongProject.disposition, 'PREEXECUTION_STOP');
  const wrongDb = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv({ LOVE_PLATFORM_DATABASE_URL: 'postgresql://read:secret@db.example.com/neondb' }),
    dependencies: makeDeps({ firebase })
  });
  assert.equal(wrongDb.disposition, 'PREEXECUTION_STOP');
  assert.equal(wrongDb.counters.dbConnectionAttemptedCount, 0);
  assert.equal(firebase.state.listUsersCalls.length, 0);
});

test('5. listUsers pagination aggregates bounded pages', async () => {
  const firebase = makeFakeFirebase({
    pages: [
      { users: [fbUser('page1-a'), fbUser('page1-b')], pageToken: 'token-1' },
      { users: [fbUser('page2-a')], pageToken: undefined }
    ]
  });
  const db = makeFakeDb();
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db })
  });
  assert.equal(firebase.state.listUsersCalls.length, 2);
  assert.deepEqual(firebase.state.listUsersCalls[0], { maxResults: runner.FIREBASE_PAGE_SIZE, pageToken: undefined });
  assert.deepEqual(firebase.state.listUsersCalls[1], { maxResults: runner.FIREBASE_PAGE_SIZE, pageToken: 'token-1' });
  assert.equal(result.aggregates.firebaseAggregates.firebaseTotalUserCount, 3);
  assert.equal(result.counters.firebaseUserRecordCount, 3);
});

test('6. enabled and disabled users are aggregated', async () => {
  const firebase = makeFakeFirebase({
    pages: [{ users: [fbUser('en-1'), fbUser('en-2'), fbUser('dis-1', { disabled: true })], pageToken: undefined }]
  });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db: makeFakeDb() })
  });
  assert.equal(result.aggregates.firebaseAggregates.firebaseEnabledUserCount, 2);
  assert.equal(result.aggregates.firebaseAggregates.firebaseDisabledUserCount, 1);
});

test('7. providerData providerId values are aggregated by count only', async () => {
  const firebase = makeFakeFirebase({
    pages: [{
      users: [
        fbUser('p-1', { providers: ['password'] }),
        fbUser('p-2', { providers: ['password', 'google.com'] }),
        fbUser('p-3', { providers: ['google.com'] })
      ],
      pageToken: undefined
    }]
  });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db: makeFakeDb() })
  });
  assert.deepEqual(result.providerAggregates, { 'google.com': 2, password: 2 });
  assert.ok(Object.isFrozen(result.providerAggregates));
});

test('8. users without providerData are aggregated', async () => {
  const firebase = makeFakeFirebase({
    pages: [{ users: [fbUser('zp-1', { providers: [] }), fbUser('zp-2')], pageToken: undefined }]
  });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db: makeFakeDb() })
  });
  assert.equal(result.aggregates.firebaseAggregates.firebaseZeroProviderDataUserCount, 1);
});

test('9. the Firebase page bound fails closed', async () => {
  const pages = [];
  for (let index = 0; index < runner.FIREBASE_MAX_PAGE_COUNT + 5; index += 1) {
    pages.push({ users: [fbUser('bounded-' + index)], pageToken: 'token-' + index });
  }
  const firebase = makeFakeFirebase({ pages });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db: makeFakeDb() })
  });
  assert.equal(result.disposition, 'FIREBASE_INVENTORY_UNAVAILABLE');
  assert.equal(firebase.state.listUsersCalls.length, runner.FIREBASE_MAX_PAGE_COUNT);
});

test('10. the Firebase user bound fails closed', async () => {
  const many = [];
  for (let index = 0; index < runner.FIREBASE_MAX_USER_COUNT + 1; index += 1) {
    many.push(fbUser('bulk-' + index));
  }
  const firebase = makeFakeFirebase({ pages: [{ users: many, pageToken: undefined }] });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db: makeFakeDb() })
  });
  assert.equal(result.disposition, 'FIREBASE_INVENTORY_UNAVAILABLE');
});

test('11. a repeated page token fails closed', async () => {
  const firebase = makeFakeFirebase({
    pages: [
      { users: [fbUser('loop-1')], pageToken: 'repeat-token' },
      { users: [fbUser('loop-2')], pageToken: 'repeat-token' }
    ]
  });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db: makeFakeDb() })
  });
  assert.equal(result.disposition, 'FIREBASE_INVENTORY_UNAVAILABLE');
  assert.equal(firebase.state.listUsersCalls.length, 2, 'loop detected without unbounded calls');
});

test('12. malformed Firebase pages and records fail closed; duplicates are ambiguous', async () => {
  const malformedPages = [
    null,
    { users: 'not-an-array' },
    { users: [{ disabled: false }], pageToken: undefined },
    { users: [{ uid: ' padded ', disabled: false }], pageToken: undefined }
  ];
  for (const page of malformedPages) {
    const firebase = makeFakeFirebase({ pages: [page] });
    const result = await runner.runReconciliation({
      argv: [runner.EXECUTE_FLAG],
      env: validEnv(),
      dependencies: makeDeps({ firebase, db: makeFakeDb() })
    });
    assert.equal(result.disposition, 'FIREBASE_INVENTORY_UNAVAILABLE', JSON.stringify(page));
  }
  const duplicate = makeFakeFirebase({
    pages: [
      { users: [fbUser('dup-uid')], pageToken: 'next' },
      { users: [fbUser('dup-uid')], pageToken: undefined }
    ]
  });
  const duplicateResult = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase: duplicate, db: makeFakeDb() })
  });
  assert.equal(duplicateResult.disposition, 'INVENTORY_AMBIGUOUS_STOP');
});

test('13. Firebase exceptions are sanitized with zero retries', async () => {
  const firebase = makeFakeFirebase({ fail: true });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db: makeFakeDb() })
  });
  assert.equal(result.disposition, 'FIREBASE_INVENTORY_UNAVAILABLE');
  assert.equal(firebase.state.listUsersCalls.length, 1, 'no retry');
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('raw firebase failure'));
  assert.ok(!serialized.includes(FIXTURE_RAW_IDENTIFIERS[0]), 'no identifier may leak into the result');
  assert.equal(runner.FIREBASE_RETRY_MAX, 0);
});

test('14. the DB session begins with BEGIN READ ONLY before any catalog read', async () => {
  const firebase = makeFakeFirebase({ pages: [{ users: [fbUser('begin-1')], pageToken: undefined }] });
  const db = makeFakeDb();
  await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db })
  });
  const texts = db.state.statements.filter((entry) => entry.type === 'query').map((entry) => entry.text);
  assert.equal(texts[0], runner.SESSION_STATEMENTS.BEGIN_READ_ONLY);
  assert.equal(texts[1], runner.SESSION_STATEMENTS.SHOW_TRANSACTION_READ_ONLY);
  assert.ok(texts.indexOf(runner.DB_READ_CATALOG.users) > 1, 'catalog reads follow the read-only verification');
  assert.equal(texts[texts.length - 1], runner.SESSION_STATEMENTS.ROLLBACK);
});

test('15. transaction_read_only other than on fails closed with rollback and close', async () => {
  const firebase = makeFakeFirebase({ pages: [{ users: [fbUser('ro-1')], pageToken: undefined }] });
  const db = makeFakeDb({ transactionReadOnly: 'off' });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db })
  });
  assert.equal(result.disposition, 'DB_INVENTORY_UNAVAILABLE');
  const texts = db.state.statements.map((entry) => entry.text);
  assert.ok(texts.includes(runner.SESSION_STATEMENTS.ROLLBACK), 'rollback must run');
  assert.ok(db.state.statements.some((entry) => entry.type === 'end'), 'connection must close');
  assert.equal(result.counters.dbSelectStatementCount, 1, 'no catalog query may run after a failed read-only check');
});

test('16. the DB query catalog is fixed and SELECT-only', () => {
  const catalog = runner.DB_READ_CATALOG;
  for (const [key, sql] of Object.entries(catalog)) {
    assert.equal(typeof sql, 'string', key);
    assert.match(sql.trimStart(), /^SELECT\b/i, key + ' must be SELECT-only');
    assert.doesNotMatch(sql, WRITE_VERB_PATTERN, key + ' must contain no write verb');
    assert.doesNotMatch(sql, /\$\{/, key + ' must be static');
    assert.doesNotMatch(sql, /email/i, key + ' must reference no email column');
  }
  assert.deepEqual(Object.keys(catalog).sort(), [
    'mappingAppAccountCount',
    'mappingAppAuthIdentityCount',
    'mappingUsersAccountIdCount',
    'ownersComments',
    'ownersReactions',
    'ownersTreeComments',
    'ownersTreeLikes',
    'ownersTrees',
    'users'
  ]);
  assert.deepEqual(runner.SESSION_STATEMENTS, {
    BEGIN_READ_ONLY: 'BEGIN READ ONLY',
    SHOW_TRANSACTION_READ_ONLY: 'SHOW transaction_read_only',
    ROLLBACK: 'ROLLBACK'
  });
});

test('17. no email or private content columns appear in the runner source', () => {
  const source = fs.readFileSync(RUNNER_PATH, 'utf8');
  assert.doesNotMatch(source, /\.email\b/, 'no email property access may exist');
  assert.doesNotMatch(source, /\[['"]email['"]\]/, 'no email bracket access may exist');
  assert.doesNotMatch(source, /\b(phone|displayName|photoURL|passwordHash|passwordSalt|customClaims)\b/,
    'no private user fields may be referenced');
  assert.doesNotMatch(source, /public\.(memories|trees)\b.*\b(body|title|memo)\b/i, 'no content columns');
});

test('18. zero write statements are executed during a full reconciliation', async () => {
  const firebase = makeFakeFirebase({ pages: [{ users: FIXTURE_USERS.map((uid) => fbUser(uid)), pageToken: undefined }] });
  const db = makeFakeDb();
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db })
  });
  const writeStatements = db.state.statements
    .filter((entry) => entry.type === 'query')
    .filter((entry) => WRITE_VERB_PATTERN.test(entry.text));
  assert.deepEqual(writeStatements, []);
  assert.equal(result.counters.dbWriteStatementCount, 0);
  assert.equal(result.counters.dbMutationCount, 0);
  assert.equal(result.counters.providerMutationCount, 0);
});

test('19. DB connection failures are sanitized with zero retries', async () => {
  const firebase = makeFakeFirebase({ pages: [{ users: [fbUser('conn-1')], pageToken: undefined }] });
  const db = makeFakeDb({ failConnect: true });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db })
  });
  assert.equal(result.disposition, 'DB_INVENTORY_UNAVAILABLE');
  assert.equal(result.counters.dbConnectionAttemptedCount, 1);
  assert.equal(result.counters.dbConnectionEstablishedCount, 0);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('raw connect failure'));
  assert.ok(!serialized.includes('neon.tech'), 'no DSN may leak');
});

test('20. DB query failures are sanitized with rollback and zero retries', async () => {
  const firebase = makeFakeFirebase({ pages: [{ users: [fbUser('q-1')], pageToken: undefined }] });
  const db = makeFakeDb({ failOnUsersSelect: true });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db })
  });
  assert.equal(result.disposition, 'DB_INVENTORY_UNAVAILABLE');
  const usersSelectCalls = db.state.statements
    .filter((entry) => entry.type === 'query' && entry.text === runner.DB_READ_CATALOG.users).length;
  assert.equal(usersSelectCalls, 1, 'no retry');
  assert.ok(db.state.statements.some((entry) => entry.type === 'query' && entry.text === runner.SESSION_STATEMENTS.ROLLBACK));
  assert.ok(db.state.statements.some((entry) => entry.type === 'end'));
  assert.ok(!JSON.stringify(result).includes('raw select failure'));
});

test('21. F/U/O intersection counts match the synthetic case A fixture exactly', async () => {
  // Case A: every owner (and every user) is present in Firebase.
  const caseA = [...new Set([...FIXTURE_USERS, ...FIXTURE_OWNERS])];
  const firebase = makeFakeFirebase({
    pages: [{ users: caseA.map((uid) => fbUser(uid)), pageToken: undefined }]
  });
  const db = makeFakeDb();
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db })
  });
  assert.equal(result.disposition, 'DETERMINISTIC_FIREBASE_OWNER_MAP_PROVEN');
  assert.deepEqual(result.aggregates.counts, {
    firebaseUserCount: 7,
    usersIdCount: 5,
    ownerIdCount: 5,
    firebaseAndUsers: 5,
    firebaseAndOwners: 5,
    usersAndOwners: 3,
    firebaseAndUsersAndOwners: 3,
    firebaseAbsentFromUsers: 2,
    usersAbsentFromFirebase: 0,
    ownersAbsentFromFirebase: 0,
    ownersAbsentFromUsers: 2,
    ownersInFirebaseAbsentFromUsers: 2,
    usersInFirebaseWithoutOwnership: 2
  });
  assert.deepEqual(result.aggregates.mappingCounts, {
    appAccountCount: 0,
    appAuthIdentityCount: 0,
    usersWithAccountIdCount: 0
  });
});

test('22. the current DB aggregate shape is pinned as U=5, O=5, U-owner intersection=3', async () => {
  assert.equal(FIXTURE_USERS.length, 5);
  assert.equal(FIXTURE_OWNERS.length, 5);
  const intersection = FIXTURE_OWNERS.filter((owner) => FIXTURE_USERS.includes(owner));
  assert.equal(intersection.length, 3);
  assert.equal(FIXTURE_OWNERS.filter((owner) => !FIXTURE_USERS.includes(owner)).length, 2);
  assert.equal(FIXTURE_USERS.filter((user) => !FIXTURE_OWNERS.includes(user)).length, 2);
});

test('23. all owners present in Firebase yields the deterministic eligibility disposition', async () => {
  const firebase = makeFakeFirebase({
    pages: [{ users: [...new Set([...FIXTURE_USERS, ...FIXTURE_OWNERS])].map((uid) => fbUser(uid)), pageToken: undefined }]
  });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db: makeFakeDb() })
  });
  assert.equal(result.disposition, 'DETERMINISTIC_FIREBASE_OWNER_MAP_PROVEN');
  assert.equal(result.aggregates.counts.ownersAbsentFromFirebase, 0);
});

test('24. an owner absent from Firebase yields OWNER_DB_FIREBASE_MISMATCH_HOLD', async () => {
  const firebase = makeFakeFirebase({
    pages: [{ users: FIXTURE_USERS.map((uid) => fbUser(uid)), pageToken: undefined }]
  });
  const db = makeFakeDb();
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db })
  });
  assert.equal(result.disposition, 'OWNER_DB_FIREBASE_MISMATCH_HOLD');
  assert.equal(result.aggregates.counts.ownersAbsentFromFirebase, 2);
});

test('24b. a nonzero mapping population is INVENTORY_AMBIGUOUS_STOP', async () => {
  const firebase = makeFakeFirebase({
    pages: [{ users: FIXTURE_USERS.map((uid) => fbUser(uid)), pageToken: undefined }]
  });
  const db = makeFakeDb({ mapping: { appAccountCount: 1, appAuthIdentityCount: 0, usersWithAccountIdCount: 0 } });
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db })
  });
  assert.equal(result.disposition, 'INVENTORY_AMBIGUOUS_STOP');
  assert.deepEqual(runner.EXPECTED_ZERO_MAPPING_PRECONDITION, {
    appAccountCount: 0,
    appAuthIdentityCount: 0,
    usersWithAccountIdCount: 0
  });
});

test('25. email is never a reconciliation key and never leaves the fixture layer', async () => {
  const firebase = makeFakeFirebase({
    pages: [{ users: FIXTURE_USERS.map((uid) => fbUser(uid)), pageToken: undefined }]
  });
  const db = makeFakeDb();
  const result = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db })
  });
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('@synthetic.invalid'));
  assert.ok(!serialized.includes('fixture-display-name'));
  assert.equal(result.aggregates.counts.firebaseUserCount, FIXTURE_USERS.length,
    'reconciliation keys remain the verified uid set only');
});

test('26. no raw identifier from any fixture set leaks into any output', async () => {
  const firebase = makeFakeFirebase({
    pages: [{ users: [...new Set([...FIXTURE_USERS, ...FIXTURE_OWNERS, 'extra-uid-4572'])].map((uid) => fbUser(uid)), pageToken: undefined }]
  });
  const db = makeFakeDb();
  const deterministic = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase, db })
  });
  const mismatchFirebase = makeFakeFirebase({
    pages: [{ users: FIXTURE_USERS.map((uid) => fbUser(uid)), pageToken: undefined }]
  });
  const hold = await runner.runReconciliation({
    argv: [runner.EXECUTE_FLAG],
    env: validEnv(),
    dependencies: makeDeps({ firebase: mismatchFirebase, db: makeFakeDb() })
  });
  for (const result of [deterministic, hold]) {
    const serialized = JSON.stringify(result);
    for (const identifier of FIXTURE_RAW_IDENTIFIERS) {
      assert.ok(!serialized.includes(identifier), identifier + ' must never leave memory');
    }
  }
});

test('27. the runner performs no filesystem writes and exposes no output option', () => {
  const source = fs.readFileSync(RUNNER_PATH, 'utf8');
  assert.doesNotMatch(source, /require\(['"](?:node:)?fs['"]\)/, 'no fs module may be required');
  assert.doesNotMatch(source, /writeFile|createWriteStream|appendFile/, 'no write APIs may exist');
  assert.doesNotMatch(source, /--output|--out\b/, 'no output option may exist');
  assert.doesNotMatch(source, /privateMappingWritten:\s*'(?!NO)/, 'privateMappingWritten stays NO');
});

test('28. no Firebase user/session mutation method appears anywhere in the source', () => {
  const source = fs.readFileSync(RUNNER_PATH, 'utf8');
  for (const method of [
    'createUser',
    'updateUser',
    'deleteUser',
    'setCustomUserClaims',
    'revokeRefreshTokens',
    'importUsers',
    'generateEmailVerificationLink',
    'generatePasswordResetLink'
  ]) {
    assert.ok(!source.includes(method), method + ' must not appear');
  }
  assert.ok(!source.includes('initializeApp') || source.includes('admin.initializeApp'),
    'only the bounded live initialization may reference initializeApp');
});

test('29. importing the module performs zero external calls and zero side effects', () => {
  delete require.cache[require.resolve(RUNNER_PATH)];
  let fetchCalls = 0;
  const originalFetch = global.fetch;
  global.fetch = () => {
    fetchCalls += 1;
    throw new Error('network must not be touched at import time');
  };
  try {
    const freshRunner = require(RUNNER_PATH);
    assert.equal(typeof freshRunner.runReconciliation, 'function');
    assert.equal(fetchCalls, 0);
    assert.equal(freshRunner.PRODUCT_FIREBASE_PROJECT_ID, 'relovetree');
    assert.equal(freshRunner.DB_ENV_AUTHORITY, 'LOVE_PLATFORM_DATABASE_URL');
  } finally {
    global.fetch = originalFetch;
    delete require.cache[require.resolve(RUNNER_PATH)];
  }
});

test('30. bounded gate constants are pinned', () => {
  assert.equal(runner.FIREBASE_PAGE_SIZE, 1000);
  assert.equal(runner.FIREBASE_MAX_PAGE_COUNT, 10);
  assert.equal(runner.FIREBASE_MAX_USER_COUNT, 5000);
  assert.equal(runner.FIREBASE_RETRY_MAX, 0);
  assert.equal(runner.EXECUTE_FLAG, '--execute-readonly');
  assert.deepEqual(Object.values(runner.DISPOSITION).sort(), [
    'DB_INVENTORY_UNAVAILABLE',
    'DETERMINISTIC_FIREBASE_OWNER_MAP_PROVEN',
    'FIREBASE_INVENTORY_UNAVAILABLE',
    'INVENTORY_AMBIGUOUS_STOP',
    'OWNER_DB_FIREBASE_MISMATCH_HOLD',
    'PREEXECUTION_STOP'
  ]);
});

test('31. mandatory non-wiring sweep: the harness stays outside the Product runtime', async () => {
  const productSources = {
    boundary: fs.readFileSync(BOUNDARY_PATH, 'utf8'),
    neonVerifier: fs.readFileSync(NEON_VERIFIER_PATH, 'utf8'),
    resolver: fs.readFileSync(RESOLVER_PATH, 'utf8'),
    neonLookup: fs.readFileSync(NEON_LOOKUP_PATH, 'utf8')
  };
  for (const [label, source] of Object.entries(productSources)) {
    assert.ok(!source.includes(RUNNER_BASENAME), label + ' must not reference the reconciliation harness');
  }
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js') && fs.readFileSync(full, 'utf8').includes(RUNNER_BASENAME)) {
        offenders.push(path.relative(ROOT, full));
      }
    }
  };
  walk(SHARED_DIR);
  walk(API_DIR);
  if (fs.existsSync(MODAL_DIR)) walk(MODAL_DIR);
  assert.deepEqual(offenders, [], 'no helper, route, or Modal source may reference the harness');

  const runnerSource = fs.readFileSync(RUNNER_PATH, 'utf8');
  for (const name of [
    'authenticated-principal',
    'neon-auth-token-verifier',
    'authenticated-account-resolution',
    'authenticated-account-neon-lookup'
  ]) {
    assert.ok(!runnerSource.includes(name), 'the harness must not reference ' + name);
  }
  const boundary = await import('../../workers/love-platform-api/authenticated-principal.js');
  assert.equal(boundary.AUTHENTICATED_PRINCIPAL_CONTRACT.currentAcceptedProvider, 'firebase');
  assert.equal(boundary.AUTHENTICATED_PRINCIPAL_CONTRACT.neonTokenAcceptance, false);
});