'use strict';

// Issue #4082 — NONPROD/Preview read-only collector contract.
//
// Wraps an injected read-only collection effect with the fixed 5-second
// collector timeout. Fail-closed: timeout, throw, malformed result, or any
// private-shaped member collapses to a bounded failure class. Raw errors,
// rows, payloads, and identifiers never cross this boundary and are never
// logged here.
//
// Refs #4082. Refs #4079 — signal vocabulary/boundary. Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '1';

  var COLLECTOR_OUTCOMES = Object.freeze({
    COLLECTED: 'COLLECTED',
    COLLECTOR_TIMEOUT: 'COLLECTOR_TIMEOUT',
    COLLECTOR_FAILED: 'COLLECTOR_FAILED',
    COLLECTOR_MALFORMED: 'COLLECTOR_MALFORMED'
  });

  function isPlainRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    try {
      var proto = Object.getPrototypeOf(value);
      return proto === Object.prototype || proto === null;
    } catch (_) {
      return false;
    }
  }

  function createPreviewCollector(deps) {
    if (!isPlainRecord(deps)) throw new TypeError('INVALID_DEPENDENCY');
    if (typeof deps.collectEffect !== 'function') throw new TypeError('INVALID_DEPENDENCY');
    var timeoutMs = deps.timeoutMs;
    if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new TypeError('INVALID_DEPENDENCY');
    }
    var timerFn = typeof deps.timer === 'function' ? deps.timer : function (fn, ms) { return setTimeout(fn, ms); };
    var clearFn = typeof deps.clearTimer === 'function' ? deps.clearTimer : function (id) { clearTimeout(id); };
    var validateSignalIdentity = typeof deps.validateSignalIdentity === 'function' ? deps.validateSignalIdentity : null;

    function validateSignals(signals) {
      if (!Array.isArray(signals)) return null;
      var out = [];
      for (var i = 0; i < signals.length; i++) {
        var signal = signals[i];
        if (!isPlainRecord(signal)) return null;
        var keys = Object.keys(signal).sort();
        var isHard = keys.indexOf('structural_summary') !== -1;
        var expected = isHard ? ['signal_class', 'signal_id', 'structural_summary'] : ['signal_class', 'signal_id'];
        if (keys.length !== expected.length) return null;
        for (var k = 0; k < expected.length; k++) {
          if (keys[k] !== expected[k]) return null;
        }
        if (typeof signal.signal_id !== 'string' || typeof signal.signal_class !== 'string') return null;
        if (validateSignalIdentity && !validateSignalIdentity(signal.signal_id, signal.signal_class)) return null;
        out.push(signal);
      }
      return out;
    }

    async function collect() {
      var effectSettled = false;
      var effectResult = null;
      var effectError = null;
      var effectDone = new Promise(function (resolve) {
        try {
          Promise.resolve()
            .then(function () { return deps.collectEffect(); })
            .then(function (value) {
              effectResult = value;
              effectSettled = true;
              resolve();
            }, function (err) {
              effectError = err;
              effectSettled = true;
              resolve();
            });
        } catch (err) {
          effectError = err;
          effectSettled = true;
          resolve();
        }
      });
      var timedOut = false;
      var timerId = timerFn(function () { timedOut = true; }, timeoutMs);
      await Promise.race([effectDone, new Promise(function (resolve) {
        var poll = setInterval(function () {
          if (timedOut || effectSettled) { clearInterval(poll); resolve(); }
        }, 1);
        poll.unref && poll.unref();
      })]);
      clearFn(timerId);

      if (timedOut && !effectSettled) {
        return Object.freeze({ outcome: COLLECTOR_OUTCOMES.COLLECTOR_TIMEOUT, signals: [] });
      }
      if (!effectSettled) {
        return Object.freeze({ outcome: COLLECTOR_OUTCOMES.COLLECTOR_TIMEOUT, signals: [] });
      }
      if (effectError !== null) {
        return Object.freeze({ outcome: COLLECTOR_OUTCOMES.COLLECTOR_FAILED, signals: [] });
      }
      var validated = validateSignals(effectResult);
      if (validated === null) {
        return Object.freeze({ outcome: COLLECTOR_OUTCOMES.COLLECTOR_MALFORMED, signals: [] });
      }
      return Object.freeze({ outcome: COLLECTOR_OUTCOMES.COLLECTED, signals: Object.freeze(validated) });
    }

    return Object.freeze({
      CONTRACT_VERSION: CONTRACT_VERSION,
      collect: collect
    });
  }

  var API = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    COLLECTOR_OUTCOMES: COLLECTOR_OUTCOMES,
    CAPABILITIES: Object.freeze([]),
    createPreviewCollector: createPreviewCollector
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.LoveBudReliabilityPreviewCollector = API;
  if (typeof globalThis !== 'undefined') globalThis.LoveBudReliabilityPreviewCollector = API;
})(this);
