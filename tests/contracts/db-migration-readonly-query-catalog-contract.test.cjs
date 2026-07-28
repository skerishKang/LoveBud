'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, 'db', 'migration-provenance', 'readonly-query-catalog.json');
const CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'db-migration-readonly-query-catalog-contract.md');
const DECISION_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md');
const CLASSIFICATION_PATH = path.join(REPO_ROOT, 'tests', 'test-layer-classification.json');
const TEST_PATH = 'tests/contracts/db-migration-readonly-query-catalog-contract.test.cjs';

const EXPECTED_CATALOG = {
  format_version: '1.0',
  status: 'ADOPTION_REQUIRED',
  queries: {},
};

const PROTECTED_ISSUES = [1882, 3425, 3435, 3437, 3458, 3657];
const QUERY_REFERENCE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELD_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

function readText(filePath) {
  assert.ok(fs.existsSync(filePath), `Required source must exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  const raw = readText(filePath);
  return { raw, parsed: JSON.parse(raw) };
}

function sortedKeys(value) {
  return Object.keys(value).sort();
}

function extractFencedPaths(doc, heading) {
  const section = doc.split(heading)[1]?.split('\n## ')[0] || '';
  const block = section.match(/```text\n([\s\S]*?)\n```/);
  assert.ok(block, `Missing text block after ${heading}`);
  return block[1].split('\n').map((line) => line.trim()).filter(Boolean);
}

function validateFutureEntry(mappingKey, entry) {
  assert.match(mappingKey, QUERY_REFERENCE_RE);
  assert.deepEqual(sortedKeys(entry), ['name', 'result_contract', 'text', 'values']);
  assert.equal(entry.name, mappingKey);
  assert.equal(typeof entry.text, 'string');
  assert.ok(entry.text.length > 0);
  assert.ok(Array.isArray(entry.values));
  for (const value of entry.values) {
    assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
    assert.ok(!Array.isArray(value));
    assert.ok(value === null || typeof value !== 'object');
  }
  assert.deepEqual(sortedKeys(entry.result_contract), ['field', 'kind']);
  assert.equal(entry.result_contract.kind, 'BOOLEAN_SINGLE_ROW');
  assert.match(entry.result_contract.field, FIELD_RE);
}

describe('DB migration read-only query catalog source-static contract (#3669)', () => {
  it('1. fixed catalog path exists and parses as JSON', () => {
    const { raw } = readJson(CATALOG_PATH);
    assert.doesNotThrow(() => JSON.parse(raw));
  });

  it('2. committed catalog exactly equals the inactive authority object', () => {
    const { parsed } = readJson(CATALOG_PATH);
    assert.deepEqual(parsed, EXPECTED_CATALOG);
  });

  it('3. committed catalog has the exact top-level key set', () => {
    const { parsed } = readJson(CATALOG_PATH);
    assert.deepEqual(Object.keys(parsed), ['format_version', 'status', 'queries']);
  });

  it('4. committed catalog contains zero query entries and queries is a plain object', () => {
    const { parsed } = readJson(CATALOG_PATH);
    assert.equal(Object.getPrototypeOf(parsed.queries), Object.prototype);
    assert.equal(Object.keys(parsed.queries).length, 0);
  });

  it('5. committed catalog contains no SQL text or active query object', () => {
    const { raw } = readJson(CATALOG_PATH);
    assert.doesNotMatch(raw, /\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|MERGE|WITH|FROM|WHERE|JOIN|RETURNING)\b/i);
    assert.doesNotMatch(raw, /"(?:name|text|values|result_contract|kind|field)"\s*:/);
  });

  it('6. document binds ADOPTION_REQUIRED to an exactly empty plain-object mapping', () => {
    const doc = readText(CONTRACT_PATH);
    assert.match(doc, /`ADOPTION_REQUIRED` requires `queries` to be exactly an empty plain object/);
  });

  it('7. document binds ACTIVE to a non-empty mapping and separate approval', () => {
    const doc = readText(CONTRACT_PATH);
    assert.match(doc, /`ACTIVE` requires `queries` to be a non-empty plain-object mapping/);
    assert.match(doc, /Transition from `ADOPTION_REQUIRED` to `ACTIVE` requires a separately approved contract\/adoption child/);
  });

  it('8. query-reference grammar and name equality are exact', () => {
    const doc = readText(CONTRACT_PATH);
    assert.match(doc, /\^\[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*\$/);
    assert.match(doc, /Each mapping key must equal its entry's `name` exactly/);
    assert.match('example-readonly-query-v1', QUERY_REFERENCE_RE);
    assert.doesNotMatch('Example_Query', QUERY_REFERENCE_RE);
  });

  it('9. future entry and result_contract exact keys are executable as a source-static schema example', () => {
    validateFutureEntry('example-readonly-query-v1', {
      name: 'example-readonly-query-v1',
      text: 'fixed read-only SQL',
      values: [],
      result_contract: {
        kind: 'BOOLEAN_SINGLE_ROW',
        field: 'satisfied',
      },
    });
  });

  it('10. name mismatch, non-kebab key, nested value, extra entry key, and extra result key fail the source-static schema assertions', () => {
    assert.throws(() => validateFutureEntry('bad_key', {
      name: 'bad_key', text: 'x', values: [], result_contract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'satisfied' },
    }));
    assert.throws(() => validateFutureEntry('query-v1', {
      name: 'different-name', text: 'x', values: [], result_contract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'satisfied' },
    }));
    assert.throws(() => validateFutureEntry('query-v1', {
      name: 'query-v1', text: 'x', values: [[]], result_contract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'satisfied' },
    }));
    assert.throws(() => validateFutureEntry('query-v1', {
      name: 'query-v1', text: 'x', values: [], extra: true, result_contract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'satisfied' },
    }));
    assert.throws(() => validateFutureEntry('query-v1', {
      name: 'query-v1', text: 'x', values: [], result_contract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'satisfied', extra: true },
    }));
  });

  it('11. BOOLEAN_SINGLE_ROW is the only initial kind and field is lower-snake-case', () => {
    const doc = readText(CONTRACT_PATH);
    assert.match(doc, /The initially allowed `kind` is exactly:[\s\S]*?BOOLEAN_SINGLE_ROW/);
    assert.match(doc, /\^\[a-z\]\[a-z0-9\]\*\(\?:_\[a-z0-9\]\+\)\*\$/);
    assert.match('satisfied', FIELD_RE);
    assert.match('precondition_satisfied_v1', FIELD_RE);
    assert.doesNotMatch('SatisfiedValue', FIELD_RE);
  });

  it('12. registry and catalog authority ownership remain separated', () => {
    const doc = readText(CONTRACT_PATH);
    const registrySection = doc.split('### Precondition registry ownership')[1]?.split('### ')[0] || '';
    const catalogSection = doc.split('### Read-only query catalog ownership')[1]?.split('## ')[0] || '';
    for (const key of ['migration_id', 'check_id', 'query_reference', 'expected']) assert.match(registrySection, new RegExp(key));
    for (const forbidden of ['SQL text', 'query object', 'result kind', 'result field']) assert.match(registrySection, new RegExp(forbidden));
    assert.match(catalogSection, /fixed query object/);
    assert.match(catalogSection, /raw result contract/);
    assert.match(catalogSection, /does not own `migration_id`/);
    assert.match(catalogSection, /registry's `expected` boolean/);
  });

  it('13. caller, environment, path, URL, credential, and dynamic authority are prohibited', () => {
    const doc = readText(CONTRACT_PATH);
    const section = doc.split('## Override prohibition')[1]?.split('## ')[0] || '';
    for (const term of ['adapter', 'manifest', 'environment variable', 'caller argument', 'alternate file', 'path', 'URL', 'credential', 'operator identity', 'hostname', 'dynamic input']) {
      assert.match(section, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  it('14. prohibited SQL construction and mutation behavior is documented without implementing a parser here', () => {
    const doc = readText(CONTRACT_PATH);
    for (const term of ['caller interpolation', 'dynamic identifier', 'environment fallback', 'mutating SQL', 'transaction control', 'session control', 'lock manipulation', 'data-modifying CTE', 'multiple SQL statements', 'SELECT INTO', 'row-locking clauses']) {
      assert.match(doc, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(doc, /neither a SQL parser nor a regex-only security validator/);
  });

  it('15. BOOLEAN_SINGLE_ROW future status semantics are complete and explicitly non-runtime in this child', () => {
    const doc = readText(CONTRACT_PATH);
    const section = doc.split('## BOOLEAN_SINGLE_ROW future semantics')[1]?.split('## ')[0] || '';
    for (const evidence of ['Exactly one row', 'Zero rows', 'Multiple rows', 'Missing named field', '`null` field value', 'Non-boolean field value', 'Proxy-backed', 'accessor-backed']) {
      assert.match(section, new RegExp(evidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(section, /strictly equal[\s\S]*?`PASS`/);
    assert.match(section, /not strictly equal[\s\S]*?`FAIL`/);
    assert.match(section, /does not return runtime status and does not execute a query/);
  });

  it('16. cumulative changed-file boundary is exactly the five approved files and contains no runtime implementation path', () => {
    const doc = readText(CONTRACT_PATH);
    const paths = extractFencedPaths(doc, '## Source-static implementation boundary');
    assert.deepEqual(paths, [
      'db/migration-provenance/readonly-query-catalog.json',
      'docs/architecture/db-migration-readonly-query-catalog-contract.md',
      'tests/contracts/db-migration-readonly-query-catalog-contract.test.cjs',
      'tests/test-layer-classification.json',
      'docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md',
    ]);
    assert.equal(paths.filter((entry) => entry.startsWith('scripts/') || entry.startsWith('functions/') || entry.startsWith('.github/')).length, 0);
  });

  it('17. source-static boundary excludes loader, resolver, evaluator, broker call, DB, SQL execution, Docker, Production, and secrets', () => {
    const doc = readText(CONTRACT_PATH);
    const section = doc.split('This child adds none of the following:')[1]?.split('## Required implementation sequence')[0] || '';
    for (const term of ['catalog loader', 'catalog resolver', 'evaluatePrecondition', 'queryLockedSession call', 'SQL execution', 'database connection', 'Docker or PostgreSQL execution', 'runtime composition', 'Production adoption', 'secret inspection']) {
      assert.match(section, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  it('18. implementation sequence marks Steps 1-3 complete and selects only Step 4 next', () => {
    const contract = readText(CONTRACT_PATH);
    const decision = readText(DECISION_PATH);
    assert.match(contract, /1\. Precondition authority contract — completed/);
    assert.match(contract, /2\. Registry validator and source-validation integration — completed/);
    assert.match(contract, /3\. Fixed read-only query catalog contract — completed by this child/);
    assert.match(contract, /4\. Precondition registry\/catalog loader-resolver — next child selected/);
    assert.match(contract, /5\. `evaluatePrecondition` adapter — future child, not selected/);
    assert.match(decision, /4\. Precondition registry\/catalog loader-resolver — selected as the only next child/);
    assert.match(decision, /does not select a runtime adapter/);
  });

  it('19. classification registers the new test exactly once as SOURCE_STATIC', () => {
    const { parsed } = readJson(CLASSIFICATION_PATH);
    const allEntries = [...parsed.entries, ...parsed.supplemental];
    const matches = allEntries.filter((entry) => entry.path === TEST_PATH);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].layer, 'SOURCE_STATIC');
    assert.deepEqual(matches[0].capabilities, []);
  });

  it('20. protected references use Refs only and never closing keywords', () => {
    const combined = `${readText(CONTRACT_PATH)}\n${readText(DECISION_PATH)}`;
    for (const issue of PROTECTED_ISSUES) {
      assert.match(combined, new RegExp(`Refs #${issue}(?:\\b| —)`));
      assert.doesNotMatch(combined, new RegExp(`(?:Closes|Fixes|Resolves) #${issue}\\b`, 'i'));
    }
  });

  it('21. next-child decision carries the exact inactive authority and no runtime selection', () => {
    const decision = readText(DECISION_PATH);
    assert.match(decision, /committed catalog remains `ADOPTION_REQUIRED` with an empty `queries` plain object/);
    assert.match(decision, /must not skip directly to Steps 5–8/);
    assert.match(decision, /not selected by this decision/);
  });

  it('22. rollback and completion boundaries require repository-only rollback and green source-static completion', () => {
    const doc = readText(CONTRACT_PATH);
    assert.match(doc, /Rollback is repository-only: revert this child as one unit/);
    assert.match(doc, /all five allowed files are present in the cumulative diff/);
    assert.match(doc, /classification entry exists exactly once as `SOURCE_STATIC`/);
    assert.match(doc, /CI is green/);
  });
});
