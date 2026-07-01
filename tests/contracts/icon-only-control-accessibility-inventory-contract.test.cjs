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

  // Verify inventory field set identifiers exist
  const fields = ['DOM selector', 'visual purpose', 'role', 'Keyboard behavior', 'Focus behavior'];
  fields.forEach(f => {
    assert.ok(content.toLowerCase().includes(f.toLowerCase()), `Document must refer to inventory field: ${f}`);
  });

  // Verify disposition categories are documented
  const dispositions = [
    'compliant',
    'missing name',
    'misleading name',
    'missing state semantics',
    'focus issue',
    'decorative/non-interactive'
  ];
  dispositions.forEach(disp => {
    assert.ok(content.includes(disp), `Document must categorize disposition: ${disp}`);
  });

  // Verify delegated and protected issue boundaries are referenced
  const issueBoundaries = ['#3073', '#3006', '#3072', '#2972', '#2976', '#2960', '#2856'];
  issueBoundaries.forEach(issue => {
    assert.ok(content.includes(issue), `Document must reference issue boundary: ${issue}`);
  });

  // Verify minimum three remediation candidates exist
  assert.ok(content.includes('Candidate 1'), 'Must have Candidate 1');
  assert.ok(content.includes('Candidate 2'), 'Must have Candidate 2');
  assert.ok(content.includes('Candidate 3'), 'Must have Candidate 3');
});

test('Document and test do not make active code changes or deployment changes', () => {
  const content = fs.readFileSync(DOC_PATH, 'utf8');
  assert.ok(content.includes('Explicit non-goals'), 'Document must list non-goals');
  assert.ok(content.includes('No UI tag click handler') || content.includes('No UI'), 'Must state no UI/code change in non-goals');
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
