const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docPath = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-scout-storage-hash-helper-docs-index-audit-summary.md');

test('Scout storage hash helper docs index audit summary is documented', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  for (const phrase of [
    '#1882',
    '#2380',
    'Implementation remains blocked',
    'lovebud-scout-storage-hash-namespace-production-readiness-audit.md',
    'lovebud-scout-storage-hash-helper-rollout-checklist.md',
    'lovebud-scout-storage-hash-helper-implementation-gate.md',
    'lovebud-scout-storage-hash-helper-threat-model-note.md',
    'lovebud-scout-storage-hash-helper-implementation-preflight-checklist.md',
    'Readiness must be reviewed',
    'Rollout must be reviewed',
    'Implementation gate must be reviewed',
    'Threat model must be reviewed',
    'Preflight checklist must pass',
    'No runtime change',
    'No real hashing',
    'No salt or secret access',
    'No KV/DO/D1'
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
