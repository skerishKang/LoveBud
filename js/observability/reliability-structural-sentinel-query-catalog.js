'use strict';

// Issue #3842 — Read-only structural sentinel query catalog authority
// (Reliability & Observability child of parent #3461).
//
// This module is the FIXED REPOSITORY-OWNED QUERY CATALOG for the read-only
// structural sentinel. It is a PURE SOURCE AUTHORITY:
//   - carries NO capability (no network, provider, database, SQL execution,
//     filesystem write, process, or alert delivery);
//   - exposes only fixed, deep-frozen, detached query descriptors;
//   - never accepts caller-supplied SQL, table, column, path, URL, env,
//     credential, or arbitrary metadata;
//   - never executes anything and never connects to a database;
//   - provides a query-safety allowlist validator that REJECTS fail-closed any
//     mutation-capable, chained, commented, or capability-bearing SQL.
//
// The catalog distinguishes three descriptor modes:
//   AGGREGATE_COUNT  -> fixed repository-owned aggregate read query
//                       (executable, one-row `count` result)
//   PARITY_EVIDENCE  -> bounded canonical parity-evidence signal. It carries NO
//                       SQL; it declares a fixed bounded parity contract
//                       (evidence format version, object vocabulary, supported
//                       authority statuses) and is evaluated ONLY against
//                       bounded sanitized parity evidence supplied through the
//                       source-only translation seam. Reuses the #3860 outcome
//                       vocabulary exactly; never invents synonyms.
//   DEFERRED         -> bounded unavailable descriptor with a fixed
//                       prerequisite (e.g. CANONICAL_SCHEMA_AUTHORITY_REQUIRED)
//                       and NO executable SQL.
//
// Refs #3842.
// Refs #3458 — completed canonical migration identity/order/checksum,
//              expected-schema authority, adoption/bootstrap rules.
// Refs #3860 — completed provider-neutral read-only target attribution and
//              catalog parity core (DISPOSABLE_POSTGRES_REHEARSAL_TARGET /
//              CI_EPHEMERAL only). This catalog does NOT extend #3860 to
//              PRODUCTION scope; it only reuses its outcome vocabulary.
// Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '2';

  // ---------------------------------------------------------------------------
  // Deep-freeze helpers (same equivalent immutable boundary as #3835 taxonomy).
  // ---------------------------------------------------------------------------
  function deepFreeze(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      for (var a = 0; a < value.length; a++) deepFreeze(value[a]);
      return Object.freeze(value);
    }
    var keys = Object.keys(value);
    for (var k = 0; k < keys.length; k++) deepFreeze(value[keys[k]]);
    return Object.freeze(value);
  }

  function makeFrozenArray(values) {
    return Object.freeze(values.slice());
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function isPlainRecord(value) {
    if (value === null || typeof value !== 'object') return false;
    if (Array.isArray(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  // ---------------------------------------------------------------------------
  // Fixed deferred prerequisite tokens. A deferred descriptor must state one of
  // these fixed tokens; it must never contain executable SQL.
  // ---------------------------------------------------------------------------
  var DEFERRED_PREREQUISITES = Object.freeze({
    CANONICAL_SCHEMA_AUTHORITY_REQUIRED: 'CANONICAL_SCHEMA_AUTHORITY_REQUIRED'
  });

  // ---------------------------------------------------------------------------
  // Descriptor modes. Every signal carries exactly one fixed mode.
  //   AGGREGATE_COUNT  -> executable fixed aggregate read query (count rows)
  //   PARITY_EVIDENCE  -> bounded canonical parity-evidence signal (no SQL)
  //   DEFERRED         -> fixed prerequisite, no SQL
  // ---------------------------------------------------------------------------
  var DESCRIPTOR_MODES = Object.freeze({
    AGGREGATE_COUNT: 'AGGREGATE_COUNT',
    PARITY_EVIDENCE: 'PARITY_EVIDENCE',
    DEFERRED: 'DEFERRED'
  });

  // ---------------------------------------------------------------------------
  // Bounded parity outcome vocabulary — EXACT reuse of the #3860
  // read-only target attribution & catalog parity core outcome strings.
  // No new synonymous vocabulary is created here.
  // ---------------------------------------------------------------------------
  var PARITY_OUTCOMES = Object.freeze({
    PARITY_CONFIRMED: 'PARITY_CONFIRMED',
    PARITY_MISMATCH: 'PARITY_MISMATCH',
    AUTHORITY_ADOPTION_REQUIRED: 'AUTHORITY_ADOPTION_REQUIRED',
    CATALOG_COLLECTION_FAILED: 'CATALOG_COLLECTION_FAILED',
    INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
  });

  // ---------------------------------------------------------------------------
  // Fixed parity evidence contract for PARITY_EVIDENCE descriptors. The same
  // bounded object vocabulary used by #3860: object name pattern, sha256
  // fingerprint pattern, supported evidence format version, supported
  // authority status. A parity descriptor NEVER carries SQL and NEVER carries
  // provider/database identity; it only declares the bounded evidence shape it
  // accepts through the source-only translation seam.
  // ---------------------------------------------------------------------------
  var PARITY_EVIDENCE_CONTRACT = Object.freeze({
    evidence_format_version: '1.0',
    evidence_normalizer_version: '1.0',
    object_name_pattern: /^(?:table|view|materialized_view):[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/,
    fingerprint_pattern: /^sha256:[a-f0-9]{64}$/,
    supported_authority_statuses: Object.freeze(['ADOPTION_REQUIRED'])
  });

  // ---------------------------------------------------------------------------
  // Operation classes reused from the #3835 taxonomy.
  // ---------------------------------------------------------------------------
  var OPERATION_CLASSES = Object.freeze({
    STRUCTURAL_SCHEMA_CHECK: 'STRUCTURAL_SCHEMA_CHECK',
    TREE_PARENT_INTEGRITY_CHECK: 'TREE_PARENT_INTEGRITY_CHECK',
    MEMORY_PARENT_INTEGRITY_CHECK: 'MEMORY_PARENT_INTEGRITY_CHECK',
    SOCIAL_TARGET_INTEGRITY_CHECK: 'SOCIAL_TARGET_INTEGRITY_CHECK',
    BROWSE_ELIGIBILITY_BASELINE_CHECK: 'BROWSE_ELIGIBILITY_BASELINE_CHECK'
  });

  // ---------------------------------------------------------------------------
  // Fixed signal classes. Executable signals carry a fixed repository-owned
  // aggregate read query. Deferred signals carry a fixed prerequisite and no
  // SQL.
  // ---------------------------------------------------------------------------
  var SIGNAL_IDS = makeFrozenArray([
    'MEMORY_TREE_PARENT_ORPHAN_COUNT',
    'MEMORY_PARENT_ORPHAN_COUNT',
    'TREE_SOCIAL_TARGET_ORPHAN_COUNT',
    'TREE_COMMENT_TARGET_ORPHAN_COUNT',
    'PUBLIC_MEMORY_PARENT_ORPHAN_COUNT',
    'BROWSE_ELIGIBLE_ENTITY_COUNT',
    'STRUCTURAL_SCHEMA_DRIFT_CHECK',
    'MIGRATION_LEDGER_CATALOG_PARITY_CHECK'
  ]);

  // ---------------------------------------------------------------------------
  // Query safety validator.
  //
  // Every executable query must:
  //   - be a single SELECT or WITH...SELECT statement (no trailing semicolon);
  //   - contain no comment that can conceal a second statement;
  //   - contain no mutation/DDL/DCL/utility tokens;
  //   - contain no capability-bearing tokens (pg_sleep, dblink, file/network
  //     extension capability);
  //   - contain no user-parameter placeholders ($1, :name, ?);
  //   - not be a bare multi-statement script.
  // Anything unsafe is REJECTED fail closed (never stripped).
  // ---------------------------------------------------------------------------
  var FORBIDDEN_WORDS = makeFrozenArray([
    'INSERT',
    'UPDATE',
    'DELETE',
    'MERGE',
    'UPSERT',
    'TRUNCATE',
    'DROP',
    'ALTER',
    'CREATE',
    'GRANT',
    'REVOKE',
    'COPY',
    'CALL',
    'DO',
    'EXECUTE',
    'pg_sleep',
    'dblink',
    'pg_read_file',
    'pg_write_file',
    'lo_import',
    'lo_export',
    'COPY'
  ]);

  var FORBIDDEN_PATTERNS = makeFrozenArray([
    /--/,
    /\/\*/,
    /;/
  ]);

  var PLACEHOLDER_PATTERN = /[$][0-9]+|\?|:\w+/;

  function normalizeSqlText(sql) {
    if (typeof sql !== 'string') return '';
    return sql;
  }

  function isMutationToken(token, sql) {
    // Word-boundary match over the upper-cased SQL. A leading keyword in a
    // single SELECT is safe; these tokens are never part of the fixed catalog.
    var re = new RegExp('\\b' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    return re.test(sql);
  }

  function validateQuerySafety(sql) {
    if (typeof sql !== 'string' || sql.length === 0) {
      return { ok: false, error: 'EMPTY_QUERY' };
    }
    var normalized = normalizeSqlText(sql);
    for (var p = 0; p < FORBIDDEN_PATTERNS.length; p++) {
      if (FORBIDDEN_PATTERNS[p].test(normalized)) {
        return { ok: false, error: 'CHAINED_OR_COMMENTED_STATEMENT' };
      }
    }
    for (var w = 0; w < FORBIDDEN_WORDS.length; w++) {
      if (isMutationToken(FORBIDDEN_WORDS[w], normalized)) {
        return { ok: false, error: 'FORBIDDEN_TOKEN:' + FORBIDDEN_WORDS[w] };
      }
    }
    if (PLACEHOLDER_PATTERN.test(normalized)) {
      return { ok: false, error: 'QUERY_PARAMETER_FORBIDDEN' };
    }
    var trimmed = normalized.trim();
    if (!/^SELECT\b/i.test(trimmed) && !/^WITH\b/i.test(trimmed)) {
      return { ok: false, error: 'NOT_SELECT_STATEMENT' };
    }
    return { ok: true, error: null };
  }

  // ---------------------------------------------------------------------------
  // Fixed query text. These are repository-owned aggregate queries returning
  // exactly one row with the approved aggregate alias `count`.
  //
  // MEMORY_TREE_PARENT_ORPHAN_COUNT:
  //   memories.tree_id is non-null and no matching trees.id exists.
  //
  // MEMORY_PARENT_ORPHAN_COUNT:
  //   memories.parent_id is non-null and no matching parent memory exists.
  //   memories.parent_id IS NULL is a valid root memory and is never an orphan.
  //
  // Both queries use a LEFT JOIN with IS NULL detection. The fixed SQL below
  // is the ONLY text ever executed for these descriptors. No caller can select
  // a different query, table, column, or statement.
  // ---------------------------------------------------------------------------
  var QUERY_MEMORY_TREE_PARENT_ORPHAN_COUNT = [
    'SELECT COUNT(*) AS count',
    'FROM memories m',
    'LEFT JOIN trees t ON t.id = m.tree_id',
    'WHERE m.tree_id IS NOT NULL',
    '  AND t.id IS NULL'
  ].join(' ');

  var QUERY_MEMORY_PARENT_ORPHAN_COUNT = [
    'SELECT COUNT(*) AS count',
    'FROM memories m',
    'LEFT JOIN memories p ON p.id = m.parent_id',
    'WHERE m.parent_id IS NOT NULL',
    '  AND p.id IS NULL'
  ].join(' ');

  // Validate the fixed executable query text at module construction. If a
  // repository regression ever makes an executable query unsafe, this module
  // fails closed immediately (throws) instead of shipping an unsafe catalog.
  var safetyA = validateQuerySafety(QUERY_MEMORY_TREE_PARENT_ORPHAN_COUNT);
  var safetyB = validateQuerySafety(QUERY_MEMORY_PARENT_ORPHAN_COUNT);
  if (!safetyA.ok || !safetyB.ok) {
    throw new Error('STRUCTURAL_SENTINEL_UNSAFE_FIXED_QUERY');
  }

  // ---------------------------------------------------------------------------
  // Descriptor table. Each descriptor is frozen and detached.
  // ---------------------------------------------------------------------------
  var DESCRIPTORS = Object.freeze({
    MEMORY_TREE_PARENT_ORPHAN_COUNT: Object.freeze({
      id: 'MEMORY_TREE_PARENT_ORPHAN_COUNT',
      descriptor_mode: DESCRIPTOR_MODES.AGGREGATE_COUNT,
      operation_class: OPERATION_CLASSES.TREE_PARENT_INTEGRITY_CHECK,
      executable: true,
      query: QUERY_MEMORY_TREE_PARENT_ORPHAN_COUNT,
      result_contract: Object.freeze({
        rows: 1,
        columns: Object.freeze(['count'])
      })
    }),
    MEMORY_PARENT_ORPHAN_COUNT: Object.freeze({
      id: 'MEMORY_PARENT_ORPHAN_COUNT',
      descriptor_mode: DESCRIPTOR_MODES.AGGREGATE_COUNT,
      operation_class: OPERATION_CLASSES.MEMORY_PARENT_INTEGRITY_CHECK,
      executable: true,
      query: QUERY_MEMORY_PARENT_ORPHAN_COUNT,
      result_contract: Object.freeze({
        rows: 1,
        columns: Object.freeze(['count'])
      })
    }),
    TREE_SOCIAL_TARGET_ORPHAN_COUNT: Object.freeze({
      id: 'TREE_SOCIAL_TARGET_ORPHAN_COUNT',
      descriptor_mode: DESCRIPTOR_MODES.DEFERRED,
      operation_class: OPERATION_CLASSES.SOCIAL_TARGET_INTEGRITY_CHECK,
      executable: false,
      deferred_prerequisite: DEFERRED_PREREQUISITES.CANONICAL_SCHEMA_AUTHORITY_REQUIRED,
      query: null,
      result_contract: null
    }),
    TREE_COMMENT_TARGET_ORPHAN_COUNT: Object.freeze({
      id: 'TREE_COMMENT_TARGET_ORPHAN_COUNT',
      descriptor_mode: DESCRIPTOR_MODES.DEFERRED,
      operation_class: OPERATION_CLASSES.SOCIAL_TARGET_INTEGRITY_CHECK,
      executable: false,
      deferred_prerequisite: DEFERRED_PREREQUISITES.CANONICAL_SCHEMA_AUTHORITY_REQUIRED,
      query: null,
      result_contract: null
    }),
    PUBLIC_MEMORY_PARENT_ORPHAN_COUNT: Object.freeze({
      id: 'PUBLIC_MEMORY_PARENT_ORPHAN_COUNT',
      descriptor_mode: DESCRIPTOR_MODES.DEFERRED,
      operation_class: OPERATION_CLASSES.MEMORY_PARENT_INTEGRITY_CHECK,
      executable: false,
      deferred_prerequisite: DEFERRED_PREREQUISITES.CANONICAL_SCHEMA_AUTHORITY_REQUIRED,
      query: null,
      result_contract: null
    }),
    BROWSE_ELIGIBLE_ENTITY_COUNT: Object.freeze({
      id: 'BROWSE_ELIGIBLE_ENTITY_COUNT',
      descriptor_mode: DESCRIPTOR_MODES.DEFERRED,
      operation_class: OPERATION_CLASSES.BROWSE_ELIGIBILITY_BASELINE_CHECK,
      executable: false,
      deferred_prerequisite: DEFERRED_PREREQUISITES.CANONICAL_SCHEMA_AUTHORITY_REQUIRED,
      query: null,
      result_contract: null
    }),
    STRUCTURAL_SCHEMA_DRIFT_CHECK: Object.freeze({
      id: 'STRUCTURAL_SCHEMA_DRIFT_CHECK',
      descriptor_mode: DESCRIPTOR_MODES.PARITY_EVIDENCE,
      operation_class: OPERATION_CLASSES.STRUCTURAL_SCHEMA_CHECK,
      executable: false,
      deferred_prerequisite: null,
      query: null,
      result_contract: null,
      parity_contract: PARITY_EVIDENCE_CONTRACT
    }),
    MIGRATION_LEDGER_CATALOG_PARITY_CHECK: Object.freeze({
      id: 'MIGRATION_LEDGER_CATALOG_PARITY_CHECK',
      descriptor_mode: DESCRIPTOR_MODES.PARITY_EVIDENCE,
      operation_class: OPERATION_CLASSES.STRUCTURAL_SCHEMA_CHECK,
      executable: false,
      deferred_prerequisite: null,
      query: null,
      result_contract: null,
      parity_contract: PARITY_EVIDENCE_CONTRACT
    })
  });

  var SIGNAL_ID_SET = (function () {
    var s = {};
    for (var i = 0; i < SIGNAL_IDS.length; i++) s[SIGNAL_IDS[i]] = true;
    return deepFreeze(s);
  })();

  function isKnownSignal(id) {
    return typeof id === 'string' && Object.prototype.hasOwnProperty.call(SIGNAL_ID_SET, id);
  }

  function getDescriptor(id) {
    if (!isKnownSignal(id)) return null;
    var descriptor = DESCRIPTORS[id];
    if (!descriptor) return null;
    return deepFreeze(Object.assign({}, descriptor));
  }

  function getExecutableIds() {
    var out = [];
    for (var i = 0; i < SIGNAL_IDS.length; i++) {
      var id = SIGNAL_IDS[i];
      var d = DESCRIPTORS[id];
      if (d && d.executable === true) out.push(id);
    }
    return makeFrozenArray(out);
  }

  function getDeferredIds() {
    var out = [];
    for (var i = 0; i < SIGNAL_IDS.length; i++) {
      var id = SIGNAL_IDS[i];
      var d = DESCRIPTORS[id];
      if (d && d.descriptor_mode === DESCRIPTOR_MODES.DEFERRED) out.push(id);
    }
    return makeFrozenArray(out);
  }

  function getParityEvidenceIds() {
    var out = [];
    for (var i = 0; i < SIGNAL_IDS.length; i++) {
      var id = SIGNAL_IDS[i];
      var d = DESCRIPTORS[id];
      if (d && d.descriptor_mode === DESCRIPTOR_MODES.PARITY_EVIDENCE) out.push(id);
    }
    return makeFrozenArray(out);
  }

  function getAllIds() {
    return makeFrozenArray(SIGNAL_IDS);
  }

  // ---------------------------------------------------------------------------
  // Capabilities — this is a pure source authority; zero capabilities.
  // ---------------------------------------------------------------------------
  var CAPABILITIES = Object.freeze([]);

  var STRUCTURAL_SENTINEL_QUERY_CATALOG = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    DEFERRED_PREREQUISITES: DEFERRED_PREREQUISITES,
    DESCRIPTOR_MODES: DESCRIPTOR_MODES,
    PARITY_OUTCOMES: PARITY_OUTCOMES,
    PARITY_EVIDENCE_CONTRACT: PARITY_EVIDENCE_CONTRACT,
    OPERATION_CLASSES: OPERATION_CLASSES,
    SIGNAL_IDS: SIGNAL_IDS,
    SIGNAL_ID_SET: SIGNAL_ID_SET,
    CAPABILITIES: CAPABILITIES,

    isKnownSignal: isKnownSignal,
    getDescriptor: getDescriptor,
    getExecutableIds: getExecutableIds,
    getDeferredIds: getDeferredIds,
    getParityEvidenceIds: getParityEvidenceIds,
    getAllIds: getAllIds,
    validateQuerySafety: validateQuerySafety
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = STRUCTURAL_SENTINEL_QUERY_CATALOG;
  }
  if (typeof window !== 'undefined') {
    window.LoveBudStructuralSentinelQueryCatalog = STRUCTURAL_SENTINEL_QUERY_CATALOG;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.LoveBudStructuralSentinelQueryCatalog = STRUCTURAL_SENTINEL_QUERY_CATALOG;
  }
})(this);
