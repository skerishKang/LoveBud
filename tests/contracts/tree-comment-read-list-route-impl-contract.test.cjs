/**
 * Implementation source-level contract tests for the tree comment read/list route.
 *
 * These tests verify that functions/api/trees/[tree_id]/comments.js now supports
 * GET /api/trees/:treeId/comments read/list while keeping the POST create behavior
 * (auth required, idempotency key required) unchanged, and that the read path does
 * not require create auth / idempotency. This is backend/API read-list only; UI,
 * client adapters, moderation/deletion, Scout, and #3075 moment behavior are untouched.
 *
 * Refs: #3408, #3188, #3404, #3405, #3400, #3401, #3396, #3398, #3393, #3394,
 * #3388, #3392, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const COMMENTS_JS_PATH = path.join(
  ROOT,
  'functions',
  'api',
  'trees',
  '[tree_id]',
  'comments.js'
);

function readSrc() {
  assert.ok(fs.existsSync(COMMENTS_JS_PATH), `Route file must exist at ${COMMENTS_JS_PATH}`);
  return fs.readFileSync(COMMENTS_JS_PATH, 'utf8');
}

test('comments.js exposes a GET handler for read/list', () => {
  const src = readSrc();
  assert.ok(/export async function onRequestGet/.test(src), 'comments.js must export onRequestGet');
  assert.ok(/proxyTreeCommentRead/.test(src), 'comments.js must define proxyTreeCommentRead');
});

test('onRequest dispatches GET -> read and POST -> create, others method-not-allowed', () => {
  const src = readSrc();
  assert.ok(/method === 'GET'\) return proxyTreeCommentRead/.test(src), 'onRequest must route GET to read');
  assert.ok(/method === 'POST'\) return proxyTreeCommentCreate/.test(src), 'onRequest must route POST to create');
  assert.ok(/allow: 'GET, POST'/.test(src), 'method-not-allowed must allow GET, POST');
});

test('GET read path does not require authorization or idempotency key', () => {
  const src = readSrc();
  const readFn = src.slice(src.indexOf('async function proxyTreeCommentRead'));
  const createFn = src.slice(src.indexOf('async function proxyTreeCommentCreate'), src.indexOf('async function proxyTreeCommentRead'));
  assert.ok(!/hasAuthorizationHeader/.test(readFn), 'GET read path must not check authorization');
  assert.ok(!/Idempotency-Key/.test(readFn), 'GET read path must not require Idempotency-Key');
  assert.ok(/hasAuthorizationHeader/.test(createFuncSlice()), 'POST create path must still check authorization');
  assert.ok(/Idempotency-Key/.test(createFuncSlice()), 'POST create path must still require Idempotency-Key');
});

test('GET read path forwards the limit query parameter to Modal', () => {
  const src = readSrc();
  assert.ok(/new URL\(request\.url\)\.search/.test(src), 'GET read path should forward the query string (limit) to Modal');
});

test('POST create behavior remains unchanged (auth + idempotency + 405 for non-POST)', () => {
  const src = readSrc();
  assert.ok(/if \(method !== 'POST'\) return buildMethodNotAllowedResponse/.test(src), 'create proxy must still reject non-POST');
  assert.ok(/buildMissingAuthorizationResponse/.test(src), 'create proxy must still require authorization');
  assert.ok(/buildIdempotencyKeyRequiredResponse/.test(src), 'create proxy must still require Idempotency-Key');
  assert.ok(/buildIdempotencyKeyInvalidResponse/.test(src), 'create proxy must still validate Idempotency-Key');
});

test('read path targets the tree-comments Modal endpoint and never the moment comments table', () => {
  const src = readSrc();
  assert.ok(/\/modal\/private\/trees\/\${encodeURIComponent\(decodeURIComponent\(treeId\)\)}\/comments/.test(src), 'read path must target the tree-comments Modal route');
  assert.ok(!/memories\/\[memory_id\]\/comments/.test(src), 'read path must not target moment comments route');
});

test('this contract suite does not import runtime/network/browser/DB clients', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  assert.ok(!/require\(['"]axios['"]\)|from ['"]axios['"]/i.test(self), 'Contract test must not import axios');
  assert.ok(!/\bglobalThis\.fetch\s*\(|\bwindow\.fetch\s*\(/i.test(self), 'Contract test must not call fetch');
  assert.ok(!/require\(['"]playwright['"]\)/i.test(self), 'Contract test must not import playwright');
  assert.ok(!/require\(['"]puppeteer['"]\)/i.test(self), 'Contract test must not import puppeteer');
});

function createFuncSlice() {
  const src = readSrc();
  const start = src.indexOf('async function proxyTreeCommentCreate');
  const end = src.indexOf('async function proxyTreeCommentRead');
  return src.slice(start, end);
}
