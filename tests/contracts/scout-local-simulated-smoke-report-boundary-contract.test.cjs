/**
 * Contract: Scout local simulated smoke report boundary
 * Refs #1882
 * Refs #2636
 *
 * Ensures the checked-in local simulated Scout smoke report cannot be
 * mistaken for completion evidence for the real Cloudflare staging smoke.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT_PATH = path.join(ROOT, 'docs', 'product', 'lovebud-scout-staging-smoke-report-2026-06-18.md');

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

const reportContent = readFileSafe(REPORT_PATH);

const tests = [
  {
    name: 'local simulated smoke report exists',
    fn: () => {
      assert.ok(reportContent.length > 0, 'local simulated report should exist');
    },
  },
  {
    name: 'report is explicitly local simulated only',
    fn: () => {
      assert.match(reportContent, /Local Simulated Scout Smoke Report/i);
      assert.match(reportContent, /Local simulated smoke only/i);
    },
  },
  {
    name: 'report explicitly does not complete #2636',
    fn: () => {
      assert.match(reportContent, /Does not complete #2636/i);
      assert.match(reportContent, /Actual Cloudflare staging smoke still required/i);
    },
  },
  {
    name: 'report keeps production activation blocked',
    fn: () => {
      assert.match(reportContent, /Production Activation Status/i);
      assert.match(reportContent, /BLOCKED/i);
    },
  },
  {
    name: 'report references #2636 without closing it',
    fn: () => {
      assert.match(reportContent, /#2636/);
      assert.doesNotMatch(reportContent, /Closes #2636/i);
      assert.doesNotMatch(reportContent, /Fixes #2636/i);
      assert.doesNotMatch(reportContent, /Resolves #2636/i);
    },
  },
  {
    name: 'report protects parent #1882',
    fn: () => {
      assert.match(reportContent, /#1882/);
      assert.doesNotMatch(reportContent, /Closes #1882/i);
      assert.doesNotMatch(reportContent, /Fixes #1882/i);
      assert.doesNotMatch(reportContent, /Resolves #1882/i);
    },
  },
  {
    name: 'report records no raw sensitive runtime evidence',
    fn: () => {
      assert.doesNotMatch(reportContent, /sk-[A-Za-z0-9_-]{8,}/i);
      assert.doesNotMatch(reportContent, /Bearer\s+[A-Za-z0-9._-]{8,}/i);
      assert.doesNotMatch(reportContent, /rawProviderResponse/i);
      assert.doesNotMatch(reportContent, /prompt\s*:/i);
      assert.doesNotMatch(reportContent, /sourceUrl\s*:\s*https?:\/\//i);
    },
  },
];

let passed = 0;
let failed = 0;

console.log('\n🧪 Scout Local Simulated Smoke Report Boundary Contract Tests\n');

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
