/**
 * Scout Suggest API-Key Language/Tone Invalid Input Contract
 * Refs #1882
 * Refs #2636
 * Refs #2640
 *
 * Locks the endpoint-level behavior for invalid requestedLanguage/desiredTone
 * before any live API-key provider transport can run.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const SUGGEST_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'suggest.js');
const SAVE_MEMORY_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'save-memory.js');

function createMockRequest(options = {}) {
  const method = options.method || 'POST';
  const headers = new Map();
  headers.set('content-type', 'application/json');
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      headers.set(k.toLowerCase(), v);
    }
  }
  const bodyText = JSON.stringify(options.body || {});
  const bodyBytes = new TextEncoder().encode(bodyText);
  return {
    method,
    headers: {
      get: (name) => headers.get(name.toLowerCase()) || null,
    },
    body: {
      getReader() {
        let sent = false;
        return {
          async read() {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: bodyBytes };
          },
          async cancel() {
            sent = true;
          },
        };
      },
    },
    text: async () => bodyText,
  };
}

async function getOnRequestPost() {
  const mod = await import('file://' + SUGGEST_PATH.replace(/\\/g, '/'));
  return mod.onRequestPost;
}

test('#3920 Scout request-body inventory uses canonical shared streaming authority', () => {
  for (const filePath of [SUGGEST_PATH, SAVE_MEMORY_PATH]) {
    const source = fs.readFileSync(filePath, 'utf8');
    assert.match(source, /bounded-request-body\.js/, `${filePath} must import the canonical bounded-body helper`);
    assert.match(source, /readBoundedRequestBody\s*\(/, `${filePath} must call readBoundedRequestBody`);
    assert.doesNotMatch(source, /await\s+request\.(?:text|json)\s*\(/, `${filePath} must not raw-buffer the request before enforcing the limit`);
  }
});

test('invalid requestedLanguage and desiredTone reject before provider transport', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    headers: { Authorization: 'Bearer dummy-token' },
    body: {
      excerpt: 'Invalid language and tone fixture.',
      requestedLanguage: 'ja',
      desiredTone: 'hype',
      maxOutputLength: 120,
    },
  });

  let fetchCalled = false;
  let authCalled = false;
  let rateLimitCalled = false;

  const res = await onRequestPost({
    request: req,
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE: 'api_key',
      SCOUT_SUGGEST_PROVIDER_STAGE: 'staging',
      SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
      SCOUT_SUGGEST_MODEL: 'gpt-4',
      SCOUT_SUGGEST_LLM_API_KEY: 'placeholder-key',
      SCOUT_SUGGEST_LLM_BASE_URL: 'https://example.com/v1',
    },
    verifyToken: async () => {
      authCalled = true;
      return { ok: true, uid: 'user-123' };
    },
    checkRateLimit: async () => {
      rateLimitCalled = true;
      return { allowed: true };
    },
    fetch: async () => {
      fetchCalled = true;
      return { ok: true };
    },
  });

  assert.equal(res.status, 400);
  const responseText = await res.text();
  const data = JSON.parse(responseText);
  assert.equal(data.ok, false);
  assert.equal(data.error.code, 'VALIDATION_ERROR');
  assert.match(data.error.message, /requestedLanguage must be ko or en/);
  assert.match(data.error.message, /desiredTone must be casual, polite, or emotional/);

  assert.equal(authCalled, false);
  assert.equal(rateLimitCalled, false);
  assert.equal(fetchCalled, false);
  assert.doesNotMatch(responseText, /dummy-token/);
  assert.doesNotMatch(responseText, /placeholder-key/);
  assert.doesNotMatch(responseText, /Invalid language and tone fixture/);
  assert.doesNotMatch(responseText, /prompt/i);
});
