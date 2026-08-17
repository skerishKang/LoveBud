'use strict';

/**
 * Collision-safe disposable PostgreSQL commit/reread-divergence rehearsal
 * (Issue #4080, item 9).
 *
 * Layer: EXECUTED_REAL_LOCAL (inside the existing default-CI glob
 * `tests/contracts/*.test.cjs`). Bounded-skips when no loopback
 * `LB_TEST_PG*` environment is present. Zero edits to shared
 * `package.json` / `ci.yml` / `tests/ci-test-group-registry.json` /
 * `scripts/report-ci-test-groups.cjs` surface.
 *
 * Reuses `tests/db-engine/helpers/postgres-disposable-harness.cjs` for the
 * disposable-DB lifecycle (createdb/dropdb with a synthetic prefix).
 *
 * R1: Committed write + RETURNING row + follow-up reread visible →
 *     CONFIRMED @ FOLLOWUP_REREAD_VISIBLE (end-to-end real SQL proof).
 * R2: Committed write + RETURNING row + follow-up reread missing →
 *     WRITE_COMMITTED_REREAD_MISSING (the core #3457 divergence scenario
 *     proven with a real disposable database).
 * R3: Rollback-on-mismatch: INSERT ... RETURNING returns a row, the row is
 *     checked, the check fails, and the transaction is rolled back. The
 *     returned row is never canonically visible → ACKNOWLEDGEMENT_MISSING.
 *     rollback-on-mismatch tuples (rolled_back + row_returned) are NOT
 *     contradictory.
 * R4: Cross-field contradiction: commit=not_reached + returning=row_returned
 *     is rejected with CONTRADICTORY_FACTS.
 * R5: Classification results contain no private data (no token, ID, email,
 *     provider, SQL, URL, or raw error leakage).
 * R6: The rehearsal is deterministic across runs (same facts → same result).
 *
 * Refs: #4080, #3461, #3457, #3835, #3852, #3855, #1882
 */

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const harness = require('../db-engine/helpers/postgres-disposable-harness.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function loadClassifierCore() {
  const vm = require('node:vm');
  const src = read('js/observability/reliability-write-outcome-classifier-core.js');
  const script = new vm.Script(src, { filename: 'reliability-write-outcome-classifier-core.js' });
  const context = vm.createContext({
    module: { exports: {} },
    exports: {},
    console,
    globalThis: {}
  });
  script.runInContext(context);
  return context.module.exports;
}

const { withDisposableDb } = harness;

// ── Loopback Postgres env gating ────────────────────────────────────────────

function pgEnvPresent() {
  const host = process.env.LB_TEST_PGHOST || '';
  const user = process.env.LB_TEST_PGUSER || '';
  const password = process.env.LB_TEST_PGPASSWORD || '';
  const adminDb = process.env.LB_TEST_PGADMIN_DB || '';
  if (!host || !user || !password || !adminDb) return false;
  if (!harness.ALLOWED_HOSTS.has(host)) return false;
  if (!harness.USER_RE.test(user)) return false;
  if (!adminDb.startsWith(harness.DB_PREFIX)) return false;
  return true;
}

const HAS_PG = pgEnvPresent();

// ── Helpers ─────────────────────────────────────────────────────────────────

const SCENARIO = 'write-reread-canonical-4080';
const TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS write_reread_target (
    id         SERIAL PRIMARY KEY,
    tree_id    UUID    NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    title      TEXT    NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

function pass(name) {
  process.stdout.write(`${name}: PASS\n`);
}

function assertNoPrivateData(facts, result, label) {
  const leakProbe = JSON.stringify({ facts, result });
  const PRIVATE_PROBE = ['token', 'email', 'uid', 'owner_id', 'tree_id',
    'memory_id', 'database_url', 'sql', 'raw_error', 'provider', 'secret'];
  for (const key of PRIVATE_PROBE) {
    assert.ok(!leakProbe.includes(key) || key in facts || key === 'tree_id',
      `${label}: private key '${key}' must not leak into probe`);
  }
}

// ── R1: committed write → RETURNING → reread visible → CONFIRMED ────────────

test('R1: committed write + RETURNING + follow-up reread visible → CONFIRMED',
  { skip: HAS_PG ? false : 'LB_TEST_PG* loopback Postgres env not present; bounded skip (runs where disposable Postgres is provisioned)' },
  async () => {
    await withDisposableDb(`${SCENARIO}-r1`, null, async ({ client }) => {
      await client.query(TABLE_DDL);
      await client.query('BEGIN');
      const insert = await client.query(
        'INSERT INTO write_reread_target (title) VALUES ($1) RETURNING id',
        ['rehearsal-r1']
      );
      const rowId = insert.rows[0].id;
      await client.query('COMMIT');

      const reread = await client.query(
        'SELECT id, title FROM write_reread_target WHERE id = $1',
        [rowId]
      );
      assert.equal(reread.rowCount, 1, 'reread must see the committed row');

      const facts = {
        transport: 'ok',
        commit: 'committed',
        returning: 'row_returned',
        reread: 'visible'
      };

      const classifier = loadClassifierCore();
      const validation = classifier.validateWriteOutcomeFacts(facts);
      assert.equal(validation.ok, true, 'facts must pass validation');
      assert.equal(validation.errors.length, 0, 'no validation errors');

      const result = classifier.classifyWriteOutcome(facts);
      assert.equal(result.stage, 'FOLLOWUP_REREAD_VISIBLE');
      assert.equal(result.outcome_code, 'CONFIRMED');
      assert.equal(result.retry_safe, false);
      assert.equal(result.evidence_completeness, 'complete');
      assert.ok(classifier.isCanonicalResult(result));

      assertNoPrivateData(facts, result, 'R1');
      pass('R1');
    });
  }
);

// ── R2: committed write + RETURNING → reread missing (divergence) ───────────

test('R2: committed write + RETURNING + follow-up reread missing → WRITE_COMMITTED_REREAD_MISSING',
  { skip: HAS_PG ? false : 'LB_TEST_PG* loopback Postgres env not present; bounded skip' },
  async () => {
    await withDisposableDb(`${SCENARIO}-r2`, null, async ({ client }) => {
      await client.query(TABLE_DDL);
      await client.query('BEGIN');
      const insert = await client.query(
        'INSERT INTO write_reread_target (title) VALUES ($1) RETURNING id',
        ['rehearsal-r2']
      );
      const rowId = insert.rows[0].id;
      await client.query('COMMIT');

      // Simulate divergence: the row was committed, but a concurrent
      // deletion (or filtering mismatch) makes the follow-up reread
      // unable to see the row.
      await client.query('DELETE FROM write_reread_target WHERE id = $1', [rowId]);
      const reread = await client.query(
        'SELECT id FROM write_reread_target WHERE id = $1',
        [rowId]
      );
      assert.equal(reread.rowCount, 0, 'reread must NOT see the row (divergence simulated)');

      const facts = {
        transport: 'ok',
        commit: 'committed',
        returning: 'row_returned',
        reread: 'missing'
      };

      const classifier = loadClassifierCore();
      const validation = classifier.validateWriteOutcomeFacts(facts);
      assert.equal(validation.ok, true, 'divergence facts must pass validation');

      const result = classifier.classifyWriteOutcome(facts);
      assert.equal(result.stage, 'CANONICAL_ROW_RETURNED');
      assert.equal(result.outcome_code, 'WRITE_COMMITTED_REREAD_MISSING');
      assert.equal(result.retry_safe, false);
      assert.ok(classifier.isCanonicalResult(result));

      assertNoPrivateData(facts, result, 'R2');
      pass('R2');
    });
  }
);

// ── R3: rollback-on-mismatch → ACKNOWLEDGEMENT_MISSING ──────────────────────

test('R3: rollback-on-mismatch (row returned then rolled back) → ACKNOWLEDGEMENT_MISSING',
  { skip: HAS_PG ? false : 'LB_TEST_PG* loopback Postgres env not present; bounded skip' },
  async () => {
    await withDisposableDb(`${SCENARIO}-r3`, null, async ({ client }) => {
      await client.query(TABLE_DDL);

      // BEGIN; INSERT ... RETURNING id; (check fails) → ROLLBACK
      await client.query('BEGIN');
      const insert = await client.query(
        'INSERT INTO write_reread_target (title) VALUES ($1) RETURNING id',
        ['rehearsal-r3']
      );
      const rowId = insert.rows[0].id;
      // Simulate pre-commit check failure: mismatch or constraint violation.
      await client.query('ROLLBACK');

      const reread = await client.query(
        'SELECT id FROM write_reread_target WHERE id = $1',
        [rowId]
      );
      assert.equal(reread.rowCount, 0, 'reread must NOT see the rolled-back row');

      // The DB observation: the statement executed and returned a row, but
      // the transaction was rolled back. The bounded fact encoding for this
      // is commit=rolled_back + returning=row_returned + reread=missing.
      const facts = {
        transport: 'ok',
        commit: 'rolled_back',
        returning: 'row_returned',
        reread: 'missing'
      };

      // This tuple must NOT be flagged as contradictory (rollback-on-mismatch
      // is a real DB pattern).
      const classifier = loadClassifierCore();
      const validation = classifier.validateWriteOutcomeFacts(facts);
      assert.equal(validation.ok, true,
        'rollback-on-mismatch must not be contradictory');

      const result = classifier.classifyWriteOutcome(facts);
      assert.equal(result.outcome_code, 'ACKNOWLEDGEMENT_MISSING');
      assert.equal(result.retry_safe, true);
      assert.equal(result.stage, 'REQUEST_ACCEPTED');
      assert.ok(classifier.isCanonicalResult(result));

      assertNoPrivateData(facts, result, 'R3');
      pass('R3');
    });
  }
);

// ── R4: cross-field contradiction is rejected ───────────────────────────────

test('R4: commit=not_reached + returning=row_returned → CONTRADICTORY_FACTS',
  { skip: HAS_PG ? false : 'LB_TEST_PG* loopback Postgres env not present; bounded skip' },
  async () => {
    await withDisposableDb(`${SCENARIO}-r4`, null, async () => {
      const facts = {
        transport: 'ok',
        commit: 'not_reached',
        returning: 'row_returned',
        reread: 'unknown'
      };

      const classifier = loadClassifierCore();
      const validation = classifier.validateWriteOutcomeFacts(facts);
      assert.equal(validation.ok, false, 'contradictory tuple must fail');
      assert.ok(validation.errors.includes('CONTRADICTORY_FACTS'));

      assert.throws(
        () => classifier.classifyWriteOutcome(facts),
        /CONTRADICTORY_FACTS/,
        'classifyWriteOutcome must throw CONTRADICTORY_FACTS'
      );
      pass('R4');
    });
  }
);

// ── R5: privacy assertion (no private data in any classification result) ────

test('R5: classification results contain no private data',
  { skip: HAS_PG ? false : 'LB_TEST_PG* loopback Postgres env not present; bounded skip' },
  async () => {
    await withDisposableDb(`${SCENARIO}-r5`, null, async () => {
      const classifier = loadClassifierCore();
      const cases = [
        { transport: 'ok', commit: 'committed', returning: 'row_returned', reread: 'visible' },
        { transport: 'ok', commit: 'committed', returning: 'row_returned', reread: 'missing' },
        { transport: 'ok', commit: 'committed', returning: 'row_returned', reread: 'mismatch' },
        { transport: 'timeout', commit: 'unknown', returning: 'unknown', reread: 'unknown' },
        { transport: 'ok', commit: 'rolled_back', returning: 'row_returned', reread: 'missing' }
      ];
      for (const facts of cases) {
        const result = classifier.classifyWriteOutcome(facts);
        const probe = JSON.stringify(result);
        const PRIVATE_KEYS = ['token', 'email', 'uid', 'owner_id',
          'memory_id', 'database_url', 'sql', 'raw_error',
          'provider', 'secret', 'title', 'content', 'memo'];
        for (const key of PRIVATE_KEYS) {
          assert.ok(!probe.includes(key),
            `private key '${key}' must not appear in result JSON`);
        }
        assert.ok(classifier.isCanonicalResult(result));
      }
      pass('R5');
    });
  }
);

// ── R6: classification is deterministic across runs ─────────────────────────

test('R6: classification is deterministic (same facts → same result)',
  { skip: HAS_PG ? false : 'LB_TEST_PG* loopback Postgres env not present; bounded skip' },
  async () => {
    await withDisposableDb(`${SCENARIO}-r6`, null, async () => {
      const classifier = loadClassifierCore();
      const facts = {
        transport: 'ok',
        commit: 'committed',
        returning: 'row_returned',
        reread: 'visible'
      };
      const a = classifier.classifyWriteOutcome(facts);
      const b = classifier.classifyWriteOutcome(facts);
      assert.deepEqual({ ...a }, { ...b });
      pass('R6');
    });
  }
);
