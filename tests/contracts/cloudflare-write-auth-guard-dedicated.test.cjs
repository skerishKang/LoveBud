const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const FILES = {
  trees: 'functions/api/trees.js',
  memories: 'functions/api/memories.js',
  treeDetail: 'functions/api/trees/[id].js',
  memoryDetail: 'functions/api/memories/[id].js',
  memoryProxy: 'functions/_shared/memory-route-proxy.js',
};

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

// ─── HELPER PRESENCE ────────────────────────────────────────────────────────

test('trees.js defines hasAuthorizationHeader helper', () => {
  const source = readRepoFile(FILES.trees);
  assert.match(source, /function hasAuthorizationHeader/);
  assert.match(source, /request\.headers\.get\('authorization'\)/i);
});

test('trees.js defines buildMissingAuthorizationResponse', () => {
  const source = readRepoFile(FILES.trees);
  assert.match(source, /function buildMissingAuthorizationResponse/);
  assert.match(source, /missing-authorization/);
  assert.match(source, /Authorization required/);
  assert.match(source, /status: 401/);
});

test('memories.js delegates hasAuthorizationHeader to shared memory route proxy', () => {
  const source = readRepoFile(FILES.memories);
  const helper = readRepoFile(FILES.memoryProxy);
  assert.match(source, /proxyMemoryRouteRequest/);
  assert.match(helper, /function hasAuthorizationHeader/);
  assert.match(helper, /request\.headers\.get\('authorization'\)/i);
});

test('memories.js delegates buildMissingAuthorizationResponse to shared memory route proxy', () => {
  const source = readRepoFile(FILES.memories);
  const helper = readRepoFile(FILES.memoryProxy);
  assert.match(source, /proxyMemoryRouteRequest/);
  assert.match(helper, /function buildMemoryMissingAuthorizationResponse/);
  assert.match(helper, /missing-authorization/);
  assert.match(helper, /Authorization required/);
  assert.match(helper, /status: 401/);
});

test('trees/[id].js defines hasAuthorizationHeader helper', () => {
  const source = readRepoFile(FILES.treeDetail);
  assert.match(source, /function hasAuthorizationHeader/);
  assert.match(source, /request\.headers\.get\('authorization'\)/i);
});

test('trees/[id].js defines buildMissingAuthorizationResponse', () => {
  const source = readRepoFile(FILES.treeDetail);
  assert.match(source, /function buildMissingAuthorizationResponse/);
  assert.match(source, /missing-authorization/);
  assert.match(source, /Authorization required/);
  assert.match(source, /status: 401/);
});

test('memories/[id].js delegates hasAuthorizationHeader to shared memory route proxy', () => {
  const source = readRepoFile(FILES.memoryDetail);
  const helper = readRepoFile(FILES.memoryProxy);
  assert.match(source, /proxyMemoryRouteRequest/);
  assert.match(helper, /function hasAuthorizationHeader/);
  assert.match(helper, /request\.headers\.get\('authorization'\)/i);
});

test('memories/[id].js delegates buildMissingAuthorizationResponse to shared memory route proxy', () => {
  const source = readRepoFile(FILES.memoryDetail);
  const helper = readRepoFile(FILES.memoryProxy);
  assert.match(source, /proxyMemoryRouteRequest/);
  assert.match(helper, /function buildMemoryMissingAuthorizationResponse/);
  assert.match(helper, /missing-authorization/);
  assert.match(helper, /Authorization required/);
  assert.match(helper, /status: 401/);
});

// ─── AUTH CHECK ORDER ──────────────────────────────────────────────────────

function extractFunc(source, name) {
  const start = source.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const signatureBrace = source.indexOf(') {', start);
  const openBrace = signatureBrace !== -1 ? signatureBrace + 2 : source.indexOf('{', start);
  assert.notEqual(openBrace, -1, `${name} should have body`);
  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) return source.slice(openBrace, i + 1);
  }
  assert.fail(`${name} body should be closed`);
}

test('trees.js onRequestPost checks auth before readBoundedWriteBody', () => {
  const source = readRepoFile(FILES.trees);
  const body = extractFunc(source, 'onRequestPost');
  const authIdx = body.indexOf('hasAuthorizationHeader');
  const bodyReadIdx = body.indexOf('readBoundedWriteBody');
  assert.notEqual(authIdx, -1, 'onRequestPost should call hasAuthorizationHeader');
  assert.notEqual(bodyReadIdx, -1, 'onRequestPost should call readBoundedWriteBody');
  assert.ok(authIdx < bodyReadIdx, 'hasAuthorizationHeader should appear before readBoundedWriteBody');
});

test('memories.js onRequestPost checks auth before readBoundedWriteBody', () => {
  const source = readRepoFile(FILES.memories);
  const helper = readRepoFile(FILES.memoryProxy);
  const body = extractFunc(source, 'onRequestPost');
  assert.match(body, /proxyMemoryRouteRequest/);
  const helperBody = extractFunc(helper, 'prepareMemoryWriteProxyRequest');
  const authIdx = helperBody.indexOf('hasAuthorizationHeader');
  const bodyReadIdx = helperBody.indexOf('readBoundedMemoryWriteBody');
  assert.notEqual(authIdx, -1, 'shared memory proxy should call hasAuthorizationHeader');
  assert.notEqual(bodyReadIdx, -1, 'shared memory proxy should call readBoundedMemoryWriteBody');
  assert.ok(authIdx < bodyReadIdx, 'hasAuthorizationHeader should appear before readBoundedWriteBody');
});

test('trees/[id].js onRequestPut checks auth before readBoundedWriteBody', () => {
  const source = readRepoFile(FILES.treeDetail);
  const body = extractFunc(source, 'onRequestPut');
  const authIdx = body.indexOf('hasAuthorizationHeader');
  const bodyReadIdx = body.indexOf('readBoundedWriteBody');
  assert.notEqual(authIdx, -1, 'onRequestPut should call hasAuthorizationHeader');
  assert.notEqual(bodyReadIdx, -1, 'onRequestPut should call readBoundedWriteBody');
  assert.ok(authIdx < bodyReadIdx, 'hasAuthorizationHeader should appear before readBoundedWriteBody');
});

test('memories/[id].js onRequestPut checks auth before readBoundedWriteBody', () => {
  const source = readRepoFile(FILES.memoryDetail);
  const helper = readRepoFile(FILES.memoryProxy);
  const body = extractFunc(source, 'onRequestPut');
  assert.match(body, /proxyMemoryRouteRequest/);
  const helperBody = extractFunc(helper, 'prepareMemoryWriteProxyRequest');
  const authIdx = helperBody.indexOf('hasAuthorizationHeader');
  const bodyReadIdx = helperBody.indexOf('readBoundedMemoryWriteBody');
  assert.notEqual(authIdx, -1, 'shared memory proxy should call hasAuthorizationHeader');
  assert.notEqual(bodyReadIdx, -1, 'shared memory proxy should call readBoundedMemoryWriteBody');
  assert.ok(authIdx < bodyReadIdx, 'hasAuthorizationHeader should appear before readBoundedWriteBody');
});

test('trees/[id].js onRequestDelete checks auth before any other logic', () => {
  const source = readRepoFile(FILES.treeDetail);
  const body = extractFunc(source, 'onRequestDelete');
  const authIdx = body.indexOf('hasAuthorizationHeader');
  const stripIdx = body.indexOf('stripTrailingSlash');
  assert.notEqual(authIdx, -1, 'onRequestDelete should call hasAuthorizationHeader');
  assert.notEqual(stripIdx, -1, 'onRequestDelete should call stripTrailingSlash');
  assert.ok(authIdx < stripIdx, 'hasAuthorizationHeader should appear before stripTrailingSlash (first actionable line)');
});

test('memories/[id].js onRequestDelete checks auth before any other logic', () => {
  const source = readRepoFile(FILES.memoryDetail);
  const helper = readRepoFile(FILES.memoryProxy);
  const body = extractFunc(source, 'onRequestDelete');
  assert.match(body, /proxyMemoryRouteRequest/);
  const helperBody = extractFunc(helper, 'prepareMemoryWriteProxyRequest');
  const authIdx = helperBody.indexOf('hasAuthorizationHeader');
  const targetIdx = helperBody.indexOf('buildMemoryModalUrl');
  assert.notEqual(authIdx, -1, 'shared memory proxy should call hasAuthorizationHeader');
  assert.notEqual(targetIdx, -1, 'shared memory proxy should build target after auth');
  assert.ok(authIdx < targetIdx, 'hasAuthorizationHeader should appear before target/base-url work');
});

// ─── READ ROUTES UNCHANGED ─────────────────────────────────────────────────

test('trees.js still preserves GET route', () => {
  const source = readRepoFile(FILES.trees);
  assert.match(source, /function onRequestPost/);
  assert.match(source, /function onRequestGet/);
  assert.match(source, /\/modal\/private\/trees/);
});

test('memories.js still preserves GET route', () => {
  const source = readRepoFile(FILES.memories);
  const helper = readRepoFile(FILES.memoryProxy);
  assert.match(source, /function onRequestPost/);
  assert.match(source, /function onRequestGet/);
  assert.match(source, /proxyMemoryRouteRequest/);
  assert.match(helper, /\/modal\/private\/memories/);
});

test('trees/[id].js still preserves GET route', () => {
  const source = readRepoFile(FILES.treeDetail);
  assert.match(source, /function onRequestGet/);
  assert.match(source, /\/modal\/trees\/\$\{/);
});

test('memories/[id].js still preserves GET route', () => {
  const source = readRepoFile(FILES.memoryDetail);
  const helper = readRepoFile(FILES.memoryProxy);
  assert.match(source, /function onRequestGet/);
  assert.match(source, /proxyMemoryRouteRequest/);
  assert.match(helper, /\/modal\/memories/);
});

// ─── RESPONSE FORMAT ───────────────────────────────────────────────────────

test('buildMissingAuthorizationResponse returns correct 401 format', () => {
  for (const key of [FILES.trees, FILES.treeDetail]) {
    const source = readRepoFile(key);
    const lines = source.split('\n');
    const found = lines.some(l => /function buildMissingAuthorizationResponse/.test(l));
    assert.ok(found, `${key} should define buildMissingAuthorizationResponse`);
    assert.match(source, /x-lovebud-upstream[^}]*cloudflare/);
    assert.match(source, /x-lovebud-route-status[^}]*missing-authorization/);
    assert.match(source, /Authorization required/);
    assert.match(source, /status:\s*401/);
  }

  const memoryProxy = readRepoFile(FILES.memoryProxy);
  assert.match(memoryProxy, /function buildMemoryMissingAuthorizationResponse/);
  assert.match(memoryProxy, /x-lovebud-upstream[^}]*cloudflare/);
  assert.match(memoryProxy, /x-lovebud-route-status[^}]*missing-authorization/);
  assert.match(memoryProxy, /Authorization required/);
  assert.match(memoryProxy, /status:\s*401/);
});
