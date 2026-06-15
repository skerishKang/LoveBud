'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const docPath = 'docs/product/lovebud-scout-live-execution-blocker-map.md';

test('document includes all current safe defaults', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /Endpoint default.*stub/i, 'endpoint default must remain stub');
  assert.match(doc, /Frontend default.*local_stub/i, 'frontend default must remain local_stub');
  assert.match(doc, /Endpoint client.*disabled/i, 'endpoint client must be disabled for live execution');
  assert.match(doc, /Provider execution.*no live provider execution/i, 'live provider execution must be disabled');
  assert.match(doc, /Staging\/production live.*no `staging_live` or `production_live` execution/i, 'staging/production live execution must be disabled');
  assert.match(doc, /Browse\/Search.*no #1661/i, 'Browse/Search and #1661 must be excluded');
});

test('document lists all 9 remaining blockers', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  const blockers = [
    'runtime Firebase auth enforcement',
    'persistent rate-limit storage',
    'runtime cost/quota monitor',
    'runtime abuse reporting',
    'provider-specific real adapter',
    'live integration test harness',
    'staging soak',
    'kill-switch drill',
    'credential rotation drill',
  ];

  for (const blocker of blockers) {
    assert.match(doc, new RegExp(blocker, 'i'), `blocker must be listed: ${blocker}`);
  }
});

test('document includes all blocker categories', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /product gate/i, 'product gate category must be documented');
  assert.match(doc, /runtime gate/i, 'runtime gate category must be documented');
  assert.match(doc, /operations gate/i, 'operations gate category must be documented');
  assert.match(doc, /safety\/security gate/i, 'safety/security gate category must be documented');
});

test('safe next slices are recommended without runtime implementation', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /docs-only blocker map/i, 'docs-only blocker map must be the current safe slice');
  assert.match(doc, /runtime Firebase auth implementation issue, later/i, 'Firebase auth implementation must be deferred');
  assert.match(doc, /persistent rate-limit storage issue, later/i, 'rate-limit storage must be deferred');
  assert.match(doc, /cost\/quota monitor issue, later/i, 'cost/quota monitor must be deferred');
  assert.match(doc, /abuse reporting issue, later/i, 'abuse reporting must be deferred');
  assert.match(doc, /provider adapter issue, later/i, 'provider adapter must be deferred');
  assert.match(doc, /live integration harness issue, later/i, 'live integration harness must be deferred');
  assert.match(doc, /staging soak \/ kill-switch \/ credential rotation drill issues, later/i, 'soak and drill issues must be deferred');
});

test('#1882 remain-open policy is explicit', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /#1882.*remains open/i, '#1882 must remain open');
  assert.match(doc, /real-live blockers/i, 'real-live blockers must be the reason #1882 stays open');
  assert.match(doc, /explicit not-planned decision/i, 'not-planned decision must be allowed before closing #1882');
});

test('#2522 closure condition is explicit', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /#2522 may close/i, '#2522 must be closable from blocker map + contract merge');
  assert.match(doc, /companion contract test/i, 'contract test must be required for closure');
  assert.match(doc, /does not authorize live provider execution/i, 'closure must not authorize live provider execution');
});

test('NO-GO guardrails are explicit', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /add runtime\/provider\/network\/Firebase\/storage implementation/i, 'runtime/provider/network/Firebase/storage implementation must be forbidden');
  assert.match(doc, /add external provider calls/i, 'external provider calls must be forbidden');
  assert.match(doc, /change the endpoint default from `stub`/i, 'endpoint default change from stub must be forbidden');
  assert.match(doc, /enable frontend live endpoint execution/i, 'frontend live endpoint enablement must be forbidden');
  assert.match(doc, /add DB\/API\/schema changes/i, 'DB/API/schema changes must be forbidden');
  assert.match(doc, /change Browse\/Search or #1661 behavior/i, 'Browse/Search/#1661 changes must be forbidden');
});

test('document does not contain runtime implementation patterns', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.doesNotMatch(doc, /import\s+.*\s+from\s+['"].*firebase|require\(['"]firebase['"]\)/i, 'must not import Firebase runtime code');
  assert.doesNotMatch(doc, /fetch\(['"]https?:\/\/|axios\.create|got\.post|provider\.suggest|provider\.execute/i, 'must not contain provider/network call patterns');
  assert.doesNotMatch(doc, /CREATE TABLE IF NOT EXISTS|ALTER TABLE ADD COLUMN/i, 'must not contain DB/schema implementation patterns');
});

test('document does not include DB/API/schema/Browse/Search/#1661 implementation scope', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /Database\/schema migration:\s*none/i, 'status must record no DB/schema migration');
  assert.match(doc, /API behavior change:\s*none/i, 'status must record no API behavior change');
  assert.match(doc, /Browse\/Search social-count changes:\s*none/i, 'status must record no Browse/Search changes');
  assert.doesNotMatch(doc, /CREATE TABLE|ALTER TABLE|apiClient\.create|apiClient\.update/i, 'must not contain runtime DB/API implementation patterns');
});
