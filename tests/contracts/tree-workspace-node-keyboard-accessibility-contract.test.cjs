const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(ROOT, 'docs', 'product', 'lovebud-tree-workspace-node-keyboard-accessibility-contract.md');

test('Contract Document existence and sections integrity', () => {
  assert.ok(fs.existsSync(DOC_PATH), `Contract document must exist: ${DOC_PATH}`);
  const content = fs.readFileSync(DOC_PATH, 'utf8');

  // Verify mandatory sections are present
  const requiredSections = [
    '# LoveBud Tree Workspace Node Keyboard Accessibility Contract',
    '## Status and scope',
    '## Audit method and evidence standard',
    '## Editor node rendering and interaction inventory',
    '## Public Viewer node rendering and interaction inventory',
    '## Existing pointer, selection, and detail-panel paths',
    '## Existing keyboard and focus behavior',
    '## Needs runtime/browser verification',
    '## Recommended semantic host and focus model',
    '## Keyboard interaction contract',
    '## Selection, detail-panel, and focus-return contract',
    '## Privacy-safe accessible-name contract',
    '## Canvas, drag, pan, zoom, and mobile conflict boundaries',
    '## Protected and delegated ownership',
    '## First implementation slice',
    '## Regression coverage and browser-validation plan',
    '## Explicit non-goals',
    '## References'
  ];

  requiredSections.forEach(section => {
    assert.ok(content.includes(section), `Document must contain section: ${section}`);
  });
});

test('Contract contents verification of selection, behaviors, models, and boundaries', () => {
  const content = fs.readFileSync(DOC_PATH, 'utf8');

  // click and touchend are selection evidence
  assert.ok(content.includes('click') && content.includes('touchend') && content.includes('bindNodePointerSelection'), 'Must document click/touchend for selection');

  // mousedown / pointerdown are drag-start, pointerdown is not selection
  assert.ok(content.includes('mousedown') && content.includes('pointerdown') && content.includes('bindNodeDragStart'), 'Must document mousedown/pointerdown as drag start');
  assert.ok(content.includes('not node-selection events') || content.includes('not a node-selection'), 'Must specify pointerdown is not a selection event');

  // Editor and Viewer behaviors are split
  assert.ok(content.includes('Editor current keyboard evidence') && content.includes('Public Viewer current keyboard evidence'), 'Must split Editor and Viewer keyboard behaviors');

  // canEdit: false and Viewer Arrow navigation missing is recorded
  assert.ok(content.includes('canEdit: false') && content.includes('does not enable Arrow navigation in public Viewer'), 'Must record Viewer arrow navigation limitations');

  // Home/End/Escape/focus-return in proposed contracts
  const proposedSection = content.substring(content.indexOf('### Proposed implementation contract'));
  assert.ok(proposedSection.includes('Home/End'), 'Home/End must be in proposed contract');
  assert.ok(proposedSection.includes('Escape'), 'Escape must be in proposed contract');
  assert.ok(proposedSection.includes('focus') || proposedSection.includes('restoration'), 'Focus return must be in proposed contract');

  // Runtime/browser verification includes drag, pan/zoom, touch, reduced-motion, screen-reader
  const verificationSection = content.substring(content.indexOf('## Needs runtime/browser verification'), content.indexOf('## Recommended semantic host'));
  const keywords = ['drag', 'pan/zoom', 'touch', 'reduced-motion', 'VoiceOver/NVDA'];
  keywords.forEach(k => {
    assert.ok(verificationSection.includes(k), `Verification must include: ${k}`);
  });

  // Privacy section verification
  const privacySection = content.substring(content.indexOf('## Privacy-safe accessible-name contract'));
  assert.ok(privacySection.includes('.node-mood'), 'Privacy section must include .node-mood element check');
  assert.ok(privacySection.includes('resolveNodeHighlightText'), 'Privacy section must include resolveNodeHighlightText function check');
  assert.ok(!privacySection.includes('.node-highlight-text'), 'Privacy section must not contain stale .node-highlight-text');

  // No line numbers check
  const lineNumbers = ['line 78', 'line 79', 'line 82', 'line 49'];
  lineNumbers.forEach(ln => {
    assert.ok(!content.includes(ln), `Must not contain stale line number: ${ln}`);
  });

  // Editor verified selection/detail path contains required terms
  const selectionPathSection = content.substring(content.indexOf('### Editor verified selection and detail path'));
  const selectionTerms = ['createEditorSelectNodeHandler', 'createEditorDetailUI', 'updateDetailPanel', 'onNodeClick'];
  selectionTerms.forEach(term => {
    assert.ok(selectionPathSection.includes(term), `Selection path must include: ${term}`);
  });

  // Viewer detail path verification
  const viewerPathSection = content.substring(content.indexOf('### Viewer verified selection and detail path'));
  assert.ok(viewerPathSection.includes('createPublicCanvasOptions') || viewerPathSection.includes('runtime/browser verification'), 'Viewer detail path must contain verified adapter or runtime verification details');

  // Future implementation tests checks
  assert.ok(content.includes('tests/contracts/editor-canvas-node-keyboard-roving-contract.test.cjs'), 'Must include roving contract path');
  assert.ok(content.includes('tests/routes/editor-node-keyboard-interaction-contract.test.cjs'), 'Must include editor route interaction contract path');
  assert.ok(content.includes('tests/routes/public-viewer-node-keyboard-parity-contract.test.cjs'), 'Must include viewer route parity contract path');

  // Browser validation plan categories
  const validationSection = content.substring(content.indexOf('## Regression coverage and browser-validation plan'));
  assert.ok(validationSection.includes('Editor desktop:'), 'Must validate Editor desktop path');
  assert.ok(validationSection.includes('Public Viewer desktop:'), 'Must validate Viewer desktop path');
  assert.ok(validationSection.includes('Mobile and assistive technology:'), 'Must validate Mobile/AT path');

  // First implementation slice has 4 files
  const files = [
    'js/editor/editor-canvas-node.js',
    'js/editor/editor-canvas-ui-helpers.js',
    'js/editor/editor-canvas.js',
    'js/viewer/public-canvas-init.js'
  ];
  files.forEach(f => {
    assert.ok(content.includes(f), `Implementation slice must list: ${f}`);
  });

  // Protected issue boundaries
  const issues = ['#3072', '#2960', '#2972', '#2976', '#3121', '#1882'];
  issues.forEach(issue => {
    assert.ok(content.includes(issue), `Must reference protected issue: ${issue}`);
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
