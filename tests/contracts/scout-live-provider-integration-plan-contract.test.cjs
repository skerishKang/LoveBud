const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-provider-integration-plan.md');

function readDoc() {
  assert.ok(fs.existsSync(DOC_PATH), 'Integration plan document must exist');
  return fs.readFileSync(DOC_PATH, 'utf8');
}

test('1. Document exists and references issues correctly', () => {
  const content = readDoc();
  assert.match(content, /#2616/, 'Must mention #2616');
  assert.match(content, /#1882/, 'Must reference parent issue #1882');
  
  // Verify no close/fix/resolve keywords for #1882
  assert.doesNotMatch(content, /closes?\s+#1882/i, 'Must not close parent issue #1882');
  assert.doesNotMatch(content, /fixes?\s+#1882/i, 'Must not fix parent issue #1882');
  assert.doesNotMatch(content, /resolves?\s+#1882/i, 'Must not resolve parent issue #1882');
  
  assert.match(content, /Keeps\s+#1882\s+open/i, 'Must explicitly note keeping #1882 open');
});

test('2. Document contains the required environment configuration keys', () => {
  const content = readDoc();
  const requiredKeys = [
    'SCOUT_SUGGEST_PROVIDER_MODE',
    'SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED',
    'SCOUT_SUGGEST_LLM_PROVIDER',
    'SCOUT_SUGGEST_MODEL',
    'SCOUT_SUGGEST_LLM_API_KEY'
  ];
  
  for (const key of requiredKeys) {
    assert.match(content, new RegExp(key), `Must specify config key: ${key}`);
  }
});

test('3. Document specifies secrets, frontend key, and .env policy', () => {
  const content = readDoc();
  assert.match(content, /server-side\s+Cloudflare\s+secret\s+only/i, 'Must state key is server-side Cloudflare secret only');
  assert.match(content, /prohibits?\s+frontend\s+API\s+keys/i, 'Must prohibit frontend API keys');
  assert.match(content, /no\s+committed\s+secrets/i, 'Must prohibit committed secrets');
  assert.match(content, /no\s+\.env\s+commit/i, 'Must prohibit committing .env files');
});

test('4. Document specifies CI, browser fetch, and testing policy', () => {
  const content = readDoc();
  assert.match(content, /no\s+browser-side\s+provider\s+fetch/i, 'Must prohibit browser-side provider fetch');
  assert.match(content, /network-free\s+default\s+CI/i, 'Must state normal CI is network-free');
  assert.match(content, /opt-in\s+integration\s+tests/i, 'Must require opt-in integration tests for real provider calls');
});

test('5. Document specifies auth and rate-limit boundaries', () => {
  const content = readDoc();
  assert.match(content, /auth\s+boundary/i, 'Must specify auth boundary passes before provider call');
  assert.match(content, /rate-limit\s+boundary/i, 'Must specify rate-limit boundary passes before provider call');
});

test('6. Document specifies logging restrictions to prevent credential or PII leaks', () => {
  const content = readDoc();
  const prohibitedLogs = [
    'prompt',
    'excerpt',
    'sourceUrl',
    'API key',
    'token',
    'PII',
    'rawProviderResponse'
  ];
  
  for (const logItem of prohibitedLogs) {
    assert.match(content, new RegExp(logItem, 'i'), `Must mention prohibited logging of: ${logItem}`);
  }
});

test('7. Document specifies staging sequence and production separate activation', () => {
  const content = readDoc();
  assert.match(content, /production\s+activation\s+separate/i, 'Must state production activation is separate');
});

test('8. Document specifies allowed providers but rejects multi-provider routing complexity', () => {
  const content = readDoc();
  assert.match(content, /OpenAI-compatible/i, 'Must mention OpenAI-compatible endpoint option');
  assert.match(content, /OpenRouter-compatible/i, 'Must mention OpenRouter-compatible endpoint option');
  assert.match(content, /NVIDIA\/OpenAI-compatible/i, 'Must mention NVIDIA/OpenAI-compatible endpoint option');
  assert.match(content, /multi-provider\s+router\s+is\s+a?\s*non-goal/i, 'Must state multi-provider router is a non-goal');
});
