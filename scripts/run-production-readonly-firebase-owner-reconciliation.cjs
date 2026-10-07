'use strict';

// #4572 / #4006 read-only Firebase owner reconciliation harness.
//
// Source-only preparation for a FUTURE, separately authorized one-shot live
// run. The default invocation is fail-closed (PREEXECUTION_STOP) and performs
// zero external calls. The live path (Firebase Admin read-only listUsers +
// read-only Neon session) is reachable only through the source-bound gate
// below and is never exercised by repository tests, which inject fake
// Firebase/DB clients.
//
// Hard rules:
// - Read-only Firebase Admin listUsers only; no user/session mutation method
//   exists anywhere in this file.
// - Per-user projection is limited to uid / disabled / providerData[].providerId.
// - DB session starts with BEGIN READ ONLY and verifies SHOW
//   transaction_read_only = on; the query catalog is static SELECT-only; the
//   session always rolls back and closes.
// - Only aggregate cardinalities/intersections are output; raw identifiers,
//   credentials, tokens, and provider payloads never leave memory.
// - The reconciliation result is never written to a file.

const APPROVAL_TOKEN = 'APPROVED_4006_4572_PRODUCTION_READONLY_FIREBASE_OWNER_RECONCILIATION';
const APPROVAL_ENV = 'FIREBASE_OWNER_RECONCILIATION_APPROVAL';
const EXPECTED_HEAD_ENV = 'FIREBASE_OWNER_RECONCILIATION_EXPECTED_HEAD';
const EXECUTE_FLAG = '--execute-readonly';

const PRODUCT_FIREBASE_PROJECT_ID = 'relovetree';
const DB_ENV_AUTHORITY = 'LOVE_PLATFORM_DATABASE_URL';
const SERVICE_ACCOUNT_ENV = 'FIREBASE_SERVICE_ACCOUNT_JSON';

const FIREBASE_PAGE_SIZE = 1000;
const FIREBASE_MAX_PAGE_COUNT = 10;
const FIREBASE_MAX_USER_COUNT = 5000;
const FIREBASE_RETRY_MAX = 0;

const EXPECTED_ZERO_MAPPING_PRECONDITION = Object.freeze({
  appAccountCount: 0,
  appAuthIdentityCount: 0,
  usersWithAccountIdCount: 0
});

const DISPOSITION = Object.freeze({
  DETERMINISTIC_FIREBASE_OWNER_MAP_PROVEN: 'DETERMINISTIC_FIREBASE_OWNER_MAP_PROVEN',
  OWNER_DB_FIREBASE_MISMATCH_HOLD: 'OWNER_DB_FIREBASE_MISMATCH_HOLD',
  FIREBASE_INVENTORY_UNAVAILABLE: 'FIREBASE_INVENTORY_UNAVAILABLE',
  DB_INVENTORY_UNAVAILABLE: 'DB_INVENTORY_UNAVAILABLE',
  INVENTORY_AMBIGUOUS_STOP: 'INVENTORY_AMBIGUOUS_STOP',
  PREEXECUTION_STOP: 'PREEXECUTION_STOP'
});

const SESSION_STATEMENTS = Object.freeze({
  BEGIN_READ_ONLY: 'BEGIN READ ONLY',
  SHOW_TRANSACTION_READ_ONLY: 'SHOW transaction_read_only',
  ROLLBACK: 'ROLLBACK'
});

// Static, source-controlled, SELECT-only catalog. No write verb, no dynamic
// SQL, no email or private content columns.
const DB_READ_CATALOG = Object.freeze({
  users: 'SELECT DISTINCT id::text AS user_id FROM public.users',
  ownersTrees: "SELECT DISTINCT owner_id::text AS owner_id FROM public.trees WHERE owner_id IS NOT NULL AND owner_id::text <> ''",
  ownersComments: "SELECT DISTINCT owner_id::text AS owner_id FROM public.comments WHERE owner_id IS NOT NULL AND owner_id::text <> ''",
  ownersReactions: "SELECT DISTINCT owner_id::text AS owner_id FROM public.reactions WHERE owner_id IS NOT NULL AND owner_id::text <> ''",
  ownersTreeComments: "SELECT DISTINCT owner_id::text AS owner_id FROM public.tree_comments WHERE owner_id IS NOT NULL AND owner_id::text <> ''",
  ownersTreeLikes: "SELECT DISTINCT owner_id::text AS owner_id FROM public.tree_likes WHERE owner_id IS NOT NULL AND owner_id::text <> ''",
  mappingAppAccountCount: 'SELECT COUNT(*)::int AS count FROM public.app_account',
  mappingAppAuthIdentityCount: 'SELECT COUNT(*)::int AS count FROM public.app_auth_identity',
  mappingUsersAccountIdCount: 'SELECT COUNT(*)::int AS count FROM public.users WHERE account_id IS NOT NULL'
});

const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;

function isNeonReadDatabaseUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    const parsed = new URL(value);
    return NEON_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

function createCounters() {
  return {
    runnerInvocationCount: 0,
    firebaseInitializationAttemptedCount: 0,
    firebaseListUsersCallCount: 0,
    firebaseUserRecordCount: 0,
    dbConnectionAttemptedCount: 0,
    dbConnectionEstablishedCount: 0,
    dbReadOnlyTransactionCount: 0,
    dbSelectStatementCount: 0,
    dbRollbackCount: 0,
    dbWriteStatementCount: 0,
    providerMutationCount: 0,
    dbMutationCount: 0
  };
}

function stop(disposition, counters, extra = {}) {
  return Object.freeze({
    disposition,
    aggregates: null,
    providerAggregates: null,
    counters: Object.freeze({ ...counters, privateMappingWritten: 'NO', outputFileWritten: 'NO' }),
    ...extra
  });
}

function isNonEmptyTrimmedString(value) {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function resolveServiceAccountProjectId(env) {
  const raw = env && typeof env === 'object' ? env[SERVICE_ACCOUNT_ENV] : undefined;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && isNonEmptyTrimmedString(parsed.project_id)
      ? parsed.project_id
      : null;
  } catch {
    return null;
  }
}

async function collectFirebaseInventory(auth, counters) {
  const seenUids = new Set();
  const providerCounts = new Map();
  let enabledCount = 0;
  let disabledCount = 0;
  let zeroProviderCount = 0;
  let pageToken = undefined;
  const seenPageTokens = new Set();
  let pageCount = 0;

  while (true) {
    pageCount += 1;
    if (pageCount > FIREBASE_MAX_PAGE_COUNT) {
      return { ok: false, counters };
    }
    let page;
    counters.firebaseListUsersCallCount += 1;
    try {
      page = await auth.listUsers(FIREBASE_PAGE_SIZE, pageToken);
    } catch {
      return { ok: false, counters };
    }
    if (!page || typeof page !== 'object' || !Array.isArray(page.users)) {
      return { ok: false, counters };
    }
    for (const record of page.users) {
      if (!record || typeof record !== 'object' || !isNonEmptyTrimmedString(record.uid)) {
        return { ok: false, counters };
      }
      if (seenUids.has(record.uid)) {
        return { ok: false, counters, ambiguous: true };
      }
      seenUids.add(record.uid);
      counters.firebaseUserRecordCount += 1;
      if (seenUids.size > FIREBASE_MAX_USER_COUNT) {
        return { ok: false, counters };
      }
      if (record.disabled === true) disabledCount += 1;
      else enabledCount += 1;
      const providers = Array.isArray(record.providerData) ? record.providerData : [];
      let providerCount = 0;
      for (const provider of providers) {
        if (provider && typeof provider === 'object' && isNonEmptyTrimmedString(provider.providerId)) {
          providerCounts.set(provider.providerId, (providerCounts.get(provider.providerId) || 0) + 1);
          providerCount += 1;
        }
      }
      if (providerCount === 0) zeroProviderCount += 1;
    }
    const nextToken = page.pageToken;
    if (nextToken === undefined || nextToken === null || nextToken === '') break;
    if (typeof nextToken !== 'string') {
      return { ok: false, counters };
    }
    if (seenPageTokens.has(nextToken)) {
      return { ok: false, counters };
    }
    seenPageTokens.add(nextToken);
    pageToken = nextToken;
  }

  return {
    ok: true,
    counters,
    uids: seenUids,
    aggregates: {
      firebaseTotalUserCount: seenUids.size,
      firebaseEnabledUserCount: enabledCount,
      firebaseDisabledUserCount: disabledCount,
      firebaseZeroProviderDataUserCount: zeroProviderCount
    },
    providerCounts: Object.freeze(Object.fromEntries([...providerCounts.entries()].sort()))
  };
}

async function readDatabaseInventory(client, counters) {
  const rollbackAndClose = async () => {
    try {
      await client.query(SESSION_STATEMENTS.ROLLBACK);
      counters.dbRollbackCount += 1;
    } catch {
      // Bounded: rollback failures are swallowed; the connection close below
      // still runs and no state was mutated.
    }
    try {
      await client.end();
    } catch {
      // Bounded close; never surfaced.
    }
  };

  try {
    await client.connect();
    counters.dbConnectionEstablishedCount += 1;
  } catch {
    return { ok: false };
  }

  try {
    await client.query(SESSION_STATEMENTS.BEGIN_READ_ONLY);
    counters.dbReadOnlyTransactionCount += 1;
    const readOnlyResult = await client.query(SESSION_STATEMENTS.SHOW_TRANSACTION_READ_ONLY);
    counters.dbSelectStatementCount += 1;
    const readOnlyRow = Array.isArray(readOnlyResult && readOnlyResult.rows) ? readOnlyResult.rows[0] : null;
    if (!readOnlyRow || readOnlyRow.transaction_read_only !== 'on') {
      await rollbackAndClose();
      return { ok: false };
    }

    const readRows = async (sql) => {
      const result = await client.query(sql);
      counters.dbSelectStatementCount += 1;
      if (!result || !Array.isArray(result.rows)) throw new Error('malformed rows');
      return result.rows;
    };

    const users = new Set();
    for (const row of await readRows(DB_READ_CATALOG.users)) {
      if (!row || !isNonEmptyTrimmedString(row.user_id)) throw new Error('malformed users row');
      users.add(row.user_id);
    }
    const owners = new Set();
    for (const key of ['ownersTrees', 'ownersComments', 'ownersReactions', 'ownersTreeComments', 'ownersTreeLikes']) {
      for (const row of await readRows(DB_READ_CATALOG[key])) {
        if (!row || !isNonEmptyTrimmedString(row.owner_id)) throw new Error('malformed owner row');
        owners.add(row.owner_id);
      }
    }
    const mapping = {};
    const countRows = await readRows(DB_READ_CATALOG.mappingAppAccountCount);
    mapping.appAccountCount = countRows.length === 1 ? Number(countRows[0].count) : NaN;
    const identityRows = await readRows(DB_READ_CATALOG.mappingAppAuthIdentityCount);
    mapping.appAuthIdentityCount = identityRows.length === 1 ? Number(identityRows[0].count) : NaN;
    const accountIdRows = await readRows(DB_READ_CATALOG.mappingUsersAccountIdCount);
    mapping.usersWithAccountIdCount = accountIdRows.length === 1 ? Number(accountIdRows[0].count) : NaN;
    if (![mapping.appAccountCount, mapping.appAuthIdentityCount, mapping.usersWithAccountIdCount]
      .every((value) => Number.isInteger(value) && value >= 0)) {
      await rollbackAndClose();
      return { ok: false };
    }

    await rollbackAndClose();
    return { ok: true, users, owners, mapping };
  } catch {
    await rollbackAndClose();
    return { ok: false };
  }
}

function intersectCount(a, b) {
  let count = 0;
  for (const value of a) {
    if (b.has(value)) count += 1;
  }
  return count;
}

function countAbsent(from, other) {
  let count = 0;
  for (const value of from) {
    if (!other.has(value)) count += 1;
  }
  return count;
}

function buildAggregates(firebase, database) {
  const { uids, aggregates, providerCounts } = firebase;
  const { users, owners, mapping } = database;
  return {
    firebaseAggregates: aggregates,
    firebaseProviderCounts: providerCounts,
    counts: Object.freeze({
      firebaseUserCount: uids.size,
      usersIdCount: users.size,
      ownerIdCount: owners.size,
      firebaseAndUsers: intersectCount(uids, users),
      firebaseAndOwners: intersectCount(uids, owners),
      usersAndOwners: intersectCount(users, owners),
      firebaseAndUsersAndOwners: [...owners].filter((owner) => uids.has(owner) && users.has(owner)).length,
      firebaseAbsentFromUsers: countAbsent(uids, users),
      usersAbsentFromFirebase: countAbsent(users, uids),
      ownersAbsentFromFirebase: countAbsent(owners, uids),
      ownersAbsentFromUsers: countAbsent(owners, users),
      ownersInFirebaseAbsentFromUsers: [...owners].filter((owner) => uids.has(owner) && !users.has(owner)).length,
      usersInFirebaseWithoutOwnership: [...users].filter((user) => uids.has(user) && !owners.has(user)).length
    }),
    mappingCounts: Object.freeze({ ...mapping })
  };
}

async function runReconciliation({ argv = [], env = {}, dependencies = {} } = {}) {
  const counters = createCounters();
  counters.runnerInvocationCount += 1;

  const getCurrentHead = dependencies.getCurrentHead || defaultGetCurrentHead;
  const createFirebaseAuth = dependencies.createFirebaseAuth || defaultCreateFirebaseAuth;
  const createDbClient = dependencies.createDbClient || defaultCreateDbClient;

  if (!Array.isArray(argv) || !argv.includes(EXECUTE_FLAG)) {
    return stop(DISPOSITION.PREEXECUTION_STOP, counters);
  }
  if (env[APPROVAL_ENV] !== APPROVAL_TOKEN) {
    return stop(DISPOSITION.PREEXECUTION_STOP, counters);
  }
  let actualHead = null;
  try {
    actualHead = await getCurrentHead();
  } catch {
    return stop(DISPOSITION.PREEXECUTION_STOP, counters);
  }
  if (!isNonEmptyTrimmedString(actualHead) || env[EXPECTED_HEAD_ENV] !== actualHead) {
    return stop(DISPOSITION.PREEXECUTION_STOP, counters);
  }
  const configuredProjectId = isNonEmptyTrimmedString(env.FIREBASE_PROJECT_ID)
    ? env.FIREBASE_PROJECT_ID
    : PRODUCT_FIREBASE_PROJECT_ID;
  if (configuredProjectId !== PRODUCT_FIREBASE_PROJECT_ID) {
    return stop(DISPOSITION.PREEXECUTION_STOP, counters);
  }
  if (resolveServiceAccountProjectId(env) !== PRODUCT_FIREBASE_PROJECT_ID) {
    return stop(DISPOSITION.PREEXECUTION_STOP, counters);
  }
  if (!isNeonReadDatabaseUrl(env[DB_ENV_AUTHORITY])) {
    return stop(DISPOSITION.PREEXECUTION_STOP, counters);
  }

  counters.firebaseInitializationAttemptedCount += 1;
  let auth;
  try {
    auth = await createFirebaseAuth({ env, projectId: PRODUCT_FIREBASE_PROJECT_ID });
  } catch {
    return stop(DISPOSITION.FIREBASE_INVENTORY_UNAVAILABLE, counters);
  }
  const firebaseInventory = await collectFirebaseInventory(auth, counters);
  if (!firebaseInventory.ok) {
    return stop(
      firebaseInventory.ambiguous ? DISPOSITION.INVENTORY_AMBIGUOUS_STOP : DISPOSITION.FIREBASE_INVENTORY_UNAVAILABLE,
      counters
    );
  }

  counters.dbConnectionAttemptedCount += 1;
  let client;
  try {
    client = await createDbClient({ connectionString: env[DB_ENV_AUTHORITY] });
  } catch {
    return stop(DISPOSITION.DB_INVENTORY_UNAVAILABLE, counters);
  }
  const databaseInventory = await readDatabaseInventory(client, counters);
  if (!databaseInventory.ok) {
    return stop(DISPOSITION.DB_INVENTORY_UNAVAILABLE, counters);
  }

  const { users, owners, mapping } = databaseInventory;
  const { uids } = firebaseInventory;
  const mappingMatchesPrecondition =
    mapping.appAccountCount === EXPECTED_ZERO_MAPPING_PRECONDITION.appAccountCount &&
    mapping.appAuthIdentityCount === EXPECTED_ZERO_MAPPING_PRECONDITION.appAuthIdentityCount &&
    mapping.usersWithAccountIdCount === EXPECTED_ZERO_MAPPING_PRECONDITION.usersWithAccountIdCount;
  if (!mappingMatchesPrecondition) {
    return stop(DISPOSITION.INVENTORY_AMBIGUOUS_STOP, counters);
  }

  const aggregates = buildAggregates(firebaseInventory, databaseInventory);
  const allOwnersInFirebase = aggregates.counts.ownersAbsentFromFirebase === 0;
  const disposition = allOwnersInFirebase
    ? DISPOSITION.DETERMINISTIC_FIREBASE_OWNER_MAP_PROVEN
    : DISPOSITION.OWNER_DB_FIREBASE_MISMATCH_HOLD;

  return Object.freeze({
    disposition,
    aggregates,
    providerAggregates: firebaseInventory.providerCounts,
    counters: Object.freeze({ ...counters, privateMappingWritten: 'NO', outputFileWritten: 'NO' })
  });
}

async function defaultGetCurrentHead() {
  const { execFileSync } = require('node:child_process');
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

async function defaultCreateFirebaseAuth({ env }) {
  const admin = require('firebase-admin');
  const serviceAccount = JSON.parse(env[SERVICE_ACCOUNT_ENV]);
  if (!admin.apps || admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: PRODUCT_FIREBASE_PROJECT_ID
    });
  }
  return admin.auth();
}

async function defaultCreateDbClient({ connectionString }) {
  const { Client } = require('pg');
  return new Client({ connectionString, application_name: 'lovebud-4572-readonly-reconciliation' });
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const result = await runReconciliation({ argv, env });
  console.log('disposition=' + result.disposition);
  if (result.aggregates) {
    console.log('aggregates=' + JSON.stringify(result.aggregates));
    console.log('providers=' + JSON.stringify(result.providerAggregates));
  }
  console.log('counters=' + JSON.stringify(result.counters));
  return result.disposition === DISPOSITION.PREEXECUTION_STOP ? 2 : 0;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch(() => {
    console.log('disposition=' + DISPOSITION.INVENTORY_AMBIGUOUS_STOP);
    process.exitCode = 2;
  });
}

module.exports = {
  APPROVAL_TOKEN,
  APPROVAL_ENV,
  EXPECTED_HEAD_ENV,
  EXECUTE_FLAG,
  PRODUCT_FIREBASE_PROJECT_ID,
  DB_ENV_AUTHORITY,
  SERVICE_ACCOUNT_ENV,
  FIREBASE_PAGE_SIZE,
  FIREBASE_MAX_PAGE_COUNT,
  FIREBASE_MAX_USER_COUNT,
  FIREBASE_RETRY_MAX,
  EXPECTED_ZERO_MAPPING_PRECONDITION,
  DISPOSITION,
  SESSION_STATEMENTS,
  DB_READ_CATALOG,
  isNeonReadDatabaseUrl,
  resolveServiceAccountProjectId,
  runReconciliation,
  main
};