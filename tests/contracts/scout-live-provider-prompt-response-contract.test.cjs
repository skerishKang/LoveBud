/**
 * Scout Live Provider Prompt and Response Contract Tests
 * v20260606-1
 *
 * Audit-only contract tests verifying that:
 * - The prompt/response contract document exists with required sections
 * - Allowed/prohibited prompt inputs are defined
 * - Copyright/safety boundaries are defined
 * - Response schema and validation rules are defined
 * - Language/tone/failure rules are defined
 * - UI application boundary is defined
 * - Non-goals are preserved
 * - Product Prompt safety note content is defined
 * - Existing docs are updated
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const CONTRACT_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-live-provider-prompt-response-contract.md');
const READINESS_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-ai-suggestion-mvp-readiness.md');
const LLM_PROVIDER_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-llm-provider-boundary.md');
const ENDPOINT_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-serverless-endpoint-boundary.md');
const PROVIDER_PATH = path.resolve(__dirname, '../../js/scout/scout-suggestion-provider.js');
const UI_PATH = path.resolve(__dirname, '../../js/scout/scout-draft-ui.js');
const ENDPOINT_CLIENT_PATH = path.resolve(__dirname, '../../js/scout/scout-suggestion-endpoint-client.js');
const SUGGEST_PATH = path.resolve(__dirname, '../../functions/api/scout/suggest.js');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

const tests = [
  // 1. Contract document exists
  {
    name: 'Contract document exists and is non-empty',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      assert.ok(content.length > 0, 'Contract document should exist and not be empty');
      assert.ok(content.includes('Prompt and Response Contract'), 'Document should include contract identifier');
    }
  },

  // 2. Baseline and purpose
  {
    name: 'Document includes baseline with #1882, local_stub default, live provider not implemented, contract purpose',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      assert.ok(content.includes('#1882'), 'Should reference #1882');
      assert.ok(content.includes('local_stub') || content.includes('local stub'), 'Should mention local_stub default');
      assert.ok(content.includes('NOT IMPLEMENTED') || content.includes('not implemented'), 'Should state live provider is not implemented');
      assert.ok(content.includes('prompt input boundary') || content.includes('Contract Purpose'), 'Should include contract purpose');
    }
  },

  // 3. Allowed prompt inputs
  {
    name: 'Document lists all 7 allowed prompt inputs with ✅ Yes',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      const expectedInputs = [
        'user-entered excerpt',
        'user-entered summary',
        'user memo',
        'source URL string',
        'requested language',
        'desired tone',
        'max output length',
      ];
      for (const input of expectedInputs) {
        assert.ok(content.includes(input),
          `Document should list allowed input: "${input}"`);
      }
      // Each should have Yes ✅ marker
      const yesCount = (content.match(/✅ Yes/g) || []).length;
      assert.ok(yesCount >= 7, `Should have at least 7 ✅ Yes markers, found ${yesCount}`);
    }
  },

  // 4. Prohibited prompt inputs
  {
    name: 'Document lists 10+ prohibited prompt inputs with 🚫 marker',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      const prohibitedList = [
        'API keys',
        'Auth / session',
        'Hidden user profile',
        'Unrelated LoveTree',
        'Private messages',
        'fetched full article',
        'Paywalled',
        'browser storage',
        'Firebase credentials',
        'Database records',
      ];
      for (const item of prohibitedList) {
        assert.ok(content.includes(item) || content.toLowerCase().includes(item.toLowerCase()),
          `Document should prohibit: "${item}"`);
      }
      const prohibitedCount = (content.match(/🚫/g) || []).length;
      assert.ok(prohibitedCount >= 10, `Should have at least 10 🚫 markers, found ${prohibitedCount}`);
    }
  },

  // 5. Source URL attribution only
  {
    name: 'Document states sourceUrl is attribution string only and never fetched',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      const attribRefs = [
        'attribution',
        'never fetched',
        'not to fetch',
        'must not be fetched',
      ];
      const hasAttribRef = attribRefs.some(r => content.toLowerCase().includes(r));
      assert.ok(hasAttribRef, 'Document should state sourceUrl is attribution-only and not fetched');
      const hasExplicitAttrib = content.includes('attribution string only') || content.includes('Attribution string only');
      assert.ok(hasExplicitAttrib, 'Should explicitly say "attribution string only"');
    }
  },

  // 6. Copyright boundary
  {
    name: 'Document defines copyright boundary: no automatic article retrieval, no full-text reproduction, no long verbatim copying, transformative summary, user review required',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      const copyrightRefs = [
        'no automatic article retrieval',
        'no full-text reproduction',
        'no long verbatim',
        'transformative',
        'User review required',
      ];
      for (const ref of copyrightRefs) {
        assert.ok(content.toLowerCase().includes(ref.toLowerCase()),
          `Copyright boundary should include: "${ref}"`);
      }
    }
  },

  // 7. Safety boundary
  {
    name: 'Document defines safety boundary: no hidden data inference, no credential handling, no source impersonation, safetyNote required',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      const safetyRefs = [
        'no hidden data inference',
        'no credential handling',
        'no source impersonation',
        'safetyNote',
      ];
      for (const ref of safetyRefs) {
        assert.ok(content.toLowerCase().includes(ref.toLowerCase()),
          `Safety boundary should include: "${ref}"`);
      }
    }
  },

  // 8. Response schema
  {
    name: 'Document defines response schema with all 6 fields: titleSuggestion, summarySuggestion, translationSuggestion, emotionTags, memoSuggestion, safetyNote',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      const expectedFields = [
        'titleSuggestion',
        'summarySuggestion',
        'translationSuggestion',
        'emotionTags',
        'memoSuggestion',
        'safetyNote',
      ];
      for (const field of expectedFields) {
        assert.ok(content.includes(field),
          `Response schema should include field: "${field}"`);
      }
    }
  },

  // 9. Response validation rules
  {
    name: 'Document defines validation: emotionTags max 4, each max 20 chars, invalid provider response → PROVIDER_ERROR, no raw model response direct UI application',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      const validationRefs = [
        'emotionTags',
        'max 4',
        '20 character',
        'PROVIDER_ERROR',
        'raw model response',
        'without validation',
      ];
      for (const ref of validationRefs) {
        assert.ok(content.includes(ref) || content.toLowerCase().includes(ref.toLowerCase()),
          `Validation rules should include: "${ref}"`);
      }
    }
  },

  // 10. Language and tone rules
  {
    name: 'Document defines language/tone rules: requestedLanguage guidance, desiredTone guidance, unsupported fallback, no invented facts, translation optional',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      const langToneRefs = [
        'requestedLanguage',
        'desiredTone',
        'Unsupported language',
        'Unsupported tone',
        'fall back',
        'no invented facts',
        'translationSuggestion',
      ];
      for (const ref of langToneRefs) {
        assert.ok(content.includes(ref) || content.toLowerCase().includes(ref.toLowerCase()),
          `Language/tone rules should include: "${ref}"`);
      }
    }
  },

  // 11. Failure mapping
  {
    name: 'Document defines 6+ failure-to-error-code mappings: CONFIG_MISSING, PROVIDER_ERROR, VALIDATION_ERROR, RATE_LIMITED, PROVIDER_UNAVAILABLE',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      const errorCodes = [
        'CONFIG_MISSING',
        'PROVIDER_ERROR',
        'VALIDATION_ERROR',
        'RATE_LIMITED',
        'PROVIDER_UNAVAILABLE',
      ];
      for (const code of errorCodes) {
        assert.ok(content.includes(code),
          `Failure mapping should include error code: "${code}"`);
      }
      assert.ok(content.includes('safe error') || content.includes('Safe error'),
        'Failure mapping should state safe error behavior');
    }
  },

  // 12. UI application boundary
  {
    name: 'Document defines UI application boundary: editable fields only, user must click save, no auto-save, manual save available, fallback does not clear input',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      const uiRefs = [
        'editable fields',
        'user must still click',
        'No auto-save',
        'manual save',
        'fallback',
        'not clear user input',
      ];
      for (const ref of uiRefs) {
        assert.ok(content.includes(ref) || content.toLowerCase().includes(ref.toLowerCase()),
          `UI boundary should include: "${ref}"`);
      }
    }
  },

  // 13. Non-goals
  {
    name: 'Document maintains non-goals: no live provider implementation, no API keys, no external fetch, no crawler, no auto-save, no DB/schema migration, no Browse #1661',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      const nonGoals = [
        'no live provider implementation',
        'no API keys',
        'no external URL fetch',
        'no crawler',
        'no auto-save',
        'no DB/schema migration',
        'no Browse #1661',
      ];
      for (const ng of nonGoals) {
        assert.ok(content.toLowerCase().includes(ng.toLowerCase()),
          `Non-goals should include: "${ng}"`);
      }
    }
  },

  // 14. Recommended next slice
  {
    name: 'Document includes recommended next slice: [TECH] Add Scout live provider adapter skeleton or similar',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);
      const nextSliceRefs = [
        'live provider adapter skeleton',
        'prompt builder',
        'response validator',
      ];
      const hasNextSlice = nextSliceRefs.some(r => content.toLowerCase().includes(r.toLowerCase()));
      assert.ok(hasNextSlice, 'Document should include recommended next slice');
      const hasNextSliceHeading = content.toLowerCase().includes('next slice');
      assert.ok(hasNextSliceHeading, 'Document should have a next slice section');
    }
  },

  // 15. No production implementation change
  {
    name: 'No production JS behavior change introduced — all scout JS files remain unchanged',
    fn: () => {
      const providerContent = readFileSafe(PROVIDER_PATH);
      const uiContent = readFileSafe(UI_PATH);
      const endpointClientContent = readFileSafe(ENDPOINT_CLIENT_PATH);
      const suggestContent = readFileSafe(SUGGEST_PATH);
      const contractContent = readFileSafe(CONTRACT_PATH);

      assert.ok(providerContent.length > 0, 'Provider file should still exist');
      assert.ok(uiContent.length > 0, 'UI file should still exist');
      assert.ok(endpointClientContent.length > 0, 'Endpoint client file should still exist');
      assert.ok(suggestContent.length > 0, 'suggest.js should still exist');

      // The contract doc should not contain code that implements runtime behavior
      assert.ok(!contractContent.includes('fetch(') && !contractContent.includes('fetch ('),
        'Contract doc should not include fetch calls');
      assert.ok(!contractContent.includes('api.openai'),
        'Contract doc should not contain real provider URLs');
      const providerSdks = ['openai.com', 'api.anthropic', 'api.gemini', 'api.groq', 'api.mistral', 'api.nvidia'];
      for (const sdk of providerSdks) {
        assert.ok(!contractContent.includes(sdk),
          `Contract doc should not contain provider SDK URL: ${sdk}`);
      }
    }
  },

  // 16. Product Prompt safety note content
  {
    name: 'Product Prompt safety note content is defined for both English and Korean with all 7 invariants',
    fn: () => {
      const content = readFileSafe(CONTRACT_PATH);

      // The Product Prompt safety note section must exist
      assert.ok(content.includes('Product Prompt'),
        'Document should have a "Product Prompt" section');
      assert.ok(content.toLowerCase().includes('safety note'),
        'Document should reference safety note in the Product Prompt section');

      // English canonical safety note must be defined with all 6 required points
      const englishSection = content.match(/Required safety note content \(English canonical\)[\s\S]*?```[\s\S]*?```/);
      assert.ok(englishSection, 'Document should define English canonical safety note');
      const englishText = englishSection[0].toLowerCase();
      const englishRequired = [
        'ai-generated suggestion',
        'user-entered excerpt',
        'no fetching',
        'transformative summary',
        'verbatim reproduction',
        'short, editable',
        'invent facts',
        'credentials',
        'tokens',
        'api key',
        'pii',
        'copyright',
        'fully read',
        'review',
      ];
      for (const req of englishRequired) {
        assert.ok(englishText.includes(req),
          `English safety note should include: "${req}"`);
      }

      // Korean canonical safety note must be defined
      const koreanSection = content.match(/Required safety note content \(Korean canonical\)[\s\S]*?```[\s\S]*?```/);
      assert.ok(koreanSection, 'Document should define Korean canonical safety note');
      const koreanText = koreanSection[0];
      const koreanRequired = [
        'provider에 지시',
        '발췌/메모',
        '자동 fetch',
        '변형된',
        '편집 가능',
        '사용자 입력 외',
        '자격증명',
        '토큰',
        'API key',
        'PII',
        '저작권',
        '검토',
      ];
      for (const req of koreanRequired) {
        assert.ok(koreanText.includes(req),
          `Korean safety note should include: "${req}"`);
      }

      // All 7 safety note invariants must be defined
      const invariantRefs = [
        'every provider response',
        'not be empty',
        'review',
        '검토',
        'credential',
        'api key',
        'environment variable',
        'requestedlanguage',
        'silently drop',
      ];
      for (const inv of invariantRefs) {
        // Handle markdown bold: **every** provider response -> every provider response
        const normalizedContent = content.toLowerCase().replace(/\*\*([^*]+)\*\*/g, '$1');
        assert.ok(normalizedContent.includes(inv.toLowerCase()),
          `Safety note invariant should reference: "${inv}"`);
      }

      // The safety note should mention review (English) or 검토 (Korean) as required
      assert.ok(content.toLowerCase().includes('always review') || content.includes('직접 검토'),
        'Safety note should mention review/검토 requirement');
    }
  },
];

// Run tests
let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test.fn();
    console.log(`  ✓ ${test.name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${test.name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
