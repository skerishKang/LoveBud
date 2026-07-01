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

  // Verify counts
  assert.ok(content.includes('Verified active controls count**: 11') || content.includes('Verified active controls count: 11') || content.includes('active controls count: 11'), 'Must verify active control count is 11');
  assert.ok(content.includes('verification count**: 7') || content.includes('verification count: 7'), 'Must verify runtime verification count is 7');

  // Verify zoom controls evidence and no false positives
  assert.ok(content.includes('aria-live="polite"'), 'Must reference aria-live="polite" for zoom indicator');
  assert.ok(content.includes('updateZoomIndicator()'), 'Must reference updateZoomIndicator() evidence');
  assert.ok(!content.includes('state alert missing'), 'Must not claim state alert missing for zoom controls');
  assert.ok(!content.includes('lacks explicit dynamic live region'), 'Must not claim lacks explicit dynamic live region for zoom controls');

  // Verify create tree modal focus restoration evidence and no false positives
  assert.ok(content.includes('lastFocusedEl'), 'Must reference lastFocusedEl evidence');
  assert.ok(content.includes('restoreTarget.focus()'), 'Must reference restoreTarget.focus() evidence');
  assert.ok(!content.includes('focus lost upon modal close'), 'Must not claim focus lost upon modal close');
  assert.ok(!content.includes('focus restoration logic is needed'), 'Must not claim focus restoration logic is needed for create tree modal');

  // Verify three final candidates
  const expectedCandidates = ['#ftbMoreBtn', '#myTreesHubClose', '#previewMobileClose'];
  expectedCandidates.forEach(cand => {
    assert.ok(content.includes(cand), `Must document candidate: ${cand}`);
  });

  // Verify previewMobileClose classification
  assert.ok(!content.includes('missing name') || !content.match(/previewMobileClose.*missing name/i), 'previewMobileClose must not be marked as missing name');

  // Verify delegated and protected issue boundaries are referenced
  const issueBoundaries = ['#3073', '#3006', '#3072', '#2972', '#2976', '#2960', '#2856', '#2977', '#2965'];
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
