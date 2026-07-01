const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(ROOT, 'docs', 'product', 'lovebud-icon-only-control-accessibility-inventory.md');

test('Contract Document existence and sections integrity', () => {
  assert.ok(fs.existsSync(DOC_PATH), `Contract document must exist: ${DOC_PATH}`);
  const content = fs.readFileSync(DOC_PATH, 'utf8');

  // Verify mandatory sections are present
  const requiredSections = [
    '# LoveBud Icon-Only Control Accessibility Inventory',
    '## Status and scope',
    '## Audit method and inclusion rules',
    '## Home',
    '## Browse and Search',
    '## My Trees',
    '## Editor',
    '## Viewer',
    '## Authentication and shared overlays',
    '## Representative mobile surfaces',
    '## Findings by disposition',
    '## Protected and delegated ownership',
    '## Ranked remediation candidates',
    '## Regression coverage requirements',
    '## Explicit non-goals',
    '## References'
  ];

  requiredSections.forEach(section => {
    assert.ok(content.includes(section), `Document must contain section: ${section}`);
  });
});

test('Contract contents verification of fields, dispositions, and candidates', () => {
  const content = fs.readFileSync(DOC_PATH, 'utf8');

  // Verify status section specifies "Initial static-code inventory"
  assert.ok(content.includes('Initial static-code inventory'), 'Must specify Initial static-code inventory status');

  // Verify no speculative phrases like "if present as icon-only" exist
  assert.ok(!content.includes('if present as icon-only'), 'Must not contain speculative if present as icon-only');
  assert.ok(!content.includes('aria-label or raw Material glyph'), 'Must not contain speculative name attributes');
  assert.ok(!content.includes('standard click handler'), 'Must not contain speculative handlers');
  assert.ok(!content.includes('standard outline'), 'Must not contain speculative outlines');
  assert.ok(!content.includes('highlighted focus ring'), 'Must not contain speculative focus rings');
  assert.ok(!content.includes('outlined focus'), 'Must not contain speculative focus behavior');

  // Verify #previewMobileClose classification
  assert.ok(content.includes('aria-label="감상 닫기"'), 'Must document previewMobileClose label');
  assert.ok(!content.includes('missing name') || !content.match(/previewMobileClose.*missing name/i), 'previewMobileClose must not be marked as missing name');

  // Verify ownership references (Refs #3073, #2977, #2965)
  assert.ok(content.includes('#3073 provides completed toolbar-accessibility evidence only'), 'Must correct #3073 description');
  assert.ok(content.includes('#2977') && content.includes('#2965'), 'Must reference #2977 and #2965');

  // Verify candidate properties
  const candidates = ['Candidate 1', 'Candidate 2', 'Candidate 3'];
  candidates.forEach(cand => {
    assert.ok(content.includes(cand), `Must document ${cand}`);
  });

  // Verify inventory field set identifiers exist
  const fields = ['selector', 'file path', 'current evidence', 'minimal remediation', 'test requirement', 'boundary'];
  fields.forEach(f => {
    assert.ok(content.toLowerCase().includes(f.toLowerCase()), `Document must refer to candidate field: ${f}`);
  });

  // Verify delegated and protected issue boundaries are referenced
  const issueBoundaries = ['#3073', '#3006', '#3072', '#2972', '#2976', '#2960', '#2856'];
  issueBoundaries.forEach(issue => {
    assert.ok(content.includes(issue), `Document must reference issue boundary: ${issue}`);
  });
});

test('Document and test do not make active code changes or deployment changes', () => {
  const content = fs.readFileSync(DOC_PATH, 'utf8');
  assert.ok(content.includes('Explicit non-goals'), 'Document must list non-goals');
  assert.ok(content.includes('No HTML, JavaScript, CSS') || content.includes('No HTML'), 'Must state no UI/code change in non-goals');
});

test('Prohibited phrases absence in both document and test file', () => {
  const content = fs.readFileSync(DOC_PATH, 'utf8');
  const selfContent = fs.readFileSync(__filename, 'utf8');

  // Avoid matching our own source code by splitting or dynamic construction
  const patternStr = '\\b(Closes|Fixes|Resolves)\\s+#1882\\b';
  const forbiddenRegex = new RegExp(patternStr, 'i');

  assert.ok(!forbiddenRegex.test(content), 'Document must not contain prohibited links');
  assert.ok(!forbiddenRegex.test(selfContent), 'Test file itself must not contain prohibited links');
});

test('Test file does not contain local file links', () => {
  const selfContent = fs.readFileSync(__filename, 'utf8');
  // Evade matching this literal string by using split
  const literalUri = ['file', ':', '///'].join('');
  assert.ok(!selfContent.includes(literalUri), 'Test file itself must not contain local file links');
});
