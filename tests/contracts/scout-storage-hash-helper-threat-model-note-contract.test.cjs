const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docPath = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-scout-storage-hash-helper-threat-model-note.md');

test('Scout storage hash helper threat model note is documented', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  for (const phrase of [
    '#1882',
    '#2376',
    'Pre-implementation note only',
    'Salt exposure',
    'Namespace secret exposure',
    'Hash key exposure',
    'Environment namespace confusion',
    'Preview/dev promotion to production',
    'Rollback to the wrong namespace version',
    'Frontend exposure of secrets or hash internals',
    'No runtime change',
    'No real hashing',
    'No salt or secret access',
    'No KV/DO/D1'
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
