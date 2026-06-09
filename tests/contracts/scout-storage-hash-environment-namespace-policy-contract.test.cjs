const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docPath = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-scout-storage-hash-environment-namespace-policy.md');

test('Scout storage hash environment namespace policy is documented', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  for (const phrase of [
    '#1882',
    '#2365',
    'Staging',
    'production',
    'separate namespaces',
    'version label',
    'Frontend',
    'No runtime change',
    'No real hashing',
    'No salt or secret access',
    'No KV/DO/D1'
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
