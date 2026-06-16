'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = 'docs/product/lovebud-scout-credential-rotation-drill-readiness-audit.md';
const TEST_PATH = 'tests/contracts/scout-credential-rotation-drill-readiness-audit-contract.test.cjs';

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
  assert.match(doc, /^# LoveBud Scout Credential Rotation Drill Readiness Audit$/m, 'document title must match exactly');
});

test('companion contract test is present', () => {
  const testSource = readFile(TEST_PATH);

  assert.ok(fs.existsSync(path.join(ROOT, TEST_PATH)), 'companion contract test must exist');
  assert.match(testSource, /Scout Credential Rotation Drill Readiness Audit/i, 'contract must name the readiness audit');
});

test('document states docs/contracts-only scope and single blocker boundary', () => {
  const doc = readDoc();

  requirePhrase(doc, 'This is a docs/contracts-only readiness audit');
  requirePhrase(doc, 'This issue audits only the `credential rotation drill` blocker');
  requirePhrase(doc, 'This issue does not run a credential rotation drill');
  requirePhrase(doc, 'This issue does not implement credential rotation runtime behavior');
  requirePhrase(doc, 'This issue does not create, read, rotate, revoke, or test provider credentials');
  requirePhrase(doc, 'This issue does not enable `staging_live` or `production_live` execution');
  requirePhrase(doc, 'This issue does not enable any live provider execution');
  requirePhrase(doc, 'This issue does not close #1882');
  requirePhrase(doc, 'This issue does not authorize credential rotation drill implementation or operation work');
  requirePhrase(doc, 'This is the final #2522 blocker readiness audit, but closing this issue still does not close #1882 or authorize live execution');
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
  requirePhrase(doc, '#2559 already covered `staging soak` readiness');
  requirePhrase(doc, '#2561 already covered `kill-switch drill` readiness');
  requirePhrase(doc, '#2563 covers only `credential rotation drill`');
  requirePhrase(doc, 'This is the final #2522 blocker readiness audit, but #1882 still remains open');
});

test('document locks current safe defaults', () => {
  const doc = readDoc();

  requirePhrase(doc, 'Endpoint default remains `stub`');
  requirePhrase(doc, 'Frontend default remains `local_stub`');
  requirePhrase(doc, 'Live endpoint client remains disabled');
  requirePhrase(doc, 'No credential rotation drill is run in this slice');
  requirePhrase(doc, 'No provider credentials are read, rotated, created, revoked, or tested in this slice');
  requirePhrase(doc, 'No `staging_live` or `production_live` execution is enabled');
  requirePhrase(doc, 'No live provider execution is enabled');
  requirePhrase(doc, 'No credential API key/env secret usage is added');
  requirePhrase(doc, 'No DB/API/schema changes are made');
  requirePhrase(doc, 'No production traffic is affected by this slice');
  requirePhrase(doc, 'No kill-switch drill is run in this slice');
});

test('document lists future credential rotation drill prerequisites', () => {
  const doc = readDoc();
  const prerequisites = [
    'explicit opt-in credential rotation drill flag',
    'credential-safe',
    'non-default execution',
    'observable',
    'reversible',
    'time-boxed',
    'isolated from production users and data',
    'auditable',
    'explicit credential inventory',
    'explicit rotation owner',
    'explicit secret source',
    'explicit rotation window',
    'explicit rollback/revoke plan',
    'explicit verification signal',
    'explicit audit trail format',
    'explicit operator checklist',
    'explicit incident escalation path',
    'no production data exposure during drill',
    'no frontend secret exposure',
    'approval gate',
    'post-drill retrospective recorded',
  ];

  for (const prerequisite of prerequisites) {
    requirePhrase(doc, prerequisite, `future prerequisite checklist must include: ${prerequisite}`);
  }
});

test('document lists runtime non-goals', () => {
  const doc = readDoc();
  const nonGoals = [
    'no credential rotation drill execution',
    'no credential rotation runtime behavior',
    'no credential creation',
    'no credential reading',
    'no credential rotation',
    'no credential revocation',
    'no credential testing',
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
    'no production traffic impact',
    'no kill-switch drill',
    'no Browse/Search/#1661 work',
  ];

  for (const nonGoal of nonGoals) {
    requirePhrase(doc, nonGoal, `runtime non-goal must include: ${nonGoal}`);
  }
});

test('document recommends smaller future implementation issues first', () => {
  const doc = readDoc();
  const futureIssues = [
    'credential rotation drill contract interface',
    'credential rotation drill deployment checklist',
    'credential rotation drill observability and redaction policy',
    'credential rotation drill operator checklist and incident escalation playbook',
    'credential rotation drill post-drill retrospective template',
    'only after those are closed, a credential rotation drill may be considered',
  ];

  for (const futureIssue of futureIssues) {
    requirePhrase(doc, futureIssue, `future issue recommendation must include: ${futureIssue}`);
  }
});

test('closure policy does not authorize credential rotation or live execution', () => {
  const doc = readDoc();

  requirePhrase(doc, '#2563 may close when this readiness audit document and its companion contract test are merged');
  requirePhrase(doc, 'Closing #2563 does not authorize credential rotation execution, staging_live, production_live, live execution, provider adapter execution, live integration execution, production exposure, or credential usage');
  requirePhrase(doc, '#1882 remains open until the real-live Scout blockers are satisfied or an explicit not-planned decision is made');
  requirePhrase(doc, 'Even though #2563 is the final #2522 blocker readiness audit, closing it does not close #1882');
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
