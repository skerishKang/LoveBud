const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docPath = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-scout-storage-hash-helper-implementation-go-no-go-summary.md');

test('Scout storage hash helper implementation go/no-go summary is documented', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  for (const phrase of [
    '#1882',
    '#2394',
    'No runtime change',
    'No-go for runtime storage hashing',
    'conditional go only for disabled-by-default docs/tests',
    'Endpoint default remains `stub`',
    'Frontend default remains `local_stub`',
    'Storage hash helper remains disabled by default',
    'No real hashing is added in this summary',
    'No salt, secret, or hash internals are exposed',
    'No KV / Durable Object / D1 storage call is introduced',
    'No endpoint wiring change is introduced',
    'No frontend default source change is introduced',
    'No provider integration is introduced',
    'Browse #1661 work remains out of scope',
    'Docs/tests-only summary',
    'Disabled-by-default scaffold',
    'Real storage hash implementation',
    'KV / Durable Object / D1 integration',
    'Endpoint default change',
    'Frontend default source change',
    'Provider integration change',
    'Production rollout',
    'lovebud-scout-storage-hash-helper-readiness-audit.md',
    'lovebud-scout-storage-hash-helper-rollout-checklist.md',
    'lovebud-scout-storage-hash-helper-implementation-gate.md',
    'lovebud-scout-storage-hash-helper-threat-model-note.md',
    'lovebud-scout-storage-hash-helper-implementation-preflight-checklist.md',
    'lovebud-scout-storage-hash-helper-implementation-approval-matrix.md',
    'lovebud-scout-storage-hash-helper-implementation-reviewer-checklist.md',
    'lovebud-scout-storage-hash-helper-implementation-handoff-checklist.md',
    'lovebud-scout-storage-hash-helper-implementation-pr-template-note.md',
    'Confirm no secret, salt, or hash internals are exposed',
    'Confirm no import-time side effects',
    'Confirm no endpoint or frontend default change',
    'Confirm no KV / Durable Object / D1 implementation',
    'Confirm no provider integration',
    'Confirm rollback evidence is present',
    'Confirm test evidence is present',
    'disabled-by-default, mock-only, docs/tests-backed boundary'
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
