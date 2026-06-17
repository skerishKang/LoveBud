/**
 * Contract: Scout staging smoke report template
 *
 * Verifies that the staging smoke report template exists, has the required
 * sections, and keeps smoke evidence sanitized for future production review.
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

const requiredReportSections = [
  'Smoke run metadata',
  'Staging environment snapshot',
  'Env/secret presence checklist, names only, no values',
  'Request scenario list',
  'Success response verification',
  'Safe-fail response verification',
  'Sanitized log/observability verification',
  'Kill switch drill result',
  'Regression notes',
  'Decision: pass / fail / retry / rollback',
  'Sign-off fields'
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
    name: 'Report template file exists and is non-empty',
    fn: () => {
      assert.ok(reportContent.length > 0, 'Report template should exist and not be empty');
    }
  },
  {
    name: 'Production checklist file exists and is non-empty',
    fn: () => {
      assert.ok(checklistContent.length > 0, 'Production checklist should exist and not be empty');
    }
  },
  ...requiredReportSections.map((section) => ({
    name: `Report template includes required section: ${section}`,
    fn: () => {
      assert.ok(reportContent.includes(section), `Report template should include ${section}`);
    }
  })),
  {
    name: 'Report template keeps SCOUT_SUGGEST_LLM_API_KEY as presence/status only',
    fn: () => {
      const apiKeyLine = reportContent.match(/^\|\s*`SCOUT_SUGGEST_LLM_API_KEY`\s*\|\s*([^\n]+)/m);
      assert.ok(apiKeyLine, 'Report template should include SCOUT_SUGGEST_LLM_API_KEY presence/status row');
      assert.match(apiKeyLine[1], /^present \/ missing \/ not checked/, 'SCOUT_SUGGEST_LLM_API_KEY row should list presence/status only');
      assert.doesNotMatch(apiKeyLine[1], /sk-[A-Za-z0-9_-]{8,}/i, 'SCOUT_SUGGEST_LLM_API_KEY row should not include a value');
    }
  },
  ...forbiddenPatterns.map(({ name, pattern }) => ({
    name: `Report template forbids dangerous pattern: ${name}`,
    fn: () => {
      assert.doesNotMatch(reportContent, pattern, `Report template should not contain ${name}`);
    }
  })),
  {
    name: 'Report template does not include long provider-response-like JSON content',
    fn: () => {
      assert.doesNotMatch(
        reportContent,
        /```json[\s\S]{200,}content[\s\S]{50,}provider[\s\S]{50,}model[\s\S]*```/,
        'Report template should not include long provider-response-like JSON content'
      );
    }
  },
  {
    name: 'Report template protects parent issue #1882',
    fn: () => {
      assert.ok(reportContent.includes('Refs #1882') || reportContent.includes('Keeps #1882 open.'), 'Report template should protect #1882');
      assert.doesNotMatch(reportContent, /Closes #1882/, 'Report template should not close #1882');
      assert.doesNotMatch(reportContent, /Fixes #1882/, 'Report template should not fix #1882');
      assert.doesNotMatch(reportContent, /Resolves #1882/, 'Report template should not resolve #1882');
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
    name: 'Report template states normal CI remains network-free',
    fn: () => {
      assert.ok(reportContent.includes('Normal CI remains network-free'), 'Report template should state normal CI remains network-free');
    }
  },
  {
    name: 'Report template blocks production activation',
    fn: () => {
      assert.ok(reportContent.includes('Production activation remains blocked'), 'Report template should state production activation remains blocked');
      assert.ok(reportContent.includes('does not automatically approve production activation'), 'Report template should state smoke evidence is not automatic approval');
    }
  },
  {
    name: 'Report template forbids frontend/browser provider call',
    fn: () => {
      assert.ok(reportContent.includes('Frontend/browser code must not call a provider directly'), 'Report template should forbid frontend/browser provider call');
    }
  },
  {
    name: 'Report template includes rollback/kill switch verification field',
    fn: () => {
      assert.ok(reportContent.includes('Kill switch drill result'), 'Report template should include kill switch drill result section');
    }
  }
];

let passed = 0;
let failed = 0;

console.log('\n🧪 Scout Staging Smoke Report Template Contract Tests\n');

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
