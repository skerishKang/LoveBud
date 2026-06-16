'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = 'docs/product/lovebud-scout-live-integration-harness-readiness-audit.md';
const TEST_PATH = 'tests/contracts/scout-live-integration-harness-readiness-audit-contract.test.cjs';

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readDoc() {
  return readFile(DOC_PATH);
}

function requirePhrase(doc, phrase, message) {
  assert.ok(doc.includes(phrase), message || `document must include: ${phrase}`);
}

test('document file exists with the required title', () => {
  const doc = readDoc();

  assert.ok(fs.existsSync(path.join(ROOT, DOC_PATH)), 'readiness audit document must exist');
  assert.match(doc, /^# LoveBud Scout Live Integration Test Harness Readiness Audit$/m, 'document title must match exactly');
});

test('companion contract test is present', () => {
  const testSource = readFile(TEST_PATH);

  assert.ok(fs.existsSync(path.join(ROOT, TEST_PATH)), 'companion contract test must exist');
  assert.match(testSource, /Scout Live Integration Test Harness Readiness Audit/i, 'contract must name the readiness audit');
});

test('document states docs/contracts-only scope and single blocker boundary', () => {
  const doc = readDoc();

  requirePhrase(doc, 'This is a docs/contracts-only readiness audit');
  requirePhrase(doc, 'This issue audits only the `live integration test harness` blocker');
  requirePhrase(doc, 'This issue does not implement a live integration test harness');
  requirePhrase(doc, 'This issue does not run live integration tests');
  requirePhrase(doc, 'Closing this issue does not authorize live execution');
  requirePhrase(doc, 'This issue does not close #1882');
  requirePhrase(doc, 'This issue does not authorize live integration test implementation work');
});

test('document keeps the parent and dependency map explicit', () => {
  const doc = readDoc();

  requirePhrase(doc, '#1882 remains open');
  requirePhrase(doc, '#2522 blocker map is the parent blocker inventory');
  requirePhrase(doc, '#2524 already covered `runtime Firebase auth enforcement`');
  requirePhrase(doc, '#2526 already covered `persistent rate-limit storage`');
  requirePhrase(doc, '#2528 already covered `runtime cost/quota monitor`');
  requirePhrase(doc, '#2530 already covered `runtime abuse reporting`');
  requirePhrase(doc, '#2538 already covered `provider-specific real adapter`');
  requirePhrase(doc, '#2557 covers only `live integration test harness`');
});

test('document locks current safe defaults', () => {
  const doc = readDoc();

  requirePhrase(doc, 'Endpoint default remains `stub`');
  requirePhrase(doc, 'Frontend default remains `local_stub`');
  requirePhrase(doc, 'Live endpoint client remains disabled');
  requirePhrase(doc, 'No live integration test execution is enabled');
  requirePhrase(doc, 'No harness is added');
  requirePhrase(doc, 'No live test fetch/network call is added');
  requirePhrase(doc, 'No live test credentials are read');
  requirePhrase(doc, 'No test API key/env secret usage is added');
  requirePhrase(doc, 'No DB/API/schema changes are made');
});

test('document lists future live integration test harness prerequisites', () => {
  const doc = readDoc();
  const prerequisites = [
    'explicit opt-in test harness flag',
    'explicit not-run-by-default policy',
    'test environment allowlist',
    'dedicated test credential source policy',
    'network isolation policy',
    'sandboxed test budget and cost cap',
    'rate-limit storage integration for tests',
    'Firebase auth enforcement for the test runner',
    'provider error taxonomy mapping for test failures',
    'observability/log redaction policy for test runs',
    'kill switch / rollback policy for tests',
    'test data isolation',
    'teardown and cleanup policy',
    'CI workflow gating',
    'timeout policy',
    'retry policy',
    'no frontend secret exposure',
  ];

  for (const prerequisite of prerequisites) {
    requirePhrase(doc, prerequisite, `future prerequisite checklist must include: ${prerequisite}`);
  }
});

test('document lists runtime non-goals', () => {
  const doc = readDoc();
  const nonGoals = [
    'no live integration test execution',
    'no harness implementation',
    'no test fetch/network',
    'no live test credential access',
    'no provider SDK',
    'no prompt construction runtime',
    'no retry runtime',
    'no timeout runtime',
    'no streaming runtime',
    'no model selection runtime',
    'no response parsing runtime',
    'no cost accounting runtime',
    'no endpoint behavior change',
    'no frontend live endpoint enablement',
    'no database/schema changes',
    'no Browse/Search/#1661 work',
  ];

  for (const nonGoal of nonGoals) {
    requirePhrase(doc, nonGoal, `runtime non-goal must include: ${nonGoal}`);
  }
});

test('document recommends smaller future implementation issues first', () => {
  const doc = readDoc();
  const futureIssues = [
    'live integration test harness contract interface',
    'opt-in flag and config validation',
    'test credential deployment checklist',
    'network isolation and sandbox setup',
    'test budget and cost cap policy',
    'only after those are closed, live integration test harness may be implemented',
  ];

  for (const futureIssue of futureIssues) {
    requirePhrase(doc, futureIssue, `future issue recommendation must include: ${futureIssue}`);
  }
});

test('closure policy does not authorize live execution', () => {
  const doc = readDoc();

  requirePhrase(doc, '#2557 may close when this readiness audit document and its companion contract test are merged');
  requirePhrase(doc, 'Closing #2557 does not authorize live integration test execution');
  requirePhrase(doc, '#1882 remains open until the real-live Scout blockers are satisfied or an explicit not-planned decision is made');
});

test('document does not contain executable implementation snippets', () => {
  const doc = readDoc();

  assert.doesNotMatch(doc, /import\s+.*\s+from\s+['"][^'"]*(openai|anthropic|gemini|firebase)[^'"]*['"]/i, 'doc must not add provider/Firebase import snippets');
  assert.doesNotMatch(doc, /require\(['"][^'"]*(openai|anthropic|gemini|firebase)[^'"]*['"]\)/i, 'doc must not add provider/Firebase require snippets');
  assert.doesNotMatch(doc, /\bfetch\s*\(/i, 'doc must not add fetch call snippets');
  assert.doesNotMatch(doc, /XMLHttpRequest|WebSocket|axios\.|got\.|provider\.fetch/i, 'doc must not add network/provider call snippets');
  assert.doesNotMatch(doc, /process\.env\.[A-Z0-9_]*(API|KEY|TOKEN|SECRET)[A-Z0-9_]*/i, 'doc must not reference secret env values');
  assert.doesNotMatch(doc, /CREATE TABLE|ALTER TABLE|DROP TABLE|db\.prepare|schema\.prepare/i, 'doc must not add DB/schema snippets');
  assert.doesNotMatch(doc, /createMemory|saveMemory|submit\s*\(/i, 'doc must not add save/create behavior snippets');
});
