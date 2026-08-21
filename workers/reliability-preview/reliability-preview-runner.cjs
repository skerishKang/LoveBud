'use strict';

// Issue #4082 — NONPROD/Preview scheduled reliability runner + dead-man reader.
//
// One run per scheduled trigger: kill-switch short-circuit -> 90s lease
// acquisition with overlap suppression -> read-only collection (5s) ->
// #4079 baseline-aware evaluation -> dedupe-gated single-attempt alert ->
// heartbeat persistence -> safe finalization. Whole run is bounded by the
// fixed 30s full-run timeout. Every failure path is classified; nothing is
// silently swallowed and no automatic retry exists anywhere.
//
// The dead-man reader is intentionally a separate factory: it reads only the
// bounded heartbeat projection and never invokes the runner.
//
// Refs #4082. Refs #4079 — evaluator authority. Refs #3861/#3874 — envelope/
// transport posture. Refs #3461 — Keep OPEN. Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '1';

  var RUN_CLASSES = Object.freeze({
    RUN_DISABLED: 'RUN_DISABLED',
    RUN_COMPLETED: 'RUN_COMPLETED',
    RUN_TIMEOUT: 'RUN_TIMEOUT',
    RUN_LEASE_BUSY: 'RUN_LEASE_BUSY',
    RUN_FINALIZATION_FAILED: 'RUN_FINALIZATION_FAILED'
  });

  var ALERT_DECISIONS = Object.freeze({
    NOT_ALERTABLE_STATE: 'NOT_ALERTABLE_STATE',
    ALERT_DISABLED_BY_KILL_SWITCH: 'ALERT_DISABLED_BY_KILL_SWITCH',
    ALERT_SUPPRESSED_DUPLICATE: 'ALERT_SUPPRESSED_DUPLICATE',
    ALERT_ACCEPTED: 'ALERT_ACCEPTED',
    ALERT_REJECTED: 'ALERT_REJECTED',
    ALERT_TRANSPORT_TIMEOUT: 'ALERT_TRANSPORT_TIMEOUT',
    ALERT_TRANSPORT_UNAVAILABLE: 'ALERT_TRANSPORT_UNAVAILABLE',
    ALERT_NOT_ATTEMPTED_INSUFFICIENT_EVIDENCE: 'ALERT_NOT_ATTEMPTED_INSUFFICIENT_EVIDENCE',
    ALERT_FAILED_SANITIZED: 'ALERT_FAILED_SANITIZED'
  });

  var DEADMAN_CLASSES = Object.freeze({
    CURRENT: 'CURRENT',
    STALE: 'STALE',
    NEVER_RECORDED: 'NEVER_RECORDED',
    AUTHORITY_UNAVAILABLE: 'AUTHORITY_UNAVAILABLE'
  });

  var ALERT_WORTHY_STATES = Object.freeze([
    'INCIDENT_SUSPECTED',
    'INCIDENT_CONFIRMED',
    'MONITORING_FAILED'
  ]);

  function isPlainRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    try {
      var proto = Object.getPrototypeOf(value);
      return proto === Object.prototype || proto === null;
    } catch (_) {
      return false;
    }
  }

  function createPreviewRunner(deps) {
    if (!isPlainRecord(deps)) throw new TypeError('INVALID_DEPENDENCY');
    var required = ['config', 'store', 'collector', 'evaluator', 'taxonomy', 'alertCore'];
    for (var r = 0; r < required.length; r++) {
      if (!isPlainRecord(deps[required[r]])) throw new TypeError('INVALID_DEPENDENCY');
    }
    var config = deps.config;
    var store = deps.store;
    var collector = deps.collector;
    var evaluator = deps.evaluator;
    var taxonomy = deps.taxonomy;
    var alertCore = deps.alertCore;
    var transport = isPlainRecord(deps.transport) ? deps.transport : null;
    var releaseSha = typeof deps.releaseSha === 'string' ? deps.releaseSha : '';
    if (!/^[0-9a-f]{40}$/.test(releaseSha)) throw new TypeError('INVALID_RELEASE_SHA');
    var calibrationBySignal = isPlainRecord(deps.calibrationBySignal) ? deps.calibrationBySignal : {};
    var nowFn = typeof deps.now === 'function' ? deps.now : function () { return Date.now(); };
    var timerFn = typeof deps.timer === 'function' ? deps.timer : function (fn, ms) { return setTimeout(fn, ms); };
    var clearFn = typeof deps.clearTimer === 'function' ? deps.clearTimer : function (id) { clearTimeout(id); };
    var bounds = config.RUNTIME_BOUNDS;

    function buildCalibrationList() {
      var out = [];
      var ids = Object.keys(calibrationBySignal).sort();
      for (var i = 0; i < ids.length; i++) out.push(calibrationBySignal[ids[i]]);
      return out;
    }

    function alertDecisionFor(envelope, deliveryOutcome) {
      if (deliveryOutcome === alertCore.DELIVERY_OUTCOMES.DELIVERY_ACCEPTED) return ALERT_DECISIONS.ALERT_ACCEPTED;
      if (deliveryOutcome === alertCore.DELIVERY_OUTCOMES.DELIVERY_REJECTED) return ALERT_DECISIONS.ALERT_REJECTED;
      if (deliveryOutcome === alertCore.DELIVERY_OUTCOMES.DELIVERY_TIMEOUT) return ALERT_DECISIONS.ALERT_TRANSPORT_TIMEOUT;
      if (deliveryOutcome === alertCore.DELIVERY_OUTCOMES.DELIVERY_UNAVAILABLE) return ALERT_DECISIONS.ALERT_TRANSPORT_UNAVAILABLE;
      if (deliveryOutcome === alertCore.DELIVERY_OUTCOMES.DELIVERY_SUPPRESSED_DUPLICATE) return ALERT_DECISIONS.ALERT_SUPPRESSED_DUPLICATE;
      if (deliveryOutcome === alertCore.DELIVERY_OUTCOMES.DELIVERY_NOT_ATTEMPTED_INSUFFICIENT_EVIDENCE) {
        return ALERT_DECISIONS.ALERT_NOT_ATTEMPTED_INSUFFICIENT_EVIDENCE;
      }
      return ALERT_DECISIONS.ALERT_FAILED_SANITIZED;
    }

    async function executeRun(triggerClass) {
      var startedAt = nowFn();
      var ownerKey = 'run-' + startedAt.toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
      var record = {
        run_class: RUN_CLASSES.RUN_COMPLETED,
        trigger_class: typeof triggerClass === 'string' ? triggerClass : 'CRON_TRIGGER',
        lease_outcome: null,
        collector_outcome: null,
        evaluation_state: null,
        alert_decision: null,
        heartbeat_class: null,
        elapsed_ms: 0
      };

      var timedOut = false;
      var timeoutId = timerFn(function () { timedOut = true; }, bounds.FULL_RUN_TIMEOUT_MS);

      try {
        if (config.kill_switches.read_only_sentinel !== 'ENABLED') {
          record.run_class = RUN_CLASSES.RUN_DISABLED;
          record.heartbeat_class = 'NOT_RECORDED_DISABLED';
          return record;
        }

        var lease = store.acquireLease(ownerKey, startedAt);
        record.lease_outcome = lease.outcome;
        if (lease.outcome !== 'ACQUIRED') {
          record.run_class = RUN_CLASSES.RUN_LEASE_BUSY;
          return record;
        }

        try {
          var collected = await collector.collect();
          record.collector_outcome = collected.outcome;

          var signals = [];
          for (var i = 0; i < collected.signals.length; i++) {
            var signal = collected.signals[i];
            if (Object.prototype.hasOwnProperty.call(calibrationBySignal, signal.signal_id)) {
              signals.push(signal);
            }
          }

          var evaluation = await evaluator.evaluate({
            release_sha: releaseSha,
            signals: signals,
            calibration: buildCalibrationList()
          });
          record.evaluation_state = evaluation.state;

          if (ALERT_WORTHY_STATES.indexOf(evaluation.state) !== -1) {
            if (config.kill_switches.alert_delivery !== 'ENABLED') {
              record.alert_decision = ALERT_DECISIONS.ALERT_DISABLED_BY_KILL_SWITCH;
            } else if (!transport) {
              record.alert_decision = ALERT_DECISIONS.ALERT_TRANSPORT_UNAVAILABLE;
            } else {
              var priorFingerprints = store.getDedupeFingerprints();
              var delivery = alertCore.createAlertDeliveryCore({
                taxonomy: taxonomy,
                priorFingerprints: priorFingerprints,
                deliverAlert: function (envelope) {
                  var url = typeof deps.webhookUrlProvider === 'function' ? deps.webhookUrlProvider() : null;
                  return transport.deliver(url, envelope).then(function (result) {
                    return result.result;
                  });
                }
              });
              var delivered = await delivery.deliverAlert({
                source_class: alertCore.SOURCE_CLASSES.STRUCTURAL_SENTINEL,
                operation_class: 'BROWSE_ELIGIBILITY_BASELINE_CHECK',
                outcome_code: evaluation.summary.outcome_code,
                release_sha: releaseSha,
                severity: evaluation.summary.severity,
                owner_action: evaluation.summary.owner_action,
                evidence_completeness: evaluation.summary.evidence_completeness,
                baseline_deviation: evaluation.summary.baseline_deviation
              });
              record.alert_decision = alertDecisionFor(delivered.envelope ? delivered.envelope : null, delivered.outcome);
              if (delivered.envelope && delivered.outcome === alertCore.DELIVERY_OUTCOMES.DELIVERY_ACCEPTED) {
                store.recordDedupe(delivered.envelope.dedupe_fingerprint, nowFn());
              }
            }
          } else {
            record.alert_decision = ALERT_DECISIONS.NOT_ALERTABLE_STATE;
          }

          var heartbeatOutcome = record.collector_outcome === 'COLLECTED' ?
            ('EVAL_' + String(record.evaluation_state)) : ('COLLECT_' + String(record.collector_outcome));
          store.recordHeartbeat(heartbeatOutcome, releaseSha, nowFn());
          record.heartbeat_class = 'RECORDED';
          return record;
        } finally {
          store.releaseLease(ownerKey);
        }
      } catch (_) {
        record.run_class = timedOut ? RUN_CLASSES.RUN_TIMEOUT : RUN_CLASSES.RUN_FINALIZATION_FAILED;
        return record;
      } finally {
        clearFn(timeoutId);
        record.elapsed_ms = nowFn() - startedAt;
      }
    }

    async function run(triggerClass) {
      var completed = false;
      var result = null;
      var innerDone = executeRun(triggerClass).then(function (value) {
        completed = true;
        result = value;
      }, function () {
        completed = true;
        result = { run_class: RUN_CLASSES.RUN_FINALIZATION_FAILED, trigger_class: 'CRON_TRIGGER', elapsed_ms: 0 };
      });
      var guardId = timerFn(function () {}, bounds.FULL_RUN_TIMEOUT_MS + 1000);
      await Promise.race([
        innerDone,
        new Promise(function (resolve) { timerFn(resolve, bounds.FULL_RUN_TIMEOUT_MS); })
      ]).then(function () { clearFn(guardId); }, function () { clearFn(guardId); });
      if (!completed) {
        return {
          run_class: RUN_CLASSES.RUN_TIMEOUT,
          trigger_class: typeof triggerClass === 'string' ? triggerClass : 'CRON_TRIGGER',
          lease_outcome: null,
          collector_outcome: null,
          evaluation_state: null,
          alert_decision: null,
          heartbeat_class: null,
          elapsed_ms: bounds.FULL_RUN_TIMEOUT_MS
        };
      }
      return result;
    }

    return Object.freeze({
      CONTRACT_VERSION: CONTRACT_VERSION,
      RUN_CLASSES: RUN_CLASSES,
      ALERT_DECISIONS: ALERT_DECISIONS,
      run: run
    });
  }

  // Independent dead-man projection reader. Never invokes the runner. Store
  // failure is classified AUTHORITY_UNAVAILABLE — never healthy.
  function createPreviewDeadManReader(deps) {
    if (!isPlainRecord(deps)) throw new TypeError('INVALID_DEPENDENCY');
    if (!isPlainRecord(deps.store)) throw new TypeError('INVALID_DEPENDENCY');
    var store = deps.store;
    var nowFn = typeof deps.now === 'function' ? deps.now : function () { return Date.now(); };

    function read(at) {
      try {
        var status = store.heartbeatStatus(typeof at === 'number' ? at : nowFn());
        return Object.freeze({
          deadman_class: status.heartbeat_class === 'CURRENT' ? DEADMAN_CLASSES.CURRENT :
            status.heartbeat_class === 'STALE' ? DEADMAN_CLASSES.STALE : DEADMAN_CLASSES.NEVER_RECORDED,
          age_ms: status.age_ms,
          last_outcome_class: status.outcome_class
        });
      } catch (_) {
        return Object.freeze({
          deadman_class: DEADMAN_CLASSES.AUTHORITY_UNAVAILABLE,
          age_ms: null,
          last_outcome_class: null
        });
      }
    }

    return Object.freeze({ CONTRACT_VERSION: CONTRACT_VERSION, DEADMAN_CLASSES: DEADMAN_CLASSES, read: read });
  }

  var API = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    RUN_CLASSES: RUN_CLASSES,
    ALERT_DECISIONS: ALERT_DECISIONS,
    DEADMAN_CLASSES: DEADMAN_CLASSES,
    CAPABILITIES: Object.freeze([]),
    createPreviewRunner: createPreviewRunner,
    createPreviewDeadManReader: createPreviewDeadManReader
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.LoveBudReliabilityPreviewRunner = API;
  if (typeof globalThis !== 'undefined') globalThis.LoveBudReliabilityPreviewRunner = API;
})(this);
