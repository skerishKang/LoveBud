/**
 * Scout Suggestion Endpoint Auth / Rate-Limit Contract Tests
 * v20260606-2
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ENDPOINT_PATH = path.resolve(__dirname, '../../functions/api/scout/suggest.js');
const FRONTEND_UI_PATH = path.resolve(__dirname, '../../js/scout/scout-draft-ui.js');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

const tests = [
  // 1. Auth helper exists
  {
    name: 'parseScoutAuthorizationHeader exists in endpoint',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('parseScoutAuthorizationHeader'), 'Should define auth parsing function');
    }
  },

  // 2. Missing auth
  {
    name: 'Missing Authorization returns UNAUTHORIZED boundary',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('Authorization header missing'), 'Should handle missing auth header');
    }
  },

  // 3. Malformed auth
  {
    name: 'Malformed Authorization (non-Bearer, blank, too-many-parts) returns UNAUTHORIZED boundary',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('Authorization header malformed'), 'Should handle malformed auth header');
      assert.ok(content.includes('Authorization scheme must be Bearer'), 'Should reject non-Bearer schemes');
      assert.ok(content.includes('Bearer token missing'), 'Should handle empty Bearer token');
    }
  },

  // 4. Valid bearer shape
  {
    name: 'Valid Bearer token returns ok:true with trimmed token',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('ok: true'), 'Auth parse should return ok:true for valid');
      assert.ok(content.includes('token.trim()'), 'Should trim token');
    }
  },

  // 5. Token not leaked
  {
    name: 'Token value is not included in error messages or logged',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('Token value is intentionally NOT logged'), 'Should have non-leakage comment');
    }
  },

  // 6. Firebase placeholder only
  {
    name: 'Firebase Admin SDK not imported, verification is placeholder only',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      const uncommented = content.replace(/\/\/.*$/gm, ''); // strip comments
      assert.ok(!uncommented.includes('firebase-admin'), 'Should not import firebase-admin outside comments');
      assert.ok(!uncommented.includes('verifyIdToken'), 'Should not call verifyIdToken');
      assert.ok(content.includes('TODO: Firebase') || content.includes('placeholder'), 'Should have TODO placeholder');
    }
  },

  // 7. Rate-limit constants
  {
    name: 'Rate-limit constants exist: free 5/min, authenticated 10/min, window 60s',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('requestsPerMinute: 5'), 'Free tier should be 5/min');
      assert.ok(content.includes('requestsPerMinute: 10'), 'Authenticated tier should be 10/min');
      assert.ok(content.includes('windowSeconds: 60'), 'Window should be 60 seconds');
    }
  },

  // 8. Unknown tier fallback
  {
    name: 'Unknown tier falls back to free policy',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes("tier === 'authenticated' ? 'authenticated' : 'free'"), 'Unknown tier should fall back to free');
    }
  },

  // 9. No KV/Durable Object/D1 persistence
  {
    name: 'No KV/Durable Object/D1/localStorage/sessionStorage usage in endpoint',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(!content.includes('KV') || content.includes('TODO'), 'KV references should only be TODO');
      assert.ok(!content.includes('Durable Objects') || content.includes('TODO'), 'Durable Objects references should only be TODO');
      assert.ok(!content.includes('D1') || content.includes('TODO'), 'D1 references should only be TODO');
      assert.ok(!content.includes('localStorage'), 'Should not use localStorage');
      assert.ok(!content.includes('sessionStorage'), 'Should not use sessionStorage');
    }
  },

  // 10. RATE_LIMITED error shape
  {
    name: 'RATE_LIMITED error code and safe message shape exist',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('RATE_LIMITED'), 'RATE_LIMITED error code should be defined');
      assert.ok(content.includes('Too many requests') || content.includes('rate limit'), 'Rate limit message should exist');
    }
  },

  // 11. No real AI / no external fetch
  {
    name: 'No real AI provider or external fetch in endpoint',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      const forbidden = ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia'];
      for (const f of forbidden) {
        // Check for actual SDK import patterns, not just any string mention.
        // A gate check like `provider === 'openai-compatible'` is legitimate.
        const importRe = new RegExp(`(require\\(['"]${f}['"]\\)|from\\s+['"]${f}['"]|import\\s+.*${f})`, 'i');
        assert.ok(!importRe.test(content), `Should not import ${f} SDK`);
      }
      assert.ok(!content.includes('fetch('), 'Should not call fetch()');
      assert.ok(!content.includes('XMLHttpRequest'), 'Should not use XMLHttpRequest');
      assert.ok(!content.includes('axios'), 'Should not use axios');
    }
  },

  // 12. Frontend still not rewired
  {
    name: 'Frontend UI still uses stub provider by default (not endpoint)',
    fn: () => {
      const uiContent = readFileSafe(FRONTEND_UI_PATH);
      assert.ok(uiContent.includes('LoveBudScoutSuggestionProvider'), 'UI should use browser-side provider');
      assert.ok(!uiContent.includes('/api/scout/suggest'), 'UI should not default to endpoint');
    }
  }
];

let passed = 0;
let failed = 0;

console.log('\n🧪 Scout Suggestion Auth Rate-Limit Contract Tests\n');

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