'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = 'docs/product/lovebud-scout-staging-soak-readiness-audit.md';
const TEST_PATH = 'tests/contracts/scout-staging-soak-readiness-audit-contract.test.cjs';

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
  assert.match(doc, /^# LoveBud Scout Staging Soak Readiness Audit$/m, 'document title must match exactly');
});

test('companion contract test is present', () => {
  const testSource = readFile(TEST_PATH);

  assert.ok(fs.existsSync(path.join(ROOT, TEST_PATH)), 'companion contract test must exist');
  assert.match(testSource, /Scout Staging Soak Readiness Audit/i, 'contract must name the readiness audit');
});

test('document states docs/contracts-only scope and single blocker boundary', () => {
  const doc = readDoc();

  requirePhrase(doc, 'This is a docs/contracts-only readiness audit');
  requirePhrase(doc, 'This issue audits only the `staging soak` blocker');
  requirePhrase(doc, 'This issue does not run a staging soak');
  requirePhrase(doc, 'This issue does not enable `staging_live` or `production_live` execution');
  requirePhrase(doc, 'This issue does not enable any live provider execution');
  requirePhrase(doc, 'This issue does not close #1882');
  requirePhrase(doc, 'This issue does not authorize staging soak implementation or operation work');
});

test('document keeps the parent and dependency map explicit', () => {
  const doc = readDoc();

  requirePhrase(doc, '#1882 remains open');
  requirePhrase(doc, '#2522 blocker map is the parent blocker inventory');
  requirePhrase(doc, '#2524 already covered `runtime Firebase auth enforcement` readiness');
  requirePhrase(doc, '#2526 already covered `persistent rate-limit storage` readiness');
  requirePhrase(doc, '#2528 already covered `runtime cost/quota monitor` readiness');
  requirePhrase(doc, '#2530 already covered `runtime abuse reporting` readiness');
  requirePhrase(doc, '#2538 already covered `provider-specific real adapter` readiness');
  requirePhrase(doc, '#2557 already covered `live integration test harness` readiness');
  requirePhrase(doc, '#2559 covers only `staging soak`');
  requirePhrase(doc, 'kill-switch drill');
  requirePhrase(doc, 'credential rotation drill');
});

test('document locks current safe defaults', () => {
  const doc = readDoc();

  requirePhrase(doc, 'Endpoint default remains `stub`');
  requirePhrase(doc, 'Frontend default remains `local_stub`');
  requirePhrase(doc, 'Live endpoint client remains disabled');
  requirePhrase(doc, 'No staging soak is run in this slice');
  requirePhrase(doc, 'No `staging_live` or `production_live` execution is enabled');
  requirePhrase(doc, 'No live provider execution is enabled');
  requirePhrase(doc, 'No staging credentials are read');
  requirePhrase(doc, 'No staging API key/env secret usage is added');
  requirePhrase(doc, 'No DB/API/schema changes are made');
  requirePhrase(doc, 'No staging traffic is mirrored from production');
});

test('document lists future staging soak prerequisites', () => {
  const doc = readDoc();
  const prerequisites = [
    'explicit opt-in staging soak flag',
    'credential-safe',
    'non-default execution',
    'observable',
    'reversible',
    'isolated from production users and data',
    'explicit entry criteria',
    'explicit exit criteria',
    'explicit rollback criteria',
    'monitoring checklist',
    'abuse / cost / quota watch',
    'incident escalation path',
    'audit trail',
    'no production data exposure',
    'no frontend secret exposure',
    'time-boxed',
    'approval gate',
  ];

  for (const prerequisite of prerequisites) {
    requirePhrase(doc, prerequisite, `future prerequisite checklist must include: ${prerequisite}`);
  }
});

test('document lists runtime non-goals', () => {
  const doc = readDoc();
  const nonGoals = [
    'no staging soak execution',
    'no `staging_live` execution',
    'no `production_live` execution',
    'no live provider execution',
    'no provider SDK',
    'no fetch/network',
    'no prompt construction runtime',
    'no retry runtime',
    'no timeout runtime',
    'no streaming runtime',
    'no model selection runtime',
    'no response parsing runtime',
    'no cost accounting runtime',
    'no credential access',
    'no endpoint behavior change',
    'no frontend live endpoint enablement',
    'no database/schema changes',
    'no production traffic mirroring',
    'no kill-switch drill',
    'no credential rotation drill',
    'no Browse/Search/#1661 work',
  ];

  for (const nonGoal of nonGoals) {
    requirePhrase(doc, nonGoal, `runtime non-goal must include: ${nonGoal}`);
  }
});

test('document recommends smaller future implementation issues first', () => {
  const doc = readDoc();
  const futureIssues = [
    'staging soak contract interface',
    'staging credential deployment checklist',
    'staging observability and redaction policy',
    'staging cost/quota/abuse watch',
    'staging incident escalation playbook',
    'only after those are closed, a staging soak may be considered',
  ];

  for (const futureIssue of futureIssues) {
    requirePhrase(doc, futureIssue, `future issue recommendation must include: ${futureIssue}`);
  }
});

test('closure policy does not authorize live or staging execution', () => {
  const doc = readDoc();

  requirePhrase(doc, '#2559 may close when this readiness audit document and its companion contract test are merged');
  requirePhrase(doc, 'Closing #2559 does not authorize staging_live, production_live, live execution, provider adapter execution, live integration execution, production exposure, or credential usage');
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
