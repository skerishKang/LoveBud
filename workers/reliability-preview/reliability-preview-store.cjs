'use strict';

// Issue #4082 — NONPROD/Preview private reliability store (SQLite-backed).
//
// SQLite-backed private store shaped after the Cloudflare Durable Object
// SQLite API seam (prepare/run/get/all) so the same module binds to a real
// DO binding later without semantic drift. Exact measurements exist ONLY
// inside this store; the #4079 boundary receives bounded classifications.
// All growth is bounded: 30-day retention, 8640 samples/signal, 2048 dedupe
// entries, 2016 heartbeat rows. Deterministic ordering by (measured_at, id).
//
// Refs #4082. Refs #4079 — store boundary authority. Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '1';

  var DEVIATION_CLASSES = Object.freeze({
    NONE: 'NONE',
    EXPECTED_VARIATION: 'EXPECTED_VARIATION',
    MATERIAL_DEVIATION: 'MATERIAL_DEVIATION',
    CRITICAL_DISCONTINUITY: 'CRITICAL_DISCONTINUITY',
    UNKNOWN: 'UNKNOWN'
  });

  var BASELINE_STATUSES = Object.freeze({
    ESTABLISHED: 'ESTABLISHED',
    NOT_ESTABLISHED: 'NOT_ESTABLISHED',
    INSUFFICIENT: 'INSUFFICIENT',
    MONITORING_FAILED: 'MONITORING_FAILED',
    AUTHORITY_UNAVAILABLE: 'AUTHORITY_UNAVAILABLE'
  });

  var HEARTBEAT_CLASSES = Object.freeze({
    CURRENT: 'CURRENT',
    STALE: 'STALE',
    NEVER_RECORDED: 'NEVER_RECORDED'
  });

  var LEASE_OUTCOMES = Object.freeze({
    ACQUIRED: 'ACQUIRED',
    BUSY: 'BUSY'
  });

  var DEDUPE_OUTCOMES = Object.freeze({
    NEW: 'NEW',
    DUPLICATE: 'DUPLICATE'
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

  var SCHEMA = [
    'CREATE TABLE IF NOT EXISTS baseline_samples (',
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  signal_id TEXT NOT NULL,',
    '  measured_at INTEGER NOT NULL,',
    '  value REAL NOT NULL',
    ');',
    'CREATE INDEX IF NOT EXISTS idx_baseline_signal_time ON baseline_samples (signal_id, measured_at, id);',
    'CREATE TABLE IF NOT EXISTS run_lease (',
    '  id INTEGER PRIMARY KEY CHECK (id = 1),',
    '  owner_key TEXT NOT NULL,',
    '  acquired_at INTEGER NOT NULL,',
    '  expires_at INTEGER NOT NULL',
    ');',
    'CREATE TABLE IF NOT EXISTS dedupe_state (',
    '  fingerprint TEXT PRIMARY KEY,',
    '  first_seen_at INTEGER NOT NULL,',
    '  last_seen_at INTEGER NOT NULL',
    ');',
    'CREATE TABLE IF NOT EXISTS heartbeat_history (',
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  recorded_at INTEGER NOT NULL,',
    '  outcome_class TEXT NOT NULL,',
    '  release_sha TEXT NOT NULL',
    ');'
  ].join('\n');

  function createPreviewStore(deps) {
    if (!isPlainRecord(deps)) throw new TypeError('INVALID_DEPENDENCY');
    var database = deps.database;
    var config = deps.config;
    var nowFn = typeof deps.now === 'function' ? deps.now : function () { return Date.now(); };
    if (typeof database !== 'object' || database === null || typeof database.prepare !== 'function') {
      throw new TypeError('INVALID_DEPENDENCY');
    }
    if (!isPlainRecord(config) || !isPlainRecord(config.RUNTIME_BOUNDS)) {
      throw new TypeError('INVALID_DEPENDENCY');
    }
    var bounds = config.RUNTIME_BOUNDS;

    for (var s = 0; s < SCHEMA.split(';\n').length; s++) {
      var statementSql = SCHEMA.split(';\n')[s].trim();
      if (statementSql) database.prepare(statementSql).run();
    }

    function recordBaselineSample(signalId, value, measuredAt) {
      if (typeof signalId !== 'string' || !signalId) throw new TypeError('INVALID_SIGNAL');
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('INVALID_MEASUREMENT');
      var at = typeof measuredAt === 'number' ? measuredAt : nowFn();
      database.prepare('INSERT INTO baseline_samples (signal_id, measured_at, value) VALUES (?, ?, ?)')
        .run(signalId, at, value);
      pruneBaseline(signalId);
      return true;
    }

    function pruneBaseline(signalId) {
      var retentionCutoff = nowFn() - bounds.BASELINE_RETENTION_MS;
      database.prepare('DELETE FROM baseline_samples WHERE signal_id = ? AND measured_at < ?')
        .run(signalId, retentionCutoff);
      var countRow = database.prepare('SELECT COUNT(*) AS n FROM baseline_samples WHERE signal_id = ?').get(signalId);
      if (countRow && countRow.n > bounds.MAX_SAMPLES_PER_SIGNAL) {
        database.prepare(
          'DELETE FROM baseline_samples WHERE signal_id = ? AND id NOT IN (' +
          'SELECT id FROM baseline_samples WHERE signal_id = ? ORDER BY measured_at DESC, id DESC LIMIT ?)'
        ).run(signalId, signalId, bounds.MAX_SAMPLES_PER_SIGNAL);
      }
    }

    function getBaselineSamples(signalId) {
      return database.prepare(
        'SELECT measured_at, value FROM baseline_samples WHERE signal_id = ? ORDER BY measured_at ASC, id ASC'
      ).all(signalId);
    }

    function countBaselineSamples(signalId) {
      var row = database.prepare('SELECT COUNT(*) AS n FROM baseline_samples WHERE signal_id = ?').get(signalId);
      return row && typeof row.n === 'number' ? row.n : 0;
    }

    function classifyDeviation(deltaRatio, calibration) {
      if (deltaRatio <= calibration.expected_variation_max) return DEVIATION_CLASSES.EXPECTED_VARIATION;
      if (deltaRatio >= calibration.critical_discontinuity_min) return DEVIATION_CLASSES.CRITICAL_DISCONTINUITY;
      if (deltaRatio >= calibration.material_deviation_min) return DEVIATION_CLASSES.MATERIAL_DEVIATION;
      return DEVIATION_CLASSES.EXPECTED_VARIATION;
    }

    // #4079 store boundary contract: exact values never leave this method;
    // only a bounded classification result crosses.
    function evaluate(request) {
      if (!isPlainRecord(request)) throw new TypeError('INVALID_SIGNAL');
      var signalId = request.signal_id;
      var calibration = request.calibration;
      if (typeof signalId !== 'string' || !isPlainRecord(calibration)) throw new TypeError('INVALID_SIGNAL');
      var samples = getBaselineSamples(signalId);
      if (samples.length < bounds.MIN_BASELINE_SAMPLES) {
        return { status: BASELINE_STATUSES.INSUFFICIENT, baseline_deviation: DEVIATION_CLASSES.UNKNOWN, evidence_completeness: 'invalid' };
      }
      var latest = samples[samples.length - 1].value;
      var sum = 0;
      for (var i = 0; i < samples.length - 1; i++) sum += samples[i].value;
      var referenceMean = sum / (samples.length - 1);
      var denominator = Math.abs(referenceMean) > 1e-12 ? Math.abs(referenceMean) : 1e-12;
      var deltaRatio = Math.abs(latest - referenceMean) / denominator;
      return {
        status: BASELINE_STATUSES.ESTABLISHED,
        baseline_deviation: classifyDeviation(deltaRatio, calibration),
        evidence_completeness: 'complete'
      };
    }

    function acquireLease(ownerKey, acquiredAt) {
      if (typeof ownerKey !== 'string' || !ownerKey) throw new TypeError('INVALID_LEASE_OWNER');
      var at = typeof acquiredAt === 'number' ? acquiredAt : nowFn();
      var existing = database.prepare('SELECT owner_key, expires_at FROM run_lease WHERE id = 1').get();
      if (existing && existing.expires_at > at) {
        return { outcome: LEASE_OUTCOMES.BUSY, lease_class: 'ACTIVE_LEASE_HELD' };
      }
      database.prepare(
        'INSERT INTO run_lease (id, owner_key, acquired_at, expires_at) VALUES (1, ?, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET owner_key = excluded.owner_key, acquired_at = excluded.acquired_at, expires_at = excluded.expires_at'
      ).run(ownerKey, at, at + bounds.LEASE_DURATION_MS);
      return { outcome: LEASE_OUTCOMES.ACQUIRED, lease_class: 'LEASE_ACQUIRED', expires_at: at + bounds.LEASE_DURATION_MS };
    }

    function releaseLease(ownerKey) {
      if (typeof ownerKey !== 'string' || !ownerKey) throw new TypeError('INVALID_LEASE_OWNER');
      var existing = database.prepare('SELECT owner_key FROM run_lease WHERE id = 1').get();
      if (!existing || existing.owner_key !== ownerKey) return false;
      database.prepare('DELETE FROM run_lease WHERE id = 1').run();
      return true;
    }

    function hasActiveLease(at) {
      var when = typeof at === 'number' ? at : nowFn();
      var existing = database.prepare('SELECT expires_at FROM run_lease WHERE id = 1').get();
      return Boolean(existing && existing.expires_at > when);
    }

    function recordDedupe(fingerprint, seenAt) {
      if (typeof fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(fingerprint)) throw new TypeError('INVALID_FINGERPRINT');
      var at = typeof seenAt === 'number' ? seenAt : nowFn();
      var existing = database.prepare('SELECT fingerprint FROM dedupe_state WHERE fingerprint = ?').get(fingerprint);
      if (existing) {
        database.prepare('UPDATE dedupe_state SET last_seen_at = ? WHERE fingerprint = ?').run(at, fingerprint);
        return DEDUPE_OUTCOMES.DUPLICATE;
      }
      database.prepare('INSERT INTO dedupe_state (fingerprint, first_seen_at, last_seen_at) VALUES (?, ?, ?)')
        .run(fingerprint, at, at);
      var countRow = database.prepare('SELECT COUNT(*) AS n FROM dedupe_state').get();
      if (countRow && countRow.n > bounds.DEDUPE_MAX_ENTRIES) {
        database.prepare(
          'DELETE FROM dedupe_state WHERE fingerprint NOT IN (' +
          'SELECT fingerprint FROM dedupe_state ORDER BY last_seen_at DESC, first_seen_at DESC, fingerprint ASC LIMIT ?)'
        ).run(bounds.DEDUPE_MAX_ENTRIES);
      }
      return DEDUPE_OUTCOMES.NEW;
    }

    function getDedupeFingerprints() {
      var rows = database.prepare('SELECT fingerprint FROM dedupe_state').all();
      var out = [];
      for (var i = 0; i < rows.length; i++) out.push(rows[i].fingerprint);
      return out;
    }

    function countDedupeEntries() {
      var row = database.prepare('SELECT COUNT(*) AS n FROM dedupe_state').get();
      return row && typeof row.n === 'number' ? row.n : 0;
    }

    function recordHeartbeat(outcomeClass, releaseSha, recordedAt) {
      if (typeof outcomeClass !== 'string' || !outcomeClass) throw new TypeError('INVALID_OUTCOME_CLASS');
      if (typeof releaseSha !== 'string' || !/^[0-9a-f]{40}$/.test(releaseSha)) throw new TypeError('INVALID_RELEASE_SHA');
      var at = typeof recordedAt === 'number' ? recordedAt : nowFn();
      database.prepare('INSERT INTO heartbeat_history (recorded_at, outcome_class, release_sha) VALUES (?, ?, ?)')
        .run(at, outcomeClass, releaseSha);
      var countRow = database.prepare('SELECT COUNT(*) AS n FROM heartbeat_history').get();
      if (countRow && countRow.n > bounds.HEARTBEAT_HISTORY_MAX) {
        database.prepare(
          'DELETE FROM heartbeat_history WHERE id NOT IN (' +
          'SELECT id FROM heartbeat_history ORDER BY recorded_at DESC, id DESC LIMIT ?)'
        ).run(bounds.HEARTBEAT_HISTORY_MAX);
      }
      return true;
    }

    function countHeartbeatRows() {
      var row = database.prepare('SELECT COUNT(*) AS n FROM heartbeat_history').get();
      return row && typeof row.n === 'number' ? row.n : 0;
    }

    function heartbeatStatus(at, staleThresholdMs) {
      var when = typeof at === 'number' ? at : nowFn();
      var threshold = typeof staleThresholdMs === 'number' ? staleThresholdMs : bounds.DEADMAN_STALE_THRESHOLD_MS;
      var latest = database.prepare(
        'SELECT recorded_at, outcome_class FROM heartbeat_history ORDER BY recorded_at DESC, id DESC LIMIT 1'
      ).get();
      if (!latest) {
        return { heartbeat_class: HEARTBEAT_CLASSES.NEVER_RECORDED, age_ms: null, outcome_class: null };
      }
      var age = when - latest.recorded_at;
      return {
        heartbeat_class: age > threshold ? HEARTBEAT_CLASSES.STALE : HEARTBEAT_CLASSES.CURRENT,
        age_ms: age,
        outcome_class: latest.outcome_class
      };
    }

    return Object.freeze({
      CONTRACT_VERSION: CONTRACT_VERSION,
      evaluate: evaluate,
      recordBaselineSample: recordBaselineSample,
      getBaselineSamples: getBaselineSamples,
      countBaselineSamples: countBaselineSamples,
      acquireLease: acquireLease,
      releaseLease: releaseLease,
      hasActiveLease: hasActiveLease,
      recordDedupe: recordDedupe,
      getDedupeFingerprints: getDedupeFingerprints,
      countDedupeEntries: countDedupeEntries,
      recordHeartbeat: recordHeartbeat,
      countHeartbeatRows: countHeartbeatRows,
      heartbeatStatus: heartbeatStatus
    });
  }

  var API = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    DEVIATION_CLASSES: DEVIATION_CLASSES,
    BASELINE_STATUSES: BASELINE_STATUSES,
    HEARTBEAT_CLASSES: HEARTBEAT_CLASSES,
    LEASE_OUTCOMES: LEASE_OUTCOMES,
    DEDUPE_OUTCOMES: DEDUPE_OUTCOMES,
    CAPABILITIES: Object.freeze([]),
    createPreviewStore: createPreviewStore
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.LoveBudReliabilityPreviewStore = API;
  if (typeof globalThis !== 'undefined') globalThis.LoveBudReliabilityPreviewStore = API;
})(this);
