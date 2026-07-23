'use strict';

/**
 * Focused SOURCE_STATIC contract test: canonical migration runner orchestrator
 * (#3458, fifth slice).
 *
 * Exercises scripts/migration-runner-orchestrator-core.cjs (runCanonicalMigration)
 * using ONLY synthetic JavaScript mocks. No DB, PostgreSQL, Docker, SQL fixture,
 * network, filesystem write, or environment secret is used. Tests call the real
 * runCanonicalMigration(); they do not prove behavior by comment/string presence.
 *
 * Refs #3458
 * Refs #3425 - Keep #3425 OPEN.
 * Refs #3435 - Keep #3435 OPEN.
 * Refs #3437 - Keep #3437 OPEN.
 * Refs #1882 - Keep #1882 OPEN.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CORE_PATH = path.join(REPO_ROOT, 'scripts', 'migration-runner-orchestrator-core.cjs');
const orch = require(CORE_PATH);

const {
  runCanonicalMigration,
  ORCHESTRATION_OUTCOMES,
  ORCHESTRATION_STAGES,
  ORCHESTRATION_BLOCKERS,
  ORCHESTRATION_EVENTS,
  REQUIRED_DEPENDENCY_NAMES
} = orch;

const HANDLE = 'OPAQUE_LOCK_HANDLE_SECRET';
const CANONICAL_TS = '2026-01-01T00:00:00.000Z';
const TARGET_ID = '20260101000000_first';
const TARGET_CHECKSUM = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function defaultTarget(over) {
  return {
    id: TARGET_ID,
    checksum: TARGET_CHECKSUM,
    depends_on: [],
    transaction_mode: 'REQUIRED',
    risk_class: 'ADDITIVE',
    destructive_operations: [],
    ...(over || {})
  };
}

function committedRecord(id, checksum) {
  return {
    migration_id: id || TARGET_ID,
    content_checksum: checksum || TARGET_CHECKSUM,
    applied_at: CANONICAL_TS,
    runner_version: '1.0.0',
    environment_class: 'disposable',
    deployed_commit: 'sha256:commit',
    transaction_outcome: 'COMMITTED'
  };
}

// Build tracked mocks. Each dependency records { name, args } and returns the
// configured value (sync or async). `overrides` replaces individual dependencies.
function createMocks(overrides) {
  const calls = [];
  const defaults = {
    validateSource: () => ({ status: 'PASS' }),
    loadManifest: () => ({ status: 'ACTIVE', migrations: [defaultTarget()] }),
    acquireAdvisoryLock: () => ({ status: 'ACQUIRED', handle: HANDLE }),
    readLedger: () => [],
    evaluatePrecondition: () => ({ status: 'PASS' }),
    executeMigration: () => ({ executionOutcome: 'SUCCEEDED', transactionOutcome: 'COMMITTED' }),
    evaluatePostcondition: () => ({ status: 'PASS' }),
    checkAdvisoryLock: () => ({ status: 'ACQUIRED' }),
    appendLedgerRecord: () => ({ status: 'APPENDED' }),
    releaseAdvisoryLock: () => ({ status: 'RELEASED' }),
    now: () => CANONICAL_TS
  };
  const fns = { ...defaults, ...(overrides || {}) };
  const deps = {};
  for (const name of Object.keys(fns)) {
    deps[name] = (...args) => { calls.push({ name, args }); return fns[name](...args); };
  }
  return { deps, calls };
}

function makeInput(deps, overrides) {
  return {
    targetMigrationId: TARGET_ID,
    requestedAction: 'APPLY_FORWARD',
    runtimeMetadata: { runnerVersion: '1.0.0', environmentClass: 'disposable', deployedCommit: 'sha256:commit' },
    dependencies: deps,
    ...(overrides || {})
  };
}

function countCalls(calls, name) {
  return calls.filter((c) => c.name === name).length;
}

const ALL_EVENTS = new Set(Object.values(ORCHESTRATION_EVENTS));

describe('DB canonical runner orchestrator contract (#3458)', () => {

  describe('1. Basic success', () => {
    it('valid apply yields EXECUTED_AND_RECORDED', async () => {
      const { deps } = createMocks();
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.EXECUTED_AND_RECORDED);
      assert.strictEqual(r.stage, ORCHESTRATION_STAGES.COMPLETED);
    });
    it('calls dependencies in the exact order', async () => {
      const { deps, calls } = createMocks();
      await runCanonicalMigration(makeInput(deps));
      const order = calls.map((c) => c.name);
      assert.deepStrictEqual(order, [
        'validateSource', 'loadManifest', 'acquireAdvisoryLock', 'readLedger',
        'evaluatePrecondition', 'executeMigration', 'evaluatePostcondition',
        'checkAdvisoryLock', 'now', 'appendLedgerRecord', 'releaseAdvisoryLock'
      ]);
    });
    it('sets the exact result flags', async () => {
      const { deps } = createMocks();
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.executionAttempted, true);
      assert.strictEqual(r.ledgerAppendAttempted, true);
      assert.strictEqual(r.ledgerAppended, true);
      assert.strictEqual(r.lockAcquired, true);
      assert.strictEqual(r.lockReleased, true);
      assert.deepStrictEqual(r.blockers, []);
    });
    it('passes protocol binding id/checksum/mode/destructive to execution', async () => {
      const { deps, calls } = createMocks();
      await runCanonicalMigration(makeInput(deps));
      const execCall = calls.find((c) => c.name === 'executeMigration');
      const arg = execCall.args[0];
      assert.strictEqual(arg.migrationId, TARGET_ID);
      assert.strictEqual(arg.migrationChecksum, TARGET_CHECKSUM);
      assert.strictEqual(arg.transactionMode, 'REQUIRED');
      assert.strictEqual(arg.destructive, false);
      assert.ok(!('manifest' in arg) && !('sql' in arg) && !('credential' in arg));
    });
    it('builds a ledger record with exactly the 7 authoritative fields', async () => {
      const { deps, calls } = createMocks();
      await runCanonicalMigration(makeInput(deps));
      const appendCall = calls.find((c) => c.name === 'appendLedgerRecord');
      const record = appendCall.args[0].record;
      assert.deepStrictEqual(Object.keys(record).sort(), [
        'applied_at', 'content_checksum', 'deployed_commit', 'environment_class',
        'migration_id', 'runner_version', 'transaction_outcome'
      ]);
      assert.strictEqual(record.transaction_outcome, 'COMMITTED');
      assert.strictEqual(record.migration_id, TARGET_ID);
      assert.strictEqual(record.content_checksum, TARGET_CHECKSUM);
    });
    it('passes runtime metadata exactly into the ledger record', async () => {
      const { deps, calls } = createMocks();
      await runCanonicalMigration(makeInput(deps, { runtimeMetadata: { runnerVersion: 'v9', environmentClass: 'ec', deployedCommit: 'dc' } }));
      const record = calls.find((c) => c.name === 'appendLedgerRecord').args[0].record;
      assert.strictEqual(record.runner_version, 'v9');
      assert.strictEqual(record.environment_class, 'ec');
      assert.strictEqual(record.deployed_commit, 'dc');
    });
    it('uses a canonical UTC timestamp from now()', async () => {
      const { deps, calls } = createMocks();
      await runCanonicalMigration(makeInput(deps));
      const record = calls.find((c) => c.name === 'appendLedgerRecord').args[0].record;
      assert.strictEqual(record.applied_at, CANONICAL_TS);
      assert.ok(record.applied_at.endsWith('Z'));
      assert.strictEqual(new Date(record.applied_at).toISOString(), record.applied_at);
    });
    it('supports sync dependencies', async () => {
      const { deps } = createMocks();
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.EXECUTED_AND_RECORDED);
    });
    it('supports async dependencies', async () => {
      const { deps } = createMocks({
        validateSource: async () => ({ status: 'PASS' }),
        executeMigration: async () => ({ executionOutcome: 'SUCCEEDED', transactionOutcome: 'COMMITTED' }),
        now: async () => CANONICAL_TS
      });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.EXECUTED_AND_RECORDED);
    });
    it('is deterministic for repeated identical input', async () => {
      const a = await runCanonicalMigration(makeInput(createMocks().deps));
      const b = await runCanonicalMigration(makeInput(createMocks().deps));
      assert.deepStrictEqual(a, b);
    });
    it('does not modify the input object', async () => {
      const { deps } = createMocks();
      const inp = makeInput(deps);
      const before = JSON.parse(JSON.stringify(inp));
      await runCanonicalMigration(inp);
      assert.deepStrictEqual(JSON.parse(JSON.stringify(inp)), before);
    });
    it('does not modify dependency return objects', async () => {
      const manifest = { status: 'ACTIVE', migrations: [defaultTarget()] };
      const { deps } = createMocks({ loadManifest: () => manifest });
      const before = JSON.parse(JSON.stringify(manifest));
      await runCanonicalMigration(makeInput(deps));
      assert.deepStrictEqual(JSON.parse(JSON.stringify(manifest)), before);
    });
    it('returns sorted unique blockers', async () => {
      const { deps } = createMocks({ validateSource: () => ({ status: 'FAIL' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.deepStrictEqual(r.blockers, [...new Set(r.blockers)].sort());
    });
    it('emits only fixed-vocabulary events', async () => {
      const { deps } = createMocks();
      const r = await runCanonicalMigration(makeInput(deps));
      for (const e of r.events) assert.ok(ALL_EVENTS.has(e), e);
    });
  });

  describe('2. NOOP', () => {
    function noopMocks() {
      return createMocks({ readLedger: () => [committedRecord()] });
    }
    it('protocol NOOP yields NOOP_ALREADY_APPLIED', async () => {
      const { deps } = noopMocks();
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.NOOP_ALREADY_APPLIED);
      assert.ok(r.events.includes(ORCHESTRATION_EVENTS.PREFLIGHT_NOOP));
    });
    it('does not execute', async () => {
      const { deps, calls } = noopMocks();
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'executeMigration'), 0);
    });
    it('does not evaluate postcondition', async () => {
      const { deps, calls } = noopMocks();
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'evaluatePostcondition'), 0);
    });
    it('does not recheck the lock', async () => {
      const { deps, calls } = noopMocks();
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'checkAdvisoryLock'), 0);
    });
    it('does not call now()', async () => {
      const { deps, calls } = noopMocks();
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'now'), 0);
    });
    it('does not append', async () => {
      const { deps, calls } = noopMocks();
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'appendLedgerRecord'), 0);
    });
    it('releases the lock exactly once', async () => {
      const { deps, calls } = noopMocks();
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'releaseAdvisoryLock'), 1);
    });
    it('sets execution/append flags false', async () => {
      const { deps } = noopMocks();
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.executionAttempted, false);
      assert.strictEqual(r.ledgerAppendAttempted, false);
      assert.strictEqual(r.ledgerAppended, false);
    });
  });

  describe('3. Initial fail-closed', () => {
    it('rejects each missing/empty runtimeMetadata field', async () => {
      for (const field of ['runnerVersion', 'environmentClass', 'deployedCommit']) {
        for (const bad of [undefined, '']) {
          const { deps, calls } = createMocks();
          const md = { runnerVersion: '1.0.0', environmentClass: 'disposable', deployedCommit: 'sha256:commit' };
          md[field] = bad;
          const r = await runCanonicalMigration(makeInput(deps, { runtimeMetadata: md }));
          assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION, field);
          assert.strictEqual(r.stage, ORCHESTRATION_STAGES.INITIAL, field);
          assert.ok(r.blockers.includes(ORCHESTRATION_BLOCKERS.ORCHESTRATOR_RUNTIME_METADATA_INVALID), field);
          assert.strictEqual(calls.length, 0, field);
        }
      }
    });
    it('rejects each missing required dependency', async () => {
      for (const name of REQUIRED_DEPENDENCY_NAMES) {
        const { deps, calls } = createMocks();
        delete deps[name];
        const r = await runCanonicalMigration(makeInput(deps));
        assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION, name);
        assert.strictEqual(r.stage, ORCHESTRATION_STAGES.INITIAL, name);
        assert.ok(r.blockers.includes(`${ORCHESTRATION_BLOCKERS.ORCHESTRATOR_DEPENDENCY_MISSING}:${name}`), name);
        assert.strictEqual(calls.length, 0, name);
      }
    });
    it('rejects a non-function dependency', async () => {
      const { deps, calls } = createMocks();
      deps.now = 'not-a-function'; // directly non-callable
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
      assert.strictEqual(r.stage, ORCHESTRATION_STAGES.INITIAL);
      assert.ok(r.blockers.includes(`${ORCHESTRATION_BLOCKERS.ORCHESTRATOR_DEPENDENCY_MISSING}:now`));
      assert.strictEqual(calls.length, 0);
    });
    it('source FAIL fails closed', async () => {
      const { deps } = createMocks({ validateSource: () => ({ status: 'FAIL' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
      assert.strictEqual(r.stage, ORCHESTRATION_STAGES.SOURCE_VALIDATION);
    });
    it('source UNAVAILABLE fails closed', async () => {
      const { deps } = createMocks({ validateSource: () => ({ status: 'UNAVAILABLE' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
      assert.strictEqual(r.stage, ORCHESTRATION_STAGES.SOURCE_VALIDATION);
    });
    it('inactive manifest fails closed', async () => {
      const { deps } = createMocks({ loadManifest: () => ({ status: 'ADOPTION_REQUIRED', migrations: [defaultTarget()] }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
    });
    it('malformed manifest result fails closed', async () => {
      for (const bad of [null, { status: 'ACTIVE' }, { migrations: [] }]) {
        const { deps } = createMocks({ loadManifest: () => bad });
        const r = await runCanonicalMigration(makeInput(deps));
        assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
        assert.ok(r.blockers.includes(`${ORCHESTRATION_BLOCKERS.ORCHESTRATOR_DEPENDENCY_RESULT_INVALID}:loadManifest`));
      }
    });
    it('invalid requestedAction fails closed', async () => {
      const { deps } = createMocks();
      const r = await runCanonicalMigration(makeInput(deps, { requestedAction: 'RUN_DOWN_MIGRATION' }));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
    });
    it('lock NOT_ATTEMPTED fails closed', async () => {
      const { deps } = createMocks({ acquireAdvisoryLock: () => ({ status: 'NOT_ATTEMPTED' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
      assert.strictEqual(r.stage, ORCHESTRATION_STAGES.LOCK_ACQUIRE);
    });
    it('lock FAILED fails closed', async () => {
      const { deps } = createMocks({ acquireAdvisoryLock: () => ({ status: 'FAILED' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
    });
    it('lock UNAVAILABLE fails closed', async () => {
      const { deps } = createMocks({ acquireAdvisoryLock: () => ({ status: 'UNAVAILABLE' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
    });
    it('when lock not acquired, ledger/precondition/release are not called', async () => {
      const { deps, calls } = createMocks({ acquireAdvisoryLock: () => ({ status: 'FAILED' }) });
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'readLedger'), 0);
      assert.strictEqual(countCalls(calls, 'evaluatePrecondition'), 0);
      assert.strictEqual(countCalls(calls, 'releaseAdvisoryLock'), 0);
    });
    it('ledger non-array fails closed', async () => {
      const { deps } = createMocks({ readLedger: () => ({ not: 'array' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
      assert.ok(r.blockers.includes(`${ORCHESTRATION_BLOCKERS.ORCHESTRATOR_DEPENDENCY_RESULT_INVALID}:readLedger`));
    });
    it('ledger throw fails closed', async () => {
      const { deps } = createMocks({ readLedger: () => { throw new Error('boom'); } });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
      assert.ok(r.blockers.includes(`${ORCHESTRATION_BLOCKERS.ORCHESTRATOR_DEPENDENCY_FAILED}:readLedger`));
    });
    it('precondition FAIL fails closed', async () => {
      const { deps } = createMocks({ evaluatePrecondition: () => ({ status: 'FAIL' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
    });
    it('precondition UNAVAILABLE fails closed', async () => {
      const { deps } = createMocks({ evaluatePrecondition: () => ({ status: 'UNAVAILABLE' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
    });
    it('precondition NOT_EVALUATED fails closed', async () => {
      const { deps } = createMocks({ evaluatePrecondition: () => ({ status: 'NOT_EVALUATED' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION);
    });
    it('preflight blocked means execute 0', async () => {
      const { deps, calls } = createMocks({ evaluatePrecondition: () => ({ status: 'FAIL' }) });
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'executeMigration'), 0);
    });
  });

  describe('4. Execution and completion', () => {
    it('execution FAILED + ROLLED_BACK is completion-blocked', async () => {
      const { deps } = createMocks({ executeMigration: () => ({ executionOutcome: 'FAILED', transactionOutcome: 'ROLLED_BACK' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
    });
    it('execution UNKNOWN is completion-blocked', async () => {
      const { deps } = createMocks({ executeMigration: () => ({ executionOutcome: 'UNKNOWN', transactionOutcome: 'UNKNOWN' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
    });
    it('execution throw (ordinary) is completion-blocked with manual reconciliation', async () => {
      const { deps } = createMocks({ executeMigration: () => { throw new Error('secret-detail'); } });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
      assert.strictEqual(r.recoveryDecision, 'MANUAL_RECONCILIATION_REQUIRED');
    });
    it('execution throw (destructive) escalates to snapshot restore', async () => {
      const destructiveTarget = defaultTarget({ risk_class: 'DESTRUCTIVE', destructive_operations: ['DROP_TABLE'] });
      const { deps } = createMocks({
        loadManifest: () => ({ status: 'ACTIVE', migrations: [destructiveTarget] }),
        executeMigration: () => { throw new Error('x'); }
      });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
      assert.strictEqual(r.recoveryDecision, 'SNAPSHOT_RESTORE_DECISION_REQUIRED');
    });
    it('execution malformed result is completion-blocked', async () => {
      const { deps } = createMocks({ executeMigration: () => ({ executionOutcome: 'WEIRD' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
      assert.ok(r.blockers.includes(`${ORCHESTRATION_BLOCKERS.ORCHESTRATOR_DEPENDENCY_RESULT_INVALID}:executeMigration`));
    });
    it('destructive PARTIAL transaction escalates to snapshot restore', async () => {
      const destructiveTarget = defaultTarget({ risk_class: 'DESTRUCTIVE', destructive_operations: ['DROP_TABLE'] });
      const { deps } = createMocks({
        loadManifest: () => ({ status: 'ACTIVE', migrations: [destructiveTarget] }),
        executeMigration: () => ({ executionOutcome: 'SUCCEEDED', transactionOutcome: 'PARTIAL' })
      });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
      assert.strictEqual(r.recoveryDecision, 'SNAPSHOT_RESTORE_DECISION_REQUIRED');
    });
    it('postcondition FAIL is completion-blocked', async () => {
      const { deps } = createMocks({ evaluatePostcondition: () => ({ status: 'FAIL' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
    });
    it('postcondition UNAVAILABLE is completion-blocked', async () => {
      const { deps } = createMocks({ evaluatePostcondition: () => ({ status: 'UNAVAILABLE' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
    });
    it('postcondition throw is completion-blocked', async () => {
      const { deps } = createMocks({ evaluatePostcondition: () => { throw new Error('x'); } });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
    });
    it('lock LOST at recheck is completion-blocked', async () => {
      const { deps } = createMocks({ checkAdvisoryLock: () => ({ status: 'LOST' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
    });
    it('lock recheck FAILED is completion-blocked', async () => {
      const { deps } = createMocks({ checkAdvisoryLock: () => ({ status: 'FAILED' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
    });
    it('lock recheck throw is completion-blocked', async () => {
      const { deps } = createMocks({ checkAdvisoryLock: () => { throw new Error('x'); } });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
    });
    it('completion blocked means append 0', async () => {
      const { deps, calls } = createMocks({ evaluatePostcondition: () => ({ status: 'FAIL' }) });
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'appendLedgerRecord'), 0);
    });
    it('caller-supplied ledgerAppendAuthorized=true is ignored', async () => {
      const { deps, calls } = createMocks({ evaluatePostcondition: () => ({ status: 'FAIL' }) });
      await runCanonicalMigration(makeInput(deps, { ledgerAppendAuthorized: true }));
      assert.strictEqual(countCalls(calls, 'appendLedgerRecord'), 0);
    });
    it('forged dependency authorization is ignored', async () => {
      // A dependency cannot grant append authorization; only the protocol can.
      const { deps, calls } = createMocks({
        checkAdvisoryLock: () => ({ status: 'LOST', ledgerAppendAuthorized: true })
      });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED);
      assert.strictEqual(countCalls(calls, 'appendLedgerRecord'), 0);
    });
  });

  describe('5. Append', () => {
    it('invalid now() fails with clock blocker and no append', async () => {
      const { deps, calls } = createMocks({ now: () => 'garbage' });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.LEDGER_APPEND_FAILED);
      assert.ok(r.blockers.includes(ORCHESTRATION_BLOCKERS.ORCHESTRATOR_CLOCK_RESULT_INVALID));
      assert.strictEqual(countCalls(calls, 'appendLedgerRecord'), 0);
    });
    it('append FAILED yields LEDGER_APPEND_FAILED', async () => {
      const { deps } = createMocks({ appendLedgerRecord: () => ({ status: 'FAILED' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.LEDGER_APPEND_FAILED);
      assert.strictEqual(r.ledgerAppended, false);
    });
    it('append UNKNOWN yields LEDGER_APPEND_FAILED', async () => {
      const { deps } = createMocks({ appendLedgerRecord: () => ({ status: 'UNKNOWN' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.LEDGER_APPEND_FAILED);
    });
    it('append malformed yields LEDGER_APPEND_FAILED', async () => {
      const { deps } = createMocks({ appendLedgerRecord: () => ({ status: 'WEIRD' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.LEDGER_APPEND_FAILED);
    });
    it('append throw yields LEDGER_APPEND_FAILED', async () => {
      const { deps } = createMocks({ appendLedgerRecord: () => { throw new Error('x'); } });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.LEDGER_APPEND_FAILED);
    });
    it('after append failure, execute is not re-called', async () => {
      const { deps, calls } = createMocks({ appendLedgerRecord: () => ({ status: 'FAILED' }) });
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'executeMigration'), 1);
    });
    it('append is not retried', async () => {
      const { deps, calls } = createMocks({ appendLedgerRecord: () => ({ status: 'FAILED' }) });
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'appendLedgerRecord'), 1);
    });
    it('append failure recovery is manual reconciliation', async () => {
      const { deps } = createMocks({ appendLedgerRecord: () => ({ status: 'FAILED' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.recoveryDecision, 'MANUAL_RECONCILIATION_REQUIRED');
    });
    it('ledger record carries no prohibited fields', async () => {
      const { deps, calls } = createMocks();
      await runCanonicalMigration(makeInput(deps));
      const record = calls.find((c) => c.name === 'appendLedgerRecord').args[0].record;
      for (const f of ['operator_email', 'operator_user_id', 'credential', 'connection_string', 'raw_catalog_payload']) {
        assert.ok(!(f in record), f);
      }
    });
    it('ledger record is not exposed in the final result', async () => {
      const { deps } = createMocks();
      const r = await runCanonicalMigration(makeInput(deps));
      const serialized = JSON.stringify(r);
      assert.ok(!serialized.includes('applied_at'));
      assert.ok(!serialized.includes(TARGET_CHECKSUM.slice(0, 20)) || r.migrationChecksum === TARGET_CHECKSUM);
    });
  });

  describe('6. Release', () => {
    it('normal success releases exactly once', async () => {
      const { deps, calls } = createMocks();
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'releaseAdvisoryLock'), 1);
    });
    it('NOOP releases exactly once', async () => {
      const { deps, calls } = createMocks({ readLedger: () => [committedRecord()] });
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'releaseAdvisoryLock'), 1);
    });
    it('preflight failure releases exactly once', async () => {
      const { deps, calls } = createMocks({ evaluatePrecondition: () => ({ status: 'FAIL' }) });
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'releaseAdvisoryLock'), 1);
    });
    it('execution throw releases exactly once', async () => {
      const { deps, calls } = createMocks({ executeMigration: () => { throw new Error('x'); } });
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'releaseAdvisoryLock'), 1);
    });
    it('append throw releases exactly once', async () => {
      const { deps, calls } = createMocks({ appendLedgerRecord: () => { throw new Error('x'); } });
      await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(countCalls(calls, 'releaseAdvisoryLock'), 1);
    });
    it('release FAILED yields LOCK_RELEASE_FAILED', async () => {
      const { deps } = createMocks({ releaseAdvisoryLock: () => ({ status: 'FAILED' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.LOCK_RELEASE_FAILED);
      assert.strictEqual(r.stage, ORCHESTRATION_STAGES.LOCK_RELEASE);
      assert.ok(r.blockers.includes(ORCHESTRATION_BLOCKERS.ORCHESTRATOR_LOCK_RELEASE_FAILED));
    });
    it('release UNKNOWN yields LOCK_RELEASE_FAILED', async () => {
      const { deps } = createMocks({ releaseAdvisoryLock: () => ({ status: 'UNKNOWN' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.LOCK_RELEASE_FAILED);
    });
    it('release malformed yields LOCK_RELEASE_FAILED', async () => {
      const { deps } = createMocks({ releaseAdvisoryLock: () => ({ status: 'WEIRD' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.LOCK_RELEASE_FAILED);
    });
    it('release throw yields LOCK_RELEASE_FAILED', async () => {
      const { deps } = createMocks({ releaseAdvisoryLock: () => { throw new Error('x'); } });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.LOCK_RELEASE_FAILED);
    });
    it('release failure after successful append preserves ledgerAppended=true', async () => {
      const { deps } = createMocks({ releaseAdvisoryLock: () => ({ status: 'FAILED' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.ledgerAppended, true);
      assert.strictEqual(r.outcome, ORCHESTRATION_OUTCOMES.LOCK_RELEASE_FAILED);
    });
    it('release failure preserves executionAttempted', async () => {
      const { deps } = createMocks({ releaseAdvisoryLock: () => ({ status: 'FAILED' }) });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.strictEqual(r.executionAttempted, true);
    });
    it('acquired handle never appears in result/events/blockers', async () => {
      const { deps } = createMocks();
      const r = await runCanonicalMigration(makeInput(deps));
      const serialized = JSON.stringify(r);
      assert.ok(!serialized.includes(HANDLE));
    });
  });

  describe('7. Sanitization', () => {
    it('does not expose a secret-like throw message', async () => {
      const { deps } = createMocks({ executeMigration: () => { throw new Error('postgres://user:supersecretpw@db.internal:5432/prod'); } });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.ok(!JSON.stringify(r).includes('supersecretpw'));
    });
    it('does not expose stack traces', async () => {
      const { deps } = createMocks({ readLedger: () => { throw new Error('boom'); } });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.ok(!JSON.stringify(r).includes('at '));
      assert.ok(!JSON.stringify(r).includes('stack'));
    });
    it('does not expose raw SQL', async () => {
      const { deps } = createMocks({ executeMigration: () => { throw new Error('DROP TABLE users;'); } });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.ok(!JSON.stringify(r).includes('DROP TABLE users'));
    });
    it('does not expose the raw manifest', async () => {
      const { deps } = createMocks();
      const r = await runCanonicalMigration(makeInput(deps));
      assert.ok(!('manifestMigrations' in r));
      assert.ok(!('manifest' in r));
    });
    it('does not expose the raw ledger', async () => {
      const { deps } = createMocks({ readLedger: () => [committedRecord()] });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.ok(!('ledgerRecords' in r));
      assert.ok(!('ledger' in r));
    });
    it('does not expose hostname/URL', async () => {
      const { deps } = createMocks({ appendLedgerRecord: () => { throw new Error('https://db.internal.example.com:5432'); } });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.ok(!JSON.stringify(r).includes('db.internal.example.com'));
    });
    it('does not expose operator identity', async () => {
      const { deps } = createMocks({ executeMigration: () => { throw new Error('operator_email=admin@example.com'); } });
      const r = await runCanonicalMigration(makeInput(deps));
      assert.ok(!JSON.stringify(r).includes('admin@example.com'));
    });
    it('core source has no process.env/DATABASE_URL/fetch/pg/child_process/network/filesystem-write', async () => {
      const source = fs.readFileSync(CORE_PATH, 'utf8');
      assert.doesNotMatch(source, /process\.env/);
      assert.doesNotMatch(source, /\bDATABASE_URL\b/);
      assert.doesNotMatch(source, /\bfetch\s*\(/);
      assert.doesNotMatch(source, /require\(['"](?:pg|child_process|net|http|https|node:child_process|node:net|node:http|node:https)['"]\)/);
      assert.doesNotMatch(source, /fs\.(writeFileSync|mkdirSync|rmSync|appendFileSync)/);
    });
  });
});
