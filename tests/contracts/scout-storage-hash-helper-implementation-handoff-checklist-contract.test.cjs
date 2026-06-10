const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docPath = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-scout-storage-hash-helper-implementation-handoff-checklist.md');

test('Scout storage hash helper implementation handoff checklist is documented', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  for (const phrase of [
    '#1882',
    '#2384',
    'Future implementation PRs must cite this checklist',
    'lovebud-scout-runtime-rate-limit-storage-implementation-plan.md',
    'lovebud-scout-storage-hash-helper-docs-index-audit-summary.md',
    'lovebud-scout-storage-hash-helper-parent-index-update.md',
    'lovebud-scout-storage-hash-namespace-production-readiness-audit.md',
    'lovebud-scout-storage-hash-helper-rollout-checklist.md',
    'lovebud-scout-storage-hash-helper-implementation-gate.md',
    'lovebud-scout-storage-hash-helper-threat-model-note.md',
    'lovebud-scout-storage-hash-helper-implementation-preflight-checklist.md',
    'Confirm readiness audit reviewed',
    'Confirm rollout checklist reviewed',
    'Confirm implementation gate reviewed',
    'Confirm threat model note reviewed',
    'Confirm preflight checklist passed',
    'Confirm implementation remains blocked unless all gates pass',
    'Confirm no secret, salt, or hash internals are exposed in frontend, logs, errors, or responses',
    'No runtime change',
    'No real hashing',
    'No salt or secret access',
    'No KV/DO/D1'
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
