/**
 * Scout Serverless Suggestion Endpoint Contract Tests
 * Phase C: Audit - defines endpoint contract before implementation
 * v20260606-1
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const DOC_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-serverless-endpoint-boundary.md');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function assertSchema(obj, schema, prefix = '') {
  for (const [key, def] of Object.entries(schema)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (def.required !== false && !(key in obj)) {
      throw new Error(`${fullKey} should exist`);
    }
    if (key in obj) {
      if (def.type) {
        assert.strictEqual(typeof obj[key], def.type, `${fullKey} should be ${def.type}`);
      }
      if (def.maxLength) {
        assert.ok(obj[key].length <= def.maxLength, `${fullKey} length <= ${def.maxLength}`);
      }
      if (def.enum) {
        assert.ok(def.enum.includes(obj[key]), `${fullKey} should be one of ${def.enum.join(', ')}`);
      }
      if (def.isArray && Array.isArray(obj[key])) {
        if (def.maxItems) {
          assert.ok(obj[key].length <= def.maxItems, `${fullKey} max ${def.maxItems} items`);
        }
        obj[key].forEach((item, i) => {
          if (def.items && def.items.type) {
            assert.strictEqual(typeof item, def.items.type, `${fullKey}[${i}] should be ${def.items.type}`);
          }
          if (def.items && def.items.maxLength) {
            assert.ok(item.length <= def.items.maxLength, `${fullKey}[${i}] length <= ${def.items.maxLength}`);
          }
        });
      } else if (def.items && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        assertSchema(obj[key], def.items, fullKey);
      }
    }
  }
}

const requestSchema = {
  excerpt: { type: 'string', maxLength: 5000, required: true },
  memo: { type: 'string', maxLength: 5000, required: false },
  sourceUrl: { type: 'string', required: false },
  lang: { type: 'string', enum: ['ko', 'en'], required: false },
  tone: { type: 'string', enum: ['casual', 'polite', 'emotional'], required: false },
  maxTokens: { type: 'number', required: false }
};

const responseSchema = {
  titleSuggestion: { type: 'string', maxLength: 50 },
  summarySuggestion: { type: 'string', maxLength: 200 },
  translationSuggestion: { type: 'string', maxLength: 500 },
  emotionTags: { type: 'object', isArray: true, maxItems: 4, items: { type: 'string', maxLength: 20 } },
  memoSuggestion: { type: 'string', maxLength: 2000 },
  safetyNote: { type: 'string' },
  meta: {
    type: 'object',
    items: {
      provider: { type: 'string' },
      model: { type: 'string' },
      requestId: { type: 'string' },
      latencyMs: { type: 'number' }
    }
  }
};

const errorResponseSchema = {
  error: {
    type: 'object',
    items: {
      code: { type: 'string' },
      message: { type: 'string' },
      details: { type: 'object' }
    }
  },
  meta: {
    type: 'object',
    items: {
      requestId: { type: 'string' },
      retryAfterMs: { type: 'number' }
    }
  }
};

const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_ERROR',
  'CONFIG_MISSING',
  'INTERNAL_ERROR'
];

// Test suite
const tests = [
  // 1. Document exists and has required sections
  {
    name: 'Document exists',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.length > 0, 'Document should exist and not be empty');
    }
  },
  {
    name: 'Document has endpoint specification section',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.includes('## Endpoint Specification'), 'Should have Endpoint Specification section');
    }
  },
  {
    name: 'Document has request schema defined',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.includes('Request Schema'), 'Should define Request Schema');
      assert.ok(doc.includes('excerpt'), 'Request should include excerpt field');
      assert.ok(doc.includes('memo'), 'Request should include memo field');
      assert.ok(doc.includes('sourceUrl'), 'Request should include sourceUrl field');
      assert.ok(doc.includes('lang'), 'Request should include lang field');
      assert.ok(doc.includes('tone'), 'Request should include tone field');
      assert.ok(doc.includes('maxTokens'), 'Request should include maxTokens field');
    }
  },
  {
    name: 'Document has response schema defined',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.includes('Response Schema (Success'), 'Should define Success Response Schema');
      assert.ok(doc.includes('titleSuggestion'), 'Response should include titleSuggestion');
      assert.ok(doc.includes('summarySuggestion'), 'Response should include summarySuggestion');
      assert.ok(doc.includes('translationSuggestion'), 'Response should include translationSuggestion');
      assert.ok(doc.includes('emotionTags'), 'Response should include emotionTags');
      assert.ok(doc.includes('memoSuggestion'), 'Response should include memoSuggestion');
      assert.ok(doc.includes('safetyNote'), 'Response should include safetyNote');
      assert.ok(doc.includes('meta'), 'Response should include meta');
    }
  },
  {
    name: 'Document defines all required error codes',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      for (const code of ERROR_CODES) {
        assert.ok(doc.includes(code), `Should define error code: ${code}`);
      }
    }
  },
  {
    name: 'Document has authentication section',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.includes('## Authentication'), 'Should have Authentication section');
      assert.ok(doc.includes('Bearer'), 'Should specify Bearer token auth');
      assert.ok(doc.includes('Firebase'), 'Should mention Firebase token verification');
    }
  },
  {
    name: 'Document has rate limiting section',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.includes('## Rate Limiting'), 'Should have Rate Limiting section');
      assert.ok(doc.includes('429'), 'Should specify 429 status for rate limit');
      assert.ok(doc.includes('Retry-After'), 'Should mention Retry-After header');
    }
  },
  {
    name: 'Document has provider abstraction section',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.includes('## Provider Abstraction'), 'Should have Provider Abstraction section');
      assert.ok(doc.includes('Stub Provider'), 'Should mention Stub Provider fallback');
      assert.ok(doc.includes('OpenAICompatibleProvider'), 'Should mention live provider');
    }
  },
  {
    name: 'Document has security boundaries section',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.includes('## Security Boundaries'), 'Should have Security Boundaries section');
      assert.ok(doc.includes('Input Sanitization'), 'Should define input sanitization');
      assert.ok(doc.includes('Output Sanitization'), 'Should define output sanitization');
      assert.ok(doc.includes('Secrets Management'), 'Should define secrets management');
    }
  },
  {
    name: 'Document has failure modes section',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.includes('## Failure Modes'), 'Should have Failure Modes section');
      assert.ok(doc.includes('fallback to stub'), 'Should define stub fallback behavior');
      assert.ok(doc.includes('manual save'), 'Should mention manual save always works');
    }
  },
  {
    name: 'Document has observability section',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.includes('## Observability'), 'Should have Observability section');
      assert.ok(doc.includes('scout_suggest_requests_total'), 'Should define request metric');
      assert.ok(doc.includes('scout_suggest_latency_ms'), 'Should define latency metric');
    }
  },

  // 2. Schema validation tests (using example objects)
  {
    name: 'Valid request passes schema',
    fn: () => {
      const validRequest = {
        excerpt: 'This is a test excerpt',
        memo: 'User memo',
        sourceUrl: 'https://example.com/article',
        lang: 'ko',
        tone: 'polite',
        maxTokens: 200
      };
      assertSchema(validRequest, requestSchema);
    }
  },
  {
    name: 'Minimal valid request passes schema',
    fn: () => {
      const minimalRequest = { excerpt: 'Test' };
      assertSchema(minimalRequest, requestSchema);
    }
  },
  {
    name: 'Invalid request missing excerpt fails',
    fn: () => {
      const invalidRequest = { memo: 'Only memo' };
      assert.throws(() => assertSchema(invalidRequest, requestSchema), /excerpt should exist/);
    }
  },
  {
    name: 'Invalid lang value fails',
    fn: () => {
      const invalidRequest = { excerpt: 'Test', lang: 'fr' };
      assert.throws(() => assertSchema(invalidRequest, requestSchema), /lang should be one of/);
    }
  },
  {
    name: 'Valid response passes schema',
    fn: () => {
      const validResponse = {
        titleSuggestion: '제안 제목',
        summarySuggestion: '요약입니다.',
        translationSuggestion: 'Translated suggestion',
        emotionTags: ['감동', '행복'],
        memoSuggestion: '메모 초안 내용',
        safetyNote: '검토 후 저장하세요.',
        meta: {
          provider: 'stub',
          model: 'stub-v1',
          requestId: '550e8400-e29b-41d4-a716-446655440000',
          latencyMs: 150
        }
      };
      assertSchema(validResponse, responseSchema);
      // emotionTags max 4
      assert.ok(validResponse.emotionTags.length <= 4, 'emotionTags max 4');
    }
  },
  {
    name: 'Error response passes schema',
    fn: () => {
      const errorResponse = {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          details: { limit: 10, window: '1m' }
        },
        meta: {
          requestId: '550e8400-e29b-41d4-a716-446655440000',
          retryAfterMs: 30000
        }
      };
      assertSchema(errorResponse, errorResponseSchema);
      assert.ok(ERROR_CODES.includes(errorResponse.error.code), 'Error code should be known');
    }
  },

  // 3. Contract invariants
  {
    name: 'Request schema enforces required excerpt',
    fn: () => {
      const req = { memo: 'test' };
      assert.throws(() => assertSchema(req, requestSchema), /excerpt should exist/);
    }
  },
  {
    name: 'Request schema enforces lang enum',
    fn: () => {
      const req = { excerpt: 'test', lang: 'invalid' };
      assert.throws(() => assertSchema(req, requestSchema), /lang should be one of/);
    }
  },
  {
    name: 'Request schema enforces tone enum',
    fn: () => {
      const req = { excerpt: 'test', tone: 'invalid' };
      assert.throws(() => assertSchema(req, requestSchema), /tone should be one of/);
    }
  },
  {
    name: 'Response schema enforces emotionTags max 4',
    fn: () => {
      const resp = {
        titleSuggestion: 't',
        summarySuggestion: 's',
        translationSuggestion: 't',
        emotionTags: ['a', 'b', 'c', 'd', 'e'], // 5 tags
        memoSuggestion: 'm',
        safetyNote: 's',
        meta: { provider: 'p', model: 'm', requestId: 'r', latencyMs: 1 }
      };
      assert.throws(() => assertSchema(resp, responseSchema), /emotionTags max 4/);
    }
  },
  {
    name: 'Response schema enforces emotionTag max 20 chars',
    fn: () => {
      const resp = {
        titleSuggestion: 't',
        summarySuggestion: 's',
        translationSuggestion: 't',
        emotionTags: ['a'.repeat(21)], // 21 chars
        memoSuggestion: 'm',
        safetyNote: 's',
        meta: { provider: 'p', model: 'm', requestId: 'r', latencyMs: 1 }
      };
      assert.throws(() => assertSchema(resp, responseSchema), /length <= 20/);
    }
  },

  // 4. Frontend guardrails (no implementation yet, but document specifies)
  {
    name: 'Document specifies no API key in frontend',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.includes('Frontend never holds API keys') || doc.includes('no API key in frontend'), 'Should forbid frontend API keys');
    }
  },
  {
    name: 'Document specifies all LLM calls via endpoint',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.includes('브라우저 직접 LLM 호출 금지') || doc.includes('serverless endpoint'), 'Should require endpoint for LLM calls');
    }
  },
  {
    name: 'Document specifies manual save always works',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.includes('manual save') || doc.includes('수동 저장'), 'Should guarantee manual save path');
    }
  },
  {
    name: 'Document specifies no auto-save',
    fn: () => {
      const doc = readFileSafe(DOC_PATH);
      assert.ok(doc.includes('No auto-save') || doc.includes('auto-save 금지') || doc.includes('자동 저장 금지'), 'Should forbid auto-save');
    }
  }
];

// Run tests
let passed = 0;
let failed = 0;

console.log('\n🧪 Scout Serverless Suggestion Endpoint Contract Tests\n');

for (const test of tests) {
  try {
    test.fn();
    console.log(`  ✅ ${test.name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${test.name}`);
    console.log(`     ${e.message}`);
    failed++;
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
console.log(`${failed === 0 ? '✅ All contract tests passed.' : '❌ Some contract tests failed.'}`);

if (failed > 0) process.exit(1);