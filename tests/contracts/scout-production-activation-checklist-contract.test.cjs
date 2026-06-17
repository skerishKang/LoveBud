/**
 * Contract: Scout production activation checklist
 *
 * Verifies that the production activation checklist exists, has the required
 * blocker gates, and does not enable production or record secret values.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPORT_PATH = path.resolve(__dirname, '../..', 'docs/product/lovebud-scout-staging-smoke-report-template.md');
const CHECKLIST_PATH = path.resolve(__dirname, '../..', 'docs/product/lovebud-scout-production-activation-checklist.md');

const expectedPrBody = [
  'Refs #1882',
  'Closes #2634',
  '',
  '## Summary',
  '- Adds a Scout staging smoke report template.',
  '- Adds a production activation blocker checklist.',
  '- Adds contracts that keep smoke evidence sanitized and block accidental production activation.',
  '',
  '## Safety',
  '- No real API key committed.',
  '- No environment file committed.',
  '- No raw provider response or prompt/excerpt/sourceUrl values recorded.',
  '- No production activation.',
  '- No frontend provider call.',
  '- Normal CI remains network-free.',
  '- Keeps #1882 open.'
].join('\n');

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

const reportContent = readFileSafe(REPORT_PATH);
const checklistContent = readFileSafe(CHECKLIST_PATH);

const requiredChecklistGates = [
  'Staging smoke report attached or referenced',
  'Secret rotation policy confirmed',
  'Cost/quota guard confirmed',
  'Auth boundary production-ready',
  'Rate-limit persistence production-ready',
  'Monitoring and alerting configured',
  'Rollback/kill switch tested',
  'No frontend provider call',
  'No normal CI provider call',
  'No raw provider response exposure',
  'No prompt/excerpt/sourceUrl/API key/token leak',
  'CTO/operator sign-off'
];

const forbiddenPatterns = [
  { name: 'sk- API key prefix', pattern: /sk-/i },
  { name: 'Bearer real token value', pattern: /Bearer real/i },
  { name: 'OPENAI_API_KEY assignment', pattern: /OPENAI_API_KEY=/i },
  { name: '.env file reference', pattern: /\.env\b/ },
  { name: 'rawProviderResponse field', pattern: /rawProviderResponse/ },
  { name: 'sourceUrl raw URL', pattern: /sourceUrl:\s*https?:\/\//i },
  { name: 'requestId body field', pattern: /requestId/ }
];

const tests = [
  {
    name: 'Production checklist file exists and is non-empty',
    fn: () => {
      assert.ok(checklistContent.length > 0, 'Production checklist should exist and not be empty');
    }
  },
  {
    name: 'Report template file exists and is non-empty',
    fn: () => {
      assert.ok(reportContent.length > 0, 'Report template should exist and not be empty');
    }
  },
  ...requiredChecklistGates.map((gate) => ({
    name: `Production checklist includes required gate: ${gate}`,
    fn: () => {
      assert.ok(checklistContent.includes(gate), `Production checklist should include ${gate}`);
    }
  })),
  {
    name: 'Production checklist keeps SCOUT_SUGGEST_LLM_API_KEY out of value fields',
    fn: () => {
      assert.ok(!/SCOUT_SUGGEST_LLM_API_KEY\s*\|\s*[^|\n]*[A-Za-z0-9_-]{12,}/.test(checklistContent), 'Checklist should not record SCOUT_SUGGEST_LLM_API_KEY as a value');
      assert.ok(reportContent.includes('SCOUT_SUGGEST_LLM_API_KEY'), 'Report template should record the secret name for presence/status');
    }
  },
  ...forbiddenPatterns.map(({ name, pattern }) => ({
    name: `Production checklist forbids dangerous pattern: ${name}`,
    fn: () => {
      assert.doesNotMatch(checklistContent, pattern, `Production checklist should not contain ${name}`);
    }
  })),
  {
    name: 'Production checklist does not include long provider-response-like JSON content',
    fn: () => {
      assert.doesNotMatch(
        checklistContent,
        /```json[\s\S]{200,}content[\s\S]{50,}provider[\s\S]{50,}model[\s\S]*```/,
        'Production checklist should not include long provider-response-like JSON content'
      );
    }
  },
  {
    name: 'Production checklist protects parent issue #1882',
    fn: () => {
      assert.ok(checklistContent.includes('Refs #1882') || checklistContent.includes('Keeps #1882 open.'), 'Production checklist should protect #1882');
      assert.doesNotMatch(checklistContent, /Closes #1882/, 'Production checklist should not close #1882');
      assert.doesNotMatch(checklistContent, /Fixes #1882/, 'Production checklist should not fix #1882');
      assert.doesNotMatch(checklistContent, /Resolves #1882/, 'Production checklist should not resolve #1882');
    }
  },
  {
    name: 'Expected PR body closes work issue #2634',
    fn: () => {
      assert.ok(expectedPrBody.includes('Closes #2634'), 'PR body should close #2634');
      assert.doesNotMatch(expectedPrBody, /Closes #1882/, 'PR body should not close #1882');
      assert.doesNotMatch(expectedPrBody, /Fixes #1882/, 'PR body should not fix #1882');
      assert.doesNotMatch(expectedPrBody, /Resolves #1882/, 'PR body should not resolve #1882');
    }
  },
  {
    name: 'Production checklist states normal CI remains network-free',
    fn: () => {
      assert.ok(checklistContent.includes('Normal CI remains network-free'), 'Production checklist should state normal CI remains network-free');
    }
  },
  {
    name: 'Production checklist blocks production activation',
    fn: () => {
      assert.ok(checklistContent.includes('does not enable production'), 'Production checklist should state it does not enable production');
      assert.ok(checklistContent.includes('Production activation is blocked unless'), 'Production checklist should state production activation is blocked unless all gates pass and separate approval is recorded');
    }
  },
  {
    name: 'Production checklist limits ready to checklist status',
    fn: () => {
      const readyMatches = checklistContent.match(/\bready\b/gi) || [];
      assert.ok(readyMatches.length > 0, 'Production checklist should use ready as a status');
      for (const match of readyMatches) {
        assert.ok(match === 'ready', 'ready should appear only as lowercase checklist status');
      }
      assert.ok(checklistContent.includes('Auth boundary production-ready'), 'Production checklist should include the required auth boundary gate');
      assert.ok(checklistContent.includes('Rate-limit persistence production-ready'), 'Production checklist should include the required rate-limit gate');
    }
  },
  {
    name: 'Production checklist forbids frontend/browser provider call',
    fn: () => {
      assert.ok(checklistContent.includes('Frontend/browser code must not call a provider directly'), 'Production checklist should forbid frontend/browser provider call');
    }
  },
  {
    name: 'Production checklist includes rollback/kill switch verification field',
    fn: () => {
      assert.ok(checklistContent.includes('Rollback/kill switch tested'), 'Production checklist should include rollback/kill switch gate');
    }
  },
  {
    name: 'Production checklist includes sign-off fields',
    fn: () => {
      assert.ok(/Sign-off Fields/i.test(checklistContent), 'Production checklist should include sign-off fields');
    }
  }
];

let passed = 0;
let failed = 0;

console.log('\n🧪 Scout Production Activation Checklist Contract Tests\n');

for (const test of tests) {
  try {
    test.fn();
    console.log(`  ✅ ${test.name}`);
    passed++;
  } catch (error) {
    console.log(`  ❌ ${test.name}`);
    console.log(`     ${error.message}`);
    failed++;
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
console.log(`${failed === 0 ? '✅ All contract tests passed.' : '❌ Some contract tests failed.'}`);

if (failed > 0) process.exit(1);
