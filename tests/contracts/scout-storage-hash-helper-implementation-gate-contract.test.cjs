const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docPath = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-scout-storage-hash-helper-implementation-gate.md');

test('Scout storage hash helper implementation gate is documented', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  for (const phrase of [
    '#1882',
    '#2374',
    'Implementation blocked',
    'Rollout checklist reviewed',
    'Namespace version labels reviewed',
    'Rollback guidance reviewed',
    'Environment separation reviewed',
    'Preview/dev isolation reviewed',
    'Frontend secret review complete',
    'Production evidence review complete',
    'No runtime change',
    'No real hashing',
    'No salt or secret access',
    'No KV/DO/D1'
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
