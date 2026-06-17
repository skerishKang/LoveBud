/**
 * Contract: Scout staging smoke operator handoff
 * Refs #1882
 * Refs #2636
 *
 * Keeps the operator handoff focused on real staging evidence without
 * allowing local simulated reports to close #2636.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const HANDOFF_PATH = path.resolve(__dirname, '../..', 'docs/product/lovebud-scout-staging-smoke-operator-handoff.md');

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

const handoffContent = readFileSafe(HANDOFF_PATH);

const requiredPhrases = [
  'Refs #1882',
  'Refs #2636',
  '#2636 remains open',
  '#1882 remains open',
  'Production activation remains blocked',
  'local simulated evidence only',
  'Record only presence/status, not values',
  'docs/product/lovebud-scout-staging-api-key-smoke-runbook.md',
  'docs/product/lovebud-scout-staging-smoke-report-template.md',
  'A local simulated report alone must not close #2636',
];

const forbiddenPatterns = [
  /Closes #1882/i,
  /Fixes #1882/i,
  /Resolves #1882/i,
  /Closes #2636/i,
  /Fixes #2636/i,
  /Resolves #2636/i,
  /sk-[A-Za-z0-9_-]{8,}/i,
  /Bearer\s+[A-Za-z0-9._-]{8,}/i,
  /OPENAI_API_KEY=/i,
  /rawProviderResponse/i,
  /prompt\s*:/i,
  /sourceUrl\s*:\s*https?:\/\//i,
];

const tests = [
  {
    name: 'operator handoff exists',
    fn: () => {
      assert.ok(handoffContent.length > 0, 'operator handoff should exist');
    },
  },
  ...requiredPhrases.map((phrase) => ({
    name: `operator handoff includes: ${phrase}`,
    fn: () => {
      assert.ok(handoffContent.includes(phrase), `missing phrase: ${phrase}`);
    },
  })),
  ...forbiddenPatterns.map((pattern) => ({
    name: `operator handoff forbids pattern: ${pattern}`,
    fn: () => {
      assert.doesNotMatch(handoffContent, pattern);
    },
  })),
];

let passed = 0;
let failed = 0;

console.log('\n🧪 Scout Staging Smoke Operator Handoff Contract Tests\n');

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
