'use strict';

// Issue #4187 — source-only NONPROD fail-closed regression.
//
// Proves that a valid release SHA does NOT authorize Durable Object resolution
// while the read-only sentinel kill switch is disabled/malformed, and that
// alert enablement cannot widen that authority. No provider, network, DB,
// secret, deploy, Cron, or Production capability is exercised here.
//
// Refs #4082. Refs #3461 — Keep OPEN. Refs #1882 — Keep OPEN.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKER_URL = pathToFileURL(
  path.join(ROOT, 'workers', 'reliability-preview', 'reliability-preview-worker.mjs')
).href;
const VALID_SHA = 'a'.repeat(40);

async function loadWorker() {
  const mod = await import(WORKER_URL);
  return mod.default;
}

function poisonNamespace(calls) {
  return {
    idFromName() {
      calls.idFromName += 1;
      throw new Error('DO_SHOULD_NOT_RESOLVE');
    },
    get() {
      calls.get += 1;
      throw new Error('DO_SHOULD_NOT_RESOLVE');
    }
  };
}

function enabledNamespace(calls, expectedRecord) {
  return {
    idFromName(name) {
      calls.idFromName += 1;
      assert.equal(name, 'reliability-preview');
      return 'fake-reliability-preview-id';
    },
    get(id) {
      calls.get += 1;
      assert.equal(id, 'fake-reliability-preview-id');
      return {
        async runPreview(triggerClass) {
          calls.runPreview += 1;
          return Object.assign({}, expectedRecord, { trigger_class: triggerClass });
        }
      };
    }
  };
}

function assertDisabledRecord(record) {
  assert.equal(record.run_class, 'RUN_DISABLED');
  assert.equal(record.lease_outcome, null);
  assert.equal(record.collector_outcome, null);
  assert.equal(record.evaluation_state, null);
  assert.equal(record.alert_decision, null);
  assert.equal(record.heartbeat_class, 'NOT_RECORDED_DISABLED');
  assert.equal(record.elapsed_ms, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(record, 'failure_class'), false);
}

test('#4187 invalid release provenance still wins before Durable Object resolution', async () => {
  const worker = await loadWorker();
  const calls = { idFromName: 0, get: 0 };
  const record = await worker.scheduled(
    { cron: '*/5 * * * *' },
    {
      RELIABILITY_READ_ONLY_SENTINEL_ENABLED: 'true',
      RELIABILITY_PREVIEW_STORE: poisonNamespace(calls)
    },
    {}
  );

  assert.equal(record.run_class, 'RUN_DISABLED');
  assert.equal(record.failure_class, 'INVALID_RELEASE_SHA');
  assert.equal(calls.idFromName, 0);
  assert.equal(calls.get, 0);
});

test('#4187 valid SHA + disabled/malformed sentinel short-circuits before Durable Object resolution', async () => {
  const worker = await loadWorker();
  const cases = [
    { label: 'missing', value: undefined },
    { label: 'false', value: 'false' },
    { label: 'malformed', value: 'garbage' },
    { label: 'numeric-lookalike', value: '1' }
  ];

  for (const c of cases) {
    const calls = { idFromName: 0, get: 0 };
    const env = {
      RELIABILITY_PREVIEW_RELEASE_SHA: VALID_SHA,
      RELIABILITY_PREVIEW_STORE: poisonNamespace(calls)
    };
    if (c.value !== undefined) {
      env.RELIABILITY_READ_ONLY_SENTINEL_ENABLED = c.value;
    }

    const record = await worker.scheduled({ cron: '*/5 * * * *' }, env, {});
    assertDisabledRecord(record);
    assert.equal(calls.idFromName, 0, c.label + ' must not resolve DO id');
    assert.equal(calls.get, 0, c.label + ' must not resolve DO stub');
  }
});

test('#4187 alert enablement cannot bypass a disabled read-only sentinel', async () => {
  const worker = await loadWorker();
  const calls = { idFromName: 0, get: 0 };
  const record = await worker.scheduled(
    { cron: '*/5 * * * *' },
    {
      RELIABILITY_PREVIEW_RELEASE_SHA: VALID_SHA,
      RELIABILITY_READ_ONLY_SENTINEL_ENABLED: 'false',
      RELIABILITY_ALERT_DELIVERY_ENABLED: 'true',
      RELIABILITY_PREVIEW_STORE: poisonNamespace(calls)
    },
    {}
  );

  assertDisabledRecord(record);
  assert.equal(calls.idFromName, 0);
  assert.equal(calls.get, 0);
});

test('#4187 valid SHA + enabled sentinel preserves the existing Durable Object path exactly once', async () => {
  const worker = await loadWorker();
  const calls = { idFromName: 0, get: 0, runPreview: 0 };
  const expected = {
    run_class: 'RUN_COMPLETED',
    lease_outcome: 'ACQUIRED',
    collector_outcome: 'COLLECTED',
    evaluation_state: 'HEALTHY',
    alert_decision: 'NOT_ALERTABLE_STATE',
    heartbeat_class: 'RECORDED',
    elapsed_ms: 1
  };

  const record = await worker.scheduled(
    { cron: '*/5 * * * *' },
    {
      RELIABILITY_PREVIEW_RELEASE_SHA: VALID_SHA,
      RELIABILITY_READ_ONLY_SENTINEL_ENABLED: 'true',
      RELIABILITY_ALERT_DELIVERY_ENABLED: 'false',
      RELIABILITY_PREVIEW_STORE: enabledNamespace(calls, expected)
    },
    {}
  );

  assert.equal(calls.idFromName, 1);
  assert.equal(calls.get, 1);
  assert.equal(calls.runPreview, 1);
  assert.deepEqual(record, Object.assign({}, expected, { trigger_class: '*/5 * * * *' }));
});
