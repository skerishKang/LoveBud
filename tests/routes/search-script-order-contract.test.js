const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function getScriptSources(html) {
  return [...html.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>/g)].map((match) => match[1]);
}

function findScriptIndex(scripts, needle) {
  return scripts.findIndex((src) => src.includes(needle));
}

function assertScriptBefore(scripts, beforeNeedle, afterNeedle) {
  const beforeIndex = findScriptIndex(scripts, beforeNeedle);
  const afterIndex = findScriptIndex(scripts, afterNeedle);
  assert.notEqual(beforeIndex, -1, `${beforeNeedle} should be present in pages/search.html`);
  assert.notEqual(afterIndex, -1, `${afterNeedle} should be present in pages/search.html`);
  assert.ok(beforeIndex < afterIndex, `${beforeNeedle} should load before ${afterNeedle}`);
}

test('search page keeps API and adapter scripts before the Search entrypoint', () => {
  const html = readRepoFile('pages/search.html');
  const scripts = getScriptSources(html);
  const entrypoint = '../js/search/index.js';

  [
    '../js/cache-utils.js',
    '../js/api/auth-policy.js',
    '../js/api/base-api-fetch.js',
    '../js/api/public-tree-adapter.js',
    '../js/postgres-client.js',
  ].forEach((script) => assertScriptBefore(scripts, script, entrypoint));
});

test('search page keeps Search helper and renderer modules before the Search entrypoint', () => {
  const html = readRepoFile('pages/search.html');
  const scripts = getScriptSources(html);
  const entrypoint = '../js/search/index.js';

  [
    '../js/search/search-title-helper.js',
    '../js/search/search-data-adapter.js',
    '../js/search/search-shared-utils.js',
    '../js/search/search-card-renderer.js',
    '../js/search/search-preview-renderer.js',
    '../js/search/search-preview-cache.js',
    '../js/search/search-ui.js',
    '../js/search/search-url-state.js',
    '../js/search/search-controls.js',
    '../js/search/search-data.js',
    '../js/search/search-preview-controller.js',
  ].forEach((script) => assertScriptBefore(scripts, script, entrypoint));
});

test('search public Browse boot remains before Firebase/Auth runtime scripts', () => {
  const html = readRepoFile('pages/search.html');
  const scripts = getScriptSources(html);
  const entrypoint = '../js/search/index.js';

  [
    'firebase-app.js',
    'firebase-auth.js',
    '../js/firebase-config.js',
    '../js/auth/auth-state.js',
    '../js/auth/auth-firebase.js',
    '../js/auth.js',
  ].forEach((script) => assertScriptBefore(scripts, entrypoint, script));
});

test('search page stays on classic script loading for runtime globals', () => {
  const html = readRepoFile('pages/search.html');

  assert.equal(html.includes('type="module"'), false);
  assert.equal(html.includes("type='module'"), false);
});
