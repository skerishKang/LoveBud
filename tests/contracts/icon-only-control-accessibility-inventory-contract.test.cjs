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
    '## Verified static inventory details',
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

  // No stale provider strings checks
  const staleProviders = [
    'Provider: js/editor/editor-canvas-viewport.js',
    'Provider: js/editor/editor-floating-toolbar.js',
    'Provider: js/auth/email-auth-modal.js'
  ];
  staleProviders.forEach(p => {
    assert.ok(!content.includes(p), `Must not contain stale provider string: ${p}`);
  });

  // No stale label strings checks
  const staleLabels = [
    'aria-label="스카우트"',
    'aria-label="순간 공유"',
    'aria-label="순간 포커스"'
  ];
  staleLabels.forEach(l => {
    assert.ok(!content.includes(l), `Must not contain stale label string: ${l}`);
  });

  // Verification counts checks
  assert.ok(content.includes('Static inventory entries with verified markup evidence: 11'), 'Must state 11 verified markup items');
  assert.ok(content.includes('Focus/interaction remediation candidates: 3'), 'Must state 3 focus remediation candidates');
  assert.ok(content.includes('Needs runtime/browser verification leads: 7'), 'Must state 7 runtime verification leads');

  // Verify 11 selectors exist in detail section
  const detailsSection = content.substring(content.indexOf('## Verified static inventory details'), content.indexOf('## Non-goals and boundaries'));
  const selectors = [
    '#previewMobileClose',
    '#createTreeModalCloseBtn',
    '#myTreesHubClose',
    '#zoomInCanvasBtn',
    '#zoomOutCanvasBtn',
    '#ftbMoreBtn',
    '#ftbScoutAction',
    '#ftbDeleteAction',
    '#ftbShareAction',
    '#ftbFocusAction',
    '#email-auth-close'
  ];
  selectors.forEach(sel => {
    assert.ok(detailsSection.includes(sel), `Details section must contain: ${sel}`);
  });

  // Verify template/page paths and labels exist
  assert.ok(detailsSection.includes('pages/search.html') && detailsSection.includes('aria-label="감상 닫기"'), 'Must map previewMobileClose correctly');
  assert.ok(detailsSection.includes('pages/my-trees.html') && detailsSection.includes('aria-label="닫기"'), 'Must map myTreesClose correctly');
  assert.ok(detailsSection.includes('js/editor/templates/editor-canvas-topbar-template.js') && detailsSection.includes('aria-label="확대"'), 'Must map zoomInCanvasBtn correctly');
  assert.ok(detailsSection.includes('js/editor/templates/editor-floating-toolbar-template.js') && detailsSection.includes('aria-label="Scout로 순간 저장"'), 'Must map ftbScoutAction correctly');
  assert.ok(detailsSection.includes('pages/login.html') && detailsSection.includes('aria-label="모달 닫기"'), 'Must map email-auth-close correctly');

  // Verify native-button and explicit menuitem semantics are documented
  assert.ok(detailsSection.includes('button (implicit native `<button>` semantics)'), 'Must document implicit native button semantics');
  assert.ok(detailsSection.includes('menuitem (explicit `role="menuitem"` attribute)'), 'Must document menuitem role');

  // Verify ftbMoreBtn route scope is Editor-only
  const ftbMoreBtnDetails = detailsSection.substring(detailsSection.indexOf('Selector**: `#ftbMoreBtn`'), detailsSection.indexOf('Selector**: `#ftbScoutAction`'));
  assert.ok(ftbMoreBtnDetails.includes('Editor floating toolbar') && !ftbMoreBtnDetails.includes('Viewer'), 'ftbMoreBtn details must restrict route/surface to Editor-only');

  // Candidates separation and verification
  const candidatesSection = content.substring(content.indexOf('### Focus or interaction remediation candidates'), content.indexOf('### Needs runtime/browser verification'));
  const candidates = ['#ftbMoreBtn', '#myTreesHubClose', '#previewMobileClose'];
  candidates.forEach(c => {
    assert.ok(candidatesSection.includes(c), `Remediation candidates section must include: ${c}`);
    assert.ok(candidatesSection.includes('Static name/semantic evidence: verified.'), 'Must verify static evidence for candidates');
    assert.ok(candidatesSection.includes('Interaction/focus remediation: pending route-specific source and browser verification.'), 'Must set interaction remediation to pending for candidates');
  });

  // Verify 7 runtime leads exist and use generic verification format
  const runtimeSection = content.substring(content.indexOf('### Needs runtime/browser verification'), content.indexOf('## Verified static inventory details'));
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
  assert.ok(runtimeSection.includes('determine whether the rendered element is interactive or decorative;'), 'Must use generic verification formats for runtime leads');
  assert.ok(runtimeSection.includes('inspect its computed accessible name, role, and state semantics;'), 'Must use generic verification formats for runtime leads');

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
