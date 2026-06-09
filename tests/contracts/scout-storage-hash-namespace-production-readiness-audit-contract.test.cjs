const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docPath = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-scout-storage-hash-namespace-production-readiness-audit.md');

test('Scout storage hash namespace production readiness audit is documented', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  for (const phrase of [
    '#1882',
    '#2370',
    'Not ready for production hash use',
    'Explicit namespace version labels',
    'Staging and production namespace separation',
    'Preview/dev namespace isolation',
    'Rollback guidance',
    'Frontend secret non-exposure review',
    'No runtime change',
    'No real hashing',
    'No salt or secret access',
    'No KV/DO/D1'
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
