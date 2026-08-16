'use strict';

// Issue #4080 — Write outcome classification contract (parent #3461).
//
// Deterministic contract tests for the pure write-outcome classifier core and
// the edge-facts adapter. Executes the production modules in-process with no
// network, database, browser, provider, or Production access.
//
// Refs #4080.
// Refs #3461 — Keep OPEN.
// Refs #3457.
// Refs #3835.
// Refs #1882 — Keep OPEN.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

// Values created inside the vm sandbox carry a foreign realm prototype, so
// strict deep-equal must compare realm-local copies.
function toLocalArray(value) {
  return Array.prototype.slice.call(value);
}

function loadClassifierCore() {
  const source = read('js/observability/reliability-write-outcome-classifier-core.js');
  const sandbox = vm.createContext({
    console,
    window: {},
    globalThis: {}
  });
  vm.runInContext(source, sandbox);
  return sandbox.window.LoveBudWriteOutcomeClassifierCore;
}

function committedFacts(overrides) {
  return Object.assign(
    {
      transport: 'ok',
      commit: 'committed',
      returning: 'row_returned',
      reread: 'visible'
    },
    overrides || {}
  );
}

test('1. module exposes a frozen pure authority with zero capabilities', () => {
  const core = loadClassifierCore();
  assert.equal(core.CONTRACT_VERSION, '1');
  assert.ok(Object.isFrozen(core), 'core export must be frozen');
  assert.deepEqual(toLocalArray(core.CAPABILITIES), []);
  assert.ok(Object.isFrozen(core.OUTCOME_CODES));
  assert.ok(Object.isFrozen(core.WRITE_OUTCOME_STAGES));
  assert.ok(Object.isFrozen(core.WRITE_OUTCOME_STAGE_ORDER));
});

test('2. five write-boundary stages are distinct and ordered', () => {
  const core = loadClassifierCore();
  assert.deepEqual(toLocalArray(core.WRITE_OUTCOME_STAGE_ORDER), [
    'REQUEST_ACCEPTED',
    'DB_TRANSACTION_COMMITTED',
    'CANONICAL_ROW_RETURNED',
    'FOLLOWUP_REREAD_VISIBLE',
    'CLIENT_VISIBLE_SUCCESS'
  ]);
  const stages = Object.values(core.WRITE_OUTCOME_STAGES);
  assert.equal(new Set(stages).size, 5, 'stages must be distinct');
});

test('3. WRITE_ACKNOWLEDGED is never equivalent to CANONICAL_REREAD_CONFIRMED', () => {
  const core = loadClassifierCore();
  assert.equal(core.WRITE_ACKNOWLEDGED_EQUALS_REREAD_CONFIRMED, false);
});

test('4. vocabulary is provider-neutral', () => {
  const core = loadClassifierCore();
  const providerTokens = ['modal', 'cloudflare', 'firebase', 'neon', 'vercel', 'netlify'];
  const vocabulary = JSON.stringify({
    stages: core.WRITE_OUTCOME_STAGES,
    outcomes: core.OUTCOME_CODES,
    transport: core.TRANSPORT_CLASSES,
    commit: core.COMMIT_CLASSES,
    returning: core.RETURNING_CLASSES,
    reread: core.REREAD_CLASSES,
    upstream: core.UPSTREAM_STATUS_CLASSES
  }).toLowerCase();
  for (const token of providerTokens) {
    assert.ok(!vocabulary.includes(token), `vocabulary must not encode provider: ${token}`);
  }
});

test('5. outcome vocabulary reuses #3835/#3852/#3855 semantics plus narrow additions', () => {
  const core = loadClassifierCore();
  const required = [
    'CONFIRMED',
    'TRANSPORT_FAILED',
    'ACKNOWLEDGEMENT_MISSING',
    'ACKNOWLEDGED_REREAD_MISSING',
    'MONITORING_FAILED',
    'INSUFFICIENT_EVIDENCE',
    'WRITE_REJECTED_VALIDATION',
    'WRITE_COMMITTED_ROW_RETURNED',
    'WRITE_COMMITTED_REREAD_MISSING',
    'WRITE_COMMITTED_REREAD_MISMATCH',
    'WRITE_STATUS_UNKNOWN'
  ];
  for (const code of required) {
    assert.equal(core.OUTCOME_CODES[code], code, `outcome code present: ${code}`);
  }
});

test('6. validation rejects non-plain input', () => {
  const core = loadClassifierCore();
  for (const bad of [null, undefined, 42, 'x', [], new Date(), () => {}]) {
    const result = core.validateWriteOutcomeFacts(bad);
    assert.equal(result.ok, false);
    assert.deepEqual(toLocalArray(result.errors), ['INPUT_NOT_OBJECT']);
  }
});

test('7. validation rejects private identifier keys', () => {
  const core = loadClassifierCore();
  const privateKeys = ['token', 'email', 'owner_id', 'tree_id', 'memory_id', 'title', 'url', 'payload', 'sql', 'raw_error', 'provider', 'database_url', 'secret'];
  for (const key of privateKeys) {
    const facts = committedFacts();
    facts[key] = 'leak';
    const result = core.validateWriteOutcomeFacts(facts);
    assert.equal(result.ok, false, `private key rejected: ${key}`);
    assert.ok(result.errors.includes('PRIVATE_FIELD_REJECTED'));
  }
});

test('8. validation rejects unknown fields and missing required fields', () => {
  const core = loadClassifierCore();
  const unknown = committedFacts({ bogus_field: 1 });
  assert.equal(core.validateWriteOutcomeFacts(unknown).ok, false);
  assert.ok(core.validateWriteOutcomeFacts(unknown).errors.includes('UNKNOWN_FIELD'));

  const missing = { transport: 'ok', commit: 'committed', returning: 'row_returned' };
  const result = core.validateWriteOutcomeFacts(missing);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('MISSING_REQUIRED_FIELD'));
});

test('9. validation rejects unknown enum values', () => {
  const core = loadClassifierCore();
  const bad = committedFacts({ commit: 'maybe_committed' });
  const result = core.validateWriteOutcomeFacts(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('UNKNOWN_ENUM'));
});

test('10. classify throws a fixed error code on invalid facts', () => {
  const core = loadClassifierCore();
  assert.throws(() => core.classifyWriteOutcome(null), /INPUT_NOT_OBJECT/);
  const facts = committedFacts({ token: 'x' });
  assert.throws(() => core.classifyWriteOutcome(facts), /PRIVATE_FIELD_REJECTED/);
});

test('11. validation rejection before DB side effect', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(
    committedFacts({ validation_rejected: true, commit: 'not_reached', returning: 'not_reached', reread: 'not_attempted' })
  );
  assert.equal(result.outcome_code, 'WRITE_REJECTED_VALIDATION');
  assert.equal(result.stage, 'REQUEST_ACCEPTED');
  assert.equal(result.retry_safe, true);
});

test('12. not dispatched yields ACKNOWLEDGEMENT_MISSING', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(
    committedFacts({ transport: 'not_dispatched', commit: 'not_reached', returning: 'not_reached', reread: 'not_attempted' })
  );
  assert.equal(result.outcome_code, 'ACKNOWLEDGEMENT_MISSING');
  assert.equal(result.retry_safe, true);
});

test('13. undecidable timeout classifies WRITE_STATUS_UNKNOWN and is never retry-safe', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(
    committedFacts({ transport: 'timeout', commit: 'unknown', returning: 'unknown', reread: 'unknown' })
  );
  assert.equal(result.outcome_code, 'WRITE_STATUS_UNKNOWN');
  assert.equal(result.retry_safe, false, 'undecidable timeout must never be retry-safe');
  assert.equal(result.stage, 'REQUEST_ACCEPTED');
});

test('14. undecidable network error classifies WRITE_STATUS_UNKNOWN', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(
    committedFacts({ transport: 'network_error', commit: 'unknown', returning: 'unknown', reread: 'unknown' })
  );
  assert.equal(result.outcome_code, 'WRITE_STATUS_UNKNOWN');
  assert.equal(result.retry_safe, false);
});

test('15. transport ok but commit unknown classifies WRITE_STATUS_UNKNOWN', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(
    committedFacts({ commit: 'unknown', returning: 'unknown', reread: 'unknown' })
  );
  assert.equal(result.outcome_code, 'WRITE_STATUS_UNKNOWN');
  assert.equal(result.retry_safe, false);
});

test('16. decidable transport failure with no commit yields TRANSPORT_FAILED', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(
    committedFacts({ transport: 'network_error', commit: 'rolled_back', returning: 'not_reached', reread: 'not_attempted' })
  );
  assert.equal(result.outcome_code, 'TRANSPORT_FAILED');
  assert.equal(result.retry_safe, true);
});

test('17. committed + row returned + reread visible yields CONFIRMED at FOLLOWUP_REREAD_VISIBLE', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(committedFacts());
  assert.equal(result.outcome_code, 'CONFIRMED');
  assert.equal(result.stage, 'FOLLOWUP_REREAD_VISIBLE');
  assert.equal(result.evidence_completeness, 'complete');
});

test('18. committed + row returned + reread visible + client visible yields CLIENT_VISIBLE_SUCCESS', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(committedFacts({ client_visible: true }));
  assert.equal(result.outcome_code, 'CONFIRMED');
  assert.equal(result.stage, 'CLIENT_VISIBLE_SUCCESS');
});

test('19. committed + row returned + reread missing yields WRITE_COMMITTED_REREAD_MISSING', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(committedFacts({ reread: 'missing' }));
  assert.equal(result.outcome_code, 'WRITE_COMMITTED_REREAD_MISSING');
  assert.equal(result.stage, 'CANONICAL_ROW_RETURNED');
  assert.equal(result.retry_safe, false);
});

test('20. committed + row returned + reread mismatch yields WRITE_COMMITTED_REREAD_MISMATCH', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(committedFacts({ reread: 'mismatch' }));
  assert.equal(result.outcome_code, 'WRITE_COMMITTED_REREAD_MISMATCH');
  assert.equal(result.retry_safe, false);
});

test('21. committed + row returned + reread not attempted yields WRITE_COMMITTED_ROW_RETURNED', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(committedFacts({ reread: 'not_attempted' }));
  assert.equal(result.outcome_code, 'WRITE_COMMITTED_ROW_RETURNED');
  assert.equal(result.stage, 'CANONICAL_ROW_RETURNED');
});

test('22. committed + no row returned yields ACKNOWLEDGED_REREAD_MISSING', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(committedFacts({ returning: 'no_row', reread: 'missing' }));
  assert.equal(result.outcome_code, 'ACKNOWLEDGED_REREAD_MISSING');
  assert.equal(result.stage, 'DB_TRANSACTION_COMMITTED');
});

test('23. committed without returning evidence yields INSUFFICIENT_EVIDENCE', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(committedFacts({ returning: 'unknown', reread: 'unknown' }));
  assert.equal(result.outcome_code, 'INSUFFICIENT_EVIDENCE');
});

test('24. rolled back with 4xx upstream yields WRITE_REJECTED_VALIDATION', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(
    committedFacts({ commit: 'rolled_back', returning: 'not_reached', reread: 'not_attempted', upstream_status_class: 'client_error_4xx' })
  );
  assert.equal(result.outcome_code, 'WRITE_REJECTED_VALIDATION');
  assert.equal(result.retry_safe, true);
});

test('25. results are frozen, canonical, and carry only bounded fields', () => {
  const core = loadClassifierCore();
  const result = core.classifyWriteOutcome(committedFacts());
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(Object.keys(result).sort(), ['evidence_completeness', 'outcome_code', 'retry_safe', 'stage']);
  assert.ok(core.isCanonicalResult(result));
});

test('26. isCanonicalResult rejects non-canonical and private-keyed results', () => {
  const core = loadClassifierCore();
  assert.equal(core.isCanonicalResult({}), false);
  assert.equal(core.isCanonicalResult(null), false);
  assert.equal(core.isCanonicalResult(Object.freeze({ stage: 'REQUEST_ACCEPTED', outcome_code: 'CONFIRMED', retry_safe: false, evidence_completeness: 'complete' })), false, 'CONFIRMED outside reread stage rejected');
  const leaked = Object.freeze({ stage: 'REQUEST_ACCEPTED', outcome_code: 'WRITE_STATUS_UNKNOWN', retry_safe: false, evidence_completeness: 'partial', token: 'x' });
  assert.equal(core.isCanonicalResult(leaked), false);
});

test('27. WRITE_STATUS_UNKNOWN results are never retry-safe in canonical form', () => {
  const core = loadClassifierCore();
  const bad = Object.freeze({ stage: 'REQUEST_ACCEPTED', outcome_code: 'WRITE_STATUS_UNKNOWN', retry_safe: true, evidence_completeness: 'partial' });
  assert.equal(core.isCanonicalResult(bad), false);
});

test('28. classification is deterministic and input is never mutated', () => {
  const core = loadClassifierCore();
  const facts = committedFacts({ reread: 'missing' });
  const snapshot = JSON.stringify(facts);
  const a = core.classifyWriteOutcome(facts);
  const b = core.classifyWriteOutcome(facts);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(facts), snapshot, 'input facts must not be mutated');
});

test('29. edge-facts adapter maps bounded observations to facts', async () => {
  const adapter = await import('../../functions/_shared/write-outcome-edge-facts.js');
  assert.equal(adapter.EDGE_FACTS_CONTRACT_VERSION, '1');

  const timeoutFacts = adapter.buildEdgeWriteFacts({ dispatched: true, timedOut: true, networkError: false });
  assert.equal(timeoutFacts.transport, 'timeout');
  assert.equal(timeoutFacts.commit, 'unknown', 'edge cannot observe commit state');

  const notDispatched = adapter.buildEdgeWriteFacts({ dispatched: false, timedOut: false, networkError: false });
  assert.equal(notDispatched.transport, 'not_dispatched');

  const rejected = adapter.buildEdgeWriteFacts({ dispatched: true, timedOut: false, networkError: false, upstreamStatus: 400 });
  assert.equal(rejected.validation_rejected, true);
  assert.equal(rejected.upstream_status_class, 'client_error_4xx');

  const accepted = adapter.buildEdgeWriteFacts({ dispatched: true, timedOut: false, networkError: false, upstreamStatus: 201 });
  assert.equal(accepted.transport, 'ok');
  assert.equal(accepted.commit, 'unknown', 'upstream 2xx proves acceptance only, not commit');
});

test('30. edge-facts adapter + classifier prove WRITE_STATUS_UNKNOWN on undecidable timeout', async () => {
  const adapter = await import('../../functions/_shared/write-outcome-edge-facts.js');
  const core = loadClassifierCore();
  const facts = adapter.buildEdgeWriteFacts({ dispatched: true, timedOut: true, networkError: false });
  const result = core.classifyWriteOutcome(facts);
  assert.equal(result.outcome_code, 'WRITE_STATUS_UNKNOWN');
  assert.equal(result.retry_safe, false);
});

test('31. edge-facts adapter rejects private and unknown observation keys', async () => {
  const adapter = await import('../../functions/_shared/write-outcome-edge-facts.js');
  assert.throws(
    () => adapter.buildEdgeWriteFacts({ dispatched: true, timedOut: false, networkError: false, authorization: 'Bearer x' }),
    /PRIVATE_FIELD_REJECTED/
  );
  assert.throws(
    () => adapter.buildEdgeWriteFacts({ dispatched: true, timedOut: false, networkError: false, body: '{}' }),
    /PRIVATE_FIELD_REJECTED/
  );
  assert.throws(
    () => adapter.buildEdgeWriteFacts({ dispatched: true, timedOut: false, networkError: false, bogus: 1 }),
    /UNKNOWN_FIELD/
  );
  assert.throws(
    () => adapter.buildEdgeWriteFacts({ dispatched: 'yes', timedOut: false, networkError: false }),
    /INVALID_OBSERVATION_VALUE/
  );
});
