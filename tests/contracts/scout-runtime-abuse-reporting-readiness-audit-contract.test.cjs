'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const docPath = 'docs/product/lovebud-scout-runtime-abuse-reporting-readiness-audit.md';

function readDoc() {
  return fs.readFileSync(docPath, 'utf8');
}

function escapedPattern(text) {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

test('document names #1882, #2522, #2524, #2526, #2528, and #2530 context', () => {
  const doc = readDoc();

  assert.match(doc, /#1882/i, 'document must name the Scout MVP umbrella');
  assert.match(doc, /Scout MVP umbrella/i, 'document must describe #1882 as the umbrella');
  assert.match(doc, /#2522/i, 'document must name the parent blocker inventory');
  assert.match(doc, /parent blocker inventory/i, 'document must describe #2522 as the parent blocker inventory');
  assert.match(doc, /#2524/i, 'document must name the prior Firebase auth readiness audit');
  assert.match(doc, /#2526/i, 'document must name the prior rate-limit storage readiness audit');
  assert.match(doc, /#2528/i, 'document must name the prior cost/quota monitor readiness audit');
  assert.match(doc, /#2530/i, 'document must name this readiness audit');
});

test('#1882 remain-open policy is explicit', () => {
  const doc = readDoc();

  assert.match(doc, /#1882.*remain[s]? open/i, '#1882 must remain open');
  assert.match(doc, /real-live blockers/i, 'remain-open policy must be tied to real-live blockers');
  assert.match(doc, /explicit not-planned decision/i, 'not-planned decision must be the only alternative closure path');
});

test('#2524, #2526, and #2528 are not reopened', () => {
  const doc = readDoc();

  assert.match(doc, /#2524 already audited/i, '#2524 must be treated as prior completed audit');
  assert.match(doc, /does not reopen #2524/i, '#2530 must not reopen #2524');
  assert.match(doc, /runtime Firebase auth enforcement.*already audited by #2524, not reopened/i, 'Firebase auth blocker must remain not reopened');

  assert.match(doc, /#2526 already audited/i, '#2526 must be treated as prior completed audit');
  assert.match(doc, /does not reopen #2526/i, '#2530 must not reopen #2526');
  assert.match(doc, /persistent rate-limit storage.*already audited by #2526, not reopened/i, 'rate-limit storage blocker must remain not reopened');

  assert.match(doc, /#2528 already audited/i, '#2528 must be treated as prior completed audit');
  assert.match(doc, /does not reopen #2528/i, '#2530 must not reopen #2528');
  assert.match(doc, /runtime cost\/quota monitor.*already audited by #2528, not reopened/i, 'cost/quota monitor blocker must remain not reopened');
});

test('only runtime abuse reporting blocker is audited', () => {
  const doc = readDoc();

  assert.match(doc, /Audited blocker:\s*`runtime abuse reporting`/i, 'audited blocker must be runtime abuse reporting');
  assert.match(doc, /audits exactly one blocker/i, 'document must lock single-blocker scope');
  assert.match(doc, /covers exactly one blocker:\s*`runtime abuse reporting`/i, 'single blocker must be named precisely');

  const outOfScopeBlockers = [
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
  assert.match(doc, /Runtime reporting execution\s*\|\s*no runtime abuse reporting execution is enabled/i, 'runtime abuse reporting execution must remain disabled');
  assert.match(doc, /Incident submission\s*\|\s*no incident submission runtime behavior is enabled/i, 'incident submission must remain disabled');
  assert.match(doc, /Notifications\s*\|\s*no notification runtime behavior is enabled/i, 'notification behavior must remain disabled');
  assert.match(doc, /Ticket\/metric writes\s*\|\s*no ticket or live usage metric write behavior is enabled/i, 'ticket/metric writes must remain disabled');
});

test('readiness audit scope forbids reporting implementation work', () => {
  const doc = readDoc();
  const requiredScopeLines = [
    'docs/contracts-only readiness audit',
    'no runtime abuse reporting implementation',
    'no incident submission implementation',
    'no notification implementation',
    'no dashboard implementation',
    'no ticket implementation',
    'no metric write implementation',
    'no runtime Firebase enforcement implementation',
    'no persistent rate-limit storage implementation',
    'no runtime cost/quota monitor implementation',
    'no provider adapter implementation',
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
    'The reportable event categories must be explicitly defined and documented',
    'The reporting path owner and review responsibility must be explicitly defined and documented',
    'The report payload shape must avoid raw tokens',
    'The report payload must avoid storing full user prompts',
    'Disabled reporting configuration must safe-fail',
    'Missing reporting configuration must safe-fail',
    'Reporting write failures must safe-fail',
    'Notification failures must safe-fail',
    'Reporting must distinguish misuse, quota pressure, provider error pressure, and operational incidents',
    'Test coverage must remain network-free by default',
    'Enabling runtime abuse reporting execution requires a separate runtime issue and a separate runtime gate',
  ];

  for (const prerequisite of prerequisites) {
    assert.match(doc, new RegExp(prerequisite, 'i'), `future prerequisite must be present: ${prerequisite}`);
  }
});

test('#2530 closure condition is explicit', () => {
  const doc = readDoc();

  assert.match(doc, /#2530 may close when this readiness audit document and its companion contract test are merged/i, '#2530 closure condition must be locked');
});

test('closure does not authorize live execution or runtime reporting execution', () => {
  const doc = readDoc();

  assert.match(doc, /Closing #2530 does not authorize live provider execution/i, 'closure must not authorize live provider execution');
  assert.match(doc, /It does not authorize runtime abuse reporting execution/i, 'closure must not authorize runtime abuse reporting execution');
  assert.match(doc, /incident submission execution/i, 'closure must not authorize incident submission execution');
  assert.match(doc, /notification execution/i, 'closure must not authorize notification execution');
  assert.match(doc, /dashboard execution/i, 'closure must not authorize dashboard execution');
  assert.match(doc, /ticket execution/i, 'closure must not authorize ticket execution');
  assert.match(doc, /metric write execution/i, 'closure must not authorize metric write execution');
  assert.match(doc, /does not authorize.*network calls/i, 'closure must not authorize network calls');
  assert.match(doc, /does not authorize.*frontend live endpoint enablement/i, 'closure must not authorize frontend live endpoint enablement');
  assert.match(doc, /does not authorize.*endpoint default changes/i, 'closure must not authorize endpoint default changes');
});

test('NO-GO guardrails are explicit', () => {
  const doc = readDoc();
  const guardrails = [
    'add runtime/provider/network/Firebase/storage implementation',
    'add runtime abuse reporting implementation',
    'add incident submission or notification runtime behavior',
    'add dashboard, ticket, or metric write behavior',
    'add live provider calls',
    'change the endpoint default from `stub`',
    'enable frontend live endpoint execution',
    'add DB/API/schema changes',
    'change Browse/Search or #1661 behavior',
  ];

  for (const guardrail of guardrails) {
    assert.match(doc, escapedPattern(guardrail), `NO-GO guardrail must be present: ${guardrail}`);
  }
});

test('document does not contain runtime reporting implementation patterns', () => {
  const doc = readDoc();

  assert.doesNotMatch(doc, /import\s+.*\s+from\s+['"].*firebase|require\(['"].*firebase/i, 'must not import Firebase runtime code');
  assert.doesNotMatch(doc, /\bfetch\s*\(|axios\.|got\.|https?:\/\//i, 'must not contain network call patterns or raw URLs');
  assert.doesNotMatch(doc, /CREATE TABLE|ALTER TABLE|DROP TABLE|db\.prepare|schema\.prepare/i, 'must not contain DB/schema mutation patterns');
  assert.doesNotMatch(doc, /\benv\.[A-Z0-9_]*(KV|D1|DO|DURABLE|STORAGE|TICKET|METRIC|NOTIFY|REPORT)[A-Z0-9_]*\b/i, 'must not reference concrete runtime bindings');
  assert.doesNotMatch(doc, /provider\.(execute|suggest|complete|generate)|executeProvider|callProvider/i, 'must not contain provider execution patterns');
  assert.doesNotMatch(doc, /submitIncident|sendNotification|createTicket|writeMetric|emitMetric|recordReport|postReport|reportAbuse/i, 'must not contain runtime reporting function patterns');
  assert.doesNotMatch(doc, /Endpoint default\s*\|\s*`?(live|staging_live|production_live|provider_live)`?/i, 'must not change endpoint default to live');
  assert.doesNotMatch(doc, /Frontend default\s*\|\s*`?(live|staging_live|production_live|provider_live)`?/i, 'must not change frontend default to live');
});
