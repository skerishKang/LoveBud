// Contract tests for #4425 Neon-native private-storage entitlement.
//
// Source/test only: no network, provider, database, secret, Product request,
// Production gate, or Production mutation.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const MODULE = '../../functions/_shared/private-storage-entitlement-neon.js';
const MIGRATION = path.resolve(
  __dirname,
  '../../db/migrations/20260918144500_add-private-storage-entitlement.sql'
);

test('#4425 Neon entitlement uses only verified owner id against public.users', async () => {
  const mod = await import(MODULE);
  const calls = [];
  const tx = {
    async query(sql, params) {
      calls.push({ sql, params });
      return [{ private_storage_enabled: true }];
    }
  };
  const result = await mod.readPrivateStorageEntitlement(tx, 'firebase-uid-4425');
  assert.deepEqual(result, { entitled: true, reason: 'neon-users' });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ['firebase-uid-4425']);
  assert.match(calls[0].sql, /FROM public\.users/i);
  assert.match(calls[0].sql, /WHERE id = \$1/i);
  assert.match(calls[0].sql, /FOR SHARE/i);
  assert.doesNotMatch(calls[0].sql, /firestore|firebase/i);
});

test('#4425 false, null, malformed, and missing rows fail closed as not entitled', async () => {
  const mod = await import(MODULE);
  for (const rows of [
    [{ private_storage_enabled: false }],
    [{ private_storage_enabled: null }],
    [{ private_storage_enabled: 1 }],
    [{}],
    []
  ]) {
    const result = await mod.readPrivateStorageEntitlement(
      { query: async () => rows },
      'firebase-uid-4425'
    );
    assert.equal(result.entitled, false);
  }
});

test('#4425 query failure is unavailable and leaks no database detail', async () => {
  const mod = await import(MODULE);
  await assert.rejects(
    () => mod.readPrivateStorageEntitlement(
      { query: async () => { throw new Error('secret database detail'); } },
      'firebase-uid-4425'
    ),
    (error) => {
      assert.equal(error.code, mod.PRIVATE_STORAGE_ENTITLEMENT_ERROR.UNAVAILABLE);
      assert.doesNotMatch(String(error.message), /secret database detail/);
      return true;
    }
  );
});

test('#4425 invalid principal fails before transaction query', async () => {
  const mod = await import(MODULE);
  let queries = 0;
  for (const ownerId of [null, '', ' uid-with-whitespace ']) {
    await assert.rejects(
      () => mod.readPrivateStorageEntitlement(
        { query: async () => { queries += 1; return []; } },
        ownerId
      ),
      (error) => error.code === mod.PRIVATE_STORAGE_ENTITLEMENT_ERROR.PRINCIPAL_INVALID
    );
  }
  assert.equal(queries, 0);
});

test('#4425 require helper preserves stable Plus-required code', async () => {
  const mod = await import(MODULE);
  await assert.rejects(
    () => mod.requirePrivateStorageEntitlement(
      { query: async () => [{ private_storage_enabled: false }] },
      'firebase-uid-4425'
    ),
    (error) => error.code === 'PLUS_REQUIRED_PRIVATE_STORAGE'
  );
});

test('#4425 contract explicitly removes Firestore from target entitlement boundary', async () => {
  const mod = await import(MODULE);
  const contract = mod.PRIVATE_STORAGE_ENTITLEMENT_NEON_CONTRACT;
  assert.equal(contract.sourceOfTruth, 'neon.public.users.private_storage_enabled');
  assert.equal(contract.firestoreRequired, false);
  assert.equal(contract.serviceAccountRequired, false);
  assert.equal(contract.defaultEntitled, false);
  assert.equal(contract.productionCutover, false);
});

test('#4425 additive migration is fail-closed and does not grant privileges', () => {
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  assert.match(
    sql,
    /ADD COLUMN IF NOT EXISTS private_storage_enabled boolean NOT NULL DEFAULT false/i
  );
  assert.doesNotMatch(sql, /\bGRANT\b|\bREVOKE\b/i);
  assert.doesNotMatch(sql, /service_account|firebase_service_account_json/i);
  assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i);
});
