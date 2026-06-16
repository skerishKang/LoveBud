'use strict';

const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const DOC_PATH = path.join(
  __dirname,
  '..',
  '..',
  'docs',
  'product',
  'lovebud-scout-post-readiness-implementation-sequence.md'
);

function readDoc() {
  return fs.readFileSync(DOC_PATH, 'utf8');
}

test('post-readiness sequence doc exists and is non-empty', () => {
  assert.ok(fs.existsSync(DOC_PATH), 'docs file must exist');
  const content = readDoc();
  assert.ok(content.length > 200, 'docs file must have substantive content');
});

test('post-readiness sequence doc names parent umbrella #1882 and keeps it open', () => {
  const content = readDoc();
  assert.match(content, /#1882/);
  assert.match(content, /keeps?\s+#1882\s+open/i);

  // Scope: the auto-close keyword guard section is allowed to mention
  // `closes #1882` / `fixes #1882` / `resolves #1882` as the forbidden
  // patterns. Outside that section, none of those phrases may appear.
  const guardHeader = '## 7. GitHub auto-close keyword guard for #1882';
  const guardIdx = content.indexOf(guardHeader);
  assert.ok(guardIdx >= 0, 'expected auto-close keyword guard section');
  const beforeGuard = content.slice(0, guardIdx);
  assert.doesNotMatch(beforeGuard, /closes\s+#1882/i);
  assert.doesNotMatch(beforeGuard, /fixes\s+#1882/i);
  assert.doesNotMatch(beforeGuard, /resolves\s+#1882/i);
});

test('post-readiness sequence doc lists all nine completed readiness audits', () => {
  const content = readDoc();
  const audits = [
    '#2524',
    '#2526',
    '#2528',
    '#2530',
    '#2538',
    '#2557',
    '#2559',
    '#2561',
    '#2563',
  ];
  for (const audit of audits) {
    assert.match(
      content,
      new RegExp(audit.replace('#', '#')),
      `expected reference to ${audit} in the post-readiness sequence doc`
    );
  }
});

test('post-readiness sequence doc locks safe defaults', () => {
  const content = readDoc();
  assert.match(content, /stub/i, 'expected stub endpoint default');
  assert.match(content, /local_stub/i, 'expected local_stub frontend default');
  assert.match(
    content,
    /live\s+endpoint\s+client\s+(?:remains\s+)?disabled/i
  );
  assert.match(content, /staging_live/);
  assert.match(content, /production_live/);
  assert.match(content, /no\s+provider\s+credentials/i);
});

test('post-readiness sequence doc forbids runtime code changes in this slice', () => {
  const content = readDoc();
  const forbiddenMarkers = [
    /no\s+provider\s+sdk/i,
    /no\s+runtime\s+firebase\s+auth/i,
    /no\s+persistent\s+storage\s+writes/i,
    /no\s+db\/api\/schema\s+changes/i,
    /no\s+frontend\s+runtime/i,
    /no\s+browse\/search\/#1661/i,
  ];
  for (const marker of forbiddenMarkers) {
    assert.match(content, marker, `expected doc to mention ${marker}`);
  }
});

test('post-readiness sequence doc recommends runtime Firebase auth enforcement as first gate', () => {
  const content = readDoc();
  assert.match(
    content,
    /runtime\s+firebase\s+auth\s+enforcement/i
  );
  // The first gate should appear before any later gate mention in the
  // recommended-order section. Check that the doc names it as the first
  // runtime gate.
  const firstGateMatch = content.match(
    /recommended\s+first\s+runtime\s+gate\s+is\s+\*\*([^*]+)\*\*/i
  );
  assert.ok(firstGateMatch, 'expected explicit "recommended first runtime gate" line');
  assert.match(
    firstGateMatch[1],
    /runtime\s+firebase\s+auth\s+enforcement/i
  );
});

test('post-readiness sequence doc mentions GitHub auto-close keyword guard', () => {
  const content = readDoc();
  assert.match(content, /auto-close\s+keyword\s+guard/i);
  assert.match(content, /closes\s+#1882/);
  assert.match(content, /fixes\s+#1882/);
  assert.match(content, /resolves\s+#1882/);
  assert.match(content, /keeps?\s+#1882\s+open/i);
});

test('post-readiness sequence doc is docs/contracts-only and explicitly disclaims authorization', () => {
  const content = readDoc();
  // Allow markdown bold between "does" and "not" / "authorize" and the
  // authorized-or-not targets.
  assert.match(
    content,
    /does\s+\*\*not\*\*\s+authorize[^]*?(?:live\s+execution|staging_live|production_live|live\s+provider)/i
  );
  assert.match(
    content,
    /no\s+provider\s+credentials\s+are\s+read/i
  );
});

test('post-readiness sequence doc does not add runtime implementation for any gate', () => {
  const content = readDoc();
  const gates = [
    'runtime Firebase auth enforcement',
    'persistent rate-limit storage',
    'runtime cost/quota monitor',
    'runtime abuse reporting',
    'provider-specific real adapter',
    'live integration test harness',
    'staging soak',
    'kill-switch drill',
    'credential rotation drill',
  ];
  for (const gate of gates) {
    // The doc must mention each gate only as future implementation work,
    // not as something added in this slice. The forbidden-prefix regex
    // asserts that none of these gates are introduced in the runtime
    // non-goals section as "added in this slice".
    const sliceAddRegex = new RegExp(
      `adds?(?:\\s+|\u00a0)+(?:a\\s+|the\\s+)?${gate.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`,
      'i'
    );
    assert.doesNotMatch(
      content,
      sliceAddRegex,
      `slice must not add runtime for ${gate}`
    );
  }
});

test('post-readiness sequence doc names #2522 as completed blocker map, not as runtime authorization', () => {
  const content = readDoc();
  assert.match(content, /#2522/);
  assert.match(
    content,
    /#2522[^]*?(?:completed\s+as\s+a\s+map|not\s+as\s+runtime)/i
  );
});
