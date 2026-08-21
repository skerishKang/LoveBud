// Issue #4148 / #4082 — NONPROD reliability-preview dedicated Worker (source publication only).
//
// SOURCE PUBLICATION ONLY. This file grants no Production authority and performs
// no provider mutation. It is NOT deployed, no Cron is activated, no Durable
// Object is provisioned, no Slack webhook is created, and no secret value is
// placed by publishing this source.
//
// Refs #4148. Refs #4082. Refs #3461 — Keep OPEN. Refs #1882 — Keep OPEN.

import configApi from './reliability-preview-config.cjs';
import storeApi from './reliability-preview-store.cjs';
import collectorApi from './reliability-preview-collector.cjs';
import transportApi from './reliability-preview-alert-transport.cjs';
import runnerApi from './reliability-preview-runner.cjs';

// Merged observability cores (#3835 taxonomy, #4079 evaluator/boundary,
// #3861 delivery core). Each is a pure dependency-injected authority that
// attaches itself to globalThis when evaluated. This mirrors exactly how the
// #4082 rehearsal suite wires them, keeping the published worker free of any
// private-shaped scope leakage.
import '../../js/observability/reliability-sentinel-taxonomy.js';
import '../../js/observability/reliability-anomaly-evaluator-core.js';
import '../../js/observability/reliability-baseline-store-contract.js';
import '../../js/observability/reliability-alert-delivery-core.js';

const taxonomy = globalThis.LoveBudReliabilitySentinelTaxonomy;
const baselineContract = globalThis.LoveBudReliabilityBaselineStoreContract;
const evaluatorCore = globalThis.LoveBudReliabilityAnomalyEvaluatorCore;
const alertDeliveryCoreApi = globalThis.LoveBudReliabilityAlertDeliveryCore;

const MAIN_SHA = '88389cd4c80f8ec0af737dfb3b54d65afeb620e2';

const SIGNAL_ID = 'BROWSE_ELIGIBILITY_RATIO';
const SIGNAL_CLASS = baselineContract.SIGNAL_CLASSES.RATIO_SIGNAL;
const CALIBRATION = Object.freeze({
  signal_id: SIGNAL_ID,
  expected_variation_max: 0.05,
  material_deviation_min: 0.15,
  critical_discontinuity_min: 0.30
});

// Bridges the Cloudflare SQLite Durable Object storage seam (state.storage.sql)
// to the prepare/run/get/all contract the store module is written against, so
// the same runtime module binds to a real DO without semantic drift.
function createSqliteDatabaseAdapter(sql) {
  function prepare(statement) {
    return {
      run() {
        const bindings = Array.prototype.slice.call(arguments);
        sql.exec.apply(sql, [statement].concat(bindings));
        return {};
      },
      get() {
        const bindings = Array.prototype.slice.call(arguments);
        const rows = sql.exec.apply(sql, [statement].concat(bindings)).toArray();
        return rows.length ? rows[0] : null;
      },
      all() {
        const bindings = Array.prototype.slice.call(arguments);
        return sql.exec.apply(sql, [statement].concat(bindings)).toArray();
      }
    };
  }
  return { prepare: prepare };
}

// Non-product read-only collection probe. Fail-closed: returns an empty bounded
// signal set on any condition and performs no Product mutation. The real
// read-only collector wiring is exercised by the runtime modules in rehearsal.
function previewCollectEffect() {
  return Promise.resolve([]);
}

export class ReliabilityPreviewStore {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.config = configApi.createPreviewConfig();
    this.database = createSqliteDatabaseAdapter(state.storage.sql);
    this.store = storeApi.createPreviewStore({
      database: this.database,
      config: this.config,
      now: function () { return Date.now(); }
    });
    this.collector = collectorApi.createPreviewCollector({
      collectEffect: previewCollectEffect,
      timeoutMs: this.config.RUNTIME_BOUNDS.COLLECTOR_TIMEOUT_MS,
      timer: function (fn, ms) { return setTimeout(fn, ms); },
      clearTimer: function (id) { clearTimeout(id); },
      validateSignalIdentity: baselineContract.validateSignalIdentity
    });
    this.transport = transportApi.createSlackPreviewTransport({
      fetchEffect: function (url, init) { return fetch(url, init); },
      timeoutMs: 5000,
      timer: function (fn, ms) { return setTimeout(fn, ms); },
      clearTimer: function (id) { clearTimeout(id); }
    });
    this.runner = runnerApi.createPreviewRunner({
      config: this.config,
      store: this.store,
      collector: this.collector,
      evaluator: evaluatorCore.createAnomalyEvaluator({
        taxonomy: taxonomy,
        baseline_contract: baselineContract,
        baseline_store: this.store
      }),
      taxonomy: taxonomy,
      alertCore: alertDeliveryCoreApi,
      transport: this.transport,
      releaseSha: MAIN_SHA,
      calibrationBySignal: Object.freeze({}),
      webhookUrlProvider: function () { return env.RELIABILITY_PREVIEW_SLACK_WEBHOOK_URL || null; },
      now: function () { return Date.now(); },
      timer: function (fn, ms) { return setTimeout(fn, ms); },
      clearTimer: function (id) { clearTimeout(id); }
    });
  }

  async runPreview(triggerClass) {
    return this.runner.run(triggerClass);
  }

  // Per-instance request surface is non-product / fail-closed (404). No
  // capability is exposed through the Durable Object fetch path.
  async fetch() {
    return new Response('Not Found', { status: 404 });
  }
}

export default {
  // Worker request surface is non-product / fail-closed. This runtime performs
  // no Product read or write and exposes no provider capability.
  async fetch() {
    return new Response('Not Found', { status: 404 });
  },

  // scheduled() is the ONLY scheduled reliability entrypoint. It routes to the
  // dedicated SQLite Durable Object that owns the store and the runner. With
  // the default kill switches (read_only_sentinel=false, alert_delivery=false)
  // the run short-circuits to RUN_DISABLED and exercises no capability.
  async scheduled(controller, env, ctx) {
    try {
      const ns = env.RELIABILITY_PREVIEW_STORE;
      const id = ns.idFromName('reliability-preview');
      const stub = ns.get(id);
      return await stub.runPreview(controller.cron || 'CRON_TRIGGER');
    } catch (err) {
      return { run_class: 'RUN_FINALIZATION_FAILED', trigger_class: 'CRON_TRIGGER' };
    }
  }
};
