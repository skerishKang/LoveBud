const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docPath = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-scout-storage-hash-helper-rollout-checklist.md');

test('Scout storage hash helper rollout checklist is documented', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  for (const phrase of [
    '#1882',
    '#2372',
    'Blocked before implementation',
    'Namespace version labels reviewed',
    'Rollback guidance reviewed',
    'Staging and production separation reviewed',
    'Preview/dev isolation reviewed',
    'Frontend secret non-exposure reviewed',
    'Production evidence reviewed',
    'No runtime change',
    'No real hashing',
    'No salt or secret access',
    'No KV/DO/D1'
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
