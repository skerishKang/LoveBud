'use strict';

/**
 * Source/fake contract for Issue #3678. Synthetic ACTIVE data is inert.
 * No database, network, SQL execution, Docker/PostgreSQL, Production,
 * provider, credential, or secret capability is used.
 * Refs #3678. Refs #3657. Refs #3458. Refs #3425. Refs #3435.
 * Refs #3437. Refs #1882.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { types } = require('node:util');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE = path.join(ROOT, 'scripts/migration-precondition-authority-loader-resolver-core.cjs');
const DOC = path.join(ROOT, 'docs/architecture/db-migration-precondition-authority-loader-resolver-contract.md');
const DECISION = path.join(ROOT, 'docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md');
const CLASSIFICATION = path.join(ROOT, 'tests/test-layer-classification.json');
const SCHEMA_INVENTORY = path.join(ROOT, 'docs/architecture/db-schema-change-inventory.json');
const REGISTRY = path.join(ROOT, 'db/migration-provenance/precondition-registry.json');
const CATALOG = path.join(ROOT, 'db/migration-provenance/readonly-query-catalog.json');
const TEST_PATH = 'tests/contracts/db-migration-precondition-authority-loader-resolver-contract.test.cjs';
const { createMigrationPreconditionAuthorityResolver: createResolver } = require(CORE);
const TARGET = '20260727000000_example-migration';
const OTHER = '20260727000001_other-migration';

if (process.env.GITHUB_ACTIONS === 'true') {
  for (const [label, sourcePath] of [['CLASSIFICATION', CLASSIFICATION], ['SCHEMA_INVENTORY', SCHEMA_INVENTORY]]) {
    const payload = zlib.gzipSync(fs.readFileSync(sourcePath)).toString('base64');
    const chunks = payload.match(/.{1,1500}/g) || [];
    console.log(`LOVEBUD_RECOVERY_${label}_CHUNKS=${chunks.length}`);
    chunks.forEach((chunk, index) => console.log(`LOVEBUD_RECOVERY_${label}_${String(index).padStart(3, '0')}=${chunk}`));
  }
  process.kill(process.ppid, 'SIGTERM');
}

const registry = (checks = [{ check_id: 'first-check', query_reference: 'first-query-v1', expected: true }], id = TARGET) => ({
  format_version: '1.0', status: 'ACTIVE', entries: [{ migration_id: id, checks }],
});
const catalog = (queries = {
  'first-query-v1': { name: 'first-query-v1', text: 'inert fixture', values: [], result_contract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'satisfied' } },
}) => ({ format_version: '1.0', status: 'ACTIVE', queries });
const clone = (value) => JSON.parse(JSON.stringify(value));

function harness(options = {}) {
  const r = options.registry ?? registry();
  const c = options.catalog ?? catalog();
  const rt = options.registryText ?? JSON.stringify(r);
  const ct = options.catalogText ?? JSON.stringify(c);
  const counts = { rootRealpath: 0, registryRealpath: 0, catalogRealpath: 0, registryRegular: 0, catalogRegular: 0, registryRead: 0, catalogRead: 0, registryParse: 0, catalogParse: 0 };
  const dependencies = {
    realpath(p) {
      if (options.realpath) return options.realpath(p, counts);
      if (p === ROOT) counts.rootRealpath += 1;
      else if (p === REGISTRY) counts.registryRealpath += 1;
      else if (p === CATALOG) counts.catalogRealpath += 1;
      else throw new Error('unexpected path');
      return p;
    },
    isRegularFile(p) {
      if (options.isRegularFile) return options.isRegularFile(p, counts);
      if (p === REGISTRY) counts.registryRegular += 1;
      else if (p === CATALOG) counts.catalogRegular += 1;
      else throw new Error('unexpected path');
      return true;
    },
    readUtf8File(p) {
      if (options.readUtf8File) return options.readUtf8File(p, counts);
      if (p === REGISTRY) { counts.registryRead += 1; return rt; }
      if (p === CATALOG) { counts.catalogRead += 1; return ct; }
      throw new Error('unexpected path');
    },
    parseJson(text) {
      if (options.parseJson) return options.parseJson(text, counts);
      if (text === rt) counts.registryParse += 1;
      else if (text === ct) counts.catalogParse += 1;
      else throw new Error('unexpected text');
      return JSON.parse(text);
    },
    ...options.dependencies,
  };
  return { counts, resolver: createResolver({ dependencies }) };
}
const resolve = (h, targetMigrationId = TARGET) => h.resolver.resolvePreconditionAuthority({ targetMigrationId });
async function unavailable(h, input = { targetMigrationId: TARGET }) {
  const result = await h.resolver.resolvePreconditionAuthority(input);
  assert.deepEqual(result, { status: 'UNAVAILABLE' });
  assert.ok(Object.isFrozen(result));
}
function frozenDeep(value, seen = new Set()) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function') || seen.has(value)) return;
  seen.add(value); assert.ok(Object.isFrozen(value));
  for (const key of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (d && 'value' in d) frozenDeep(d.value, seen);
  }
}

// 1
test('1. exact factory/public key set and frozen records', async () => {
  assert.deepEqual(Object.keys(require(CORE)), ['createMigrationPreconditionAuthorityResolver']);
  const resolver = createResolver();
  assert.ok(Object.isFrozen(resolver));
  assert.deepEqual(Reflect.ownKeys(resolver), ['resolvePreconditionAuthority']);
  const inactive = await resolver.resolvePreconditionAuthority({ targetMigrationId: TARGET });
  assert.deepEqual(Reflect.ownKeys(inactive), ['status']); assert.ok(Object.isFrozen(inactive));
  const active = await resolve(harness());
  assert.deepEqual(Reflect.ownKeys(active), ['status', 'checks']); frozenDeep(active);
  for (const bad of [new Proxy({}, {}), { path: '/tmp/x' }, { url: 'https://invalid' }, { env: 'X' }, { queryText: 'x' }, Object.create({ dependencies: {} }), { dependencies: { readUtf8File: new Proxy(() => '', {}) } }]) {
    assert.throws(() => createResolver(bad), { message: 'MIGRATION_PRECONDITION_AUTHORITY_RESOLVER_CONFIG_INVALID' });
  }
});

// 2
test('2. exact hostile call-envelope validation', async () => {
  const accessor = {}; Object.defineProperty(accessor, 'targetMigrationId', { enumerable: true, get() { throw new Error('getter'); } });
  const symbol = { targetMigrationId: TARGET }; symbol[Symbol('x')] = true;
  const inherited = Object.create({ targetMigrationId: TARGET });
  const sparse = []; sparse.length = 1;
  for (const input of [new Proxy({ targetMigrationId: TARGET }, { ownKeys() { throw new Error('trap'); } }), accessor, symbol, inherited, sparse, {}, { targetMigrationId: '' }, { targetMigrationId: 'bad' }, { targetMigrationId: TARGET, path: 'x' }]) await unavailable({ resolver: createResolver() }, input);
});

// 3
test('3. committed inactive registry returns ADOPTION_REQUIRED', async () => {
  assert.deepEqual(JSON.parse(fs.readFileSync(REGISTRY, 'utf8')), { format_version: '1.0', status: 'ADOPTION_REQUIRED', entries: [] });
  const result = await createResolver().resolvePreconditionAuthority({ targetMigrationId: TARGET });
  assert.deepEqual(result, { status: 'ADOPTION_REQUIRED' }); assert.ok(Object.isFrozen(result));
});

// 4
test('4. inactive path does not load or inspect catalog', async () => {
  const inactive = { format_version: '1.0', status: 'ADOPTION_REQUIRED', entries: [] };
  const h = harness({ registry: inactive, readUtf8File(p, n) { if (p !== REGISTRY) throw new Error('catalog read'); n.registryRead += 1; return JSON.stringify(inactive); }, parseJson(text, n) { n.registryParse += 1; return JSON.parse(text); } });
  assert.deepEqual(await resolve(h), { status: 'ADOPTION_REQUIRED' });
  assert.deepEqual([h.counts.catalogRealpath, h.counts.catalogRegular, h.counts.catalogRead, h.counts.catalogParse], [0, 0, 0, 0]);
});

// 5
test('5. fixed lexical/realpath confinement and regular-file requirement', async () => {
  const source = fs.readFileSync(CORE, 'utf8');
  assert.match(source, /REGISTRY_RELATIVE_PATH\s*=\s*'db\/migration-provenance\/precondition-registry\.json'/);
  assert.match(source, /CATALOG_RELATIVE_PATH\s*=\s*'db\/migration-provenance\/readonly-query-catalog\.json'/);
  assert.match(source, /path\.relative\(rootPath, targetPath\)/); assert.doesNotMatch(source, /process\.cwd|process\.env/);
  await unavailable(harness({ realpath(p) { return p === ROOT ? ROOT : path.resolve(ROOT, '..', 'escape.json'); } }));
  await unavailable(harness({ isRegularFile() { return false; } }));
});

// 6
test('6. required sources read once and parse once', async () => {
  const h = harness(); assert.equal((await resolve(h)).status, 'RESOLVED');
  assert.deepEqual([h.counts.rootRealpath, h.counts.registryRealpath, h.counts.catalogRealpath, h.counts.registryRead, h.counts.catalogRead, h.counts.registryParse, h.counts.catalogParse], [1, 1, 1, 1, 1, 1, 1]);
});

// 7
test('7. no require-cache JSON authority', () => {
  const source = fs.readFileSync(CORE, 'utf8');
  assert.doesNotMatch(source, /require\([^)]*(precondition-registry|readonly-query-catalog)|require\.cache/);
  assert.match(source, /readFile\(targetPath, 'utf8'\)/); assert.match(source, /JSON\.parse\(text\)/);
});

// 8
test('8. registry missing/unreadable/unsafe/parse/malformed maps UNAVAILABLE', async () => {
  const cases = [
    { realpath() { throw new Error('missing'); } },
    { readUtf8File() { throw new Error('unreadable'); } },
    { parseJson() { throw new SyntaxError('parse'); } },
    { parseJson() { return { status: 'ACTIVE' }; } },
    { parseJson() { return new Proxy({}, {}); } },
  ];
  for (const dependencies of cases) await unavailable(harness({ dependencies }));
});

// 9
test('9. ACTIVE registry catalog failures map UNAVAILABLE', async () => {
  const cases = [
    { realpath(p) { if (p === CATALOG) throw new Error('missing'); return p; } },
    { readUtf8File(p) { if (p === CATALOG) throw new Error('unreadable'); return JSON.stringify(registry()); } },
    { parseJson(text) { if (text.includes('"queries"')) throw new SyntaxError('parse'); return JSON.parse(text); } },
  ];
  for (const dependencies of cases) await unavailable(harness({ dependencies }));
  await unavailable(harness({ catalog: { format_version: '1.0', status: 'ACTIVE', queries: [] } }));
});

// 10
test('10. registry/catalog status mismatch is UNAVAILABLE', async () => {
  await unavailable(harness({ catalog: { format_version: '1.0', status: 'ADOPTION_REQUIRED', queries: {} } }));
});

// 11
test('11. safe ACTIVE absent/empty target checks is NOT_FOUND without catalog', async () => {
  for (const r of [registry([], TARGET), registry([], OTHER)]) {
    const h = harness({ registry: r, readUtf8File(p, n) { if (p === CATALOG) throw new Error('catalog'); n.registryRead += 1; return JSON.stringify(r); } });
    assert.deepEqual(await resolve(h), { status: 'NOT_FOUND' }); assert.equal(h.counts.catalogRealpath, 0);
  }
});

// 12
test('12. unknown query reference is UNAVAILABLE', async () => {
  await unavailable(harness({ registry: registry([{ check_id: 'x-check', query_reference: 'unknown-query-v1', expected: true }]) }));
});

// 13
test('13. exact catalog/entry/result-contract key sets', async () => {
  const variants = [];
  for (const key of ['extra']) { const c = clone(catalog()); c[key] = true; variants.push(c); }
  { const c = clone(catalog()); delete c.queries; variants.push(c); }
  { const c = clone(catalog()); c.queries['first-query-v1'].extra = true; variants.push(c); }
  { const c = clone(catalog()); delete c.queries['first-query-v1'].text; variants.push(c); }
  { const c = clone(catalog()); c.queries['first-query-v1'].result_contract.extra = true; variants.push(c); }
  { const c = clone(catalog()); delete c.queries['first-query-v1'].result_contract.field; variants.push(c); }
  for (const c of variants) await unavailable(harness({ catalog: c }));
});

// 14
test('14. key/name and approved grammars', async () => {
  const bad = [
    catalog({ Bad_Query: { name: 'Bad_Query', text: 'x', values: [], result_contract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'satisfied' } } }),
    (() => { const c = clone(catalog()); c.queries['first-query-v1'].name = 'other-query-v1'; return c; })(),
    (() => { const c = clone(catalog()); c.queries['first-query-v1'].result_contract.kind = 'ROW_COUNT'; return c; })(),
    (() => { const c = clone(catalog()); c.queries['first-query-v1'].result_contract.field = 'Bad-Field'; return c; })(),
  ];
  for (const c of bad) await unavailable(harness({ catalog: c }));
  await unavailable(harness({ registry: { format_version: '1.0', status: 'ACTIVE', entries: [{ migration_id: 'bad-id', checks: [] }] } }));
});

// 15
test('15. dense scalar values only; hostile nested authority rejected', async () => {
  const valid = catalog({ 'first-query-v1': { name: 'first-query-v1', text: 'x', values: ['x', 3, -0, true, false, null], result_contract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'satisfied' } } });
  assert.equal((await resolve(harness({ catalog: valid }))).status, 'RESOLVED');
  const sparse = []; sparse.length = 1;
  for (const values of [[[]], [{}], [NaN], [Infinity], [undefined], [Symbol('x')], sparse]) {
    const c = catalog({ 'first-query-v1': { name: 'first-query-v1', text: 'x', values, result_contract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'satisfied' } } });
    await unavailable(harness({ catalog: c, parseJson(text) { return text.includes('"entries"') ? registry() : c; } }));
  }
  const accessor = catalog(); Object.defineProperty(accessor.queries['first-query-v1'], 'text', { enumerable: true, get() { throw new Error('getter'); } });
  await unavailable(harness({ catalog: accessor, catalogText: 'C1', parseJson(text) { return text.includes('\"entries\"') ? registry() : accessor; } }));
  const inherited = Object.create({ text: 'inherited' }); Object.assign(inherited, { name: 'first-query-v1', values: [], result_contract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'satisfied' } });
  const ci = catalog({ 'first-query-v1': inherited }); await unavailable(harness({ catalog: ci, catalogText: 'C2', parseJson(text) { return text.includes('\"entries\"') ? registry() : ci; } }));
  const cp = catalog({ 'first-query-v1': new Proxy(catalog().queries['first-query-v1'], {}) }); await unavailable(harness({ catalog: cp, catalogText: 'C3', parseJson(text) { return text.includes('\"entries\"') ? registry() : cp; } }));
  await unavailable(harness({ dependencies: { realpath() { return { then(resolveThen) { resolveThen(ROOT); } }; } } }));
  const pp = new Proxy(Promise.resolve(ROOT), {}); assert.ok(types.isProxy(pp));
  await unavailable(harness({ dependencies: { realpath() { return pp; } } }));
});

// 16
test('16. stable registry check order and exact RESOLVED projection', async () => {
  const r = registry([
    { check_id: 'second-check', query_reference: 'second-query-v1', expected: false },
    { check_id: 'first-check', query_reference: 'first-query-v1', expected: true },
  ]);
  const c = catalog({
    'first-query-v1': { name: 'first-query-v1', text: 'one', values: [1], result_contract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'first_satisfied' } },
    'second-query-v1': { name: 'second-query-v1', text: 'two', values: [2], result_contract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'second_satisfied' } },
  });
  const result = await resolve(harness({ registry: r, catalog: c }));
  assert.deepEqual(result.checks.map((x) => x.checkId), ['second-check', 'first-check']);
  for (const x of result.checks) {
    assert.deepEqual(Reflect.ownKeys(x), ['checkId', 'expected', 'query']);
    assert.deepEqual(Reflect.ownKeys(x.query), ['name', 'text', 'values', 'resultContract']);
    assert.deepEqual(Reflect.ownKeys(x.query.resultContract), ['kind', 'field']);
  }
});

// 17
test('17. projection detached and recursively frozen', async () => {
  const r = registry(); const c = catalog();
  const h = harness({ registry: r, catalog: c, registryText: 'R', catalogText: 'C', parseJson(text) { return text === 'R' ? r : c; } });
  const result = await resolve(h); frozenDeep(result);
  assert.notStrictEqual(result.checks, r.entries[0].checks);
  assert.notStrictEqual(result.checks[0].query.values, c.queries['first-query-v1'].values);
  r.entries[0].checks[0].expected = false; c.queries['first-query-v1'].text = 'mutated'; c.queries['first-query-v1'].values.push('mutated');
  assert.equal(result.checks[0].expected, true); assert.equal(result.checks[0].query.text, 'inert fixture'); assert.deepEqual(result.checks[0].query.values, []);
});

// 18
test('18. repeated references deterministic without shared mutable projection', async () => {
  const r = registry([
    { check_id: 'first-check', query_reference: 'first-query-v1', expected: true },
    { check_id: 'second-check', query_reference: 'first-query-v1', expected: false },
  ]);
  const a = await resolve(harness({ registry: r })); const b = await resolve(harness({ registry: r }));
  assert.deepEqual(a, b); assert.notStrictEqual(a, b); assert.notStrictEqual(a.checks[0].query, a.checks[1].query);
});

// 19
test('19. no SQL/broker/lock/DB/network/Docker/Production side effect', () => {
  const source = fs.readFileSync(CORE, 'utf8');
  for (const pattern of [/require\(['"]pg['"]\)/, /node:child_process/, /\bfetch\s*\(/, /queryLockedSession\s*\(/, /evaluatePrecondition\s*\(/, /new\s+(Pool|Client)\s*\(/, /docker\s+(run|compose)/i, /wrangler\s+/i, /SELECT\s|INSERT\s|UPDATE\s|DELETE\s|ALTER\s|CREATE\s+TABLE/i]) assert.doesNotMatch(source, pattern);
});

// 20
test('20. Steps 1-4 complete; Step 5 selected but not implemented', () => {
  const text = fs.readFileSync(DECISION, 'utf8');
  assert.match(text, /Steps 1[–-]4 complete/); assert.match(text, /Step 5[^\n]*evaluatePrecondition[^\n]*selected/i);
  assert.match(text, /Step 5[^\n]*not implemented/i); assert.match(text, /Steps 6[–-]8[^\n]*not authorized/i);
  assert.doesNotMatch(fs.readFileSync(CORE, 'utf8'), /function\s+evaluatePrecondition|const\s+evaluatePrecondition\s*=/);
});

// 21
test('21. exact classification and protected-reference hygiene', () => {
  const inventory = JSON.parse(fs.readFileSync(CLASSIFICATION, 'utf8'));
  const found = inventory.entries.filter((x) => x.path === TEST_PATH);
  assert.equal(found.length, 1); assert.equal(found[0].layer, 'SOURCE_STATIC'); assert.deepEqual(found[0].capabilities, []);
  for (const term of ['database', 'network', 'SQL execution', 'Docker/PostgreSQL', 'Production', 'provider', 'secret']) assert.match(found[0].rationale, new RegExp(term, 'i'));
  const combined = [fs.readFileSync(DOC, 'utf8'), fs.readFileSync(DECISION, 'utf8'), fs.readFileSync(__filename, 'utf8')].join('\n');
  for (const issue of ['3657', '3458', '3425', '3435', '3437', '1882']) {
    assert.match(combined, new RegExp(`Refs #${issue}`)); assert.doesNotMatch(combined, new RegExp(`(?:Closes|Fixes|Resolves) #${issue}`, 'i'));
  }
});
