'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = 'docs/product/lovebud-scout-provider-real-adapter-readiness-audit.md';
const TEST_PATH = 'tests/contracts/scout-provider-real-adapter-readiness-audit-contract.test.cjs';

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
  assert.match(doc, /^# LoveBud Scout Provider Real Adapter Readiness Audit$/m, 'document title must match exactly');
});

test('companion contract test is present', () => {
  const testSource = readFile(TEST_PATH);

  assert.ok(fs.existsSync(path.join(ROOT, TEST_PATH)), 'companion contract test must exist');
  assert.match(testSource, /Scout Provider Real Adapter Readiness Audit/i, 'contract must name the readiness audit');
});

test('document states docs/contracts-only scope and single blocker boundary', () => {
  const doc = readDoc();

  requirePhrase(doc, 'This is a docs/contracts-only readiness audit');
  requirePhrase(doc, 'This issue audits only the `provider-specific real adapter` blocker');
  requirePhrase(doc, 'This issue does not implement a provider adapter');
  requirePhrase(doc, 'Closing this issue does not authorize live execution');
  requirePhrase(doc, 'This issue does not close #1882');
  requirePhrase(doc, 'This issue does not authorize provider-specific implementation work');
});

test('document keeps the parent and dependency map explicit', () => {
  const doc = readDoc();

  requirePhrase(doc, '#1882 remains open');
  requirePhrase(doc, '#2522 blocker map is the parent blocker inventory');
  requirePhrase(doc, '#2524 already covered `runtime Firebase auth enforcement`');
  requirePhrase(doc, '#2526 already covered `persistent rate-limit storage`');
  requirePhrase(doc, '#2528 already covered `runtime cost/quota monitor`');
  requirePhrase(doc, '#2530 already covered `runtime abuse reporting`');
  requirePhrase(doc, '#2538 covers only `provider-specific real adapter`');
});

test('document locks current safe defaults', () => {
  const doc = readDoc();

  requirePhrase(doc, 'Endpoint default remains `stub`');
  requirePhrase(doc, 'Frontend default remains `local_stub`');
  requirePhrase(doc, 'Live endpoint client remains disabled');
  requirePhrase(doc, 'No live provider execution is enabled');
  requirePhrase(doc, 'No provider SDK is added');
  requirePhrase(doc, 'No fetch/network call is added');
  requirePhrase(doc, 'No provider credentials are read');
  requirePhrase(doc, 'No API key/env secret usage is added');
  requirePhrase(doc, 'No DB/API/schema changes are made');
});

test('document lists future provider adapter prerequisites', () => {
  const doc = readDoc();
  const prerequisites = [
    'explicit provider mode gate',
    'provider selection allowlist',
    'provider credential source policy',
    'timeout policy',
    'retry policy',
    'streaming policy or explicit no-streaming policy',
    'prompt construction policy',
    'response parsing policy',
    'provider error taxonomy',
    'quota/cost accounting integration',
    'abuse reporting integration',
    'rate-limit storage dependency',
    'Firebase auth enforcement dependency',
    'observability/log redaction policy',
    'kill switch / rollback policy',
    'test strategy with network-free unit tests and opt-in integration tests only',
    'no frontend secret exposure',
  ];

  for (const prerequisite of prerequisites) {
    requirePhrase(doc, prerequisite, `future prerequisite checklist must include: ${prerequisite}`);
  }
});

test('document lists runtime non-goals', () => {
  const doc = readDoc();
  const nonGoals = [
    'no provider adapter implementation',
    'no provider SDK',
    'no fetch/network',
    'no prompt construction runtime',
    'no retry runtime',
    'no timeout runtime',
    'no streaming runtime',
    'no model selection runtime',
    'no response parsing runtime',
    'no credential access',
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
    'provider adapter contract interface',
    'provider mode gate and config validation',
    'provider error taxonomy mapping',
    'provider secret deployment checklist',
    'opt-in integration test harness',
    'Only after those are closed, provider-specific implementation may be considered',
  ];

  for (const futureIssue of futureIssues) {
    requirePhrase(doc, futureIssue, `future issue recommendation must include: ${futureIssue}`);
  }
});

test('closure policy does not authorize live execution', () => {
  const doc = readDoc();

  requirePhrase(doc, '#2538 may close when this readiness audit document and its companion contract test are merged');
  requirePhrase(doc, 'Closing #2538 does not authorize live execution');
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
