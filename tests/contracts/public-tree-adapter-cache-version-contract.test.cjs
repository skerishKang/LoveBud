const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const CANONICAL_REVISION = 'v=20260629-1';

/**
 * Parse an HTML file and return an array of {src, relPath, query} objects
 * for every <script src="..."> tag encountered.
 */
function extractScriptSrcs(relPath) {
  const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const regex = /<script[^>]*\s+src\s*=\s*"([^"]+)"/gi;
  const results = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const src = match[1];
    const qIdx = src.indexOf('?');
    const filePath = qIdx === -1 ? src : src.slice(0, qIdx);
    const query = qIdx === -1 ? '' : src.slice(qIdx + 1);
    results.push({ src, filePath, query });
  }
  return results;
}

test('Public Tree Adapter Cache Version Contract', async (t) => {
  // ---- index.html ----
  await t.test('index.html uses canonical revision', () => {
    const scripts = extractScriptSrcs('index.html');
    const adapterScripts = scripts.filter(s => s.filePath === 'js/api/public-tree-adapter.js');
    assert.strictEqual(adapterScripts.length, 1,
      'index.html must reference public-tree-adapter.js exactly once');
    assert.ok(adapterScripts[0].src.startsWith('js/api/public-tree-adapter.js?'),
      'index.html must use relative path "js/api/..." for public-tree-adapter.js');
    assert.strictEqual(adapterScripts[0].query, CANONICAL_REVISION,
      `index.html must use ${CANONICAL_REVISION}; got ${adapterScripts[0].query}`);
  });

  await t.test('index.html: adapter load order (cache-utils → adapter → browse-prefetch) unchanged', () => {
    const scripts = extractScriptSrcs('index.html');
    const adapterIdx = scripts.findIndex(s => s.filePath === 'js/api/public-tree-adapter.js');
    assert.ok(adapterIdx >= 0, 'index.html must have public-tree-adapter.js');
    // Preceding: cache-utils.js
    const cacheUtilsIdx = scripts.slice(0, adapterIdx).findLastIndex(
      s => s.filePath === 'js/cache-utils.js');
    assert.ok(cacheUtilsIdx >= 0,
      'index.html: cache-utils.js must load before public-tree-adapter.js');
    // Following: browse-prefetch.js
    const prefetchIdx = scripts.slice(adapterIdx + 1).findIndex(
      s => s.filePath === 'js/browse-prefetch.js');
    assert.ok(prefetchIdx >= 0,
      'index.html: browse-prefetch.js must load after public-tree-adapter.js');
  });

  // ---- pages/search.html ----
  await t.test('search.html uses canonical revision', () => {
    const scripts = extractScriptSrcs('pages/search.html');
    const adapterScripts = scripts.filter(s => s.filePath === '../js/api/public-tree-adapter.js');
    assert.strictEqual(adapterScripts.length, 1,
      'search.html must reference public-tree-adapter.js exactly once');
    assert.ok(adapterScripts[0].src.startsWith('../js/api/public-tree-adapter.js?'),
      'search.html must use relative path "../js/api/..." for public-tree-adapter.js');
    assert.strictEqual(adapterScripts[0].query, CANONICAL_REVISION,
      `search.html must use ${CANONICAL_REVISION}; got ${adapterScripts[0].query}`);
  });

  await t.test('search.html: adapter load order (base-api-fetch → adapter) unchanged', () => {
    const scripts = extractScriptSrcs('pages/search.html');
    const adapterIdx = scripts.findIndex(s => s.filePath === '../js/api/public-tree-adapter.js');
    assert.ok(adapterIdx >= 0, 'search.html must have public-tree-adapter.js');
    // Preceding: base-api-fetch.js
    const fetchIdx = scripts.slice(0, adapterIdx).findLastIndex(
      s => s.filePath === '../js/api/base-api-fetch.js');
    assert.ok(fetchIdx >= 0,
      'search.html: base-api-fetch.js must load before public-tree-adapter.js');
  });

  // ---- pages/my-trees.html ----
  await t.test('my-trees.html uses canonical revision', () => {
    const scripts = extractScriptSrcs('pages/my-trees.html');
    const adapterScripts = scripts.filter(s => s.filePath === '../js/api/public-tree-adapter.js');
    assert.strictEqual(adapterScripts.length, 1,
      'my-trees.html must reference public-tree-adapter.js exactly once');
    assert.ok(adapterScripts[0].src.startsWith('../js/api/public-tree-adapter.js?'),
      'my-trees.html must use relative path "../js/api/..." for public-tree-adapter.js');
    assert.strictEqual(adapterScripts[0].query, CANONICAL_REVISION,
      `my-trees.html must use ${CANONICAL_REVISION}; got ${adapterScripts[0].query}`);
  });

  await t.test('my-trees.html: adapter load order (base-api-fetch → adapter) unchanged', () => {
    const scripts = extractScriptSrcs('pages/my-trees.html');
    const adapterIdx = scripts.findIndex(s => s.filePath === '../js/api/public-tree-adapter.js');
    assert.ok(adapterIdx >= 0, 'my-trees.html must have public-tree-adapter.js');
    // Preceding: base-api-fetch.js
    const fetchIdx = scripts.slice(0, adapterIdx).findLastIndex(
      s => s.filePath === '../js/api/base-api-fetch.js');
    assert.ok(fetchIdx >= 0,
      'my-trees.html: base-api-fetch.js must load before public-tree-adapter.js');
  });

  // ---- cross-page consistency ----
  await t.test('all three active consumers share the same adapter revision', () => {
    const pages = ['index.html', 'pages/search.html', 'pages/my-trees.html'];
    const revisions = pages.map(rel => {
      const scripts = extractScriptSrcs(rel);
      const adapter = scripts.find(s => s.filePath.endsWith('public-tree-adapter.js'));
      assert.ok(adapter, `${rel} must have public-tree-adapter.js`);
      return adapter.query;
    });
    const unique = [...new Set(revisions)];
    assert.strictEqual(unique.length, 1,
      `All pages must share the same adapter revision; got ${unique.join(', ')}`);
    assert.strictEqual(unique[0], CANONICAL_REVISION,
      `Shared revision must be ${CANONICAL_REVISION}; got ${unique[0]}`);
  });

  await t.test('each page keeps its own relative path form', () => {
    const scriptsIndex = extractScriptSrcs('index.html');
    const adapterIndex = scriptsIndex.find(s => s.filePath.endsWith('public-tree-adapter.js'));
    assert.equal(adapterIndex.filePath, 'js/api/public-tree-adapter.js',
      'index.html must use path without "../" prefix');

    const scriptsSearch = extractScriptSrcs('pages/search.html');
    const adapterSearch = scriptsSearch.find(s => s.filePath.endsWith('public-tree-adapter.js'));
    assert.equal(adapterSearch.filePath, '../js/api/public-tree-adapter.js',
      'search.html must use path with "../" prefix');

    const scriptsMyTrees = extractScriptSrcs('pages/my-trees.html');
    const adapterMyTrees = scriptsMyTrees.find(s => s.filePath.endsWith('public-tree-adapter.js'));
    assert.equal(adapterMyTrees.filePath, '../js/api/public-tree-adapter.js',
      'my-trees.html must use path with "../" prefix');
  });

  await t.test('search.html already had canonical revision (regression guard)', () => {
    // search.html was already at v=20260629-1 before this change; this test
    // ensures it was not accidentally reverted through a merge or edit.
    const scripts = extractScriptSrcs('pages/search.html');
    const adapter = scripts.find(s => s.filePath.endsWith('public-tree-adapter.js'));
    assert.ok(adapter, 'search.html must have public-tree-adapter.js');
    assert.strictEqual(adapter.query, CANONICAL_REVISION,
      `search.html must remain at ${CANONICAL_REVISION}; got ${adapter.query}`);
  });
});
