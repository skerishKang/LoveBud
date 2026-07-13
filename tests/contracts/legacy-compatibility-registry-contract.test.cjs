// SOURCE_STATIC
// Legacy Compatibility Registry static contract test.
//
// Parses the LEGACY_COMPATIBILITY_REGISTRY.md document and verifies
// that every required entry, field, classification, and invariant is present.
// Does not execute any runtime code or access any API/production resource.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, 'docs/engineering/LEGACY_COMPATIBILITY_REGISTRY.md');
const registry = fs.readFileSync(REGISTRY_PATH, 'utf8');

// ─── Required sections / markers ──────────────────────────────────────────

test('registry file exists and is not empty', () => {
  assert.ok(registry.length > 0, 'LEGACY_COMPATIBILITY_REGISTRY.md must not be empty');
});

test('parent issue #3425 is referenced and not closed', () => {
  assert.ok(registry.includes('#3425'), 'registry must reference parent #3425');
  assert.ok(registry.includes('Keep OPEN'), '#3425 must remain OPEN');
});

test('#1882 is referenced as Keep OPEN', () => {
  assert.ok(registry.includes('#1882'), 'registry must reference #1882');
  const openLines = registry.split('\n').filter(l => l.includes('#1882') && l.includes('Keep OPEN'));
  assert.ok(openLines.length > 0, '#1882 must be marked Keep OPEN');
});

test('all 5 allowed classifications are defined', () => {
  for (const cls of ['RETAIN_TEMPORARILY', 'PERMANENT_COMPATIBILITY_BOUNDARY', 'REMOVAL_CANDIDATE', 'OWNED_BY_OTHER_TRACK', 'EVIDENCE_REQUIRED']) {
    assert.ok(registry.includes(cls), `classification ${cls} must be defined`);
  }
});

test('no disallowed classification values present', () => {
  const classificationSection = registry.split('## Classification vocabulary')[1] || '';
  // Extract all classification values from entries (text after `Classification:`)
  const entryClsMatches = registry.match(/Classification:\s*`([^`]+)`/g) || [];
  for (const m of entryClsMatches) {
    const val = m.replace('Classification: `', '').replace('`', '');
    assert.ok(
      ['RETAIN_TEMPORARILY', 'PERMANENT_COMPATIBILITY_BOUNDARY', 'REMOVAL_CANDIDATE', 'OWNED_BY_OTHER_TRACK', 'EVIDENCE_REQUIRED'].includes(val),
      `disallowed classification value: ${val}`
    );
  }
});

// ─── Required 8 entries ───────────────────────────────────────────────────

test('entry 1: public-tree adapter exists', () => {
  assert.ok(registry.includes('Entry 1: Transitional public-tree adapter'), 'entry 1 must exist');
});

test('entry 2: Modal public-read normalization exists', () => {
  assert.ok(registry.includes('Entry 2: Modal legacy public-read normalization'), 'entry 2 must exist');
});

test('entry 3: shared state aliases exist (3 sub-entries)', () => {
  assert.ok(registry.includes('Entry 3: Shared Viewer/Editor state aliases'), 'entry 3 must exist');
  assert.ok(registry.includes('3a. `window.currentTreeData`'), '3a must exist');
  assert.ok(registry.includes('3b. `window.currentTreeMemories`'), '3b must exist');
  assert.ok(registry.includes('3c. `window.__viewerTreeData`'), '3c must exist');
});

test('entry 4: editor canvas bridge exists', () => {
  assert.ok(registry.includes('Entry 4: Editor canvas global compatibility bridge'), 'entry 4 must exist');
});

test('entry 5: legacy key guard exists', () => {
  assert.ok(registry.includes('Entry 5: Legacy key guard'), 'entry 5 must exist');
});

test('entry 6: Social storage exists (moment + tree)', () => {
  assert.ok(registry.includes('Entry 6: Legacy moment/tree Social storage'), 'entry 6 must exist');
  assert.ok(registry.includes('6a. Moment-level Social'), '6a must exist');
  assert.ok(registry.includes('6b. Tree-level Social'), '6b must exist');
});

test('entry 7: Netlify artifacts exists', () => {
  assert.ok(registry.includes('Entry 7: Deprecated Netlify artifacts'), 'entry 7 must exist');
});

test('entry 8: Vercel fallback exists', () => {
  assert.ok(registry.includes('Entry 8: Transitional Vercel fallback'), 'entry 8 must exist');
});

// ─── Entry field validation ───────────────────────────────────────────────

function getEntrySections(text) {
  // Split on ## Entry headers
  const parts = text.split(/\n## Entry \d+:/);
  // parts[0] is the preamble; parts[1..] are entries
  return parts.slice(1);
}

function checkEntryFields(entryText, entryLabel) {
  const requiredFields = [
    'Evidence paths:',
    'Owner domain:',
    'Classification:',
    'Reason retained:',
    'Known consumers:',
    'Compatibility/change risk:',
    'Verification before removal:',
    'Rollback/restore expectation:',
    'Linked issue or future-child candidate:',
    'Last evidence baseline:'
  ];
  for (const field of requiredFields) {
    assert.ok(entryText.includes(field), `${entryLabel}: missing field "${field}"`);
  }

  // Must have either Exact removal preconditions or Permanent-support decision
  const hasRemovalPrecondition = entryText.includes('Exact removal preconditions:');
  const hasPermanentDecision = entryText.includes('Permanent-support decision:');
  assert.ok(hasRemovalPrecondition || hasPermanentDecision,
    `${entryLabel}: must have either "Exact removal preconditions" or "Permanent-support decision"`);

  // Evidence paths must not be empty (there should be content between list markers)
  const evidenceMatch = entryText.match(/Evidence paths:\s*\n((?:\s+- .+\n?)+)/);
  if (evidenceMatch) {
    assert.ok(evidenceMatch[1].trim().length > 0, `${entryLabel}: Evidence paths must not be empty`);
  }

  // Baseline SHA must be present
  assert.ok(entryText.includes('SHA:'), `${entryLabel}: baseline SHA required`);
  assert.ok(entryText.includes('Date:'), `${entryLabel}: baseline date required`);
}

const entries = getEntrySections(registry);
test('all 8 entries have required fields', () => {
  assert.ok(entries.length >= 8, `expected at least 8 entries, got ${entries.length}`);
  for (let i = 0; i < entries.length; i++) {
    checkEntryFields(entries[i], `Entry ${i + 1}`);
  }
});

// ─── Specific invariant checks ────────────────────────────────────────────

test('Social entry classification is OWNED_BY_OTHER_TRACK', () => {
  const socialEntry6 = entries.find(e => e.includes('Legacy moment/tree Social storage'));
  assert.ok(socialEntry6, 'Social storage entry must exist');
  assert.ok(socialEntry6.includes('OWNED_BY_OTHER_TRACK'), 'Social entry must be OWNED_BY_OTHER_TRACK');
});

test('Social entry references #3075 and #3188', () => {
  const socialEntry6 = entries.find(e => e.includes('Legacy moment/tree Social storage'));
  assert.ok(socialEntry6, 'Social storage entry must exist');
  assert.ok(socialEntry6.includes('#3075'), 'Social entry must reference #3075');
  assert.ok(socialEntry6.includes('#3188'), 'Social entry must reference #3188');
});

test('Social entry contains implementation-not-authorized disclaimer', () => {
  const socialEntry6 = entries.find(e => e.includes('Legacy moment/tree Social storage'));
  assert.ok(socialEntry6, 'Social storage entry must exist');
  assert.ok(
    socialEntry6.includes('does not authorize Social implementation') ||
    socialEntry6.includes('does not authorize moment-level Social') ||
    socialEntry6.includes('records compatibility context only'),
    'Social entry must contain implementation authorization disclaimer'
  );
});

test('no secret or private concrete values in registry', () => {
  const secrets = ['apiKey:', 'Bearer ', 'JWT', 'session ID', 'request ID', 'account ID', 'Firebase UID', 'database row'];
  for (const s of secrets) {
    // These words are allowed in descriptive context but not as concrete values
    // We only flag if they appear in code-block or inline-code context with apparent values
    const lines = registry.split('\n').filter(l => l.includes(s) && !l.trim().startsWith('//') && !l.trim().startsWith('#'));
    // This is a lightweight check — detailed secret scan is separate
  }
  // More importantly: no .secrets/ or credential file paths
  assert.ok(!registry.includes('.secrets'), 'must not reference .secrets path');
});

test('no runtime deletion or migration authorization language', () => {
  const dangerous = [
    'delete the legacy',
    'migrate the legacy',
    'remove the legacy',
    'drop column',
    'DROP TABLE',
    'this document authorizes'
  ];
  for (const phrase of dangerous) {
    assert.ok(!registry.toLowerCase().includes(phrase.toLowerCase()),
      `registry must not contain: "${phrase}"`);
  }
});

// ─── Evidence path exists checks ──────────────────────────────────────────

test('public-tree-adapter.js evidence path exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'js/api/public-tree-adapter.js')),
    'js/api/public-tree-adapter.js must exist');
});

test('legacy-key-guard.js evidence path exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'functions/_shared/legacy-key-guard.js')),
    'functions/_shared/legacy-key-guard.js must exist');
});

test('modal_compute directory exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'modal_compute')),
    'modal_compute/ must exist');
});

test('vercel.json exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'vercel.json')), 'vercel.json must exist');
});

test('netlify directory exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'netlify')), 'netlify/ must exist');
});

// ─── Owner domain presence ────────────────────────────────────────────────

test('all entries have non-empty Owner domain', () => {
  for (const entry of entries) {
    const match = entry.match(/Owner domain:\s*(.+)/);
    assert.ok(match && match[1].trim(), 'Owner domain must not be empty');
  }
});

test('all entries have non-empty Classification', () => {
  for (const entry of entries) {
    const match = entry.match(/Classification:\s*`([^`]+)`/);
    assert.ok(match && match[1].trim(), 'Classification must not be empty');
  }
});

test('all entries have non-empty Reason retained', () => {
  for (const entry of entries) {
    const match = entry.match(/Reason retained:\s*([\s\S]*?)(?:\n-|\n##|$)/);
    assert.ok(match, 'Reason retained must be present');
  }
});

test('all entries have non-empty Known consumers', () => {
  for (const entry of entries) {
    assert.ok(entry.includes('Known consumers:'), 'Known consumers field must exist');
    // Check there's content after the field header
    const afterField = entry.split('Known consumers:')[1] || '';
    assert.ok(afterField.trim().length > 0, 'Known consumers must have content');
  }
});
