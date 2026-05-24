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

test('memories.js defines hasAuthorizationHeader helper', () => {
  const source = readRepoFile(FILES.memories);
  assert.match(source, /function hasAuthorizationHeader/);
  assert.match(source, /request\.headers\.get\('authorization'\)/i);
});

test('memories.js defines buildMissingAuthorizationResponse', () => {
  const source = readRepoFile(FILES.memories);
  assert.match(source, /function buildMissingAuthorizationResponse/);
  assert.match(source, /missing-authorization/);
  assert.match(source, /Authorization required/);
  assert.match(source, /status: 401/);
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

test('memories/[id].js defines hasAuthorizationHeader helper', () => {
  const source = readRepoFile(FILES.memoryDetail);
  assert.match(source, /function hasAuthorizationHeader/);
  assert.match(source, /request\.headers\.get\('authorization'\)/i);
});

test('memories/[id].js defines buildMissingAuthorizationResponse', () => {
  const source = readRepoFile(FILES.memoryDetail);
  assert.match(source, /function buildMissingAuthorizationResponse/);
  assert.match(source, /missing-authorization/);
  assert.match(source, /Authorization required/);
  assert.match(source, /status: 401/);
});

// ─── AUTH CHECK ORDER ──────────────────────────────────────────────────────

function extractFunc(source, name) {
  const start = source.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const openBrace = source.indexOf('{', start);
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
  const body = extractFunc(source, 'onRequestPost');
  const authIdx = body.indexOf('hasAuthorizationHeader');
  const bodyReadIdx = body.indexOf('readBoundedWriteBody');
  assert.notEqual(authIdx, -1, 'onRequestPost should call hasAuthorizationHeader');
  assert.notEqual(bodyReadIdx, -1, 'onRequestPost should call readBoundedWriteBody');
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
  const body = extractFunc(source, 'onRequestPut');
  const authIdx = body.indexOf('hasAuthorizationHeader');
  const bodyReadIdx = body.indexOf('readBoundedWriteBody');
  assert.notEqual(authIdx, -1, 'onRequestPut should call hasAuthorizationHeader');
  assert.notEqual(bodyReadIdx, -1, 'onRequestPut should call readBoundedWriteBody');
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
  const body = extractFunc(source, 'onRequestDelete');
  const authIdx = body.indexOf('hasAuthorizationHeader');
  const stripIdx = body.indexOf('stripTrailingSlash');
  assert.notEqual(authIdx, -1, 'onRequestDelete should call hasAuthorizationHeader');
  assert.notEqual(stripIdx, -1, 'onRequestDelete should call stripTrailingSlash');
  assert.ok(authIdx < stripIdx, 'hasAuthorizationHeader should appear before stripTrailingSlash (first actionable line)');
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
  assert.match(source, /function onRequestPost/);
  assert.match(source, /function onRequestGet/);
  assert.match(source, /\/modal\/private\/memories/);
});

test('trees/[id].js still preserves GET route', () => {
  const source = readRepoFile(FILES.treeDetail);
  assert.match(source, /function onRequestGet/);
  assert.match(source, /\/modal\/trees\/\$\{/);
});

test('memories/[id].js still preserves GET route', () => {
  const source = readRepoFile(FILES.memoryDetail);
  assert.match(source, /function onRequestGet/);
  assert.match(source, /\/modal\/memories\/\$\{/);
});

// ─── RESPONSE FORMAT ───────────────────────────────────────────────────────

test('buildMissingAuthorizationResponse returns correct 401 format', () => {
  for (const key of Object.values(FILES)) {
    const source = readRepoFile(key);
    const lines = source.split('\n');
    const found = lines.some(l => /function buildMissingAuthorizationResponse/.test(l));
    assert.ok(found, `${key} should define buildMissingAuthorizationResponse`);
    assert.match(source, /x-lovebud-upstream[^}]*cloudflare/);
    assert.match(source, /x-lovebud-route-status[^}]*missing-authorization/);
    assert.match(source, /Authorization required/);
    assert.match(source, /status:\s*401/);
  }
});
