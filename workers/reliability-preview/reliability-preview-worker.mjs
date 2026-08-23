// Issue #4148 / #4082 — NONPROD reliability-preview dedicated Worker (source publication only).
//
// SOURCE PUBLICATION ONLY. This file grants no Production authority and performs
// no provider mutation. It is NOT deployed, no Cron is activated, no Durable
// Object is provisioned, no Slack webhook is created, and no secret value is
// placed by publishing this source.
//
// #4175 reconciliation:
// - The deployed source revision is no longer hard-coded. It is injected
//   externally through RELIABILITY_PREVIEW_RELEASE_SHA and validated by the
//   config contract; a missing/malformed/all-zero value classifies as
//   INVALID_RELEASE_SHA and fails closed BEFORE any collector, store, or
//   transport invocation.
// - Both kill switches are now wired to their real environment inputs
//   (RELIABILITY_READ_ONLY_SENTINEL_ENABLED / RELIABILITY_ALERT_DELIVERY_ENABLED).
//   Values are trimmed and lowercased; normalized "true" enables and every
//   other value stays DISABLED. Each switch remains independent and neither
//   defaults to enabled.
// - previewCollectEffect() remains an intentionally unbound empty probe and
//   calibrationBySignal remains intentionally empty: real Production collector
//   binding is a separate approval and is NOT part of this package.
//
// #4187 hardening:
// - The top-level scheduled() entrypoint now enforces the read-only sentinel
//   kill switch immediately after release-provenance validation. A disabled or
//   malformed sentinel returns RUN_DISABLED before resolving the Durable Object
//   namespace/stub, matching the documented zero-capability fail-closed order.
//
// Refs #4148/#4149. Refs #4082. Refs #4175. Refs #4187.
// Refs #3461 — Keep OPEN. Refs #1882 — Keep OPEN.

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

const SIGNAL_ID = 'BROWSE_ELIGIBILITY_RATIO';
const SIGNAL_CLASS = baselineContract.SIGNAL_CLASSES.RATIO_SIGNAL;
const CALIBRATION = Object.freeze({
  signal_id: SIGNAL_ID,
  expected_variation_max: 0.05,
  material_deviation_min: 0.15,
  critical_discontinuity_min: 0.30
});

function invalidProvenanceRecord(triggerClass) {
  return {
    run_class: 'RUN_DISABLED',
    trigger_class: typeof triggerClass === 'string' ? triggerClass : 'CRON_TRIGGER',
    lease_outcome: null,
    collector_outcome: null,
    evaluation_state: null,
    alert_decision: null,
    heartbeat_class: null,
    elapsed_ms: 0,
    failure_class: 'INVALID_RELEASE_SHA'
  };
}

function disabledRunRecord(triggerClass) {
  return {
    run_class: 'RUN_DISABLED',
    trigger_class: typeof triggerClass === 'string' ? triggerClass : 'CRON_TRIGGER',
    lease_outcome: null,
    collector_outcome: null,
    evaluation_state: null,
    alert_decision: null,
    heartbeat_class: 'NOT_RECORDED_DISABLED',
    elapsed_ms: 0
  };
}

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
// Intentionally UNBOUND: replacing this stub with a real Production collector
// requires a separate owner approval outside this source package.
function previewCollectEffect() {
  return Promise.resolve([]);
}

export class ReliabilityPreviewStore {
  constructor(state, env) {
    // Kill switches are wired to their real environment variables through the
    // symbolic config names; only normalized "true" classifies ENABLED.
    this.config = configApi.createPreviewConfig({
      kill_switch_sentinel: env[configApi.KILL_SWITCH_NAMES.READ_ONLY_SENTINEL],
      kill_switch_alert: env[configApi.KILL_SWITCH_NAMES.ALERT_DELIVERY],
      release_sha_env: env[configApi.RELEASE_SHA_VAR_NAME]
    });
    if (this.config.release_provenance.status !== 'VALID') {
      throw new TypeError('INVALID_RELEASE_SHA');
    }
    this.state = state;
    this.env = env;
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
      releaseSha: this.config.release_provenance.release_sha,
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
  // dedicated SQLite Durable Object that owns the store and the runner.
  //
  // Fail-closed ordering (#4175/#4187): release provenance and the read-only
  // sentinel kill switch are enforced BEFORE any Durable Object resolution or
  // runner invocation. Invalid provenance or a default-disabled/malformed
  // sentinel returns RUN_DISABLED with zero capability use (no DO resolution,
  // collector, store, or transport). Alert enablement never widens sentinel
  // authority.
  async scheduled(controller, env, ctx) {
    const triggerClass = controller && controller.cron ? controller.cron : 'CRON_TRIGGER';
    try {
      const config = configApi.createPreviewConfig({
        kill_switch_sentinel: env[configApi.KILL_SWITCH_NAMES.READ_ONLY_SENTINEL],
        kill_switch_alert: env[configApi.KILL_SWITCH_NAMES.ALERT_DELIVERY],
        release_sha_env: env[configApi.RELEASE_SHA_VAR_NAME]
      });
      if (config.release_provenance.status !== 'VALID') {
        return invalidProvenanceRecord(triggerClass);
      }
      if (config.kill_switches.read_only_sentinel !== 'ENABLED') {
        return disabledRunRecord(triggerClass);
      }
      const ns = env.RELIABILITY_PREVIEW_STORE;
      const id = ns.idFromName('reliability-preview');
      const stub = ns.get(id);
      return await stub.runPreview(triggerClass);
    } catch (err) {
      return { run_class: 'RUN_FINALIZATION_FAILED', trigger_class: triggerClass };
    }
  }
};
