'use strict';

// Issue #4082 — NONPROD/Preview Slack Incoming Webhook alert transport.
//
// Dedicated NONPROD Slack App Incoming Webhook binding for the rehearsal
// package. The webhook URL is injected per call site, used only inside the
// injected fetch effect invocation, and is never stored, logged, or included
// in any result. Exactly one attempt is performed: NO automatic retry.
// The rendered payload carries bounded reliability fields only.
//
// Refs #4082. Refs #3861 — envelope authority. Refs #3874 — transport posture.
// Refs #3461 — Keep OPEN. Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '1';

  var TRANSPORT_RESULTS = Object.freeze({
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    TIMEOUT: 'TIMEOUT',
    UNAVAILABLE: 'UNAVAILABLE'
  });

  var PAYLOAD_FIELDS = Object.freeze([
    'source_class',
    'operation_class',
    'outcome_code',
    'severity',
    'advisory_action',
    'owner_class',
    'evidence_completeness',
    'release_sha',
    'latency_bucket',
    'baseline_deviation_class'
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

  function createSlackPreviewTransport(deps) {
    if (!isPlainRecord(deps)) throw new TypeError('INVALID_DEPENDENCY');
    if (typeof deps.fetchEffect !== 'function') throw new TypeError('INVALID_DEPENDENCY');
    var timeoutMs = typeof deps.timeoutMs === 'number' && Number.isFinite(deps.timeoutMs) && deps.timeoutMs > 0 ?
      deps.timeoutMs : 5000;
    var timerFn = typeof deps.timer === 'function' ? deps.timer : function (fn, ms) { return setTimeout(fn, ms); };
    var clearFn = typeof deps.clearTimer === 'function' ? deps.clearTimer : function (id) { clearTimeout(id); };

    function renderPayload(envelope) {
      if (!isPlainRecord(envelope)) return null;
      var lines = ['[NONPROD_RELIABILITY_PREVIEW]'];
      for (var i = 0; i < PAYLOAD_FIELDS.length; i++) {
        var field = PAYLOAD_FIELDS[i];
        var value = Object.prototype.hasOwnProperty.call(envelope, field) ? envelope[field] : undefined;
        if (typeof value !== 'string') return null;
        lines.push(field + '=' + value);
      }
      if (typeof envelope.dedupe_fingerprint === 'string' && /^[0-9a-f]{64}$/.test(envelope.dedupe_fingerprint)) {
        lines.push('dedupe_fingerprint=' + envelope.dedupe_fingerprint);
      }
      return { text: lines.join('\n') };
    }

    // Single-attempt delivery. Never retries. Never throws. The webhook URL
    // never appears in any returned value.
    async function deliver(webhookUrl, envelope) {
      if (typeof webhookUrl !== 'string' || !webhookUrl) {
        return { result: TRANSPORT_RESULTS.UNAVAILABLE, attempt_class: 'NOT_ATTEMPTED_INVALID_TARGET' };
      }
      var payload = renderPayload(envelope);
      if (payload === null) {
        return { result: TRANSPORT_RESULTS.UNAVAILABLE, attempt_class: 'NOT_ATTEMPTED_INVALID_ENVELOPE' };
      }
      var timedOut = false;
      var timerId = timerFn(function () { timedOut = true; }, timeoutMs);
      var responseStatus = null;
      var threw = false;
      try {
        var response = await Promise.race([
          Promise.resolve().then(function () { return deps.fetchEffect(webhookUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload)
          }); }),
          new Promise(function (_, reject) {
            timerFn(function () { reject(new Error('TRANSPORT_TIMEOUT_CLASS')); }, timeoutMs);
          })
        ]);
        if (timedOut) {
          return { result: TRANSPORT_RESULTS.TIMEOUT, attempt_class: 'SINGLE_ATTEMPT_TIMEOUT' };
        }
        responseStatus = response && typeof response.status === 'number' ? response.status : null;
      } catch (_) {
        threw = true;
      } finally {
        clearFn(timerId);
      }
      if (threw) {
        return { result: timedOut ? TRANSPORT_RESULTS.TIMEOUT : TRANSPORT_RESULTS.UNAVAILABLE, attempt_class: 'SINGLE_ATTEMPT_FAILED' };
      }
      if (responseStatus === null) {
        return { result: TRANSPORT_RESULTS.UNAVAILABLE, attempt_class: 'SINGLE_ATTEMPT_MALFORMED_RESPONSE' };
      }
      if (responseStatus >= 200 && responseStatus < 300) {
        return { result: TRANSPORT_RESULTS.ACCEPTED, attempt_class: 'SINGLE_ATTEMPT_ACCEPTED', http_status_class: '2XX' };
      }
      if (responseStatus >= 400 && responseStatus < 500) {
        return { result: TRANSPORT_RESULTS.REJECTED, attempt_class: 'SINGLE_ATTEMPT_REJECTED', http_status_class: '4XX' };
      }
      if (responseStatus >= 500) {
        return { result: TRANSPORT_RESULTS.UNAVAILABLE, attempt_class: 'SINGLE_ATTEMPT_UNAVAILABLE', http_status_class: '5XX' };
      }
      return { result: TRANSPORT_RESULTS.UNAVAILABLE, attempt_class: 'SINGLE_ATTEMPT_UNEXPECTED_STATUS' };
    }

    return Object.freeze({
      CONTRACT_VERSION: CONTRACT_VERSION,
      deliver: deliver,
      renderPayload: function (envelope) { return renderPayload(envelope); }
    });
  }

  var API = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    TRANSPORT_RESULTS: TRANSPORT_RESULTS,
    PAYLOAD_FIELDS: PAYLOAD_FIELDS,
    CAPABILITIES: Object.freeze([]),
    createSlackPreviewTransport: createSlackPreviewTransport
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.LoveBudReliabilityPreviewAlertTransport = API;
  if (typeof globalThis !== 'undefined') globalThis.LoveBudReliabilityPreviewAlertTransport = API;
})(this);
