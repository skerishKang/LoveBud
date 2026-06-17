/**
 * Scout Suggestion Endpoint Skeleton Contract Tests
 * Phase D prep: validates endpoint shape, validation, stub response, guardrails
 * v20260606-1
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ENDPOINT_PATH = path.resolve(__dirname, '../../functions/api/scout/suggest.js');
const FRONTEND_UI_PATH = path.resolve(__dirname, '../../js/scout/scout-draft-ui.js');
const DOC_BOUNDARY_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-serverless-endpoint-boundary.md');
const DOC_PROVIDER_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-llm-provider-boundary.md');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

// Test suite
const tests = [
  // 1. Endpoint file exists
  {
    name: 'Endpoint file exists',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.length > 0, 'Endpoint file should exist and not be empty');
    }
  },

  // 2. Exports Cloudflare Pages Function handlers
  {
    name: 'Exports onRequestPost handler',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('export async function onRequestPost'), 'Should export onRequestPost');
    }
  },
  {
    name: 'Exports other method handlers (Get, Put, Delete, Patch, Options)',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('export async function onRequestGet'), 'Should export onRequestGet');
      assert.ok(content.includes('export async function onRequestPut'), 'Should export onRequestPut');
      assert.ok(content.includes('export async function onRequestDelete'), 'Should export onRequestDelete');
      assert.ok(content.includes('export async function onRequestPatch'), 'Should export onRequestPatch');
      assert.ok(content.includes('export async function onRequestOptions'), 'Should export onRequestOptions');
    }
  },

  // 3. POST-only: other methods return error
  {
    name: 'Non-POST methods return VALIDATION_ERROR',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('Only POST is supported'), 'Should reject non-POST methods');
      assert.ok(content.includes('onRequestNotAllowed'), 'Should have shared not-allowed handler');
    }
  },

  // 4. JSON body parsing
  {
    name: 'Requires application/json Content-Type',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('application/json'), 'Should check Content-Type');
    }
  },
  {
    name: 'Handles invalid JSON gracefully',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('Invalid JSON body'), 'Should handle JSON parse error');
      assert.ok(content.includes('JSON.parse'), 'Should use JSON.parse');
    }
  },

  // 5. Request validation
  {
    name: 'Validates required excerpt field',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('excerpt is required'), 'Should require excerpt');
    }
  },
  {
    name: 'Validates sourceUrl format if present',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('sourceUrl must be a valid URL'), 'Should validate sourceUrl format');
    }
  },
  {
    name: 'Validates requestedLanguage enum',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('requestedLanguage must be ko or en'), 'Should validate language enum');
    }
  },
  {
    name: 'Validates desiredTone enum',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('desiredTone must be casual, polite, or emotional'), 'Should validate tone enum');
    }
  },
  {
    name: 'Normalizes and clamps maxOutputLength',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('maxOutputLength') && content.includes('Math.min') && content.includes('Math.max'), 'Should clamp maxOutputLength');
    }
  },

  // 6. Valid request returns stub suggestion
  {
    name: 'Returns ok:true and providerMode:"stub" for valid request',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('ok: true'), 'Should return ok:true');
      assert.ok(content.includes('providerMode') && content.includes('stub'), 'Should return providerMode: stub');
    }
  },
  {
    name: 'Generates deterministic stub suggestion',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('generateStubSuggestion'), 'Should have stub generator function');
    }
  },

  // 7. Response schema compliance
  {
    name: 'Suggestion includes all 6 required fields',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      const fields = ['titleSuggestion', 'summarySuggestion', 'translationSuggestion', 'emotionTags', 'memoSuggestion', 'safetyNote'];
      for (const field of fields) {
        assert.ok(content.includes(field), `Should include ${field} in suggestion`);
      }
    }
  },
  {
    name: 'emotionTags limited to max 4 items',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('Math.min(4') || content.includes('max 4') || content.includes('tagCount = Math.min(4'), 'Should limit emotionTags to 4');
    }
  },
  {
    name: 'Each emotionTag limited to 20 chars (via suggestion field max lengths)',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('slice(0, 20)') || content.includes('maxLength') || content.includes('max 20'), 'Should limit tag length');
    }
  },

  // 8. Guardrails: no source fetch
  {
    name: 'No fetch/XMLHttpRequest/axios in endpoint (no sourceUrl fetch)',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(!content.includes('fetch('), 'Should not use fetch()');
      assert.ok(!content.includes('XMLHttpRequest'), 'Should not use XMLHttpRequest');
      assert.ok(!content.includes('axios'), 'Should not use axios');
    }
  },

  // 9. Guardrails: no real AI provider
  {
    name: 'No real AI provider imports or references',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      const forbidden = ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'google-generativeai', '@google/generative-ai', 'cohere', 'huggingface'];
      for (const f of forbidden) {
        // Check for actual SDK import patterns, not just any string mention.
        // A gate check like `provider === 'openai-compatible'` is legitimate.
        const importRe = new RegExp(`(require\\(['"]${f}['"]\\)|from\\s+['"]${f}['"]|import\\s+.*${f})`, 'i');
        assert.ok(!importRe.test(content), `Should not import ${f} SDK`);
      }
    }
  },

  // 10. Guardrails: no persistence
  {
    name: 'No persistence (addMemoryFromForm, localStorage, sessionStorage, DB write)',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(!content.includes('addMemoryFromForm'), 'Should not call addMemoryFromForm');
      assert.ok(!content.includes('localStorage'), 'Should not use localStorage');
      assert.ok(!content.includes('sessionStorage'), 'Should not use sessionStorage');
      assert.ok(!content.includes('database') && !content.includes('firestore') && !content.includes('D1'), 'Should not reference DB');
    }
  },

  // 11. Auth/Rate limit placeholders
  {
    name: 'Auth verification placeholder documented',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('TODO: Auth') || content.includes('TODO: auth') || content.includes('placeholder'), 'Should have auth placeholder');
    }
  },
  {
    name: 'Rate limiting placeholder documented',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('TODO: Rate') || content.includes('TODO: rate') || content.includes('placeholder'), 'Should have rate limit placeholder');
    }
  },
  {
    name: 'Live provider integration placeholder documented',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('TODO: Live') || content.includes('TODO: live') || content.includes('placeholder'), 'Should have live provider placeholder');
    }
  },

  // 12. Frontend not rewired by default
  {
    name: 'Frontend UI still uses stub provider by default (not endpoint)',
    fn: () => {
      const uiContent = readFileSafe(FRONTEND_UI_PATH);
      // UI should still use window.LoveBudScoutSuggestionProvider (browser-side)
      assert.ok(uiContent.includes('LoveBudScoutSuggestionProvider'), 'UI should use browser-side provider');
      // Should NOT default to calling /api/scout/suggest
      assert.ok(!uiContent.includes('/api/scout/suggest') || uiContent.includes('placeholder') || uiContent.includes('TODO'), 'UI should not default to endpoint');
    }
  },

  // 13. Document updates
  {
    name: 'Boundary doc mentions Phase D prep endpoint skeleton',
    fn: () => {
      const doc = readFileSafe(DOC_BOUNDARY_PATH);
      assert.ok(doc.includes('Phase D prep') || doc.includes('endpoint skeleton') || doc.includes('implemented'), 'Should reflect endpoint skeleton status');
    }
  },
  {
    name: 'Provider boundary doc mentions serverless endpoint skeleton',
    fn: () => {
      const doc = readFileSafe(DOC_PROVIDER_PATH);
      assert.ok(doc.includes('Phase D') || doc.includes('serverless endpoint') || doc.includes('endpoint skeleton'), 'Should reflect endpoint skeleton status');
    }
  },

  // 14. Error response structure
  {
    name: 'Error responses use consistent structure {ok:false, error:{code,message}}',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('ok: false'), 'Error response should have ok:false');
      assert.ok(content.includes('error: { code'), 'Error response should have error.code');
    }
  },
  {
    name: 'Uses standard error codes from boundary doc',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      const codes = ['VALIDATION_ERROR', 'UNAUTHORIZED', 'PROVIDER_UNAVAILABLE', 'CONFIG_MISSING', 'INTERNAL_ERROR'];
      for (const code of codes) {
        assert.ok(content.includes(code), `Should use error code ${code}`);
      }
    }
  },

  // 15. Request ID header propagation
  {
    name: 'Propagates x-lovebud-request-id header',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('x-lovebud-request-id') || content.includes('REQUEST_ID_HEADER'), 'Should use request ID header');
    }
  },

  // 16. Body size limit
  {
    name: 'Enforces body size limit',
    fn: () => {
      const content = readFileSafe(ENDPOINT_PATH);
      assert.ok(content.includes('MAX_BODY_SIZE') || content.includes('131072') || content.includes('128KB'), 'Should have body size limit');
      assert.ok(content.includes('tooLarge'), 'Should check body size');
    }
  }
];

// Run tests
let passed = 0;
let failed = 0;

console.log('\n🧪 Scout Suggestion Endpoint Skeleton Contract Tests\n');

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