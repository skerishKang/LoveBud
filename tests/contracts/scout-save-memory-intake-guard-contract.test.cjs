/**
 * Scout Save-Memory Intake Guard Contract Test
 *
 * Source-only contract verification for:
 *   functions/api/scout/save-memory.js
 *   functions/api/scout/save-memory-intake.js
 *
 * Behavioral test for the intake helper via dynamic import.
 * No postgres-client / axios / fetch / playwright / puppeteer / provider SDK.
 *
 * Parent: #1882. Inherits: #3386. Related: #3389 / #3390 / #3383 / #3384 /
 * #3379 / #3380 / #3375 / #3365 / #3188 / #3075.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ROUTE_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'save-memory.js');
const INTAKE_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'save-memory-intake.js');
const SUGGEST_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'suggest.js');

test('route file exists', () => {
  assert.ok(fs.existsSync(ROUTE_PATH), 'save-memory.js must exist');
});

test('route file exports onRequestPost', () => {
  const source = fs.readFileSync(ROUTE_PATH, 'utf8');
  assert.ok(source.includes('export async function onRequestPost'), 'must export onRequestPost');
  assert.ok(source.includes('buildErrorResponse'), 'must use buildErrorResponse');
  assert.ok(source.includes('validateReviewedPayload'), 'must import validateReviewedPayload');
  assert.ok(!source.includes('storage'), 'must not contain storage implementation');
  assert.ok(!source.includes('INSERT'), 'must not contain DB insert');
  assert.ok(!source.includes('knex'), 'must not contain DB client');
});

test('route file rejects non-POST methods', () => {
  const source = fs.readFileSync(ROUTE_PATH, 'utf8');
  for (const method of ['GET', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    assert.ok(source.includes(`onRequest${method.charAt(0)}${method.slice(1).toLowerCase()}`),
      `must declare onRequest${method.charAt(0)}${method.slice(1).toLowerCase()}`);
  }
});

test('route file has no raw/private exposure', () => {
  const source = fs.readFileSync(ROUTE_PATH, 'utf8');
  const forbidden = ['process.env.', 'apiKey', 'API_KEY', 'CLOUDFLARE_API_TOKEN',
    'FIREBASE', 'DATABASE_URL', 'NEON_', 'secret'];
  for (const pattern of forbidden) {
    assert.ok(!source.includes(pattern), `route file must not contain "${pattern}"`);
  }
});

test('intake helper file exists', () => {
  assert.ok(fs.existsSync(INTAKE_PATH), 'save-memory-intake.js must exist');
});

test('intake helper exports validateReviewedPayload', () => {
  const source = fs.readFileSync(INTAKE_PATH, 'utf8');
  assert.ok(source.includes('export function validateReviewedPayload'), 'must export validateReviewedPayload');
  assert.ok(source.includes('REQUIRED_FIELDS'), 'must define required fields');
  assert.ok(source.includes('OPTIONAL_FIELDS'), 'must define optional fields');
  assert.ok(source.includes('FORBIDDEN_NAMES'), 'must define forbidden names');
  assert.ok(source.includes('sourceLink'), 'must check sourceLink');
  assert.ok(source.includes('sourceLabel'), 'must check sourceLabel');
  assert.ok(source.includes('memoryDraft'), 'must check memoryDraft');
});

test('intake helper has no raw/private exposure', () => {
  const source = fs.readFileSync(INTAKE_PATH, 'utf8');
  const forbidden = ['process.env.SCOUT', 'process.env.API_KEY', 'CLOUDFLARE_API_TOKEN',
    'FIREBASE_', 'DATABASE_URL', 'NEON_',
    'fetch(', 'axios', 'XMLHttpRequest', 'postgres', 'pg.Client', 'createClient',
    'bearer token', 'auth header', 'raw request'];
  for (const pattern of forbidden) {
    assert.ok(!source.includes(pattern), `intake helper must not contain "${pattern}"`);
  }
});

test('route file references follow suggest.js pattern', () => {
  const routeSrc = fs.readFileSync(ROUTE_PATH, 'utf8');
  const suggestSrc = fs.readFileSync(SUGGEST_PATH, 'utf8');
  assert.ok(
    routeSrc.includes('x-lovebud-upstream'),
    'must use x-lovebud-upstream header like suggest.js'
  );
  assert.ok(
    routeSrc.includes('generateRequestId') || routeSrc.includes('getOrCreateRequestId'),
    'must use request ID pattern like suggest.js'
  );
});

// ─── Behavioral tests via dynamic import ──────────────────────────────────

let validateReviewedPayload;

test('setup: load intake helper', async () => {
  const mod = await import(path.relative(__dirname, INTAKE_PATH).replace(/\\/g, '/'));
  validateReviewedPayload = mod.validateReviewedPayload;
  assert.ok(typeof validateReviewedPayload === 'function', 'validateReviewedPayload must be a function');
});

test('valid reviewed payload accepted', () => {
  const payload = {
    reviewed: {
      sourceLink: 'https://example.com/article',
      sourceLabel: 'Example Article',
      memoryDraft: 'This is a draft memory about the article.',
      summary: 'A short summary.',
      translatedSummary: 'A translated summary.',
      fanContext: 'This is relevant to fans because...',
      emotionTags: 'happy, touched',
    },
  };
  const result = validateReviewedPayload(payload);
  assert.ok(result.ok, 'valid payload must be accepted');
  assert.ok(result.reviewed.sourceLink === 'https://example.com/article', 'sourceLink preserved');
  assert.ok(result.reviewed.sourceLabel === 'Example Article', 'sourceLabel preserved');
  assert.ok(result.reviewed.memoryDraft === 'This is a draft memory about the article.', 'memoryDraft preserved');
  assert.ok(result.reviewed.summary === 'A short summary.', 'summary preserved');
  assert.ok(result.reviewed.translatedSummary === 'A translated summary.', 'translatedSummary preserved');
  assert.ok(result.reviewed.fanContext === 'This is relevant to fans because...', 'fanContext preserved');
  assert.ok(result.reviewed.emotionTags === 'happy, touched', 'emotionTags preserved');
});

test('valid payload with emotionTags array accepted', () => {
  const payload = {
    reviewed: {
      sourceLink: 'https://example.com/p2',
      sourceLabel: 'Article 2',
      memoryDraft: 'Draft text here.',
      emotionTags: ['happy', 'touched', 'grateful'],
    },
  };
  const result = validateReviewedPayload(payload);
  assert.ok(result.ok, 'payload with emotionTags array must be accepted');
  assert.ok(result.reviewed.emotionTags === 'happy, touched, grateful', 'emotionTags joined');
});

test('missing body returns invalid_payload', () => {
  assert.deepEqual(validateReviewedPayload(), { ok: false, error: { code: 'invalid_payload', message: 'Request body must be a JSON object' } });
  assert.deepEqual(validateReviewedPayload(null), { ok: false, error: { code: 'invalid_payload', message: 'Request body must be a JSON object' } });
});

test('missing reviewed group returns invalid_payload', () => {
  assert.deepEqual(validateReviewedPayload({}),
    { ok: false, error: { code: 'invalid_payload', message: 'Payload must contain a reviewed group' } });
});

test('generated-only payload returns unreviewed_generated_only', () => {
  const result = validateReviewedPayload({
    generated: { summary: 'auto summary' },
    reviewed: { sourceLink: '', memoryDraft: '' },
  });
  assert.ok(!result.ok, 'generated-only must be rejected');
  assert.strictEqual(result.error.code, 'unreviewed_generated_only');
});

test('missing required field returns invalid_payload', () => {
  const base = {
    reviewed: {
      sourceLink: 'https://example.com/a',
      sourceLabel: 'Label',
      memoryDraft: 'Draft',
    },
  };
  let r = validateReviewedPayload({ reviewed: { ...base.reviewed, sourceLink: '' } });
  assert.ok(!r.ok && r.error.code === 'invalid_payload' && r.error.message.includes('sourceLink'), 'empty sourceLink rejected');

  r = validateReviewedPayload({ reviewed: { ...base.reviewed, sourceLabel: null } });
  assert.ok(!r.ok && r.error.code === 'invalid_payload', 'null sourceLabel rejected');

  r = validateReviewedPayload({ reviewed: { ...base.reviewed, memoryDraft: undefined } });
  assert.ok(!r.ok && r.error.code === 'invalid_payload', 'missing memoryDraft rejected');
});

test('forbidden field name returns forbidden_content', () => {
  const payload = {
    reviewed: {
      sourceLink: 'https://x.com/p',
      sourceLabel: 'X Post',
      memoryDraft: 'Draft post.',
      tokens: 'abc123',
    },
  };
  const result = validateReviewedPayload(payload);
  assert.ok(!result.ok, 'forbidden field name must be rejected');
  assert.strictEqual(result.error.code, 'forbidden_content');
});

const NEW_FORBIDDEN_FIELDS = [
  'fullArticle',
  'fullPost',
  'fullTranscript',
  'lyrics',
  'paywalledContent',
  'copiedImage',
  'copiedVideo',
  'rawProviderOutput',
  'rawRequestResponseBodies',
  'rawRequestBody',
  'rawResponseBody',
];

for (const field of NEW_FORBIDDEN_FIELDS) {
  test(`forbidden field '${field}' in reviewed returns forbidden_content`, () => {
    const payload = {
      reviewed: {
        sourceLink: 'https://x.com/p',
        sourceLabel: 'X Post',
        memoryDraft: 'Draft post.',
        [field]: 'DUMMY_SAFE_STRING_NO_RAW_VALUE',
      },
    };
    const result = validateReviewedPayload(payload);
    assert.ok(!result.ok, `forbidden field '${field}' must be rejected`);
    assert.strictEqual(result.error.code, 'forbidden_content');
    assert.ok(result.error.message.includes(field), `error must name the forbidden field '${field}'`);
  });
}

test('forbidden field nested inside reviewed object returns forbidden_content', () => {
  const payload = {
    reviewed: {
      sourceLink: 'https://x.com/p',
      sourceLabel: 'X Post',
      memoryDraft: 'Draft post.',
      nested: {
        deep: { fullArticle: 'DUMMY_SAFE_STRING_NO_RAW_VALUE' },
      },
    },
  };
  const result = validateReviewedPayload(payload);
  assert.ok(!result.ok, 'nested forbidden field must be rejected');
  assert.strictEqual(result.error.code, 'forbidden_content');
  assert.ok(result.error.message.includes('fullArticle'), 'error must name the nested forbidden field');
});

test('forbidden field nested inside body returns forbidden_content', () => {
  const payload = {
    meta: { rawResponseBody: 'DUMMY_SAFE_STRING_NO_RAW_VALUE' },
    reviewed: {
      sourceLink: 'https://x.com/p',
      sourceLabel: 'X Post',
      memoryDraft: 'Draft post.',
    },
  };
  const result = validateReviewedPayload(payload);
  assert.ok(!result.ok, 'forbidden field in body must be rejected');
  assert.strictEqual(result.error.code, 'forbidden_content');
  assert.ok(result.error.message.includes('rawResponseBody'), 'error must name the body-level forbidden field');
});

test('forbidden_content error does not echo the forbidden value', () => {
  const dummyValue = 'SUPER_SECRET_DUMMY_VALUE_MUST_NOT_APPEAR_IN_ERROR';
  const payload = {
    reviewed: {
      sourceLink: 'https://x.com/p',
      sourceLabel: 'X Post',
      memoryDraft: 'Draft post.',
      tokens: dummyValue,
    },
  };
  const result = validateReviewedPayload(payload);
  assert.ok(!result.ok, 'forbidden field must be rejected');
  assert.strictEqual(result.error.code, 'forbidden_content');
  assert.ok(result.error.message.includes('tokens'), 'error must name the forbidden field');
  assert.ok(!result.error.message.includes(dummyValue), 'error message must not echo the forbidden value');
});

test('valid payload containing no forbidden field is accepted', () => {
  const payload = {
    reviewed: {
      sourceLink: 'https://x.com/p',
      sourceLabel: 'X Post',
      memoryDraft: 'Draft post.',
      summary: 'A short summary.',
      fanContext: 'Fan context.',
    },
  };
  const result = validateReviewedPayload(payload);
  assert.ok(result.ok, 'payload without forbidden fields must be accepted');
});

test('invalid sourceLink URL returns invalid_payload', () => {
  const payload = {
    reviewed: {
      sourceLink: 'not-a-url',
      sourceLabel: 'Bad',
      memoryDraft: 'Draft',
    },
  };
  const result = validateReviewedPayload(payload);
  assert.ok(!result.ok, 'invalid URL must be rejected');
  assert.strictEqual(result.error.code, 'invalid_payload');
  assert.ok(result.error.message.includes('URL'), 'error must mention URL');
});

test('unsafe patterns in sourceLink returns unsafe_source', () => {
  const payload = {
    reviewed: {
      sourceLink: 'https://example.com/page?token=secret123',
      sourceLabel: 'Unsafe',
      memoryDraft: 'Draft',
    },
  };
  const result = validateReviewedPayload(payload);
  assert.ok(!result.ok, 'unsafe source link must be rejected');
  assert.strictEqual(result.error.code, 'unsafe_source');
});

test('auth-like content in memoryDraft returns forbidden_content', () => {
  const payload = {
    reviewed: {
      sourceLink: 'https://example.com/safe',
      sourceLabel: 'Safe',
      memoryDraft: 'This draft contains Bearer mytoken123 in text.',
    },
  };
  const result = validateReviewedPayload(payload);
  assert.ok(!result.ok, 'auth-like draft content must be rejected');
  assert.strictEqual(result.error.code, 'forbidden_content');
});

test('emotionTags as non-string/non-array without value accepted (optional absent)', () => {
  const payload = {
    reviewed: {
      sourceLink: 'https://example.com/noemotion',
      sourceLabel: 'No Emotion',
      memoryDraft: 'Draft text.',
    },
  };
  const result = validateReviewedPayload(payload);
  assert.ok(result.ok, 'optional emotionTags absent must be accepted');
  assert.strictEqual(result.reviewed.emotionTags, undefined, 'emotionTags must be absent from sanitized output when absent in input');
});

// ─── #3386 forbidden field contract coverage (source-level) ───────────────

test('FORBIDDEN_NAMES covers all #3386 forbidden categories', () => {
  const source = fs.readFileSync(INTAKE_PATH, 'utf8');
  const required = [
    'rawSourceBody', 'fullScrapedContent',
    'fullArticle', 'fullPost', 'fullTranscript', 'lyrics', 'paywalledContent',
    'copiedImage', 'copiedVideo',
    'rawProviderOutput', 'rawRequestResponseBodies', 'rawRequestBody', 'rawResponseBody',
    'tokens', 'cookies', 'authHeaders', 'apiBaseUrl', 'dashboardUrl',
    'dbRow', 'privateLog', 'screenshotWithPrivateId',
  ];
  for (const name of required) {
    assert.ok(source.includes(`'${name}'`), `FORBIDDEN_NAMES must include '${name}' (#3386 coverage)`);
  }
});

test('intake and route have no fetch/provider/DB/storage writer', () => {
  const routeSrc = fs.readFileSync(ROUTE_PATH, 'utf8');
  const intakeSrc = fs.readFileSync(INTAKE_PATH, 'utf8');
  const combined = routeSrc + '\n' + intakeSrc;
  const forbidden = [
    'fetch(',
    'axios',
    'XMLHttpRequest',
    'knex',
    'pg.',
    'postgres',
    'createClient',
    'INSERT INTO',
    'insertInto',
    'drizzle',
    'prisma',
    'supabase',
    'firebase',
    'provider.',
  ];
  for (const pattern of forbidden) {
    assert.ok(!combined.includes(pattern), `route/intake must not contain "${pattern}"`);
  }
});

test('intake helper does not import storage/DB/provider/LLM modules', () => {
  const intakeSrc = fs.readFileSync(INTAKE_PATH, 'utf8');
  assert.ok(!intakeSrc.includes('import'), 'intake helper must not import external modules');
});
