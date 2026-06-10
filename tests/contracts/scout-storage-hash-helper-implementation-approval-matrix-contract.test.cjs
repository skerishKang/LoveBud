const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docPath = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-scout-storage-hash-helper-implementation-approval-matrix.md');

test('Scout storage hash helper implementation approval matrix is documented', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  for (const phrase of [
    '#1882',
    '#2391',
    'Future implementation PRs must satisfy this approval matrix before merge',
    'Product approval',
    'Engineering approval',
    'Security/privacy approval',
    'Operations/deployment approval',
    'Test evidence approval',
    'user-facing behavior remains suggestion-only',
    'no automatic save is introduced',
    'disabled-by-default behavior and no import-time side effects',
    'no secret, salt, or hash internals are exposed',
    'rollout and rollback statements are present',
    'contract and regression tests cover the implementation boundary',
    'No approval if implementation is enabled by default',
    'No approval if any secret, salt, or hash internals are exposed',
    'No approval if frontend defaults change without explicit approval',
    'No approval if endpoint defaults change without explicit approval',
    'No approval if provider integration changes without explicit approval',
    'No approval if rollback evidence is missing',
    'No approval if test evidence is missing',
    'lovebud-scout-storage-hash-helper-implementation-handoff-checklist.md',
    'lovebud-scout-storage-hash-helper-implementation-pr-template-note.md',
    'lovebud-scout-storage-hash-helper-implementation-reviewer-checklist.md',
    'lovebud-scout-storage-hash-helper-implementation-preflight-checklist.md',
    'lovebud-scout-storage-hash-helper-docs-index-audit-summary.md',
    'No runtime change',
    'No real hashing',
    'No salt or secret access',
    'No KV/DO/D1'
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
