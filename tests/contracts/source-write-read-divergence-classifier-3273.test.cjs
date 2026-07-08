'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts/qa/source-write-read-divergence-classifier-3273.cjs');
const classifier = require(SCRIPT_PATH);

const BASE_ENV = Object.freeze({
  LOVEBUD_QA_BASE_URL: 'https://synthetic-lovebud.test',
  LOVEBUD_QA_AUTH_TOKEN: 'synthetic-token-value',
  LOVEBUD_QA_TREE_ID: 'synthetic-tree-opaque-handle',
  LOVEBUD_QA_MEMORY_ID: 'synthetic-memory-opaque-handle',
  LOVEBUD_QA_NEW_SOURCE_URL: 'https://www.youtube.com/watch?v=ABCDEFGHI01',
  LOVEBUD_QA_DRY_RUN: 'false',
});

function makeEnv(overrides = {}) {
  return { ...BASE_ENV, ...overrides };
}

function makeFetch(sequence) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (!sequence.length) throw new Error('unexpected fetch call');
    const body = sequence.shift();
    return {
      ok: true,
      status: 200,
      async json() {
        return body;
      },
    };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function assertAllowedOutputOnly(summary) {
  assert.deepEqual(Object.keys(summary).sort(), [
    'blockedReason',
    'checksRun',
    'classification',
    'communityRead',
    'ownerRead',
    'sanitizedNotes',
    'status',
    'thumbnailCoherence',
    'writeResponse',
  ].sort());
}

function serialize(value) {
  return JSON.stringify(value);
}

test('1. missing base URL returns BLOCKED_RUNTIME_CONFIG_UNAVAILABLE and no fetch', async () => {
  const fetchImpl = makeFetch([]);
  const summary = await classifier.runClassifier({
    env: makeEnv({ LOVEBUD_QA_BASE_URL: '' }),
    fetchImpl,
  });

  assert.equal(summary.classification, 'BLOCKED_RUNTIME_CONFIG_UNAVAILABLE');
  assert.equal(summary.status, 'BLOCKED');
  assert.equal(fetchImpl.calls.length, 0);
  assertAllowedOutputOnly(summary);
});

test('2. missing auth returns BLOCKED_AUTH_UNAVAILABLE and no write fetch', async () => {
  const fetchImpl = makeFetch([]);
  const summary = await classifier.runClassifier({
    env: makeEnv({ LOVEBUD_QA_AUTH_TOKEN: '' }),
    fetchImpl,
  });

  assert.equal(summary.classification, 'BLOCKED_AUTH_UNAVAILABLE');
  assert.equal(summary.status, 'BLOCKED');
  assert.equal(fetchImpl.calls.length, 0);
  assertAllowedOutputOnly(summary);
});

test('3. missing fixture IDs returns BLOCKED_FIXTURE_UNAVAILABLE and no write fetch', async () => {
  const fetchImpl = makeFetch([]);
  const summary = await classifier.runClassifier({
    env: makeEnv({ LOVEBUD_QA_MEMORY_ID: '' }),
    fetchImpl,
  });

  assert.equal(summary.classification, 'BLOCKED_FIXTURE_UNAVAILABLE');
  assert.equal(summary.status, 'BLOCKED');
  assert.equal(fetchImpl.calls.length, 0);
  assertAllowedOutputOnly(summary);
});

test('4. dry-run mode performs no write/read fetch and reports readiness only', async () => {
  const fetchImpl = makeFetch([]);
  const summary = await classifier.runClassifier({
    env: makeEnv({ LOVEBUD_QA_DRY_RUN: 'true' }),
    fetchImpl,
  });

  assert.equal(summary.status, 'DRY_RUN');
  assert.equal(summary.classification, 'DRY_RUN_READY');
  assert.equal(fetchImpl.calls.length, 0);
  assert.match(summary.sanitizedNotes.join(' '), /no PUT\/POST\/DELETE\/GET runtime evidence/);
  assertAllowedOutputOnly(summary);
});

test('5. write response mismatched source returns WRITE_REJECTED', async () => {
  const fetchImpl = makeFetch([
    { sourceUrl: 'https://www.youtube.com/watch?v=ZZZZZZZZZ99' },
  ]);
  const summary = await classifier.runClassifier({ env: makeEnv(), fetchImpl });

  assert.equal(summary.classification, 'WRITE_REJECTED');
  assert.equal(summary.writeResponse, 'MISMATCHED');
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].options.method, 'PUT');
  assertAllowedOutputOnly(summary);
});

test('6. write response matched, owner reread mismatched returns OWNER_STALE', async () => {
  const fetchImpl = makeFetch([
    { sourceUrl: BASE_ENV.LOVEBUD_QA_NEW_SOURCE_URL },
    { sourceUrl: 'https://www.youtube.com/watch?v=ZZZZZZZZZ99' },
  ]);
  const summary = await classifier.runClassifier({ env: makeEnv(), fetchImpl });

  assert.equal(summary.classification, 'OWNER_STALE');
  assert.equal(summary.writeResponse, 'MATCHED');
  assert.equal(summary.ownerRead, 'MISMATCHED');
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(fetchImpl.calls[1].options.method, 'GET');
  assertAllowedOutputOnly(summary);
});

test('7. write response + owner matched, community mismatched returns COMMUNITY_STALE', async () => {
  const fetchImpl = makeFetch([
    { sourceUrl: BASE_ENV.LOVEBUD_QA_NEW_SOURCE_URL },
    { sourceUrl: BASE_ENV.LOVEBUD_QA_NEW_SOURCE_URL },
    { memories: [{ id: BASE_ENV.LOVEBUD_QA_MEMORY_ID, sourceUrl: 'https://www.youtube.com/watch?v=ZZZZZZZZZ99' }] },
  ]);
  const summary = await classifier.runClassifier({ env: makeEnv(), fetchImpl });

  assert.equal(summary.classification, 'COMMUNITY_STALE');
  assert.equal(summary.writeResponse, 'MATCHED');
  assert.equal(summary.ownerRead, 'MATCHED');
  assert.equal(summary.communityRead, 'MISMATCHED');
  assert.equal(fetchImpl.calls.length, 3);
  assertAllowedOutputOnly(summary);
});

test('8. write response + owner + community matched returns PERSISTED', async () => {
  const fetchImpl = makeFetch([
    { sourceUrl: BASE_ENV.LOVEBUD_QA_NEW_SOURCE_URL },
    { sourceUrl: BASE_ENV.LOVEBUD_QA_NEW_SOURCE_URL },
    { memories: [{ id: BASE_ENV.LOVEBUD_QA_MEMORY_ID, sourceUrl: BASE_ENV.LOVEBUD_QA_NEW_SOURCE_URL }] },
  ]);
  const summary = await classifier.runClassifier({ env: makeEnv(), fetchImpl });

  assert.equal(summary.classification, 'PERSISTED');
  assert.equal(summary.writeResponse, 'MATCHED');
  assert.equal(summary.ownerRead, 'MATCHED');
  assert.equal(summary.communityRead, 'MATCHED');
  assert.equal(fetchImpl.calls.length, 3);
  assertAllowedOutputOnly(summary);
});

test('9. thumbnail source identity mismatch is reported as stale thumbnail/coherence failure', async () => {
  const fetchImpl = makeFetch([
    { sourceUrl: BASE_ENV.LOVEBUD_QA_NEW_SOURCE_URL },
    { sourceUrl: BASE_ENV.LOVEBUD_QA_NEW_SOURCE_URL },
    {
      memories: [{
        id: BASE_ENV.LOVEBUD_QA_MEMORY_ID,
        sourceUrl: BASE_ENV.LOVEBUD_QA_NEW_SOURCE_URL,
        thumbnail: 'https://img.youtube.com/vi/ZZZZZZZZZ99/mqdefault.jpg',
      }],
    },
  ]);
  const summary = await classifier.runClassifier({ env: makeEnv(), fetchImpl });

  assert.equal(summary.classification, 'PERSISTED');
  assert.equal(summary.thumbnailCoherence, 'THUMBNAIL_STALE');
  assert.match(summary.sanitizedNotes.join(' '), /thumbnail identity is stale/);
  assertAllowedOutputOnly(summary);
});

test('10. output sanitizer redacts or omits raw IDs, raw URLs, auth headers, cookies, and payload bodies', async () => {
  const rawUrl = 'https://www.youtube.com/watch?v=ABCDEFGHI01&secret=do-not-print';
  const rawToken = 'Bearer raw-token-should-not-print';
  const rawUuid = '123e4567-e89b-12d3-a456-426614174000';
  const summary = classifier.sanitizeSummary({
    status: 'OK',
    classification: 'PERSISTED',
    ownerRead: 'MATCHED',
    communityRead: 'MATCHED',
    writeResponse: 'MATCHED',
    thumbnailCoherence: 'MATCHED',
    blockedReason: '',
    checksRun: ['runtime-config'],
    sanitizedNotes: [`url ${rawUrl}`, `auth ${rawToken}`, `id ${rawUuid}`, 'cookie: abc'],
    forbidden: { payload: { sourceUrl: rawUrl } },
  });

  assertAllowedOutputOnly(summary);
  const text = serialize(summary);
  assert.doesNotMatch(text, /ABCDEFGHI01&secret/);
  assert.doesNotMatch(text, /raw-token-should-not-print/);
  assert.doesNotMatch(text, /123e4567-e89b-12d3-a456-426614174000/);
  assert.doesNotMatch(text, /abc/);
  assert.match(text, /\[REDACTED_URL\]/);
  assert.match(text, /Bearer \[REDACTED_TOKEN\]/);
  assert.match(text, /\[REDACTED_ID\]/);
});

test('11. community reread search can find target memory by injected opaque fixture handle without printing actual memory ID', async () => {
  const opaqueHandle = 'opaque-memory-handle-used-only-inside-test';
  const found = classifier.findCommunityMemoryByOpaqueHandle({
    memories: [
      { id: 'other-handle', sourceUrl: 'https://www.youtube.com/watch?v=ZZZZZZZZZ99' },
      { id: opaqueHandle, sourceUrl: BASE_ENV.LOVEBUD_QA_NEW_SOURCE_URL },
    ],
  }, opaqueHandle);

  assert.equal(found.sourceUrl, BASE_ENV.LOVEBUD_QA_NEW_SOURCE_URL);
  const sanitized = classifier.sanitizeSummary({
    status: 'OK',
    classification: 'PERSISTED',
    ownerRead: 'MATCHED',
    communityRead: 'MATCHED',
    writeResponse: 'MATCHED',
    thumbnailCoherence: 'MATCHED',
    blockedReason: '',
    checksRun: ['community-reread'],
    sanitizedNotes: ['community target found by opaque fixture handle'],
  });
  assert.doesNotMatch(serialize(sanitized), new RegExp(opaqueHandle));
});

test('12. the script defaults to dry-run or blocked state unless explicitly enabled', () => {
  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { PATH: process.env.PATH },
  });

  assert.notEqual(result.status, 0, 'missing env should exit non-zero as a blocked safe default');
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.status, 'BLOCKED');
  assert.equal(summary.classification, 'BLOCKED_RUNTIME_CONFIG_UNAVAILABLE');
  assertAllowedOutputOnly(summary);
  assert.doesNotMatch(result.stdout, /token|cookie|password|secret/i);
});

test('runtime calls never print auth token, fixture IDs, raw URL, headers, or request body in summary', async () => {
  const env = makeEnv({
    LOVEBUD_QA_AUTH_TOKEN: 'do-not-print-token',
    LOVEBUD_QA_TREE_ID: 'tree-id-do-not-print',
    LOVEBUD_QA_MEMORY_ID: 'memory-id-do-not-print',
    LOVEBUD_QA_NEW_SOURCE_URL: 'https://www.youtube.com/watch?v=ABCDEFGHI01',
  });
  const fetchImpl = makeFetch([
    { sourceUrl: env.LOVEBUD_QA_NEW_SOURCE_URL },
    { sourceUrl: 'https://www.youtube.com/watch?v=ZZZZZZZZZ99' },
  ]);
  const summary = await classifier.runClassifier({ env, fetchImpl });
  const text = serialize(summary);

  assert.equal(summary.classification, 'OWNER_STALE');
  assert.doesNotMatch(text, /do-not-print-token/);
  assert.doesNotMatch(text, /tree-id-do-not-print/);
  assert.doesNotMatch(text, /memory-id-do-not-print/);
  assert.doesNotMatch(text, /ABCDEFGHI01/);
  assert.doesNotMatch(text, /Authorization/);
  assert.doesNotMatch(text, /sourceUrl/);
});
