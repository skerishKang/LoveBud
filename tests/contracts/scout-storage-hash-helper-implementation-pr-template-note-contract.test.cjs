const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docPath = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-scout-storage-hash-helper-implementation-pr-template-note.md');

test('Scout storage hash helper implementation PR template note is documented', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  for (const phrase of [
    '#1882',
    '#2387',
    'Future implementation PRs must include these sections',
    'Linked planning docs',
    'Gate evidence checklist',
    'Secret exposure review',
    'Frontend exposure review',
    'Rollback statement',
    'Disabled-by-default confirmation',
    'Test evidence',
    'Production evidence review',
    'lovebud-scout-runtime-rate-limit-storage-implementation-plan.md',
    'lovebud-scout-storage-hash-helper-implementation-handoff-checklist.md',
    'lovebud-scout-storage-hash-helper-docs-index-audit-summary.md',
    'lovebud-scout-storage-hash-helper-parent-index-update.md',
    'lovebud-scout-storage-hash-helper-implementation-preflight-checklist.md',
    'Confirm no secret, salt, or hash internals are exposed',
    'Confirm frontend defaults remain unchanged',
    'Confirm endpoint defaults remain unchanged',
    'Confirm provider integration remains unchanged',
    'Confirm implementation is disabled by default until explicit gate approval',
    'No runtime change',
    'No real hashing',
    'No salt or secret access',
    'No KV/DO/D1'
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
