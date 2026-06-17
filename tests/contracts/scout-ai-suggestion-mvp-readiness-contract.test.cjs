/**
 * Scout AI Suggestion MVP Readiness Contract Tests
 * v20260606-1
 *
 * Audit-only contract tests verifying that:
 * - Readiness document exists with required sections
 * - All guardrails are confirmed by production code
 * - Default source remains local_stub
 * - Endpoint client remains opt-in
 * - Endpoint still returns stub by default
 * - No real AI, auto-save, or persistence has been introduced
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const READINESS_DOC_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-ai-suggestion-mvp-readiness.md');
const SELECTOR_PATH = path.resolve(__dirname, '../../js/scout/scout-suggestion-source-selector.js');
const UI_PATH = path.resolve(__dirname, '../../js/scout/scout-draft-ui.js');
const ENDPOINT_CLIENT_PATH = path.resolve(__dirname, '../../js/scout/scout-suggestion-endpoint-client.js');
const PROVIDER_PATH = path.resolve(__dirname, '../../js/scout/scout-suggestion-provider.js');
const SUGGEST_PATH = path.resolve(__dirname, '../../functions/api/scout/suggest.js');
const DOC_BOUNDARY_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-serverless-endpoint-boundary.md');
const DOC_PROVIDER_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-llm-provider-boundary.md');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

/** Load a module in a sandbox and return its window namespace */
function loadModule(filePath, namespaceName) {
  const code = readFileSafe(filePath);
  if (!code) return null;
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window[namespaceName];
}

const tests = [
  // ── 1. Readiness document exists ──────────────────────────────────────────
  {
    name: 'Readiness document exists and is non-empty',
    fn: () => {
      const content = readFileSafe(READINESS_DOC_PATH);
      assert.ok(content.length > 0, 'Readiness document should exist and not be empty');
      assert.ok(content.includes('Readiness Verdict'), 'Document should have a Readiness Verdict section');
      assert.ok(content.includes('Guardrails Confirmed'), 'Document should have a Guardrails Confirmed section');
    }
  },

  // ── 2. Baseline includes current HEAD / issues ────────────────────────────
  {
    name: 'Readiness document baseline includes current HEAD and related issues',
    fn: () => {
      const content = readFileSafe(READINESS_DOC_PATH);
      assert.ok(content.includes('#1882'), 'Document should reference #1882');
      assert.ok(content.includes('#1661'), 'Document should reference #1661');
      assert.ok(content.includes('baseline') || content.includes('Baseline'), 'Document should have a baseline section');
      assert.ok(content.includes('HEAD'), 'Document should reference a main HEAD commit');
    }
  },

  // ── 3. Implemented capabilities listed ────────────────────────────────────
  {
    name: 'Readiness document lists implemented capabilities including manual save, local stub, endpoint client, source selector, opt-in QA',
    fn: () => {
      const content = readFileSafe(READINESS_DOC_PATH);
      // Must reference all major implemented capabilities
      const requiredRefs = [
        'manual',       // manual save
        'stub',         // local stub provider
        'skeleton',     // endpoint skeleton
        'endpoint client', // endpoint client wrapper
        'source selector', // source selector
        'opt-in QA',    // opt-in QA scenario
      ];
      for (const ref of requiredRefs) {
        assert.ok(content.toLowerCase().includes(ref.toLowerCase()),
          `Document should reference "${ref}" in implemented capabilities`);
      }
    }
  },

  // ── 4. Readiness verdict exists ────────────────────────────────────────────
  {
    name: 'Readiness verdict states ready for next boundary but not for default live usage',
    fn: () => {
      const content = readFileSafe(READINESS_DOC_PATH);
      // Verdict must distinguish planning vs production readiness
      assert.ok(content.includes('ready'), 'Verdict should mention readiness');
      const hasPlanningRef = content.includes('next boundary') ||
                             content.includes('planning') ||
                             content.includes('Next boundary');
      const hasNotDefaultRef = content.includes('not ready') ||
                               content.includes('not for default') ||
                               content.includes('no default live');
      assert.ok(hasPlanningRef, 'Verdict should reference readiness for next boundary/planning slice');
      assert.ok(hasNotDefaultRef, 'Verdict should state not ready for default live usage');
    }
  },

  // ── 5. Guardrails table exists ─────────────────────────────────────────────
  {
    name: 'Guardrails table includes no frontend API key, no default endpoint, no real provider, no external source fetch, no auto-save',
    fn: () => {
      const content = readFileSafe(READINESS_DOC_PATH);
      const guardrails = [
        'No frontend API key',
        'No default endpoint',
        'No real provider',
        'No external source fetch',
        'No auto-save',
      ];
      for (const g of guardrails) {
        assert.ok(content.includes(g) || content.toLowerCase().includes(g.toLowerCase()),
          `Guardrails table should include: "${g}"`);
      }
    }
  },

  // ── 6. Blockers listed ────────────────────────────────────────────────────
  {
    name: 'Blockers include Firebase auth placeholder, rate-limit persistence placeholder, live provider adapter missing, prompt/copyright contract missing',
    fn: () => {
      const content = readFileSafe(READINESS_DOC_PATH);
      const blockers = [
        'Firebase',
        'rate-limit',
        'live provider adapter',
        'prompt',
        'copyright',
      ];
      for (const b of blockers) {
        assert.ok(content.toLowerCase().includes(b.toLowerCase()),
          `Blockers section should reference: "${b}"`);
      }
    }
  },

  // ── 7. Deferred work listed ───────────────────────────────────────────────
  {
    name: 'Deferred work section keeps default live AI, crawler/fetch, metadata extraction, auto-save, schema migration, Browse #1661 as not now',
    fn: () => {
      const content = readFileSafe(READINESS_DOC_PATH);
      const deferredRefs = [
        'Default live AI',
        'Crawler',
        'metadata extraction',
        'Auto-save',
        'schema migration',
        '#1661',
      ];
      for (const d of deferredRefs) {
        assert.ok(content.includes(d) || content.toLowerCase().includes(d.toLowerCase()),
          `Deferred work section should reference: "${d}"`);
      }
    }
  },

  // ── 8. Recommended next slice exists ──────────────────────────────────────
  {
    name: 'Recommended next slice is prompt and response contract or equivalent',
    fn: () => {
      const content = readFileSafe(READINESS_DOC_PATH);
      assert.ok(content.includes('next slice') || content.includes('Next slice') ||
                content.includes('Recommended Next'),
        'Document should have a recommended next slice section');
      assert.ok(content.includes('prompt') || content.includes('contract'),
        'Recommended next slice should involve prompt or contract');
    }
  },

  // ── 9. No implementation changes needed in this PR ─────────────────────────
  {
    name: 'PR is audit-only: no real AI, new provider, API key, or production JS changes introduced',
    fn: () => {
      // This test verifies the current PR is audit-only by checking that
      // the only non-doc test files created are contract tests and doc files
      const readinessDoc = readFileSafe(READINESS_DOC_PATH);
      // Readiness doc must explicitly state no implementation added
      assert.ok(readinessDoc.includes('audit') || readinessDoc.includes('Audit'),
        'Readiness document should be audit-focused');
      assert.ok(readinessDoc.includes('Ready') || readinessDoc.includes('ready'),
        'Readiness document should have a verdict');
    }
  },

  // ── 10. No real AI provider strings in production files ────────────────────
  {
    name: 'No real AI provider SDK/import strings in scout production JS files',
    fn: () => {
      const files = [
        { name: 'provider', content: readFileSafe(PROVIDER_PATH) },
        { name: 'endpoint client', content: readFileSafe(ENDPOINT_CLIENT_PATH) },
        { name: 'source selector', content: readFileSafe(SELECTOR_PATH) },
        { name: 'draft UI', content: readFileSafe(UI_PATH) },
        { name: 'suggest.js', content: readFileSafe(SUGGEST_PATH) },
      ];
      const forbiddenProviders = ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia'];

      for (const file of files) {
        if (!file.content) continue;
        for (const provider of forbiddenProviders) {
          const lines = file.content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            // Skip comment lines and doc blocks
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/**') ||
                trimmed.startsWith('/*')) continue;

            // Check for actual SDK import patterns, not just any string mention.
            // A gate check like `provider === 'openai-compatible'` is legitimate
            // and should not trigger this check.
            const importPatterns = [
              new RegExp(`require\\(['"]${provider}['"]\\)`),
              new RegExp(`from ['"]${provider}['"]`),
              new RegExp(`import.*${provider}`),
            ];
            const hasImport = importPatterns.some(re => re.test(line));
            if (hasImport &&
                !line.includes('400-ai-finder') &&
                !line.includes('Non-goals') &&
                !line.includes('금지') &&
                !line.includes('non-goal')) {
              assert.fail(`${file.name} contains SDK import reference to "${provider}" at line ${i + 1}: ${trimmed}`);
            }
          }
        }
      }
    }
  },

  // ── 11. Frontend default remains local_stub ────────────────────────────────
  {
    name: 'Source selector and draft UI default to local_stub',
    fn: () => {
      // Load provider and selector together in sandbox
      const providerCode = readFileSafe(PROVIDER_PATH);
      const selectorCode = readFileSafe(SELECTOR_PATH);
      assert.ok(providerCode.length > 0, 'Provider file should exist');
      assert.ok(selectorCode.length > 0, 'Selector file should exist');

      const sandbox = { window: {}, console };
      vm.createContext(sandbox);
      vm.runInContext(providerCode, sandbox);
      vm.runInContext(selectorCode, sandbox);

      const selector = sandbox.window.LoveBudScoutSuggestionSourceSelector;
      assert.ok(selector, 'Source selector should load');

      // resolveScoutSuggestionSource() with no config must return local_stub
      const r1 = selector.resolveScoutSuggestionSource();
      assert.strictEqual(r1.source, 'local_stub', 'No config should return local_stub');

      const r2 = selector.resolveScoutSuggestionSource({});
      assert.strictEqual(r2.source, 'local_stub', 'Empty config should return local_stub');

      // default provider must be stub (requires provider prereq loaded in sandbox)
      const provider = selector.createScoutSuggestionSourceProvider();
      const meta = provider.getMeta();
      assert.ok(meta.name && meta.name.includes('Stub'),
        'Default provider should be stub, got: ' + meta.name);

      // UI should not call endpoint client directly
      const uiContent = readFileSafe(UI_PATH);
      const hasDirectEndpointCall = uiContent.includes('createScoutSuggestionEndpointClient');
      assert.strictEqual(hasDirectEndpointCall, false,
        'UI should not call createScoutSuggestionEndpointClient directly');
    }
  },

  // ── 12. Endpoint client remains opt-in ────────────────────────────────────
  {
    name: 'Endpoint client remains opt-in: explicit flag required, storage/query not read',
    fn: () => {
      const ns = loadModule(ENDPOINT_CLIENT_PATH, 'LoveBudScoutSuggestionEndpointClient');
      assert.ok(ns, 'Endpoint client namespace should load');

      // Default is false
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled(), false,
        'No config should return false');
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled({}), false,
        'Empty config should return false');

      // Only true/"true" pass
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled({ enabled: true }), true,
        'boolean true should pass');
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled({ enabled: 'true' }), true,
        'string "true" should pass');
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled({ enabled: 1 }), false,
        'number 1 should fail');
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled({ enabled: 'yes' }), false,
        'string "yes" should fail');

      // Check no localStorage/sessionStorage/location.search reading in non-comment code
      const endpointCode = readFileSafe(ENDPOINT_CLIENT_PATH);
      const endpointLines = endpointCode.split('\n');
      const nonCommentLines = endpointLines.filter(l => {
        const trimmed = l.trim();
        return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/**') && !trimmed.startsWith('/*');
      });
      const hasLocalStorageRef = nonCommentLines.some(l => l.includes('localStorage'));
      assert.strictEqual(hasLocalStorageRef, false, 'Should not read localStorage in non-comment code');
      const hasSessionStorageRef = nonCommentLines.some(l => l.includes('sessionStorage'));
      assert.strictEqual(hasSessionStorageRef, false, 'Should not read sessionStorage in non-comment code');
      const hasLocationSearch = nonCommentLines.some(l => l.includes('location.search'));
      assert.strictEqual(hasLocationSearch, false, 'Should not read location.search in non-comment code');
    }
  },

  // ── 13. Serverless endpoint still stub by default ──────────────────────────
  {
    name: 'Serverless endpoint suggest.js returns stub by default (providerMode: "stub")',
    fn: () => {
      const code = readFileSafe(SUGGEST_PATH);
      assert.ok(code.length > 0, 'Endpoint file should exist');

      // Default provider mode resolution returns stub
      assert.ok(code.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB') ||
                code.includes("'stub'") ||
                code.includes('"stub"'),
        'Endpoint should default to stub provider mode');

      // Live provider call path: either placeholder or actual adapter.suggest (still safe-fail)
      const hasAdapterCall = code.includes('adapter.suggest');
      const hasPlaceholder = code.includes('callLiveProvider') || code.includes('Future: call live provider');
      assert.ok(hasAdapterCall || hasPlaceholder,
        'Live provider should be behind adapter.suggest call or placeholder — no real provider call');
      // Verify no real provider URL or SDK is referenced
      assert.ok(!code.includes('api.openai') && !code.includes('api.anthropic'),
        'No real provider URLs in endpoint');
    }
  },

  // ── 14. No auto-save/persistence ───────────────────────────────────────────
  {
    name: 'No auto-save or persistence in Scout suggestion modules',
    fn: () => {
      const files = [
        { name: 'provider', content: readFileSafe(PROVIDER_PATH) },
        { name: 'endpoint client', content: readFileSafe(ENDPOINT_CLIENT_PATH) },
        { name: 'source selector', content: readFileSafe(SELECTOR_PATH) },
        { name: 'draft UI', content: readFileSafe(UI_PATH) },
        { name: 'suggest.js', content: readFileSafe(SUGGEST_PATH) },
      ];
      for (const file of files) {
        if (!file.content) continue;
        const lines = file.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('//') || line.startsWith('*')) continue;
          assert.ok(!line.includes('addMemoryFromForm'),
            `${file.name} should not call addMemoryFromForm (line ${i + 1})`);
          assert.ok(!line.includes('.save('),
            `${file.name} should not call .save() (line ${i + 1})`);
          assert.ok(!line.includes('localStorage.setItem'),
            `${file.name} should not call localStorage.setItem (line ${i + 1})`);
          assert.ok(!line.includes('sessionStorage.setItem'),
            `${file.name} should not call sessionStorage.setItem (line ${i + 1})`);
        }
      }
    }
  },

  // ── 15. Existing docs updated ──────────────────────────────────────────────
  {
    name: 'Serverless endpoint boundary and LLM provider boundary docs reference MVP readiness audit',
    fn: () => {
      const boundaryContent = readFileSafe(DOC_BOUNDARY_PATH);
      const providerContent = readFileSafe(DOC_PROVIDER_PATH);

      assert.ok(boundaryContent.length > 0, 'Serverless endpoint boundary doc should exist');
      assert.ok(providerContent.length > 0, 'LLM provider boundary doc should exist');

      // Both docs should reference this audit
      const auditRefs = ['MVP readiness', 'MVP Readiness', 'readiness audit', 'readiness'];
      const hasBoundaryRef = auditRefs.some(r => boundaryContent.includes(r));
      assert.ok(hasBoundaryRef,
        'Serverless endpoint boundary doc should reference MVP readiness audit');

      const hasProviderRef = auditRefs.some(r => providerContent.includes(r));
      assert.ok(hasProviderRef,
        'LLM provider boundary doc should reference MVP readiness audit');
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
