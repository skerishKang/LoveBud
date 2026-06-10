const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docPath = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-scout-storage-hash-helper-implementation-evidence-packet.md');

test('Scout storage hash helper implementation evidence packet is documented', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  for (const phrase of [
    '#1882',
    '#2396',
    'Future implementation PR review remains blocked unless this evidence packet is complete',
    'handoff checklist',
    'PR template note',
    'reviewer checklist',
    'approval matrix',
    'go/no-go summary',
    'lovebud-scout-storage-hash-helper-implementation-handoff-checklist.md',
    'lovebud-scout-storage-hash-helper-implementation-pr-template-note.md',
    'lovebud-scout-storage-hash-helper-implementation-reviewer-checklist.md',
    'lovebud-scout-storage-hash-helper-implementation-approval-matrix.md',
    'lovebud-scout-storage-hash-helper-implementation-go-no-go-summary.md',
    'lovebud-scout-storage-hash-helper-implementation-preflight-checklist.md',
    'lovebud-scout-storage-hash-helper-docs-index-audit-summary.md',
    'Product approval evidence',
    'Engineering approval evidence',
    'Security/privacy approval evidence',
    'Operations/deployment approval evidence',
    'Test evidence approval',
    'Disabled-by-default evidence',
    'No import-time side effects evidence',
    'No endpoint default change evidence',
    'No frontend default source change evidence',
    'No provider integration change evidence',
    'No secret, salt, or hash internals exposure evidence',
    'No raw user identifiers, raw tokens, Authorization headers, provider secrets, or storage keys exposure evidence',
    'Rollback evidence',
    'Contract and regression test evidence',
    'Block implementation review if any required evidence item is missing',
    'Block implementation review if implementation is enabled by default',
    'Block implementation review if runtime hashing is added before approval gates pass',
    'Block implementation review if salt or secret access is added',
    'Block implementation review if KV, Durable Object, or D1 wiring is added',
    'Block implementation review if endpoint wiring, frontend default source behavior, or provider integration changes without explicit approval',
    'Block implementation review if Browse #1661 work is included',
    'Block implementation review if rollback evidence is missing',
    'Block implementation review if test evidence is missing',
    'Docs/tests only',
    'No real hashing',
    'No salt or secret access',
    'No KV/DO/D1',
    'No endpoint wiring change',
    'No frontend default source change',
    'No provider integration'
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
