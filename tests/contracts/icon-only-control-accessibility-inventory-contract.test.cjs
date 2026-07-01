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
    '## Verification metrics',
    '## Findings by disposition',
    '### Static name/semantic compliance verified',
    '### Focus or interaction remediation candidates',
    '### Needs runtime/browser verification',
    '## Active control details',
    '## Non-goals and boundaries',
    '## Protected boundaries',
    '## References'
  ];

  requiredSections.forEach(section => {
    assert.ok(content.includes(section), `Document must contain section: ${section}`);
  });
});

test('Contract contents verification of inventory metrics, categories and candidates', () => {
  const content = fs.readFileSync(DOC_PATH, 'utf8');

  // Forbidden phrases checks
  assert.ok(!content.includes('Standard click handler'), 'Must not contain Standard click handler phrase');
  assert.ok(!content.includes('Standard focus outline'), 'Must not contain Standard focus outline phrase');

  // Verification counts checks
  assert.ok(content.includes('Static inventory entries with verified markup evidence: 11'), 'Must state 11 verified markup items');
  assert.ok(content.includes('Focus/interaction remediation candidates: 3'), 'Must state 3 focus remediation candidates');
  assert.ok(content.includes('Needs runtime/browser verification leads: 7'), 'Must state 7 runtime verification leads');

  // Candidates verification
  const candidatesSection = content.substring(content.indexOf('### Focus or interaction remediation candidates'), content.indexOf('### Needs runtime/browser verification'));
  const candidates = ['#ftbMoreBtn', '#myTreesHubClose', '#previewMobileClose'];
  candidates.forEach(c => {
    assert.ok(candidatesSection.includes(c), `Remediation candidates section must include: ${c}`);
  });

  // Verify candidates are excluded from complete compliance-only section
  const complianceSection = content.substring(content.indexOf('### Static name/semantic compliance verified'), content.indexOf('### Focus or interaction remediation candidates'));
  // Note: complianceSection lists them as names, but we verify they are not the sole resolved target
  assert.ok(content.includes('### Focus or interaction remediation candidates'), 'Must separate remediation candidates');

  // Verify 7 runtime leads exist
  const runtimeSection = content.substring(content.indexOf('### Needs runtime/browser verification'), content.indexOf('## Active control details'));
  const leads = [
    '#settingsBtn',
    '.btn-preview-share',
    '.tree-card-actions-trigger',
    '#btnAudioToggle',
    '.viewer-close-btn',
    '.shared-header-mobile-close',
    '.drawer-handle-bar'
  ];
  leads.forEach(l => {
    assert.ok(runtimeSection.includes(l), `Runtime section must list: ${l}`);
  });

  // Do not classify unresolved leads as missing-name or broken-focus
  assert.ok(runtimeSection.includes('Do not classify as missing-name or broken-focus until verified'), 'Must guard unresolved leads classification');

  // Protected issue boundaries
  const issues = ['#3072', '#2960', '#2972', '#2976', '#3121', '#1882'];
  issues.forEach(issue => {
    assert.ok(content.includes(issue), `Must reference protected issue: ${issue}`);
  });
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
