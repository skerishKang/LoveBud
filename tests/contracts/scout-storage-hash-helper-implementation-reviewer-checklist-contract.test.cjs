const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docPath = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-scout-storage-hash-helper-implementation-reviewer-checklist.md');

test('Scout storage hash helper implementation reviewer checklist is documented', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  for (const phrase of [
    '#1882',
    '#2389',
    'Future implementation PRs must satisfy this reviewer checklist',
    'Linked planning docs are cited',
    'Gate evidence checklist is present',
    'Handoff checklist is cited',
    'PR template note is followed',
    'Disabled-by-default behavior is preserved',
    'No secret, salt, or hash internals are exposed',
    'Frontend defaults remain unchanged',
    'Endpoint defaults remain unchanged',
    'Provider integration remains unchanged',
    'Rollback statement is present',
    'Test evidence is present',
    'Production evidence review is present',
    'Block if the handoff checklist is skipped',
    'Block if the PR template note is skipped',
    'Block if implementation is enabled by default',
    'Block if any secret, salt, or hash internals are exposed',
    'Block if frontend defaults change without explicit approval',
    'Block if endpoint defaults change without explicit approval',
    'Block if provider integration changes without explicit approval',
    'No runtime change',
    'No real hashing',
    'No salt or secret access',
    'No KV/DO/D1'
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
