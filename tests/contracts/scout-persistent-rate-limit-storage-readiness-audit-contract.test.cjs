'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const docPath = 'docs/product/lovebud-scout-persistent-rate-limit-storage-readiness-audit.md';

function readDoc() {
  return fs.readFileSync(docPath, 'utf8');
}

test('document names #1882, #2522, #2524, and #2526 context', () => {
  const doc = readDoc();

  assert.match(doc, /#1882/i, 'document must name the Scout MVP umbrella');
  assert.match(doc, /Scout MVP umbrella/i, 'document must describe #1882 as the umbrella');
  assert.match(doc, /#2522/i, 'document must name the parent blocker inventory');
  assert.match(doc, /parent blocker inventory/i, 'document must describe #2522 as the parent blocker inventory');
  assert.match(doc, /#2524/i, 'document must name the prior Firebase auth readiness audit');
  assert.match(doc, /#2526/i, 'document must name this readiness audit');
});

test('#1882 remain-open policy is explicit', () => {
  const doc = readDoc();

  assert.match(doc, /#1882.*remain[s]? open/i, '#1882 must remain open');
  assert.match(doc, /real-live blockers/i, 'remain-open policy must be tied to real-live blockers');
  assert.match(doc, /explicit not-planned decision/i, 'not-planned decision must be the only alternative closure path');
});

test('#2524 is not reopened', () => {
  const doc = readDoc();

  assert.match(doc, /#2524 already audited/i, '#2524 must be treated as prior completed audit');
  assert.match(doc, /does not reopen #2524/i, '#2526 must not reopen #2524');
  assert.match(doc, /runtime Firebase auth enforcement.*already audited by #2524, not reopened/i, 'Firebase auth blocker must remain not reopened');
});

test('only persistent rate-limit storage blocker is audited', () => {
  const doc = readDoc();

  assert.match(doc, /Audited blocker:\s*`persistent rate-limit storage`/i, 'audited blocker must be persistent rate-limit storage');
  assert.match(doc, /audits exactly one blocker/i, 'document must lock single-blocker scope');
  assert.match(doc, /covers exactly one blocker:\s*`persistent rate-limit storage`/i, 'single blocker must be named precisely');

  const outOfScopeBlockers = [
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
  assert.match(doc, /Persistent storage execution\s*\|\s*no durable runtime storage execution is enabled/i, 'durable runtime storage execution must remain disabled');
});

test('readiness audit scope forbids storage implementation work', () => {
  const doc = readDoc();
  const requiredScopeLines = [
    'docs/contracts-only readiness audit',
    'no persistent rate-limit storage implementation',
    'no KV binding implementation',
    'no Durable Object implementation',
    'no D1 implementation',
    'no SQL/database/schema implementation',
    'no storage binding behavior',
    'no runtime Firebase enforcement implementation',
    'no provider adapter implementation',
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
    'The storage backend must be explicitly selected and documented',
    'The storage key format must avoid raw tokens',
    'Disabled storage configuration must safe-fail',
    'Missing storage configuration must safe-fail',
    'Storage read failures must safe-fail',
    'Storage write failures must safe-fail',
    'Storage quota or capacity failures must safe-fail',
    'Rate-limit state must survive serverless restarts',
    'Test coverage must remain network-free by default',
    'Enabling durable storage execution requires a separate runtime issue and a separate runtime gate',
  ];

  for (const prerequisite of prerequisites) {
    assert.match(doc, new RegExp(prerequisite, 'i'), `future prerequisite must be present: ${prerequisite}`);
  }
});

test('#2526 closure condition is explicit', () => {
  const doc = readDoc();

  assert.match(doc, /#2526 may close when this readiness audit document and its companion contract test are merged/i, '#2526 closure condition must be locked');
});

test('closure does not authorize live execution or durable runtime storage', () => {
  const doc = readDoc();

  assert.match(doc, /Closing #2526 does not authorize live provider execution/i, 'closure must not authorize live provider execution');
  assert.match(doc, /It does not authorize durable runtime storage execution/i, 'closure must not authorize durable runtime storage execution');
  assert.match(doc, /KV execution/i, 'closure must not authorize KV execution');
  assert.match(doc, /Durable Object execution/i, 'closure must not authorize Durable Object execution');
  assert.match(doc, /D1 execution/i, 'closure must not authorize D1 execution');
  assert.match(doc, /SQL execution/i, 'closure must not authorize SQL execution');
  assert.match(doc, /does not authorize.*network calls/i, 'closure must not authorize network calls');
  assert.match(doc, /does not authorize.*frontend live endpoint enablement/i, 'closure must not authorize frontend live endpoint enablement');
  assert.match(doc, /does not authorize.*endpoint default changes/i, 'closure must not authorize endpoint default changes');
});

test('NO-GO guardrails are explicit', () => {
  const doc = readDoc();
  const guardrails = [
    'add runtime/provider/network/Firebase/storage implementation',
    'add KV, Durable Object, D1, SQL, database, schema, or storage binding behavior',
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

test('document does not contain runtime storage implementation patterns', () => {
  const doc = readDoc();

  assert.doesNotMatch(doc, /import\s+.*\s+from\s+['"].*firebase|require\(['"].*firebase/i, 'must not import Firebase runtime code');
  assert.doesNotMatch(doc, /\bfetch\s*\(|axios\.|got\.|https?:\/\//i, 'must not contain network call patterns or raw URLs');
  assert.doesNotMatch(doc, /CREATE TABLE|ALTER TABLE|DROP TABLE|db\.prepare|schema\.prepare/i, 'must not contain DB/schema mutation patterns');
  assert.doesNotMatch(doc, /\benv\.[A-Z0-9_]*(KV|D1|DO|DURABLE|STORAGE)[A-Z0-9_]*\b/i, 'must not reference concrete storage bindings');
  assert.doesNotMatch(doc, /provider\.(execute|suggest|complete|generate)|executeProvider|callProvider/i, 'must not contain provider execution patterns');
  assert.doesNotMatch(doc, /Endpoint default\s*\|\s*`?(live|staging_live|production_live|provider_live)`?/i, 'must not change endpoint default to live');
  assert.doesNotMatch(doc, /Frontend default\s*\|\s*`?(live|staging_live|production_live|provider_live)`?/i, 'must not change frontend default to live');
});
