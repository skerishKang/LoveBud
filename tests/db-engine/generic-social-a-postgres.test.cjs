'use strict';

/**
 * DB_ENGINE_EXECUTION: generic-social Migration A rehearsal on disposable PostgreSQL 17.4.
 *
 * Sole approved apply path:
 *   preflight validator → exact historical Migration A → postcondition validator
 *
 * Independent #3535 evidence (catalog/backfill/triggers) is preserved alongside validators.
 * Never reads DATABASE_URL / Production secrets. Never executes Migration B.
 *
 * Refs: #3534, #3262, #3459, #3458, #3425, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const harness = require('./helpers/postgres-disposable-harness.cjs');
const catalog = require('./helpers/generic-social-catalog-assertions.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const PREFLIGHT = path.join(ROOT, 'scripts/validate-generic-social-a-preflight.sql');
const MIG_A = path.join(ROOT, 'scripts/migration-add-generic-social-targets.sql');
const POSTCOND = path.join(ROOT, 'scripts/validate-generic-social-a-postcondition.sql');
const MIG_B = path.join(ROOT, 'scripts/migration-b-generic-social-targets-cutover.sql');
const LEGACY_FIXTURE = path.join(__dirname, 'fixtures/generic-social-a-legacy.sql');

const { withDisposableDb, boundedFail, combinedOutput } = harness;
const {
  TABLES,
  LEGACY_IDEM,
  LEGACY_AUDIT,
  assertLegacySchema,
  assertMigrationACatalog,
  getCatalogFingerprint,
  getLegacyCatalogFingerprint,
  fingerprintEqual,
  getFullRowFingerprint,
  getColumnNames,
  getBackfillStats,
  getCheckNames,
  getTriggerNames,
  tableExistsOrdinary,
} = catalog;

// Synthetic deterministic IDs (not Production). Not logged as payloads.
const MEM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEM2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

/** Phase + table specific synthetic UUID sets (hex-only, 8-4-4-4-12) to avoid collisions. */
function synthIds(phase, tableKind) {
  // phase: 'first' | 'second'; tableKind: 'idem' | 'audit'
  const p = phase === 'second' ? '2' : '1';
  const t = tableKind === 'audit' ? 'a' : '0';
  const mk = (n) => {
    const d = String(n); // single hex digit 1-7
    // 8-4-4-4-12 with version nibble 4 and RFC variant nibble 8
    return `${p}${t}${d}00000-${p}${t}${d}0-4${t}${d}0-8${t}${d}0-${p}${t}${d}000000000`;
  };
  return {
    legacyOnly: mk(1),
    match: mk(2),
    partial: mk(3),
    tree: mk(4),
    unknown: mk(5),
    mismatch: mk(6),
    updateBase: mk(7),
  };
}

function pass(name) {
  process.stdout.write(`${name}: PASS\n`);
}

function failMutation() {
  const err = new Error('EXPECTED_PRESTATE_PRESERVED_ACTUAL_MUTATED');
  err.code = 'EXPECTED_PRESTATE_PRESERVED_ACTUAL_MUTATED';
  throw err;
}

async function assertNoMutation(client, beforeFp) {
  const after = await getCatalogFingerprint(client);
  if (!fingerprintEqual(beforeFp, after)) failMutation();
}

function expectOk(res, scenario, phase) {
  if (res.status !== 0) {
    boundedFail(scenario, phase, classify(combinedOutput(res)), res.status, 'exit_0', `exit_${res.status}`);
  }
}

function expectFail(res, scenario, phase) {
  if (res.status === 0) {
    boundedFail(scenario, phase, 'EXPECTED_NONZERO_EXIT', 0, 'nonzero', '0');
  }
}

function classify(out) {
  const m = out.match(/GENERIC_SOCIAL_A_[A-Z0-9_]+/);
  if (m) return m[0];
  if (/Prerequisite table/i.test(out)) return 'MIGRATION_PRECONDITION_FAILED';
  return 'ENGINE_ERROR';
}

function assertCategory(res, expectedCategory) {
  const cat = classify(combinedOutput(res));
  assert.equal(cat, expectedCategory);
}

/**
 * Real guarded workflow for #3535 rehearsal evidence.
 * Preflight always runs; Migration A only on preflight success;
 * postcondition only on Migration A success.
 */
function runGuardedSequence(runSql) {
  const counts = { preflight: 0, migA: 0, postcond: 0 };
  counts.preflight += 1;
  const pre = runSql(PREFLIGHT);
  if (pre.status !== 0) {
    return { counts, pre, mig: null, post: null, stoppedAt: 'preflight', category: classify(combinedOutput(pre)) };
  }
  counts.migA += 1;
  const mig = runSql(MIG_A);
  if (mig.status !== 0) {
    return { counts, pre, mig, post: null, stoppedAt: 'migA', category: classify(combinedOutput(mig)) };
  }
  counts.postcond += 1;
  const post = runSql(POSTCOND);
  return {
    counts,
    pre,
    mig,
    post,
    stoppedAt: post.status === 0 ? 'done' : 'postcond',
    category: post.status === 0 ? null : classify(combinedOutput(post)),
  };
}

async function assertRejectionWithNoMutation(client, runSql, scenario, expectedCategory) {
  const before = await getCatalogFingerprint(client);
  const beforeRowsI = await getFullRowFingerprint(client, 'idem');
  const beforeRowsA = await getFullRowFingerprint(client, 'audit');
  const beforeU = await getFullRowFingerprint(client, 'unrelated');

  const seq = runGuardedSequence(runSql);
  assert.equal(seq.counts.preflight, 1, 'preflight invocation = 1');
  assert.equal(seq.counts.migA, 0, 'Migration A invocation count = 0');
  assert.equal(seq.counts.postcond, 0, 'postcondition invocation count = 0');
  assert.equal(seq.stoppedAt, 'preflight');
  expectFail(seq.pre, scenario, 'preflight');
  assertCategory(seq.pre, expectedCategory);

  await assertNoMutation(client, before);
  assert.equal((await getFullRowFingerprint(client, 'idem')).rowFp, beforeRowsI.rowFp, 'idem row fingerprint unchanged');
  assert.equal((await getFullRowFingerprint(client, 'audit')).rowFp, beforeRowsA.rowFp, 'audit row fingerprint unchanged');
  assert.deepEqual(await getFullRowFingerprint(client, 'unrelated'), beforeU);
  pass(`rehearsal reject ${scenario}`);
}

const IDEM_DDL = `
  CREATE TABLE public.social_idempotency (
    id UUID PRIMARY KEY,
    actor_id VARCHAR(128) NOT NULL,
    operation VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    target_memory_id UUID NOT NULL,
    result_state VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const AUDIT_DDL = `
  CREATE TABLE public.social_audit_log (
    id UUID PRIMARY KEY,
    actor_id VARCHAR(128) NOT NULL,
    memory_id UUID NOT NULL,
    action VARCHAR(64) NOT NULL,
    outcome_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const LEGACY_BASE = IDEM_DDL + AUDIT_DDL;
const UNRELATED = `
  CREATE TABLE IF NOT EXISTS public.lb_unrelated_marker (id text PRIMARY KEY, v text NOT NULL);
  INSERT INTO public.lb_unrelated_marker(id,v) VALUES ('u1','keep') ON CONFLICT DO NOTHING;
`;

async function rejectWithoutMigration(scenario, setupSql, expectedCategory) {
  await withDisposableDb(scenario, null, async ({ client, runSql }) => {
    await client.query(setupSql + UNRELATED);
    await assertRejectionWithNoMutation(client, runSql, scenario, expectedCategory);
  });
}

async function applyGuardedHappy(client, runSql, scenario) {
  const seq = runGuardedSequence(runSql);
  assert.equal(seq.counts.preflight, 1);
  assert.equal(seq.counts.migA, 1);
  assert.equal(seq.counts.postcond, 1);
  assert.equal(seq.stoppedAt, 'done');
  expectOk(seq.pre, scenario, 'preflight');
  expectOk(seq.mig, scenario, 'migration_a');
  expectOk(seq.post, scenario, 'postcondition');
  return seq;
}

async function rowExists(client, table, id) {
  const r = await client.query(`SELECT count(*)::int AS n FROM public.${table} WHERE id = $1`, [id]);
  return r.rows[0].n > 0;
}

/**
 * Full A–H compatibility matrix for social_idempotency (independent of audit).
 * Markers: phase first|second + table idempotency.
 */
async function assertIdempotencyCompatibility(client, phase) {
  const ids = synthIds(phase, 'idem');
  // Static contract locks these exact phase+table markers as string literals in source.
  const MARK = {
    first: {
      legacy_only: 'compat_first_idempotency_legacy_only',
      matching_pair: 'compat_first_idempotency_matching_pair',
      partial_pair: 'compat_first_idempotency_partial_pair',
      tree: 'compat_first_idempotency_tree',
      unknown: 'compat_first_idempotency_unknown',
      mismatch: 'compat_first_idempotency_mismatch',
      update_mismatch: 'compat_first_idempotency_update_mismatch',
      catalog_preserve: 'compat_first_idempotency_catalog_preserve_after_failures',
    },
    second: {
      legacy_only: 'compat_second_idempotency_legacy_only',
      matching_pair: 'compat_second_idempotency_matching_pair',
      partial_pair: 'compat_second_idempotency_partial_pair',
      tree: 'compat_second_idempotency_tree',
      unknown: 'compat_second_idempotency_unknown',
      mismatch: 'compat_second_idempotency_mismatch',
      update_mismatch: 'compat_second_idempotency_update_mismatch',
      catalog_preserve: 'compat_second_idempotency_catalog_preserve_after_failures',
    },
  }[phase];
  const beforeCat = await getCatalogFingerprint(client);
  const beforeUnrel = await getFullRowFingerprint(client, 'unrelated');
  const beforeRows = await getFullRowFingerprint(client, 'idem');

  // A. legacy-only INSERT → generic memory pair filled
  await client.query(
    `INSERT INTO public.social_idempotency (
       id, actor_id, operation, idempotency_key, request_fingerprint, target_memory_id
     ) VALUES ($1, $2, 'comment.create', $3, $4, $5)`,
    [ids.legacyOnly, `syn_${phase}_idem`, `key_leg_${phase}_i`, `fp_leg_${phase}_i`, MEM]
  );
  const rLeg = await client.query(
    `SELECT target_kind, target_id::text AS tid FROM public.social_idempotency WHERE id = $1`,
    [ids.legacyOnly]
  );
  assert.equal(rLeg.rows[0].target_kind, 'memory');
  assert.equal(rLeg.rows[0].tid, MEM);
  pass(MARK.legacy_only);

  // B. complete matching memory pair
  await client.query(
    `INSERT INTO public.social_idempotency (
       id, actor_id, operation, idempotency_key, request_fingerprint,
       target_memory_id, target_kind, target_id
     ) VALUES ($1, $2, 'comment.create', $3, $4, $5, 'memory', $5)`,
    [ids.match, `syn_${phase}_idem`, `key_match_${phase}_i`, `fp_match_${phase}_i`, MEM]
  );
  assert.equal(await rowExists(client, 'social_idempotency', ids.match), true);
  pass(MARK.matching_pair);

  // C. partial pair
  let failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint,
         target_memory_id, target_kind
       ) VALUES ($1, $2, 'comment.create', $3, $4, $5, 'memory')`,
      [ids.partial, `syn_${phase}_idem`, `key_part_${phase}_i`, `fp_part_${phase}_i`, MEM]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal(await rowExists(client, 'social_idempotency', ids.partial), false);
  pass(MARK.partial_pair);

  // D. tree pair
  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint,
         target_memory_id, target_kind, target_id
       ) VALUES ($1, $2, 'comment.create', $3, $4, $5, 'tree', $6)`,
      [ids.tree, `syn_${phase}_idem`, `key_tree_${phase}_i`, `fp_tree_${phase}_i`, MEM, MEM2]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal(await rowExists(client, 'social_idempotency', ids.tree), false);
  pass(MARK.tree);

  // E. unknown kind
  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint,
         target_memory_id, target_kind, target_id
       ) VALUES ($1, $2, 'comment.create', $3, $4, $5, 'unknown', $5)`,
      [ids.unknown, `syn_${phase}_idem`, `key_unk_${phase}_i`, `fp_unk_${phase}_i`, MEM]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal(await rowExists(client, 'social_idempotency', ids.unknown), false);
  pass(MARK.unknown);

  // F. generic/legacy memory mismatch
  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint,
         target_memory_id, target_kind, target_id
       ) VALUES ($1, $2, 'comment.create', $3, $4, $5, 'memory', $6)`,
      [ids.mismatch, `syn_${phase}_idem`, `key_mis_${phase}_i`, `fp_mis_${phase}_i`, MEM, MEM2]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal(await rowExists(client, 'social_idempotency', ids.mismatch), false);
  pass(MARK.mismatch);

  // G. UPDATE mismatch on a complete matching row
  await client.query(
    `INSERT INTO public.social_idempotency (
       id, actor_id, operation, idempotency_key, request_fingerprint,
       target_memory_id, target_kind, target_id
     ) VALUES ($1, $2, 'comment.create', $3, $4, $5, 'memory', $5)`,
    [ids.updateBase, `syn_${phase}_idem`, `key_upd_${phase}_i`, `fp_upd_${phase}_i`, MEM]
  );
  const beforeUpd = await getFullRowFingerprint(client, 'idem');
  failed = false;
  try {
    await client.query(`UPDATE public.social_idempotency SET target_id = $1 WHERE id = $2`, [
      MEM2,
      ids.updateBase,
    ]);
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal((await getFullRowFingerprint(client, 'idem')).rowFp, beforeUpd.rowFp);
  pass(MARK.update_mismatch);

  // H. catalog/object preservation after failures (+ unrelated sentinel)
  const afterCat = await getCatalogFingerprint(client);
  assert.deepEqual(afterCat.idem.checks, beforeCat.idem.checks);
  assert.deepEqual(afterCat.audit.checks, beforeCat.audit.checks);
  assert.deepEqual(afterCat.idem.triggers, beforeCat.idem.triggers);
  assert.deepEqual(afterCat.audit.triggers, beforeCat.audit.triggers);
  assert.deepEqual(afterCat.funcs, beforeCat.funcs);
  assert.deepEqual(await getFullRowFingerprint(client, 'unrelated'), beforeUnrel);
  // Successful inserts changed row set; baseline before success inserts is not equal — only failures preserve
  assert.notEqual((await getFullRowFingerprint(client, 'idem')).rowFp, beforeRows.rowFp);
  pass(MARK.catalog_preserve);
}

/**
 * Full A–H compatibility matrix for social_audit_log (independent of idempotency).
 * Markers: phase first|second + table audit.
 */
async function assertAuditCompatibility(client, phase) {
  const ids = synthIds(phase, 'audit');
  // Static contract locks these exact phase+table markers as string literals in source.
  const mark = {
    first: {
      legacy_only: 'compat_first_audit_legacy_only',
      matching_pair: 'compat_first_audit_matching_pair',
      partial_pair: 'compat_first_audit_partial_pair',
      tree: 'compat_first_audit_tree',
      unknown: 'compat_first_audit_unknown',
      mismatch: 'compat_first_audit_mismatch',
      update_mismatch: 'compat_first_audit_update_mismatch',
      catalog_preserve: 'compat_first_audit_catalog_preserve_after_failures',
    },
    second: {
      legacy_only: 'compat_second_audit_legacy_only',
      matching_pair: 'compat_second_audit_matching_pair',
      partial_pair: 'compat_second_audit_partial_pair',
      tree: 'compat_second_audit_tree',
      unknown: 'compat_second_audit_unknown',
      mismatch: 'compat_second_audit_mismatch',
      update_mismatch: 'compat_second_audit_update_mismatch',
      catalog_preserve: 'compat_second_audit_catalog_preserve_after_failures',
    },
  }[phase];
  const beforeCat = await getCatalogFingerprint(client);
  const beforeUnrel = await getFullRowFingerprint(client, 'unrelated');

  // A. legacy-only INSERT
  await client.query(
    `INSERT INTO public.social_audit_log (
       id, actor_id, memory_id, action, outcome_code
     ) VALUES ($1, $2, $3, 'comment.create', 'success')`,
    [ids.legacyOnly, `syn_${phase}_audit`, MEM]
  );
  const rLeg = await client.query(
    `SELECT target_kind, target_id::text AS tid FROM public.social_audit_log WHERE id = $1`,
    [ids.legacyOnly]
  );
  assert.equal(rLeg.rows[0].target_kind, 'memory');
  assert.equal(rLeg.rows[0].tid, MEM);
  pass(mark.legacy_only);

  // B. complete matching memory pair
  await client.query(
    `INSERT INTO public.social_audit_log (
       id, actor_id, memory_id, action, outcome_code, target_kind, target_id
     ) VALUES ($1, $2, $3, 'comment.create', 'success', 'memory', $3)`,
    [ids.match, `syn_${phase}_audit`, MEM]
  );
  assert.equal(await rowExists(client, 'social_audit_log', ids.match), true);
  pass(mark.matching_pair);

  // C. partial pair
  let failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_audit_log (
         id, actor_id, memory_id, action, outcome_code, target_kind
       ) VALUES ($1, $2, $3, 'comment.create', 'success', 'memory')`,
      [ids.partial, `syn_${phase}_audit`, MEM]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal(await rowExists(client, 'social_audit_log', ids.partial), false);
  pass(mark.partial_pair);

  // D. tree pair
  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_audit_log (
         id, actor_id, memory_id, action, outcome_code, target_kind, target_id
       ) VALUES ($1, $2, $3, 'comment.create', 'success', 'tree', $4)`,
      [ids.tree, `syn_${phase}_audit`, MEM, MEM2]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal(await rowExists(client, 'social_audit_log', ids.tree), false);
  pass(mark.tree);

  // E. unknown kind
  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_audit_log (
         id, actor_id, memory_id, action, outcome_code, target_kind, target_id
       ) VALUES ($1, $2, $3, 'comment.create', 'success', 'unknown', $3)`,
      [ids.unknown, `syn_${phase}_audit`, MEM]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal(await rowExists(client, 'social_audit_log', ids.unknown), false);
  pass(mark.unknown);

  // F. mismatch
  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_audit_log (
         id, actor_id, memory_id, action, outcome_code, target_kind, target_id
       ) VALUES ($1, $2, $3, 'comment.create', 'success', 'memory', $4)`,
      [ids.mismatch, `syn_${phase}_audit`, MEM, MEM2]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal(await rowExists(client, 'social_audit_log', ids.mismatch), false);
  pass(mark.mismatch);

  // G. UPDATE mismatch
  await client.query(
    `INSERT INTO public.social_audit_log (
       id, actor_id, memory_id, action, outcome_code, target_kind, target_id
     ) VALUES ($1, $2, $3, 'comment.create', 'success', 'memory', $3)`,
    [ids.updateBase, `syn_${phase}_audit`, MEM]
  );
  const beforeUpd = await getFullRowFingerprint(client, 'audit');
  failed = false;
  try {
    await client.query(`UPDATE public.social_audit_log SET target_id = $1 WHERE id = $2`, [
      MEM2,
      ids.updateBase,
    ]);
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal((await getFullRowFingerprint(client, 'audit')).rowFp, beforeUpd.rowFp);
  pass(mark.update_mismatch);

  // H. catalog preserve
  const afterCat = await getCatalogFingerprint(client);
  assert.deepEqual(afterCat.idem.checks, beforeCat.idem.checks);
  assert.deepEqual(afterCat.audit.checks, beforeCat.audit.checks);
  assert.deepEqual(afterCat.idem.triggers, beforeCat.idem.triggers);
  assert.deepEqual(afterCat.audit.triggers, beforeCat.audit.triggers);
  assert.deepEqual(afterCat.funcs, beforeCat.funcs);
  assert.deepEqual(await getFullRowFingerprint(client, 'unrelated'), beforeUnrel);
  pass(mark.catalog_preserve);
}

// ─── Happy path: exact legacy → preflight → Migration A → postcondition ──────

test('rehearsal happy path guarded sequence apply backfill catalog', { concurrency: false }, async () => {
  await withDisposableDb('happy', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await assertLegacySchema(client);
    const beforeLegacyCat = await getLegacyCatalogFingerprint(client);
    const beforeColsIdem = await getColumnNames(client, TABLES.idem);
    const beforeColsAudit = await getColumnNames(client, TABLES.audit);
    const beforeIdem = await getFullRowFingerprint(client, 'idem');
    const beforeAudit = await getFullRowFingerprint(client, 'audit');
    const beforeUnrel = await getFullRowFingerprint(client, 'unrelated');
    pass('rehearsal legacy preflight schema');
    pass('rehearsal legacy catalog fingerprint recorded');

    const seq = await applyGuardedHappy(client, runSql, 'happy');
    assert.equal(seq.counts.preflight, 1, 'guarded happy-path preflight = 1');
    assert.equal(seq.counts.migA, 1, 'guarded happy-path Migration A = 1');
    assert.equal(seq.counts.postcond, 1, 'guarded happy-path postcondition = 1');
    pass('rehearsal guarded happy sequence');

    // Legacy catalog invariants preserved (excludes Migration A objects)
    const afterLegacyCat = await getLegacyCatalogFingerprint(client);
    assert.deepEqual(afterLegacyCat, beforeLegacyCat, 'legacy catalog before/after deep equality');
    // Explicit anchors
    const idemLeg = afterLegacyCat.idem.columns.find((c) => c.name === LEGACY_IDEM);
    const auditLeg = afterLegacyCat.audit.columns.find((c) => c.name === LEGACY_AUDIT);
    assert.ok(idemLeg && idemLeg.udt_name === 'uuid' && idemLeg.nullable === 'NO');
    assert.ok(auditLeg && auditLeg.udt_name === 'uuid' && auditLeg.nullable === 'NO');
    assert.ok(afterLegacyCat.idem.constraints.some((c) => c.contype === 'p'));
    assert.ok(afterLegacyCat.audit.constraints.some((c) => c.contype === 'p'));
    assert.ok(afterLegacyCat.idem.indexes.some((i) => i.is_primary));
    assert.ok(afterLegacyCat.audit.indexes.some((i) => i.is_primary));
    assert.ok(afterLegacyCat.idem.owner);
    assert.ok(afterLegacyCat.audit.owner);
    pass('rehearsal legacy catalog before/after preservation');

    // Independent #3535 catalog assertions (not only validator success)
    await assertMigrationACatalog(client);

    const afterIdemBase = await getFullRowFingerprint(client, 'idem', { columns: beforeColsIdem });
    const afterAuditBase = await getFullRowFingerprint(client, 'audit', { columns: beforeColsAudit });
    assert.equal(afterIdemBase.count, beforeIdem.count);
    assert.equal(afterIdemBase.rowFp, beforeIdem.rowFp);
    assert.equal(afterAuditBase.count, beforeAudit.count);
    assert.equal(afterAuditBase.rowFp, beforeAudit.rowFp);
    assert.deepEqual(await getFullRowFingerprint(client, 'unrelated'), beforeUnrel);

    const stI = await getBackfillStats(client, TABLES.idem, LEGACY_IDEM);
    const stA = await getBackfillStats(client, TABLES.audit, LEGACY_AUDIT);
    assert.equal(stI.memory_matched, stI.total);
    assert.equal(stA.memory_matched, stA.total);
    assert.equal(stI.null_pair, 0);
    assert.equal(stA.null_pair, 0);
    assert.equal(stI.partial_pair, 0);
    assert.equal(stA.partial_pair, 0);
    assert.equal(stI.non_memory, 0);
    assert.equal(stA.non_memory, 0);
    assert.equal(stI.mismatch, 0);
    assert.equal(stA.mismatch, 0);
    pass('rehearsal backfill+catalog independent');

    // First-apply symmetric compatibility matrices
    await assertIdempotencyCompatibility(client, 'first');
    await assertAuditCompatibility(client, 'first');
    pass('rehearsal first-apply both-table compatibility');
  });
});

// ─── Second apply complete no-op, then compatibility re-proof ────────────────

test('rehearsal second apply full guarded no-op', { concurrency: false }, async () => {
  await withDisposableDb('second', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await applyGuardedHappy(client, runSql, 'second');
    const catFp = await getCatalogFingerprint(client);
    const rowI = await getFullRowFingerprint(client, 'idem');
    const rowA = await getFullRowFingerprint(client, 'audit');
    const rowU = await getFullRowFingerprint(client, 'unrelated');
    const checksI = await getCheckNames(client, TABLES.idem);
    const checksA = await getCheckNames(client, TABLES.audit);
    const tgI = await getTriggerNames(client, TABLES.idem);
    const tgA = await getTriggerNames(client, TABLES.audit);

    // Second guarded sequence (no-op evidence BEFORE compatibility writes)
    const second = runGuardedSequence(runSql);
    assert.equal(second.counts.preflight, 1);
    assert.equal(second.counts.migA, 1);
    assert.equal(second.counts.postcond, 1);
    assert.equal(second.stoppedAt, 'done');
    expectOk(second.pre, 'second', 'preflight2');
    expectOk(second.mig, 'second', 'mig2');
    expectOk(second.post, 'second', 'post2');

    await assertNoMutation(client, catFp);
    assert.equal((await getFullRowFingerprint(client, 'idem')).rowFp, rowI.rowFp);
    assert.equal((await getFullRowFingerprint(client, 'audit')).rowFp, rowA.rowFp);
    assert.deepEqual(await getFullRowFingerprint(client, 'unrelated'), rowU);
    assert.deepEqual(await getCheckNames(client, TABLES.idem), checksI);
    assert.deepEqual(await getCheckNames(client, TABLES.audit), checksA);
    assert.deepEqual(await getTriggerNames(client, TABLES.idem), tgI);
    assert.deepEqual(await getTriggerNames(client, TABLES.audit), tgA);
    pass('rehearsal second apply no-op');
    pass('rehearsal second_apply_noop_before_compatibility');

    // Fresh synthetic IDs for second-phase compatibility (after no-op proof)
    await assertIdempotencyCompatibility(client, 'second');
    await assertAuditCompatibility(client, 'second');
    pass('rehearsal second-apply both-table compatibility');
  });
});

// ─── First-apply dedicated compatibility suite (explicit matrix markers) ─────

test('rehearsal trigger compatibility statements', { concurrency: false }, async () => {
  await withDisposableDb('triggers', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await applyGuardedHappy(client, runSql, 'triggers');
    await assertIdempotencyCompatibility(client, 'first');
    await assertAuditCompatibility(client, 'first');
    pass('rehearsal first-apply symmetric compatibility matrix');
  });
});

// ─── A. Relation identity ────────────────────────────────────────────────────

test('rehearsal relation identity fail-closed', { concurrency: false }, async () => {
  await rejectWithoutMigration(
    'miss_idem',
    AUDIT_DDL,
    'GENERIC_SOCIAL_A_RELATION_PRECONDITION_FAILED'
  );
  await rejectWithoutMigration(
    'miss_audit',
    IDEM_DDL,
    'GENERIC_SOCIAL_A_RELATION_PRECONDITION_FAILED'
  );
  await rejectWithoutMigration(
    'view_idem',
    AUDIT_DDL +
      `CREATE VIEW public.social_idempotency AS SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid AS id;`,
    'GENERIC_SOCIAL_A_RELATION_PRECONDITION_FAILED'
  );
  await rejectWithoutMigration(
    'view_audit',
    IDEM_DDL +
      `CREATE VIEW public.social_audit_log AS SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid AS id;`,
    'GENERIC_SOCIAL_A_RELATION_PRECONDITION_FAILED'
  );
});

// ─── B. Legacy column shape (symmetric) ──────────────────────────────────────

test('rehearsal legacy column shape fail-closed', { concurrency: false }, async () => {
  const shapes = [
    ['legacy_missing_idem', IDEM_DDL.replace('    target_memory_id UUID NOT NULL,\n', '') + AUDIT_DDL],
    ['legacy_null_idem', IDEM_DDL.replace('target_memory_id UUID NOT NULL', 'target_memory_id UUID') + AUDIT_DDL],
    [
      'legacy_type_idem',
      IDEM_DDL.replace('target_memory_id UUID NOT NULL', 'target_memory_id TEXT NOT NULL') + AUDIT_DDL,
    ],
    [
      'legacy_def_idem',
      IDEM_DDL.replace(
        'target_memory_id UUID NOT NULL',
        'target_memory_id UUID NOT NULL DEFAULT gen_random_uuid()'
      ) + AUDIT_DDL,
    ],
    ['legacy_missing_audit', IDEM_DDL + AUDIT_DDL.replace('    memory_id UUID NOT NULL,\n', '')],
    ['legacy_null_audit', IDEM_DDL + AUDIT_DDL.replace('memory_id UUID NOT NULL', 'memory_id UUID')],
    [
      'legacy_type_audit',
      IDEM_DDL + AUDIT_DDL.replace('memory_id UUID NOT NULL', 'memory_id TEXT NOT NULL'),
    ],
    [
      'legacy_def_audit',
      IDEM_DDL +
        AUDIT_DDL.replace(
          'memory_id UUID NOT NULL',
          'memory_id UUID NOT NULL DEFAULT gen_random_uuid()'
        ),
    ],
  ];
  for (const [name, setup] of shapes) {
    await rejectWithoutMigration(name, setup, 'GENERIC_SOCIAL_A_LEGACY_COLUMN_SHAPE_MISMATCH');
  }

  // nullable legacy + synthetic NULL row still fails legacy shape (nullable itself)
  await rejectWithoutMigration(
    'legacy_null_with_row',
    IDEM_DDL.replace('target_memory_id UUID NOT NULL', 'target_memory_id UUID') +
      AUDIT_DDL +
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint, target_memory_id
       ) VALUES (
         'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a', 'op', 'k', 'fp', NULL
       );`,
    'GENERIC_SOCIAL_A_LEGACY_COLUMN_SHAPE_MISMATCH'
  );
});

// ─── C. Generic pair/data state ──────────────────────────────────────────────

test('rehearsal generic pair and data state fail-closed', { concurrency: false }, async () => {
  await rejectWithoutMigration(
    'gen_partial_idem',
    LEGACY_BASE + `ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16);`,
    'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE'
  );
  await rejectWithoutMigration(
    'gen_partial_audit',
    LEGACY_BASE + `ALTER TABLE public.social_audit_log ADD COLUMN target_id UUID;`,
    'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE'
  );

  // Both tables exact generic shape with row-level partial pair
  await withDisposableDb('data_partial', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await applyGuardedHappy(client, runSql, 'data_partial_setup');
    await client.query(`
      ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_pair_check;
      ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL;
      UPDATE public.social_idempotency SET target_id = NULL WHERE target_kind IS NOT NULL;
      ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL;
    `);
    await assertRejectionWithNoMutation(
      client,
      runSql,
      'data_partial',
      'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE'
    );
  });

  await withDisposableDb('data_tree', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await applyGuardedHappy(client, runSql, 'data_tree_setup');
    await client.query(`ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL`);
    await client.query(
      `UPDATE public.social_idempotency SET target_kind='tree', target_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'`
    );
    await client.query(`ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL`);
    await assertRejectionWithNoMutation(
      client,
      runSql,
      'data_tree',
      'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'
    );
  });

  await withDisposableDb('data_unknown', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await applyGuardedHappy(client, runSql, 'data_unknown_setup');
    await client.query(`
      ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL;
      ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_kind_check;
      UPDATE public.social_idempotency SET target_kind='unknown', target_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL;
    `);
    await assertRejectionWithNoMutation(
      client,
      runSql,
      'data_unknown',
      'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'
    );
  });

  await withDisposableDb('data_mis', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await applyGuardedHappy(client, runSql, 'data_mis_setup');
    await client.query(`ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL`);
    await client.query(
      `UPDATE public.social_idempotency SET target_id='ffffffff-ffff-4fff-8fff-ffffffffffff'`
    );
    await client.query(`ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL`);
    await assertRejectionWithNoMutation(
      client,
      runSql,
      'data_mis',
      'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'
    );
  });
});

// ─── D. Generic column shape (both tables) ───────────────────────────────────

test('rehearsal generic column shape fail-closed', { concurrency: false }, async () => {
  const kindShapes = [
    ['kind_int_idem', `ALTER TABLE public.social_idempotency ADD COLUMN target_kind integer, ADD COLUMN target_id UUID;
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;`],
    ['kind_v8_audit', `ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(8), ADD COLUMN target_id UUID;`],
    ['kind_nn_idem', `ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16) NOT NULL, ADD COLUMN target_id UUID;
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;`],
    ['kind_def_audit', `ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16) DEFAULT 'memory', ADD COLUMN target_id UUID;`],
  ];
  const idShapes = [
    ['id_text_idem', `ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id TEXT;
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;`],
    ['id_nn_audit', `ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID NOT NULL;`],
    [
      'id_def_idem',
      `ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID DEFAULT 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;`,
    ],
  ];
  for (const [name, alter] of [...kindShapes, ...idShapes]) {
    await rejectWithoutMigration(
      name,
      LEGACY_BASE + alter,
      'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'
    );
  }
});

// ─── E. CHECK collision (post-state mutations) ───────────────────────────────

test('rehearsal CHECK fixtures fail-closed', { concurrency: false }, async () => {
  const mutations = [
    [
      'check_wrong_pair',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check;
       ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (target_kind IS NOT NULL);`,
    ],
    [
      'check_wrong_vocab',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_kind_check;
       ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_kind_check CHECK (target_kind IS NULL OR target_kind IN ('memory', 'something'));`,
    ],
    [
      'check_not_valid',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check;
       ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL))) NOT VALID;`,
    ],
    [
      'check_weak_semantics',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check;
       ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (target_kind IS NULL OR target_id IS NULL OR target_kind IS NOT NULL OR target_id IS NOT NULL);`,
    ],
    [
      'check_shadow',
      `CREATE TABLE public.shadow_table (target_kind VARCHAR(16), target_id UUID);
       ALTER TABLE public.shadow_table ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)));`,
    ],
  ];
  for (const [name, sql] of mutations) {
    await withDisposableDb(`chk_${name}`, LEGACY_FIXTURE, async ({ client, runSql }) => {
      await applyGuardedHappy(client, runSql, `${name}_setup`);
      await client.query(sql);
      await assertRejectionWithNoMutation(
        client,
        runSql,
        name,
        'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH'
      );
    });
  }

  // Legacy state with stray A object → MIXED_STATE_REJECTED
  await rejectWithoutMigration(
    'legacy_stray_check',
    LEGACY_BASE +
      `ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_generic_target_pair_check CHECK (true);`,
    'GENERIC_SOCIAL_A_MIXED_STATE_REJECTED'
  );
});

// ─── F. Function collision ───────────────────────────────────────────────────

test('rehearsal Function fixtures fail-closed', { concurrency: false }, async () => {
  const mutations = [
    [
      'fn_lang_sql_overload',
      `CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory(integer) RETURNS integer LANGUAGE sql AS $$SELECT $1;$$;`,
    ],
    [
      'fn_overload_plpgsql',
      `CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory(a integer) RETURNS integer LANGUAGE plpgsql AS $$BEGIN RETURN a; END;$$;`,
    ],
    [
      'fn_wrong_body',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.target_kind := 'memory'; RETURN NEW; END;$$;`,
    ],
    [
      'fn_early_return',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;`,
    ],
    [
      'fn_no_tree_reject',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.target_kind IS NULL THEN NEW.target_kind := 'memory'; NEW.target_id := NEW.target_memory_id; END IF; RETURN NEW; END;$$;`,
    ],
    [
      'fn_missing_rejection',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.target_kind = 'tree' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_IMMUTABLE_TREE_TARGET_REJECTED'; END IF; NEW.target_kind := 'memory'; NEW.target_id := NEW.target_memory_id; RETURN NEW; END;$$;`,
    ],
    [
      'fn_secdef',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN RETURN NEW; END;$$;`,
    ],
    [
      'fn_volatility',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql STABLE AS $$BEGIN RETURN NEW; END;$$;`,
    ],
    [
      'fn_parallel',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql PARALLEL SAFE AS $$BEGIN RETURN NEW; END;$$;`,
    ],
    [
      'fn_ret_type',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
       DROP FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();
       CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS void LANGUAGE plpgsql AS $$BEGIN END;$$;`,
    ],
  ];
  for (const [name, sql] of mutations) {
    await withDisposableDb(`fn_${name}`, LEGACY_FIXTURE, async ({ client, runSql }) => {
      await applyGuardedHappy(client, runSql, `${name}_setup`);
      await client.query(sql);
      await assertRejectionWithNoMutation(
        client,
        runSql,
        name,
        'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH'
      );
    });
  }
});

// ─── G. Trigger collision ────────────────────────────────────────────────────

test('rehearsal Trigger fixtures fail-closed', { concurrency: false }, async () => {
  const mutations = [
    [
      'tg_wrong_fn',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
       CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT OR UPDATE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory();`,
    ],
    [
      'tg_after',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
       CREATE TRIGGER trg_social_idempotency_sync_generic_target AFTER INSERT OR UPDATE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
    ],
    [
      'tg_before_insert',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
       CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
    ],
    [
      'tg_update_only',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
       CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE UPDATE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
    ],
    [
      'tg_statement',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
       CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT OR UPDATE ON public.social_idempotency FOR EACH STATEMENT EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
    ],
    ['tg_disabled', `ALTER TABLE public.social_idempotency DISABLE TRIGGER trg_social_idempotency_sync_generic_target;`],
    [
      'tg_always',
      `ALTER TABLE public.social_idempotency ENABLE ALWAYS TRIGGER trg_social_idempotency_sync_generic_target;`,
    ],
    [
      'tg_replica',
      `ALTER TABLE public.social_idempotency ENABLE REPLICA TRIGGER trg_social_idempotency_sync_generic_target;`,
    ],
    [
      'tg_delete',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
       CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT OR UPDATE OR DELETE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
    ],
    [
      'tg_wrong_relation',
      `DROP TRIGGER trg_social_audit_log_sync_generic_target ON public.social_audit_log;
       CREATE TRIGGER trg_social_audit_log_sync_generic_target BEFORE INSERT OR UPDATE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory();`,
    ],
  ];
  for (const [name, sql] of mutations) {
    await withDisposableDb(`tg_${name}`, LEGACY_FIXTURE, async ({ client, runSql }) => {
      await applyGuardedHappy(client, runSql, `${name}_setup`);
      await client.query(sql);
      await assertRejectionWithNoMutation(
        client,
        runSql,
        name,
        'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH'
      );
    });
  }
});

// ─── H. Mixed-table unsupported state ────────────────────────────────────────

test('rehearsal mixed table states fail-closed', { concurrency: false }, async () => {
  await rejectWithoutMigration(
    'mixed_audit_partial',
    LEGACY_BASE + `ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16);`,
    'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE'
  );
  await rejectWithoutMigration(
    'mixed_idem_exact_post',
    LEGACY_BASE +
      `ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;`,
    'GENERIC_SOCIAL_A_MIXED_STATE_REJECTED'
  );

  await withDisposableDb('mixed_audit_wrong_shape', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await applyGuardedHappy(client, runSql, 'mixed_shape_setup');
    // Keep idempotency exact; rebuild audit generic columns with wrong shape.
    await client.query(`
      DROP TRIGGER IF EXISTS trg_social_audit_log_sync_generic_target ON public.social_audit_log;
      ALTER TABLE public.social_audit_log
        DROP CONSTRAINT IF EXISTS social_audit_log_generic_target_pair_check,
        DROP CONSTRAINT IF EXISTS social_audit_log_generic_target_kind_check;
      ALTER TABLE public.social_audit_log DROP COLUMN target_kind;
      ALTER TABLE public.social_audit_log DROP COLUMN target_id;
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind integer;
      ALTER TABLE public.social_audit_log ADD COLUMN target_id UUID;
    `);
    const before = await getCatalogFingerprint(client);
    await assertRejectionWithNoMutation(
      client,
      runSql,
      'mixed_audit_wrong_shape',
      'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'
    );
    // Supported table (idem) must not receive further mutation from rejection path
    assert.equal(await tableExistsOrdinary(client, TABLES.idem), true);
    await assertNoMutation(client, before);
  });
});

// ─── Postcondition independent evidence ──────────────────────────────────────

test('rehearsal postcondition rejects mutated states', { concurrency: false }, async () => {
  const mutations = [
    [
      'post_wrong_check',
      `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_pair_check;
       ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_generic_target_pair_check CHECK (target_kind IS NOT NULL);`,
    ],
    [
      'post_unvalidated_check',
      `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_pair_check;
       ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_generic_target_pair_check CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL))) NOT VALID;`,
    ],
    [
      'post_check_shadow',
      `CREATE TABLE public.shadow_table_post (target_kind VARCHAR(16), target_id UUID);
       ALTER TABLE public.shadow_table_post ADD CONSTRAINT social_idempotency_generic_target_pair_check CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)));`,
    ],
    [
      'post_fn_lang_sql_overload',
      `CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory(integer) RETURNS integer LANGUAGE sql AS $$SELECT $1;$$;`,
    ],
    [
      'post_fn_overload_plpgsql',
      `CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory(a integer) RETURNS integer LANGUAGE plpgsql AS $$BEGIN RETURN a; END;$$;`,
    ],
    [
      'post_wrong_function_body',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;`,
    ],
    [
      'post_sec_def_function',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN NEW.target_kind := 'memory'; NEW.target_id := NEW.target_memory_id; RETURN NEW; END;$$;`,
    ],
    [
      'post_fn_missing_rejection',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.target_kind = 'tree' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_IMMUTABLE_TREE_TARGET_REJECTED'; END IF; NEW.target_kind := 'memory'; NEW.target_id := NEW.target_memory_id; RETURN NEW; END;$$;`,
    ],
    ['post_tg_disabled', `ALTER TABLE public.social_idempotency DISABLE TRIGGER trg_social_idempotency_sync_generic_target;`],
    [
      'post_tg_always',
      `ALTER TABLE public.social_idempotency ENABLE ALWAYS TRIGGER trg_social_idempotency_sync_generic_target;`,
    ],
    [
      'post_tg_replica',
      `ALTER TABLE public.social_idempotency ENABLE REPLICA TRIGGER trg_social_idempotency_sync_generic_target;`,
    ],
    [
      'post_tg_insert_only',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
       CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
    ],
    [
      'post_wrong_trigger_function',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
       CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT OR UPDATE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory();`,
    ],
    ['post_target_kind_default', `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind SET DEFAULT 'memory';`],
    ['post_target_id_not_null', `ALTER TABLE public.social_idempotency ALTER COLUMN target_id SET NOT NULL;`],
    ['post_wrong_generic_type', `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind TYPE VARCHAR(32);`],
  ];

  for (const [name, sql] of mutations) {
    await withDisposableDb(`post_${name}`, LEGACY_FIXTURE, async ({ client, runSql }) => {
      await applyGuardedHappy(client, runSql, `${name}_setup`);
      await client.query(sql);
      const mutatedFp = await getCatalogFingerprint(client);
      const beforeRowsI = await getFullRowFingerprint(client, 'idem');
      const beforeRowsA = await getFullRowFingerprint(client, 'audit');
      const post = runSql(POSTCOND);
      expectFail(post, name, 'postcondition');
      assertCategory(post, 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED');
      assert.ok(fingerprintEqual(mutatedFp, await getCatalogFingerprint(client)), 'postcondition must not mutate');
      assert.equal((await getFullRowFingerprint(client, 'idem')).rowFp, beforeRowsI.rowFp);
      assert.equal((await getFullRowFingerprint(client, 'audit')).rowFp, beforeRowsA.rowFp);
      pass(`rehearsal post reject ${name}`);
    });
  }
});

// ─── Suite never executes Migration B ────────────────────────────────────────

test('rehearsal suite never executes Migration B path', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(__filename, 'utf8');
  assert.ok(fs.existsSync(MIG_B));
  assert.equal(/(?:^|[^=])\s*runSql\s*\(\s*MIG_B\s*\)/m.test(src), false);
  assert.match(src, /runGuardedSequence/);
  assert.match(src, /runSql\(PREFLIGHT\)/);
  assert.match(src, /runSql\(MIG_A\)/);
  assert.match(src, /runSql\(POSTCOND\)/);
  assert.equal(/process\.env\.DATABASE_URL/i.test(src), false);
  pass('rehearsal no Migration B');
});
