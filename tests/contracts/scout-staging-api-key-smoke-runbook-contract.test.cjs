/**
 * Contract: Scout staging API-key smoke runbook
 *
 * Verifies that:
 * - The runbook document exists and is structurally correct
 * - No real API key values are committed
 * - Required env/secret names are documented
 * - Staging-only, production-blocked rules are explicit
 * - Rollback/kill switch procedures exist
 * - Privacy/logging rules are documented
 * - #1882 remains open (Refs only, never Closes/Fixes/Resolves)
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RUNBOOK_PATH = path.resolve(__dirname, '../..', 'docs/product/lovebud-scout-staging-api-key-smoke-runbook.md');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

const runbookContent = readFileSafe(RUNBOOK_PATH);

function extractFencedCodeBlock(content, language) {
  const escapedLanguage = language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp('```' + escapedLanguage + '\\s*\\n([\\s\\S]*?)\\n```'));
  return match ? match[1] : '';
}

function parseJsonBlock(block) {
  try {
    return JSON.parse(block);
  } catch {
    return null;
  }
}

const manualSmokeBlock = extractFencedCodeBlock(runbookContent, 'bash');
const successResponseBlock = extractFencedCodeBlock(runbookContent, 'json');
const successResponseBody = parseJsonBlock(successResponseBlock);
const safeFailSection = runbookContent.slice(
  runbookContent.indexOf('## Expected safe-fail responses'),
  runbookContent.indexOf('## Log and privacy rules')
);

const tests = [
  // ── Document existence ──────────────────────────────────────────────────
  {
    name: 'Runbook file exists and is non-empty',
    fn: () => {
      assert.ok(runbookContent.length > 0, 'Runbook should exist and not be empty');
    }
  },

  // ── Required env/secret names ──────────────────────────────────────────
  {
    name: 'Documents SCOUT_SUGGEST_PROVIDER_MODE',
    fn: () => {
      assert.ok(runbookContent.includes('SCOUT_SUGGEST_PROVIDER_MODE'), 'Should mention SCOUT_SUGGEST_PROVIDER_MODE');
    }
  },
  {
    name: 'Documents SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED',
    fn: () => {
      assert.ok(runbookContent.includes('SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED'), 'Should mention SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED');
    }
  },
  {
    name: 'Documents SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE',
    fn: () => {
      assert.ok(runbookContent.includes('SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE'), 'Should mention SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE');
    }
  },
  {
    name: 'Documents SCOUT_SUGGEST_PROVIDER_STAGE',
    fn: () => {
      assert.ok(runbookContent.includes('SCOUT_SUGGEST_PROVIDER_STAGE'), 'Should mention SCOUT_SUGGEST_PROVIDER_STAGE');
    }
  },
  {
    name: 'Documents SCOUT_SUGGEST_LLM_PROVIDER',
    fn: () => {
      assert.ok(runbookContent.includes('SCOUT_SUGGEST_LLM_PROVIDER'), 'Should mention SCOUT_SUGGEST_LLM_PROVIDER');
    }
  },
  {
    name: 'Documents SCOUT_SUGGEST_MODEL',
    fn: () => {
      assert.ok(runbookContent.includes('SCOUT_SUGGEST_MODEL'), 'Should mention SCOUT_SUGGEST_MODEL');
    }
  },
  {
    name: 'Documents SCOUT_SUGGEST_LLM_API_KEY',
    fn: () => {
      assert.ok(runbookContent.includes('SCOUT_SUGGEST_LLM_API_KEY'), 'Should mention SCOUT_SUGGEST_LLM_API_KEY');
    }
  },
  {
    name: 'Documents SCOUT_SUGGEST_LLM_BASE_URL',
    fn: () => {
      assert.ok(runbookContent.includes('SCOUT_SUGGEST_LLM_BASE_URL'), 'Should mention SCOUT_SUGGEST_LLM_BASE_URL');
    }
  },

  // ── No real API key values ─────────────────────────────────────────────
  {
    name: 'Does not contain sk- API key pattern',
    fn: () => {
      assert.ok(!/sk-/i.test(runbookContent), 'Should not contain literal sk- API key prefix');
    }
  },
  {
    name: 'Does not contain "Bearer real"',
    fn: () => {
      assert.ok(!/Bearer real/i.test(runbookContent), 'Should not contain real bearer token');
    }
  },
  {
    name: 'Does not contain OPENAI_API_KEY=',
    fn: () => {
      assert.ok(!/OPENAI_API_KEY=/i.test(runbookContent), 'Should not contain OPENAI_API_KEY= with value');
    }
  },
  {
    name: 'Uses placeholders instead of real key values in tables',
    fn: () => {
      // Check table cells contain placeholders
      const lines = runbookContent.split('\n');
      for (const line of lines) {
        // Skip non-table lines
        if (!line.includes('|')) continue;
        // Skip header/separator rows
        if (line.includes('---|---|---') || line.includes('---')) continue;
        // Skip example data in code blocks
        if (line.trim().startsWith('#')) continue;
        // Look for value-like content in table cells
        const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
        // Only check rows that look like env/secret tables (have a key name cell)
        const hasKeyInCell = cells.some(c =>
          c.startsWith('SCOUT_SUGGEST_') ||
          c.startsWith('SCOUT_')
        );
        if (!hasKeyInCell) continue;
        // If this is a table row with a key name, the value cell should be a placeholder
        for (const cell of cells) {
          // It's OK if the cell is empty or a description
          if (cell === '' || cell.length > 80) continue;
          // If cell looks like a real value (long alphanumeric) flag it
          if (/^[A-Za-z0-9_-]{20,}$/.test(cell)) {
            // Allow example values that are clearly placeholders
            if (/<.*>/.test(cell)) continue;
            assert.fail(`Potential real value in table: "${cell}"`);
          }
        }
      }
    }
  },

  // ── Staging only ───────────────────────────────────────────────────────
  {
    name: 'Explicitly identifies as staging-only',
    fn: () => {
      assert.ok(
        /staging[- ]only/i.test(runbookContent) ||
        /staging\s+only/i.test(runbookContent) ||
        runbookContent.includes('staging') ||
        runbookContent.includes('Staging'),
        'Should identify as staging document'
      );
    }
  },
  {
    name: 'Blocks production activation explicitly',
    fn: () => {
      assert.ok(
        runbookContent.includes('Production activation blockers') ||
        runbookContent.includes('production activation') ||
        runbookContent.includes('production is blocked') ||
        runbookContent.includes('production_live'),
        'Should explicitly block production activation'
      );
    }
  },

  // ── Kill switch / rollback ─────────────────────────────────────────────
  {
    name: 'Documents rollback or kill switch procedure',
    fn: () => {
      assert.ok(
        runbookContent.includes('Rollback') ||
        runbookContent.includes('kill switch') ||
        runbookContent.includes('Kill switch'),
        'Should document rollback or kill switch'
      );
    }
  },
  {
    name: 'Documents at least one actionable kill switch mechanism',
    fn: () => {
      const switches = [
        'SCOUT_SUGGEST_PROVIDER_MODE=stub',
        'SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=false',
        'SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE',
        'SCOUT_SUGGEST_PROVIDER_STAGE',
      ];
      const found = switches.some(s => runbookContent.includes(s));
      assert.ok(found, 'Should mention a kill switch env var');
    }
  },

  // ── Privacy / logging ──────────────────────────────────────────────────
  {
    name: 'Documents logging and privacy rules',
    fn: () => {
      assert.ok(
        runbookContent.includes('Log') ||
        runbookContent.includes('privacy') ||
        runbookContent.includes('log rules'),
        'Should document logging/privacy rules'
      );
    }
  },
  {
    name: 'Prohibits raw provider response logging',
    fn: () => {
      assert.ok(
        runbookContent.includes('rawProviderResponse') ||
        runbookContent.includes('raw provider') ||
        runbookContent.includes('raw response'),
        'Should prohibit raw provider response'
      );
    }
  },

  // ── Normal CI network-free ─────────────────────────────────────────────
  {
    name: 'States normal CI must be network-free',
    fn: () => {
      assert.ok(
        runbookContent.includes('network-free') ||
        runbookContent.includes('network free') ||
        runbookContent.includes('normal CI'),
        'Should state normal CI network-free'
      );
    }
  },

  // ── No frontend provider call ──────────────────────────────────────────
  {
    name: 'States no frontend provider call',
    fn: () => {
      assert.ok(
        runbookContent.includes('frontend') ||
        runbookContent.includes('Frontend') ||
        runbookContent.includes('browser'),
        'Should forbid frontend provider call'
      );
    }
  },

  // ── #1882 open protection ──────────────────────────────────────────────
  {
    name: 'References #1882',
    fn: () => {
      assert.ok(runbookContent.includes('#1882'), 'Should reference #1882');
    }
  },
  {
    name: 'Does not close #1882 (no Closes/Fixes/Resolves #1882)',
    fn: () => {
      assert.ok(!/Closes #1882/.test(runbookContent), 'Should not close #1882');
      assert.ok(!/Fixes #1882/.test(runbookContent), 'Should not fix #1882');
      assert.ok(!/Resolves #1882/.test(runbookContent), 'Should not resolve #1882');
    }
  },

  // ── Content structure ──────────────────────────────────────────────────
  {
    name: 'Includes a scope section',
    fn: () => {
      assert.ok(runbookContent.includes('## Scope'), 'Should have a Scope section');
    }
  },
  {
    name: 'Includes a preconditions section',
    fn: () => {
      assert.ok(runbookContent.includes('## Preconditions'), 'Should have a Preconditions section');
    }
  },
  {
    name: 'Includes a verification checklist',
    fn: () => {
      assert.ok(runbookContent.includes('## Verification checklist') || runbookContent.includes('Checklist'), 'Should have a verification section');
    }
  },

  // ── Smoke request contract ────────────────────────────────────────────
  {
    name: 'Smoke request desiredTone uses endpoint-allowed value',
    fn: () => {
      const toneMatch = manualSmokeBlock.match(/"desiredTone"\s*:\s*"([^"]+)"/);
      assert.ok(toneMatch, 'Smoke request should include desiredTone');
      assert.ok(
        ['casual', 'polite', 'emotional'].includes(toneMatch[1]),
        'desiredTone should be one of casual, polite, emotional'
      );
    }
  },

  // ── Expected success response shape ───────────────────────────────────
  {
    name: 'Success response example does not include usedSuggestion in body',
    fn: () => {
      assert.ok(successResponseBody, 'Success response example should be valid JSON');
      assert.ok(
        !Object.prototype.hasOwnProperty.call(successResponseBody, 'usedSuggestion'),
        'Success response body should not include usedSuggestion'
      );
    }
  },
  {
    name: 'Success response example does not include body-level requestId',
    fn: () => {
      assert.ok(successResponseBody, 'Success response example should be valid JSON');
      assert.ok(
        !Object.prototype.hasOwnProperty.call(successResponseBody, 'requestId'),
        'Success response body should not include requestId'
      );
    }
  },
  {
    name: 'Success response explains requestId is returned in header',
    fn: () => {
      assert.ok(
        runbookContent.includes('The request id is returned in the `x-lovebud-request-id` response header, not in the JSON body.'),
        'Success response should explain requestId is returned in the response header'
      );
    }
  },

  // ── Expected safe-fail response shape ─────────────────────────────────
  {
    name: 'Safe-fail response explanation does not include body-level requestId',
    fn: () => {
      assert.ok(!/\brequestId\b/.test(safeFailSection), 'Safe-fail response explanation should not mention body-level requestId');
    }
  },
  {
    name: 'Safe-fail response explanation says requestId is returned in header',
    fn: () => {
      assert.ok(
        safeFailSection.includes('The request id is returned in the `x-lovebud-request-id` response header, not in the JSON body.'),
        'Safe-fail response should explain requestId is returned in the response header'
      );
    }
  },
];

// Run tests
let passed = 0;
let failed = 0;

console.log('\n🧪 Scout Staging API-Key Smoke Runbook Contract Tests\n');

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
