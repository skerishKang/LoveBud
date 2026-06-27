'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

// ─── Shared guard module: legacy-key-guard.js ─────────────────────────────

test('legacy-key-guard exists at functions/_shared/legacy-key-guard.js', () => {
  const stat = fs.statSync(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  assert.ok(stat.isFile(), 'guard module must exist');
});

test('legacy-key-guard exports isLegacyLocalizationKey and validateWritePayload', async () => {
  const mod = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  assert.equal(typeof mod.isLegacyLocalizationKey, 'function');
  assert.equal(typeof mod.validateWritePayload, 'function');
});

test('isLegacyLocalizationKey detects dot-separated legacy keys', async () => {
  const { isLegacyLocalizationKey } = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  assert.equal(isLegacyLocalizationKey('tree.title'), true);
  assert.equal(isLegacyLocalizationKey('memory.content'), true);
  assert.equal(isLegacyLocalizationKey('editor.current.moment'), true);
  assert.equal(isLegacyLocalizationKey('search.title'), true);
  assert.equal(isLegacyLocalizationKey('a.b'), true);
});

test('isLegacyLocalizationKey detects underscore-separated legacy keys', async () => {
  const { isLegacyLocalizationKey } = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  assert.equal(isLegacyLocalizationKey('editor_url_only_youtube_title'), true);
  assert.equal(isLegacyLocalizationKey('viewer_tree_title'), true);
  assert.equal(isLegacyLocalizationKey('waiting_first_moment'), true);
});

test('isLegacyLocalizationKey rejects plain user titles and non-strings', async () => {
  const { isLegacyLocalizationKey } = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  assert.equal(isLegacyLocalizationKey('제목 없음'), false);
  assert.equal(isLegacyLocalizationKey('My Video Title'), false);
  assert.equal(isLegacyLocalizationKey('hello world'), false);
  assert.equal(isLegacyLocalizationKey('selected_moment'), false);
  assert.equal(isLegacyLocalizationKey(''), false);
  assert.equal(isLegacyLocalizationKey(null), false);
  assert.equal(isLegacyLocalizationKey(undefined), false);
  assert.equal(isLegacyLocalizationKey(123), false);
});

test('validateWritePayload returns null for clean payload', async () => {
  const { validateWritePayload } = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  const result = validateWritePayload({ title: 'My Tree', memo: 'A nice memory' }, ['title', 'memo']);
  assert.equal(result, null);
});

test('validateWritePayload returns 400 for title containing legacy key', async () => {
  const { validateWritePayload } = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  const result = validateWritePayload({ title: 'tree.title', memo: 'ok' }, ['title', 'memo']);
  assert.ok(result, 'must return a Response');
  assert.equal(result.status, 400);
  const body = JSON.parse(await result.text());
  assert.equal(body.error, 'legacy localization key not allowed');
  assert.equal(body.field, 'title');
  assert.equal(body.value, 'tree.title');
});

test('validateWritePayload returns 400 for memo containing legacy key', async () => {
  const { validateWritePayload } = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  const result = validateWritePayload({ title: 'ok', memo: 'memory.content' }, ['title', 'memo']);
  assert.ok(result, 'must return a Response');
  assert.equal(result.status, 400);
  const body = JSON.parse(await result.text());
  assert.equal(body.error, 'legacy localization key not allowed');
  assert.equal(body.field, 'memo');
});

test('validateWritePayload returns null for empty payload or missing paths', async () => {
  const { validateWritePayload } = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  assert.equal(validateWritePayload(null, ['title']), null);
  assert.equal(validateWritePayload({}, []), null);
  assert.equal(validateWritePayload(undefined, ['title']), null);
});

test('validateWritePayload resolves nested field paths', async () => {
  const { validateWritePayload } = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  const result = validateWritePayload({ tree: { title: 'tree.title' } }, ['tree.title']);
  assert.ok(result, 'must return a Response for nested legacy key');
  assert.equal(result.status, 400);
  const body = JSON.parse(await result.text());
  assert.equal(body.field, 'tree.title');
});

// ─── Functions integration: guard referenced in write endpoints ───────────

test('trees.js imports validateWritePayload from legacy-key-guard', () => {
  const src = readRepoFile('functions/api/trees.js');
  assert.ok(src.indexOf("from '../_shared/legacy-key-guard.js'") !== -1, 'trees.js must import guard');
  assert.ok(src.indexOf('validateWritePayload') !== -1, 'trees.js must call validateWritePayload');
});

test('trees.js rejects legacy key with 400 before upstream fetch', () => {
  const src = readRepoFile('functions/api/trees.js');
  assert.match(src, /validateWritePayload\(payload,\s*\[['"]title['"],\s*['"]memo['"]\]\)/);
  assert.match(src, /if \(guard\) return guard/);
});

test('memories.js imports validateWritePayload from legacy-key-guard', () => {
  const src = readRepoFile('functions/api/memories.js');
  assert.ok(src.indexOf("from '../_shared/legacy-key-guard.js'") !== -1, 'memories.js must import guard');
  assert.ok(src.indexOf('validateWritePayload') !== -1, 'memories.js must call validateWritePayload');
});

test('memories.js rejects legacy key with 400 before upstream fetch', () => {
  const src = readRepoFile('functions/api/memories.js');
  assert.match(src, /validateWritePayload\(payload,\s*\[['"]title['"],\s*['"]memo['"]\]\)/);
  assert.match(src, /if \(guard\) return guard/);
});

test('memories/[id].js imports validateWritePayload from legacy-key-guard', () => {
  const src = readRepoFile('functions/api/memories/[id].js');
  assert.ok(src.indexOf("from '../../_shared/legacy-key-guard.js'") !== -1, 'memories/[id].js must import guard');
  assert.ok(src.indexOf('validateWritePayload') !== -1, 'memories/[id].js must call validateWritePayload');
});

test('memories/[id].js rejects legacy key with 400 before upstream fetch', () => {
  const src = readRepoFile('functions/api/memories/[id].js');
  assert.match(src, /validateWritePayload\(payload,\s*\[['"]title['"],\s*['"]memo['"]\]\)/);
  assert.match(src, /if \(guard\) return guard/);
});

// ─── Guard placement: must precede upstream fetch in handler flow ─────────

test('trees.js guard precedes upstream fetch call', () => {
  const src = readRepoFile('functions/api/trees.js');
  const postStart = src.indexOf('export async function onRequestPost');
  assert.ok(postStart > 0, 'onRequestPost handler must exist');
  const postSection = src.slice(postStart);
  const guardIdx = postSection.indexOf('if (guard) return guard');
  const fetchIdx = postSection.indexOf('await fetch(new URL(');
  assert.ok(guardIdx > 0, 'guard check must exist in POST handler');
  assert.ok(fetchIdx > 0, 'fetch call must exist in POST handler');
  assert.ok(guardIdx < fetchIdx, 'guard must precede upstream fetch in POST handler');
});

test('memories.js guard precedes upstream fetch call', () => {
  const src = readRepoFile('functions/api/memories.js');
  const postStart = src.indexOf('export async function onRequestPost');
  assert.ok(postStart > 0, 'onRequestPost handler must exist');
  const postSection = src.slice(postStart);
  const guardIdx = postSection.indexOf('if (guard) return guard');
  const fetchIdx = postSection.indexOf('await fetch(new URL(');
  assert.ok(guardIdx > 0, 'guard check must exist in POST handler');
  assert.ok(fetchIdx > 0, 'fetch call must exist in POST handler');
  assert.ok(guardIdx < fetchIdx, 'guard must precede upstream fetch in POST handler');
});

test('memories/[id].js guard precedes upstream fetch call', () => {
  const src = readRepoFile('functions/api/memories/[id].js');
  const putStart = src.indexOf('export async function onRequestPut');
  assert.ok(putStart > 0, 'onRequestPut handler must exist');
  const putSection = src.slice(putStart);
  const guardIdx = putSection.indexOf('if (guard) return guard');
  const fetchIdx = putSection.indexOf('const response = await fetch(target.toString()');
  assert.ok(guardIdx > 0, 'guard check must exist in PUT handler');
  assert.ok(fetchIdx > 0, 'fetch call must exist in PUT handler');
  assert.ok(guardIdx < fetchIdx, 'guard must precede upstream fetch in PUT handler');
});

// ─── Guard result includes structured error body ─────────────────────────

test('validateWritePayload 400 body has error, field, and value', async () => {
  const { validateWritePayload } = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  const result = validateWritePayload({ title: 'search.title' }, ['title']);
  assert.equal(result.status, 400);
  const body = JSON.parse(await result.text());
  assert.equal(body.error, 'legacy localization key not allowed');
  assert.equal(body.field, 'title');
  assert.equal(body.value, 'search.title');
});

// ─── Underscore key rejection ────────────────────────────────────────────

test('validateWritePayload rejects underscore-separated legacy keys', async () => {
  const { validateWritePayload } = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  const result = validateWritePayload({ title: 'editor_url_only_youtube_title' }, ['title']);
  assert.ok(result, 'underscore legacy key must be rejected');
  assert.equal(result.status, 400);
});

test('validateWritePayload allows short two-segment underscore strings', async () => {
  const { validateWritePayload } = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  // 'selected_moment' is only two underscore segments — NOT a legacy key
  const result = validateWritePayload({ title: 'selected_moment' }, ['title']);
  assert.equal(result, null, 'two-segment underscore is not a legacy key');
});

// ─── Whitespace edge cases ───────────────────────────────────────────────

test('validateWritePayload trims whitespace before checking', async () => {
  const { validateWritePayload } = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  const result = validateWritePayload({ title: '  tree.title  ' }, ['title']);
  assert.ok(result, 'whitespace-padded legacy key must be rejected');
  assert.equal(result.status, 400);
});

test('validateWritePayload passes through empty-string fields', async () => {
  const { validateWritePayload } = await import(path.join(ROOT, 'functions/_shared/legacy-key-guard.js'));
  const result = validateWritePayload({ title: '', memo: '' }, ['title', 'memo']);
  assert.equal(result, null, 'empty strings are not legacy keys');
});
