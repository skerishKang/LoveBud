'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const docPath = 'docs/product/lovebud-scout-runtime-firebase-auth-enforcement-readiness-audit.md';

function readDoc() {
  return fs.readFileSync(docPath, 'utf8');
}

test('document names #1882 and #2522 parent context', () => {
  const doc = readDoc();

  assert.match(doc, /#1882/i, 'document must name the Scout MVP umbrella');
  assert.match(doc, /Scout MVP umbrella/i, 'document must describe #1882 as the umbrella');
  assert.match(doc, /#2522/i, 'document must name the parent blocker inventory');
  assert.match(doc, /parent blocker inventory/i, 'document must describe #2522 as the parent blocker inventory');
});

test('#1882 remain-open policy is explicit', () => {
  const doc = readDoc();

  assert.match(doc, /#1882.*remain[s]? open/i, '#1882 must remain open');
  assert.match(doc, /real-live blockers/i, 'remain-open policy must be tied to real-live blockers');
  assert.match(doc, /explicit not-planned decision/i, 'not-planned decision must be the only alternative closure path');
});

test('only runtime Firebase auth enforcement blocker is audited', () => {
  const doc = readDoc();

  assert.match(doc, /Audited blocker:\s*`runtime Firebase auth enforcement`/i, 'audited blocker must be runtime Firebase auth enforcement');
  assert.match(doc, /audits exactly one blocker/i, 'document must lock single-blocker scope');
  assert.match(doc, /covers exactly one blocker:\s*`runtime Firebase auth enforcement`/i, 'single blocker must be named precisely');

  const outOfScopeBlockers = [
    'persistent rate-limit storage',
    'runtime cost/quota monitor',
    'runtime abuse reporting',
    'provider-specific real adapter',
    'live integration test harness',
    'staging soak',
    'kill-switch drill',
    'credential rotation drill',
  ];

  for (const blocker of outOfScopeBlockers) {
    assert.match(doc, new RegExp(`${blocker}.*not implemented, not audited`, 'i'), `${blocker} must remain out of scope`);
  }
});

test('current safe defaults are present', () => {
  const doc = readDoc();

  assert.match(doc, /Endpoint default\s*\|\s*`stub`/i, 'endpoint default must remain stub');
  assert.match(doc, /Frontend default\s*\|\s*`local_stub`/i, 'frontend default must remain local_stub');
  assert.match(doc, /Live endpoint client\s*\|\s*disabled/i, 'live endpoint client must remain disabled');
  assert.match(doc, /Provider execution\s*\|\s*no live provider execution is enabled/i, 'live provider execution must remain disabled');
});

test('readiness audit scope forbids implementation work', () => {
  const doc = readDoc();
  const requiredScopeLines = [
    'docs/contracts-only readiness audit',
    'no runtime Firebase enforcement implementation',
    'no provider adapter implementation',
    'no rate-limit storage implementation',
    'no cost/quota monitor implementation',
    'no abuse reporting implementation',
    'no live integration harness',
    'no staging soak',
    'no kill-switch drill',
    'no credential rotation drill',
  ];

  for (const line of requiredScopeLines) {
    assert.match(doc, new RegExp(line, 'i'), `scope line must be present: ${line}`);
  }
});

test('future implementation prerequisites are present', () => {
  const doc = readDoc();
  const prerequisites = [
    'Request identity must be verified before any live endpoint work begins',
    'Unauthenticated requests must safe-fail',
    'Malformed auth payloads must safe-fail',
    'Disabled verifier config must safe-fail',
    'Missing verifier config must safe-fail',
    'Observability must avoid sensitive data',
    'Test coverage must remain network-free by default',
    'Enabling live execution requires a separate issue and a separate runtime gate',
  ];

  for (const prerequisite of prerequisites) {
    assert.match(doc, new RegExp(prerequisite, 'i'), `future prerequisite must be present: ${prerequisite}`);
  }
});

test('#2524 closure condition is explicit', () => {
  const doc = readDoc();

  assert.match(doc, /#2524 may close when this readiness audit document and its companion contract test are merged/i, '#2524 closure condition must be locked');
});

test('closure does not authorize live provider execution', () => {
  const doc = readDoc();

  assert.match(doc, /Closing #2524 does not authorize live provider execution/i, 'closure must not authorize live provider execution');
  assert.match(doc, /does not authorize provider adapter execution/i, 'closure must not authorize provider adapter execution');
  assert.match(doc, /does not authorize.*network calls/i, 'closure must not authorize network calls');
  assert.match(doc, /does not authorize.*frontend live endpoint enablement/i, 'closure must not authorize frontend live endpoint enablement');
  assert.match(doc, /does not authorize.*endpoint default changes/i, 'closure must not authorize endpoint default changes');
});

test('NO-GO guardrails are explicit', () => {
  const doc = readDoc();
  const guardrails = [
    'add runtime/provider/network/Firebase/storage implementation',
    'add live provider calls',
    'change the endpoint default from `stub`',
    'enable frontend live endpoint execution',
    'add DB/API/schema changes',
    'change Browse/Search or #1661 behavior',
  ];

  for (const guardrail of guardrails) {
    assert.match(doc, new RegExp(guardrail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `NO-GO guardrail must be present: ${guardrail}`);
  }
});

test('document does not contain runtime implementation patterns', () => {
  const doc = readDoc();

  assert.doesNotMatch(doc, /import\s+.*\s+from\s+['"].*firebase|require\(['"].*firebase/i, 'must not import Firebase runtime code');
  assert.doesNotMatch(doc, /\bfetch\s*\(|axios\.|got\.|https?:\/\//i, 'must not contain network call patterns or raw URLs');
  assert.doesNotMatch(doc, /CREATE TABLE|ALTER TABLE|DROP TABLE|db\.prepare|schema\.prepare/i, 'must not contain DB/schema mutation patterns');
  assert.doesNotMatch(doc, /provider\.(execute|suggest|complete|generate)|executeProvider|callProvider/i, 'must not contain provider execution patterns');
  assert.doesNotMatch(doc, /Endpoint default\s*\|\s*`?(live|staging_live|production_live|provider_live)`?/i, 'must not change endpoint default to live');
  assert.doesNotMatch(doc, /Frontend default\s*\|\s*`?(live|staging_live|production_live|provider_live)`?/i, 'must not change frontend default to live');
});
